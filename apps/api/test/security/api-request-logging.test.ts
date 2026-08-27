import { Writable } from "node:stream";

import Fastify from "fastify";
import { describe, expect, it } from "vitest";

import {
  apiRequestLoggerOptions,
  registerSanitizedNotFoundHandler,
  sanitizeRequestUrlForLogging
} from "../../src/api-request-logging.service.js";

describe("production API request logging", () => {
  it("redacts URL access tokens and OAuth query credentials", () => {
    const sanitized = sanitizeRequestUrlForLogging(
      "/callback?accessToken=control-secret&devAuthToken=dev-secret&client_secret=client-secret&code=oauth-code&state=oauth-state&surface=control-panel"
    );

    expect(sanitized).toBe("/callback");
  });

  it("drops every query value, including unknown and malformed credential names", () => {
    expect(sanitizeRequestUrlForLogging(
      "/probe?code_verifier=pkce-secret&id_token_hint=id-hint&%61ccessToken=first&safe=%E0%A4%A"
    )).toBe("/probe");
  });

  it("preserves paths without retaining query details", () => {
    expect(sanitizeRequestUrlForLogging("/health")).toBe("/health");
    expect(sanitizeRequestUrlForLogging("/messages?source=twitch&limit=25"))
      .toBe("/messages");
  });

  it("strips raw request fragments instead of logging fragment credentials", () => {
    expect(sanitizeRequestUrlForLogging("/probe#access_token=fragment-secret"))
      .toBe("/probe");
    expect(sanitizeRequestUrlForLogging("/probe?source=twitch#access_token=fragment-secret"))
      .toBe("/probe");
  });

  it("reduces absolute-form targets to a path without authority or userinfo", () => {
    expect(sanitizeRequestUrlForLogging(
      "http://user:pass@example.test/probe?accessToken=absolute-secret"
    )).toBe("/probe");
    expect(sanitizeRequestUrlForLogging(
      "//user:pass@example.test/probe?accessToken=network-secret"
    )).toBe("/probe");
    expect(sanitizeRequestUrlForLogging("http://example.test")).toBe("/");
  });

  it("fails closed for malformed and authority-form request targets", () => {
    expect(sanitizeRequestUrlForLogging("http://user:pass@%zz/probe"))
      .toBe("/");
    expect(sanitizeRequestUrlForLogging("example.test:443")).toBe("/");
    expect(sanitizeRequestUrlForLogging("*")).toBe("*");
  });

  it("sanitizes Fastify request logs without changing route parsing", async () => {
    let output = "";
    const stream = new Writable({
      write(chunk, _encoding, callback) {
        output += chunk.toString();
        callback();
      }
    });
    const server = Fastify({
      logger: {
        ...apiRequestLoggerOptions,
        stream
      }
    });

    server.get("/probe", async (request) => ({ query: request.query }));

    const response = await server.inject({
      method: "GET",
      url: "/probe?accessToken=must-not-log&source=twitch"
    });
    await server.close();

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      query: {
        accessToken: "must-not-log",
        source: "twitch"
      }
    });
    expect(output).toContain("\"url\":\"/probe\"");
    expect(output).not.toContain("accessToken");
    expect(output).not.toContain("source=twitch");
    expect(output).not.toContain("must-not-log");
  });

  it("does not repeat missing-route query details in logs or responses", async () => {
    let output = "";
    const stream = new Writable({
      write(chunk, _encoding, callback) {
        output += chunk.toString();
        callback();
      }
    });
    const server = Fastify({
      logger: {
        ...apiRequestLoggerOptions,
        stream
      }
    });
    registerSanitizedNotFoundHandler(server);

    const response = await server.inject({
      method: "GET",
      url: "/missing?accessToken=missing-secret&source=twitch"
    });
    await server.close();

    expect(response.statusCode).toBe(404);
    expect(response.json()).toEqual({
      message: "Route GET:/missing not found",
      error: "Not Found",
      statusCode: 404
    });
    expect(output).toContain("\"url\":\"/missing\"");
    expect(output).not.toContain("accessToken");
    expect(output).not.toContain("source=twitch");
    expect(output).not.toContain("missing-secret");
  });
});
