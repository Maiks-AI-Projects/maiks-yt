import type { SteamPopularityResult } from "./steam-popularity.types.js";

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

export const isValidSteamAppId = (value: unknown): value is number =>
  typeof value === "number"
  && Number.isSafeInteger(value)
  && value > 0;

export const projectSteamPopularityResponse = (
  appId: number,
  payload: unknown
): SteamPopularityResult => {
  if (!isValidSteamAppId(appId)) {
    return { ok: false, appId, state: "invalid_app_id" };
  }

  if (!isRecord(payload) || !isRecord(payload.response)) {
    return { ok: false, appId, state: "malformed_response" };
  }

  const playerCount = payload.response.player_count;
  const result = payload.response.result;

  return result === 1
    && typeof playerCount === "number"
    && Number.isSafeInteger(playerCount)
    && playerCount >= 0
    ? { ok: true, appId, playerCount }
    : { ok: false, appId, state: "malformed_response" };
};
