import {
  buildStreamVisibilityPreferenceValues,
  isStreamVisibilityPreferenceScope
} from "@maiks-yt/domain/events";

import type {
  AccountAuthUser,
  StreamVisibilityPreferenceUpdate,
  StreamVisibilityPreferencesRepository,
  StreamVisibilityPreferencesResult
} from "./stream-visibility-preferences.types.js";

const dedupePreferenceUpdates = (
  updates: readonly StreamVisibilityPreferenceUpdate[]
): readonly StreamVisibilityPreferenceUpdate[] | null => {
  const byScope = new Map<StreamVisibilityPreferenceUpdate["scope"], boolean>();

  for (const update of updates) {
    if (!isStreamVisibilityPreferenceScope(update.scope)) {
      return null;
    }

    byScope.set(update.scope, update.optedOut);
  }

  return [...byScope.entries()].map(([scope, optedOut]) => ({
    scope,
    optedOut
  }));
};

export class StreamVisibilityPreferencesService {
  public constructor(private readonly repository: StreamVisibilityPreferencesRepository) {}

  public async getPreferences(input: {
    authUser: AccountAuthUser;
  }): Promise<StreamVisibilityPreferencesResult> {
    const domainUser = await this.repository.resolveOrCreateDomainUser(input.authUser);
    const savedPreferences = await this.repository.listPreferences(domainUser.id);

    return {
      ok: true,
      domainUser,
      preferences: buildStreamVisibilityPreferenceValues(savedPreferences)
    };
  }

  public async updatePreferences(input: {
    authUser: AccountAuthUser;
    preferences: readonly StreamVisibilityPreferenceUpdate[];
  }): Promise<StreamVisibilityPreferencesResult> {
    const preferences = dedupePreferenceUpdates(input.preferences);

    if (!preferences) {
      return {
        ok: false,
        reason: "stream_visibility_preferences_invalid_input"
      };
    }

    const domainUser = await this.repository.resolveOrCreateDomainUser(input.authUser);
    await this.repository.upsertPreferences({
      userId: domainUser.id,
      preferences
    });

    const savedPreferences = await this.repository.listPreferences(domainUser.id);

    return {
      ok: true,
      domainUser,
      preferences: buildStreamVisibilityPreferenceValues(savedPreferences)
    };
  }
}

