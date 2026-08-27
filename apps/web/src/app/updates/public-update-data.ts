import type {
  PublicUpdateDetail,
  PublicUpdateKind,
  PublicUpdateSummary
} from "@maiks-yt/domain/updates";

const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL ?? "https://api.maiks.yt";

type PublicUpdateListApiResponse =
  | { ok: true; updates: readonly PublicUpdateSummary[] }
  | { ok: false; reason: string };

type PublicUpdateDetailApiResponse =
  | { ok: true; update: PublicUpdateDetail }
  | { ok: false; reason: string };

export type PublicUpdateListLoadResult =
  | { status: "loaded"; updates: readonly PublicUpdateSummary[] }
  | { status: "error" };

export type PublicUpdateDetailLoadResult =
  | { status: "loaded"; update: PublicUpdateDetail }
  | { status: "not-found" }
  | { status: "error" };

export const formatPublicUpdateKind = (kind: PublicUpdateKind): string => {
  if (kind === "stream-recap") {
    return "Stream recap";
  }

  return kind.charAt(0).toUpperCase() + kind.slice(1);
};

export const getPublicUpdateUrl = (update: Pick<PublicUpdateSummary, "slug">): string =>
  `/updates/${update.slug}`;

export const getPublicUpdates = async (): Promise<PublicUpdateListLoadResult> => {
  try {
    const response = await fetch(`${apiBaseUrl}/updates`, { cache: "no-store" });

    if (!response.ok) {
      return { status: "error" };
    }

    const payload = await response.json() as PublicUpdateListApiResponse;
    return payload.ok
      ? { status: "loaded", updates: payload.updates }
      : { status: "error" };
  } catch {
    return { status: "error" };
  }
};

export const getPublicUpdate = async (slug: string): Promise<PublicUpdateDetailLoadResult> => {
  try {
    const response = await fetch(
      `${apiBaseUrl}/updates/${encodeURIComponent(slug)}`,
      { cache: "no-store" }
    );

    if (response.status === 404) {
      return { status: "not-found" };
    }

    if (!response.ok) {
      return { status: "error" };
    }

    const payload = await response.json() as PublicUpdateDetailApiResponse;

    if (!payload.ok) {
      return payload.reason === "update_not_found"
        ? { status: "not-found" }
        : { status: "error" };
    }

    return { status: "loaded", update: payload.update };
  } catch {
    return { status: "error" };
  }
};
