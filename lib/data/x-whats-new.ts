export type XFeedTopic = "US stocks" | "AI" | "Stocks + AI";

export type XFeedItem = {
  id: string;
  author: string;
  handle: `@${string}`;
  topic: XFeedTopic;
  summary: string;
  postedAt: string;
  url: `https://x.com/${string}`;
};

export const X_FEED_CAPTURED_AT = "2026-09-01T21:15:00.000Z";

// Browser-assisted snapshot from public posts visible to the signed-in account.
// Post claims are preserved as attributed feed observations, not verified facts.
export const X_WHATS_NEW: XFeedItem[] = [
  {
    id: "dell-ai-server-earnings",
    author: "Shay Boloor",
    handle: "@StockSavvyShay",
    topic: "Stocks + AI",
    summary: "Dell earnings chatter highlighted reported revenue and EPS above estimates, with AI-server revenue cited as a major contributor.",
    postedAt: "2026-09-01T20:12:24.000Z",
    url: "https://x.com/StockSavvyShay/status/2094881077823451158",
  },
  {
    id: "avgo-earnings-sentiment",
    author: "勃勃OC",
    handle: "@bboczeng",
    topic: "US stocks",
    summary: "The post expressed concern that Broadcom earnings could face a sell-the-news reaction against weak market sentiment.",
    postedAt: "2026-09-01T19:03:37.000Z",
    url: "https://x.com/bboczeng/status/2094863766081171478",
  },
  {
    id: "ai-stock-leadership-list",
    author: "Evan",
    handle: "@StockMKTNewz",
    topic: "Stocks + AI",
    summary: "A third-party AI-stock ranking included semiconductor and infrastructure names such as TSM, NVDA, MRVL, TER, and NBIS.",
    postedAt: "2026-09-01T18:47:21.000Z",
    url: "https://x.com/StockMKTNewz/status/2094859675472658820",
  },
  {
    id: "zscaler-ai-expansion-thesis",
    author: "Shay Boloor",
    handle: "@StockSavvyShay",
    topic: "Stocks + AI",
    summary: "The Zscaler thesis argued that AI could expand Zero Trust demand from users and devices into data, workloads, and autonomous systems.",
    postedAt: "2026-09-01T14:33:35.000Z",
    url: "https://x.com/StockSavvyShay/status/2094795811985281311",
  },
  {
    id: "grafana-knowledge-graph-context",
    author: "Grafana",
    handle: "@grafana",
    topic: "AI",
    summary: "Grafana shared an incident-replay example where knowledge-graph context materially improved an LLM's root-cause analysis accuracy.",
    postedAt: "2026-09-01T20:51:01.000Z",
    url: "https://x.com/grafana/status/2094890794603643021",
  },
];
