import { describe, expect, it } from "vitest";
import { regimeFromScore, totalScore, type Score } from "./macro";

describe("macro regime scoring", () => {
  it("totals pillar scores", () => {
    const scores: { score: Score }[] = [{ score: 2 }, { score: 1 }, { score: -1 }, { score: 0 }];
    expect(totalScore(scores)).toBe(2);
  });

  it("maps score thresholds to clear regimes", () => {
    expect(regimeFromScore(9).label).toBe("Strongly supportive");
    expect(regimeFromScore(3).label).toBe("Moderately supportive");
    expect(regimeFromScore(0).label).toBe("Neutral / mixed");
    expect(regimeFromScore(-3).label).toBe("Hostile");
    expect(regimeFromScore(-9).label).toBe("Strongly hostile");
  });
});
