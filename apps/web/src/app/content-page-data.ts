import type { PublicContentPage } from "@maiks-yt/domain/pages";

const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL ?? "https://api-dev.maiks.yt";

type PublicContentPageApiResponse =
  | {
    ok: true;
    page: PublicContentPage;
  }
  | {
    ok: false;
    reason: string;
  };

export type PublicContentPageLoadResult =
  | {
    status: "loaded";
    page: PublicContentPage;
  }
  | {
    status: "not-found";
  }
  | {
    status: "error";
  };

export const getPublicContentPage = async (path: string): Promise<PublicContentPageLoadResult> => {
  try {
    const response = await fetch(`${apiBaseUrl}/pages/public?path=${encodeURIComponent(path)}`, {
      cache: "no-store"
    });

    if (response.status === 404) {
      return {
        status: "not-found"
      };
    }

    if (!response.ok) {
      return {
        status: "error"
      };
    }

    const payload = await response.json() as PublicContentPageApiResponse;

    if (!payload.ok) {
      return payload.reason === "content_page_not_found" || payload.reason === "content_page_ambiguous"
        ? { status: "not-found" }
        : { status: "error" };
    }

    return {
      status: "loaded",
      page: payload.page
    };
  } catch {
    return {
      status: "error"
    };
  }
};
