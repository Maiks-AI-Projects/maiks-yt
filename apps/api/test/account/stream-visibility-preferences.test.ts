import Fastify from "fastify";
import { describe, expect, it } from "vitest";

import { registerStreamVisibilityPreferencesRoutes } from "../../src/account/stream-visibility-preferences.route.js";
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
  public user = {
    id: "domain-user-1",
    displayName: "Preview User",
    profileVisibility: "private",
    authUserId: "raw-auth-user-id",
    providerAccountId: "raw-provider-subject",
    accessToken: "raw-provider-token",
    capabilities: ["account:internal"],
    createdAt: "2026-08-28T12:00:00.000Z"
  } as const satisfies StreamVisibilityPreferencesDomainUser & Record<string, unknown>;
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

    expect(result).not.toHaveProperty("domainUser");
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

const expectedPreferences = ({
  freeTts = false,
  global = false,
  profileImage = false,
  signup = false,
  username = false
}: {
  freeTts?: boolean;
  global?: boolean;
  profileImage?: boolean;
  signup?: boolean;
  username?: boolean;
} = {}) => [{
  scope: "all_stream_visible_website_events",
  label: "All website/community moments",
  description: "Hide your website and community activity from stream-visible notifications.",
  optedOut: global
}, {
  scope: "website.signup",
  label: "Website signup",
  description: "Hide account signup moments from stream-visible website notifications.",
  optedOut: signup
}, {
  scope: "website.username-change",
  label: "Public name changes",
  description: "Hide public display-name changes from stream-visible website notifications.",
  optedOut: username
}, {
  scope: "website.profile-image-update",
  label: "Profile image updates",
  description: "Hide profile image updates from stream-visible website notifications.",
  optedOut: profileImage
}, {
  scope: "website.free-tts-request",
  label: "Free website TTS",
  description: "Hide future free website TTS requests from stream-visible playback.",
  optedOut: freeTts
}];

const createRouteServer = (repository: FakeStreamVisibilityPreferencesRepository) => {
  const server = Fastify({ logger: false });
  const service = new StreamVisibilityPreferencesService(repository);

  registerStreamVisibilityPreferencesRoutes(server, {
    getAuthSession: async () => ({
      user: {
        id: "raw-auth-user-id",
        name: "Private Auth Name",
        email: "private-auth@example.test",
        image: "https://auth.example.test/private.png",
        providerAccountId: "raw-provider-subject",
        accessToken: "raw-provider-token"
      }
    }),
    getDatabasePool: () => {
      throw new Error("injected service should avoid the database pool");
    },
    createService: () => service
  });

  return server;
};

const expectNoIdentityInternals = (body: unknown): void => {
  const serialized = JSON.stringify(body);

  expect(serialized).not.toContain("domainUser");
  expect(serialized).not.toContain("domain-user-1");
  expect(serialized).not.toContain("raw-auth-user-id");
  expect(serialized).not.toContain("Private Auth Name");
  expect(serialized).not.toContain("private-auth@example.test");
  expect(serialized).not.toContain("raw-provider-subject");
  expect(serialized).not.toContain("raw-provider-token");
  expect(serialized).not.toContain("capabilities");
  expect(serialized).not.toContain("createdAt");
};

describe("stream visibility preference browser responses", () => {
  it("returns only preferences from the current-user GET route", async () => {
    const repository = new FakeStreamVisibilityPreferencesRepository();
    repository.preferences.set("domain-user-1", new Map([
      ["all_stream_visible_website_events", true],
      ["website.signup", true]
    ]));
    const server = createRouteServer(repository);

    const response = await server.inject({
      method: "GET",
      url: "/account/stream-visibility-preferences"
    });
    const body = response.json();

    expect(response.statusCode).toBe(200);
    expect(body).toEqual({
      ok: true,
      preferences: expectedPreferences({ global: true, signup: true })
    });
    expect(Object.keys(body)).toEqual(["ok", "preferences"]);
    expect(body.preferences.every((preference: unknown) =>
      JSON.stringify(Object.keys(preference as object)) === JSON.stringify([
        "scope",
        "label",
        "description",
        "optedOut"
      ]))).toBe(true);
    expectNoIdentityInternals(body);
  });

  it("updates preferences and returns only the saved preference projection", async () => {
    const repository = new FakeStreamVisibilityPreferencesRepository();
    const server = createRouteServer(repository);

    const response = await server.inject({
      method: "PUT",
      url: "/account/stream-visibility-preferences",
      payload: {
        preferences: [{
          scope: "website.profile-image-update",
          optedOut: true
        }]
      }
    });
    const body = response.json();

    expect(response.statusCode).toBe(200);
    expect(repository.lastUpdates).toEqual([{
      scope: "website.profile-image-update",
      optedOut: true
    }]);
    expect(body).toEqual({
      ok: true,
      preferences: expectedPreferences({ profileImage: true })
    });
    expect(Object.keys(body)).toEqual(["ok", "preferences"]);
    expectNoIdentityInternals(body);
  });
});
