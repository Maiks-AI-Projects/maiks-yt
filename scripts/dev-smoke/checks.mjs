import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

const checkJsonEndpoint = async ({ http, name, url, validate, critical = false, headers = {} }) => {
  try {
    const result = await http.readJson(url, { headers });

    if (!result.ok) {
      return {
        ok: false,
        critical,
        name,
        message: `${name} returned HTTP ${result.status}.`
      };
    }

    const validationMessage = validate?.(result.json, result.body);

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

const checkOwnerJsonEndpoint = async ({
  config,
  critical = false,
  getDevOwnerToken,
  http,
  name,
  path,
  validate
}) => {
  try {
    const minted = await getDevOwnerToken();

    if (minted.skipped) {
      return {
        ok: true,
        name,
        message: `${name} skipped: ${minted.reason}`
      };
    }

    if (!minted.ok) {
      return {
        ok: false,
        critical,
        name,
        message: `${name} could not mint an owner token: ${minted.reason}`
      };
    }

    return checkJsonEndpoint({
      critical,
      headers: {
        Authorization: `Bearer ${minted.token}`
      },
      http,
      name,
      url: http.makeUrl(config.apiUrl, path),
      validate
    });
  } catch (error) {
    return {
      ok: false,
      critical,
      name,
      message: `${name} failed: ${error instanceof Error ? error.message : String(error)}.`
    };
  }
};

const checkManifestEndpoint = ({ expected, http, name, url }) => checkJsonEndpoint({
  http,
  name,
  url,
  validate: (json) => {
    if (
      typeof json?.name !== "string"
      || json?.id !== expected.id
      || json?.start_url !== expected.startUrl
      || json?.scope !== expected.scope
      || json?.display !== "standalone"
      || !Array.isArray(json?.icons)
      || json.icons.length === 0
    ) {
      return `${name} returned an unexpected manifest shape.`;
    }

    if (expected.shortcutUrls) {
      const shortcutUrls = Array.isArray(json?.shortcuts)
        ? json.shortcuts.map((shortcut) => shortcut?.url)
        : [];
      const missingShortcut = expected.shortcutUrls.find((shortcutUrl) => !shortcutUrls.includes(shortcutUrl));

      if (missingShortcut) {
        return `${name} is missing manifest shortcut ${missingShortcut}.`;
      }
    }

    return null;
  }
});

const sleep = (delayMs) => new Promise((resolve) => {
  setTimeout(resolve, delayMs);
});

const checkTextEndpointOnce = async ({
  http,
  name,
  url,
  expectedText = [],
  forbiddenText = [],
  scanInjection = false,
  rejectNavbar = false,
  critical = false
}) => {
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

    const missingExpectedText = expectedText.filter((text) => !result.body.includes(text));

    if (missingExpectedText.length > 0) {
      return {
        ok: false,
        critical,
        name,
        message: `${name} is missing expected text: ${missingExpectedText.join(", ")}.`
      };
    }

    const foundForbiddenText = forbiddenText.filter((text) => result.body.includes(text));

    if (foundForbiddenText.length > 0) {
      return {
        ok: false,
        critical,
        name,
        message: `${name} contains forbidden text: ${foundForbiddenText.join(", ")}.`
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

const checkBackupKeyDataExport = async ({ config, getDevOwnerToken, http }) => {
  try {
    const minted = await getDevOwnerToken();

    if (minted.skipped) {
      return {
        ok: true,
        name: "backup key-data export",
        message: `backup key-data export skipped: ${minted.reason}`
      };
    }

    if (!minted.ok) {
      return {
        ok: false,
        critical: false,
        name: "backup key-data export",
        message: `backup key-data export could not mint an owner token: ${minted.reason}`
      };
    }

    const result = await http.readJson(http.makeUrl(config.apiUrl, config.backupKeyDataExportPath), {
      headers: {
        Authorization: `Bearer ${minted.token}`
      }
    });

    if (!result.ok) {
      return {
        ok: false,
        critical: false,
        name: "backup key-data export",
        message: `backup key-data export returned HTTP ${result.status}.`
      };
    }

    const bodyContainsSecretMarker = [
      "token_hash",
      "access_token",
      "refresh_token"
    ].some((marker) => result.body.includes(marker));

    if (
      result.json?.ok !== true
      || result.json?.readOnly !== true
      || result.json?.formatVersion !== 1
      || !Array.isArray(result.json?.sections)
      || result.json.sections.length < 12
      || bodyContainsSecretMarker
    ) {
      return {
        ok: false,
        critical: false,
        name: "backup key-data export",
        message: "backup key-data export returned an unexpected or unsafe payload."
      };
    }

    return {
      ok: true,
      name: "backup key-data export",
      message: `backup key-data export passed with ${result.json.sections.length} section(s).`
    };
  } catch (error) {
    return {
      ok: false,
      critical: false,
      name: "backup key-data export",
      message: `backup key-data export failed: ${error instanceof Error ? error.message : String(error)}.`
    };
  }
};

const checkOwnerOperationalReadModels = ({ config, getDevOwnerToken, http }) => [
  checkOwnerJsonEndpoint({
    config,
    getDevOwnerToken,
    http,
    name: "backup health API",
    path: "/admin/backup/health",
    validate: (json) => {
      if (
        json?.ok !== true
        || json?.readOnly !== true
        || typeof json?.healthOk !== "boolean"
        || typeof json?.checkedAt !== "string"
        || !Array.isArray(json?.requiredTables)
        || !Array.isArray(json?.warnings)
      ) {
        return "backup health API returned an unexpected payload.";
      }

      return null;
    }
  }),
  checkOwnerJsonEndpoint({
    config,
    getDevOwnerToken,
    http,
    name: "notification list API",
    path: "/admin/notifications?includeArchived=false&limit=10",
    validate: (json) => {
      if (
        json?.ok !== true
        || !Array.isArray(json?.notifications)
        || typeof json?.unreadCount !== "number"
        || typeof json?.criticalUnreadCount !== "number"
      ) {
        return "notification list API returned an unexpected payload.";
      }

      return null;
    }
  }),
  checkOwnerJsonEndpoint({
    config,
    getDevOwnerToken,
    http,
    name: "notification push config API",
    path: "/admin/notifications/push-config",
    validate: (json) => {
      if (
        json?.ok !== true
        || typeof json?.enabled !== "boolean"
        || !["string", "object"].includes(typeof json?.publicKey)
      ) {
        return "notification push config API returned an unexpected payload.";
      }

      return null;
    }
  }),
  checkOwnerJsonEndpoint({
    config,
    getDevOwnerToken,
    http,
    name: "provider integration status API",
    path: "/admin/provider-integrations/status",
    validate: (json) => {
      if (
        json?.ok !== true
        || json?.readOnly !== true
        || typeof json?.generatedAt !== "string"
        || !Array.isArray(json?.providers)
        || json.providers.length < 3
        || !Array.isArray(json?.boundaries)
      ) {
        return "provider integration status API returned an unexpected payload.";
      }

      return null;
    }
  }),
  checkOwnerJsonEndpoint({
    config,
    getDevOwnerToken,
    http,
    name: "session list API",
    path: "/admin/sessions",
    validate: (json) => {
      if (
        json?.ok !== true
        || !Array.isArray(json?.sessions)
        || json.sessions.some((session) =>
          typeof session?.id !== "string"
          || typeof session?.authUserId !== "string"
          || typeof session?.isCurrent !== "boolean"
          || typeof session?.isExpired !== "boolean"
        )
      ) {
        return "session list API returned an unexpected payload.";
      }

      return null;
    }
  }),
  checkOwnerJsonEndpoint({
    config,
    getDevOwnerToken,
    http,
    name: "testing smoke state API",
    path: "/admin/testing/smoke-state",
    validate: (json, body) => {
      if (
        json?.ok !== true
        || json?.readOnly !== true
        || typeof json?.checkedAt !== "string"
        || typeof json?.stateFileConfigured !== "boolean"
        || !["passing", "failing", "unknown"].includes(json?.state?.status)
        || typeof json?.state?.stateAvailable !== "boolean"
        || typeof json?.state?.lastFailureSignaturePresent !== "boolean"
      ) {
        return "testing smoke state API returned an unexpected payload.";
      }

      return body.includes("lastFailureSignature\"")
        ? "testing smoke state API leaked a failure signature."
        : null;
    }
  }),
  checkOwnerJsonEndpoint({
    config,
    getDevOwnerToken,
    http,
    name: "money ledger API",
    path: "/admin/money/ledger",
    validate: (json) => {
      if (
        json?.ok !== true
        || !Array.isArray(json?.transactions)
        || !Array.isArray(json?.warnings)
      ) {
        return "money ledger API returned an unexpected payload.";
      }

      return null;
    }
  }),
  checkOwnerJsonEndpoint({
    config,
    getDevOwnerToken,
    http,
    name: "live helper API",
    path: "/admin/live-helper",
    validate: (json) => {
      if (
        json?.ok !== true
        || json?.readOnly !== true
        || typeof json?.generatedAt !== "string"
        || typeof json?.pendingApprovals?.count !== "number"
        || !Array.isArray(json?.pendingApprovals?.items)
        || typeof json?.notifications?.openWarningCount !== "number"
        || typeof json?.notifications?.openCriticalCount !== "number"
        || !Array.isArray(json?.activeHelperGrants?.items)
        || !Array.isArray(json?.boundaries)
      ) {
        return "live helper API returned an unexpected payload.";
      }

      return null;
    }
  }),
  checkOwnerJsonEndpoint({
    config,
    getDevOwnerToken,
    http,
    name: "event routing rules API",
    path: "/admin/event-routing/rules",
    validate: (json) => {
      if (
        json?.ok !== true
        || !Array.isArray(json?.rules)
        || json.rules.length === 0
        || json.rules.some((rule) =>
          typeof rule?.eventKind !== "string"
          || typeof rule?.label !== "string"
          || typeof rule?.persisted !== "boolean"
          || typeof rule?.validation?.ok !== "boolean"
        )
      ) {
        return "event routing rules API returned an unexpected payload.";
      }

      return null;
    }
  }),
  checkOwnerJsonEndpoint({
    config,
    getDevOwnerToken,
    http,
    name: "page admin list API",
    path: "/admin/pages",
    validate: (json) => {
      if (json?.ok !== true || !Array.isArray(json?.pages)) {
        return "page admin list API returned an unexpected payload.";
      }

      return null;
    }
  }),
  checkOwnerJsonEndpoint({
    config,
    getDevOwnerToken,
    http,
    name: "game admin list API",
    path: "/admin/games",
    validate: (json) => {
      if (
        json?.ok !== true
        || !Array.isArray(json?.games)
        || !Array.isArray(json?.suggestions)
      ) {
        return "game admin list API returned an unexpected payload.";
      }

      return null;
    }
  }),
  checkOwnerJsonEndpoint({
    config,
    getDevOwnerToken,
    http,
    name: "creator links admin API",
    path: "/admin/links",
    validate: (json) => {
      if (json?.ok !== true || !Array.isArray(json?.links)) {
        return "creator links admin API returned an unexpected payload.";
      }

      return null;
    }
  }),
  checkOwnerJsonEndpoint({
    config,
    getDevOwnerToken,
    http,
    name: "projects admin API",
    path: "/admin/projects",
    validate: (json) => {
      if (json?.ok !== true || !Array.isArray(json?.projects)) {
        return "projects admin API returned an unexpected payload.";
      }

      return null;
    }
  }),
  checkOwnerJsonEndpoint({
    config,
    getDevOwnerToken,
    http,
    name: "schedule admin API",
    path: "/admin/schedule",
    validate: (json) => {
      if (
        json?.ok !== true
        || !Array.isArray(json?.streams)
        || !Array.isArray(json?.projectOptions)
        || !Array.isArray(json?.gameOptions)
      ) {
        return "schedule admin API returned an unexpected payload.";
      }

      return null;
    }
  }),
  checkOwnerJsonEndpoint({
    config,
    getDevOwnerToken,
    http,
    name: "moderators admin API",
    path: "/admin/moderators",
    validate: (json) => {
      if (
        json?.ok !== true
        || !Array.isArray(json?.users)
        || !Array.isArray(json?.rankPaths)
        || !Array.isArray(json?.roles)
        || !Array.isArray(json?.grants)
        || !Array.isArray(json?.auditLogs)
        || typeof json?.canManageRanks !== "boolean"
      ) {
        return "moderators admin API returned an unexpected payload.";
      }

      return null;
    }
  }),
  checkOwnerJsonEndpoint({
    config,
    getDevOwnerToken,
    http,
    name: "token admin API",
    path: "/admin/tokens",
    validate: (json, body) => {
      if (json?.ok !== true || !Array.isArray(json?.tokens)) {
        return "token admin API returned an unexpected payload.";
      }

      return body.includes("rawToken") || body.includes("devUrl")
        ? "token admin API list leaked a create-only token field."
        : null;
    }
  }),
  checkOwnerJsonEndpoint({
    config,
    getDevOwnerToken,
    http,
    name: "provider intake rows API",
    path: "/admin/connections/intake?limit=10",
    validate: (json) => {
      if (
        json?.ok !== true
        || json?.readOnly !== true
        || !Array.isArray(json?.rows)
        || typeof json?.filters?.limit !== "number"
        || json.rows.some((row) =>
          typeof row?.id !== "string"
          || typeof row?.provider !== "string"
          || typeof row?.mechanism !== "string"
          || typeof row?.providerEventName !== "string"
          || ![false, 0].includes(row?.overlayEligibleByDefault)
        )
      ) {
        return "provider intake rows API returned an unexpected payload.";
      }

      return null;
    }
  })
];

const getSmokeControlAccessToken = () =>
  process.env.DEV_CONTROL_ACCESS_TOKEN
  ?? process.env.CONTROL_PANEL_ACCESS_TOKEN
  ?? null;

const checkModerationAudit = async ({ config, getDevOwnerToken, http }) => {
  try {
    const accessToken = getSmokeControlAccessToken();

    if (!accessToken) {
      return {
        ok: true,
        name: "moderation audit",
        message: "moderation audit skipped: no dev control access token is available."
      };
    }

    const minted = await getDevOwnerToken();

    if (minted.skipped) {
      return {
        ok: true,
        name: "moderation audit",
        message: `moderation audit skipped: ${minted.reason}`
      };
    }

    if (!minted.ok) {
      return {
        ok: false,
        critical: false,
        name: "moderation audit",
        message: `moderation audit could not mint an owner token: ${minted.reason}`
      };
    }

    const url = new URL(http.makeUrl(config.apiUrl, config.moderationAuditPath));
    url.searchParams.set("accessToken", accessToken);
    const result = await http.readJson(url.toString(), {
      headers: {
        Authorization: `Bearer ${minted.token}`
      }
    });

    if (!result.ok) {
      return {
        ok: false,
        critical: false,
        name: "moderation audit",
        message: `moderation audit returned HTTP ${result.status}.`
      };
    }

    if (
      result.json?.ok !== true
      || result.json?.providerAction !== false
      || !Array.isArray(result.json?.audit)
      || result.json.audit.some((entry) =>
        typeof entry?.id !== "string"
        || typeof entry?.source !== "string"
        || typeof entry?.action !== "string"
        || typeof entry?.outcome !== "string"
        || typeof entry?.at !== "string"
      )
    ) {
      return {
        ok: false,
        critical: false,
        name: "moderation audit",
        message: "moderation audit returned an unexpected payload."
      };
    }

    return {
      ok: true,
      name: "moderation audit",
      message: `moderation audit passed with ${result.json.audit.length} recent item(s).`
    };
  } catch (error) {
    return {
      ok: false,
      critical: false,
      name: "moderation audit",
      message: `moderation audit failed: ${error instanceof Error ? error.message : String(error)}.`
    };
  }
};

const makeControlTokenUrl = ({ config, http, path, accessToken }) => {
  const url = new URL(http.makeUrl(config.apiUrl, path));
  url.searchParams.set("accessToken", accessToken);
  return url.toString();
};

const checkStreamerChatMessages = async ({ config, http }) => {
  const accessToken = getSmokeControlAccessToken();

  if (!accessToken) {
    return {
      ok: true,
      name: "streamer chat messages",
      message: "streamer chat messages skipped: no dev control access token is available."
    };
  }

  return checkJsonEndpoint({
    http,
    name: "streamer chat messages",
    url: makeControlTokenUrl({ config, http, path: "/streamer-chat/messages", accessToken }),
    validate: (json) => {
      if (json?.ok !== true || json?.source !== "mixed" || !Array.isArray(json?.messages)) {
        return "streamer chat messages returned an unexpected payload.";
      }

      return json.messages.some((message) =>
        typeof message?.id !== "string"
        || typeof message?.authorName !== "string"
        || typeof message?.message !== "string"
        || typeof message?.source !== "string"
      )
        ? "streamer chat messages included an unexpected message shape."
        : null;
    }
  });
};

const providerChatStatusChecks = [
  ["twitch chat status", "/streamer-chat/twitch-status", ["stopped", "connecting", "connected", "unconfigured"]],
  ["discord chat status", "/streamer-chat/discord-status", ["stopped", "connecting", "connected", "unconfigured"]],
  ["youtube chat status", "/streamer-chat/youtube-status", ["stopped", "connecting", "waiting", "connected", "unconfigured"]]
];

const checkProviderChatStatus = async ({ allowedStates, config, http, name, path }) => {
  const accessToken = getSmokeControlAccessToken();

  if (!accessToken) {
    return {
      ok: true,
      name,
      message: `${name} skipped: no dev control access token is available.`
    };
  }

  return checkJsonEndpoint({
    http,
    name,
    url: makeControlTokenUrl({ config, http, path, accessToken }),
    validate: (json) => {
      if (
        json?.ok !== true
        || json?.readOnly !== true
        || typeof json?.checkedAt !== "string"
        || !allowedStates.includes(json?.status?.state)
        || !Array.isArray(json?.status?.recentMessages)
      ) {
        return `${name} returned an unexpected payload.`;
      }

      return null;
    }
  });
};

const createProviderChatStatusChecks = ({ config, http }) => providerChatStatusChecks.map(([name, path, allowedStates]) =>
  checkProviderChatStatus({ allowedStates, config, http, name, path })
);

const checkStreamerChatModerationAccess = async ({ config, getDevOwnerToken, http }) => {
  const accessToken = getSmokeControlAccessToken();

  if (!accessToken) {
    return {
      ok: true,
      name: "streamer chat moderation access",
      message: "streamer chat moderation access skipped: no dev control access token is available."
    };
  }

  const minted = await getDevOwnerToken();

  if (minted.skipped) {
    return {
      ok: true,
      name: "streamer chat moderation access",
      message: `streamer chat moderation access skipped: ${minted.reason}`
    };
  }

  if (!minted.ok) {
    return {
      ok: false,
      critical: false,
      name: "streamer chat moderation access",
      message: `streamer chat moderation access could not mint an owner token: ${minted.reason}`
    };
  }

  return checkJsonEndpoint({
    headers: {
      Authorization: `Bearer ${minted.token}`
    },
    http,
    name: "streamer chat moderation access",
    url: makeControlTokenUrl({ config, http, path: "/streamer-chat/moderation/access", accessToken }),
    validate: (json) => {
      if (
        json?.ok !== true
        || json?.providerAction !== false
        || typeof json?.checkedAt !== "string"
        || typeof json?.actions?.canHide !== "boolean"
        || typeof json?.actions?.canBan !== "boolean"
        || typeof json?.actions?.canWarn !== "boolean"
        || typeof json?.panels?.chat !== "boolean"
        || typeof json?.panels?.auditHistory !== "boolean"
      ) {
        return "streamer chat moderation access returned an unexpected payload.";
      }

      return null;
    },
    critical: false
  });
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

const publicPageChecks = [
  ["web home", "/", ["Maiks.yt"], true, false],
  ["account", "/account", ["Account"], false, false],
  ["public accountability", "/accountability", ["Accountability"], false, false],
  ["public actions", "/actions", ["Action Panel", "Persistent Actions"], false, false],
  ["public affiliates", "/affiliates", ["Affiliate Links", "Disclosure"], false, false],
  ["community rules", "/community-rules", ["Community Rules"], false, false],
  ["public context", "/context", ["Personal Context"], false, false],
  ["public games", "/games", ["Games"], false, false],
  ["public links", "/links", ["Maiks.yt Links"], false, false],
  ["tools actions", "/tools/actions", ["Persistent Actions"], false, true],
  ["public privacy analytics", "/privacy/analytics", ["Analytics", "Necessary Data"], false, false],
  ["public projects", "/projects", ["Projects"], false, false],
  ["public schedule", "/schedule", ["Stream Schedule"], false, false],
  ["public updates", "/updates", ["Public Updates"], false, false]
];

const createPublicPageChecks = ({ config, http }) => publicPageChecks.map(([name, path, expectedText, critical, rejectNavbar]) =>
  checkTextEndpoint({
    attempts: config.textEndpointAttempts,
    critical,
    expectedText,
    http,
    name,
    rejectNavbar,
    retryDelayMs: config.textEndpointRetryDelayMs,
    scanInjection: true,
    url: http.makeUrl(config.webUrl, path)
  })
);

const publicApiChecks = [
  ["public links API", "/links", "links"],
  ["public projects API", "/projects", "projects"],
  ["public schedule API", "/schedule", "streams"],
  ["public games API", "/games", "games"]
];

const createPublicApiChecks = ({ config, http }) => publicApiChecks.map(([name, path, arrayKey]) =>
  checkJsonEndpoint({
    http,
    name,
    url: http.makeUrl(config.apiUrl, path),
    validate: (json) => json?.ok === true && Array.isArray(json?.[arrayKey])
      ? null
      : `${name} returned an unexpected payload.`
  })
);

const pwaIconChecks = [
  ["stream tools icon", "webUrl", "/icons/maiks-tools-icon.svg"],
  ["stream tools maskable icon", "webUrl", "/icons/maiks-tools-maskable.svg"],
  ["control panel icon", "controlUrl", "/icons/maiks-tools-icon.svg"],
  ["control panel maskable icon", "controlUrl", "/icons/maiks-tools-maskable.svg"]
];

const createPwaIconChecks = ({ config, http }) => pwaIconChecks.map(([name, configKey, path]) =>
  checkTextEndpoint({
    attempts: config.textEndpointAttempts,
    expectedText: ["<svg", "Maiks.yt Stream Tools"],
    http,
    name,
    retryDelayMs: config.textEndpointRetryDelayMs,
    scanInjection: true,
    url: http.makeUrl(config[configKey], path)
  })
);

const ownerAdminPageChecks = [
  ["admin dashboard", "/admin", ["Admin", "Stream Windows", "Streamer Chat", "Moderation Window", "Control Panel", "Notifications", "Recurring Smoke"]],
  ["admin backup health", "/admin/backup/health", ["Backup Health"]],
  ["admin connections", "/admin/connections", ["Connections"]],
  ["admin event routing", "/admin/event-routing", ["Event"]],
  ["admin games", "/admin/games", ["Game"]],
  ["admin links", "/admin/links", ["Link"]],
  ["admin live helper", "/admin/live-helper", ["Live"]],
  ["admin money", "/admin/money", ["Money"]],
  ["admin moderators", "/admin/moderators", ["Moderator"]],
  ["admin pages", "/admin/pages", ["Page Creator"]],
  ["admin projects", "/admin/projects", ["Project"]],
  ["admin provider integrations", "/admin/provider-integrations", ["Provider"]],
  ["admin schedule", "/admin/schedule", ["Schedule"]],
  ["admin sessions", "/admin/sessions", ["Session"]],
  ["admin testing", "/admin/testing", ["Testing Guide", "78 passing checks", "Quick Open", "Installed Window Checklist", "Manual Testing Checklist", "Copy progress", "Reset marks", "Access Required", "Backup Health", "Sessions", "Provider Integrations", "Moderators", "Schedule Admin", "Account", "Updates", "Privacy Analytics", "Testing note", "Copy template", "Severity: blocking / annoying / polish"]],
  ["admin tokens", "/admin/tokens", ["Token"]]
];

const withDevAuthToken = ({ config, http, path, token }) => {
  const url = new URL(http.makeUrl(config.webUrl, path));
  url.searchParams.set("devAuthToken", token);
  return url.toString();
};

const checkOwnerAdminPage = async ({ config, expectedText, getDevOwnerToken, http, name, path }) => {
  const minted = await getDevOwnerToken();

  if (minted.skipped) {
    return {
      ok: true,
      name,
      message: `${name} skipped: ${minted.reason}`
    };
  }

  if (!minted.ok) {
    return {
      ok: false,
      critical: false,
      name,
      message: `${name} could not mint an owner token: ${minted.reason}`
    };
  }

  return checkTextEndpoint({
    attempts: config.textEndpointAttempts,
    expectedText,
    forbiddenText: path === "/admin"
      ? [
        "https://control-dev.maiks.yt/chat?devAuthToken=",
        "https://control-dev.maiks.yt/moderation?devAuthToken=",
        "https://control-dev.maiks.yt/control?devAuthToken=",
        "https://overlay-dev.maiks.yt/?devAuthToken="
      ]
      : [],
    http,
    name,
    retryDelayMs: config.textEndpointRetryDelayMs,
    scanInjection: true,
    url: withDevAuthToken({ config, http, path, token: minted.token })
  });
};

const createOwnerAdminPageChecks = ({ config, getDevOwnerToken, http }) =>
  ownerAdminPageChecks.map(([name, path, expectedText]) =>
    checkOwnerAdminPage({ config, expectedText, getDevOwnerToken, http, name, path })
  );

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
  ...createPublicPageChecks({ config, http }),
  checkTextEndpoint({
    attempts: config.textEndpointAttempts,
    expectedText: ["Notifications"],
    http,
    name: "notification tool",
    retryDelayMs: config.textEndpointRetryDelayMs,
    url: http.makeUrl(config.webUrl, "/tools/notifications"),
    scanInjection: true,
    rejectNavbar: true
  }),
  checkManifestEndpoint({
    expected: {
      id: "/tools/actions",
      scope: "/tools/",
      shortcutUrls: ["/tools/actions", "/tools/notifications"],
      startUrl: "/tools/actions"
    },
    http,
    name: "stream tools manifest",
    url: http.makeUrl(config.webUrl, "/manifest.webmanifest")
  }),
  checkTextEndpoint({
    attempts: config.textEndpointAttempts,
    expectedText: ["<rss version=\"2.0\">", "<title>Maiks.yt Updates</title>"],
    http,
    name: "public updates feed",
    retryDelayMs: config.textEndpointRetryDelayMs,
    url: http.makeUrl(config.webUrl, "/feed.xml"),
    scanInjection: true
  }),
  checkTextEndpoint({
    attempts: config.textEndpointAttempts,
    http,
    name: "notification service worker",
    retryDelayMs: config.textEndpointRetryDelayMs,
    url: http.makeUrl(config.webUrl, "/notification-service-worker.js"),
    scanInjection: true
  }),
  ...createOwnerAdminPageChecks({ config, getDevOwnerToken, http }),
  ...checkOwnerOperationalReadModels({ config, getDevOwnerToken, http }),
  ...createPublicApiChecks({ config, http }),
  ...createPwaIconChecks({ config, http }),
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
    scanInjection: true,
    rejectNavbar: true
  }),
  checkTextEndpoint({
    attempts: config.textEndpointAttempts,
    http,
    name: "chat window reachability",
    retryDelayMs: config.textEndpointRetryDelayMs,
    url: http.makeUrl(config.controlUrl, "/chat"),
    scanInjection: true,
    rejectNavbar: true
  }),
  checkTextEndpoint({
    attempts: config.textEndpointAttempts,
    http,
    name: "moderation window reachability",
    retryDelayMs: config.textEndpointRetryDelayMs,
    url: http.makeUrl(config.controlUrl, "/moderation"),
    scanInjection: true,
    rejectNavbar: true
  }),
  checkManifestEndpoint({
    expected: {
      id: "/control",
      scope: "/control",
      startUrl: "/control"
    },
    http,
    name: "control panel manifest",
    url: http.makeUrl(config.controlUrl, "/manifest.webmanifest")
  }),
  checkManifestEndpoint({
    expected: {
      id: "/chat",
      scope: "/chat",
      startUrl: "/chat"
    },
    http,
    name: "streamer chat manifest",
    url: http.makeUrl(config.controlUrl, "/chat-manifest.webmanifest")
  }),
  checkManifestEndpoint({
    expected: {
      id: "/moderation",
      scope: "/moderation",
      startUrl: "/moderation"
    },
    http,
    name: "moderation window manifest",
    url: http.makeUrl(config.controlUrl, "/moderation-manifest.webmanifest")
  }),
  checkStreamerChatMessages({ config, http }),
  ...createProviderChatStatusChecks({ config, http }),
  checkStreamerChatModerationAccess({ config, getDevOwnerToken, http }),
  checkBackupHealth(),
  checkBackupKeyDataExport({ config, getDevOwnerToken, http }),
  checkModerationAudit({ config, getDevOwnerToken, http }),
  checkProviderIntakeHealth({ config, getDevOwnerToken, http }),
  checkYouTubeActivitiesPoll({ config, getDevOwnerToken, http })
]);
