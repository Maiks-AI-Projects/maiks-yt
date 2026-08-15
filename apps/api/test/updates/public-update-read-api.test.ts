import type { PublicUpdateSource } from "@maiks-yt/domain/updates";
import Fastify from "fastify";
import { describe, expect, it } from "vitest";

import { registerPublicUpdateReadRoutes } from "../../src/updates/public-update-read.route.js";
import { PublicUpdateReadService } from "../../src/updates/public-update-read.service.js";
import type { PublicUpdateReadRepository } from "../../src/updates/public-update-read.types.js";

const createUpdate = (
  id: string,
  overrides: Partial<PublicUpdateSource> = {}
): PublicUpdateSource => ({
  id,
  slug: id,
  title: `Update ${id}`,
  summary: `Summary ${id}`,
  body: `Body ${id}`,
  kind: "post",
  status: "published",
  visibility: "public",
  publishedAt: "2026-08-14T12:00:00.000Z",
  isPinned: false,
  isExample: false,
  updatedAt: "2026-08-14T12:00:00.000Z",
  ...overrides
});

class FakePublicUpdateReadRepository implements PublicUpdateReadRepository {
  public constructor(private readonly updates: readonly PublicUpdateSource[]) {}

  public async listUpdates(): Promise<readonly PublicUpdateSource[]> {
    return structuredClone(this.updates);
  }

  public async findUpdateBySlug(slug: string): Promise<PublicUpdateSource | null> {
    const update = this.updates.find((candidate) => candidate.slug === slug);
    return update ? structuredClone(update) : null;
  }
}

const createServer = (updates: readonly PublicUpdateSource[]) => {
  const server = Fastify();
  const repository = new FakePublicUpdateReadRepository(updates);

  registerPublicUpdateReadRoutes(server, {
    getDatabasePool: () => {
      throw new Error("pool should not be used");
    },
    createService: () => new PublicUpdateReadService(repository)
  });

  return server;
};

describe("public update read API", () => {
  it("lists only published public records without bodies", async () => {
    const server = createServer([
      createUpdate("visible", { isExample: true, kind: "announcement" }),
      createUpdate("draft", { status: "draft", publishedAt: null }),
      createUpdate("hidden", { visibility: "hidden" })
    ]);

    const response = await server.inject({ method: "GET", url: "/updates" });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      ok: true,
      updates: [{ slug: "visible", kind: "announcement", isExample: true }]
    });
    expect(response.body).not.toContain("Body visible");
    expect(response.body).not.toContain("Body draft");
    await server.close();
  });

  it("returns public detail and hides draft detail", async () => {
    const server = createServer([
      createUpdate("visible"),
      createUpdate("draft", { status: "draft", publishedAt: null })
    ]);

    const visibleResponse = await server.inject({ method: "GET", url: "/updates/visible" });
    const draftResponse = await server.inject({ method: "GET", url: "/updates/draft" });

    expect(visibleResponse.statusCode).toBe(200);
    expect(visibleResponse.json()).toMatchObject({
      ok: true,
      update: { slug: "visible", body: "Body visible" }
    });
    expect(draftResponse.statusCode).toBe(404);
    expect(draftResponse.json()).toEqual({ ok: false, reason: "update_not_found" });
    await server.close();
  });

  it("rejects malformed slugs and returns safe unavailable errors", async () => {
    const badSlugServer = createServer([]);
    const badSlugResponse = await badSlugServer.inject({ method: "GET", url: "/updates/Bad_Slug" });

    expect(badSlugResponse.statusCode).toBe(400);
    expect(badSlugResponse.json()).toEqual({ ok: false, reason: "invalid_update_slug" });
    await badSlugServer.close();

    const unavailableServer = Fastify();
    registerPublicUpdateReadRoutes(unavailableServer, {
      getDatabasePool: () => {
        throw new Error("database secret details");
      }
    });
    const unavailableResponse = await unavailableServer.inject({ method: "GET", url: "/updates" });

    expect(unavailableResponse.statusCode).toBe(503);
    expect(unavailableResponse.json()).toEqual({ ok: false, reason: "updates_unavailable" });
    expect(unavailableResponse.body).not.toContain("database secret details");
    await unavailableServer.close();
  });
});
