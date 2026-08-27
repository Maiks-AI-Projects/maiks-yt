import { projectControlPanelPages, type ControlPanelPageKey } from "@maiks-yt/domain/security";

const parsePermissionArray = (value: unknown): readonly unknown[] => {
  if (Array.isArray(value)) {
    return value;
  }

  if (typeof value !== "string") {
    return [];
  }

  try {
    const parsed = JSON.parse(value) as unknown;
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

export const normalizeControlPanelPermissions = (
  rolePermissionValues: readonly unknown[]
): readonly string[] => {
  const permissions = new Set<string>();

  for (const rolePermissionValue of rolePermissionValues) {
    for (const permission of parsePermissionArray(rolePermissionValue)) {
      if (typeof permission === "string") {
        permissions.add(permission);
      }
    }
  }

  return [...permissions];
};

export const createControlPanelNavigation = (
  rolePermissionValues: readonly unknown[]
): readonly ControlPanelPageKey[] => projectControlPanelPages(
  normalizeControlPanelPermissions(rolePermissionValues)
);
