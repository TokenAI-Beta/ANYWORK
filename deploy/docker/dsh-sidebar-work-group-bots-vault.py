# -*- coding: utf-8 -*-
"""Docker image only: work card holds 机器人 and 资料库; drop 意见反馈.

Decision A (cut 2026-10-26 sidebar-work-group-bots-vault, amend AC4).
Two image-build trees, two invocations of this file:

  DSH_SRC      after dsh-sidebar-groups.py and before pnpm build.
               Edits the already-grouped SidebarRoot plus AccountMenu.
  ANYWORK_SRC  after dsh-sidebar-bots-subagents-merge.py.
               Renames the desk-hub outer label on the image copy of
               plugin/desk-panel. The committed plugin source is not
               the target. There is no home-directory default.

Work card order stays 新会话 / 功能与连接 (desk-skills-conn) /
自动化任务 (pinned schedules) / 机器人 (desk-bots) / 资料库 (desk-hub).
`only` is still one id per call, so the two new rows are two calls.
The except outlet lists both ids, so they do not also render under the
cards. 扩展 stays plugins + chat-import. 账户 stays desk-usage +
PanelMoreMenu. Those cards are not given these ids.

On dsh-v0.2.1-rc.3 the left-bottom 「更多」 is the account launcher:
signed out it renders t('more'), and its menu rows are settings,
contact (t('contactUs') = 「意见反馈」), and sign-in or sign-out.
PanelMoreMenu is the 账户 card's panels.more list. It has no
意见反馈 row. This patch removes only the contact row. Settings,
sign-in, sign-out, beginSignIn, and PanelMoreMenu stay. The contactUs
prop stays referenced so noUnusedParameters still holds. 公告
(desk-announce) and the in-panel feedback section stay.

desk-hub keeps TeamHub (drive + notes). desk-bots keeps BotsPanel.
This script does not unregister desk-auto and does not edit the login URL.
"""
import io
import os
import sys

MARKER = "cut 2026-10-26 sidebar-work-group-bots-vault"
GROUPS_MARKER = "cut 2026-10-26 sidebar-ui-refresh"
REL_TSX = "packages/client/ui-sidebar/src/client/SidebarRoot.tsx"
REL_MENU = "packages/client/ui-settings-account/src/client/AccountMenu.tsx"
REL_CLIENT = "plugin/desk-panel/lib/client.js"

OLD_EXCEPT = "except: ['desk-skills-conn', 'chat-import', 'desk-usage']"
NEW_EXCEPT = "except: ['desk-skills-conn', 'chat-import', 'desk-usage', 'desk-bots', 'desk-hub']"

OLD_TAIL = """          {panels.filter(({ id }) => id === 'schedules' && !unpinned.includes(id)).map(({ id, label }) => (
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
        </section>
"""
NEW_TAIL = """          {panels.filter(({ id }) => id === 'schedules' && !unpinned.includes(id)).map(({ id, label }) => (
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
          {/* ANYWORK Docker image (cut 2026-10-26 sidebar-work-group-bots-vault):
              机器人 (desk-bots) then 资料库 (desk-hub). Same panels, work card only. */}
          {renderSlot('sidebar.footer.action', { wide }, { only: 'desk-bots' })}
          {renderSlot('sidebar.footer.action', { wide }, { only: 'desk-hub' })}
        </section>
"""

OLD_IMPORT = (
    "  Toast, Menu, IconEllipsisOutlineMedium, IconPaperPlaneOutlineMedium, "
    "IconSettingsOutlineMedium, IconUserOutlineMedium,\n"
)
NEW_IMPORT = (
    "  Toast, Menu, IconEllipsisOutlineMedium, IconSettingsOutlineMedium, "
    "IconUserOutlineMedium,\n"
)

OLD_ITEM = """        { id: 'settings', label: t('settings'), icon: <IconSettingsOutlineMedium size={16} />,
          ...(settingsShortcut === undefined ? {} : { shortcut: settingsShortcut }) },
        { id: 'contact', label: t('contactUs'), icon: <IconPaperPlaneOutlineMedium size={16} /> },
        ...(signedIn ? [{ id: 'signout', label: t('signOut'), icon: <LogoutIcon />, disabled: busy }]
          : [{ id: 'signin', label: t('signIn'), icon: <IconUserOutlineMedium size={16} /> }]),
"""
NEW_ITEM = """        { id: 'settings', label: t('settings'), icon: <IconSettingsOutlineMedium size={16} />,
          ...(settingsShortcut === undefined ? {} : { shortcut: settingsShortcut }) },
        // ANYWORK Docker image (cut 2026-10-26 sidebar-work-group-bots-vault):
        // signed-out launcher is t('more') 「更多」. Drop only the contact row
        // （意见反馈）. Settings, sign-in, and sign-out stay.
        // panels.more is a different menu and is not edited.
        ...(signedIn ? [{ id: 'signout', label: t('signOut'), icon: <LogoutIcon />, disabled: busy }]
          : [{ id: 'signin', label: t('signIn'), icon: <IconUserOutlineMedium size={16} /> }]),
"""

OLD_ZH = '      "th.tab": "团队资料",'
NEW_ZH = """      // ANYWORK Docker image (cut 2026-10-26 sidebar-work-group-bots-vault): outer label 「资料库」.
      "th.tab": "资料库","""
OLD_CSS_NOTE = "    /* —— 团队资料面板（TeamHub） —— */"
NEW_CSS_NOTE = "    /* —— 资料库面板（TeamHub） —— */"

HUB_PATHS = (
    "/portal/api/drive/list",
    "/portal/api/drive/upload",
    "/portal/api/drive/mkdir",
    "/portal/api/drive/rm",
    "/portal/api/drive/mv",
    "/portal/api/drive/download",
    "/portal/api/kb/list",
    "/portal/api/kb/search",
    "/portal/api/kb/note",
    "/portal/api/kb/save",
)
BOT_PATHS = (
    "/portal/api/panel/bots",
    "/portal/api/panel/bot-chat",
    "/portal/api/panel/room",
    "/portal/api/panel/agents",
    "/portal/api/panel/agent-runs",
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


def tsx_ok(text):
    if text.count(MARKER) != 1 or text.count(GROUPS_MARKER) != 1:
        return False
    work = text.find('data-dsh-nav-group="work"')
    extend = text.find('data-dsh-nav-group="extend"')
    account = text.find('data-dsh-nav-group="account"')
    workspaces = text.find("renderSlot('sidebar.workspaces'")
    if min(work, extend, account, workspaces) < 0:
        return False
    if not (work < extend < account < workspaces):
        return False
    except_at = text.find(NEW_EXCEPT)
    work_chunk = text[work:extend]
    extend_chunk = text[extend:account]
    # The except outlet sits after the account card and before workspaces.
    # Cut the card body there so the exclusion list is not read as a card row.
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
    if except_at < account or text.count(NEW_EXCEPT) != 1:
        return False
    if OLD_EXCEPT in text:
        return False
    if text.count("renderSlot('sidebar.footer.action'") != 6:
        return False
    if text.count("renderSlot('sidebar.settings'") != 1:
        return False
    if text.count("renderSlot('sidebar.workspaces'") != 1:
        return False
    if "团队资料" in text:
        return False
    return True


def menu_ok(text):
    if text.count(MARKER) != 1:
        return False
    if "id: 'contact'" in text or "t('contactUs')" in text:
        return False
    if "IconPaperPlaneOutlineMedium" in text:
        return False
    if "else if (id === 'contact') { setOpen(false); contactUs() }" not in text:
        return False
    if "id: 'settings'" not in text or "openSettings()" not in text:
        return False
    if "id: 'signin'" not in text or "id: 'signout'" not in text:
        return False
    if "else if (id === 'signin') beginSignIn()" not in text:
        return False
    if "requestSignOut()" not in text:
        return False
    if "t('more')" not in text or "t('settings')" not in text or "t('signIn')" not in text:
        return False
    if "t('signOut')" not in text:
        return False
    if "PanelMoreMenu" in text:
        return False
    return True


def panel_ok(text):
    if text.count(MARKER) != 1:
        return False
    if text.count('"th.tab": "资料库"') != 1:
        return False
    if "团队资料" in text:
        return False
    if text.count('id: "desk-hub"') != 1:
        return False
    hub = text.find('id: "desk-hub"')
    window = text[hub:hub + 350]
    if 'return tr("th.tab")' not in window or "TeamHub" not in window:
        return False
    if 'id: "desk-announce"' not in text or 'id: "desk-bots"' not in text:
        return False
    if '"ann.tab": "公告"' not in text or '"ann.feedbackTab": "意见反馈"' not in text:
        return False
    if "function TeamHub(" not in text or "function BotsPanel(" not in text:
        return False
    if "function AnnounceBoard(" not in text:
        return False
    trigger = text.find("function TeamHub(")
    button = text.find('tr("th.tab")', trigger)
    if button < 0:
        return False
    for path in HUB_PATHS + BOT_PATHS:
        if path not in text:
            return False
    if '"th.tab": "Team files"' not in text:
        return False
    return True


def patch_harness(root):
    tsx_path = os.path.join(root, REL_TSX)
    menu_path = os.path.join(root, REL_MENU)
    tsx = _read(tsx_path)
    menu = _read(menu_path)
    if MARKER in tsx or MARKER in menu:
        if MARKER not in tsx or MARKER not in menu or not tsx_ok(tsx) or not menu_ok(menu):
            sys.exit("marker present but work-group bots/vault is wrong")
        print("skip（已打）:", REL_TSX)
        return
    if GROUPS_MARKER not in tsx or OLD_EXCEPT not in tsx or 'data-dsh-nav-group="work"' not in tsx:
        sys.exit("sidebar groups are missing; run dsh-sidebar-groups.py first")
    updated_tsx = _replace_one(tsx, OLD_TAIL, NEW_TAIL, REL_TSX)
    updated_tsx = _replace_one(updated_tsx, OLD_EXCEPT, NEW_EXCEPT, REL_TSX)
    updated_menu = _replace_one(menu, OLD_IMPORT, NEW_IMPORT, REL_MENU)
    updated_menu = _replace_one(updated_menu, OLD_ITEM, NEW_ITEM, REL_MENU)
    if not tsx_ok(updated_tsx):
        sys.exit("patched work card is wrong: %s" % REL_TSX)
    if not menu_ok(updated_menu):
        sys.exit("patched account menu is wrong: %s" % REL_MENU)
    io.open(tsx_path, "w", encoding="utf-8").write(updated_tsx)
    io.open(menu_path, "w", encoding="utf-8").write(updated_menu)
    print("ok:", REL_TSX)


def patch_panel(root):
    path = os.path.join(root, REL_CLIENT)
    text = _read(path)
    if MARKER in text:
        if not panel_ok(text):
            sys.exit("marker present but vault rename is wrong: %s" % REL_CLIENT)
        print("skip（已打）:", REL_CLIENT)
        return
    updated = _replace_one(text, OLD_ZH, NEW_ZH, REL_CLIENT)
    updated = _replace_one(updated, OLD_CSS_NOTE, NEW_CSS_NOTE, REL_CLIENT)
    if not panel_ok(updated):
        sys.exit("patched vault label is wrong: %s" % REL_CLIENT)
    io.open(path, "w", encoding="utf-8").write(updated)
    print("ok:", REL_CLIENT)


def main():
    dsh = os.environ.get("DSH_SRC", "").strip()
    anywork = os.environ.get("ANYWORK_SRC", "").strip()
    if not dsh and not anywork:
        sys.exit(
            "DSH_SRC or ANYWORK_SRC is required. Docker image build sets DSH_SRC to the "
            "clone inside the image and ANYWORK_SRC to /opt/anywork. This patch does not "
            "target a native install."
        )
    if dsh:
        patch_harness(dsh)
    if anywork:
        patch_panel(anywork)


if __name__ == "__main__":
    main()
