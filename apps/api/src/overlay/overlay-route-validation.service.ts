import type { UrlAccessSurface } from "@maiks-yt/domain/security";
import { overlaySceneSlotIds } from "@maiks-yt/themes";
import type { FastifyRequest } from "fastify";
import { z } from "zod";

import type { OverlayRuntime } from "./index.js";
import type { StreamerChatModerationAction } from "../streamer-chat/index.js";

export const overlaySceneKeySchema = z.string().regex(/^[a-z0-9][a-z0-9-]{0,47}$/);
export const overlayThemeKeySchema = z.enum(["default", "satisfactory"]);
export const overlayStateRequestSchema = z.object({
  accessToken: z.string().min(24),
  scene: overlaySceneKeySchema.default("default"),
  layout: z.enum(["standard", "camera-left", "camera-right", "clean"]).default("standard"),
  theme: overlayThemeKeySchema.default("default"),
  mode: z.enum(["normal", "clean"]).default("normal")
});
export const overlayStatusRequestSchema = z.object({
  accessToken: z.string().min(24)
});
export const overlayPresentationStateRequestSchema = z.object({
  accessToken: z.string().min(24),
  scene: overlaySceneKeySchema,
  layout: z.enum(["standard", "camera-left", "camera-right", "clean"]),
  theme: overlayThemeKeySchema
});
export const overlayTopBarTestRequestSchema = z.object({
  accessToken: z.string().min(24),
  count: z.number().int().min(1).max(6).default(1)
});
export const overlayTopBarEnabledRequestSchema = z.object({
  accessToken: z.string().min(24),
  enabled: z.boolean()
});
export const overlayEmergencyCleanModeRequestSchema = z.object({
  accessToken: z.string().min(24),
  enabled: z.boolean()
});
export const overlayChatVisibilityRequestSchema = z.object({
  accessToken: z.string().min(24),
  visible: z.boolean()
});
export const overlayChatOrderRequestSchema = z.object({
  accessToken: z.string().min(24),
  newestOnTop: z.boolean()
});
export const overlayFakeChatTestRequestSchema = z.object({
  accessToken: z.string().min(24),
  authorName: z.string().trim().min(1).max(40).default("Test chatter"),
  authorKind: z.enum(["human", "bot", "system"]).default("human"),
  avatarUrl: z.url().max(2_048).refine((value) => value.startsWith("https://"), {
    message: "avatar_url_must_use_https"
  }).optional(),
  message: z.string().trim().min(1).max(280)
});
export const overlayLiveAudienceTestRequestSchema = z.object({
  accessToken: z.string().min(24),
  actorName: z.string().trim().min(1).max(40),
  actionLabel: z.string().trim().min(1).max(120),
  avatarUrl: z.url().max(2_048).refine((value) => value.startsWith("https://"), {
    message: "avatar_url_must_use_https"
  }).optional(),
  kind: z.enum(["follow", "subscription", "bits", "gifted-sub", "community-highlight"]),
  message: z.string().trim().min(1).max(280),
  platform: z.literal("twitch"),
  priority: z.enum(["normal", "important"]).default("normal")
});
export const overlaySponsorVisibilityRequestSchema = z.object({
  accessToken: z.string().min(24),
  visible: z.boolean()
});
export const overlayAiMutedRequestSchema = z.object({
  accessToken: z.string().min(24),
  muted: z.boolean()
});
export const overlayCenterSettingsRequestSchema = z.object({
  accessToken: z.string().min(24),
  enabled: z.boolean(),
  onscreenMs: z.number().int().min(1_000).max(20_000),
  fadeOutMs: z.number().int().min(100).max(5_000),
  restMs: z.number().int().min(0).max(10_000)
});
export const overlayNotificationTestRequestSchema = z.object({
  accessToken: z.string().min(24),
  route: z.enum(["top", "center"]),
  afterCenter: z.enum(["top", "none"]).default("top"),
  count: z.number().int().min(1).max(6).default(1)
});
export const overlayRedeemTestRequestSchema = z.object({
  accessToken: z.string().min(24),
  redeem: z.enum(["hydrate", "jumpscare", "mime"])
});
export const overlayGoalStateSchema = z.object({
  accessToken: z.string().min(24),
  enabled: z.boolean(),
  label: z.string().trim().min(1).max(80),
  currentAmount: z.number().min(0).max(1_000_000),
  targetAmount: z.number().positive().max(1_000_000),
  currencyCode: z.string().trim().regex(/^[A-Z]{3}$/)
}).refine((value) => value.currentAmount <= value.targetAmount, {
  message: "current_amount_cannot_exceed_target",
  path: ["currentAmount"]
});
export const overlaySceneListRequestSchema = z.object({
  accessToken: z.string().min(24)
});
export const overlaySceneSlotSchema = z.object({
  x: z.number().int().min(0).max(1920),
  y: z.number().int().min(0).max(1080),
  width: z.number().int().min(0).max(1920),
  height: z.number().int().min(0).max(1080),
  visible: z.boolean(),
  lockedAspectRatio: z.number().positive().optional()
});
export const overlaySceneSaveRequestSchema = z.object({
  accessToken: z.string().min(24),
  scene: z.object({
    themeKey: overlayThemeKeySchema,
    sceneKey: overlaySceneKeySchema,
    label: z.string().min(1).max(80),
    canvas: z.object({
      width: z.literal(1920),
      height: z.literal(1080)
    }),
    slots: z.record(z.enum(overlaySceneSlotIds), overlaySceneSlotSchema)
  })
});

type UrlAccessTokenValidation = {
  valid: boolean;
  requiresLogin: boolean;
  reason?: string;
};

type ValidateUrlAccessToken = (input: {
  scope: string;
  surface: UrlAccessSurface;
  token: string;
}) => Promise<UrlAccessTokenValidation>;

type RequireStreamerChatModerationPermission = (
  request: FastifyRequest,
  accessToken: string,
  action: StreamerChatModerationAction
) => Promise<{ ok: true } | { ok: false; reason: string; statusCode: 401 | 403 }>;

type FakeLocalModerationRuntime = {
  isAuthorMuted(authorName: string): { authorName: string; mutedUntil: string } | null;
};

export type OverlayRouteDependencies = {
  fakeLocalModerationRuntime: FakeLocalModerationRuntime;
  overlayRuntime: OverlayRuntime;
  recordFakeLocalStreamerChatMessage: (event: import("@maiks-yt/events").OverlayFakeChatMessageReceivedEvent) => import("@maiks-yt/events").StreamerChatMessage | null;
  requireStreamerChatModerationPermission: RequireStreamerChatModerationPermission;
  validateUrlAccessToken: ValidateUrlAccessToken;
};
