import { describe, expect, it } from "vitest";

import {
  calculateSenateAggregates,
  loadSenateTrades,
  normalizeSenateDisclosures,
  parseAmountRange,
  parseOfficialSenateRoster,
  senateWindowStart,
  type RawSenateDisclosure,
  type SenateMember,
} from "./senate-trades";

const MEMBERS: SenateMember[] = [
  { senateId: "D1", firstName: "Dana", lastName: "Blue", party: "Democratic", state: "NY", sourceUrl: "official" },
  { senateId: "D2", firstName: "Devon", lastName: "Blue", party: "Democratic", state: "CA", sourceUrl: "official" },
  { senateId: "R1", firstName: "Riley", lastName: "Red", party: "Republican", state: "TX", sourceUrl: "official" },
  { senateId: "I1", firstName: "Indy", lastName: "Gray", party: "Independent/Other", state: "VT", sourceUrl: "official" },
];

function raw(overrides: Partial<RawSenateDisclosure> = {}): RawSenateDisclosure {
  return {
    symbol: "ACME",
    senateID: "D1",
    disclosureDate: "2026-08-20",
    transactionDate: "2026-08-01",
    firstName: "Dana",
    lastName: "Blue",
    office: "Dana Blue",
    district: "NY",
    owner: "Self",
    assetDescription: "Acme Common Stock",
    assetType: "Stock",
    type: "Purchase",
    amount: "$1,001 - $15,000",
    comment: "",
    link: "https://efdsearch.senate.gov/search/view/ptr/filing-1",
    ...overrides,
  };
}

describe("Senate source parsing", () => {
  it("parses amount categories without inventing a midpoint", () => {
    expect(parseAmountRange("$1,001 - $15,000")).toEqual({
      lower: 1001,
      upper: 15000,
      display: "$1,001 - $15,000",
    });
    expect(parseAmountRange("Over $50,000,000")).toEqual({
      lower: 50000000,
      upper: null,
      display: "Over $50,000,000",
    });
    expect(parseAmountRange("Undisclosed").lower).toBeNull();
  });

  it("maps official party codes and keeps independents separate", () => {
    const members = parseOfficialSenateRoster(`
      <contact_information>
        <member><first_name>A</first_name><last_name>One</last_name><party>D</party><state>AA</state><bioguide_id>D1</bioguide_id></member>
        <member><first_name>B</first_name><last_name>Two</last_name><party>I</party><state>BB</state><bioguide_id>I1</bioguide_id></member>
      </contact_information>
    `);
    expect(members.map((member) => member.party)).toEqual(["Democratic", "Independent/Other"]);
  });
});

describe("Senate normalization", () => {
  it("labels ownership, excludes non-equities, deduplicates, and preserves amendment lineage", () => {
    const original = raw();
    const amended = raw({
      disclosureDate: "2026-08-21",
      comment: "Amendment",
      amount: "$15,001 - $50,000",
      link: "https://efdsearch.senate.gov/search/view/ptr/filing-2",
    });
    const bond = raw({
      symbol: "GS",
      senateID: "R1",
      owner: "Spouse",
      assetDescription: "Goldman Sachs bond",
      assetType: "Corporate Bond",
      link: "https://efdsearch.senate.gov/search/view/ptr/filing-3",
    });
    const result = normalizeSenateDisclosures([original, original, amended, bond], MEMBERS, new Date("2026-08-22T12:00:00Z"));
    expect(result.exactDuplicates).toBe(1);
    expect(result.supersededVersions).toBe(1);
    expect(result.transactions).toHaveLength(2);
    const equity = result.transactions.find((transaction) => transaction.canonicalTicker === "ACME")!;
    expect(equity).toMatchObject({
      amendmentStatus: "amended",
      rawVersionCount: 2,
      eligiblePurchase: true,
      partyAtTrade: "Democratic",
    });
    expect(equity.supersededSourceIds).toHaveLength(1);
    expect(result.transactions.find((transaction) => transaction.canonicalTicker === "GS")).toMatchObject({
      owner: "Spouse",
      eligiblePurchase: false,
    });
  });
});

describe("Senate aggregates", () => {
  it("requires buyers from both major parties and ranks by distinct senators before events", () => {
    const records = [
      raw({ senateID: "D1", link: "https://efdsearch.senate.gov/search/view/ptr/a" }),
      raw({ senateID: "D2", link: "https://efdsearch.senate.gov/search/view/ptr/b" }),
      raw({ senateID: "R1", owner: "Spouse", link: "https://efdsearch.senate.gov/search/view/ptr/c" }),
      raw({ senateID: "I1", link: "https://efdsearch.senate.gov/search/view/ptr/d" }),
      raw({ symbol: "SOLO", senateID: "D1", link: "https://efdsearch.senate.gov/search/view/ptr/e" }),
      raw({ symbol: "SOLO", senateID: "D1", transactionDate: "2026-08-02", link: "https://efdsearch.senate.gov/search/view/ptr/f" }),
    ];
    const normalized = normalizeSenateDisclosures(records, MEMBERS, new Date("2026-08-22T12:00:00Z"));
    const result = calculateSenateAggregates(normalized.transactions);
    expect(result.bipartisan).toHaveLength(1);
    expect(result.bipartisan[0]).toMatchObject({
      ticker: "ACME",
      democraticBuyers: 2,
      republicanBuyers: 1,
      independentBuyers: 1,
      totalDistinctBuyers: 4,
    });
    expect(result.popularByParty.Democratic[0]).toMatchObject({ ticker: "ACME", distinctBuyers: 2 });
    expect(result.popularByParty["Independent/Other"][0].ticker).toBe("ACME");
  });
});

describe("loadSenateTrades", () => {
  it("defaults to a 90-day transaction-date window and fails closed without quota protection", async () => {
    const now = new Date("2026-08-30T12:00:00Z");
    expect(senateWindowStart("90D", now)).toBe("2026-06-01");
    const response = await loadSenateTrades({ fmpApiKey: "test", now });
    expect(response).toMatchObject({
      window: "90D",
      status: "unavailable",
      errorCode: "quota-unavailable",
      bipartisan: [],
    });
  });

  it("ingests a paginated FMP response, cross-checks the official roster, and produces deterministic rankings", async () => {
    const rosterXml = `<contact_information>
      <member><first_name>Dana</first_name><last_name>Blue</last_name><party>D</party><state>NY</state><bioguide_id>D1</bioguide_id></member>
      <member><first_name>Riley</first_name><last_name>Red</last_name><party>R</party><state>TX</state><bioguide_id>R1</bioguide_id></member>
    </contact_information>`;
    const records = [
      raw({ senateID: "D1", link: "https://efdsearch.senate.gov/search/view/ptr/a" }),
      raw({ senateID: "R1", link: "https://efdsearch.senate.gov/search/view/ptr/b" }),
    ];
    const fetcher = async (input: URL | RequestInfo) => {
      const url = String(input);
      if (url.includes("senators_cfm.xml")) return new Response(rosterXml);
      expect(url).toContain("senate-latest");
      expect(url).toContain("page=0");
      expect(url).toContain("limit=25");
      return new Response(JSON.stringify(records));
    };
    const response = await loadSenateTrades({
      fmpApiKey: "test",
      requestGate: async () => ({ allowed: true, used: 1, limit: 8 }),
      fetcher: fetcher as typeof fetch,
      now: new Date("2026-08-30T12:00:00Z"),
    });
    expect(response.status).toBe("ready");
    expect(response.quality.rawRecords).toBe(2);
    expect(response.bipartisan[0]).toMatchObject({ ticker: "ACME", democraticBuyers: 1, republicanBuyers: 1 });
    expect(response.ruleVersion).toBe("senate-purchases-v1");
  });

  it("stays on the Basic-plan first page and marks a full result as truncated", async () => {
    const rosterXml = `<contact_information>
      <member><first_name>Dana</first_name><last_name>Blue</last_name><party>D</party><state>NY</state><bioguide_id>D1</bioguide_id></member>
    </contact_information>`;
    const records = Array.from({ length: 25 }, (_, index) => raw({
      senateID: "D1",
      link: `https://efdsearch.senate.gov/search/view/ptr/${index}`,
    }));
    const requestedUrls: string[] = [];
    const fetcher = async (input: URL | RequestInfo) => {
      const url = String(input);
      if (url.includes("senators_cfm.xml")) return new Response(rosterXml);
      requestedUrls.push(url);
      return new Response(JSON.stringify(records));
    };
    const response = await loadSenateTrades({
      fmpApiKey: "test",
      requestGate: async () => ({ allowed: true, used: 1, limit: 8 }),
      fetcher: fetcher as typeof fetch,
      now: new Date("2026-08-30T12:00:00Z"),
    });
    expect(requestedUrls).toHaveLength(1);
    expect(requestedUrls[0]).toContain("page=0");
    expect(requestedUrls[0]).toContain("limit=25");
    expect(response).toMatchObject({ status: "partial", quality: { truncated: true } });
  });
});
