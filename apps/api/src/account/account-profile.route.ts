import type { DatabasePool } from "@maiks-yt/database";
import { validateProfileSettings } from "@maiks-yt/domain/identity";
import type { FastifyInstance, FastifyRequest } from "fastify";
import { z } from "zod";

import type { AuthSessionSnapshot } from "./auth-session.types.js";
import { getDomainUserForAuthUser } from "./domain-identity.service.js";
import {
  deleteProfileImage,
  processProfileImage,
  readProfileImage,
  saveProfileImage
} from "./profile-image.service.js";

const profileUpdateSchema = z.object({
  displayName: z.string()
}).strict();

const profileImageUploadSchema = z.object({
  dataBase64: z.string().min(1).max(7_000_000)
}).strict();

const profileImageParamsSchema = z.object({
  userId: z.string().uuid()
}).strict();

type AccountProfileRouteDependencies = {
  getAuthSession: (request: FastifyRequest) => Promise<AuthSessionSnapshot>;
  getDatabasePool: () => DatabasePool;
};

const getPublicApiBaseUrl = (): string =>
  (process.env.API_PUBLIC_BASE_URL ?? "http://localhost:3001").replace(/\/$/u, "");

const buildAvatarUrl = (userId: string): string =>
  `${getPublicApiBaseUrl()}/profiles/images/${userId}?v=${Date.now()}`;

export const registerAccountProfileRoutes = (
  server: FastifyInstance,
  dependencies: AccountProfileRouteDependencies
): void => {
  server.put("/account/domain/profile", async (request, reply) => {
    const session = await dependencies.getAuthSession(request);

    if (!session) {
      reply.code(401);
      return { ok: false, reason: "not_authenticated" };
    }

    const parsedBody = profileUpdateSchema.safeParse(request.body);
    const validated = parsedBody.success
      ? validateProfileSettings(parsedBody.data)
      : { ok: false as const, reason: "invalid_display_name" as const };

    if (!validated.ok) {
      reply.code(400);
      return { ok: false, reason: "profile_invalid_input" };
    }

    try {
      const pool = dependencies.getDatabasePool();
      const { user } = await getDomainUserForAuthUser(pool, session.user, true);

      if (!user) {
        throw new Error("Domain user could not be resolved.");
      }

      await pool.execute(
        "UPDATE users SET display_name = ?, updated_at = NOW() WHERE id = ? AND deleted_at IS NULL",
        [validated.value.displayName, user.id]
      );

      return {
        ok: true,
        domainUser: {
          ...user,
          displayName: validated.value.displayName
        }
      };
    } catch (error) {
      server.log.warn({ err: error }, "Account profile update failed.");
      reply.code(503);
      return { ok: false, reason: "profile_unavailable" };
    }
  });

  server.put("/account/domain/profile-image", {
    bodyLimit: 7_000_000
  }, async (request, reply) => {
    const session = await dependencies.getAuthSession(request);

    if (!session) {
      reply.code(401);
      return { ok: false, reason: "not_authenticated" };
    }

    const parsedBody = profileImageUploadSchema.safeParse(request.body);
    const image = parsedBody.success ? await processProfileImage(parsedBody.data.dataBase64) : null;

    if (!image) {
      reply.code(400);
      return { ok: false, reason: "profile_image_invalid_input" };
    }

    try {
      const pool = dependencies.getDatabasePool();
      const { user } = await getDomainUserForAuthUser(pool, session.user, true);

      if (!user) {
        throw new Error("Domain user could not be resolved.");
      }

      await saveProfileImage(user.id, image);
      const avatarUrl = buildAvatarUrl(user.id);
      await pool.execute(
        "UPDATE users SET avatar_url = ?, updated_at = NOW() WHERE id = ? AND deleted_at IS NULL",
        [avatarUrl, user.id]
      );

      return {
        ok: true,
        domainUser: {
          ...user,
          avatarUrl
        }
      };
    } catch (error) {
      server.log.warn({ err: error }, "Account profile image upload failed.");
      reply.code(503);
      return { ok: false, reason: "profile_unavailable" };
    }
  });

  server.delete("/account/domain/profile-image", async (request, reply) => {
    const session = await dependencies.getAuthSession(request);

    if (!session) {
      reply.code(401);
      return { ok: false, reason: "not_authenticated" };
    }

    try {
      const pool = dependencies.getDatabasePool();
      const { user } = await getDomainUserForAuthUser(pool, session.user, false);

      if (!user) {
        reply.code(404);
        return { ok: false, reason: "profile_image_not_found" };
      }

      await deleteProfileImage(user.id);
      await pool.execute(
        "UPDATE users SET avatar_url = NULL, updated_at = NOW() WHERE id = ? AND deleted_at IS NULL",
        [user.id]
      );

      return {
        ok: true,
        domainUser: {
          ...user,
          avatarUrl: null
        }
      };
    } catch (error) {
      server.log.warn({ err: error }, "Account profile image removal failed.");
      reply.code(503);
      return { ok: false, reason: "profile_unavailable" };
    }
  });

  server.get<{ Params: { userId: string } }>("/profiles/images/:userId", async (request, reply) => {
    const parsedParams = profileImageParamsSchema.safeParse(request.params);

    if (!parsedParams.success) {
      reply.code(404);
      return { ok: false, reason: "profile_image_not_found" };
    }

    try {
      const pool = dependencies.getDatabasePool();
      const [rows] = await pool.execute(
        "SELECT users.profile_visibility AS profileVisibility, auth_user_links.auth_user_id AS authUserId FROM users LEFT JOIN auth_user_links ON auth_user_links.user_id = users.id WHERE users.id = ? AND users.deleted_at IS NULL LIMIT 1",
        [parsedParams.data.userId]
      );
      const row = Array.isArray(rows)
        ? rows[0] as { profileVisibility: string; authUserId?: string | null } | undefined
        : undefined;

      if (!row) {
        reply.code(404);
        return { ok: false, reason: "profile_image_not_found" };
      }

      if (row.profileVisibility === "private") {
        const session = await dependencies.getAuthSession(request);

        if (!session || session.user.id !== row.authUserId) {
          reply.code(404);
          return { ok: false, reason: "profile_image_not_found" };
        }
      }

      const image = await readProfileImage(parsedParams.data.userId);

      if (!image) {
        reply.code(404);
        return { ok: false, reason: "profile_image_not_found" };
      }

      reply
        .header("content-type", "image/webp")
        .header("content-length", String(image.length))
        .header("cache-control", row.profileVisibility === "private"
          ? "private, no-store"
          : "public, max-age=31536000, immutable");

      return image;
    } catch (error) {
      server.log.warn({ err: error }, "Profile image read failed.");
      reply.code(503);
      return { ok: false, reason: "profile_unavailable" };
    }
  });
};
