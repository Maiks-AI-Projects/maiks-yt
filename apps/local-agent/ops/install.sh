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
backup_dir="${agent_config_dir}/backups"
timestamp="$(date -u +%Y%m%dT%H%M%SZ)"
dry_run=false

for argument in "$@"; do
  case "${argument}" in
    --dry-run)
      dry_run=true
      ;;
    -h|--help)
      echo "Usage: $0 [--dry-run]"
      echo "Renders the user-level Maiks.yt Local Agent unit and config skeleton."
      echo "Existing config, token, state, and unit files are preserved or backed up."
      exit 0
      ;;
    *)
      echo "Unknown argument: ${argument}" >&2
      exit 2
      ;;
  esac
done

run() {
  if [[ "${dry_run}" == true ]]; then
    printf '+'
    printf ' %q' "$@"
    printf '\n'
  else
    "$@"
  fi
}

backup_existing() {
  local path_to_backup="$1"
  local label="$2"

  if [[ ! -e "${path_to_backup}" ]]; then
    return
  fi

  run mkdir -p -- "${backup_dir}"
  run chmod 700 -- "${backup_dir}"
  run cp -a -- "${path_to_backup}" "${backup_dir}/${label}.${timestamp}.bak"
}

if [[ ! -f "${entry_path}" ]]; then
  echo "Missing ${entry_path}. Run: pnpm --filter @maiks-yt/local-agent build" >&2
  exit 1
fi

run mkdir -p -- "${unit_dir}" "${agent_config_dir}" "${agent_state_dir}"
run chmod 700 -- "${agent_config_dir}" "${agent_state_dir}"

if [[ ! -f "${agent_config_dir}/config" ]]; then
  run install -m 600 -- "${script_dir}/config.example" "${agent_config_dir}/config"
else
  backup_existing "${agent_config_dir}/config" "config"
fi

if [[ -f "${agent_config_dir}/device-token" ]]; then
  backup_existing "${agent_config_dir}/device-token" "device-token"
fi

backup_existing "${unit_path}" "maiks-yt-local-agent.service"

escaped_app_root="${app_root//&/\\&}"
escaped_entry_path="${entry_path//&/\\&}"
escaped_node_path="${node_path//&/\\&}"
if [[ "${dry_run}" == true ]]; then
  echo "+ render ${unit_path} from ${script_dir}/maiks-yt-local-agent.service"
  echo "+ chmod 644 ${unit_path}"
  echo "+ systemctl --user daemon-reload"
else
  sed \
    -e "s&@APP_ROOT@&${escaped_app_root}&g" \
    -e "s&@APP_ENTRY@&${escaped_entry_path}&g" \
    -e "s&@NODE_BIN@&${escaped_node_path}&g" \
    "${script_dir}/maiks-yt-local-agent.service" > "${unit_path}"
  chmod 644 -- "${unit_path}"
  systemctl --user daemon-reload
fi

if [[ "${dry_run}" == true ]]; then
  echo "Dry run complete for ${unit_path}."
else
  echo "Installed ${unit_path}."
fi
echo "Edit ${agent_config_dir}/config and provision a mode-600 device-token before enabling."
echo "This helper did not enable or start the service."
