import Fastify from "fastify";
import { describe, expect, it } from "vitest";

import { registerBackupHealthRoutes } from "../../src/backup/backup-health.route.js";
import { BackupHealthService } from "../../src/backup/backup-health.service.js";
import type { BackupHealthActor, BackupHealthRepository } from "../../src/backup/backup-health.types.js";
import { registerBackupKeyDataExportRoutes } from "../../src/backup/backup-key-data-export.route.js";
import { BackupKeyDataExportService } from "../../src/backup/backup-key-data-export.service.js";
import type {
  BackupKeyDataExportActor,
  BackupKeyDataExportRepository,
  BackupKeyDataExportSection
} from "../../src/backup/backup-key-data-export.types.js";

class FakeBackupHealthRepository implements BackupHealthRepository {
  public actor: BackupHealthActor | null = {
    domainUserId: "domain-user",
    rolePermissionValues: [["*"]]
  };

  public async resolveActor(): Promise<BackupHealthActor | null> {
    return this.actor ? structuredClone(this.actor) : null;
  }
}

class FakeBackupKeyDataExportRepository implements BackupKeyDataExportRepository {
  public actor: BackupKeyDataExportActor | null = {
    domainUserId: "domain-user",
    rolePermissionValues: [["*"]]
  };

  public sections: BackupKeyDataExportSection[] = [
    {
      name: "content_pages",
      rowCount: 1,
      truncated: false,
      rows: [{
        id: "page-1",
        normalized_path: "/about",
        body: "Hello"
      }]
    },
    {
      name: "provider_channel_identities",
      rowCount: 1,
      truncated: false,
      rows: [{
        id: "channel-1",
        provider: "youtube",
        display_name: "Maiks"
      }]
    }
  ];

  public rowLimitRequested: number | null = null;

  public async resolveActor(): Promise<BackupKeyDataExportActor | null> {
    return this.actor ? structuredClone(this.actor) : null;
  }

  public async buildExport(rowLimitPerSection: number): Promise<BackupKeyDataExportSection[]> {
    this.rowLimitRequested = rowLimitPerSection;
    return structuredClone(this.sections);
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

describe("BackupKeyDataExportService", () => {
  it("allows owner wildcard and denies normal linked users", async () => {
    const repository = new FakeBackupKeyDataExportRepository();
    const service = new BackupKeyDataExportService(repository, 25);

    await expect(service.buildExport({ authUserId: "auth-owner" })).resolves.toMatchObject({
      ok: true,
      readOnly: true,
      formatVersion: 1,
      generatedByUserId: "domain-user",
      rowLimitPerSection: 25
    });
    expect(repository.rowLimitRequested).toBe(25);

    repository.actor = {
      domainUserId: "domain-user",
      rolePermissionValues: [["notifications:manage"]]
    };

    await expect(service.buildExport({ authUserId: "auth-user" })).resolves.toEqual({
      ok: false,
      reason: "backup_key_data_export_forbidden"
    });

    repository.actor = null;

    await expect(service.buildExport({ authUserId: "auth-user" })).resolves.toEqual({
      ok: false,
      reason: "backup_key_data_export_user_unlinked"
    });
  });
});

describe("backup key-data export route", () => {
  it("returns 401 without a session", async () => {
    const server = Fastify();

    registerBackupKeyDataExportRoutes(server, {
      getAuthSession: async () => null,
      getDatabasePool: () => {
        throw new Error("pool should not be used");
      }
    });

    const response = await server.inject({
      method: "GET",
      url: "/admin/backup/key-data-export"
    });

    expect(response.statusCode).toBe(401);
    expect(response.json()).toEqual({
      ok: false,
      reason: "not_authenticated"
    });

    await server.close();
  });

  it("returns a safe attachment-style JSON export for owners", async () => {
    const server = Fastify();
    const generatedAt = "2026-07-10T00:00:00.000Z";

    registerBackupKeyDataExportRoutes(server, {
      getAuthSession: async () => ({ user: { id: "auth-owner" } }),
      getDatabasePool: () => {
        throw new Error("pool should not be used");
      },
      createService: () => ({
        buildExport: async () => ({
          ok: true,
          readOnly: true,
          formatVersion: 1,
          generatedAt,
          generatedByUserId: "domain-user",
          rowLimitPerSection: 1000,
          sections: [{
            name: "content_pages",
            rowCount: 1,
            truncated: false,
            rows: [{
              id: "page-1",
              normalized_path: "/about"
            }]
          }],
          exclusions: [
            "Raw auth sessions, auth accounts, dev auth tokens, URL token hashes, and provider runtime credentials."
          ]
        })
      })
    });

    const response = await server.inject({
      method: "GET",
      url: "/admin/backup/key-data-export"
    });

    expect(response.statusCode).toBe(200);
    expect(response.headers["content-type"]).toContain("application/json");
    expect(response.headers["content-disposition"]).toBe("attachment; filename=\"maiks-yt-key-data-export-2026-07-10.json\"");
    expect(response.headers["x-maiks-key-data-export-sections"]).toBe("1");

    const parsed = JSON.parse(response.body) as {
      ok: boolean;
      sections: Array<{ name: string }>;
      exclusions: string[];
    };
    expect(parsed.ok).toBe(true);
    expect(parsed.sections).toEqual([{ name: "content_pages", rowCount: 1, truncated: false, rows: [{ id: "page-1", normalized_path: "/about" }] }]);
    expect(JSON.stringify(parsed)).not.toContain("token_hash");
    expect(JSON.stringify(parsed)).not.toContain("access_token");
    expect(JSON.stringify(parsed)).not.toContain("refresh_token");

    await server.close();
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
