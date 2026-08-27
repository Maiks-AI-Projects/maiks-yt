#!/usr/bin/env bash
set -euo pipefail

systemctl --user --no-pager --full status maiks-yt-local-agent.service || true
journalctl --user --unit maiks-yt-local-agent.service --lines 80 --no-pager
