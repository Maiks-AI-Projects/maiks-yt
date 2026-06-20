#!/usr/bin/env bash
set -euo pipefail

message=""
server="codex-server-1"
server_project="/var/projects/maiks-yt-dev"
server_container="maiks-yt-dev"
skip_typecheck=0
skip_server_pull=0
skip_server_package_build=0

usage() {
  cat <<'USAGE'
Usage:
  scripts/push-dev.sh --message "commit message" [options]

Options:
  -m, --message <text>              Commit message. Required.
  --server <host>                   SSH host. Default: codex-server-1.
  --server-project <path>           Server project path. Default: /var/projects/maiks-yt-dev.
  --server-container <name>         Server container name. Default: maiks-yt-dev.
  --skip-typecheck                  Skip local web typecheck.
  --skip-server-pull                Skip server git pull and package build.
  --skip-server-package-build       Skip server shared package build.
  -h, --help                        Show this help.
USAGE
}

run_step() {
  local title="$1"
  shift

  printf '==> %s\n' "$title"
  "$@"
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    -m|--message)
      if [[ $# -lt 2 || -z "${2:-}" ]]; then
        echo "Missing value for $1." >&2
        exit 2
      fi
      message="$2"
      shift 2
      ;;
    --server)
      if [[ $# -lt 2 || -z "${2:-}" ]]; then
        echo "Missing value for $1." >&2
        exit 2
      fi
      server="$2"
      shift 2
      ;;
    --server-project)
      if [[ $# -lt 2 || -z "${2:-}" ]]; then
        echo "Missing value for $1." >&2
        exit 2
      fi
      server_project="$2"
      shift 2
      ;;
    --server-container)
      if [[ $# -lt 2 || -z "${2:-}" ]]; then
        echo "Missing value for $1." >&2
        exit 2
      fi
      server_container="$2"
      shift 2
      ;;
    --skip-typecheck)
      skip_typecheck=1
      shift
      ;;
    --skip-server-pull)
      skip_server_pull=1
      shift
      ;;
    --skip-server-package-build)
      skip_server_package_build=1
      shift
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      echo "Unknown argument: $1" >&2
      usage >&2
      exit 2
      ;;
  esac
done

if [[ -z "$message" ]]; then
  echo "Missing required --message." >&2
  usage >&2
  exit 2
fi

branch="$(git branch --show-current | tr -d '[:space:]')"
if [[ "$branch" != "main" ]]; then
  echo "Expected local branch 'main', but current branch is '$branch'." >&2
  exit 1
fi

if [[ -z "$(git status --short)" ]]; then
  echo "No local changes to commit." >&2
  exit 1
fi

if [[ "$skip_typecheck" -eq 0 ]]; then
  run_step "Typechecking web app" pnpm --filter @maiks-yt/web typecheck
fi

run_step "Staging local changes" git add -A
run_step "Committing local changes" git commit -m "$message"
run_step "Pushing main" git push origin main
run_step "Mirroring main to dev" git push origin main:dev

if [[ "$skip_server_pull" -eq 0 ]]; then
  run_step "Pulling dev on server" \
    ssh "$server" "cd '$server_project' && git pull --ff-only origin dev && git status --short"

  if [[ "$skip_server_package_build" -eq 0 ]]; then
    run_step "Building shared packages on server" \
      ssh "$server" "docker exec $server_container sh -lc 'pnpm --filter @maiks-yt/config --filter @maiks-yt/database --filter @maiks-yt/domain --filter @maiks-yt/events --filter @maiks-yt/integrations --filter @maiks-yt/testing --filter @maiks-yt/themes --filter @maiks-yt/ui build'"
  fi
fi

run_step "Done" git status --short
