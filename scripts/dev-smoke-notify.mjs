#!/usr/bin/env node

import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";

const defaultConfig = {
  apiUrl: "https://api-dev.maiks.yt",
  webUrl: "https://web-dev.maiks.yt",
  overlayUrl: "https://overlay-dev.maiks.yt",
  controlUrl: "https://control-dev.maiks.yt",
  notificationPath: "/dev/notifications",
  stateFile: "/tmp/maiks-yt-dev-smoke-state.json",
  duplicateCooldownMs: 12 * 60 * 60 * 1000,
  timeoutMs: 15_000,
  dryRun: false,
  forceNotify: false,
  notifyRecovery: true,
  failOnSmokeFailure: false
};

const args = process.argv.slice(2);

const usage = () => `
Usage: node scripts/dev-smoke-notify.mjs [options]

Options:
  --dry-run                         Run checks without posting notifications.
  --force-notify                    Bypass duplicate failure cooldown.
  --no-recovery-notice              Do not post a recovery note after failures clear.
  --fail-on-smoke-failure           Exit non-zero when smoke checks fail.
  --state-file <path>               State file for duplicate/recovery tracking.
  --duplicate-cooldown-minutes <n>  Cooldown for identical failure alerts.
  --timeout-ms <n>                  Per-request timeout.
  --api-url <url>                   API base URL.
  --web-url <url>                   Web base URL.
  --overlay-url <url>               Overlay base URL.
  --control-url <url>               Control-panel base URL.
`;

const readOption = (name) => {
  const index = args.indexOf(name);

  if (index === -1) {
    return undefined;
  }

  return args[index + 1];
};

if (args.includes("--help") || args.includes("-h")) {
  console.log(usage().trim());
  process.exit(0);
}

const parseNumberOption = (name, fallback) => {
  const rawValue = readOption(name);

  if (rawValue === undefined) {
    return fallback;
  }

  const parsed = Number(rawValue);

  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new Error(`${name} must be a positive number.`);
  }

  return parsed;
};

const config = {
  ...defaultConfig,
  apiUrl: readOption("--api-url") ?? defaultConfig.apiUrl,
  webUrl: readOption("--web-url") ?? defaultConfig.webUrl,
  overlayUrl: readOption("--overlay-url") ?? defaultConfig.overlayUrl,
  controlUrl: readOption("--control-url") ?? defaultConfig.controlUrl,
  stateFile: readOption("--state-file") ?? defaultConfig.stateFile,
  duplicateCooldownMs: parseNumberOption(
    "--duplicate-cooldown-minutes",
    defaultConfig.duplicateCooldownMs / 60_000
  ) * 60_000,
  timeoutMs: parseNumberOption("--timeout-ms", defaultConfig.timeoutMs),
  dryRun: args.includes("--dry-run"),
  forceNotify: args.includes("--force-notify"),
  notifyRecovery: !args.includes("--no-recovery-notice"),
  failOnSmokeFailure: args.includes("--fail-on-smoke-failure")
};

const injectionMarkers = [
  "bsc-testnet-rpc",
  "publicnode",
  "stop watching us",
  "worker-winter-bird-f0bf"
];

const makeUrl = (baseUrl, path = "/") => new URL(path, baseUrl).toString();

const fetchWithTimeout = async (url, options = {}) => {
  const response = await fetch(url, {
    ...options,
    signal: AbortSignal.timeout(config.timeoutMs)
  });

  return response;
};

const readJson = async (url) => {
  const response = await fetchWithTimeout(url, {
    headers: {
      Accept: "application/json"
    }
  });
  const body = await response.text();

  let parsed;

  try {
    parsed = body ? JSON.parse(body) : null;
  } catch {
    parsed = null;
  }

  return {
    body,
    json: parsed,
    ok: response.ok,
    status: response.status,
    url
  };
};

const readText = async (url) => {
  const response = await fetchWithTimeout(url, {
    headers: {
      Accept: "text/html,application/javascript,text/plain,*/*"
    }
  });

  return {
    body: await response.text(),
    ok: response.ok,
    status: response.status,
    url
  };
};

const findInjectionMarkers = (body) =>
  injectionMarkers.filter((marker) => body.toLowerCase().includes(marker.toLowerCase()));

const checkJsonEndpoint = async ({ name, url, validate, critical = false }) => {
  try {
    const result = await readJson(url);

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

const checkTextEndpoint = async ({ name, url, scanInjection = false, rejectNavbar = false, critical = false }) => {
  try {
    const result = await readText(url);

    if (!result.ok) {
      return {
        ok: false,
        critical,
        name,
        message: `${name} returned HTTP ${result.status}.`
      };
    }

    if (scanInjection) {
      const markers = findInjectionMarkers(result.body);

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

const runChecks = async () => Promise.all([
  checkJsonEndpoint({
    name: "api health",
    url: makeUrl(config.apiUrl, "/health"),
    critical: true,
    validate: (json) => json?.ok === true && json?.surface === "api"
      ? null
      : "api health returned an unexpected payload."
  }),
  checkJsonEndpoint({
    name: "database health",
    url: makeUrl(config.apiUrl, "/health/database"),
    critical: true,
    validate: (json) => json?.ok === true && json?.surface === "api" && typeof json?.database === "string"
      ? null
      : "database health returned an unexpected payload."
  }),
  checkTextEndpoint({
    name: "web home",
    url: makeUrl(config.webUrl, "/"),
    scanInjection: true,
    critical: true
  }),
  checkTextEndpoint({
    name: "notification tool",
    url: makeUrl(config.webUrl, "/tools/notifications"),
    scanInjection: true,
    rejectNavbar: true
  }),
  checkTextEndpoint({
    name: "notification service worker",
    url: makeUrl(config.webUrl, "/notification-service-worker.js"),
    scanInjection: true
  }),
  checkTextEndpoint({
    name: "overlay reachability",
    url: makeUrl(config.overlayUrl, "/"),
    scanInjection: true
  }),
  checkTextEndpoint({
    name: "control reachability",
    url: makeUrl(config.controlUrl, "/"),
    scanInjection: true
  })
]);

const readState = async () => {
  try {
    return JSON.parse(await readFile(config.stateFile, "utf8"));
  } catch {
    return {};
  }
};

const writeState = async (state) => {
  await writeFile(config.stateFile, `${JSON.stringify(state, null, 2)}\n`, "utf8");
};

const hashFailures = (failures) => createHash("sha256")
  .update(JSON.stringify(failures.map((failure) => ({
    critical: Boolean(failure.critical),
    message: failure.message,
    name: failure.name
  })).sort((left, right) => left.name.localeCompare(right.name))), "utf8")
  .digest("hex");

const postNotification = async ({ title, body, severity }) => {
  const secret = process.env.DEV_NOTIFICATION_POST_SECRET;

  if (!secret) {
    return {
      ok: false,
      reason: "DEV_NOTIFICATION_POST_SECRET is not set."
    };
  }

  const response = await fetchWithTimeout(makeUrl(config.apiUrl, config.notificationPath), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Dev-Notification-Secret": secret
    },
    body: JSON.stringify({
      title,
      body,
      severity,
      source: "dev_smoke",
      actionUrl: makeUrl(config.webUrl, "/tools/notifications")
    })
  });

  const responseBody = await response.text();

  return {
    ok: response.ok,
    reason: response.ok ? null : `notification endpoint returned HTTP ${response.status}: ${responseBody.slice(0, 200)}`
  };
};

const formatFailures = (failures) => failures
  .slice(0, 8)
  .map((failure) => `- ${failure.message}`)
  .join("\n");

const main = async () => {
  const startedAt = new Date();
  const results = await runChecks();
  const failures = results.filter((result) => !result.ok);
  const state = await readState();
  const now = Date.now();

  console.log(JSON.stringify({
    checkedAt: startedAt.toISOString(),
    dryRun: config.dryRun,
    ok: failures.length === 0,
    passed: results.length - failures.length,
    failed: failures.length,
    failures: failures.map((failure) => ({
      critical: Boolean(failure.critical),
      message: failure.message,
      name: failure.name
    }))
  }, null, 2));

  if (failures.length > 0) {
    const signature = hashFailures(failures);
    const lastNotifiedAt = typeof state.lastFailureNotifiedAt === "string"
      ? Date.parse(state.lastFailureNotifiedAt)
      : 0;
    const duplicateIsCoolingDown = state.lastFailureSignature === signature
      && Number.isFinite(lastNotifiedAt)
      && now - lastNotifiedAt < config.duplicateCooldownMs;
    const severity = failures.some((failure) => failure.critical) ? "critical" : "warning";

    if (config.dryRun) {
      console.log("Dry run: failure notification was not posted.");
    } else if (duplicateIsCoolingDown && !config.forceNotify) {
      console.log("Duplicate failure signature is still cooling down; notification was not posted.");
    } else {
      const posted = await postNotification({
        title: severity === "critical" ? "Dev smoke critical failure" : "Dev smoke warning",
        body: `Automated dev smoke found ${failures.length} issue(s).\n\n${formatFailures(failures)}`,
        severity
      });

      if (!posted.ok) {
        console.error(`Notification post failed: ${posted.reason}`);
      } else {
        console.log("Failure notification posted.");
      }
    }

    await writeState({
      hadActiveFailure: true,
      lastFailureNotifiedAt: duplicateIsCoolingDown && !config.forceNotify
        ? state.lastFailureNotifiedAt
        : new Date(now).toISOString(),
      lastFailureSignature: signature
    });

    if (config.failOnSmokeFailure) {
      process.exitCode = 1;
    }

    return;
  }

  if (state.hadActiveFailure && config.notifyRecovery) {
    if (config.dryRun) {
      console.log("Dry run: recovery notification was not posted.");
    } else {
      const posted = await postNotification({
        title: "Dev smoke recovered",
        body: "Automated dev smoke checks are passing again.",
        severity: "info"
      });

      if (!posted.ok) {
        console.error(`Recovery notification post failed: ${posted.reason}`);
      } else {
        console.log("Recovery notification posted.");
      }
    }
  }

  await writeState({
    hadActiveFailure: false,
    lastSuccessAt: new Date(now).toISOString()
  });
};

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
