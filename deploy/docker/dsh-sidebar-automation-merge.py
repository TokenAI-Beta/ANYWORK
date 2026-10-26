# -*- coding: utf-8 -*-
"""Docker image only: drop the sidebar entry 「自动化」.

Decision A (cut 2026-10-26 automation-merge). On dsh-v0.2.1-rc.3 the
parallel outer entries are different registrations:

    desk-auto     plugin/desk-panel  sidebar.footer.action  order 88
                  label auto.tab 「自动化」  panel AutomationPanel
    schedules     ui-schedule        sidebar.panellist      order 10
                  label schedule.manager panel 「自动化任务」
                  main key schedules mounts TaskManagerPage

This patch stops the desk-auto registration. It does not rename
「自动化任务」, does not edit ui-schedule, and does not rebuild the
schedules panel. AutomationPanel stays in the file and is not mounted.

Run this after dsh-sidebar-assistant-skills-merge.py. That script's
success check still expects id desk-auto, and this registration block
is unchanged by that merge, so the same anchor matches the committed
plugin and the post-merge image copy.

The file is not part of the harness pnpm build. The image copies the
repo to /opt/anywork and bootstrap installs plugin/desk-panel from
there, so this script runs against that copy (ANYWORK_SRC). It does
not edit the harness clone and it has no home-directory default, so a
Windows checkout of the plugin is left alone unless this image build
runs.

ANYWORK_SRC is required.
"""
import io
import os
import sys

MARKER = "cut 2026-10-26 automation-merge"
REL = "plugin/desk-panel/lib/client.js"

OLD_REG = """      ctx.slots.inject("sidebar.footer.action", function () {
        return ctx.slots.register(
          {
            name: "sidebar.footer.action",
            id: "desk-auto",
            order: 88,
            label: function () {
              return tr("auto.tab");
            },
          },
          AutomationPanel
        );
      });
"""
NEW_REG = """      // ANYWORK Docker image (cut 2026-10-26 automation-merge):
      // desk-auto is not a sidebar entry. The harness list item is unchanged.
"""

KEEP_IDS = (
    "desk-skills-conn",
    "desk-agents",
    "desk-announce",
    "desk-bots",
    "desk-hub",
    "desk-usage",
)


def dropped_ok(text):
    if MARKER not in text:
        return False
    if 'id: "desk-auto"' in text:
        return False
    if any(line.strip() == "AutomationPanel" for line in text.splitlines()):
        return False
    if "function AutomationPanel(" not in text:
        return False
    if text.count('"auto.tab": "自动化"') != 1:
        return False
    if text.count('"auto.tab": "Automation"') != 1:
        return False
    if "自动化任务" in text:
        return False
    if 'id: "schedules"' in text or "ui-schedule" in text or "sidebar.panellist" in text:
        return False
    if text.count('id: "desk-skills-conn"') != 1:
        return False
    for sid in KEEP_IDS:
        if ('id: "%s"' % sid) not in text:
            return False
    return True


def main():
    root = os.environ.get("ANYWORK_SRC", "").strip()
    if not root:
        sys.exit(
            "ANYWORK_SRC is required. Docker image build sets it to /opt/anywork. "
            "This patch does not target a native install."
        )
    path = os.path.join(root, REL)
    if not os.path.isfile(path):
        sys.exit("missing %s" % path)
    text = io.open(path, encoding="utf-8").read()
    if MARKER in text:
        if not dropped_ok(text):
            sys.exit("marker present but automation merge is wrong: %s" % REL)
        print("skip（已打）:", REL)
        return
    count = text.count(OLD_REG)
    if count != 1:
        sys.exit("anchor count=%d in %s (expect 1)" % (count, REL))
    updated = text.replace(OLD_REG, NEW_REG, 1)
    if not dropped_ok(updated):
        sys.exit("patched automation merge is wrong: %s" % REL)
    io.open(path, "w", encoding="utf-8").write(updated)
    print("ok:", REL)


if __name__ == "__main__":
    main()
