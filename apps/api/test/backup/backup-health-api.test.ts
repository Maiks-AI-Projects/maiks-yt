import Fastify from "fastify";
import { describe, expect, it } from "vitest";

import { registerBackupHealthRoutes } from "../../src/backup/backup-health.route.js";
import { BackupHealthService } from "../../src/backup/backup-health.service.js";
import type { BackupHealthActor, BackupHealthRepository } from "../../src/backup/backup-health.types.js";

class FakeBackupHealthRepository implements BackupHealthRepository {
  public actor: BackupHealthActor | null = {
    domainUserId: "domain-user",
    rolePermissionValues: [["*"]]
  };

  public async resolveActor(): Promise<BackupHealthActor | null> {
    return this.actor ? structuredClone(this.actor) : null;
  }
}

describe("BackupHealthService", () => {
  it("allows owner wildcard and denies normal linked users", async () => {
    const repository = new FakeBackupHealthRepository();
    const service = new BackupHealthService(repository);

    await expect(service.getHealth({ authUserId: "auth-owner" })).resolves.toMatchObject({
      ok: true,
      readOnly: true
    });

    repository.actor = {
      domainUserId: "domain-user",
      rolePermissionValues: [["notifications:manage"]]
    };

    await expect(service.getHealth({ authUserId: "auth-user" })).resolves.toEqual({
      ok: false,
      reason: "backup_health_forbidden"
    });

    repository.actor = null;

    await expect(service.getHealth({ authUserId: "auth-user" })).resolves.toEqual({
      ok: false,
      reason: "backup_health_user_unlinked"
    });
  });
});

describe("backup health route", () => {
  it("returns 401 without a session", async () => {
    const server = Fastify();

    registerBackupHealthRoutes(server, {
      getAuthSession: async () => null,
      getDatabasePool: () => {
        throw new Error("pool should not be used");
      }
    });

    const response = await server.inject({
      method: "GET",
      url: "/admin/backup/health"
    });

    expect(response.statusCode).toBe(401);
    expect(response.json()).toEqual({
      ok: false,
      reason: "not_authenticated"
    });

    await server.close();
  });

  it("returns a safe read-only owner payload", async () => {
    const server = Fastify();

    registerBackupHealthRoutes(server, {
      getAuthSession: async () => ({ user: { id: "auth-owner" } }),
      getDatabasePool: () => {
        throw new Error("pool should not be used");
      },
      createService: () => ({
        getHealth: async () => ({
          ok: true,
          readOnly: true,
          healthOk: true,
          checkedAt: "2026-07-10T00:00:00.000Z",
          skipped: false,
          warnings: ["No mysqldump or mariadb-dump command was found."],
          databaseReachable: true,
          requiredTables: [{
            name: "users",
            present: true
          }],
          backupTool: {
            available: false,
            command: null,
            version: null
          }
        })
      })
    });

    const response = await server.inject({
      method: "GET",
      url: "/admin/backup/health"
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      ok: true,
      readOnly: true,
      healthOk: true,
      checkedAt: "2026-07-10T00:00:00.000Z",
      skipped: false,
      warnings: ["No mysqldump or mariadb-dump command was found."],
      databaseReachable: true,
      requiredTables: [{
        name: "users",
        present: true
      }],
      backupTool: {
        available: false,
        command: null,
        version: null
      }
    });
    expect(JSON.stringify(response.json())).not.toContain("DATABASE_URL");

    await server.close();
  });
});
