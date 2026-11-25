# -*- coding: utf-8 -*-
"""Docker image only: one theme token set and a single root switch.

Cut 2026-10-30 theme-tokens-root-switch. Page, main, sidebar, text, and
borders follow body[data-ds-dark-theme], which the theme presenter writes
once from ui-theme.preference (light / dark / system). Dark is black on
white text. Light is white on black text. Conversation messages are plain
text: no bubble box, no assistant wash.

DSH_SRC runs after dsh-chat-shell-ui.py and before plugin lazy-load.
ANYWORK_SRC strips the desk-panel bubble rules that chat-shell added.
Neither variable has a home-directory default. This script does not edit
the plugin lazy-load patch and does not mention a retired region.
"""
import io
import os
import sys

MARKER = "cut 2026-10-30 theme-tokens-root-switch"
PREV = "cut 2026-10-27 chat-shell-ui-from-workbench"

DESIGN = "packages/client/ui-theme/src/styles/design-platform.css"
BOOT = "packages/client/ui-theme/src/boot-theme.ts"
SHELL = "packages/client/ui-conversation/src/client/skeleton/ConversationRoot.module.css"
BUBBLE = "packages/client/ui-chat/src/client/chat/MessageItem.module.css"
ASSIST = "packages/client/ui-chat/src/client/chat/AssistantMarkdown.module.css"
DESK = "plugin/desk-panel/lib/client.js"

AW_LIGHT = """  --aw-page: #ffffff;
  --aw-main: #ffffff;
  --aw-sidebar: #ffffff;
  --aw-text: #000000;
  --aw-border: rgba(0, 0, 0, 0.12);
  --aw-divider: rgba(0, 0, 0, 0.12);"""

AW_DARK = """  --aw-page: #000000;
  --aw-main: #000000;
  --aw-sidebar: #000000;
  --aw-text: #ffffff;
  --aw-border: rgba(255, 255, 255, 0.16);
  --aw-divider: rgba(255, 255, 255, 0.16);"""

SURFACES = """  --chrome: var(--aw-page);
  --pane: var(--aw-main);
  --ink: var(--aw-text);
  --on-ink: var(--aw-page);
  --text-100: var(--aw-text);
  --text-68: color-mix(in srgb, var(--aw-text) 68%, transparent);
  --text-56: color-mix(in srgb, var(--aw-text) 56%, transparent);
  --text-40: color-mix(in srgb, var(--aw-text) 40%, transparent);
  --dsw-alias-bg-base: var(--aw-page);
  --dsw-alias-bg-layer-1: var(--aw-main);
  --dsw-alias-bg-layer-2: var(--aw-main);
  --dsw-alias-bg-layer-3: var(--aw-main);
  --dsw-alias-bg-overlay: var(--aw-page);
  --dsw-alias-bg-module-platform: var(--aw-sidebar);
  --dsw-specific-sidebar-fill: var(--aw-sidebar);
  --dsw-specific-sidebar-nav-item-active: color-mix(in srgb, var(--aw-text) 8%, var(--aw-page));
  --dsw-specific-sidebar-nav-item-hover: color-mix(in srgb, var(--aw-text) 5%, transparent);
  --dsw-alias-label-primary: var(--aw-text);
  --dsw-alias-label-primary-dimmed: color-mix(in srgb, var(--aw-text) 80%, transparent);
  --dsw-alias-label-secondary: color-mix(in srgb, var(--aw-text) 72%, transparent);
  --dsw-alias-border-l1: var(--aw-border);
  --dsw-alias-border-l2: var(--aw-divider);
  background-color: var(--aw-page);
  color: var(--aw-text);"""

OLD_TOKENS = """/* ANYWORK Docker image (cut 2026-10-27 chat-shell-ui-from-workbench):
   token subset on the shell. Not a StyleX dump. */
:global(:root) {
  --ink: #1c1c1c;
  --on-ink: #ffffff;
  --chrome: #fcfcfc;
  --pane: #ffffff;
  --accent: #1680f3;
  --accent-hover: #126fd4;
  --text-100: color-mix(in srgb, var(--ink) 100%, transparent);
  --text-68: color-mix(in srgb, var(--ink) 68%, transparent);
  --text-56: color-mix(in srgb, var(--ink) 56%, transparent);
  --text-40: color-mix(in srgb, var(--ink) 40%, transparent);
}

"""

NEW_TOKENS = """/* ANYWORK Docker image (cut 2026-10-30 theme-tokens-root-switch):
   page colors live on body in the theme sheet. Accent stays here. */
:global(:root) {
  --accent: #1680f3;
  --accent-hover: #126fd4;
}

"""

OLD_BUBBLE = """.bubble {
  /* ANYWORK Docker image (cut 2026-10-27 chat-shell-ui-from-workbench):
     user solid ink, white text. Block pad 7 + line 22 = 36 single-line.
     Fill stays ink. Role color is not painted here. */
  max-width: 100%;
  box-sizing: border-box;
  min-height: 36px;
  padding: 7px 14px;
  border-radius: 18px;
  background: var(--ink, #1c1c1c);
  color: var(--on-ink, #fff);
  font-size: var(--dsh-content-font-size, 14px);
  line-height: 22px;
  white-space: pre-wrap;
  word-break: break-word;
}

.bubble :global(*) {
  color: inherit;
}
"""

NEW_BUBBLE = """.bubble {
  /* ANYWORK Docker image (cut 2026-10-30 theme-tokens-root-switch):
     plain text on the page background. No bubble box. */
  max-width: 100%;
  box-sizing: border-box;
  margin: 0;
  padding: 0;
  border: 0;
  border-radius: 0;
  background: transparent;
  box-shadow: none;
  color: var(--aw-text, var(--dsw-alias-label-primary));
  font-size: var(--dsh-content-font-size, 14px);
  line-height: 22px;
  white-space: pre-wrap;
  word-break: break-word;
}

.bubble :global(*) {
  color: inherit;
}
"""

OLD_ASSIST = """.root {
  /* ANYWORK Docker image (cut 2026-10-27 chat-shell-ui-from-workbench):
     assistant wash. 1px border keeps the 6% fill from smearing.
     Role color is an inset edge, not a fill. */
  display: flex;
  flex-direction: column;
  box-sizing: border-box;
  min-height: 36px;
  padding: 7px 14px;
  border: 1px solid #1c1c1c14;
  border-radius: 18px;
  background: #1c1c1c0f;
  box-shadow: inset 3px 0 0 var(--role-swatch, transparent);
  font-size: var(--dsh-content-font-size, 14px);
  line-height: 22px;
  color: var(--text-100, var(--ink, #1c1c1c));
}
"""

NEW_ASSIST = """.root {
  /* ANYWORK Docker image (cut 2026-10-30 theme-tokens-root-switch):
     plain text on the page background. No assistant wash. */
  display: flex;
  flex-direction: column;
  box-sizing: border-box;
  margin: 0;
  padding: 0;
  border: 0;
  border-radius: 0;
  background: transparent;
  box-shadow: none;
  font-size: var(--dsh-content-font-size, 14px);
  line-height: 22px;
  color: var(--aw-text, var(--dsw-alias-label-primary));
}
"""

OLD_BOOT_COLORS = "const LIGHT_BACKGROUND = '#fff'\nconst DARK_BACKGROUND = '#151517'"
NEW_BOOT_COLORS = (
    "const LIGHT_BACKGROUND = '#ffffff' /* cut 2026-10-30 theme-tokens-root-switch */\n"
    "const DARK_BACKGROUND = '#000000'"
)
OLD_BOOT_LIGHT = "body{background-color:${LIGHT_BACKGROUND};--dsh-boot-bg:${LIGHT_BACKGROUND}}"
NEW_BOOT_LIGHT = "body{background-color:${LIGHT_BACKGROUND};color:#000000;--dsh-boot-bg:${LIGHT_BACKGROUND}}"
OLD_BOOT_DARK = "body{background-color:${DARK_BACKGROUND};--dsh-boot-bg:${DARK_BACKGROUND}}"
NEW_BOOT_DARK = "body{background-color:${DARK_BACKGROUND};color:#ffffff;--dsh-boot-bg:${DARK_BACKGROUND}}"

OLD_DESK_USER = (
    '".bts-e .tx[data-bubble=user]{background:#1c1c1c;color:#fff;border-radius:18px;'
    'padding:7px 14px;line-height:22px;min-height:36px;box-sizing:border-box}"'
)
OLD_DESK_ASSIST = (
    '".bts-e .tx[data-bubble=assistant]{background:#1c1c1c0f;color:#1c1c1c;'
    'border:1px solid #1c1c1c14;border-radius:18px;padding:7px 14px;line-height:22px;'
    'min-height:36px;box-sizing:border-box;box-shadow:inset 3px 0 0 var(--role-swatch, transparent)}"'
)
NEW_DESK_USER = (
    '".bts-e .tx[data-bubble=user], .bts-e .tx[data-bubble=assistant]{background:transparent;'
    'color:var(--aw-text, var(--dsw-alias-label-primary));border:0;border-radius:0;padding:0;'
    'box-shadow:none}/* cut 2026-10-30 theme-tokens-root-switch */"'
)
NEW_DESK_ASSIST = (
    '".bts-e .tx[data-bubble=assistant]{background:transparent;border:0;box-shadow:none}"'
)


def _read(path):
    if not os.path.isfile(path):
        sys.exit("missing %s" % path)
    return io.open(path, encoding="utf-8").read()


def _write(path, text):
    io.open(path, "w", encoding="utf-8").write(text)


def _replace_one(text, old, new, label):
    count = text.count(old)
    if count != 1:
        sys.exit("anchor count=%d in %s (expect 1)" % (count, label))
    return text.replace(old, new, 1)


def _important(block):
    lines = []
    for line in block.split("\n"):
        if line.rstrip().endswith(";") and "!important" not in line:
            line = line[:-1] + " !important;"
        lines.append(line)
    return "\n".join(lines)


def _sheet():
    both = "body,\nbody[data-ds-dark-theme]"
    mobile = "\n".join([
        "@media (max-width: 820px) {",
        "body {",
        _important(AW_LIGHT),
        "}",
        "body[data-ds-dark-theme] {",
        _important(AW_DARK),
        "}",
        both + " {",
        _important(SURFACES),
        "}",
        "[data-dsh-aqua-ambient],",
        "[data-dsh-aqua] canvas { display: none !important; }",
        "}",
        "",
    ])
    return "\n".join([
        "",
        "/* %s" % MARKER,
        "   One token set. body[data-ds-dark-theme] is the only switch,",
        "   written by the theme presenter from ui-theme.preference. */",
        "body {",
        AW_LIGHT,
        "}",
        "body[data-ds-dark-theme] {",
        AW_DARK,
        "}",
        both + " {",
        SURFACES,
        "}",
        mobile,
    ])


def _dsh_ok(files):
    design = files[DESIGN]
    boot = files[BOOT]
    shell = files[SHELL]
    bubble = files[BUBBLE]
    assist = files[ASSIST]
    if design.count(MARKER) < 1 or boot.count(MARKER) < 1:
        return False
    if "--aw-page: #ffffff" not in design or "--aw-page: #000000" not in design:
        return False
    if "--aw-text: #000000" not in design or "--aw-text: #ffffff" not in design:
        return False
    if "--aw-main:" not in design or "--aw-sidebar:" not in design:
        return False
    if "--aw-border:" not in design or "--aw-divider:" not in design:
        return False
    if "body[data-ds-dark-theme]" not in design:
        return False
    if "--chrome: var(--aw-page)" not in design or "--pane: var(--aw-main)" not in design:
        return False
    if "--dsw-alias-bg-base: var(--aw-page) !important" not in design:
        return False
    if "--dsw-alias-label-primary: var(--aw-text) !important" not in design:
        return False
    if "@media (max-width: 820px)" not in design:
        return False
    if "#fcfcfc" in shell or "#fcfcfc" in design:
        return False
    if "background: transparent" not in bubble or "border-radius: 18px" in bubble:
        return False
    if "background: #1c1c1c0f" in assist or "border-radius: 18px" in assist:
        return False
    if "background: transparent" not in assist:
        return False
    if "DARK_BACKGROUND = '#000000'" not in boot or "color:#000000" not in boot:
        return False
    if "color:#ffffff" not in boot:
        return False
    return True


def patch_dsh(root):
    rels = (DESIGN, BOOT, SHELL, BUBBLE, ASSIST)
    paths = {rel: os.path.join(root, rel) for rel in rels}
    files = {rel: _read(path) for rel, path in paths.items()}
    if MARKER in files[DESIGN] or MARKER in files[SHELL]:
        if not _dsh_ok(files):
            sys.exit("marker present but theme tokens are incomplete")
        print("skip（已打）: theme tokens")
        return
    if PREV not in files[SHELL] or PREV not in files[BUBBLE] or PREV not in files[ASSIST]:
        sys.exit("chat shell is missing; run dsh-chat-shell-ui.py first")
    if "body[data-ds-dark-theme]" not in files[DESIGN] or "--dsw-alias-bg-base" not in files[DESIGN]:
        sys.exit("theme sheet is missing the root palette switch")
    files[SHELL] = _replace_one(files[SHELL], OLD_TOKENS, NEW_TOKENS, SHELL)
    files[BUBBLE] = _replace_one(files[BUBBLE], OLD_BUBBLE, NEW_BUBBLE, BUBBLE)
    files[ASSIST] = _replace_one(files[ASSIST], OLD_ASSIST, NEW_ASSIST, ASSIST)
    files[BOOT] = _replace_one(files[BOOT], OLD_BOOT_COLORS, NEW_BOOT_COLORS, BOOT + " colors")
    files[BOOT] = _replace_one(files[BOOT], OLD_BOOT_LIGHT, NEW_BOOT_LIGHT, BOOT + " light")
    files[BOOT] = _replace_one(files[BOOT], OLD_BOOT_DARK, NEW_BOOT_DARK, BOOT + " dark")
    files[DESIGN] = files[DESIGN].rstrip() + "\n" + _sheet()
    if not _dsh_ok(files):
        sys.exit("theme tokens failed their own check")
    for rel, text in files.items():
        _write(paths[rel], text)
    print("ok: theme tokens")


def _desk_ok(text):
    if MARKER not in text or PREV not in text:
        return False
    if "background:#1c1c1c0f" in text or "background:#1c1c1c;color:#fff" in text:
        return False
    if "background:transparent" not in text:
        return False
    if 'data-bubble' not in text:
        return False
    return True


def patch_desk(root):
    path = os.path.join(root, DESK)
    text = _read(path)
    if MARKER in text:
        if not _desk_ok(text):
            sys.exit("marker present but desk message text is incomplete")
        print("skip（已打）: desk plain messages")
        return
    if PREV not in text:
        sys.exit("chat shell desk patch is missing; run dsh-chat-shell-ui.py first")
    text = _replace_one(text, OLD_DESK_USER, NEW_DESK_USER, DESK + " user")
    text = _replace_one(text, OLD_DESK_ASSIST, NEW_DESK_ASSIST, DESK + " assistant")
    if not _desk_ok(text):
        sys.exit("desk plain messages failed their own check")
    _write(path, text)
    print("ok: desk plain messages")


def main():
    dsh = os.environ.get("DSH_SRC", "").strip()
    anywork = os.environ.get("ANYWORK_SRC", "").strip()
    if not dsh and not anywork:
        sys.exit(
            "DSH_SRC or ANYWORK_SRC is required. Docker image build sets one per stage. "
            "This patch does not target a native install."
        )
    if dsh:
        patch_dsh(dsh)
    if anywork:
        patch_desk(anywork)


if __name__ == "__main__":
    main()
