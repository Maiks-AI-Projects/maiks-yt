#!/usr/bin/env sh
set -eu

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT_DIR"

RUN_REVIEW=1
RUN_VISUAL=0

usage() {
  cat <<'EOF'
Usage: scripts/test-readiness.sh [options]

Runs the standard local review checks plus the dev smoke dry-run used by the
scheduled failure notifier. Add --visual when screenshot coverage is needed.

Options:
  --skip-review   Skip pnpm check:review.
  --visual        Also run pnpm dev:visual-smoke.
  --help          Show this help.
EOF
}

for arg in "$@"; do
  case "$arg" in
    --)
      ;;
    --skip-review)
      RUN_REVIEW=0
      ;;
    --visual)
      RUN_VISUAL=1
      ;;
    --help|-h)
      usage
      exit 0
      ;;
    *)
      printf 'Unknown option: %s\n\n' "$arg" >&2
      usage >&2
      exit 2
      ;;
  esac
done

run_step() {
  local label="$1"
  shift

  printf '\n==> %s\n' "$label"
  "$@"
}

wait_for_dev_api() {
  node --input-type=module <<'NODE'
const url = process.env.DEV_READINESS_HEALTH_URL ?? "https://api-dev.maiks.yt/health";
const attempts = Number(process.env.DEV_READINESS_HEALTH_ATTEMPTS ?? "30");
const delayMs = Number(process.env.DEV_READINESS_HEALTH_DELAY_MS ?? "2000");

const sleep = (ms) => new Promise((resolve) => {
  setTimeout(resolve, ms);
});

for (let attempt = 1; attempt <= attempts; attempt += 1) {
  try {
    const response = await fetch(url, {
      headers: {
        Accept: "application/json"
      },
      signal: AbortSignal.timeout(5_000)
    });
    const payload = await response.json().catch(() => null);

    if (response.ok && payload?.ok === true) {
      console.log(`Dev API ready on attempt ${attempt}.`);
      process.exit(0);
    }

    console.log(`Dev API not ready on attempt ${attempt}: HTTP ${response.status}.`);
  } catch (error) {
    console.log(`Dev API not ready on attempt ${attempt}: ${error instanceof Error ? error.message : String(error)}.`);
  }

  if (attempt < attempts) {
    await sleep(delayMs);
  }
}

console.error(`Dev API did not become ready at ${url}.`);
process.exit(1);
NODE
}

if [ "$RUN_REVIEW" = "1" ]; then
  run_step "Review checks" pnpm check:review
else
  printf '\n==> Review checks skipped\n'
fi

run_step "Wait for dev API" wait_for_dev_api
run_step "Dev smoke dry-run" pnpm dev:smoke:notify -- --dry-run --fail-on-smoke-failure
run_step "Readiness docs" node scripts/check-readiness-docs.mjs

if [ "$RUN_VISUAL" = "1" ]; then
  run_step "Dev visual smoke" pnpm dev:visual-smoke
else
  printf '\n==> Dev visual smoke skipped (pass --visual to include screenshots)\n'
fi

printf '\nTesting readiness checks passed.\n'
