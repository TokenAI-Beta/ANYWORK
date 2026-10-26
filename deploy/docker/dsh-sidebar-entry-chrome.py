# -*- coding: utf-8 -*-
"""Docker image only: one sidebar entry chrome for the plugin column.

On dsh-v0.2.1-rc.3 the left column shell is
packages/client/ui-sidebar/src/client/SidebarRoot.module.css
(geometry owned by SidebarRoot.tsx). Two hosts paint that column:

  sidebar.panellist  — PanelRow. The shell owns the button, the title, and
    the leading glyph. Registrations only supply the icon.
      id plugins    order 0   ui-plugin-manager   zh 插件          (baseline)
      id schedules  order 10  ui-schedule         zh 自动化任务
    PanelMoreMenu (panels.more / 「更多」) reuses the same panelRow classes.

  sidebar.footer.action — each occupant paints its own button. After
    sidebar-nav-reorder this list sits in the same column, above panelList.
      id chat-import       order 0   dsh-chat-import@0.26.2  导入会话
      id desk-skills-conn  order 87  desk-panel              功能与连接
      id desk-auto         order 88  desk-panel              自动化
      id desk-agents       order 89  desk-panel              子代理
      id desk-announce     order 90  desk-panel              公告
      id desk-bots         order 90  desk-panel              Bots
      id desk-hub          order 91  desk-panel              团队资料
      id desk-usage        order 92  desk-panel              用量
      id cordis-panel            ui-cordis (only while a dynamic plugin exists)

The baseline is PanelRow: title 14px / weight 400 / line-height 22px
(the sidebar root's font; a later portal rule may shrink every sidebar
button together), leading icon 16px expanded and 18px on the rail, no
rounded chip behind the glyph. Footer occupants were a different kind of
row (desk-panel .ddb is 13px with a 26px tinted chip and a 15px glyph;
chat-import copies the 42px settings trigger). This patch publishes
--dsh-sidebar-entry-* on the sidebar root, points PanelRow at those
tokens, and applies the same tokens to footer-action entry buttons.

Only the entry trigger is restyled. Selectors stay on the slot's direct
entry roots, so an open desk-panel or Cordis sheet keeps its own buttons.
Clicks, labels, registration ids, and desk-auto are unchanged.
desk-assistants stays out of this patch (assistant-skills-merge).
AccountMenu and the login URL are not edited.

Invoked only from deploy/docker/Dockerfile with
DSH_SRC=/src/deepseek-harness (the clone inside the image build).
DSH_SRC is required. There is no home-directory default, so the script
cannot land on a native install.
"""
import io
import os
import sys

MARKER = "cut 2026-10-26 sidebar-entry-style-unify"
REL = "packages/client/ui-sidebar/src/client/SidebarRoot.module.css"

OLD_ROOT = """  color: var(--dsw-alias-label-primary);
  font-size: 14px;
  /* The sidebar is elevated above the conversation surface, so a revealed
"""
NEW_ROOT = """  color: var(--dsw-alias-label-primary);
  font-size: 14px;
  /* cut 2026-10-26 sidebar-entry-style-unify: one entry chrome.
     sidebar.panellist (plugins, schedules) and sidebar.footer.action
     occupants in this column read these. Title size stays the root font
     so a host rule that shrinks every sidebar button shrinks them together. */
  --dsh-sidebar-entry-title-size: 14px;
  --dsh-sidebar-entry-title-weight: 400;
  --dsh-sidebar-entry-title-line: 22px;
  --dsh-sidebar-entry-icon-size: 16px;
  --dsh-sidebar-entry-icon-rail: 18px;
  --dsh-sidebar-entry-gap: 8px;
  --dsh-sidebar-entry-min-height: 36px;
  --dsh-sidebar-entry-pad: 7px 8px;
  --dsh-sidebar-entry-radius: var(--dsw-radius-md);
  --dsh-sidebar-entry-list-gap: 2px;
  --dsh-sidebar-entry-list-gap-rail: 12px;
  /* The sidebar is elevated above the conversation surface, so a revealed
"""

OLD_PANEL_LIST = """.panelList {
  flex: none;
  display: flex;
  flex-direction: column;
  gap: 2px;
  margin-bottom: 8px;
}
"""
NEW_PANEL_LIST = """.panelList {
  flex: none;
  display: flex;
  flex-direction: column;
  gap: var(--dsh-sidebar-entry-list-gap);
  margin-bottom: 8px;
}
"""

OLD_PANEL_ROW = """.panelRow {
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 0 2px;
  min-height: 36px;
  padding: 7px 8px;
  box-sizing: border-box;
  border: none;
  border-radius: var(--dsw-radius-md);
  background: transparent;
  color: var(--dsw-alias-label-primary);
  font: inherit;
  line-height: 22px;
  text-align: left;
  cursor: pointer;
}
"""
NEW_PANEL_ROW = """.panelRow {
  display: flex;
  align-items: center;
  gap: var(--dsh-sidebar-entry-gap);
  margin: 0 2px;
  min-height: var(--dsh-sidebar-entry-min-height);
  padding: var(--dsh-sidebar-entry-pad);
  box-sizing: border-box;
  border: none;
  border-radius: var(--dsh-sidebar-entry-radius);
  background: transparent;
  color: var(--dsw-alias-label-primary);
  font: inherit;
  font-weight: var(--dsh-sidebar-entry-title-weight);
  line-height: var(--dsh-sidebar-entry-title-line);
  text-align: left;
  cursor: pointer;
}
"""

OLD_GLYPH = """.panelGlyph {
  flex: none;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}

.panelTitle {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
"""
NEW_GLYPH = """.panelGlyph {
  flex: none;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}

.panelGlyph svg {
  width: var(--dsh-sidebar-entry-icon-size);
  height: var(--dsh-sidebar-entry-icon-size);
  flex: none;
}

.panelTitle {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: var(--dsh-sidebar-entry-title-size);
  font-weight: var(--dsh-sidebar-entry-title-weight);
  line-height: var(--dsh-sidebar-entry-title-line);
}
"""

OLD_COLLAPSED_LIST = """.collapsed .panelList {
  gap: 12px;
  margin-bottom: 12px;
}
"""
NEW_COLLAPSED_LIST = """.collapsed .panelList {
  gap: var(--dsh-sidebar-entry-list-gap-rail);
  margin-bottom: 12px;
}
"""

OLD_COLLAPSED_ROW = """.collapsed .panelRow {
  width: 36px;
  height: 36px;
  justify-content: center;
  margin: 0;
  padding: 0;
  color: var(--dsw-alias-label-primary);
}
"""
NEW_COLLAPSED_ROW = """.collapsed .panelRow {
  width: 36px;
  height: 36px;
  justify-content: center;
  margin: 0;
  padding: 0;
  color: var(--dsw-alias-label-primary);
}

.collapsed .panelGlyph svg {
  width: var(--dsh-sidebar-entry-icon-rail);
  height: var(--dsh-sidebar-entry-icon-rail);
}
"""

OLD_FOOT = """.footerActions {
  display: flex;
}
"""

# Direct entry roots only. An open sheet nested under the entry root is not
# a direct button, so its controls keep their own chrome. A suffix has to be
# applied to every comma-separated selector; appending it once would bind
# only the last root.
ENTRY_ROOTS = (
    '.footerActions [data-slot="sidebar.footer.action"] > button',
    '.footerActions [data-slot="sidebar.footer.action"] > div > button',
    '.footerActions [data-slot="sidebar.footer.action"] > div > div > button',
)


def entry(suffix, collapsed=False):
    lines = []
    for root in ENTRY_ROOTS:
        line = (".collapsed " + root) if collapsed else root
        lines.append(line + suffix)
    return ",\n".join(lines)


NEW_FOOT = (
    "/* Footer-action entry buttons read the panel-row tokens above.\n"
    "   Triggers only — nested sheets are not direct children of the slot root. */\n"
    ".footerActions {\n"
    "  display: flex;\n"
    "  flex-direction: column;\n"
    "  align-items: stretch;\n"
    "  gap: var(--dsh-sidebar-entry-list-gap);\n"
    "}\n"
    "\n"
    ".footerActions [data-slot=\"sidebar.footer.action\"] > div {\n"
    "  margin: 0 !important;\n"
    "  height: auto !important;\n"
    "  min-height: 0 !important;\n"
    "  width: 100%;\n"
    "}\n"
    "\n"
    + entry("") + " {\n"
    "  display: flex !important;\n"
    "  align-items: center !important;\n"
    "  gap: var(--dsh-sidebar-entry-gap) !important;\n"
    "  margin: 0 2px !important;\n"
    "  min-height: var(--dsh-sidebar-entry-min-height);\n"
    "  height: auto !important;\n"
    "  padding: var(--dsh-sidebar-entry-pad) !important;\n"
    "  box-sizing: border-box !important;\n"
    "  border: none !important;\n"
    "  border-radius: var(--dsh-sidebar-entry-radius) !important;\n"
    "  background: transparent !important;\n"
    "  color: var(--dsw-alias-label-primary) !important;\n"
    "  font-family: inherit !important;\n"
    "  font-size: var(--dsh-sidebar-entry-title-size);\n"
    "  font-weight: var(--dsh-sidebar-entry-title-weight);\n"
    "  line-height: var(--dsh-sidebar-entry-title-line);\n"
    "  text-align: left !important;\n"
    "  cursor: pointer;\n"
    "  flex: 0 0 auto !important;\n"
    "  width: auto !important;\n"
    "  min-width: 0 !important;\n"
    "  max-width: 100%;\n"
    "  overflow: hidden;\n"
    "}\n"
    "\n"
    + entry(":hover") + ",\n"
    + entry("[class~=\"on\"]") + ",\n"
    + entry("[aria-expanded=\"true\"]") + " {\n"
    "  background: var(--dsw-alias-interactive-bg-hover) !important;\n"
    "  color: var(--dsw-alias-label-primary) !important;\n"
    "}\n"
    "\n"
    + entry(" > :first-child") + " {\n"
    "  display: inline-flex !important;\n"
    "  align-items: center !important;\n"
    "  justify-content: center !important;\n"
    "  flex: none !important;\n"
    "  width: var(--dsh-sidebar-entry-icon-size) !important;\n"
    "  height: var(--dsh-sidebar-entry-icon-size) !important;\n"
    "  min-width: 0 !important;\n"
    "  margin: 0 !important;\n"
    "  padding: 0 !important;\n"
    "  background: transparent !important;\n"
    "  border-radius: 0 !important;\n"
    "  box-shadow: none !important;\n"
    "  color: inherit !important;\n"
    "}\n"
    "\n"
    + entry(" > :first-child svg") + ",\n"
    + entry(" > svg") + " {\n"
    "  width: var(--dsh-sidebar-entry-icon-size) !important;\n"
    "  height: var(--dsh-sidebar-entry-icon-size) !important;\n"
    "  flex: none !important;\n"
    "}\n"
    "\n"
    ".collapsed .footerActions {\n"
    "  flex-direction: column;\n"
    "  align-items: center;\n"
    "  gap: var(--dsh-sidebar-entry-list-gap-rail);\n"
    "  width: auto;\n"
    "}\n"
    "\n"
    ".collapsed .footerActions [data-slot=\"sidebar.footer.action\"] > div {\n"
    "  width: auto;\n"
    "}\n"
    "\n"
    + entry("", collapsed=True) + " {\n"
    "  width: 36px !important;\n"
    "  height: 36px !important;\n"
    "  margin: 0 !important;\n"
    "  padding: 0 !important;\n"
    "  justify-content: center !important;\n"
    "  gap: 0 !important;\n"
    "}\n"
    "\n"
    + entry(" > :first-child", collapsed=True) + ",\n"
    + entry(" > :first-child svg", collapsed=True) + ",\n"
    + entry(" > svg", collapsed=True) + " {\n"
    "  width: var(--dsh-sidebar-entry-icon-rail) !important;\n"
    "  height: var(--dsh-sidebar-entry-icon-rail) !important;\n"
    "}\n"
)

REPLACEMENTS = (
    (OLD_ROOT, NEW_ROOT),
    (OLD_PANEL_LIST, NEW_PANEL_LIST),
    (OLD_PANEL_ROW, NEW_PANEL_ROW),
    (OLD_GLYPH, NEW_GLYPH),
    (OLD_COLLAPSED_LIST, NEW_COLLAPSED_LIST),
    (OLD_COLLAPSED_ROW, NEW_COLLAPSED_ROW),
    (OLD_FOOT, NEW_FOOT),
)


def _decl_lines(text, prop, token):
    needle = "%s: var(%s)" % (prop, token)
    found = []
    for line in text.splitlines():
        stripped = line.strip()
        if stripped.startswith(needle):
            found.append(stripped)
    return found


def chrome_ok(text):
    if text.count(MARKER) != 1:
        return False
    tokens = (
        "--dsh-sidebar-entry-title-size: 14px",
        "--dsh-sidebar-entry-title-weight: 400",
        "--dsh-sidebar-entry-title-line: 22px",
        "--dsh-sidebar-entry-icon-size: 16px",
        "--dsh-sidebar-entry-icon-rail: 18px",
        "--dsh-sidebar-entry-gap: 8px",
        "--dsh-sidebar-entry-min-height: 36px",
        "--dsh-sidebar-entry-pad: 7px 8px",
        "--dsh-sidebar-entry-radius: var(--dsw-radius-md)",
        "--dsh-sidebar-entry-list-gap: 2px",
        "--dsh-sidebar-entry-list-gap-rail: 12px",
    )
    root = text.split(".root {", 1)[-1].split("}", 1)[0]
    for token in tokens:
        if token not in root:
            return False
    if "gap: var(--dsh-sidebar-entry-gap)" not in text:
        return False
    if "min-height: var(--dsh-sidebar-entry-min-height)" not in text:
        return False
    if "padding: var(--dsh-sidebar-entry-pad)" not in text:
        return False
    if "border-radius: var(--dsh-sidebar-entry-radius)" not in text:
        return False
    if "font-size: var(--dsh-sidebar-entry-title-size)" not in text:
        return False
    if "font-weight: var(--dsh-sidebar-entry-title-weight)" not in text:
        return False
    if "line-height: var(--dsh-sidebar-entry-title-line)" not in text:
        return False
    if ".panelGlyph svg" not in text or ".collapsed .panelGlyph svg" not in text:
        return False
    if "width: var(--dsh-sidebar-entry-icon-size)" not in text:
        return False
    if "width: var(--dsh-sidebar-entry-icon-rail)" not in text:
        return False
    if "flex-direction: column" not in text:
        return False
    if "gap: var(--dsh-sidebar-entry-list-gap)" not in text:
        return False
    if "gap: var(--dsh-sidebar-entry-list-gap-rail)" not in text:
        return False
    if "[data-slot=\"sidebar.footer.action\"] > button" not in text:
        return False
    if "[data-slot=\"sidebar.footer.action\"] > div > button" not in text:
        return False
    if "[data-slot=\"sidebar.footer.action\"] > div > div > button" not in text:
        return False
    for root in (
        '> button:hover',
        '> div > button:hover',
        '> div > div > button:hover',
        '> button[class~="on"]',
        '> div > button[aria-expanded="true"]',
        '> button > :first-child',
        '> div > button > :first-child',
        '> div > div > button > :first-child',
        '> button > svg',
        '> div > div > button > svg',
        '.collapsed .footerActions [data-slot="sidebar.footer.action"] > button',
        '.collapsed .footerActions [data-slot="sidebar.footer.action"] > div > button > :first-child',
    ):
        if root not in text:
            return False
    if ".panelRow:hover" not in text or ".panelRow.panelActive" not in text:
        return False
    # Title metrics stay overridable by a host rule that sets every sidebar
    # button together. Geometry that occupants inline (padding, icon chip,
    # fixed height) is locked to the token.
    titles = _decl_lines(text, "font-size", "--dsh-sidebar-entry-title-size")
    if len(titles) < 2 or any("!important" in line for line in titles):
        return False
    weights = _decl_lines(text, "font-weight", "--dsh-sidebar-entry-title-weight")
    if len(weights) < 2 or any("!important" in line for line in weights):
        return False
    lines = _decl_lines(text, "line-height", "--dsh-sidebar-entry-title-line")
    if len(lines) < 2 or any("!important" in line for line in lines):
        return False
    pads = _decl_lines(text, "padding", "--dsh-sidebar-entry-pad")
    if not any("!important" in line for line in pads):
        return False
    if not any("!important" not in line for line in pads):
        return False
    icons = _decl_lines(text, "width", "--dsh-sidebar-entry-icon-size")
    if not any("!important" in line for line in icons):
        return False
    if not any("!important" not in line for line in icons):
        return False
    if "renderSlot('sidebar.settings'" in text:
        return False
    return True


def main():
    root = os.environ.get("DSH_SRC", "").strip()
    if not root:
        sys.exit(
            "DSH_SRC is required. Docker image build sets it to the clone inside the image. "
            "This patch does not target a native install."
        )
    path = os.path.join(root, REL)
    if not os.path.isfile(path):
        sys.exit("missing %s" % path)
    text = io.open(path, encoding="utf-8").read()
    if MARKER in text:
        if not chrome_ok(text):
            sys.exit("marker present but sidebar entry chrome is wrong: %s" % REL)
        print("skip（已打）:", REL)
        return
    updated = text
    for old, new in REPLACEMENTS:
        count = updated.count(old)
        if count != 1:
            sys.exit("anchor count=%d in %s (expect 1)" % (count, REL))
        updated = updated.replace(old, new, 1)
    if not chrome_ok(updated):
        sys.exit("patched sidebar entry chrome is wrong: %s" % REL)
    io.open(path, "w", encoding="utf-8").write(updated)
    print("ok:", REL)


if __name__ == "__main__":
    main()
