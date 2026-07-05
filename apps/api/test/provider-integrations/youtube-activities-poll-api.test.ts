import type {
  YouTubeActivitiesPollResult,
  YouTubeLiveChatContext
} from "@maiks-yt/integrations";
import Fastify from "fastify";
import { describe, expect, it, vi } from "vitest";

import { registerYouTubeActivitiesPollRoutes } from "../../src/provider-integrations/youtube-activities-poll.route.js";
import { YouTubeActivitiesPollControlService } from "../../src/provider-integrations/youtube-activities-poll.service.js";
import type {
  YouTubeActivitiesIntakeWriter,
  YouTubeActivitiesPollActor,
  YouTubeActivitiesPollRepository,
  YouTubeActivitiesReadOnlyPoller
} from "../../src/provider-integrations/youtube-activities-poll.types.js";

const context: YouTubeLiveChatContext = {
  config: {
    ok: true,
    clientId: "client-id",
    clientSecret: "client-secret",
    redirectUri: "https://api-dev.maiks.yt/admin/provider-integrations/youtube/callback"
  },
  credential: {
    accessToken: null,
    refreshToken: "refresh-token",
    accessTokenExpiresAt: null
  },
  selectedChannel: {
    id: "UC123",
    title: "Maiks Minecraft",
    customUrl: "@maiksmc"
  }
};

class FakeYouTubeActivitiesRepository implements YouTubeActivitiesPollRepository {
  public actor: YouTubeActivitiesPollActor | null = {
    domainUserId: "owner-user",
    rolePermissionValues: [["*"]]
  };

  public context: YouTubeLiveChatContext | null = context;

  public async resolveActor(): Promise<YouTubeActivitiesPollActor | null> {
    return this.actor ? structuredClone(this.actor) : null;
  }

  public async resolveSelectedLiveChatContext(): Promise<YouTubeLiveChatContext | null> {
    return this.context ? structuredClone(this.context) : null;
  }
}

class FakeYouTubeActivitiesPoller implements YouTubeActivitiesReadOnlyPoller {
  public result: YouTubeActivitiesPollResult = {
    ok: true,
    channelId: "UC123",
    events: [{
      actorDisplayName: "Maiks Minecraft",
      actorExternalId: "UC123",
      channelId: "UC123",
      mechanism: "youtube-activity",
      occurredAt: "2026-07-05T08:00:00.000Z",
      providerEventName: "upload",
      providerMessageId: "activity-1",
      redactedPayload: {
        title: "Upload title",
        type: "upload"
      },
      source: "youtube",
      sourceEventId: "youtube-activity:UC123:activity-1"
    }],
    polledAt: "2026-07-05T08:01:00.000Z",
    readOnly: true
  };

  public async pollRecent(): Promise<YouTubeActivitiesPollResult> {
    return structuredClone(this.result);
  }
}

class FakeIntakeWriter implements YouTubeActivitiesIntakeWriter {
  public inserted = true;
  public writes: string[] = [];

  public async recordProviderEvent(event: Extract<YouTubeActivitiesPollResult, { ok: true }>["events"][number]) {
    this.writes.push(event.sourceEventId);

    return {
      inserted: this.inserted,
      ok: true as const
    };
  }
}

const createServer = (input: {
  service?: Pick<YouTubeActivitiesPollControlService, "pollRecent">;
  session?: { user: { id: string } } | null;
} = {}) => {
  const server = Fastify();

  registerYouTubeActivitiesPollRoutes(server, {
    getAuthSession: async () => "session" in input ? input.session ?? null : { user: { id: "auth-owner" } },
    getDatabasePool: () => {
      throw new Error("database should not be used by fake service");
    },
    intakeLogService: {
      recordProviderEvent: async () => {
        throw new Error("intake writer should not be used by fake service");
      }
    },
    createService: () => input.service ?? new YouTubeActivitiesPollControlService(
      new FakeYouTubeActivitiesRepository(),
      new FakeIntakeWriter(),
      new FakeYouTubeActivitiesPoller()
    )
  });

  return server;
};

describe("YouTubeActivitiesPollControlService", () => {
  it("polls recent activities and records provider intake rows", async () => {
    const writer = new FakeIntakeWriter();
    const service = new YouTubeActivitiesPollControlService(
      new FakeYouTubeActivitiesRepository(),
      writer,
      new FakeYouTubeActivitiesPoller()
    );

    await expect(service.pollRecent({ authUserId: "auth-owner" })).resolves.toMatchObject({
      ok: true,
      channelId: "UC123",
      fetched: 1,
      inserted: 1,
      events: [{
        catalogKnown: true,
        inserted: true,
        providerEventName: "upload"
      }]
    });
    expect(writer.writes).toEqual(["youtube-activity:UC123:activity-1"]);
  });

  it("reports duplicate rows without failing the poll", async () => {
    const writer = new FakeIntakeWriter();
    writer.inserted = false;
    const service = new YouTubeActivitiesPollControlService(
      new FakeYouTubeActivitiesRepository(),
      writer,
      new FakeYouTubeActivitiesPoller()
    );

    await expect(service.pollRecent({ authUserId: "auth-owner" })).resolves.toMatchObject({
      ok: true,
      fetched: 1,
      inserted: 0,
      events: [{
        inserted: false
      }]
    });
  });

  it("denies unlinked and non-provider-management users", async () => {
    const repository = new FakeYouTubeActivitiesRepository();
    const service = new YouTubeActivitiesPollControlService(
      repository,
      new FakeIntakeWriter(),
      new FakeYouTubeActivitiesPoller()
    );

    repository.actor = null;
    await expect(service.pollRecent({ authUserId: "missing-user" })).resolves.toEqual({
      ok: false,
      reason: "youtube_activities_user_unlinked"
    });

    repository.actor = {
      domainUserId: "helper-user",
      rolePermissionValues: [["moderators:manage"]]
    };
    await expect(service.pollRecent({ authUserId: "helper-user" })).resolves.toEqual({
      ok: false,
      reason: "youtube_activities_forbidden"
    });
  });

  it("fails closed when the selected channel context is missing", async () => {
    const repository = new FakeYouTubeActivitiesRepository();
    repository.context = null;
    const service = new YouTubeActivitiesPollControlService(
      repository,
      new FakeIntakeWriter(),
      new FakeYouTubeActivitiesPoller()
    );

    await expect(service.pollRecent({ authUserId: "auth-owner" })).resolves.toEqual({
      ok: false,
      reason: "youtube_activities_context_missing"
    });
  });
});

describe("YouTube activities poll route", () => {
  it("returns 401 for unauthenticated access", async () => {
    const server = createServer({ session: null });
    const response = await server.inject({
      method: "POST",
      url: "/admin/provider-integrations/youtube-activities/poll"
    });

    expect(response.statusCode).toBe(401);
    expect(response.json()).toEqual({
      ok: false,
      reason: "not_authenticated"
    });
  });

  it("polls through authenticated owner route", async () => {
    const server = createServer();
    const response = await server.inject({
      method: "POST",
      url: "/admin/provider-integrations/youtube-activities/poll"
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      ok: true,
      channelId: "UC123",
      fetched: 1,
      inserted: 1
    });
  });

  it("returns safe errors without leaking thrown values", async () => {
    const server = createServer({
      service: {
        pollRecent: vi.fn(async () => {
          throw new Error("secret-youtube-token-value exploded");
        })
      }
    });
    const response = await server.inject({
      method: "POST",
      url: "/admin/provider-integrations/youtube-activities/poll"
    });

    expect(response.statusCode).toBe(503);
    expect(response.json()).toEqual({
      ok: false,
      reason: "youtube_activities_unavailable"
    });
    expect(response.body).not.toContain("secret-youtube-token-value");
  });
});
