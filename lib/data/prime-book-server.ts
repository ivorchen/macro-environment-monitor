import "server-only";

import { readFile } from "node:fs/promises";
import path from "node:path";

import { fetchOfrFormPfObservations } from "./adapters/ofr-form-pf";
import { loadCachedProvider, type IndicatorDataCache } from "./cache";
import { buildPrimeBookResponse, type PrimeBookRange, type PrimeBookRawObservation } from "./prime-book";

export async function loadPrimeBook(options: {
  range?: PrimeBookRange;
  provider?: string;
  now?: Date;
  dataPath?: string;
  cache?: IndicatorDataCache;
  fetcher?: typeof fetch;
} = {}) {
  const dataPath = options.dataPath
    ?? process.env.PRIME_BOOK_DATA_PATH
    ?? path.join(process.cwd(), "data", "prime-book-observations.json");
  let manualPayload: Record<string, unknown> = {};
  try {
    manualPayload = JSON.parse(await readFile(dataPath, "utf8")) as Record<string, unknown>;
  } catch {
    // The response keeps an absent or malformed manual source explicit.
  }

  let ofrObservations: PrimeBookRawObservation[] = [];
  let ofrError: string | null = null;
  try {
    const result = await loadCachedProvider({
      cache: options.cache,
      cacheKey: "positioning:ofr-form-pf:v1",
      ttlSeconds: 24 * 60 * 60,
      loader: () => fetchOfrFormPfObservations({ fetcher: options.fetcher, now: options.now }),
      shouldCache: (observations) => observations.length > 0,
    });
    ofrObservations = result.value;
  } catch (error) {
    ofrError = error instanceof Error ? error.message : "OFR Form PF request failed.";
  }

  const manualObservations = Array.isArray(manualPayload.observations) ? manualPayload.observations : [];
  const response = buildPrimeBookResponse({
    ...options,
    payload: {
      ...manualPayload,
      observations: [...manualObservations, ...ofrObservations],
    },
  });
  if (response.freshness === "unavailable" && ofrError) {
    return { ...response, errorCode: "source-failed" as const, errorMessage: ofrError };
  }
  return response;
}
