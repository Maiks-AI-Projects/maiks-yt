import { createSteamGameLibraryPreviewFailure } from "./steam-game-library.rules.js";
import type {
  SteamWishlistItemPreview,
  SteamWishlistPreviewResult
} from "./steam-wishlist.types.js";

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const isSafeNonNegativeInteger = (value: unknown): value is number =>
  typeof value === "number"
  && Number.isSafeInteger(value)
  && value >= 0;

const toIsoDate = (value: unknown): string | null => {
  if (!isSafeNonNegativeInteger(value)) {
    return null;
  }

  const date = new Date(value * 1_000);

  return Number.isNaN(date.getTime()) ? null : date.toISOString();
};

export const normalizeSteamStoreTitle = (value: unknown): string | null => {
  if (typeof value !== "string") {
    return null;
  }

  const normalized = value
    .trim()
    .replace(/[\u0000-\u001f\u007f]/g, " ")
    .replace(/\s+/g, " ");

  return normalized.length > 0 && normalized.length <= 300 ? normalized : null;
};

export const projectSteamWishlistResponse = (
  payload: unknown
): SteamWishlistPreviewResult => {
  if (!isRecord(payload) || !isRecord(payload.response) || !Array.isArray(payload.response.items)) {
    return createSteamGameLibraryPreviewFailure("malformed_response");
  }

  const items: SteamWishlistItemPreview[] = [];
  const appIds = new Set<number>();

  for (const rawItem of payload.response.items) {
    if (!isRecord(rawItem)) {
      return createSteamGameLibraryPreviewFailure("malformed_response");
    }

    const appId = rawItem.appid;
    const dateAddedAt = toIsoDate(rawItem.date_added);

    if (
      !isSafeNonNegativeInteger(appId)
      || appId === 0
      || !isSafeNonNegativeInteger(rawItem.priority)
      || !dateAddedAt
      || appIds.has(appId)
    ) {
      return createSteamGameLibraryPreviewFailure("malformed_response");
    }

    appIds.add(appId);
    items.push({
      appId,
      title: null,
      priority: rawItem.priority,
      dateAddedAt,
      storeUrl: `https://store.steampowered.com/app/${appId}/`
    });
  }

  return {
    ok: true,
    provider: "steam",
    state: "ready",
    readOnly: true,
    itemCount: items.length,
    items: items.sort((left, right) => left.priority - right.priority || left.appId - right.appId)
  };
};

export const projectSteamStoreAppTitle = (
  appId: number,
  payload: unknown
): string | null => {
  if (!isRecord(payload)) {
    return null;
  }

  const app = payload[String(appId)];

  if (!isRecord(app) || app.success !== true || !isRecord(app.data)) {
    return null;
  }

  return normalizeSteamStoreTitle(app.data.name);
};
