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
    },
    {
      id: "session-admin-current",
      authUserId: "auth-session-admin",
      userName: "Helper",
      userEmail: "helper@example.test",
      ipAddress: "198.51.100.8",
      userAgent: "Delegated Browser",
      createdAt: "2026-07-09T08:00:00.000Z",
      updatedAt: "2026-07-09T08:30:00.000Z",
      expiresAt: "2026-07-10T08:00:00.000Z",
      isCurrent: false,
      isExpired: false
    },
    {
      id: "session-admin-other",
      authUserId: "auth-session-admin",
      userName: "Helper",
      userEmail: "helper@example.test",
      ipAddress: "198.51.100.9",
      userAgent: "Delegated Phone",
      createdAt: "2026-07-09T07:00:00.000Z",
      updatedAt: "2026-07-09T07:30:00.000Z",
      expiresAt: "2026-07-10T07:00:00.000Z",
      isCurrent: false,
      isExpired: false
    }
  ];

  public async resolveActor(): Promise<SessionAdminActor | null> {
    return this.actor ? structuredClone(this.actor) : null;
  }

  public async listSessions(
    authUserId: string,
    currentSessionId: string | null
  ): Promise<readonly SessionAdminRecord[]> {
    return structuredClone(this.sessions
      .filter((session) => session.authUserId === authUserId)
      .map((session) => ({
        ...session,
        isCurrent: session.id === currentSessionId
      })));
  }

  public async revokeSession(authUserId: string, id: string): Promise<boolean> {
    const index = this.sessions.findIndex((session) =>
      session.authUserId === authUserId && session.id === id
    );

    if (index < 0) {
      return false;
    }

    this.sessions.splice(index, 1);
    return true;
  }

  public async revokeOtherSessions(authUserId: string, currentSessionId: string): Promise<number> {
    const currentSession = this.sessions.find((session) =>
      session.authUserId === authUserId && session.id === currentSessionId
    );

    if (!currentSession) {
      return 0;
    }

    const before = this.sessions.length;
    const remaining = this.sessions.filter((session) =>
      session.authUserId !== authUserId || session.id === currentSessionId
    );
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
    const result = await service.listSessions({
      authUserId: "auth-owner",
      currentSessionId: "session-current"
    });

    expect(result.ok ? result.sessions.map((session) => session.id) : []).toEqual([
      "session-current",
      "session-other"
    ]);
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
      currentSessionId: "session-admin-current"
    })).resolves.toMatchObject({
      ok: true,
      sessions: [
        {
          id: "session-admin-current",
          isCurrent: true
        },
        {
          id: "session-admin-other",
          isCurrent: false
        }
      ]
    });
  });

  it("does not let a delegated session admin enumerate another auth account", async () => {
    const repository = new FakeSessionAdminRepository();
    repository.actor = {
      domainUserId: "domain-session-admin",
      rolePermissionValues: [JSON.stringify(["sessions:manage"])]
    };
    const service = new SessionAdminService(repository);

    const result = await service.listSessions({
      authUserId: "auth-session-admin",
      currentSessionId: "session-admin-current"
    });

    expect(result.ok ? result.sessions.map((session) => session.authUserId) : []).toEqual([
      "auth-session-admin",
      "auth-session-admin"
    ]);
    expect(result.ok ? result.sessions.map((session) => session.id) : []).not.toContain("session-other");
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
    expect(repository.sessions.map((session) => session.id)).toEqual([
      "session-current",
      "session-admin-current",
      "session-admin-other"
    ]);

    await expect(service.revokeSession({
      authUserId: "auth-owner",
      id: "missing"
    })).resolves.toEqual({
      ok: false,
      reason: "session_admin_not_found"
    });
  });

  it("does not let a delegated session admin revoke another auth account session", async () => {
    const repository = new FakeSessionAdminRepository();
    repository.actor = {
      domainUserId: "domain-session-admin",
      rolePermissionValues: [JSON.stringify(["sessions:manage"])]
    };
    const service = new SessionAdminService(repository);

    await expect(service.revokeSession({
      authUserId: "auth-session-admin",
      id: "session-other"
    })).resolves.toEqual({
      ok: false,
      reason: "session_admin_not_found"
    });
    expect(repository.sessions.map((session) => session.id)).toContain("session-other");
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
    expect(repository.sessions.map((session) => session.id)).toEqual([
      "session-current",
      "session-admin-current",
      "session-admin-other"
    ]);
  });

  it("revokes only same-account other sessions for delegated session admins", async () => {
    const repository = new FakeSessionAdminRepository();
    repository.actor = {
      domainUserId: "domain-session-admin",
      rolePermissionValues: [JSON.stringify(["sessions:manage"])]
    };
    const service = new SessionAdminService(repository);

    await expect(service.revokeOtherSessions({
      authUserId: "auth-session-admin",
      currentSessionId: "session-admin-current"
    })).resolves.toEqual({
      ok: true,
      revokedCount: 1
    });
    expect(repository.sessions.map((session) => session.id)).toEqual([
      "session-current",
      "session-other",
      "session-admin-current"
    ]);
  });

  it("does not revoke same-account sessions when the current session belongs to another auth account", async () => {
    const repository = new FakeSessionAdminRepository();
    const service = new SessionAdminService(repository);

    await expect(service.revokeOtherSessions({
      authUserId: "auth-owner",
      currentSessionId: "session-admin-current"
    })).resolves.toEqual({
      ok: true,
      revokedCount: 0
    });
    expect(repository.sessions.map((session) => session.id)).toEqual([
      "session-current",
      "session-other",
      "session-admin-current",
      "session-admin-other"
    ]);
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

  it("filters listed Better Auth sessions by authenticated auth user", async () => {
    let listSql = "";
    let listParams: readonly unknown[] = [];
    const repository = createSessionAdminRepository({
      execute: async (sql: string, params?: readonly unknown[]) => {
        listSql = sql;
        listParams = params ?? [];
        return [[{
          id: "session-current",
          authUserId: "auth-owner",
          userName: "Michael",
          userEmail: "michael@example.test",
          ipAddress: "127.0.0.1",
          userAgent: "Vitest Browser",
          createdAt: "2026-07-09T10:00:00.000Z",
          updatedAt: "2026-07-09T11:00:00.000Z",
          expiresAt: "2026-07-10T10:00:00.000Z"
        }]];
      }
    } as unknown as DatabasePool);

    const sessions = await repository.listSessions("auth-owner", "session-current");

    expect(listSql).toContain("WHERE auth_sessions.user_id = ?");
    expect(listParams).toEqual(["auth-owner"]);
    expect(sessions.map((session) => session.id)).toEqual(["session-current"]);
  });

  it("deletes selected Better Auth sessions only for the authenticated auth user", async () => {
    let revokeSql = "";
    let revokeParams: readonly unknown[] = [];
    const repository = createSessionAdminRepository({
      execute: async (sql: string, params?: readonly unknown[]) => {
        revokeSql = sql;
        revokeParams = params ?? [];
        return [{ affectedRows: 1 }];
      }
    } as unknown as DatabasePool);

    await expect(repository.revokeSession("auth-owner", "session-other")).resolves.toBe(true);

    expect(revokeSql).toContain("DELETE FROM auth_sessions WHERE user_id = ? AND id = ?");
    expect(revokeParams).toEqual(["auth-owner", "session-other"]);
  });

  it("deletes other Better Auth sessions only after proving the current session is in the same auth account", async () => {
    let revokeOthersSql = "";
    let revokeOthersParams: readonly unknown[] = [];
    const repository = createSessionAdminRepository({
      execute: async (sql: string, params?: readonly unknown[]) => {
        revokeOthersSql = sql;
        revokeOthersParams = params ?? [];
        return [{ affectedRows: 2 }];
      }
    } as unknown as DatabasePool);

    await expect(repository.revokeOtherSessions("auth-owner", "session-current")).resolves.toBe(2);

    expect(revokeOthersSql).toContain("DELETE session_to_revoke");
    expect(revokeOthersSql).toContain("INNER JOIN auth_sessions AS current_session");
    expect(revokeOthersSql).toContain("current_session.user_id = ?");
    expect(revokeOthersSql).toContain("session_to_revoke.user_id = ?");
    expect(revokeOthersSql).toContain("session_to_revoke.id <> ?");
    expect(revokeOthersParams).toEqual([
      "auth-owner",
      "session-current",
      "auth-owner",
      "session-current"
    ]);
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
    expect(response.json().sessions.map((session: SessionAdminRecord) => session.id)).toEqual([
      "session-current",
      "session-other"
    ]);
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
    expect(repository.sessions.map((session) => session.id)).toEqual([
      "session-current",
      "session-admin-current",
      "session-admin-other"
    ]);
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
    expect(repository.sessions.map((session) => session.id)).toEqual([
      "session-current",
      "session-admin-current",
      "session-admin-other"
    ]);
  });

  it("does not let a delegated session admin list or revoke another auth account over HTTP", async () => {
    const repository = new FakeSessionAdminRepository();
    repository.actor = {
      domainUserId: "domain-session-admin",
      rolePermissionValues: [JSON.stringify(["sessions:manage"])]
    };
    const server = Fastify();
    registerSessionAdminRoutes(server, {
      getAuthSession: async () => ({
        user: {
          id: "auth-session-admin"
        },
        session: {
          id: "session-admin-current",
          userId: "auth-session-admin"
        }
      }),
      getDatabasePool: () => {
        throw new Error("pool should not be used");
      },
      createService: () => new SessionAdminService(repository)
    });

    const listResponse = await server.inject({
      method: "GET",
      url: "/admin/sessions"
    });

    expect(listResponse.statusCode).toBe(200);
    expect(listResponse.json().sessions.map((session: SessionAdminRecord) => session.id)).toEqual([
      "session-admin-current",
      "session-admin-other"
    ]);

    const revokeResponse = await server.inject({
      method: "POST",
      url: "/admin/sessions/session-other/revoke"
    });

    expect(revokeResponse.statusCode).toBe(404);
    expect(revokeResponse.json()).toEqual({
      ok: false,
      reason: "session_admin_not_found"
    });
    expect(repository.sessions.map((session) => session.id)).toContain("session-other");
  });
});
