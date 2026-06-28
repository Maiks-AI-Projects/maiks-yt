import { describe, expect, it } from "vitest";

import { StreamVisibilityPreferencesService } from "../../src/account/stream-visibility-preferences.service.js";
import type {
  AccountAuthUser,
  SavedStreamVisibilityPreference,
  StreamVisibilityPreferenceUpdate,
  StreamVisibilityPreferencesDomainUser,
  StreamVisibilityPreferencesRepository
} from "../../src/account/stream-visibility-preferences.types.js";

class FakeStreamVisibilityPreferencesRepository implements StreamVisibilityPreferencesRepository {
  public readonly preferences = new Map<string, Map<SavedStreamVisibilityPreference["scope"], boolean>>();
  public user: StreamVisibilityPreferencesDomainUser = {
    id: "domain-user-1",
    displayName: "Preview User",
    profileVisibility: "private"
  };
  public lastAuthUser: AccountAuthUser | null = null;
  public lastUpdates: readonly StreamVisibilityPreferenceUpdate[] = [];

  public async resolveOrCreateDomainUser(authUser: AccountAuthUser): Promise<StreamVisibilityPreferencesDomainUser> {
    this.lastAuthUser = authUser;
    return this.user;
  }

  public async listPreferences(userId: string): Promise<readonly SavedStreamVisibilityPreference[]> {
    const userPreferences = this.preferences.get(userId) ?? new Map();

    return [...userPreferences.entries()].map(([scope, optedOut]) => ({
      scope,
      optedOut
    }));
  }

  public async upsertPreferences(input: {
    userId: string;
    preferences: readonly StreamVisibilityPreferenceUpdate[];
  }): Promise<void> {
    this.lastUpdates = input.preferences;
    const userPreferences = this.preferences.get(input.userId) ?? new Map();

    for (const preference of input.preferences) {
      userPreferences.set(preference.scope, preference.optedOut);
    }

    this.preferences.set(input.userId, userPreferences);
  }
}

describe("StreamVisibilityPreferencesService", () => {
  it("returns all stream visibility preferences for the current domain user", async () => {
    const repository = new FakeStreamVisibilityPreferencesRepository();
    repository.preferences.set("domain-user-1", new Map([
      ["all_stream_visible_website_events", true],
      ["website.signup", true]
    ]));
    const service = new StreamVisibilityPreferencesService(repository);

    const result = await service.getPreferences({
      authUser: {
        id: "auth-user-1",
        name: "Preview User"
      }
    });

    expect(result).toMatchObject({
      ok: true,
      domainUser: {
        id: "domain-user-1"
      }
    });
    expect(result.ok ? result.preferences : []).toEqual(expect.arrayContaining([
      expect.objectContaining({
        scope: "all_stream_visible_website_events",
        optedOut: true
      }),
      expect.objectContaining({
        scope: "website.signup",
        optedOut: true
      }),
      expect.objectContaining({
        scope: "website.username-change",
        optedOut: false
      })
    ]));
    expect(result.ok ? result.preferences : []).toHaveLength(5);
    expect(repository.lastAuthUser?.id).toBe("auth-user-1");
  });

  it("dedupes updates by scope and returns the saved snapshot", async () => {
    const repository = new FakeStreamVisibilityPreferencesRepository();
    const service = new StreamVisibilityPreferencesService(repository);

    const result = await service.updatePreferences({
      authUser: {
        id: "auth-user-1",
        name: "Preview User"
      },
      preferences: [
        {
          scope: "website.profile-image-update",
          optedOut: true
        },
        {
          scope: "website.profile-image-update",
          optedOut: false
        },
        {
          scope: "website.free-tts-request",
          optedOut: true
        }
      ]
    });

    expect(repository.lastUpdates).toEqual([
      {
        scope: "website.profile-image-update",
        optedOut: false
      },
      {
        scope: "website.free-tts-request",
        optedOut: true
      }
    ]);
    expect(result).toMatchObject({
      ok: true,
      preferences: expect.arrayContaining([
        expect.objectContaining({
          scope: "website.profile-image-update",
          optedOut: false
        }),
        expect.objectContaining({
          scope: "website.free-tts-request",
          optedOut: true
        })
      ])
    });
  });
});
