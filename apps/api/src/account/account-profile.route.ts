import type { DatabasePool } from "@maiks-yt/database";
import { validateProfileSettings } from "@maiks-yt/domain/identity";
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { z } from "zod";

import { getApiPublicBaseUrl } from "../api-public-base-url.rules.js";
import {
  createAuthDataCipherFromEnvironment,
  decryptAuthAccountSensitiveFields,
  type AuthDataCipher
} from "../auth/auth-sensitive-field-crypto.service.js";
import { projectDomainUser } from "./account-response-projection.service.js";
import type { AuthSessionSnapshot } from "./auth-session.types.js";
import { getDomainUserForAuthUser } from "./domain-identity.service.js";
import {
  deleteProfileImage,
  processProfileImage,
  processProfileImageBytes,
  profileImageMaxInputBytes,
  readProfileImage,
  saveProfileImage
} from "./profile-image.service.js";
import {
  downloadProviderProfileImage,
  fetchProviderProfileOption,
  type ProviderProfileAccount
} from "./provider-profile-options.service.js";
import {
  createProviderProfileOptionRef,
  getProviderProfileOptionRefSecret,
  resolveProviderProfileOptionRef
} from "./provider-profile-option-ref.service.js";

const profileUpdateSchema = z.object({
  displayName: z.string()
}).strict();

const profileImageUploadSchema = z.object({
  dataBase64: z.string().min(1).max(7_000_000)
}).strict();

const profileImageParamsSchema = z.object({
  userId: z.string().uuid()
}).strict();

const publicProfileImageCacheControl = "public, max-age=60, must-revalidate";
const privateProfileImageCacheControl = "private, no-store";

const replyWithProfileImageNotFound = (reply: FastifyReply): {
  ok: false;
  reason: "profile_image_not_found";
} => {
  reply
    .code(404)
    .header("cache-control", privateProfileImageCacheControl);
  return { ok: false, reason: "profile_image_not_found" };
};

const providerProfileApplySchema = z.object({
  profileOptionRef: z.string().min(1).max(128),
  useDisplayName: z.boolean(),
  useImage: z.boolean()
}).strict().refine((value) => value.useDisplayName || value.useImage);

type AccountProfileRouteDependencies = {
  getAuthSession: (request: FastifyRequest) => Promise<AuthSessionSnapshot>;
  getDatabasePool: () => DatabasePool;
  authDataCipher?: AuthDataCipher | null;
};

const buildAvatarUrl = (userId: string): string =>
  `${getApiPublicBaseUrl()}/profiles/images/${userId}?v=${Date.now()}`;

const getAuthDataCipher = (dependencies: AccountProfileRouteDependencies): AuthDataCipher | null =>
  dependencies.authDataCipher === undefined
    ? createAuthDataCipherFromEnvironment()
    : dependencies.authDataCipher;

const decryptProviderProfileAccounts = (
  rows: unknown,
  cipher: AuthDataCipher | null
): ProviderProfileAccount[] => {
  const accounts = Array.isArray(rows) ? rows as ProviderProfileAccount[] : [];
  return accounts.map((account) => decryptAuthAccountSensitiveFields(account, cipher));
};

export const registerAccountProfileRoutes = (
  server: FastifyInstance,
  dependencies: AccountProfileRouteDependencies
): void => {
  server.get("/account/domain/provider-profile-options", async (request, reply) => {
    const session = await dependencies.getAuthSession(request);

    if (!session) {
      reply.code(401);
      return { ok: false, reason: "not_authenticated" };
    }

    try {
      const pool = dependencies.getDatabasePool();
      const secret = getProviderProfileOptionRefSecret();

      if (!secret) {
        reply.code(503);
        return { ok: false, reason: "provider_profile_unavailable" };
      }

      const [rows] = await pool.execute(
        "SELECT id, account_id AS accountId, provider_id AS providerId, access_token AS accessToken FROM auth_accounts WHERE user_id = ? ORDER BY provider_id, created_at",
        [session.user.id]
      );
      const accounts = decryptProviderProfileAccounts(rows, getAuthDataCipher(dependencies));
      const options = await Promise.all(accounts.map(async (account) => {
        const option = await fetchProviderProfileOption(account, {
          twitchClientId: process.env.TWITCH_CLIENT_ID
        });

        return option
          ? {
            ...option,
            profileOptionRef: createProviderProfileOptionRef({
              account,
              authUserId: session.user.id,
              secret
            })
          }
          : null;
      }));

      return {
        ok: true,
        options: options.filter((option) => option !== null)
      };
    } catch (error) {
      server.log.warn({ err: error }, "Provider profile options failed.");
      reply.code(503);
      return { ok: false, reason: "provider_profile_unavailable" };
    }
  });

  server.put("/account/domain/provider-profile", async (request, reply) => {
    const session = await dependencies.getAuthSession(request);

    if (!session) {
      reply.code(401);
      return { ok: false, reason: "not_authenticated" };
    }

    const parsedBody = providerProfileApplySchema.safeParse(request.body);

    if (!parsedBody.success) {
      reply.code(400);
      return { ok: false, reason: "provider_profile_invalid_input" };
    }

    try {
      const pool = dependencies.getDatabasePool();
      const [rows] = await pool.execute(
        "SELECT id, account_id AS accountId, provider_id AS providerId, access_token AS accessToken FROM auth_accounts WHERE user_id = ? ORDER BY provider_id, created_at",
        [session.user.id]
      );
      const accounts = decryptProviderProfileAccounts(rows, getAuthDataCipher(dependencies));
      const secret = getProviderProfileOptionRefSecret();
      const account = secret
        ? resolveProviderProfileOptionRef({
          accounts,
          authUserId: session.user.id,
          profileOptionRef: parsedBody.data.profileOptionRef,
          secret
        })
        : null;

      if (!account) {
        reply.code(404);
        return { ok: false, reason: "provider_profile_not_found" };
      }

      const option = await fetchProviderProfileOption(account, {
        twitchClientId: process.env.TWITCH_CLIENT_ID
      });

      if (!option) {
        reply.code(409);
        return { ok: false, reason: "provider_profile_unavailable" };
      }

      const validatedName = parsedBody.data.useDisplayName
        ? validateProfileSettings({ displayName: option.displayName })
        : null;

      if (validatedName && !validatedName.ok) {
        reply.code(409);
        return { ok: false, reason: "provider_profile_name_invalid" };
      }

      let processedImage: Buffer | null = null;

      if (parsedBody.data.useImage) {
        const downloaded = option.imageUrl
          ? await downloadProviderProfileImage(option.imageUrl, profileImageMaxInputBytes)
          : null;
        processedImage = downloaded ? await processProfileImageBytes(downloaded) : null;

        if (!processedImage) {
          reply.code(409);
          return { ok: false, reason: "provider_profile_image_unavailable" };
        }
      }

      const { user } = await getDomainUserForAuthUser(pool, session.user, true);

      if (!user) {
        throw new Error("Domain user could not be resolved.");
      }

      const displayName = validatedName?.ok ? validatedName.value.displayName : user.displayName;
      const avatarUrl = processedImage ? buildAvatarUrl(user.id) : user.avatarUrl;

      if (processedImage) {
        await saveProfileImage(user.id, processedImage);
      }

      await pool.execute(
        "UPDATE users SET display_name = ?, avatar_url = ?, updated_at = NOW() WHERE id = ? AND deleted_at IS NULL",
        [displayName, avatarUrl, user.id]
      );

      return {
        ok: true,
        domainUser: projectDomainUser({
          ...user,
          displayName,
          avatarUrl
        })
      };
    } catch (error) {
      server.log.warn({ err: error }, "Provider profile selection failed.");
      reply.code(503);
      return { ok: false, reason: "provider_profile_unavailable" };
    }
  });

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
        domainUser: projectDomainUser({
          ...user,
          displayName: validated.value.displayName
        })
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
        domainUser: projectDomainUser({
          ...user,
          avatarUrl
        })
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
        domainUser: projectDomainUser({
          ...user,
          avatarUrl: null
        })
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
      return replyWithProfileImageNotFound(reply);
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
        return replyWithProfileImageNotFound(reply);
      }

      const isPublicProfileImage = row.profileVisibility === "public"
        || row.profileVisibility === "minimal";

      if (!isPublicProfileImage) {
        if (row.profileVisibility !== "private") {
          return replyWithProfileImageNotFound(reply);
        }

        const session = await dependencies.getAuthSession(request);

        if (!session || session.user.id !== row.authUserId) {
          return replyWithProfileImageNotFound(reply);
        }
      }

      const image = await readProfileImage(parsedParams.data.userId);

      if (!image) {
        return replyWithProfileImageNotFound(reply);
      }

      reply
        .header("content-type", "image/webp")
        .header("content-length", String(image.length))
        .header("cache-control", isPublicProfileImage
          ? publicProfileImageCacheControl
          : privateProfileImageCacheControl);

      return image;
    } catch (error) {
      server.log.warn({ err: error }, "Profile image read failed.");
      reply.code(503);
      return { ok: false, reason: "profile_unavailable" };
    }
  });
};
