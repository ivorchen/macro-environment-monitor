#!/usr/bin/env node

import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

import { createClient } from "redis";

const REPORT_TTL_SECONDS = 8 * 24 * 60 * 60;
const FEED_TTL_SECONDS = 8 * 24 * 60 * 60;
const TRACKING_PARAMETERS = /^(utm_.+|fbclid|gclid|mc_cid|mc_eid)$/i;
const REQUIRED_REPORTS = new Map([
  ["6a84e4fc-826c-83ea-a057-082f2a1911a8", "Daily Tech & Market Brief"],
  ["6a84e64f-e168-83ea-89dd-a80503d9c92b", "US Stocks Macro Monitoring"],
]);

function fail(message) {
  throw new Error(`Invalid market-news bundle: ${message}`);
}

function requiredText(value, field) {
  if (typeof value !== "string" || !value.trim()) fail(`${field} must be non-empty text.`);
  return value.trim();
}

function isoTimestamp(value, field) {
  const text = requiredText(value, field);
  if (Number.isNaN(Date.parse(text))) fail(`${field} must be an ISO-8601 timestamp.`);
  return new Date(text).toISOString();
}

export function canonicalizeUrl(value) {
  let url;
  try {
    url = new URL(requiredText(value, "item.url"));
  } catch {
    fail("item.url must be an absolute URL.");
  }
  if (url.protocol !== "https:") fail("item.url must use HTTPS.");
  url.hash = "";
  for (const key of [...url.searchParams.keys()]) {
    if (TRACKING_PARAMETERS.test(key)) url.searchParams.delete(key);
  }
  url.hostname = url.hostname.toLowerCase();
  if (url.pathname !== "/") url.pathname = url.pathname.replace(/\/+$/, "");
  return url.toString();
}

function headlineKey(value) {
  return value.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim();
}

function stableId(url) {
  return createHash("sha256").update(url).digest("hex").slice(0, 16);
}

export function normalizeMarketNewsBundle(value) {
  if (!value || typeof value !== "object") fail("root must be an object.");
  const generatedAt = isoTimestamp(value.generatedAt, "generatedAt");
  if (!Array.isArray(value.reports) || value.reports.length !== 2) {
    fail("reports must contain exactly the two configured task reports.");
  }

  const reports = value.reports.map((report, reportIndex) => {
    if (!report || typeof report !== "object") fail(`reports[${reportIndex}] must be an object.`);
    const normalized = {
      id: requiredText(report.id, `reports[${reportIndex}].id`),
      name: requiredText(report.name, `reports[${reportIndex}].name`),
      generatedAt: isoTimestamp(report.generatedAt, `reports[${reportIndex}].generatedAt`),
      content: requiredText(report.content, `reports[${reportIndex}].content`),
    };
    if (!Array.isArray(report.items)) fail(`reports[${reportIndex}].items must be an array.`);
    return { ...normalized, items: report.items };
  });
  if (new Set(reports.map((report) => report.id)).size !== REQUIRED_REPORTS.size) {
    fail("reports must contain each configured task exactly once.");
  }
  for (const report of reports) {
    if (REQUIRED_REPORTS.get(report.id) !== report.name) {
      fail(`unexpected report identity: ${report.id}.`);
    }
  }

  const byUrl = new Map();
  const byHeadline = new Map();
  for (const report of reports) {
    for (const [itemIndex, item] of report.items.entries()) {
      if (!item || typeof item !== "object") fail(`${report.name}.items[${itemIndex}] must be an object.`);
      const url = canonicalizeUrl(item.url);
      const headline = requiredText(item.headline, "item.headline");
      const normalized = {
        id: stableId(url),
        source: requiredText(item.source, "item.source"),
        headline,
        summary: requiredText(item.summary, "item.summary"),
        publishedAt: isoTimestamp(item.publishedAt, "item.publishedAt"),
        url,
        category: requiredText(item.category, "item.category"),
        translations: Object.fromEntries(["zh-CN", "zh-TW"].map((locale) => {
          const localized = item.translations?.[locale];
          if (!localized || typeof localized !== "object") fail(`item.translations.${locale} must be an object.`);
          return [locale, {
            headline: requiredText(localized.headline, `item.translations.${locale}.headline`),
            summary: requiredText(localized.summary, `item.translations.${locale}.summary`),
            category: requiredText(localized.category, `item.translations.${locale}.category`),
          }];
        })),
        originatingReports: [{ id: report.id, name: report.name }],
      };
      const duplicate = byUrl.get(url) ?? byHeadline.get(headlineKey(headline));
      if (duplicate) {
        if (!duplicate.originatingReports.some((origin) => origin.id === report.id)) {
          duplicate.originatingReports.push({ id: report.id, name: report.name });
        }
        continue;
      }
      byUrl.set(url, normalized);
      byHeadline.set(headlineKey(headline), normalized);
    }
  }

  const items = [...byUrl.values()].sort((a, b) => b.publishedAt.localeCompare(a.publishedAt));
  return {
    generatedAt,
    reports: reports.map((report) => ({
      id: report.id,
      name: report.name,
      generatedAt: report.generatedAt,
      content: report.content,
    })),
    feed: { generatedAt, items },
  };
}

export function redisKeys(generatedAt, keyPrefix = "macro-monitor") {
  const prefix = keyPrefix.replace(/:+$/, "");
  const date = generatedAt.slice(0, 10);
  return {
    feed: `${prefix}:market-news:v1:latest`,
    reports: `${prefix}:market-news-reports:v1:${date}`,
    latestReports: `${prefix}:market-news-reports:v1:latest`,
  };
}

export async function publishMarketNews(options) {
  const source = JSON.parse(await readFile(options.bundlePath, "utf8"));
  const normalized = normalizeMarketNewsBundle(source);
  const keys = redisKeys(normalized.generatedAt, options.keyPrefix);
  if (options.dryRun) return { ...normalized, keys };
  if (!options.redisUrl) throw new Error("REDIS_URL is not configured.");

  const client = createClient({ url: options.redisUrl });
  client.on("error", () => {});
  await client.connect();
  try {
    const multi = client.multi();
    multi.set(keys.feed, JSON.stringify(normalized.feed), { EX: FEED_TTL_SECONDS });
    multi.set(keys.reports, JSON.stringify({ generatedAt: normalized.generatedAt, reports: normalized.reports }), { EX: REPORT_TTL_SECONDS });
    multi.set(keys.latestReports, JSON.stringify({ generatedAt: normalized.generatedAt, reports: normalized.reports }), { EX: REPORT_TTL_SECONDS });
    await multi.exec();
  } finally {
    await client.quit();
  }
  return { ...normalized, keys };
}

async function main() {
  const args = process.argv.slice(2);
  if (args[0] === "--") args.shift();
  const dryRunIndex = args.indexOf("--dry-run");
  const dryRun = dryRunIndex !== -1;
  if (dryRun) args.splice(dryRunIndex, 1);
  if (args.length !== 1) throw new Error("Usage: pnpm news:publish -- <bundle.json> [--dry-run]");
  const result = await publishMarketNews({
    bundlePath: resolve(args[0]), redisUrl: process.env.REDIS_URL,
    keyPrefix: process.env.REDIS_KEY_PREFIX ?? "macro-monitor", dryRun,
  });
  console.log(`${dryRun ? "Validated" : "Published"} ${result.feed.items.length} unique market-news items from ${result.reports.length} reports.`);
  console.log(`Redis key: ${result.keys.feed}`);
}

const isMain = process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href;
if (isMain) main().catch((error) => { console.error(error instanceof Error ? error.message : error); process.exitCode = 1; });
