export type AccountSession = {
  ok: true;
  signedIn: true;
  currentUser: {
    name: string | null;
    email: string | null;
    imageUrl: string | null;
  };
} | null;

const sessionKeys = ["ok", "signedIn", "currentUser"] as const;
const currentUserKeys = ["name", "email", "imageUrl"] as const;

const isExactRecord = (
  value: unknown,
  keys: readonly string[]
): value is Record<string, unknown> => {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return false;
  }

  const actualKeys = Object.keys(value);

  return actualKeys.length === keys.length
    && keys.every((key) => Object.hasOwn(value, key));
};

const isNullableString = (value: unknown): value is string | null =>
  value === null || typeof value === "string";

export const parseAccountSession = (value: unknown): AccountSession => {
  if (value === null) {
    return null;
  }

  if (!isExactRecord(value, sessionKeys)
    || value.ok !== true
    || value.signedIn !== true
    || !isExactRecord(value.currentUser, currentUserKeys)
    || !isNullableString(value.currentUser.name)
    || !isNullableString(value.currentUser.email)
    || !isNullableString(value.currentUser.imageUrl)) {
    return null;
  }

  return {
    ok: true,
    signedIn: true,
    currentUser: {
      name: value.currentUser.name,
      email: value.currentUser.email,
      imageUrl: value.currentUser.imageUrl
    }
  };
};
