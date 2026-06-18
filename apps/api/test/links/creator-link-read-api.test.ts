import type { CreatorLinkSource } from "@maiks-yt/domain";
import Fastify from "fastify";
import { describe, expect, it } from "vitest";

import { registerCreatorLinkReadRoutes } from "../../src/links/creator-link-read.route.js";
import { CreatorLinkReadService } from "../../src/links/creator-link-read.service.js";
import type { CreatorLinkReadRepository } from "../../src/links/creator-link-read.types.js";

const createLink = (
  key: string,
  overrides: Partial<CreatorLinkSource> = {}
): CreatorLinkSource => ({
  key,
  title: `Link ${key}`,
  description: `Description for ${key}`,
  purpose: "social",
  icon: "social",
  availability: "available",
  href: `/${key}`,
  availabilityNote: null,
  isPrimary: false,
  sortOrder: 10,
  isPublished: true,
  ...overrides
});

class FakeCreatorLinkReadRepository implements CreatorLinkReadRepository {
  public constructor(private readonly links: readonly CreatorLinkSource[]) {}

  public async listPublishedLinks(): Promise<readonly CreatorLinkSource[]> {
    return this.links.map((link) => structuredClone(link));
  }
}

describe("public creator link read API", () => {
  it("returns published valid links in stable order", async () => {
    const repository = new FakeCreatorLinkReadRepository([
      createLink("draft", { isPublished: false }),
      createLink("missing-href", { href: "" }),
      createLink("support", {
        title: "Support",
        purpose: "support",
        icon: "support",
        availability: "unavailable",
        href: null,
        availabilityNote: "Support link not available",
        sortOrder: 2
      }),
      createLink("home", {
        title: "Home",
        isPrimary: true,
        sortOrder: 1
      })
    ]);
    const server = Fastify();

    registerCreatorLinkReadRoutes(server, {
      getDatabasePool: () => {
        throw new Error("pool should not be used");
      },
      createService: () => new CreatorLinkReadService(repository)
    });

    const response = await server.inject({
      method: "GET",
      url: "/links"
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      ok: true,
      links: [
        { key: "home", availability: "available", href: "/home", isPrimary: true },
        { key: "support", availability: "unavailable", availabilityNote: "Support link not available" }
      ]
    });
    await server.close();
  });

  it("returns a stable unavailable response when data loading fails", async () => {
    const server = Fastify();

    registerCreatorLinkReadRoutes(server, {
      getDatabasePool: () => {
        throw new Error("pool should not be used");
      },
      createService: () => ({
        listLinks: async () => {
          throw new Error("database unavailable");
        }
      })
    });

    const response = await server.inject({
      method: "GET",
      url: "/links"
    });

    expect(response.statusCode).toBe(503);
    expect(response.json()).toEqual({
      ok: false,
      reason: "creator_links_unavailable"
    });
    await server.close();
  });
});
