const parsePermissionArray = (value: unknown): unknown[] => {
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

export const canUseBackupAdmin = (rolePermissionValues: readonly unknown[]): boolean =>
  rolePermissionValues.some((rolePermissionValue) =>
    parsePermissionArray(rolePermissionValue).includes("*")
  );
