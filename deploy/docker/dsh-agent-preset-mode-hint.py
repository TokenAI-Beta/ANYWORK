# -*- coding: utf-8 -*-
"""Docker image only: one hint beside the runtime-mode chip.

On dsh-v0.2.1-rc.3 the new-session chip is AgentPresetSeat
(conversation.hero.agentPreset), beside the workspace picker. Its menu is
the engine modes 标准 / PTC / 极简 / 创造. Team roles live under
设置 → Agent 预设 and are not items in that menu.

This patch adds one caption next to the chip. It does not insert the six
preset ids, and it does not rewrite presetStandard/Ptc/Minimal/Cordis copy.

Runs after dsh-sidebar-more-to-plugins.py and before pnpm build.
DSH_SRC is required. There is no home-directory default, so the script
cannot land on a native install or a Windows checkout. Tokyo stays frozen.
"""
import io
import os
import sys

MARKER = "cut 2026-10-26 agent-presets-tune"
SEAT = "packages/client/ui-agent-preset/src/client/AgentPresetSeat.tsx"
LOCALES = "packages/client/ui-agent-preset/src/client/locales.ts"
CSS = "packages/client/ui-agent-preset/src/client/AgentPresetSeat.module.css"

ZH = "团队角色在「设置 → Agent 预设」，与标准 / PTC / 极简 / 创造不是同一层。"
EN = "Team roles are under Settings → Agent presets, a different layer from Standard / PTC / Minimal / Creator."

OLD_TYPE = """  | 'seatHint'
  | 'headerHint'
"""
NEW_TYPE = """  | 'seatHint'
  | 'teamRolesHint'
  | 'headerHint'
"""

OLD_EN = """  seatHint: 'Choose the agent preset for your new task',
  headerHint: 'The agent preset chosen when this task started',
"""
NEW_EN = """  seatHint: 'Choose the agent preset for your new task',
  // ANYWORK Docker image (cut 2026-10-26 agent-presets-tune).
  teamRolesHint: '%s',
  headerHint: 'The agent preset chosen when this task started',
""" % EN

OLD_ZH = """  seatHint: '选择新任务使用的 Agent 预设',
  headerHint: '本任务的 Agent 预设，在任务开始时确定',
"""
NEW_ZH = """  seatHint: '选择新任务使用的 Agent 预设',
  // ANYWORK Docker image (cut 2026-10-26 agent-presets-tune).
  teamRolesHint: '%s',
  headerHint: '本任务的 Agent 预设，在任务开始时确定',
""" % ZH

OLD_SEAT = """      />}
      {toast !== null && (
        <Toast
          key={toast.seq}
          text={t('switchRefused', { name: presetDisplayText(toast.error.preset, t).name, reason: toast.error.reason })}
"""
NEW_SEAT = """      />}
      {ready && (
        <span className={css.teamHint} title={t('teamRolesHint')}>
          {t('teamRolesHint')}
        </span>
      )}
      {toast !== null && (
        <Toast
          key={toast.seq}
          text={t('switchRefused', { name: presetDisplayText(toast.error.preset, t).name, reason: toast.error.reason })}
"""

OLD_CSS = """.itemDesc {
  font-size: 12px;
  line-height: 16px;
  color: var(--dsw-alias-label-caption);
  white-space: normal;
}
"""
NEW_CSS = """.itemDesc {
  font-size: 12px;
  line-height: 16px;
  color: var(--dsw-alias-label-caption);
  white-space: normal;
}

/* ANYWORK Docker image (cut 2026-10-26 agent-presets-tune):
   caption beside the runtime-mode chip. Not a sixth menu row. */
.teamHint {
  flex: 1 1 12em;
  min-width: 0;
  margin-left: 8px;
  overflow: hidden;
  color: var(--dsw-alias-label-caption);
  font-size: 12px;
  font-weight: 400;
  line-height: 16px;
  text-overflow: ellipsis;
  white-space: nowrap;
}
"""

MODE_NAMES = (
    "presetStandardName: '标准模式'",
    "presetPtcName: 'PTC 模式'",
    "presetMinimalName: '极简模式'",
    "presetCordisName: '创造模式'",
)


def _read(path):
    if not os.path.isfile(path):
        sys.exit("missing %s" % path)
    return io.open(path, encoding="utf-8").read()


def _replace_one(text, old, new, label):
    count = text.count(old)
    if count != 1:
        sys.exit("anchor count=%d in %s (expect 1)" % (count, label))
    return text.replace(old, new, 1)


def _ok(seat, locales, css):
    if seat.count("teamRolesHint") != 2 or "css.teamHint" not in seat:
        return False
    if locales.count("teamRolesHint") != 3 or ZH not in locales or EN not in locales:
        return False
    if css.count(".teamHint") != 1 or MARKER not in css:
        return False
    for name in MODE_NAMES:
        if name not in locales:
            return False
    for preset_id in (
        "team-assistant", "research-assistant", "doc-writer",
        "data-organizer", "dev-partner", "meeting-secretary",
    ):
        if preset_id in seat:
            return False
    return True


def main():
    root = os.environ.get("DSH_SRC", "").strip()
    if not root:
        sys.exit(
            "DSH_SRC is required. Docker image build sets it to the clone inside the image. "
            "This patch does not target a native install."
        )
    seat_path = os.path.join(root, SEAT)
    locales_path = os.path.join(root, LOCALES)
    css_path = os.path.join(root, CSS)
    seat = _read(seat_path)
    locales = _read(locales_path)
    css = _read(css_path)
    if MARKER in seat or MARKER in locales or MARKER in css:
        if not _ok(seat, locales, css):
            sys.exit("marker present but mode hint is incomplete")
        print("skip（已打）:", SEAT)
        return
    for name in MODE_NAMES:
        if name not in locales:
            sys.exit("engine mode copy missing before patch: %s" % name)
    seat = _replace_one(seat, OLD_SEAT, NEW_SEAT, SEAT)
    locales = _replace_one(locales, OLD_TYPE, NEW_TYPE, LOCALES + " type")
    locales = _replace_one(locales, OLD_EN, NEW_EN, LOCALES + " en")
    locales = _replace_one(locales, OLD_ZH, NEW_ZH, LOCALES + " zh")
    css = _replace_one(css, OLD_CSS, NEW_CSS, CSS)
    if not _ok(seat, locales, css):
        sys.exit("mode hint failed its own check")
    io.open(seat_path, "w", encoding="utf-8").write(seat)
    io.open(locales_path, "w", encoding="utf-8").write(locales)
    io.open(css_path, "w", encoding="utf-8").write(css)
    print("ok:", SEAT)


if __name__ == "__main__":
    main()
