import type { CreatorLinkSource } from "@maiks-yt/domain";
import Fastify from "fastify";
import { describe, expect, it } from "vitest";

import { registerCreatorLinkAdminRoutes } from "../../src/links/creator-link-admin.route.js";
import { CreatorLinkAdminService } from "../../src/links/creator-link-admin.service.js";
import type {
  CreatorLinkAdminActor,
  CreatorLinkAdminInput,
  CreatorLinkAdminRepository,
  CreatorLinkAdminReorderInput
} from "../../src/links/creator-link-admin.types.js";

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
  isPublished: false,
  ...overrides
});

const createPayload = (overrides: Partial<CreatorLinkAdminInput> = {}): CreatorLinkAdminInput => ({
  key: "new-link",
  title: "New Link",
  description: "A manually managed creator link.",
  purpose: "social",
  icon: "social",
  availability: "available",
  href: "/new-link",
  availabilityNote: null,
  isPrimary: false,
  sortOrder: 20,
  isPublished: false,
  ...overrides
});

class FakeCreatorLinkAdminRepository implements CreatorLinkAdminRepository {
  public actor: CreatorLinkAdminActor | null = {
    domainUserId: "domain-user",
    rolePermissionValues: [["*"]]
  };
  public readonly links = new Map<string, CreatorLinkSource>();
  public lastCreatedLink: CreatorLinkAdminInput | null = null;
  public lastUpdatedLink: CreatorLinkAdminInput | null = null;
  public lastReorder: readonly string[] | null = null;

  public constructor() {
    this.links.set("support", createLink("support", {
      title: "Support",
      purpose: "support",
      icon: "support",
      availability: "unavailable",
      href: null,
      availabilityNote: "Support link not available",
      sortOrder: 30,
      isPublished: true
    }));
    this.links.set("draft", createLink("draft"));
  }

  public async resolveActor(): Promise<CreatorLinkAdminActor | null> {
    return this.actor ? structuredClone(this.actor) : null;
  }

  public async listLinks(): Promise<readonly CreatorLinkSource[]> {
    return [...this.links.values()].map((link) => structuredClone(link));
  }

  public async createLink(input: CreatorLinkAdminInput): Promise<CreatorLinkSource> {
    if (this.links.has(input.key)) {
      throw new Error("creator_link_key_conflict");
    }

    this.lastCreatedLink = structuredClone(input);
    const link = createLink(input.key, input);
    this.links.set(input.key, link);
    return structuredClone(link);
  }

  public async updateLink(key: string, input: CreatorLinkAdminInput) {
    if (!this.links.has(key)) {
      return "not-found" as const;
    }

    if (input.key !== key && this.links.has(input.key)) {
      return "key-conflict" as const;
    }

    this.lastUpdatedLink = structuredClone(input);
    this.links.delete(key);
    const link = createLink(input.key, input);
    this.links.set(input.key, link);
    return structuredClone(link);
  }

  public async reorderLinks(input: CreatorLinkAdminReorderInput) {
    if (input.orderedKeys.some((key) => !this.links.has(key))) {
      return "not-found" as const;
    }

    this.lastReorder = [...input.orderedKeys];
    for (const [index, key] of input.orderedKeys.entries()) {
      const link = this.links.get(key)!;
      this.links.set(key, {
        ...link,
        sortOrder: index + 1
      });
    }

    return await this.listLinks();
  }
}

describe("CreatorLinkAdminService", () => {
  it("allows owner wildcard and typed creator-links permission", async () => {
    const repository = new FakeCreatorLinkAdminRepository();
    const service = new CreatorLinkAdminService(repository);

    await expect(service.listLinks({ authUserId: "auth-user" })).resolves.toMatchObject({
      ok: true
    });

    repository.actor = {
      domainUserId: "domain-user",
      rolePermissionValues: [JSON.stringify(["creator-links:manage"])]
    };

    await expect(service.listLinks({ authUserId: "auth-user" })).resolves.toMatchObject({
      ok: true
    });
  });

  it("denies unlinked and normal linked users", async () => {
    const repository = new FakeCreatorLinkAdminRepository();
    const service = new CreatorLinkAdminService(repository);

    repository.actor = null;
    await expect(service.listLinks({ authUserId: "auth-user" })).resolves.toEqual({
      ok: false,
      reason: "creator_link_admin_user_unlinked"
    });

    repository.actor = {
      domainUserId: "domain-user",
      rolePermissionValues: [["project-admin:manage"]]
    };
    await expect(service.createLink({
      authUserId: "auth-user",
      link: createPayload()
    })).resolves.toEqual({
      ok: false,
      reason: "creator_link_admin_forbidden"
    });
  });

  it("creates drafts, publishes valid links, and unpublishes links", async () => {
    const repository = new FakeCreatorLinkAdminRepository();
    const service = new CreatorLinkAdminService(repository);

    await expect(service.createLink({
      authUserId: "auth-user",
      link: createPayload({ isPublished: false })
    })).resolves.toMatchObject({
      ok: true,
      link: {
        key: "new-link",
        isPublished: false
      }
    });
    expect(repository.lastCreatedLink).toMatchObject({
      isPublished: false
    });

    await expect(service.updateLink({
      authUserId: "auth-user",
      key: "new-link",
      link: {
        isPublished: true
      }
    })).resolves.toMatchObject({
      ok: true,
      link: {
        isPublished: true
      }
    });
    await expect(service.updateLink({
      authUserId: "auth-user",
      key: "new-link",
      link: {
        isPublished: false
      }
    })).resolves.toMatchObject({
      ok: true,
      link: {
        isPublished: false
      }
    });
  });

  it("rejects invalid availability invariants and available support links", async () => {
    const repository = new FakeCreatorLinkAdminRepository();
    const service = new CreatorLinkAdminService(repository);

    await expect(service.createLink({
      authUserId: "auth-user",
      link: createPayload({
        availability: "available",
        href: ""
      })
    })).resolves.toEqual({
      ok: false,
      reason: "creator_link_admin_invalid_input"
    });

    await expect(service.updateLink({
      authUserId: "auth-user",
      key: "support",
      link: {
        availability: "available",
        href: "https://example.com/support"
      }
    })).resolves.toEqual({
      ok: false,
      reason: "creator_link_admin_invalid_input"
    });

    await expect(service.updateLink({
      authUserId: "auth-user",
      key: "support",
      link: {
        key: "support-now",
        purpose: "social",
        icon: "social",
        availability: "available",
        href: "https://example.com/support"
      }
    })).resolves.toEqual({
      ok: false,
      reason: "creator_link_admin_invalid_input"
    });
  });

  it("reorders links by key and rejects missing keys", async () => {
    const repository = new FakeCreatorLinkAdminRepository();
    const service = new CreatorLinkAdminService(repository);

    await expect(service.reorderLinks({
      authUserId: "auth-user",
      reorder: {
        orderedKeys: ["draft", "support"]
      }
    })).resolves.toMatchObject({
      ok: true
    });
    expect(repository.lastReorder).toEqual(["draft", "support"]);

    await expect(service.reorderLinks({
      authUserId: "auth-user",
      reorder: {
        orderedKeys: ["missing"]
      }
    })).resolves.toEqual({
      ok: false,
      reason: "creator_link_not_found"
    });
  });
});

describe("Creator link admin route boundary", () => {
  it("returns 401 without a session and 403 for normal linked users", async () => {
    const unauthenticatedServer = Fastify();
    registerCreatorLinkAdminRoutes(unauthenticatedServer, {
      getAuthSession: async () => null,
      getDatabasePool: () => {
        throw new Error("pool should not be used");
      }
    });

    const unauthenticatedResponse = await unauthenticatedServer.inject({
      method: "GET",
      url: "/admin/links"
    });
    expect(unauthenticatedResponse.statusCode).toBe(401);
    expect(unauthenticatedResponse.json()).toEqual({
      ok: false,
      reason: "not_authenticated"
    });
    await unauthenticatedServer.close();

    const repository = new FakeCreatorLinkAdminRepository();
    repository.actor = {
      domainUserId: "domain-user",
      rolePermissionValues: [[]]
    };
    const forbiddenServer = Fastify();
    registerCreatorLinkAdminRoutes(forbiddenServer, {
      getAuthSession: async () => ({ user: { id: "auth-user" } }),
      getDatabasePool: () => {
        throw new Error("pool should not be used");
      },
      createService: () => new CreatorLinkAdminService(repository)
    });

    const forbiddenResponse = await forbiddenServer.inject({
      method: "GET",
      url: "/admin/links"
    });
    expect(forbiddenResponse.statusCode).toBe(403);
    expect(forbiddenResponse.json()).toEqual({
      ok: false,
      reason: "creator_link_admin_forbidden"
    });
    await forbiddenServer.close();
  });

  it("maps invalid input, missing records, and conflicts to stable status codes", async () => {
    const cases = [
      {
        result: { ok: false, reason: "creator_link_admin_invalid_input" } as const,
        statusCode: 400
      },
      {
        result: { ok: false, reason: "creator_link_not_found" } as const,
        statusCode: 404
      },
      {
        result: { ok: false, reason: "creator_link_key_conflict" } as const,
        statusCode: 409
      }
    ];

    for (const testCase of cases) {
      const server = Fastify();
      registerCreatorLinkAdminRoutes(server, {
        getAuthSession: async () => ({ user: { id: "auth-user" } }),
        getDatabasePool: () => {
          throw new Error("pool should not be used");
        },
        createService: () => ({
          listLinks: async () => ({
            ok: true,
            links: []
          }),
          createLink: async () => testCase.result,
          updateLink: async () => testCase.result,
          reorderLinks: async () => testCase.result.reason === "creator_link_key_conflict"
            ? { ok: false, reason: "creator_link_not_found" }
            : testCase.result
        })
      });

      const response = await server.inject({
        method: "PATCH",
        url: "/admin/links/link",
        payload: {
          title: "Updated"
        }
      });

      expect(response.statusCode).toBe(testCase.statusCode);
      expect(response.json()).toEqual(testCase.result);
      await server.close();
    }
  });

  it("keeps reorder on its own route instead of treating it as a link key", async () => {
    const repository = new FakeCreatorLinkAdminRepository();
    const server = Fastify();
    registerCreatorLinkAdminRoutes(server, {
      getAuthSession: async () => ({ user: { id: "auth-user" } }),
      getDatabasePool: () => {
        throw new Error("pool should not be used");
      },
      createService: () => new CreatorLinkAdminService(repository)
    });

    const response = await server.inject({
      method: "PATCH",
      url: "/admin/links/reorder",
      payload: {
        orderedKeys: ["draft", "support"]
      }
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      ok: true
    });
    expect(repository.lastReorder).toEqual(["draft", "support"]);
    await server.close();
  });
});
