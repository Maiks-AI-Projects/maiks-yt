import type {
  StreamVisibilityPreferenceScope,
  StreamVisibilityPreferenceValue
} from "@maiks-yt/domain/events";

export type AccountAuthUser = {
  id: string;
  name?: string | null;
  email?: string | null;
  image?: string | null;
};

export type AccountAuthSession = {
  user: AccountAuthUser;
} | null;

export type StreamVisibilityPreferencesDomainUser = {
  id: string;
  displayName: string;
  profileVisibility: "private" | "minimal" | "public";
};

export type SavedStreamVisibilityPreference = {
  scope: StreamVisibilityPreferenceScope;
  optedOut: boolean;
};

export type StreamVisibilityPreferenceUpdate = {
  scope: StreamVisibilityPreferenceScope;
  optedOut: boolean;
};

export type StreamVisibilityPreferencesResult =
  | {
    ok: true;
    domainUser: StreamVisibilityPreferencesDomainUser;
    preferences: readonly StreamVisibilityPreferenceValue[];
  }
  | {
    ok: false;
    reason:
      | "stream_visibility_preferences_invalid_input"
      | "stream_visibility_preferences_unavailable";
  };

export interface StreamVisibilityPreferencesRepository {
  resolveOrCreateDomainUser(authUser: AccountAuthUser): Promise<StreamVisibilityPreferencesDomainUser>;
  listPreferences(userId: string): Promise<readonly SavedStreamVisibilityPreference[]>;
  upsertPreferences(input: {
    userId: string;
    preferences: readonly StreamVisibilityPreferenceUpdate[];
  }): Promise<void>;
}

