import { describe, expect, it } from "vitest";

import { X_FEED_CAPTURED_AT, X_WHATS_NEW } from "./x-whats-new";

describe("X what's-new snapshot", () => {
  it("contains a compact, uniquely linked feed snapshot", () => {
    expect(X_WHATS_NEW.length).toBeGreaterThanOrEqual(3);
    expect(X_WHATS_NEW.length).toBeLessThanOrEqual(6);
    expect(new Set(X_WHATS_NEW.map((item) => item.id)).size).toBe(X_WHATS_NEW.length);
    expect(new Set(X_WHATS_NEW.map((item) => item.url)).size).toBe(X_WHATS_NEW.length);
  });

  it("only links to attributed X posts captured after publication", () => {
    const capturedAt = Date.parse(X_FEED_CAPTURED_AT);
    expect(Number.isFinite(capturedAt)).toBe(true);

    for (const item of X_WHATS_NEW) {
      expect(item.url).toMatch(/^https:\/\/x\.com\/[A-Za-z0-9_]+\/status\/\d+$/);
      expect(item.handle).toMatch(/^@[A-Za-z0-9_]+$/);
      expect(Date.parse(item.postedAt)).toBeLessThanOrEqual(capturedAt);
      expect(item.summary.length).toBeGreaterThan(40);
    }
  });

  it("covers both requested subjects", () => {
    expect(X_WHATS_NEW.some((item) => item.topic.includes("stocks"))).toBe(true);
    expect(X_WHATS_NEW.some((item) => item.topic.includes("AI"))).toBe(true);
  });
});
