import { randomUUID } from "node:crypto";

import type { DatabasePool } from "@maiks-yt/database";
import Fastify from "fastify";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  deleteProfileImage,
  registerAccountProfileRoutes,
  saveProfileImage,
  type AuthSessionSnapshot
} from "../../src/account/index.js";

const { readProfileImage } = vi.hoisted(() => ({
  readProfileImage: vi.fn()
}));

vi.mock("../../src/account/profile-image.service.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../src/account/profile-image.service.js")>();
  readProfileImage.mockImplementation(actual.readProfileImage);
  return { ...actual, readProfileImage };
});

const publicProfileImageCacheControl = "public, max-age=60, must-revalidate";
const privateProfileImageCacheControl = "private, no-store";
const avatarBytes = Buffer.from("managed-profile-avatar-webp-bytes");

const servers: ReturnType<typeof Fastify>[] = [];
const storedUserIds = new Set<string>();

afterEach(async () => {
  await Promise.all([
    ...servers.splice(0).map((server) => server.close()),
    ...Array.from(storedUserIds).map(async (userId) => {
      await deleteProfileImage(userId);
    })
  ]);
  storedUserIds.clear();
  readProfileImage.mockClear();
  vi.restoreAllMocks();
});

const ownerSession: NonNullable<AuthSessionSnapshot> = {
  user: {
    id: "auth-owner",
    email: "owner@example.test"
  },
  session: {
    id: "session-owner",
    userId: "auth-owner"
  }
};

const createProfileAvatarServer = ({
  authUserId = "auth-owner",
  profileVisibility,
  session = null
}: {
  authUserId?: string | null;
  profileVisibility: unknown;
  session?: AuthSessionSnapshot;
}) => {
  const userId = randomUUID();
  const execute = vi.fn(async () => [[{
    authUserId,
    profileVisibility
  }]]);
  const getAuthSession = vi.fn(async () => session);
  const server = Fastify({ logger: false });

  registerAccountProfileRoutes(server, {
    getAuthSession,
    getDatabasePool: () => ({
      execute
    }) as unknown as DatabasePool
  });
  servers.push(server);

  return {
    execute,
    getAuthSession,
    server,
    userId
  };
};

const storeManagedAvatar = async (userId: string): Promise<void> => {
  await saveProfileImage(userId, avatarBytes);
  storedUserIds.add(userId);
};

describe("managed profile avatar route", () => {
  it.each(["public", "minimal"])(
    "uses a bounded public cache for %s avatars so later privacy changes are rechecked promptly",
    async (profileVisibility) => {
      const { getAuthSession, server, userId } = createProfileAvatarServer({
        profileVisibility
      });
      await storeManagedAvatar(userId);

      const response = await server.inject({
        method: "GET",
        url: `/profiles/images/${userId}`
      });

      expect(response.statusCode).toBe(200);
      expect(response.headers["cache-control"]).toBe(publicProfileImageCacheControl);
      expect(response.headers["cache-control"]).not.toContain("immutable");
      expect(response.headers["cache-control"]).not.toContain("31536000");
      expect(getAuthSession).not.toHaveBeenCalled();
    }
  );

  it("denies unauthenticated private avatar reads with a private no-store not-found response", async () => {
    const { getAuthSession, server, userId } = createProfileAvatarServer({
      profileVisibility: "private"
    });
    await storeManagedAvatar(userId);

    const response = await server.inject({
      method: "GET",
      url: `/profiles/images/${userId}`
    });

    expect(response.statusCode).toBe(404);
    expect(response.headers["cache-control"]).toBe(privateProfileImageCacheControl);
    expect(response.json()).toEqual({
      ok: false,
      reason: "profile_image_not_found"
    });
    expect(response.body).not.toContain(avatarBytes.toString("utf8"));
    expect(getAuthSession).toHaveBeenCalledTimes(1);
  });

  it("denies authenticated non-owner private avatar reads with the same private no-store response", async () => {
    const { getAuthSession, server, userId } = createProfileAvatarServer({
      profileVisibility: "private",
      session: {
        user: {
          id: "auth-other-user",
          email: "other@example.test"
        },
        session: {
          id: "session-other-user",
          userId: "auth-other-user"
        }
      }
    });
    await storeManagedAvatar(userId);

    const response = await server.inject({
      method: "GET",
      url: `/profiles/images/${userId}`
    });

    expect(response.statusCode).toBe(404);
    expect(response.headers["cache-control"]).toBe(privateProfileImageCacheControl);
    expect(response.json()).toEqual({
      ok: false,
      reason: "profile_image_not_found"
    });
    expect(response.body).not.toContain(avatarBytes.toString("utf8"));
    expect(getAuthSession).toHaveBeenCalledTimes(1);
  });

  it.each(["friends", "", null, 1])(
    "fails closed before authentication or image access for malformed visibility %j",
    async (profileVisibility) => {
      const { getAuthSession, server, userId } = createProfileAvatarServer({
        profileVisibility,
        session: ownerSession
      });
      await storeManagedAvatar(userId);

      const response = await server.inject({
        method: "GET",
        url: `/profiles/images/${userId}`
      });

      expect(response.statusCode).toBe(404);
      expect(response.headers["cache-control"]).toBe(privateProfileImageCacheControl);
      expect(response.json()).toEqual({
        ok: false,
        reason: "profile_image_not_found"
      });
      expect(response.body).not.toContain(avatarBytes.toString("utf8"));
      expect(getAuthSession).not.toHaveBeenCalled();
      expect(readProfileImage).not.toHaveBeenCalled();
    }
  );

  it("keeps owner access to private avatars on a private no-store cache policy", async () => {
    const { server, userId } = createProfileAvatarServer({
      profileVisibility: "private",
      session: ownerSession
    });
    await storeManagedAvatar(userId);

    const response = await server.inject({
      method: "GET",
      url: `/profiles/images/${userId}`
    });

    expect(response.statusCode).toBe(200);
    expect(response.headers["cache-control"]).toBe(privateProfileImageCacheControl);
    expect(response.headers["cache-control"]).not.toContain("public");
    expect(response.body).toBe(avatarBytes.toString("utf8"));
  });

  it("preserves existing managed-avatar content headers and bytes", async () => {
    const { server, userId } = createProfileAvatarServer({
      profileVisibility: "public"
    });
    await storeManagedAvatar(userId);

    const response = await server.inject({
      method: "GET",
      url: `/profiles/images/${userId}`
    });

    expect(response.statusCode).toBe(200);
    expect(response.headers["content-type"]).toBe("image/webp");
    expect(response.headers["content-length"]).toBe(String(avatarBytes.length));
    expect(response.body).toBe(avatarBytes.toString("utf8"));
  });
});
