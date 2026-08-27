import { createHash, timingSafeEqual } from "node:crypto";

export type LocalAgentServerConfig = {
  configured: boolean;
  expectedAgentId: string;
  expectedDeviceId: string | null;
  token: string | null;
};

const normalizeIdentifier = (value: string | undefined): string | null => {
  const normalized = value?.trim() ?? "";
  return /^[a-zA-Z0-9._:-]{1,128}$/.test(normalized) ? normalized : null;
};

export const loadLocalAgentServerConfig = (): LocalAgentServerConfig => {
  const token = process.env.MAIKS_LOCAL_AGENT_TOKEN?.trim() || null;
  const expectedAgentId = normalizeIdentifier(process.env.MAIKS_LOCAL_AGENT_ID)
    ?? "maiks-audio-agent";
  const expectedDeviceId = normalizeIdentifier(process.env.MAIKS_LOCAL_AGENT_DEVICE_ID);

  return {
    configured: Boolean(token && token.length >= 32 && expectedDeviceId),
    expectedAgentId,
    expectedDeviceId,
    token: token && token.length >= 32 ? token : null
  };
};

export const validateLocalAgentCredential = (
  configuredToken: string | null,
  presentedToken: string | null
): boolean => {
  if (!configuredToken || !presentedToken) {
    return false;
  }

  const configuredHash = createHash("sha256").update(configuredToken, "utf8").digest();
  const presentedHash = createHash("sha256").update(presentedToken, "utf8").digest();
  return timingSafeEqual(configuredHash, presentedHash);
};

export const readBearerCredential = (authorization: string | undefined): string | null => {
  if (!authorization?.startsWith("Bearer ")) {
    return null;
  }

  const token = authorization.slice("Bearer ".length).trim();
  return token.length >= 32 && !/\s/.test(token) ? token : null;
};
