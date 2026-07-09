export const defaultConfig = {
  apiUrl: "https://api-dev.maiks.yt",
  webUrl: "https://web-dev.maiks.yt",
  overlayUrl: "https://overlay-dev.maiks.yt",
  controlUrl: "https://control-dev.maiks.yt",
  notificationPath: "/dev/notifications",
  ownerTokenPath: "/dev/testing/owner-token",
  providerIntakeHealthPath: "/admin/connections/intake/health",
  youtubeActivitiesPollPath: "/admin/provider-integrations/youtube-activities/poll",
  stateFile: "/tmp/maiks-yt-dev-smoke-state.json",
  duplicateCooldownMs: 12 * 60 * 60 * 1000,
  timeoutMs: 30_000,
  dryRun: false,
  forceNotify: false,
  notifyRecovery: true,
  failOnSmokeFailure: false
};

export const usage = () => `
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

const readOption = (args, name) => {
  const index = args.indexOf(name);

  if (index === -1) {
    return undefined;
  }

  return args[index + 1];
};

const parseNumberOption = (args, name, fallback) => {
  const rawValue = readOption(args, name);

  if (rawValue === undefined) {
    return fallback;
  }

  const parsed = Number(rawValue);

  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new Error(`${name} must be a positive number.`);
  }

  return parsed;
};

export const parseConfig = (args) => ({
  ...defaultConfig,
  apiUrl: readOption(args, "--api-url") ?? defaultConfig.apiUrl,
  webUrl: readOption(args, "--web-url") ?? defaultConfig.webUrl,
  overlayUrl: readOption(args, "--overlay-url") ?? defaultConfig.overlayUrl,
  controlUrl: readOption(args, "--control-url") ?? defaultConfig.controlUrl,
  stateFile: readOption(args, "--state-file") ?? defaultConfig.stateFile,
  duplicateCooldownMs: parseNumberOption(
    args,
    "--duplicate-cooldown-minutes",
    defaultConfig.duplicateCooldownMs / 60_000
  ) * 60_000,
  timeoutMs: parseNumberOption(args, "--timeout-ms", defaultConfig.timeoutMs),
  dryRun: args.includes("--dry-run"),
  forceNotify: args.includes("--force-notify"),
  notifyRecovery: !args.includes("--no-recovery-notice"),
  failOnSmokeFailure: args.includes("--fail-on-smoke-failure")
});
