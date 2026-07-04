import { randomBytes, randomUUID } from "node:crypto";

import { hashToken } from "../security/token-hash.service.js";
import type {
  DevOwnerTokenMintInput,
  DevOwnerTokenMintRequest,
  DevOwnerTokenMintResult,
  DevOwnerTokenRepository
} from "./dev-owner-token.types.js";

type DevOwnerTokenServiceOptions = {
  env?: Record<string, string | undefined>;
  now?: () => Date;
  webBaseUrl?: string;
};

const defaultTtlMinutes = 10;
const maxTtlMinutes = 15;

const trimToNull = (value: string | undefined): string | null => {
  const trimmed = value?.trim() ?? "";

  return trimmed.length > 0 ? trimmed : null;
};

export const getDevOwnerTokenMintSecret = (
  env: Record<string, string | undefined>
): string | null =>
  trimToNull(env.DEV_OWNER_TOKEN_MINT_SECRET)
  ?? trimToNull(env.DEV_TEST_AUTH_MINT_SECRET)
  ?? trimToNull(env.DEV_NOTIFICATION_POST_SECRET);

export const normalizeDevOwnerTokenMintInput = (
  input: DevOwnerTokenMintRequest | undefined
): DevOwnerTokenMintInput | null => {
  const ttlMinutes = input?.ttlMinutes ?? defaultTtlMinutes;
  const label = (input?.label ?? "Codex short-lived owner smoke token").trim();
  const path = (input?.path ?? "/admin/provider-integrations").trim();

  if (
    !Number.isInteger(ttlMinutes)
    || ttlMinutes < 1
    || ttlMinutes > maxTtlMinutes
    || label.length < 1
    || label.length > 191
    || path.length < 1
    || path.length > 512
    || !path.startsWith("/")
    || path.startsWith("//")
  ) {
    return null;
  }

  return {
    label,
    path,
    ttlMinutes
  };
};

export class DevOwnerTokenService {
  public constructor(
    private readonly repository: DevOwnerTokenRepository,
    private readonly options: DevOwnerTokenServiceOptions = {}
  ) {}

  public async mint(input?: DevOwnerTokenMintRequest): Promise<DevOwnerTokenMintResult> {
    const env = this.options.env ?? process.env;

    if (env.NODE_ENV === "production") {
      return {
        ok: false,
        reason: "dev_owner_token_disabled"
      };
    }

    const parsedInput = normalizeDevOwnerTokenMintInput(input);

    if (!parsedInput) {
      return {
        ok: false,
        reason: "dev_owner_token_invalid_input"
      };
    }

    const owner = await this.repository.findOwnerAuthUser();

    if (!owner) {
      return {
        ok: false,
        reason: "dev_owner_token_owner_missing"
      };
    }

    const now = this.options.now?.() ?? new Date();
    const expiresAt = new Date(now.getTime() + parsedInput.ttlMinutes * 60_000);
    const token = randomBytes(32).toString("base64url");

    await this.repository.insertToken({
      id: randomUUID(),
      label: parsedInput.label,
      tokenHash: hashToken(token),
      authUserId: owner.authUserId,
      expiresAt
    });

    return {
      ok: true,
      token,
      expiresAt: expiresAt.toISOString(),
      loginUrl: this.createLoginUrl(parsedInput.path, token)
    };
  }

  private createLoginUrl(path: string, token: string): string {
    const baseUrl = this.options.webBaseUrl
      ?? process.env.WEB_PUBLIC_BASE_URL
      ?? "https://web-dev.maiks.yt";
    const url = new URL(path, baseUrl);

    url.searchParams.set("devAuthToken", token);

    return url.toString();
  }
}
