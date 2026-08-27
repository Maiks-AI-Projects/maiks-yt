import type { FastifyInstance, FastifyRequest } from "fastify";

export const sanitizeRequestUrlForLogging = (requestUrl: string): string => {
  const queryStart = requestUrl.indexOf("?");
  const fragmentStart = requestUrl.indexOf("#");
  const detailStarts = [queryStart, fragmentStart].filter((index) => index >= 0);
  const detailStart = detailStarts.length > 0 ? Math.min(...detailStarts) : -1;
  const requestTarget = detailStart === -1
    ? requestUrl
    : requestUrl.slice(0, detailStart);

  if (requestTarget === "*") {
    return requestTarget;
  }

  if (requestTarget.startsWith("//")) {
    try {
      return new URL(`http:${requestTarget}`).pathname || "/";
    } catch {
      return "/";
    }
  }

  if (/^[a-z][a-z\d+.-]*:\/\//iu.test(requestTarget)) {
    try {
      return new URL(requestTarget).pathname || "/";
    } catch {
      return "/";
    }
  }

  return requestTarget.startsWith("/") ? requestTarget : "/";
};

export const apiRequestLoggerOptions = {
  serializers: {
    req: (request: FastifyRequest) => ({
      method: request.method,
      url: sanitizeRequestUrlForLogging(request.url),
      host: request.host,
      version: request.headers["accept-version"] as string,
      remoteAddress: request.ip,
      remotePort: request.socket.remotePort as number
    })
  }
};

export const registerSanitizedNotFoundHandler = (server: FastifyInstance): void => {
  server.setNotFoundHandler((request, reply) => {
    reply.code(404).send({
      message: `Route ${request.method}:${sanitizeRequestUrlForLogging(request.url)} not found`,
      error: "Not Found",
      statusCode: 404
    });
  });
};
