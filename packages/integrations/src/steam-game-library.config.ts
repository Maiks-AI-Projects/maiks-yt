import type { SteamGameLibraryEnvironment } from "./steam-game-library.types.js";

export type SteamGameLibraryConfig =
  | {
    ok: true;
    apiKey: string;
    ownerId: string;
  }
  | {
    ok: false;
    state: "missing" | "invalid";
  };

const steamApiKeyPattern = /^[a-f0-9]{32}$/i;
const steamOwnerIdPattern = /^7656119\d{10}$/;

export const getSteamGameLibraryConfig = (
  env: SteamGameLibraryEnvironment
): SteamGameLibraryConfig => {
  const apiKey = env.STEAM_WEB_API_KEY?.trim() ?? "";
  const ownerId = env.STEAM_OWNER_ID?.trim() ?? "";

  if (!apiKey || !ownerId) {
    return {
      ok: false,
      state: "missing"
    };
  }

  if (!steamApiKeyPattern.test(apiKey) || !steamOwnerIdPattern.test(ownerId)) {
    return {
      ok: false,
      state: "invalid"
    };
  }

  return {
    ok: true,
    apiKey,
    ownerId
  };
};

