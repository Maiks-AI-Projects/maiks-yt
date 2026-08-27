import {
  controlPanelActionViewCapability,
  controlPanelMusicControlCapability,
  controlPanelProviderHealthCapability,
  type ControlPanelPageKey
} from "./control-panel-navigation.types.js";

const coreControlPanelPages = ["overview", "stream", "overlays"] as const satisfies readonly ControlPanelPageKey[];

export const projectControlPanelPages = (
  permissions: readonly unknown[]
): readonly ControlPanelPageKey[] => {
  const permissionSet = new Set(
    permissions.filter((permission): permission is string => typeof permission === "string")
  );
  const hasWildcard = permissionSet.has("*");
  const pages: ControlPanelPageKey[] = [...coreControlPanelPages];

  if (hasWildcard || permissionSet.has(controlPanelActionViewCapability)) {
    pages.push("actions");
  }

  if (hasWildcard || permissionSet.has(controlPanelMusicControlCapability)) {
    pages.push("music");
  }

  if (hasWildcard || permissionSet.has(controlPanelProviderHealthCapability)) {
    pages.push("providers");
  }

  return pages;
};

export const resolveControlPanelPage = (
  requestedPage: ControlPanelPageKey,
  availablePages: readonly ControlPanelPageKey[]
): ControlPanelPageKey => availablePages.includes(requestedPage)
  ? requestedPage
  : "overview";
