#!/usr/bin/env bash
set -euo pipefail

unit_dir="${XDG_CONFIG_HOME:-${HOME}/.config}/systemd/user"
unit_path="${unit_dir}/maiks-yt-local-agent.service"

systemctl --user disable --now maiks-yt-local-agent.service 2>/dev/null || true
if [[ -f "${unit_path}" ]]; then
  rm -- "${unit_path}"
fi
systemctl --user daemon-reload
systemctl --user reset-failed maiks-yt-local-agent.service 2>/dev/null || true

echo "Removed ${unit_path}."
echo "Credential, configuration, and dedupe state were preserved."
