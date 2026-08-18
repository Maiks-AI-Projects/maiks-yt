import { createHmac } from "node:crypto";

import type { FastifyRequest } from "fastify";

export const getMusicRequestHashSecret = (environment = process.env): string | null => {
  const dedicatedSecret = environment.MUSIC_REQUEST_HASH_SECRET?.trim();

  if (dedicatedSecret) {
    return dedicatedSecret;
  }

  const betterAuthSecret = environment.BETTER_AUTH_SECRET?.trim();

  return betterAuthSecret ? `maiks-yt:music-request:v1:${betterAuthSecret}` : null;
};

export const deriveAnonymousMusicRequestHmac = (input: {
  ipAddress: string;
  amsterdamDate: string;
  secret: string;
}): string =>
  createHmac("sha256", input.secret)
    .update(`music-request:anonymous:v1:${input.amsterdamDate}:${input.ipAddress}`)
    .digest("hex");

export const getMusicRequestViewerIp = (request: FastifyRequest): string => {
  const cloudflareConnectingIp = request.headers["cf-connecting-ip"];
  const headerValue = Array.isArray(cloudflareConnectingIp)
    ? cloudflareConnectingIp[0]
    : cloudflareConnectingIp;

  // Production traffic is expected to reach this API through the trusted Cloudflare tunnel/proxy.
  // Under that boundary, CF-Connecting-IP is the viewer IP; direct-origin exposure would make it spoofable.
  return headerValue?.trim() || request.ip;
};
