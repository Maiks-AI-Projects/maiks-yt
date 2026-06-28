import { randomUUID } from "node:crypto";

import type { DatabasePool } from "@maiks-yt/database";
import { streamVisibilityPreferenceScopes } from "@maiks-yt/domain/events";

import type {
  AccountAuthUser,
  SavedStreamVisibilityPreference,
  StreamVisibilityPreferencesDomainUser,
  StreamVisibilityPreferencesRepository
} from "./stream-visibility-preferences.types.js";

type DomainUserRow = {
  userId: string;
  displayName: string;
  profileVisibility: StreamVisibilityPreferencesDomainUser["profileVisibility"];
};

type PreferenceRow = {
  scope: SavedStreamVisibilityPreference["scope"];
  optedOut: number | boolean;
};

const mapDomainUser = (row: DomainUserRow): StreamVisibilityPreferencesDomainUser => ({
  id: row.userId,
  displayName: row.displayName,
  profileVisibility: row.profileVisibility
});

export const createStreamVisibilityPreferencesRepository = (
  pool: DatabasePool
): StreamVisibilityPreferencesRepository => ({
  async resolveOrCreateDomainUser(authUser: AccountAuthUser) {
    const [linkRows] = await pool.execute(
      `
        SELECT
          auth_user_links.user_id AS userId,
          users.display_name AS displayName,
          users.profile_visibility AS profileVisibility
        FROM auth_user_links
        INNER JOIN users ON users.id = auth_user_links.user_id
        WHERE auth_user_links.auth_user_id = ?
          AND users.deleted_at IS NULL
        LIMIT 1
      `,
      [authUser.id]
    );
    const existingLink = Array.isArray(linkRows)
      ? linkRows[0] as DomainUserRow | undefined
      : undefined;

    if (existingLink) {
      return mapDomainUser(existingLink);
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
      id: userId,
      displayName,
      profileVisibility: "private"
    };
  },

  async listPreferences(userId: string) {
    const placeholders = streamVisibilityPreferenceScopes.map(() => "?").join(", ");
    const [rows] = await pool.execute(
      `
        SELECT event_kind AS scope, opted_out AS optedOut
        FROM event_user_opt_outs
        WHERE user_id = ?
          AND event_kind IN (${placeholders})
      `,
      [userId, ...streamVisibilityPreferenceScopes]
    );

    return Array.isArray(rows)
      ? (rows as PreferenceRow[]).map((row) => ({
        scope: row.scope,
        optedOut: Boolean(row.optedOut)
      }))
      : [];
  },

  async upsertPreferences(input) {
    for (const preference of input.preferences) {
      await pool.execute(
        `
          INSERT INTO event_user_opt_outs
            (id, user_id, event_kind, opted_out, reason)
          VALUES (?, ?, ?, ?, 'current_user_stream_visibility_preference')
          ON DUPLICATE KEY UPDATE
            opted_out = VALUES(opted_out),
            reason = VALUES(reason),
            updated_at = NOW()
        `,
        [randomUUID(), input.userId, preference.scope, preference.optedOut]
      );
    }
  }
});

