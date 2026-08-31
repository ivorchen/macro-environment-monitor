import "server-only";

import { createRedisDailyRequestGate, createRedisIndicatorCache } from "./redis-cache";
import { loadSenateTrades, type SenateWindow } from "./senate-trades";

export function loadConfiguredSenateTrades(window: SenateWindow) {
  return loadSenateTrades({
    window,
    fmpApiKey: process.env.FMP_API_KEY,
    requestGate: createRedisDailyRequestGate("fmp-senate", 8),
    cache: createRedisIndicatorCache(),
  });
}
