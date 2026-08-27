import type { PublicGameLibraryEntry } from "@maiks-yt/domain/games";

const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL ?? "https://api.maiks.yt";

type PublicGamesResponse =
  | {
    ok: true;
    games: readonly PublicGameLibraryEntry[];
  }
  | {
    ok: false;
    reason: string;
  };

export type PublicGamesLoadResult =
  | {
    status: "loaded";
    games: readonly PublicGameLibraryEntry[];
  }
  | {
    status: "error";
    games: readonly [];
  };

export const formatGameStatus = (value: string): string =>
  value
    .split("-")
    .map((part) => part.slice(0, 1).toUpperCase() + part.slice(1))
    .join(" ");

export const getPublicGames = async (): Promise<PublicGamesLoadResult> => {
  try {
    const response = await fetch(`${apiBaseUrl}/games`, {
      cache: "no-store"
    });

    if (!response.ok) {
      return { status: "error", games: [] };
    }

    const payload = await response.json() as PublicGamesResponse;

    return payload.ok
      ? { status: "loaded", games: payload.games }
      : { status: "error", games: [] };
  } catch {
    return { status: "error", games: [] };
  }
};
