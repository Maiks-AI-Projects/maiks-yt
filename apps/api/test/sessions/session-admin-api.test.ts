import type { DatabasePool } from "@maiks-yt/database";
import Fastify from "fastify";
import { describe, expect, it } from "vitest";

import { registerSessionAdminRoutes } from "../../src/sessions/session-admin.route.js";
import { SessionAdminService } from "../../src/sessions/session-admin.service.js";
import { createSessionAdminRepository } from "../../src/sessions/session-admin-store.service.js";
import type {
  SessionAdminActor,
  SessionAdminRecord,
  SessionAdminRepository
} from "../../src/sessions/session-admin.types.js";

class FakeSessionAdminRepository implements SessionAdminRepository {
  public actor: SessionAdminActor | null = {
    domainUserId: "domain-user",
    rolePermissionValues: [["*"]]
  };
  public readonly sessions: SessionAdminRecord[] = [
    {
      id: "session-current",
      authUserId: "auth-owner",
      userName: "Michael",
      userEmail: "michael@example.test",
      ipAddress: "127.0.0.1",
      userAgent: "Vitest Browser",
      createdAt: "2026-07-09T10:00:00.000Z",
      updatedAt: "2026-07-09T11:00:00.000Z",
      expiresAt: "2026-07-10T10:00:00.000Z",
      isCurrent: false,
      isExpired: false
    },
    {
      id: "session-other",
      authUserId: "auth-owner",
      userName: "Michael",
      userEmail: "michael@example.test",
      ipAddress: "203.0.113.10",
      userAgent: "Suspicious Browser",
      createdAt: "2026-07-09T09:00:00.000Z",
      updatedAt: "2026-07-09T09:30:00.000Z",
      expiresAt: "2026-07-10T09:00:00.000Z",
      isCurrent: false,
      isExpired: false
    }
  ];

  public async resolveActor(): Promise<SessionAdminActor | null> {
    return this.actor ? structuredClone(this.actor) : null;
  }

  public async listSessions(currentSessionId: string | null): Promise<readonly SessionAdminRecord[]> {
    return structuredClone(this.sessions.map((session) => ({
      ...session,
      isCurrent: session.id === currentSessionId
    })));
  }

  public async revokeSession(id: string): Promise<boolean> {
    const index = this.sessions.findIndex((session) => session.id === id);

    if (index < 0) {
      return false;
    }

    this.sessions.splice(index, 1);
    return true;
  }

  public async revokeOtherSessions(currentSessionId: string): Promise<number> {
    const before = this.sessions.length;
    const remaining = this.sessions.filter((session) => session.id === currentSessionId);
    this.sessions.splice(0, this.sessions.length, ...remaining);

    return before - this.sessions.length;
  }
}

describe("SessionAdminService", () => {
  it("lists sessions for an owner and marks the current one", async () => {
    const repository = new FakeSessionAdminRepository();
    const service = new SessionAdminService(repository);

    await expect(service.listSessions({
      authUserId: "auth-owner",
      currentSessionId: "session-current"
    })).resolves.toMatchObject({
      ok: true,
      sessions: [
        {
          id: "session-current",
          isCurrent: true
        },
        {
          id: "session-other",
          isCurrent: false
        }
      ]
    });
  });

  it("allows active delegated session admins without owner wildcard", async () => {
    const repository = new FakeSessionAdminRepository();
    repository.actor = {
      domainUserId: "domain-session-admin",
      rolePermissionValues: [JSON.stringify(["sessions:manage"])]
    };
    const service = new SessionAdminService(repository);

    await expect(service.listSessions({
      authUserId: "auth-session-admin",
      currentSessionId: "session-current"
    })).resolves.toMatchObject({
      ok: true,
      sessions: [
        {
          id: "session-current",
          isCurrent: true
        },
        {
          id: "session-other",
          isCurrent: false
        }
      ]
    });
  });

  it("denies users without session permissions", async () => {
    const repository = new FakeSessionAdminRepository();
    repository.actor = {
      domainUserId: "domain-user",
      rolePermissionValues: [["money:manage"]]
    };
    const service = new SessionAdminService(repository);

    await expect(service.listSessions({
      authUserId: "auth-owner"
    })).resolves.toEqual({
      ok: false,
      reason: "session_admin_forbidden"
    });
  });

  it("revokes sessions by id and rejects unknown sessions", async () => {
    const repository = new FakeSessionAdminRepository();
    const service = new SessionAdminService(repository);

    await expect(service.revokeSession({
      authUserId: "auth-owner",
      id: "session-other"
    })).resolves.toEqual({
      ok: true
    });
    expect(repository.sessions.map((session) => session.id)).toEqual(["session-current"]);

    await expect(service.revokeSession({
      authUserId: "auth-owner",
      id: "missing"
    })).resolves.toEqual({
      ok: false,
      reason: "session_admin_not_found"
    });
  });

  it("does not revoke dev owner token pseudo sessions", async () => {
    const repository = new FakeSessionAdminRepository();
    const service = new SessionAdminService(repository);

    await expect(service.revokeSession({
      authUserId: "auth-owner",
      id: "dev-token:temporary"
    })).resolves.toEqual({
      ok: false,
      reason: "session_admin_invalid_input"
    });
  });

  it("revokes other sessions while preserving the current session", async () => {
    const repository = new FakeSessionAdminRepository();
    const service = new SessionAdminService(repository);

    await expect(service.revokeOtherSessions({
      authUserId: "auth-owner",
      currentSessionId: "session-current"
    })).resolves.toEqual({
      ok: true,
      revokedCount: 1
    });
    expect(repository.sessions.map((session) => session.id)).toEqual(["session-current"]);
  });

  it("rejects revoke-others without a real current browser session id", async () => {
    const repository = new FakeSessionAdminRepository();
    const service = new SessionAdminService(repository);

    await expect(service.revokeOtherSessions({
      authUserId: "auth-owner",
      currentSessionId: "dev-token:temporary"
    })).resolves.toEqual({
      ok: false,
      reason: "session_admin_invalid_input"
    });
  });
});

describe("session admin mysql authorization boundary", () => {
  it("excludes revoked and expired role grants while preserving active delegated access", async () => {
    let actorSql = "";
    const repository = createSessionAdminRepository({
      execute: async (sql: string) => {
        actorSql = sql;
        return [[{
          domainUserId: "domain-session-admin",
          rolePermissions: JSON.stringify(["sessions:manage"])
        }]];
      }
    } as unknown as DatabasePool);

    const actor = await repository.resolveActor("auth-session-admin");

    expect(actor).toEqual({
      domainUserId: "domain-session-admin",
      rolePermissionValues: [JSON.stringify(["sessions:manage"])]
    });
    expect(actorSql).toContain(`LEFT JOIN user_roles ON user_roles.user_id = users.id
        AND user_roles.revoked_at IS NULL
        AND (user_roles.expires_at IS NULL OR user_roles.expires_at > NOW())`);
  });

  it("denies linked users and skips session revocation when only inactive grants remain", async () => {
    const repository = createSessionAdminRepository({
      execute: async (sql: string) => {
        if (sql.includes("FROM auth_user_links")) {
          return [[{
            domainUserId: "domain-session-admin",
            rolePermissions: null
          }]];
        }

        throw new Error("inactive grant must not revoke sessions");
      }
    } as unknown as DatabasePool);
    const service = new SessionAdminService(repository);

    await expect(service.revokeSession({
      authUserId: "auth-session-admin",
      id: "session-other"
    })).resolves.toEqual({
      ok: false,
      reason: "session_admin_forbidden"
    });
  });
});

describe("session admin API", () => {
  it("requires an auth session before listing sessions", async () => {
    const server = Fastify();
    registerSessionAdminRoutes(server, {
      getAuthSession: async () => null,
      getDatabasePool: () => {
        throw new Error("pool should not be used");
      }
    });

    const response = await server.inject({
      method: "GET",
      url: "/admin/sessions"
    });

    expect(response.statusCode).toBe(401);
    expect(response.json()).toEqual({
      ok: false,
      reason: "not_authenticated"
    });
  });

  it("lists sessions for an owner", async () => {
    const repository = new FakeSessionAdminRepository();
    const server = Fastify();
    registerSessionAdminRoutes(server, {
      getAuthSession: async () => ({
        user: {
          id: "auth-owner"
        },
        session: {
          id: "session-current",
          userId: "auth-owner"
        }
      }),
      getDatabasePool: () => {
        throw new Error("pool should not be used");
      },
      createService: () => new SessionAdminService(repository)
    });

    const response = await server.inject({
      method: "GET",
      url: "/admin/sessions"
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      ok: true,
      sessions: expect.arrayContaining([
        expect.objectContaining({
          id: "session-current",
          isCurrent: true,
          userEmail: "michael@example.test"
        })
      ])
    });
  });

  it("revokes sessions for an owner", async () => {
    const repository = new FakeSessionAdminRepository();
    const server = Fastify();
    registerSessionAdminRoutes(server, {
      getAuthSession: async () => ({
        user: {
          id: "auth-owner"
        },
        session: {
          id: "session-current",
          userId: "auth-owner"
        }
      }),
      getDatabasePool: () => {
        throw new Error("pool should not be used");
      },
      createService: () => new SessionAdminService(repository)
    });

    const response = await server.inject({
      method: "POST",
      url: "/admin/sessions/session-other/revoke"
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      ok: true
    });
    expect(repository.sessions.map((session) => session.id)).toEqual(["session-current"]);
  });

  it("revokes all other sessions for an owner with a real current session", async () => {
    const repository = new FakeSessionAdminRepository();
    const server = Fastify();
    registerSessionAdminRoutes(server, {
      getAuthSession: async () => ({
        user: {
          id: "auth-owner"
        },
        session: {
          id: "session-current",
          userId: "auth-owner"
        }
      }),
      getDatabasePool: () => {
        throw new Error("pool should not be used");
      },
      createService: () => new SessionAdminService(repository)
    });

    const response = await server.inject({
      method: "POST",
      url: "/admin/sessions/revoke-others"
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      ok: true,
      revokedCount: 1
    });
    expect(repository.sessions.map((session) => session.id)).toEqual(["session-current"]);
  });
});
