# -*- coding: utf-8 -*-
"""Docker image only: 扩展「导入会话」click reveals the import layer.

On dsh-v0.2.1-rc.3, dsh-chat-import@0.26.2 (pin unchanged) registers
sidebar.footer.action id chat-import. The button's onClick calls
sidebarRight.openTab('chat-import'). That tab mounts on the chat shell's
right column. Playtest on image e8b19402… (FINDING
2026-10-26-import-session-click): the click fires, and from the chat
shell the import UI opens. From a main panel (plugins) or a desk
full-view (bots, hub, and the other .ddp.fv sheets) the same tab opens
under the cover, so the click looks dead until 新会话 returns to the
chat shell. only:'chat-import' is still the extend card. This is not a
grouping regression.

This patch, on the extend section only, captures that click before the
plugin handler. If a main panel is selected, selectPanel(null) returns
to the conversation (the layout service's documented null). It also
dispatches the desk-fv event desk-panel already uses to close every
full-view (detail.id null matches none of the open sheets). The plugin
click is not stopped, so openTab still runs in the same turn, against
a shell that is no longer covered. Other rows in the card (插件) are
not footer.action and do not take this path. Work / account membership
is unchanged. No new session is started.

Runs after dsh-sidebar-work-group-bots-vault.py and before pnpm build.
DSH_SRC is required. There is no home-directory default, so the script
cannot land on a native install or a Windows checkout. Tokyo stays frozen.
"""
import io
import os
import sys

MARKER = "cut 2026-10-26 chat-import-open"
WORK_MARKER = "cut 2026-10-26 sidebar-work-group-bots-vault"
GROUPS_MARKER = "cut 2026-10-26 sidebar-ui-refresh"
REL_TSX = "packages/client/ui-sidebar/src/client/SidebarRoot.tsx"
NEW_EXCEPT = "except: ['desk-skills-conn', 'chat-import', 'desk-usage', 'desk-bots', 'desk-hub']"

OLD_EXTEND = """        <section className={clsx(css.navGroup, css.footerActions)} data-dsh-nav-group="extend" aria-label="扩展">
          <div className={css.navGroupLabel}>扩展</div>
          {panels.filter(({ id }) => id === FIXED_PANEL_ID).map(({ id, label }) => (
            <PanelRow
              key={id}
              id={id}
              label={label}
              wide={wide}
              usePanelInfo={usePanelInfo}
              selectPanel={selectPanel}
              trackEntryClick={trackEntryClick}
              renderSlot={renderSlot}
            />
          ))}
          {renderSlot('sidebar.footer.action', { wide }, { only: 'chat-import' })}
        </section>
"""

NEW_EXTEND = """        <section
          className={clsx(css.navGroup, css.footerActions)}
          data-dsh-nav-group="extend"
          aria-label="扩展"
          onClickCapture={(event) => {
            // ANYWORK Docker image (cut 2026-10-26 chat-import-open):
            // import UI mounts on the chat shell. A covering main panel or
            // desk full-view leaves that tab latent. Reveal the shell in
            // this same click; the button's own handler still opens the tab.
            const node = event.target
            if (!(node instanceof Element)) return
            if (node.closest('[data-slot="sidebar.footer.action"]') === null) return
            if (activePanelId !== null) {
              (selectPanel as unknown as (id: null) => void)(null)
            }
            window.dispatchEvent(new CustomEvent('desk-fv', { detail: { id: null } }))
          }}
        >
          <div className={css.navGroupLabel}>扩展</div>
          {panels.filter(({ id }) => id === FIXED_PANEL_ID).map(({ id, label }) => (
            <PanelRow
              key={id}
              id={id}
              label={label}
              wide={wide}
              usePanelInfo={usePanelInfo}
              selectPanel={selectPanel}
              trackEntryClick={trackEntryClick}
              renderSlot={renderSlot}
            />
          ))}
          {renderSlot('sidebar.footer.action', { wide }, { only: 'chat-import' })}
        </section>
"""


def _read(path):
    if not os.path.isfile(path):
        sys.exit("missing %s" % path)
    return io.open(path, encoding="utf-8").read()


def _replace_one(text, old, new, label):
    count = text.count(old)
    if count != 1:
        sys.exit("anchor count=%d in %s (expect 1)" % (count, label))
    return text.replace(old, new, 1)


def tsx_ok(text):
    if text.count(MARKER) != 1 or text.count(WORK_MARKER) != 1 or text.count(GROUPS_MARKER) != 1:
        return False
    work = text.find('data-dsh-nav-group="work"')
    extend = text.find('data-dsh-nav-group="extend"')
    account = text.find('data-dsh-nav-group="account"')
    workspaces = text.find("renderSlot('sidebar.workspaces'")
    except_at = text.find(NEW_EXCEPT)
    if min(work, extend, account, workspaces, except_at) < 0:
        return False
    if not (work < extend < account < except_at < workspaces):
        return False
    work_chunk = text[work:extend]
    extend_chunk = text[extend:account]
    account_chunk = text[account:except_at]
    order = [
        work_chunk.find("css.newSession"),
        work_chunk.find("only: 'desk-skills-conn'"),
        work_chunk.find("id === 'schedules'"),
        work_chunk.find("only: 'desk-bots'"),
        work_chunk.find("only: 'desk-hub'"),
    ]
    if min(order) < 0 or order != sorted(order):
        return False
    if "desk-bots" in extend_chunk or "desk-hub" in extend_chunk:
        return False
    if "desk-bots" in account_chunk or "desk-hub" in account_chunk:
        return False
    if ">工作<" not in work_chunk or ">扩展<" not in extend_chunk or ">账户<" not in account_chunk:
        return False
    if "only: 'chat-import'" not in extend_chunk or "id === FIXED_PANEL_ID" not in extend_chunk:
        return False
    if "only: 'desk-usage'" not in account_chunk:
        return False
    if "PanelMoreMenu" not in account_chunk or "t('panels.more')" not in account_chunk:
        return False
    if text.count("only: 'desk-skills-conn'") != 1:
        return False
    if text.count("only: 'chat-import'") != 1 or text.count("only: 'desk-usage'") != 1:
        return False
    if text.count("only: 'desk-bots'") != 1 or text.count("only: 'desk-hub'") != 1:
        return False
    if text.count(NEW_EXCEPT) != 1:
        return False
    if text.count("renderSlot('sidebar.footer.action'") != 6:
        return False
    if text.count("renderSlot('sidebar.settings'") != 1:
        return False
    if text.count("renderSlot('sidebar.workspaces'") != 1:
        return False
    if "onClickCapture" not in extend_chunk:
        return False
    if "onClickCapture" in work_chunk or "onClickCapture" in account_chunk:
        return False
    if '[data-slot="sidebar.footer.action"]' not in extend_chunk:
        return False
    if "activePanelId !== null" not in extend_chunk:
        return False
    if "(selectPanel as unknown as (id: null) => void)(null)" not in extend_chunk:
        return False
    if "new CustomEvent('desk-fv', { detail: { id: null } })" not in extend_chunk:
        return False
    if "stopPropagation" in extend_chunk or "preventDefault" in extend_chunk:
        return False
    if "startSession()" in extend_chunk:
        return False
    if "desk-fv" in work_chunk or "desk-fv" in account_chunk:
        return False
    # 插件 stays a PanelRow. The capture handler does not replace its click.
    if extend_chunk.count("selectPanel={selectPanel}") != 1:
        return False
    if "团队资料" in text:
        return False
    return True


def main():
    root = os.environ.get("DSH_SRC", "").strip()
    if not root:
        sys.exit(
            "DSH_SRC is required. Docker image build sets it to the clone inside the image. "
            "This patch does not target a native install."
        )
    path = os.path.join(root, REL_TSX)
    text = _read(path)
    if MARKER in text:
        if not tsx_ok(text):
            sys.exit("marker present but chat-import open path is wrong")
        print("skip（已打）:", REL_TSX)
        return
    if WORK_MARKER not in text or GROUPS_MARKER not in text or 'data-dsh-nav-group="extend"' not in text:
        sys.exit("work-group sidebar is missing; run dsh-sidebar-work-group-bots-vault.py first")
    updated = _replace_one(text, OLD_EXTEND, NEW_EXTEND, REL_TSX)
    if not tsx_ok(updated):
        sys.exit("patched chat-import open path is wrong: %s" % REL_TSX)
    io.open(path, "w", encoding="utf-8").write(updated)
    print("ok:", REL_TSX)


if __name__ == "__main__":
    main()
