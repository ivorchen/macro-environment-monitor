import { describe, expect, it } from "vitest";

import { MESSAGES, normalizeLocale, translate } from "./i18n";

describe("localization", () => {
  it.each([
    ["zh-CN", "zh-CN"],
    ["zh-Hans", "zh-CN"],
    ["zh-SG", "zh-CN"],
    ["zh-TW", "zh-TW"],
    ["zh-Hant", "zh-TW"],
    ["zh-HK", "zh-TW"],
    ["en-CA", "en"],
    ["fr-CA", "en"],
    [null, "en"],
  ] as const)("normalizes %s to %s", (input, expected) => {
    expect(normalizeLocale(input)).toBe(expected);
  });

  it("keeps the same message contract for every locale", () => {
    const englishKeys = Object.keys(MESSAGES.en).sort();
    expect(Object.keys(MESSAGES["zh-CN"]).sort()).toEqual(englishKeys);
    expect(Object.keys(MESSAGES["zh-TW"]).sort()).toEqual(englishKeys);
  });

  it("interpolates localized values", () => {
    expect(translate("en", "common.updated", { value: "Aug 31" })).toBe("Updated Aug 31");
    expect(translate("zh-CN", "senate.daysValue", { count: 12 })).toBe("12 天");
    expect(translate("zh-TW", "source.redis", { hits: 4, misses: 2 })).toBe("Redis 快取：4 個來源命中，2 個已重新整理。");
  });
});
