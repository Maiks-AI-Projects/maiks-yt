import type { PublicCreatorLink } from "@maiks-yt/domain";

const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL ?? "https://api.maiks.yt";

type CreatorLinkListApiResponse =
  | { ok: true; links: readonly PublicCreatorLink[] }
  | { ok: false; reason: string };

export type CreatorLinksLoadResult =
  | { status: "loaded"; links: readonly PublicCreatorLink[] }
  | { status: "error"; links: readonly [] };

export const getCreatorLinks = async (): Promise<CreatorLinksLoadResult> => {
  try {
    const response = await fetch(`${apiBaseUrl}/links`, { cache: "no-store" });

    if (!response.ok) {
      return { status: "error", links: [] };
    }

    const payload = await response.json() as CreatorLinkListApiResponse;

    return payload.ok
      ? { status: "loaded", links: payload.links }
      : { status: "error", links: [] };
  } catch {
    return { status: "error", links: [] };
  }
};
