import { createHmac, timingSafeEqual } from "node:crypto";

import type { ProviderProfileAccount } from "./provider-profile-options.service.js";

const profileOptionRefPrefix = "profile-option:v1:";
const developmentBetterAuthSecret = "development-only-better-auth-secret-change-before-production";

type AccountProfileOptionRefEnvironment = Record<string, string | undefined>;

export const getProviderProfileOptionRefSecret = (
  environment: AccountProfileOptionRefEnvironment = process.env
): string | null => {
  const configuredSecret = environment.BETTER_AUTH_SECRET?.trim();

  if (configuredSecret) {
    return `maiks-yt:account-provider-profile-option:v1:${configuredSecret}`;
  }

  return environment.NODE_ENV === "production"
    ? null
    : `maiks-yt:account-provider-profile-option:v1:${developmentBetterAuthSecret}`;
};

const updateDelimited = (hmac: ReturnType<typeof createHmac>, value: string): void => {
  hmac.update(String(Buffer.byteLength(value, "utf8")), "utf8");
  hmac.update(":", "utf8");
  hmac.update(value, "utf8");
  hmac.update("|", "utf8");
};

export const createProviderProfileOptionRef = ({
  account,
  authUserId,
  secret
}: {
  account: ProviderProfileAccount;
  authUserId: string;
  secret: string;
}): string => {
  const hmac = createHmac("sha256", secret);

  updateDelimited(hmac, authUserId);
  updateDelimited(hmac, account.id);
  updateDelimited(hmac, account.providerId);
  updateDelimited(hmac, account.accountId);

  return `${profileOptionRefPrefix}${hmac.digest("base64url")}`;
};

const timingSafeStringEqual = (left: string, right: string): boolean => {
  const leftBuffer = Buffer.from(left, "utf8");
  const rightBuffer = Buffer.from(right, "utf8");

  return leftBuffer.length === rightBuffer.length && timingSafeEqual(leftBuffer, rightBuffer);
};

export const resolveProviderProfileOptionRef = ({
  accounts,
  authUserId,
  profileOptionRef,
  secret
}: {
  accounts: readonly ProviderProfileAccount[];
  authUserId: string;
  profileOptionRef: string;
  secret: string;
}): ProviderProfileAccount | null => {
  let resolvedAccount: ProviderProfileAccount | null = null;

  for (const account of accounts) {
    const expectedRef = createProviderProfileOptionRef({ account, authUserId, secret });

    if (timingSafeStringEqual(profileOptionRef, expectedRef)) {
      resolvedAccount = account;
    }
  }

  return resolvedAccount;
};
