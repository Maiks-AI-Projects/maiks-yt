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

run_step "Build all packages and apps" pnpm build
run_step "Typecheck all packages and apps" pnpm typecheck
run_step "Run all tests" pnpm test
run_step "Production image provenance tests" pnpm test:production-image-provenance
run_step "Production OpenBao configuration tests" pnpm test:production-openbao-config
run_step "Architecture rules" pnpm check:architecture
run_step "Diff whitespace check" git diff --check

printf '\nFull checks passed.\n'
