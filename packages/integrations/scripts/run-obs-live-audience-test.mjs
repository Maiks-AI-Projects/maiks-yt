import { randomInt } from "node:crypto";
import { readFile } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";

import { ChatClient } from "@twurple/chat";

const defaultControlTokenFile = join(homedir(), ".config", "maiks-yt", "codex-control-token");
const defaultTwitchConfigFile = join(homedir(), ".config", "twitch-cli", ".twitch-cli.env");

const eventFixtures = [
  { actionLabel: "followed the safehouse signal", kind: "follow", priority: "normal" },
  { actionLabel: "subscribed for another month", kind: "subscription", priority: "important" },
  { actionLabel: "cheered 100 bits", kind: "bits", priority: "normal" },
  { actionLabel: "gifted a subscription", kind: "gifted-sub", priority: "important" },
  { actionLabel: "was heard over the emergency radio", kind: "community-highlight", priority: "normal" }
];

const parsePositiveInteger = (value, optionName) => {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error(`${optionName} must be a positive integer.`);
  }
  return parsed;
};

const readOptions = (args) => {
  const options = {
    apiBaseUrl: "https://api.maiks.yt",
    channel: "cynetrunner",
    controlTokenFile: process.env.MAIKS_CODEX_CONTROL_TOKEN_FILE ?? defaultControlTokenFile,
    dryRun: false,
    durationSeconds: 10 * 60,
    minIntervalSeconds: 8,
    twitchConfigFile: process.env.TWITCH_CLI_CONFIG_FILE ?? defaultTwitchConfigFile
  };

  for (let index = 0; index < args.length; index += 1) {
    const argument = args[index];
    const value = args[index + 1];
    if (argument === "--") continue;
    if (argument === "--dry-run") {
      options.dryRun = true;
      continue;
    }
    if (argument === "--channel" && value) {
      options.channel = value.replace(/^#/, "").trim().toLowerCase();
      index += 1;
      continue;
    }
    if (argument === "--duration-seconds" && value) {
      options.durationSeconds = parsePositiveInteger(value, argument);
      index += 1;
      continue;
    }
    if (argument === "--min-interval-seconds" && value) {
      options.minIntervalSeconds = parsePositiveInteger(value, argument);
      index += 1;
      continue;
    }
    if (argument === "--api-base-url" && value) {
      options.apiBaseUrl = new URL(value).origin;
      index += 1;
      continue;
    }
    if (argument === "--control-token-file" && value) {
      options.controlTokenFile = value;
      index += 1;
      continue;
    }
    if (argument === "--twitch-config-file" && value) {
      options.twitchConfigFile = value;
      index += 1;
      continue;
    }
    throw new Error(`Unknown or incomplete option: ${argument}`);
  }

  if (!/^[a-z0-9_]{1,25}$/.test(options.channel)) {
    throw new Error("--channel must be a valid Twitch login.");
  }
  return options;
};

const parseEnvFile = (contents) => Object.fromEntries(
  contents.split(/\r?\n/u).flatMap((line) => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) return [];
    const separator = trimmed.indexOf("=");
    if (separator < 1) return [];
    const key = trimmed.slice(0, separator).trim();
    const rawValue = trimmed.slice(separator + 1).trim();
    const value = rawValue.replace(/^(['"])(.*)\1$/u, "$2");
    return [[key, value]];
  })
);

const postJson = async (url, body) => {
  const response = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(10_000)
  });
  const result = await response.json().catch(() => null);
  if (!response.ok || result?.ok !== true) {
    const reason = typeof result?.reason === "string" ? result.reason : `http_${response.status}`;
    throw new Error(`${new URL(url).pathname} failed: ${reason}`);
  }
  return result;
};

const createAppAccessToken = async ({ clientId, clientSecret }) => {
  const url = new URL("https://id.twitch.tv/oauth2/token");
  url.searchParams.set("client_id", clientId);
  url.searchParams.set("client_secret", clientSecret);
  url.searchParams.set("grant_type", "client_credentials");
  const response = await fetch(url, { method: "POST", signal: AbortSignal.timeout(10_000) });
  const payload = await response.json().catch(() => null);
  if (!response.ok || typeof payload?.access_token !== "string") {
    throw new Error("Twitch app authentication failed.");
  }
  return payload.access_token;
};

const createAvatarResolver = ({ accessToken, clientId }) => {
  const cache = new Map();
  return async ({ userId, userName }) => {
    const key = userId || userName.toLowerCase();
    if (cache.has(key)) return cache.get(key);
    const url = new URL("https://api.twitch.tv/helix/users");
    url.searchParams.set(userId ? "id" : "login", userId || userName);
    const response = await fetch(url, {
      headers: { Authorization: `Bearer ${accessToken}`, "Client-Id": clientId },
      signal: AbortSignal.timeout(10_000)
    });
    const payload = await response.json().catch(() => null);
    const avatarUrl = response.ok && typeof payload?.data?.[0]?.profile_image_url === "string"
      ? payload.data[0].profile_image_url
      : null;
    cache.set(key, avatarUrl);
    return avatarUrl;
  };
};

const main = async () => {
  const options = readOptions(process.argv.slice(2));
  if (options.dryRun) {
    console.log(`Dry run complete: would listen read-only to #${options.channel} for ${options.durationSeconds}s.`);
    return;
  }

  const [controlToken, twitchConfigContents] = await Promise.all([
    readFile(options.controlTokenFile, "utf8").then((value) => value.trim()),
    readFile(options.twitchConfigFile, "utf8")
  ]);
  const twitchConfig = parseEnvFile(twitchConfigContents);
  const clientId = twitchConfig.CLIENTID;
  const clientSecret = twitchConfig.CLIENTSECRET;
  if (controlToken.length < 24) throw new Error("The control token is missing or invalid.");
  if (!clientId || !clientSecret) throw new Error("Twitch CLI app credentials are not configured.");

  const validation = await postJson(`${options.apiBaseUrl}/access/url-token/validate`, {
    token: controlToken,
    surface: "control-panel",
    scope: "control:open"
  });
  if (validation.valid !== true) throw new Error("The control token was rejected.");

  const appAccessToken = await createAppAccessToken({ clientId, clientSecret });
  const resolveAvatar = createAvatarResolver({ accessToken: appAccessToken, clientId });
  const client = new ChatClient({ channels: [options.channel], readOnly: true });
  const deadline = Date.now() + options.durationSeconds * 1_000;
  let lastSentAt = 0;
  let pairsSent = 0;
  let processing = false;

  client.onMessage((_channel, userName, text, message) => {
    if (processing || Date.now() >= deadline || Date.now() - lastSentAt < options.minIntervalSeconds * 1_000) return;
    processing = true;
    void (async () => {
      try {
        const actorName = message.userInfo.displayName?.trim() || userName;
        const avatarUrl = await resolveAvatar({
          userId: message.userInfo.userId || null,
          userName
        });
        const event = eventFixtures[randomInt(eventFixtures.length)];
        await postJson(`${options.apiBaseUrl}/overlay/live-audience/test`, {
          accessToken: controlToken,
          actorName,
          actionLabel: event.actionLabel,
          ...(avatarUrl ? { avatarUrl } : {}),
          kind: event.kind,
          message: text,
          platform: "twitch",
          priority: event.priority
        });
        lastSentAt = Date.now();
        pairsSent += 1;
        console.log(`[${pairsSent}] Mirrored ${actorName}: chat + randomized test event.`);
      } catch (error) {
        console.error(error instanceof Error ? error.message : "Audience activity pair failed.");
      } finally {
        processing = false;
      }
    })();
  });

  await client.connect();
  console.log(`Listening read-only to #${options.channel} for ${options.durationSeconds}s; no Twitch writes are enabled.`);
  await new Promise((resolve) => setTimeout(resolve, options.durationSeconds * 1_000));
  client.quit();
  console.log(`Live audience test finished; ${pairsSent} chat/event pairs sent to Maiks.yt.`);
};

main().catch((error) => {
  console.error(error instanceof Error ? error.message : "OBS live audience test failed.");
  process.exitCode = 1;
});
