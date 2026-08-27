import {
  controlPanelPageKeys,
  type ControlPanelPageKey
} from "@maiks-yt/domain/security";

import { apiFetch } from "../dev-auth-token.js";

type ControlNavigationResponse = {
  readonly ok: true;
  readonly pages: readonly unknown[];
} | {
  readonly ok: false;
  readonly reason: string;
};

const controlPanelPageKeySet = new Set<unknown>(controlPanelPageKeys);

const coreControlPanelPages = [
  "overview",
  "stream",
  "overlays"
] as const satisfies readonly ControlPanelPageKey[];

export const loadControlPanelNavigation = async (
  apiBaseUrl: string
): Promise<readonly ControlPanelPageKey[]> => {
  const accessToken = window.localStorage.getItem("maiks.yt.control.accessToken");

  if (!accessToken) {
    throw new Error("control_navigation_access_token_missing");
  }

  const url = new URL("/control/navigation", apiBaseUrl);
  url.searchParams.set("accessToken", accessToken);
  const response = await apiFetch(url, { cache: "no-store" });
  const result = await response.json() as ControlNavigationResponse;

  if (!response.ok || !result.ok) {
    throw new Error("control_navigation_unavailable");
  }

  const pages = result.pages.filter(
    (page): page is ControlPanelPageKey => controlPanelPageKeySet.has(page)
  );

  if (!coreControlPanelPages.every((page) => pages.includes(page))) {
    throw new Error("control_navigation_invalid");
  }

  return pages;
};
