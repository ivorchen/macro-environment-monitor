#!/usr/bin/env node

import { readFile } from "node:fs/promises";
import { basename, resolve } from "node:path";
import { pathToFileURL } from "node:url";

import { createClient } from "redis";

const DAILY_TTL_SECONDS = 48 * 60 * 60;
const LATEST_TTL_SECONDS = 8 * 24 * 60 * 60;
const SECTION_NAMES = ["Brief", "Overview", "Key signals", "Risks", "What to watch next"];
const TRANSLATIONS_HEADING = "## Translations";

function fail(message) {
  throw new Error(`Invalid market-insight Markdown: ${message}`);
}

function parseFrontmatter(source) {
  const match = source.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n/);
  if (!match) fail("missing YAML frontmatter.");

  const metadata = {};
  for (const line of match[1].split(/\r?\n/)) {
    if (!line.trim()) continue;
    const separator = line.indexOf(":");
    if (separator <= 0) fail(`invalid frontmatter line: ${line}`);
    metadata[line.slice(0, separator).trim()] = line.slice(separator + 1).trim();
  }
  return { metadata, body: source.slice(match[0].length) };
}

function requiredMetadata(metadata, key) {
  const value = metadata[key];
  if (!value) fail(`missing ${key} frontmatter.`);
  return value;
}

function paragraph(lines, section) {
  const value = lines.join(" ").replace(/\s+/g, " ").trim();
  if (!value) fail(`${section} must not be empty.`);
  return value;
}

function bulletList(lines, section, minimum, maximum) {
  const content = lines.filter((line) => line.trim());
  if (content.some((line) => !line.startsWith("- "))) {
    fail(`${section} must contain only Markdown bullets beginning with "- ".`);
  }
  const items = content.map((line) => line.slice(2).trim()).filter(Boolean);
  if (items.length < minimum || items.length > maximum) {
    fail(`${section} must contain ${minimum}-${maximum} bullets.`);
  }
  return items;
}

function validateTranslatedContent(value, locale) {
  if (!value || typeof value !== "object") fail(`missing ${locale} translation.`);
  const detailed = value.detailed;
  if (!detailed || typeof detailed !== "object") fail(`missing ${locale} detailed translation.`);
  const text = (item, field) => {
    if (typeof item !== "string" || !item.trim()) fail(`${locale}.${field} must not be empty.`);
    return item.trim();
  };
  const list = (items, field, minimum, maximum) => {
    if (!Array.isArray(items) || items.length < minimum || items.length > maximum) {
      fail(`${locale}.${field} must contain ${minimum}-${maximum} items.`);
    }
    return items.map((item, index) => text(item, `${field}[${index}]`));
  };
  return {
    brief: text(value.brief, "brief"),
    detailed: {
      headline: text(detailed.headline, "detailed.headline"),
      overview: text(detailed.overview, "detailed.overview"),
      keySignals: list(detailed.keySignals, "detailed.keySignals", 3, 5),
      risks: list(detailed.risks, "detailed.risks", 2, 4),
      watchNext: list(detailed.watchNext, "detailed.watchNext", 2, 4),
    },
  };
}

export function parseMarketInsightMarkdown(source) {
  const { metadata, body } = parseFrontmatter(source);
  const reportDate = requiredMetadata(metadata, "reportDate");
  const generatedAt = requiredMetadata(metadata, "generatedAt");
  const model = requiredMetadata(metadata, "model");

  if (!/^\d{4}-\d{2}-\d{2}$/.test(reportDate)) {
    fail("reportDate must use YYYY-MM-DD.");
  }
  if (Number.isNaN(Date.parse(generatedAt))) {
    fail("generatedAt must be an ISO-8601 timestamp.");
  }

  const lines = body.split(/\r?\n/);
  const headlineIndex = lines.findIndex((line) => line.startsWith("# "));
  if (headlineIndex === -1) fail("missing the level-one headline.");
  const headline = lines[headlineIndex].slice(2).trim();
  if (!headline) fail("headline must not be empty.");

  const sectionIndexes = SECTION_NAMES.map((name) => lines.indexOf(`## ${name}`));
  if (sectionIndexes.some((index) => index === -1)) {
    fail(`required sections are: ${SECTION_NAMES.join(", ")}.`);
  }
  if (sectionIndexes.some((index, position) => position > 0 && index <= sectionIndexes[position - 1])) {
    fail("required sections are out of order.");
  }

  const sectionLines = (position) => {
    const start = sectionIndexes[position] + 1;
    const translationsIndex = lines.indexOf(TRANSLATIONS_HEADING);
    const end = sectionIndexes[position + 1] ?? (translationsIndex === -1 ? lines.length : translationsIndex);
    return lines.slice(start, end);
  };

  const translationsIndex = lines.indexOf(TRANSLATIONS_HEADING);
  if (translationsIndex === -1) fail("missing Translations section.");
  const translationSource = lines.slice(translationsIndex + 1).join("\n").match(/```json\s*([\s\S]*?)\s*```/);
  if (!translationSource) fail("Translations must contain a JSON code block.");
  let translationValue;
  try {
    translationValue = JSON.parse(translationSource[1]);
  } catch {
    fail("Translations JSON is invalid.");
  }
  const translations = Object.fromEntries(["zh-CN", "zh-TW"].map((locale) => [
    locale,
    validateTranslatedContent(translationValue?.[locale], locale),
  ]));

  return {
    reportDate,
    generatedAt: new Date(generatedAt).toISOString(),
    model,
    translations,
    brief: paragraph(sectionLines(0), "Brief"),
    detailed: {
      headline,
      overview: paragraph(sectionLines(1), "Overview"),
      keySignals: bulletList(sectionLines(2), "Key signals", 3, 5),
      risks: bulletList(sectionLines(3), "Risks", 2, 4),
      watchNext: bulletList(sectionLines(4), "What to watch next", 2, 4),
    },
  };
}

export function redisKeys(reportDate, keyPrefix = "macro-monitor") {
  const prefix = keyPrefix.replace(/:+$/, "");
  return {
    daily: `${prefix}:ai-market-insight:v1:${reportDate}`,
    latest: `${prefix}:ai-market-insight:v1:latest`,
  };
}

function reportDateInNewYork(now = new Date()) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

export async function publishMarketInsight(options) {
  const source = await readFile(options.reportPath, "utf8");
  const report = parseMarketInsightMarkdown(source);
  const datedFilename = basename(options.reportPath).match(/^(\d{4}-\d{2}-\d{2})\.md$/);
  if (datedFilename && datedFilename[1] !== report.reportDate) {
    fail(`filename date ${datedFilename[1]} does not match reportDate ${report.reportDate}.`);
  }

  if (options.dryRun) return { report, keys: redisKeys(report.reportDate, options.keyPrefix) };
  if (!options.redisUrl) throw new Error("REDIS_URL is not configured.");

  const keys = redisKeys(report.reportDate, options.keyPrefix);
  const client = createClient({ url: options.redisUrl });
  client.on("error", () => {});
  await client.connect();
  try {
    const value = JSON.stringify(report);
    await Promise.all([
      client.set(keys.daily, value, { EX: DAILY_TTL_SECONDS }),
      client.set(keys.latest, value, { EX: LATEST_TTL_SECONDS }),
    ]);
  } finally {
    await client.quit();
  }
  return { report, keys };
}

async function main() {
  const args = process.argv.slice(2);
  if (args[0] === "--") args.shift();
  const dryRunIndex = args.indexOf("--dry-run");
  const dryRun = dryRunIndex !== -1;
  if (dryRun) args.splice(dryRunIndex, 1);
  if (args.length > 1) {
    throw new Error("Usage: pnpm insight:publish -- [report.md] [--dry-run]");
  }

  const reportPath = resolve(
    args[0] ?? `reports/market-insights/${reportDateInNewYork()}.md`,
  );
  const result = await publishMarketInsight({
    reportPath,
    redisUrl: process.env.REDIS_URL,
    keyPrefix: process.env.REDIS_KEY_PREFIX ?? "macro-monitor",
    dryRun,
  });
  const action = dryRun ? "Validated" : "Published";
  console.log(`${action} ${result.report.reportDate} market insight from ${reportPath}.`);
  console.log(`Redis key: ${result.keys.daily}`);
}

const isMain = process.argv[1]
  && import.meta.url === pathToFileURL(resolve(process.argv[1])).href;
if (isMain) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}
