import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";

const reviewRefPrefix = "provider-intake-review:v1:";
const developmentBetterAuthSecret = "development-only-better-auth-secret-change-before-production";
const unpaddedBase64UrlPattern = /^[A-Za-z0-9_-]+$/;

type ProviderEventIntakeReviewRefEnvironment = Record<string, string | undefined>;

type ProviderEventIntakeReviewRefPayload = {
  version: 1;
  authUserId: string;
  domainUserId: string;
  rowId: string;
};

export const getProviderEventIntakeReviewRefSecret = (
  environment: ProviderEventIntakeReviewRefEnvironment = process.env
): string | null => {
  const configuredSecret = environment.BETTER_AUTH_SECRET?.trim();

  if (configuredSecret) {
    return `maiks-yt:provider-event-intake-review:v1:${configuredSecret}`;
  }

  return environment.NODE_ENV === "production"
    ? null
    : `maiks-yt:provider-event-intake-review:v1:${developmentBetterAuthSecret}`;
};

const keyFromSecret = (secret: string): Buffer =>
  createHash("sha256").update(secret, "utf8").digest();

const decodeCanonicalBase64Url = (encoded: string): Buffer | null => {
  if (!unpaddedBase64UrlPattern.test(encoded)) {
    return null;
  }

  const decoded = Buffer.from(encoded, "base64url");
  return decoded.toString("base64url") === encoded ? decoded : null;
};

const isReviewRefPayload = (value: unknown): value is ProviderEventIntakeReviewRefPayload => {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return false;
  }

  const payload = value as Record<string, unknown>;

  return payload.version === 1
    && typeof payload.authUserId === "string"
    && typeof payload.domainUserId === "string"
    && typeof payload.rowId === "string"
    && payload.authUserId.length > 0
    && payload.domainUserId.length > 0
    && payload.rowId.length > 0;
};

export const createProviderEventIntakeReviewRef = ({
  authUserId,
  domainUserId,
  rowId,
  secret
}: {
  authUserId: string;
  domainUserId: string;
  rowId: string;
  secret: string;
}): string => {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", keyFromSecret(secret), iv);
  const payload = JSON.stringify({
    authUserId,
    domainUserId,
    rowId,
    version: 1
  } satisfies ProviderEventIntakeReviewRefPayload);
  const encrypted = Buffer.concat([cipher.update(payload, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();

  return `${reviewRefPrefix}${iv.toString("base64url")}.${encrypted.toString("base64url")}.${tag.toString("base64url")}`;
};

export const parseProviderEventIntakeReviewRef = ({
  reviewRef,
  secret
}: {
  reviewRef: string;
  secret: string;
}): ProviderEventIntakeReviewRefPayload | null => {
  if (!reviewRef.startsWith(reviewRefPrefix)) {
    return null;
  }

  const encodedParts = reviewRef.slice(reviewRefPrefix.length).split(".");

  if (encodedParts.length !== 3) {
    return null;
  }

  const [encodedIv, encodedCiphertext, encodedTag] = encodedParts;

  if (!encodedIv || !encodedCiphertext || !encodedTag) {
    return null;
  }

  try {
    const iv = decodeCanonicalBase64Url(encodedIv);
    const ciphertext = decodeCanonicalBase64Url(encodedCiphertext);
    const tag = decodeCanonicalBase64Url(encodedTag);

    if (!iv || !ciphertext || !tag || iv.length !== 12 || tag.length !== 16) {
      return null;
    }

    const decipher = createDecipheriv("aes-256-gcm", keyFromSecret(secret), iv);
    decipher.setAuthTag(tag);
    const plaintext = Buffer.concat([
      decipher.update(ciphertext),
      decipher.final()
    ]).toString("utf8");
    const payload = JSON.parse(plaintext) as unknown;

    return isReviewRefPayload(payload) ? payload : null;
  } catch {
    return null;
  }
};
