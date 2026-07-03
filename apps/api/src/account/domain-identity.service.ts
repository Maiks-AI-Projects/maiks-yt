import { randomUUID } from "node:crypto";

import type { DatabasePool } from "@maiks-yt/database";

import type { AuthSessionSnapshot } from "./auth-session.types.js";

export type DomainUserRow = {
  id: string;
  displayName: string;
  profileVisibility: string;
};

type LinkedAccountRow = {
  id: string;
  provider: string;
  providerAccountId: string;
  displayName: string;
  purposeLabel?: string | null;
  audienceKey?: string | null;
  channelKey?: string | null;
  allowLogin: number | boolean;
  capabilities: unknown;
  verifiedAt?: Date | null;
  createdAt?: Date | null;
};

export type DomainLinkedAccount = {
  id: string;
  provider: string;
  providerAccountId: string;
  displayName: string;
  purposeLabel: string | null;
  audienceKey: string | null;
  channelKey: string | null;
  allowLogin: boolean;
  capabilities: unknown[];
  verifiedAt: Date | null;
  createdAt: Date | null;
};

export const parseJsonArray = (value: unknown): unknown[] => {
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

export const getDomainUserForAuthUser = async (
  pool: DatabasePool,
  authUser: NonNullable<AuthSessionSnapshot>["user"],
  createMissing: boolean
): Promise<{ user: DomainUserRow | null; created: boolean }> => {
  const [linkRows] = await pool.execute(
    "SELECT auth_user_links.user_id AS userId, users.display_name AS displayName, users.profile_visibility AS profileVisibility FROM auth_user_links INNER JOIN users ON users.id = auth_user_links.user_id WHERE auth_user_links.auth_user_id = ? AND users.deleted_at IS NULL LIMIT 1",
    [authUser.id]
  );
  const existingLink = Array.isArray(linkRows)
    ? linkRows[0] as { userId: string; displayName: string; profileVisibility: string } | undefined
    : undefined;

  if (existingLink) {
    return {
      created: false,
      user: {
        id: existingLink.userId,
        displayName: existingLink.displayName,
        profileVisibility: existingLink.profileVisibility
      }
    };
  }

  if (!createMissing) {
    return {
      created: false,
      user: null
    };
  }

  const userId = randomUUID();
  const displayName = authUser.name ?? authUser.email ?? "Community Member";

  await pool.execute(
    "INSERT INTO users (id, display_name, profile_visibility, avatar_url) VALUES (?, ?, 'private', ?)",
    [userId, displayName, authUser.image ?? null]
  );
  await pool.execute(
    "INSERT INTO auth_user_links (id, auth_user_id, user_id) VALUES (?, ?, ?)",
    [randomUUID(), authUser.id, userId]
  );

  return {
    created: true,
    user: {
      id: userId,
      displayName,
      profileVisibility: "private"
    }
  };
};

export const getDomainLinkedAccounts = async (
  pool: DatabasePool,
  userId: string
): Promise<DomainLinkedAccount[]> => {
  const [linkedAccountRows] = await pool.execute(
    "SELECT id, provider, provider_account_id AS providerAccountId, display_name AS displayName, purpose_label AS purposeLabel, audience_key AS audienceKey, channel_key AS channelKey, allow_login AS allowLogin, capabilities, verified_at AS verifiedAt, created_at AS createdAt FROM linked_accounts WHERE user_id = ? ORDER BY provider, created_at",
    [userId]
  );

  return Array.isArray(linkedAccountRows)
    ? linkedAccountRows.map((account) => {
      const typedAccount = account as LinkedAccountRow;

      return {
        id: typedAccount.id,
        provider: typedAccount.provider,
        providerAccountId: typedAccount.providerAccountId,
        displayName: typedAccount.displayName,
        purposeLabel: typedAccount.purposeLabel ?? null,
        audienceKey: typedAccount.audienceKey ?? null,
        channelKey: typedAccount.channelKey ?? null,
        allowLogin: Boolean(typedAccount.allowLogin),
        capabilities: parseJsonArray(typedAccount.capabilities),
        verifiedAt: typedAccount.verifiedAt ?? null,
        createdAt: typedAccount.createdAt ?? null
      };
    })
    : [];
};
