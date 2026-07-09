import type {
  SessionAdminActor,
  SessionAdminListResult,
  SessionAdminMutationResult,
  SessionAdminRepository
} from "./session-admin.types.js";

const parsePermissionArray = (value: unknown): unknown[] => {
  if (Array.isArray(value)) {
    return value;
  }

  if (typeof value !== "string") {
    return [];
  }

  try {
    const parsed = JSON.parse(value) as unknown;
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

const normalizePermissions = (actor: SessionAdminActor): string[] => {
  const permissions = new Set<string>();

  for (const rolePermissionValue of actor.rolePermissionValues) {
    for (const permission of parsePermissionArray(rolePermissionValue)) {
      if (typeof permission === "string") {
        permissions.add(permission);
      }
    }
  }

  return [...permissions];
};

const canManageSessions = (actor: SessionAdminActor): boolean =>
  normalizePermissions(actor).some((permission) =>
    permission === "*" || permission === "sessions:manage"
  );

export class SessionAdminService {
  public constructor(private readonly repository: SessionAdminRepository) {}

  public async listSessions(input: {
    authUserId: string;
    currentSessionId?: string | null;
  }): Promise<SessionAdminListResult> {
    const actor = await this.requireActor(input.authUserId);

    if (!actor.ok) {
      return actor;
    }

    return {
      ok: true,
      sessions: await this.repository.listSessions(input.currentSessionId ?? null)
    };
  }

  public async revokeSession(input: {
    authUserId: string;
    id: string;
  }): Promise<SessionAdminMutationResult> {
    const actor = await this.requireActor(input.authUserId);

    if (!actor.ok) {
      return actor;
    }

    const id = input.id.trim();

    if (id.length === 0 || id.length > 36 || id.startsWith("dev-token:")) {
      return {
        ok: false,
        reason: "session_admin_invalid_input"
      };
    }

    const revoked = await this.repository.revokeSession(id);

    return revoked
      ? { ok: true }
      : {
        ok: false,
        reason: "session_admin_not_found"
      };
  }

  private async requireActor(authUserId: string): Promise<
    | { ok: true }
    | { ok: false; reason: "session_admin_user_unlinked" | "session_admin_forbidden" }
  > {
    const actor = await this.repository.resolveActor(authUserId);

    if (!actor) {
      return {
        ok: false,
        reason: "session_admin_user_unlinked"
      };
    }

    if (!canManageSessions(actor)) {
      return {
        ok: false,
        reason: "session_admin_forbidden"
      };
    }

    return {
      ok: true
    };
  }
}
