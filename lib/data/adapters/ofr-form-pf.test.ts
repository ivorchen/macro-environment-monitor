import { describe, expect, it } from "vitest";

import { fetchOfrFormPfObservations, normalizeOfrFormPfPayload } from "./ofr-form-pf";

function series(mnemonic: string, points: unknown) {
  return {
    metadata: { mnemonic, schedule: { last_update: "2026-06-04 12:52:35" } },
    timeseries: { aggregation: points },
  };
}

const payload = [
  series("FPF-ALLQHF_NAV_SUM", [["2026-03-31", 4_918], ["2025-12-31", 4_800]]),
  series("FPF-ASSETCLASS_EQUITIES_LGNE_SUM", [["2026-03-31", 5_090], ["2025-12-31", 4_900]]),
  series("FPF-ASSETCLASS_EQUITIES_SGNE_SUM", [["2026-03-31", 3_192], ["2025-12-31", 3_000]]),
];

describe("normalizeOfrFormPfPayload", () => {
  it("joins complete quarterly series and derives aggregate equity positioning ratios", () => {
    const observations = normalizeOfrFormPfPayload(payload, new Date("2026-09-10T12:00:00Z"));
    expect(observations).toHaveLength(2);
    expect(observations.at(-1)).toMatchObject({
      date: "2026-03-31",
      gross_leverage: (5_090 + 3_192) / 4_918,
      net_leverage: (5_090 - 3_192) / 4_918,
      long_short_ratio: 5_090 / 3_192,
      source_kind: "public-form-pf",
      frequency: "quarterly",
    });
  });

  it("does not fabricate a quarter when one required series is missing", () => {
    const incomplete = payload.map((item) => item.metadata.mnemonic.includes("SGNE")
      ? series(item.metadata.mnemonic, [])
      : item);
    expect(normalizeOfrFormPfPayload(incomplete)).toEqual([]);
  });

  it("accepts OFR's content-negotiated object response as well as its array response", () => {
    const objectPayload = Object.fromEntries(payload.map((item) => [item.metadata.mnemonic, {
      timeseries: item.timeseries,
      metadata: { schedule: item.metadata.schedule },
    }]));
    expect(normalizeOfrFormPfPayload(objectPayload)).toHaveLength(2);
  });
});

describe("fetchOfrFormPfObservations", () => {
  it("requests the three official series in one call", async () => {
    const fetcher = async (input: URL | RequestInfo) => {
      const url = new URL(String(input));
      expect(url.hostname).toBe("data.financialresearch.gov");
      expect(url.searchParams.get("mnemonics")?.split(",")).toHaveLength(3);
      expect(String(input)).toContain("_SUM,FPF-");
      expect(String(input)).not.toContain("%2C");
      return new Response(JSON.stringify(payload));
    };
    await expect(fetchOfrFormPfObservations({ fetcher: fetcher as typeof fetch })).resolves.toHaveLength(2);
  });
});
