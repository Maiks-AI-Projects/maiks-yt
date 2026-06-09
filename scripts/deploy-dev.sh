#!/usr/bin/env sh
set -eu

PROJECT_DIR="${PROJECT_DIR:-/var/projects/maiks-yt-dev}"
BRANCH="${BRANCH:-dev}"
REMOTE="${REMOTE:-https://github.com/Maiks-AI-Projects/maiks-yt.git}"

cd "$PROJECT_DIR"

if [ ! -d .git ]; then
  echo "==> Initializing git checkout"
  git init
  git remote add origin "$REMOTE"
fi

echo "==> Fetching $BRANCH"
git fetch origin "$BRANCH"
git checkout "$BRANCH"
git reset --hard "origin/$BRANCH"
git clean -fd -e .env -e ".env.*"

echo "==> Building dev image"
docker compose build maiks-yt-dev

echo "==> Starting dev service"
docker compose up -d maiks-yt-dev

echo "==> Current status"
docker compose ps
