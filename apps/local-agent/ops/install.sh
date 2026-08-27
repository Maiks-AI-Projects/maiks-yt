#!/usr/bin/env bash
set -euo pipefail

script_dir="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
app_root="$(cd -- "${script_dir}/.." && pwd)"
entry_path="${app_root}/dist/main.js"
node_path="$(command -v node)"
unit_dir="${XDG_CONFIG_HOME:-${HOME}/.config}/systemd/user"
agent_config_dir="${XDG_CONFIG_HOME:-${HOME}/.config}/maiks-yt/local-agent"
agent_state_dir="${XDG_STATE_HOME:-${HOME}/.local/state}/maiks-yt/local-agent"
unit_path="${unit_dir}/maiks-yt-local-agent.service"

if [[ ! -f "${entry_path}" ]]; then
  echo "Missing ${entry_path}. Run: pnpm --filter @maiks-yt/local-agent build" >&2
  exit 1
fi

mkdir -p -- "${unit_dir}" "${agent_config_dir}" "${agent_state_dir}"
chmod 700 -- "${agent_config_dir}" "${agent_state_dir}"

if [[ ! -f "${agent_config_dir}/config" ]]; then
  install -m 600 -- "${script_dir}/config.example" "${agent_config_dir}/config"
fi

escaped_app_root="${app_root//&/\\&}"
escaped_entry_path="${entry_path//&/\\&}"
escaped_node_path="${node_path//&/\\&}"
sed \
  -e "s&@APP_ROOT@&${escaped_app_root}&g" \
  -e "s&@APP_ENTRY@&${escaped_entry_path}&g" \
  -e "s&@NODE_BIN@&${escaped_node_path}&g" \
  "${script_dir}/maiks-yt-local-agent.service" > "${unit_path}"
chmod 644 -- "${unit_path}"
systemctl --user daemon-reload

echo "Installed ${unit_path}."
echo "Edit ${agent_config_dir}/config and provision a mode-600 device-token before enabling."
echo "This helper did not enable or start the service."
