#!/usr/bin/env bash
# Refresh the six shipped agent presets when this cut's stamp changes.
#
# bootstrap copies presets-template with cp -rn, which leaves an existing
# volume on the old copy (team-assistant still saying 示例预设, dev-partner
# Codex row still disabled). This script overwrites only the six shipped
# ids' preset.yml and agent.cordis.yml. Other directories under presets/
# are left alone. A matching stamp skips the copy, so a later local edit
# survives until the stamp changes.
#
# Docker only. bootstrap.sh calls this. There is no Windows path.
set -euo pipefail

repo="${1:?repo}"
home="${2:?home}"
cut_id="2026-10-26-agent-presets-tune"
dest="$home/desk-data/presets"
stamp="$home/.desk/presets-cut"
ids=(team-assistant research-assistant doc-writer data-organizer dev-partner meeting-secretary)

current=""
if [ -f "$stamp" ]; then
  current="$(tr -d '\r\n' < "$stamp")"
fi
if [ "$current" = "$cut_id" ]; then
  echo "skip shipped presets ($cut_id)"
  exit 0
fi

mkdir -p "$dest" "$home/.desk"
for id in "${ids[@]}"; do
  src="$repo/presets-template/$id"
  if [ ! -f "$src/preset.yml" ] || [ ! -f "$src/agent.cordis.yml" ]; then
    echo "missing shipped preset $id" >&2
    exit 1
  fi
  mkdir -p "$dest/$id"
  cp -f "$src/preset.yml" "$dest/$id/preset.yml"
  cp -f "$src/agent.cordis.yml" "$dest/$id/agent.cordis.yml"
done
printf '%s\n' "$cut_id" > "$stamp"
echo "refreshed shipped presets ($cut_id)"
