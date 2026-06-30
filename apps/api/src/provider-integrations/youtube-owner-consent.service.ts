import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";

import {
  createYouTubeOwnerConsentUrl,
  exchangeYouTubeOwnerCode,
  resolveYouTubeOwnerOAuthConfig,
  youtubeLiveChatReadOnlyScope
} from "@maiks-yt/integrations";

import { normalizeProviderIntegrationPermissions } from "./provider-integration-status.service.js";
import type {
  YouTubeOwnerConsentExchangeCode,
  YouTubeOwnerConsentRepository,
  YouTubeOwnerConsentResult
} from "./youtube-owner-consent.types.js";

type YouTubeOwnerConsentOptions = {
  apiBaseUrl?: string;
  env?: Record<string, string | undefined>;
  exchangeCode?: YouTubeOwnerConsentExchangeCode;
  now?: () => Date;
  webBaseUrl?: string;
};

type YouTubeOAuthStatePayload = {
  authUserId: string;
  domainUserId: string;
  issuedAt: string;
  nonce: string;
};

const maxStateAgeMs = 15 * 60 * 1000;

const base64UrlEncode = (value: string): string =>
  Buffer.from(value, "utf8").toString("base64url");

const base64UrlDecode = (value: string): string =>
  Buffer.from(value, "base64url").toString("utf8");

const canManageProviderIntegrations = (rolePermissionValues: readonly unknown[]): boolean => {
  const permissions = normalizeProviderIntegrationPermissions(rolePermissionValues);

  return permissions.includes("*") || permissions.includes("provider-integrations:manage");
};

const getStateSecret = (env: Record<string, string | undefined>): string | null => {
  const secret = env.PROVIDER_OAUTH_STATE_SECRET
    ?? env.BETTER_AUTH_SECRET
    ?? env.DEV_NOTIFICATION_POST_SECRET;
  const trimmed = secret?.trim() ?? "";

  return trimmed.length > 0 ? trimmed : null;
};

const signStatePayload = (
  payload: YouTubeOAuthStatePayload,
  secret: string
): string => {
  const encodedPayload = base64UrlEncode(JSON.stringify(payload));
  const signature = createHmac("sha256", secret).update(encodedPayload).digest("base64url");

  return `${encodedPayload}.${signature}`;
};

const verifyStatePayload = (
  state: string,
  secret: string,
  now: Date
): YouTubeOAuthStatePayload | null => {
  const [encodedPayload, signature] = state.split(".");

  if (!encodedPayload || !signature) {
    return null;
  }

  const expectedSignature = createHmac("sha256", secret).update(encodedPayload).digest("base64url");
  const provided = Buffer.from(signature, "base64url");
  const expected = Buffer.from(expectedSignature, "base64url");

  if (provided.length !== expected.length || !timingSafeEqual(provided, expected)) {
    return null;
  }

  try {
    const parsed = JSON.parse(base64UrlDecode(encodedPayload)) as Partial<YouTubeOAuthStatePayload>;
    const issuedAt = typeof parsed.issuedAt === "string" ? new Date(parsed.issuedAt) : null;

    if (
      typeof parsed.authUserId !== "string"
      || typeof parsed.domainUserId !== "string"
      || typeof parsed.nonce !== "string"
      || !issuedAt
      || Number.isNaN(issuedAt.getTime())
      || now.getTime() - issuedAt.getTime() > maxStateAgeMs
      || issuedAt.getTime() - now.getTime() > 60_000
    ) {
      return null;
    }

    return {
      authUserId: parsed.authUserId,
      domainUserId: parsed.domainUserId,
      issuedAt: issuedAt.toISOString(),
      nonce: parsed.nonce
    };
  } catch {
    return null;
  }
};

export class YouTubeOwnerConsentService {
  public constructor(
    private readonly repository: YouTubeOwnerConsentRepository,
    private readonly options: YouTubeOwnerConsentOptions = {}
  ) {}

  public async getCredential(input: { authUserId: string }): Promise<YouTubeOwnerConsentResult> {
    const actor = await this.requireActor(input.authUserId);

    if (!actor.ok) {
      return actor;
    }

    return {
      ok: true,
      credential: await this.repository.getYouTubeCredentialSummary(actor.domainUserId),
      redirectUri: this.getFallbackRedirectUri(),
      requiredScope: youtubeLiveChatReadOnlyScope
    };
  }

  public async createConsentUrl(input: { authUserId: string }): Promise<YouTubeOwnerConsentResult> {
    const actor = await this.requireActor(input.authUserId);

    if (!actor.ok) {
      return actor;
    }

    const config = resolveYouTubeOwnerOAuthConfig(this.options.env ?? process.env, this.getFallbackRedirectUri());

    if (!config.ok) {
      return {
        ok: false,
        reason: config.reason
      };
    }

    const now = this.options.now?.() ?? new Date();
    const stateSecret = getStateSecret(this.options.env ?? process.env);

    if (!stateSecret) {
      return {
        ok: false,
        reason: "youtube_oauth_state_secret_missing"
      };
    }

    const state = signStatePayload({
      authUserId: input.authUserId,
      domainUserId: actor.domainUserId,
      issuedAt: now.toISOString(),
      nonce: randomBytes(16).toString("base64url")
    }, stateSecret);

    return {
      ok: true,
      credential: await this.repository.getYouTubeCredentialSummary(actor.domainUserId),
      consentUrl: createYouTubeOwnerConsentUrl({ config, state }),
      redirectUri: config.redirectUri,
      requiredScope: youtubeLiveChatReadOnlyScope
    };
  }

  public async completeConsent(input: { code: string; state: string }): Promise<YouTubeOwnerConsentResult> {
    const env = this.options.env ?? process.env;
    const now = this.options.now?.() ?? new Date();
    const stateSecret = getStateSecret(env);

    if (!stateSecret) {
      return {
        ok: false,
        reason: "youtube_oauth_state_secret_missing"
      };
    }

    const parsedState = verifyStatePayload(input.state, stateSecret, now);

    if (!parsedState) {
      return {
        ok: false,
        reason: "youtube_oauth_state_invalid"
      };
    }

    const config = resolveYouTubeOwnerOAuthConfig(env, this.getFallbackRedirectUri());

    if (!config.ok) {
      return {
        ok: false,
        reason: config.reason
      };
    }

    const exchanged = this.options.exchangeCode
      ? await this.options.exchangeCode({ code: input.code, redirectUri: config.redirectUri })
      : await exchangeYouTubeOwnerCode({ code: input.code, config });

    if (!exchanged.ok) {
      return {
        ok: false,
        reason: exchanged.reason
      };
    }

    if (!exchanged.refreshToken) {
      return {
        ok: false,
        reason: "youtube_oauth_refresh_token_missing"
      };
    }

    const credential = await this.repository.upsertYouTubeCredential({
      domainUserId: parsedState.domainUserId,
      accessToken: exchanged.accessToken,
      refreshToken: exchanged.refreshToken,
      accessTokenExpiresAt: exchanged.expiresAt,
      scopes: exchanged.scopes.length > 0 ? exchanged.scopes : [youtubeLiveChatReadOnlyScope],
      verifiedAt: now
    });

    return {
      ok: true,
      credential,
      redirectUri: config.redirectUri,
      requiredScope: youtubeLiveChatReadOnlyScope
    };
  }

  public getAdminRedirectUrl(result: YouTubeOwnerConsentResult): string {
    const baseUrl = this.options.webBaseUrl ?? process.env.WEB_PUBLIC_BASE_URL ?? "https://web-dev.maiks.yt";
    const url = new URL("/admin/provider-integrations", baseUrl);

    url.searchParams.set("youtube", result.ok ? "connected" : "error");

    if (!result.ok) {
      url.searchParams.set("reason", result.reason);
    }

    return url.toString();
  }

  private async requireActor(authUserId: string): Promise<
    | { ok: true; domainUserId: string }
    | Extract<YouTubeOwnerConsentResult, { ok: false }>
  > {
    const actor = await this.repository.resolveActor(authUserId);

    if (!actor) {
      return {
        ok: false,
        reason: "provider_integrations_user_unlinked"
      };
    }

    if (!canManageProviderIntegrations(actor.rolePermissionValues)) {
      return {
        ok: false,
        reason: "provider_integrations_forbidden"
      };
    }

    return {
      ok: true,
      domainUserId: actor.domainUserId
    };
  }

  private getFallbackRedirectUri(): string {
    const apiBaseUrl = this.options.apiBaseUrl ?? process.env.API_PUBLIC_BASE_URL ?? "https://api-dev.maiks.yt";
    return new URL("/admin/provider-integrations/youtube/callback", apiBaseUrl).toString();
  }
}
