#!/usr/bin/env bash
# Refresh the four shipped agent presets when this cut's stamp changes.
#
# bootstrap copies presets-template with cp -rn, which leaves an existing
# volume on the previous six ids. This script overwrites the four shipped
# ids' preset.yml and agent.cordis.yml, removes only those six old
# directories, and rewrites legacy default ids in settings.yaml. Other
# directories (custom-role) are left alone. A matching stamp skips the
# copy, so a later local edit survives until the stamp changes.
#
# Docker only. bootstrap.sh calls this. There is no Windows path.
set -euo pipefail

repo="${1:?repo}"
home="${2:?home}"
cut_id="2026-10-27-presets-template-redesign"
dest="$home/desk-data/presets"
stamp="$home/.desk/presets-cut"
ids=(collab-default research-report formal-docs eng-codex)
old=(team-assistant research-assistant doc-writer meeting-secretary data-organizer dev-partner)

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
for id in "${old[@]}"; do
  rm -rf "$dest/$id"
done

python3 - "$home" << 'PY'
import pathlib, re, sys
home = pathlib.Path(sys.argv[1])
alias = {
    "team-assistant": "collab-default",
    "research-assistant": "research-report",
    "doc-writer": "formal-docs",
    "meeting-secretary": "formal-docs",
    "data-organizer": "eng-codex",
    "dev-partner": "eng-codex",
}
paths = list(home.glob("desk-test/*/settings.yaml"))
paths += list(home.glob("desk-test/*/profiles/**/*.yml"))
paths += list(home.glob("desk-test/*/profiles/**/*.yaml"))

def rewrite(text):
    lines = text.splitlines(keepends=True)
    out = []
    i = 0
    changed = False
    while i < len(lines):
        line = lines[i]
        bare = line.rstrip("\r\n")
        m = re.match(r"^(agent-presets|agent-preset-registry):\s*$", bare)
        if not m:
            out.append(line)
            i += 1
            continue
        section = m.group(1)
        nl = "\r\n" if line.endswith("\r\n") else "\n" if line.endswith("\n") else "\n"
        block = [line]
        i += 1
        while i < len(lines):
            nxt = lines[i]
            if re.match(r"^\S", nxt) and nxt.strip() != "":
                break
            block.append(nxt)
            i += 1
        new_block, did = rewrite_section(section, block, nl)
        changed = changed or did
        out.extend(new_block)
    return "".join(out), changed

def rewrite_section(section, block, nl):
    did = False
    saw_default = False
    out = [block[0]]
    for line in block[1:]:
        m = re.match(r"^(\s+)(default|selectedDefault):[ \t]*(.*?)\s*$", line.rstrip("\r\n"))
        if not m:
            out.append(line)
            continue
        indent, key, raw = m.group(1), m.group(2), m.group(3)
        token = raw.split("#", 1)[0].strip().strip('"').strip("'")
        if key == "default":
            saw_default = True
        mapped = "collab-default" if token == "" else alias.get(token)
        if mapped is None or token == mapped:
            out.append(line)
            continue
        ending = "\r\n" if line.endswith("\r\n") else "\n" if line.endswith("\n") else ""
        out.append("%s%s: %s%s" % (indent, key, mapped, ending or nl))
        did = True
    if section == "agent-presets" and not saw_default:
        out.insert(1, "  default: collab-default%s" % nl)
        did = True
    return out, did

for path in paths:
    original = path.read_text(encoding="utf-8")
    updated, changed = rewrite(original)
    if changed and updated != original:
        path.write_text(updated, encoding="utf-8")
PY

printf '%s\n' "$cut_id" > "$stamp"
echo "refreshed shipped presets ($cut_id)"
