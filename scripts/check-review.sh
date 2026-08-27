#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

run_step() {
  local label="$1"
  shift

  printf '\n==> %s\n' "$label"
  "$@"
}

run_step "Build shared workspace packages" \
  pnpm --filter @maiks-yt/config \
    --filter @maiks-yt/database \
    --filter @maiks-yt/domain \
    --filter @maiks-yt/events \
    --filter @maiks-yt/integrations \
    --filter @maiks-yt/testing \
    --filter @maiks-yt/themes \
    --filter @maiks-yt/ui \
    build

run_step "Domain tests" pnpm --filter @maiks-yt/domain test
run_step "Database typecheck" pnpm --filter @maiks-yt/database typecheck
run_step "API tests" pnpm --filter @maiks-yt/api test
run_step "API typecheck" pnpm --filter @maiks-yt/api typecheck
run_step "Web build" pnpm --filter @maiks-yt/web build
run_step "Overlay typecheck" pnpm --filter @maiks-yt/overlay typecheck
run_step "Control panel typecheck" pnpm --filter @maiks-yt/control-panel typecheck
run_step "Local agent tests" pnpm --filter @maiks-yt/local-agent test
run_step "Local agent typecheck" pnpm --filter @maiks-yt/local-agent typecheck
run_step "Architecture rules" pnpm check:architecture
run_step "Diff whitespace check" git diff --check

printf '\nReview checks passed.\n'
