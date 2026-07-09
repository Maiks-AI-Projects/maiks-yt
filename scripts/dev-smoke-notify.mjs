#!/usr/bin/env node

import { createDevOwnerTokenGetter } from "./dev-smoke/auth.mjs";
import { runChecks } from "./dev-smoke/checks.mjs";
import { parseConfig, usage } from "./dev-smoke/config.mjs";
import { createHttpClient } from "./dev-smoke/http.mjs";
import { formatFailures, postNotification } from "./dev-smoke/notifications.mjs";
import { hashFailures, readState, writeState } from "./dev-smoke/state.mjs";

const args = process.argv.slice(2);

if (args.includes("--help") || args.includes("-h")) {
  console.log(usage().trim());
  process.exit(0);
}

const config = parseConfig(args);
const http = createHttpClient(config);
const getDevOwnerToken = createDevOwnerTokenGetter({ config, http });

const main = async () => {
  const startedAt = new Date();
  const results = await runChecks({ config, getDevOwnerToken, http });
  const failures = results.filter((result) => !result.ok);
  const state = await readState(config.stateFile);
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
        body: `Automated dev smoke found ${failures.length} issue(s).\n\n${formatFailures(failures)}`,
        config,
        http,
        severity,
        title: severity === "critical" ? "Dev smoke critical failure" : "Dev smoke warning"
      });

      if (!posted.ok) {
        console.error(`Notification post failed: ${posted.reason}`);
      } else {
        console.log("Failure notification posted.");
      }
    }

    if (!config.dryRun) {
      await writeState(config.stateFile, {
        hadActiveFailure: true,
        lastFailureNotifiedAt: duplicateIsCoolingDown && !config.forceNotify
          ? state.lastFailureNotifiedAt
          : new Date(now).toISOString(),
        lastFailureSignature: signature
      });
    }

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
        body: "Automated dev smoke checks are passing again.",
        config,
        http,
        severity: "info",
        title: "Dev smoke recovered"
      });

      if (!posted.ok) {
        console.error(`Recovery notification post failed: ${posted.reason}`);
      } else {
        console.log("Recovery notification posted.");
      }
    }
  }

  if (!config.dryRun) {
    await writeState(config.stateFile, {
      hadActiveFailure: false,
      lastSuccessAt: new Date(now).toISOString()
    });
  }
};

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
