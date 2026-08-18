import { canControlMusicPlayback, canManageMusic } from "@maiks-yt/domain/music";

import type { MusicRepository } from "./music.types.js";

const parsePermissionArray = (value: unknown): readonly unknown[] => {
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

export const normalizeMusicPermissions = (
  rolePermissionValues: readonly unknown[]
): string[] => {
  const permissions = new Set<string>();

  for (const rolePermissionValue of rolePermissionValues) {
    for (const permission of parsePermissionArray(rolePermissionValue)) {
      if (typeof permission === "string") {
        permissions.add(permission);
      }
    }
  }

  return [...permissions];
};


export const requireMusicManageActor = async (
  repository: Pick<MusicRepository, "resolveActor">,
  authUserId: string
) => {
  const actor = await repository.resolveActor(authUserId);

  if (!actor) {
    return {
      ok: false as const,
      reason: "music_admin_user_unlinked" as const
    };
  }

  if (!canManageMusic(normalizeMusicPermissions(actor.rolePermissionValues))) {
    return {
      ok: false as const,
      reason: "music_admin_forbidden" as const
    };
  }

  return {
    ok: true as const,
    domainUserId: actor.domainUserId
  };
};

export const requireMusicPlayControlActor = async (repository: MusicRepository, authUserId: string) => {
  const actor = await repository.resolveActor(authUserId);

  if (!actor) {
    return {
      ok: false as const,
      reason: "music_play_control_user_unlinked" as const
    };
  }

  if (!canControlMusicPlayback(normalizeMusicPermissions(actor.rolePermissionValues))) {
    return {
      ok: false as const,
      reason: "music_play_control_forbidden" as const
    };
  }

  return {
    ok: true as const,
    domainUserId: actor.domainUserId
  };
};
