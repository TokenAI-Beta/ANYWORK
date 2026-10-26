# -*- coding: utf-8 -*-
"""Docker image only: make the six role ids real agent presets.

Cut 2026-10-27 features-connect-use-path AC1 fix. Playtest on #22
(tip 5b826575) showed two failures:

- 用此角色新建会话 sent the portal id (dev-partner) and the engine
  answered agent-preset/not-found. On dsh-v0.2.1-rc.3 the registry does
  not scan DSH_HOME/.agent-presets. A preset exists only as a
  @deepseek-ai/dsh-agent-preset row, and config.id is the id sessions
  store. The shipped rows are standard / ptc / minimal / cordis.
- 设为默认 called settings.update with two arguments. The client proxy
  requires three (the revision fence). That call is fixed in
  dsh-features-connect-use-path.py. This script registers the ids that
  write and the new session both name.

Each role is the shipped standard composition (presets/standard.patch.yml)
with that role's name, description, order, and persona prefix. 开发搭档
also gets the Codex tool row the badge describes. The four engine rows
are not edited. The mode chip keeps only shipped presets (isBuiltInPreset),
so the six roles do not become extra items in 标准 / PTC / 极简 / 创造.

Runs after dsh-agent-preset-mode-hint.py and before pnpm build, so the
chip filter is in the client bundle. DSH_SRC and PRESETS_SRC are
required. There is no home-directory default.
"""
import io
import json
import os
import sys

MARKER = "cut 2026-10-27 features-connect-use-path ac1"
ROLES = (
    "team-assistant",
    "research-assistant",
    "doc-writer",
    "data-organizer",
    "dev-partner",
    "meeting-secretary",
)
STANDARD = "packages/bundle/web-app/presets/standard.patch.yml"
PKG = "packages/bundle/web-app/package.json"
SEAT = "packages/client/ui-agent-preset/src/client/AgentPresetSeat.tsx"
PREFIX_LINE = "              prefix: You are a coding agent powered by the {{model}} model.\n"
ID_BLOCK = "        id: standard\n        order: 1\n"
ROW_ID = "    - id: preset-standard\n"
CODEX_ANCHOR = (
    "              - id: tool-subagent-fork\n"
    "                name: '@deepseek-ai/dsh-tool-subagent'\n"
    "                config:\n"
    "                  provider: fork\n"
    "                  toolName: subagent_fork\n"
    "              - id: workflow-ptc\n"
)
CODEX_ROW = (
    "              - id: tool-subagent-fork\n"
    "                name: '@deepseek-ai/dsh-tool-subagent'\n"
    "                config:\n"
    "                  provider: fork\n"
    "                  toolName: subagent_fork\n"
    "              - id: tool-subagent-codex\n"
    "                name: '@deepseek-ai/dsh-tool-subagent'\n"
    "                config:\n"
    "                  provider: codex\n"
    "                  toolName: subagent_codex\n"
    "              - id: workflow-ptc\n"
)
SEAT_IMPORT_OLD = "import { presetDisplayText } from './locales.ts'\n"
SEAT_IMPORT_NEW = "import { isBuiltInPreset, presetDisplayText } from './locales.ts'\n"
SEAT_FILTER_OLD = (
    "  const options = useMemo(\n"
    "    () => state.options.filter(option => developerTools || !requiresCodingTools(option)),\n"
    "    [state.options, developerTools],\n"
    "  )\n"
)
SEAT_FILTER_NEW = (
    "  // %s: mode chip stays the four shipped presets. Role rows are\n"
    "  // registry ids for Settings and the role cards, not extra menu items.\n"
    "  const options = useMemo(\n"
    "    () => state.options.filter(option => isBuiltInPreset(option) && (developerTools || !requiresCodingTools(option))),\n"
    "    [state.options, developerTools],\n"
    "  )\n"
) % MARKER


def read(path):
    if not os.path.isfile(path):
        sys.exit("missing %s" % path)
    return io.open(path, encoding="utf-8").read()


def write(path, text):
    io.open(path, "w", encoding="utf-8").write(text)


def once(text, old, label):
    count = text.count(old)
    if count != 1:
        sys.exit("anchor count=%d in %s (expect 1)" % (count, label))
    return text


def flat_yaml(src):
    out = {}
    for line in src.splitlines():
        if line[:1].isspace() or not line.strip():
            continue
        if ":" not in line:
            continue
        key, value = line.split(":", 1)
        out[key.strip()] = value.strip()
    return out


def persona_prefix(src):
    lines = src.splitlines()
    start = None
    for index, line in enumerate(lines):
        if line.strip() == "prefix: >-":
            start = index + 1
            break
    if start is None:
        sys.exit("persona prefix missing")
    body = []
    for line in lines[start:]:
        if line.startswith("    suffix:") or (line and not line[:1].isspace()):
            break
        text = line.strip()
        if text:
            body.append(text)
    if not body:
        sys.exit("persona prefix empty")
    return "\n".join(body)


def yaml_prefix(prefix):
    lines = ["              prefix: |"]
    for line in prefix.split("\n"):
        lines.append("                " + line)
    return "\n".join(lines) + "\n"


def role_patch(standard, role_id, meta, prefix, codex):
    text = standard
    text = once(text, ROW_ID, "preset row id").replace(ROW_ID, "    - id: preset-%s\n" % role_id, 1)
    block = (
        "        id: %s\n"
        "        name: %s\n"
        "        description: %s\n"
        "        order: %s\n"
    ) % (role_id, json.dumps(meta["name"], ensure_ascii=False), json.dumps(meta["description"], ensure_ascii=False), meta["order"])
    text = once(text, ID_BLOCK, "preset id").replace(ID_BLOCK, block, 1)
    text = once(text, PREFIX_LINE, "persona prefix").replace(PREFIX_LINE, yaml_prefix(prefix), 1)
    if codex:
        text = once(text, CODEX_ANCHOR, "codex anchor").replace(CODEX_ANCHOR, CODEX_ROW, 1)
    header = (
        "# %s\n"
        "# Portal role %s, registered because rc.3 does not scan .agent-presets.\n"
        "# Same plugin list as preset-standard; persona is this role.\n"
    ) % (MARKER, role_id)
    return header + text


def package_lists(pkg):
    patch_lines = ['        "./presets/%s.patch.yml"' % role for role in ROLES]
    extra_patch = ",\n".join(patch_lines) + "\n"
    extra_files = "".join('    "presets/%s.patch.yml",\n' % role for role in ROLES)
    patch_old = '        "./presets/cordis.patch.yml"\n      ]'
    files_old = '    "presets/cordis.patch.yml",\n'
    pkg = once(pkg, patch_old, "bundle patch list").replace(
        patch_old,
        '        "./presets/cordis.patch.yml",\n' + extra_patch + "      ]",
        1,
    )
    pkg = once(pkg, files_old, "files list").replace(files_old, files_old + extra_files, 1)
    return pkg


def seat_text(seat):
    seat = once(seat, SEAT_IMPORT_OLD, "seat import").replace(SEAT_IMPORT_OLD, SEAT_IMPORT_NEW, 1)
    seat = once(seat, SEAT_FILTER_OLD, "seat filter").replace(SEAT_FILTER_OLD, SEAT_FILTER_NEW, 1)
    return seat


def ok(root, standard_before):
    pkg = read(os.path.join(root, PKG))
    seat = read(os.path.join(root, SEAT))
    standard = read(os.path.join(root, STANDARD))
    if standard != standard_before:
        return False
    if MARKER not in seat or "isBuiltInPreset(option)" not in seat:
        return False
    if 'import { isBuiltInPreset, presetDisplayText }' not in seat:
        return False
    for role in ROLES:
        if role in seat:
            return False
        rel = "presets/%s.patch.yml" % role
        if '"./%s"' % rel not in pkg or '"%s"' % rel not in pkg:
            return False
        body = read(os.path.join(root, "packages/bundle/web-app", rel))
        if body.count(MARKER) != 1:
            return False
        if "id: preset-%s\n" % role not in body:
            return False
        if "\n        id: %s\n" % role not in body:
            return False
        if "id: standard\n" in body or "id: preset-standard\n" in body:
            return False
        meta = flat_yaml(read(os.path.join(os.environ["PRESETS_SRC"], role, "preset.yml")))
        if json.dumps(meta["name"], ensure_ascii=False) not in body:
            return False
        prefix = persona_prefix(read(os.path.join(os.environ["PRESETS_SRC"], role, "agent.cordis.yml")))
        if prefix.split("\n", 1)[0] not in body:
            return False
        has_codex = "toolName: subagent_codex" in body
        if has_codex != (role == "dev-partner"):
            return False
    for mode in ("presetStandardName", "presetPtcName", "presetMinimalName", "presetCordisName"):
        if mode in seat:
            return False
    return True


def main():
    root = os.environ.get("DSH_SRC", "").strip()
    presets = os.environ.get("PRESETS_SRC", "").strip()
    if not root or not presets:
        sys.exit(
            "DSH_SRC and PRESETS_SRC are required. "
            "The image build sets them. This patch does not target a native install."
        )
    os.environ["PRESETS_SRC"] = presets
    pkg_path = os.path.join(root, PKG)
    seat_path = os.path.join(root, SEAT)
    standard_path = os.path.join(root, STANDARD)
    pkg = read(pkg_path)
    seat = read(seat_path)
    standard = read(standard_path)
    if MARKER in pkg or MARKER in seat:
        if not ok(root, standard):
            sys.exit("marker present but role registry is wrong")
        print("skip（已打）:", PKG)
        return
    for role in ROLES:
        meta = flat_yaml(read(os.path.join(presets, role, "preset.yml")))
        for key in ("name", "description", "order"):
            if key not in meta or not meta[key]:
                sys.exit("%s preset.yml missing %s" % (role, key))
        if not meta["order"].isdigit():
            sys.exit("%s order is not an integer" % role)
        prefix = persona_prefix(read(os.path.join(presets, role, "agent.cordis.yml")))
        body = role_patch(standard, role, meta, prefix, role == "dev-partner")
        write(os.path.join(root, "packages/bundle/web-app/presets", role + ".patch.yml"), body)
    write(pkg_path, package_lists(pkg))
    write(seat_path, seat_text(seat))
    if not ok(root, standard):
        sys.exit("role registry failed its own check")
    print("ok:", PKG)


if __name__ == "__main__":
    main()
