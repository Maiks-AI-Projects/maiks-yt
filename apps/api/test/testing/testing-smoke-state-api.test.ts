import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";

import Fastify from "fastify";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { registerTestingSmokeStateRoutes } from "../../src/testing/testing-smoke-state.route.js";
import { TestingSmokeStateService } from "../../src/testing/testing-smoke-state.service.js";
import type {
  TestingSmokeStateActor,
  TestingSmokeStateRepository
} from "../../src/testing/testing-smoke-state.types.js";

class FakeTestingSmokeStateRepository implements TestingSmokeStateRepository {
  public actor: TestingSmokeStateActor | null = {
    domainUserId: "domain-user",
    rolePermissionValues: [["*"]]
  };

  public async resolveActor(): Promise<TestingSmokeStateActor | null> {
    return this.actor ? structuredClone(this.actor) : null;
  }
}

describe("TestingSmokeStateService", () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), "maiks-smoke-state-test-"));
  });

  afterEach(async () => {
    await rm(tempDir, { force: true, recursive: true });
  });

  it("allows owner wildcard and denies normal linked users", async () => {
    const stateFile = join(tempDir, "state.json");
    await writeFile(stateFile, JSON.stringify({
      hadActiveFailure: false,
      lastSuccessAt: "2026-07-10T04:08:36.529Z"
    }), "utf8");
    const repository = new FakeTestingSmokeStateRepository();
    const service = new TestingSmokeStateService(repository, stateFile);

    await expect(service.getState({ authUserId: "auth-owner" })).resolves.toMatchObject({
      ok: true,
      readOnly: true,
      stateFileConfigured: true,
      state: {
        status: "passing",
        stateAvailable: true,
        hadActiveFailure: false,
        lastSuccessAt: "2026-07-10T04:08:36.529Z",
        lastFailureNotifiedAt: null,
        lastFailureSignaturePresent: false
      }
    });

    repository.actor = {
      domainUserId: "domain-user",
      rolePermissionValues: [["notifications:manage"]]
    };

    await expect(service.getState({ authUserId: "auth-user" })).resolves.toEqual({
      ok: false,
      reason: "testing_smoke_state_forbidden"
    });

    repository.actor = null;

    await expect(service.getState({ authUserId: "auth-user" })).resolves.toEqual({
      ok: false,
      reason: "testing_smoke_state_user_unlinked"
    });
  });

  it("returns unknown without leaking file details when state is missing or malformed", async () => {
    const repository = new FakeTestingSmokeStateRepository();
    const service = new TestingSmokeStateService(repository, join(tempDir, "missing", "state.json"));

    const missing = await service.getState({ authUserId: "auth-owner" });
    expect(missing).toMatchObject({
      ok: true,
      state: {
        status: "unknown",
        stateAvailable: false,
        lastFailureSignaturePresent: false
      }
    });
    expect(JSON.stringify(missing)).not.toContain(tempDir);

    const malformedStateFile = join(tempDir, "malformed.json");
    await writeFile(malformedStateFile, "{nope", "utf8");
    const malformed = await new TestingSmokeStateService(repository, malformedStateFile)
      .getState({ authUserId: "auth-owner" });

    expect(malformed).toMatchObject({
      ok: true,
      state: {
        status: "unknown",
        stateAvailable: false
      }
    });
    expect(JSON.stringify(malformed)).not.toContain("{nope");
  });

  it("marks active failures without returning the failure signature", async () => {
    const stateFile = join(tempDir, "state.json");
    await writeFile(stateFile, JSON.stringify({
      hadActiveFailure: true,
      lastFailureNotifiedAt: "2026-07-10T04:10:00.000Z",
      lastFailureSignature: "super-long-signature"
    }), "utf8");
    const service = new TestingSmokeStateService(new FakeTestingSmokeStateRepository(), stateFile);

    const result = await service.getState({ authUserId: "auth-owner" });

    expect(result).toMatchObject({
      ok: true,
      state: {
        status: "failing",
        stateAvailable: true,
        hadActiveFailure: true,
        lastFailureNotifiedAt: "2026-07-10T04:10:00.000Z",
        lastFailureSignaturePresent: true
      }
    });
    expect(JSON.stringify(result)).not.toContain("super-long-signature");
  });
});

describe("testing smoke state route", () => {
  it("returns 401 without a session", async () => {
    const server = Fastify();

    registerTestingSmokeStateRoutes(server, {
      getAuthSession: async () => null,
      getDatabasePool: () => {
        throw new Error("pool should not be used");
      }
    });

    const response = await server.inject({
      method: "GET",
      url: "/admin/testing/smoke-state"
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

    registerTestingSmokeStateRoutes(server, {
      getAuthSession: async () => ({ user: { id: "auth-owner" } }),
      getDatabasePool: () => {
        throw new Error("pool should not be used");
      },
      createService: () => ({
        getState: async () => ({
          ok: true,
          readOnly: true,
          checkedAt: "2026-07-10T04:12:00.000Z",
          stateFileConfigured: true,
          state: {
            status: "passing",
            stateAvailable: true,
            hadActiveFailure: false,
            lastSuccessAt: "2026-07-10T04:08:36.529Z",
            lastFailureNotifiedAt: null,
            lastFailureSignaturePresent: false
          }
        })
      })
    });

    const response = await server.inject({
      method: "GET",
      url: "/admin/testing/smoke-state"
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      ok: true,
      readOnly: true,
      checkedAt: "2026-07-10T04:12:00.000Z",
      stateFileConfigured: true,
      state: {
        status: "passing",
        stateAvailable: true,
        hadActiveFailure: false,
        lastSuccessAt: "2026-07-10T04:08:36.529Z",
        lastFailureNotifiedAt: null,
        lastFailureSignaturePresent: false
      }
    });
    expect(JSON.stringify(response.json())).not.toContain("super-long-signature");

    await server.close();
  });
});
