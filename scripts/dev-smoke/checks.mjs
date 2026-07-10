import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

const checkJsonEndpoint = async ({ http, name, url, validate, critical = false }) => {
  try {
    const result = await http.readJson(url);

    if (!result.ok) {
      return {
        ok: false,
        critical,
        name,
        message: `${name} returned HTTP ${result.status}.`
      };
    }

    const validationMessage = validate?.(result.json);

    if (validationMessage) {
      return {
        ok: false,
        critical,
        name,
        message: validationMessage
      };
    }

    return {
      ok: true,
      name,
      message: `${name} passed.`
    };
  } catch (error) {
    return {
      ok: false,
      critical,
      name,
      message: `${name} failed: ${error instanceof Error ? error.message : String(error)}.`
    };
  }
};

const sleep = (delayMs) => new Promise((resolve) => {
  setTimeout(resolve, delayMs);
});

const checkTextEndpointOnce = async ({ http, name, url, scanInjection = false, rejectNavbar = false, critical = false }) => {
  try {
    const result = await http.readText(url);

    if (!result.ok) {
      return {
        ok: false,
        critical,
        name,
        message: `${name} returned HTTP ${result.status}.`
      };
    }

    if (scanInjection) {
      const markers = http.findInjectionMarkers(result.body);

      if (markers.length > 0) {
        return {
          ok: false,
          critical: true,
          name,
          message: `${name} contains suspicious marker(s): ${markers.join(", ")}.`
        };
      }
    }

    if (rejectNavbar && result.body.includes("site-header")) {
      return {
        ok: false,
        critical,
        name,
        message: `${name} contains the normal website navbar marker.`
      };
    }

    return {
      ok: true,
      name,
      message: `${name} passed.`
    };
  } catch (error) {
    return {
      ok: false,
      critical,
      name,
      message: `${name} failed: ${error instanceof Error ? error.message : String(error)}.`
    };
  }
};

const checkTextEndpoint = async ({
  attempts = 1,
  retryDelayMs = 0,
  ...input
}) => {
  let lastResult;
  const boundedAttempts = Math.max(1, Math.trunc(attempts));

  for (let attempt = 1; attempt <= boundedAttempts; attempt += 1) {
    lastResult = await checkTextEndpointOnce(input);

    if (lastResult.ok) {
      return attempt === 1
        ? lastResult
        : {
          ...lastResult,
          message: `${lastResult.message} Passed on attempt ${attempt}.`
        };
    }

    if (attempt < boundedAttempts) {
      await sleep(retryDelayMs);
    }
  }

  return {
    ...lastResult,
    message: `${lastResult?.message ?? `${input.name} failed.`} Retried ${boundedAttempts} time(s).`
  };
};

const checkProviderIntakeHealth = async ({ config, getDevOwnerToken, http }) => {
  try {
    const minted = await getDevOwnerToken();

    if (minted.skipped) {
      return {
        ok: true,
        name: "provider intake health",
        message: `provider intake health skipped: ${minted.reason}`
      };
    }

    if (!minted.ok) {
      return {
        ok: false,
        critical: false,
        name: "provider intake health",
        message: `provider intake health could not mint an owner token: ${minted.reason}`
      };
    }

    const result = await http.readJson(http.makeUrl(config.apiUrl, config.providerIntakeHealthPath), {
      headers: {
        Authorization: `Bearer ${minted.token}`
      }
    });

    if (!result.ok) {
      return {
        ok: false,
        critical: false,
        name: "provider intake health",
        message: `provider intake health returned HTTP ${result.status}.`
      };
    }

    if (
      result.json?.ok !== true
      || result.json?.readOnly !== true
      || !Array.isArray(result.json?.entries)
      || result.json.entries.length < 7
      || result.json.entries.some((entry) =>
        typeof entry?.provider !== "string"
        || typeof entry?.mechanism !== "string"
        || !["healthy", "stale", "missing"].includes(entry?.status)
      )
    ) {
      return {
        ok: false,
        critical: false,
        name: "provider intake health",
        message: "provider intake health returned an unexpected payload."
      };
    }

    return {
      ok: true,
      name: "provider intake health",
      message: "provider intake health passed."
    };
  } catch (error) {
    return {
      ok: false,
      critical: false,
      name: "provider intake health",
      message: `provider intake health failed: ${error instanceof Error ? error.message : String(error)}.`
    };
  }
};

const checkYouTubeActivitiesPoll = async ({ config, getDevOwnerToken, http }) => {
  try {
    const minted = await getDevOwnerToken();

    if (minted.skipped) {
      return {
        ok: true,
        name: "youtube activities poll",
        message: `youtube activities poll skipped: ${minted.reason}`
      };
    }

    if (!minted.ok) {
      return {
        ok: false,
        critical: false,
        name: "youtube activities poll",
        message: `youtube activities poll could not mint an owner token: ${minted.reason}`
      };
    }

    const response = await http.fetchWithTimeout(http.makeUrl(config.apiUrl, config.youtubeActivitiesPollPath), {
      method: "POST",
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${minted.token}`
      }
    });
    const body = await response.text();

    let parsed;

    try {
      parsed = body ? JSON.parse(body) : null;
    } catch {
      parsed = null;
    }

    if (!response.ok || parsed?.ok !== true || parsed?.readOnly !== true) {
      return {
        ok: false,
        critical: false,
        name: "youtube activities poll",
        message: `youtube activities poll returned HTTP ${response.status}.`
      };
    }

    return {
      ok: true,
      name: "youtube activities poll",
      message: `youtube activities poll passed with ${parsed.fetched ?? 0} fetched and ${parsed.inserted ?? 0} inserted.`
    };
  } catch (error) {
    return {
      ok: false,
      critical: false,
      name: "youtube activities poll",
      message: `youtube activities poll failed: ${error instanceof Error ? error.message : String(error)}.`
    };
  }
};

const checkBackupHealth = async () => {
  try {
    const result = await execFileAsync("pnpm", ["--filter", "@maiks-yt/database", "backup:health"], {
      timeout: 45_000,
      maxBuffer: 4 * 1024 * 1024
    });
    const jsonStart = result.stdout.indexOf("{");
    const parsed = jsonStart === -1 ? null : JSON.parse(result.stdout.slice(jsonStart));

    if (parsed?.ok !== true) {
      return {
        ok: false,
        critical: false,
        name: "backup health",
        message: "backup health returned an unhealthy payload."
      };
    }

    const warningSuffix = Array.isArray(parsed.warnings) && parsed.warnings.length > 0
      ? ` Warnings: ${parsed.warnings.join(" ")}`
      : "";

    return {
      ok: true,
      name: "backup health",
      message: parsed.skipped
        ? `backup health skipped: ${parsed.reason ?? "not configured"}.${warningSuffix}`
        : `backup health passed.${warningSuffix}`
    };
  } catch (error) {
    return {
      ok: false,
      critical: false,
      name: "backup health",
      message: `backup health failed: ${error instanceof Error ? error.message : String(error)}.`
    };
  }
};

export const runChecks = async ({ config, getDevOwnerToken, http }) => Promise.all([
  checkJsonEndpoint({
    http,
    name: "api health",
    url: http.makeUrl(config.apiUrl, "/health"),
    critical: true,
    validate: (json) => json?.ok === true && json?.surface === "api"
      ? null
      : "api health returned an unexpected payload."
  }),
  checkJsonEndpoint({
    http,
    name: "database health",
    url: http.makeUrl(config.apiUrl, "/health/database"),
    critical: true,
    validate: (json) => json?.ok === true && json?.surface === "api" && typeof json?.database === "string"
      ? null
      : "database health returned an unexpected payload."
  }),
  checkTextEndpoint({
    attempts: config.textEndpointAttempts,
    http,
    name: "web home",
    retryDelayMs: config.textEndpointRetryDelayMs,
    url: http.makeUrl(config.webUrl, "/"),
    scanInjection: true,
    critical: true
  }),
  checkTextEndpoint({
    attempts: config.textEndpointAttempts,
    http,
    name: "notification tool",
    retryDelayMs: config.textEndpointRetryDelayMs,
    url: http.makeUrl(config.webUrl, "/tools/notifications"),
    scanInjection: true,
    rejectNavbar: true
  }),
  checkTextEndpoint({
    attempts: config.textEndpointAttempts,
    http,
    name: "notification service worker",
    retryDelayMs: config.textEndpointRetryDelayMs,
    url: http.makeUrl(config.webUrl, "/notification-service-worker.js"),
    scanInjection: true
  }),
  checkTextEndpoint({
    attempts: config.textEndpointAttempts,
    http,
    name: "admin dashboard",
    retryDelayMs: config.textEndpointRetryDelayMs,
    url: http.makeUrl(config.webUrl, "/admin"),
    scanInjection: true
  }),
  checkTextEndpoint({
    attempts: config.textEndpointAttempts,
    http,
    name: "admin games",
    retryDelayMs: config.textEndpointRetryDelayMs,
    url: http.makeUrl(config.webUrl, "/admin/games"),
    scanInjection: true
  }),
  checkTextEndpoint({
    attempts: config.textEndpointAttempts,
    http,
    name: "public games",
    retryDelayMs: config.textEndpointRetryDelayMs,
    url: http.makeUrl(config.webUrl, "/games"),
    scanInjection: true
  }),
  checkTextEndpoint({
    attempts: config.textEndpointAttempts,
    http,
    name: "community rules",
    retryDelayMs: config.textEndpointRetryDelayMs,
    url: http.makeUrl(config.webUrl, "/community-rules"),
    scanInjection: true
  }),
  checkJsonEndpoint({
    http,
    name: "public games API",
    url: http.makeUrl(config.apiUrl, "/games"),
    validate: (json) => json?.ok === true && Array.isArray(json?.games)
      ? null
      : "public games API returned an unexpected payload."
  }),
  checkTextEndpoint({
    attempts: config.textEndpointAttempts,
    http,
    name: "overlay reachability",
    retryDelayMs: config.textEndpointRetryDelayMs,
    url: http.makeUrl(config.overlayUrl, "/"),
    scanInjection: true
  }),
  checkTextEndpoint({
    attempts: config.textEndpointAttempts,
    http,
    name: "control reachability",
    retryDelayMs: config.textEndpointRetryDelayMs,
    url: http.makeUrl(config.controlUrl, "/"),
    scanInjection: true
  }),
  checkTextEndpoint({
    attempts: config.textEndpointAttempts,
    http,
    name: "chat window reachability",
    retryDelayMs: config.textEndpointRetryDelayMs,
    url: http.makeUrl(config.controlUrl, "/chat"),
    scanInjection: true
  }),
  checkTextEndpoint({
    attempts: config.textEndpointAttempts,
    http,
    name: "moderation window reachability",
    retryDelayMs: config.textEndpointRetryDelayMs,
    url: http.makeUrl(config.controlUrl, "/moderation"),
    scanInjection: true
  }),
  checkBackupHealth(),
  checkProviderIntakeHealth({ config, getDevOwnerToken, http }),
  checkYouTubeActivitiesPoll({ config, getDevOwnerToken, http })
]);
