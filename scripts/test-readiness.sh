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

if [ "$RUN_REVIEW" = "1" ]; then
  run_step "Review checks" pnpm check:review
else
  printf '\n==> Review checks skipped\n'
fi

run_step "Dev smoke dry-run" pnpm dev:smoke:notify -- --dry-run --fail-on-smoke-failure

if [ "$RUN_VISUAL" = "1" ]; then
  run_step "Dev visual smoke" pnpm dev:visual-smoke
else
  printf '\n==> Dev visual smoke skipped (pass --visual to include screenshots)\n'
fi

printf '\nTesting readiness checks passed.\n'
