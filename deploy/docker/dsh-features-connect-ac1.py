# -*- coding: utf-8 -*-
"""Docker image only: register the portal role directories as agent presets.

Cut 2026-10-27 features-connect-use-path AC1 fix. Playtest on #22
showed two failures:

- 用此角色新建会话 sent the portal id and the engine answered
  agent-preset/not-found. On dsh-v0.2.1-rc.3 the registry does not scan
  DSH_HOME/.agent-presets. A preset exists only as a
  @deepseek-ai/dsh-agent-preset row, and config.id is the id sessions
  store. The shipped rows are standard / ptc / minimal / cordis.
- 设为默认 called settings.update with two arguments. The client proxy
  requires three (the revision fence). That call stays in
  dsh-features-connect-use-path.py. This script registers the ids the
  portal cards and the new session both name.

Roles are every directory under PRESETS_SRC that has preset.yml and
agent.cordis.yml (the four cards the panel lists). Each row is the
shipped standard composition plus that card's name, description, order,
and persona. preset.yml codex: true enables the Codex tool row; other
cards get the same row with disabled: true. research-report and
formal-docs also disable workflow-ptc (the rc.3 id of
workflow-worker-thread) and tool-workflow. tool-ralph is not added.
The four engine rows are not edited. The mode chip keeps only shipped
presets (isBuiltInPreset). Old stored ids are rewritten by
dsh-preset-alias.py, which does not register a second copy of these ids.

Runs after dsh-agent-preset-mode-hint.py and before pnpm build, so the
chip filter is in the client bundle. DSH_SRC and PRESETS_SRC are
required. There is no home-directory default.
"""
import io
import json
import os
import sys

MARKER = "cut 2026-10-27 features-connect-use-path ac1"
DENY_HEAVY = frozenset(("research-report", "formal-docs"))
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
CODEX_OFF = (
    "              - id: tool-subagent-fork\n"
    "                name: '@deepseek-ai/dsh-tool-subagent'\n"
    "                config:\n"
    "                  provider: fork\n"
    "                  toolName: subagent_fork\n"
    "              - id: tool-subagent-codex\n"
    "                name: '@deepseek-ai/dsh-tool-subagent'\n"
    "                disabled: true\n"
    "                config:\n"
    "                  provider: codex\n"
    "                  toolName: subagent_codex\n"
    "              - id: workflow-ptc\n"
)
WORKFLOW_PTC = (
    "              - id: workflow-ptc\n"
    "                name: '@deepseek-ai/dsh-workflow-ptc'\n"
    "                config:\n"
    "                  provider: spawn\n"
)
WORKFLOW_PTC_OFF = (
    "              - id: workflow-ptc\n"
    "                name: '@deepseek-ai/dsh-workflow-ptc'\n"
    "                disabled: true\n"
    "                config:\n"
    "                  provider: spawn\n"
)
TOOL_WORKFLOW = (
    "              - id: tool-workflow\n"
    "                name: '@deepseek-ai/dsh-tool-workflow'\n"
)
TOOL_WORKFLOW_OFF = (
    "              - id: tool-workflow\n"
    "                name: '@deepseek-ai/dsh-tool-workflow'\n"
    "                disabled: true\n"
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


def discover_roles(presets):
    found = []
    for name in os.listdir(presets):
        base = os.path.join(presets, name)
        if not os.path.isdir(base):
            continue
        preset = os.path.join(base, "preset.yml")
        agent = os.path.join(base, "agent.cordis.yml")
        if not (os.path.isfile(preset) and os.path.isfile(agent)):
            continue
        meta = flat_yaml(read(preset))
        for key in ("name", "description", "order"):
            if key not in meta or not meta[key]:
                sys.exit("%s preset.yml missing %s" % (name, key))
        if not str(meta["order"]).isdigit():
            sys.exit("%s order is not an integer" % name)
        found.append((int(meta["order"]), name))
    if not found:
        sys.exit("no role directories under %s" % presets)
    found.sort()
    return [name for _order, name in found]


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
    codex_row = CODEX_ROW if codex else CODEX_OFF
    text = once(text, CODEX_ANCHOR, "codex anchor").replace(CODEX_ANCHOR, codex_row, 1)
    note = ""
    if role_id in DENY_HEAVY:
        text = once(text, WORKFLOW_PTC, "workflow-ptc").replace(WORKFLOW_PTC, WORKFLOW_PTC_OFF, 1)
        text = once(text, TOOL_WORKFLOW, "tool-workflow").replace(TOOL_WORKFLOW, TOOL_WORKFLOW_OFF, 1)
        note = (
            "# Deny tool-ralph: row omitted. Deny workflow-worker-thread via workflow-ptc disabled.\n"
        )
    header = (
        "# %s\n"
        "# Portal role %s, registered because rc.3 does not scan .agent-presets.\n"
        "# Same plugin list as preset-standard; persona is this role.\n"
        "%s"
    ) % (MARKER, role_id, note)
    return header + text


def package_lists(pkg, roles):
    patch_lines = ['        "./presets/%s.patch.yml"' % role for role in roles]
    extra_patch = ",\n".join(patch_lines) + "\n"
    extra_files = "".join('    "presets/%s.patch.yml",\n' % role for role in roles)
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


def row_text(body, row_id):
    token = "              - id: %s\n" % row_id
    start = body.find(token)
    if start < 0:
        token = "          - id: %s\n" % row_id
        start = body.find(token)
    if start < 0:
        return ""
    rest = body[start + len(token):]
    cut = len(rest)
    for candidate in ("\n              - id: ", "\n          - id: ", "\n        - id: "):
        at = rest.find(candidate)
        if at >= 0 and at < cut:
            cut = at
    return token + rest[:cut]


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
    roles = discover_roles(os.environ["PRESETS_SRC"])
    for role in roles:
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
        if "\n          - id: tool-fs\n" in standard_before and "\n          - id: tool-fs\n" not in body:
            return False
        codex = row_text(body, "tool-subagent-codex")
        wants_codex = meta.get("codex") == "true"
        if wants_codex:
            if "toolName: subagent_codex" not in codex or "disabled:" in codex:
                return False
        elif "disabled: true" not in codex:
            return False
        if role in DENY_HEAVY:
            if "disabled: true" not in row_text(body, "workflow-ptc"):
                return False
            if "disabled: true" not in row_text(body, "tool-workflow"):
                return False
            if "- id: tool-ralph" in body:
                return False
        else:
            if "disabled:" in row_text(body, "workflow-ptc"):
                return False
            if "disabled:" in row_text(body, "tool-workflow"):
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
    roles = discover_roles(presets)
    for role in roles:
        meta = flat_yaml(read(os.path.join(presets, role, "preset.yml")))
        prefix = persona_prefix(read(os.path.join(presets, role, "agent.cordis.yml")))
        body = role_patch(standard, role, meta, prefix, meta.get("codex") == "true")
        write(os.path.join(root, "packages/bundle/web-app/presets", role + ".patch.yml"), body)
    write(pkg_path, package_lists(pkg, roles))
    write(seat_path, seat_text(seat))
    if not ok(root, standard):
        sys.exit("role registry failed its own check")
    print("ok:", PKG)


if __name__ == "__main__":
    main()
