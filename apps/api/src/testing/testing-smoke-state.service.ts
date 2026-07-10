import { readFile } from "node:fs/promises";

import type {
  TestingSmokeStateRepository,
  TestingSmokeStateResult,
  TestingSmokeStateSnapshot
} from "./testing-smoke-state.types.js";

const DEFAULT_STATE_FILE = "/app/.private/maiks-yt-dev-smoke-state.json";

const normalizePermissions = (values: readonly unknown[]): string[] => values.flatMap((value) => {
  if (Array.isArray(value)) {
    return value.filter((entry): entry is string => typeof entry === "string");
  }

  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value) as unknown;

      if (Array.isArray(parsed)) {
        return parsed.filter((entry): entry is string => typeof entry === "string");
      }
    } catch {
      // Plain string permissions are still accepted below for test fixtures and future callers.
    }

    return [value];
  }

  return [];
});

const canViewTestingSmokeState = (permissionValues: readonly unknown[]): boolean => {
  const permissions = normalizePermissions(permissionValues);

  return permissions.includes("*") || permissions.includes("testing:read");
};

const isIsoLike = (value: unknown): value is string =>
  typeof value === "string" && !Number.isNaN(Date.parse(value));

const readState = async (stateFile: string | null): Promise<TestingSmokeStateSnapshot> => {
  if (!stateFile) {
    return {
      status: "unknown",
      stateAvailable: false,
      hadActiveFailure: null,
      lastSuccessAt: null,
      lastFailureNotifiedAt: null,
      lastFailureSignaturePresent: false
    };
  }

  try {
    const parsed = JSON.parse(await readFile(stateFile, "utf8")) as Record<string, unknown>;
    const hadActiveFailure = typeof parsed.hadActiveFailure === "boolean" ? parsed.hadActiveFailure : null;
    const lastSuccessAt = isIsoLike(parsed.lastSuccessAt) ? parsed.lastSuccessAt : null;
    const lastFailureNotifiedAt = isIsoLike(parsed.lastFailureNotifiedAt) ? parsed.lastFailureNotifiedAt : null;
    const lastFailureSignaturePresent = typeof parsed.lastFailureSignature === "string" && parsed.lastFailureSignature.length > 0;

    return {
      status: hadActiveFailure === true ? "failing" : hadActiveFailure === false ? "passing" : "unknown",
      stateAvailable: true,
      hadActiveFailure,
      lastSuccessAt,
      lastFailureNotifiedAt,
      lastFailureSignaturePresent
    };
  } catch {
    return {
      status: "unknown",
      stateAvailable: false,
      hadActiveFailure: null,
      lastSuccessAt: null,
      lastFailureNotifiedAt: null,
      lastFailureSignaturePresent: false
    };
  }
};

export class TestingSmokeStateService {
  public constructor(
    private readonly repository: TestingSmokeStateRepository,
    private readonly stateFile = process.env.DEV_SMOKE_STATE_FILE ?? DEFAULT_STATE_FILE
  ) {}

  public async getState(input: { authUserId: string }): Promise<TestingSmokeStateResult> {
    const actor = await this.repository.resolveActor(input.authUserId);

    if (!actor) {
      return {
        ok: false,
        reason: "testing_smoke_state_user_unlinked"
      };
    }

    if (!canViewTestingSmokeState(actor.rolePermissionValues)) {
      return {
        ok: false,
        reason: "testing_smoke_state_forbidden"
      };
    }

    return {
      ok: true,
      readOnly: true,
      checkedAt: new Date().toISOString(),
      stateFileConfigured: Boolean(this.stateFile),
      state: await readState(this.stateFile || null)
    };
  }
}
