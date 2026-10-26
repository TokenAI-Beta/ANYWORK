# -*- coding: utf-8 -*-
"""Docker image only: drop account 「更多」 and move create-plugin onto 插件.

On dsh-v0.2.1-rc.3 the account-card row Bai circled is PanelMoreMenu
(label t('panels.more')). Its popover is sidebar.panellist.actions.
ui-entry-customization renders two rows there: t('install')
「浏览更多插件」 and t('create') 「创建你的插件」. The create row calls

    uiWorkspace.startSession(undefined, {
      agentPreset: 'cordis',
      prompt: t('createPrompt.sidebar'),
      whenDraftExists: 'append',
    })

and does not send. This patch removes that host from the account card.
The same menu component also fills the right-sidebar guide More menu,
so the browse row renders only for the conversation header (not a
sidebar). The right-sidebar guide keeps its own create row, with the
rightbar prompt.

「创建你的插件」 becomes a visible button on the Plugins main-list
toolbar (the 扩展 card's 插件 panel). ui-entry-customization registers
it on plugins.toolbar.actions and calls the same startSession with the
sidebar prompt. The Add-plugin menu and its create-plugin item stay.

The foot account launcher is a different host (sidebar.settings /
AccountMenu). Signed-out copy is still t('more'). Settings, sign-in,
and beginSignIn stay. This script does not edit AccountMenu.

Runs after dsh-sidebar-chat-import-open.py and before pnpm build.
DSH_SRC is required. There is no home-directory default, so the script
cannot land on a native install or a Windows checkout. Tokyo stays frozen.
Do not re-run chat-import-open after this step: its check still expects
PanelMoreMenu on the account card.
"""
import io
import os
import sys

MARKER = "cut 2026-10-26 sidebar-more-to-plugins"
CHAT_MARKER = "cut 2026-10-26 chat-import-open"
WORK_MARKER = "cut 2026-10-26 sidebar-work-group-bots-vault"
GROUPS_MARKER = "cut 2026-10-26 sidebar-ui-refresh"
REL_TSX = "packages/client/ui-sidebar/src/client/SidebarRoot.tsx"
REL_MENU = "packages/client/ui-entry-customization/src/client/EntryMenuContent.tsx"
REL_MENU_CSS = "packages/client/ui-entry-customization/src/client/EntryMenu.module.css"
REL_ENTRY = "packages/client/ui-entry-customization/src/client/index.ts"
REL_CONTRACT = "packages/client/ui-plugin-manager/src/client/slot-contract.ts"
REL_PM = "packages/client/ui-plugin-manager/src/client/index.ts"
REL_PAGE = "packages/client/ui-plugin-manager/src/client/PluginManagerPage.tsx"
NEW_EXCEPT = "except: ['desk-skills-conn', 'chat-import', 'desk-usage', 'desk-bots', 'desk-hub']"
CREATOR_CALL = "agentPreset: 'cordis', prompt: t(`createPrompt.${region}`), whenDraftExists: 'append'"

OLD_IMPORTS = """import {
  FishLogo, IconAppsAddOutlineRegular, IconNewChatOutlineMedium, IconNewChatOutlineRegular, IconPanelLeftOutlineRegular,
  isDarwinDesktop, Menu, ShortcutKeys, Tooltip,
} from '@deepseek-ai/dsh-client-ui-primitives'
import type { InjectFace, PropsRenderSlots, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'
import type {
  SidebarPanelActionsOwnerProps, SidebarPanelMetadata, SidebarRootComponentProps, SidebarRootInjected, SidebarSectionOwnerProps,
} from './contract/slots.ts'
"""
NEW_IMPORTS = """import {
  FishLogo, IconNewChatOutlineMedium, IconNewChatOutlineRegular, IconPanelLeftOutlineRegular,
  isDarwinDesktop, ShortcutKeys, Tooltip,
} from '@deepseek-ai/dsh-client-ui-primitives'
import type { InjectFace, PropsRenderSlots, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'
import type {
  SidebarPanelMetadata, SidebarRootComponentProps, SidebarRootInjected, SidebarSectionOwnerProps,
} from './contract/slots.ts'
"""

OLD_MORE_FN = """type PanelMoreMenuProps =
  Pick<SidebarSectionOwnerProps, 'wide'>
  & Omit<SidebarPanelActionsOwnerProps, 'onDismiss'>
  & PropsRenderSlots<'sidebar.panellist.actions'>
  & Pick<InjectFace<SidebarRootInjected>, 'trackEntryClick'>
  & { readonly label: string }

/** The panel list's More launcher: a panel-row button whose menu rows come from `sidebar.panellist.actions`. */
function PanelMoreMenu({ wide, label, entries, onOpen, onPinnedChange, trackEntryClick, renderSlot }: PanelMoreMenuProps) {
  const [open, setOpen] = useState(false)
  const onDismiss = (): void => { setOpen(false) }
  return (
    <Menu open={open} onClose={onDismiss} portal autoFocus className={css.moreAnchor} listClassName={css.moreMenu}
      anchor={(
        <Tooltip label={label} delayMs={500} disabled={wide}>
          <button type="button" className={css.panelRow} aria-label={label} aria-haspopup="menu" aria-expanded={open}
            onClick={() => {
              trackEntryClick({ menu_name: 'more', position: 'sidebar' })
              setOpen(value => !value)
            }}>
            <span className={css.panelGlyph} aria-hidden="true"><IconAppsAddOutlineRegular size={wide ? 16 : 18} /></span>
            {wide && <span className={clsx(css.panelTitle, css.wide)}>{label}</span>}
          </button>
        </Tooltip>
      )}>
      {renderSlot('sidebar.panellist.actions', { entries, onOpen, onPinnedChange, onDismiss })}
    </Menu>
  )
}

"""
NEW_MORE_FN = ""

OLD_HOOKS = """  selectPanel,
  setPinned,
  trackEntryClick,
  usePanels,
  useEntryPins,
  useEntryActions,
  useShortcuts,
"""
NEW_HOOKS = """  selectPanel,
  trackEntryClick,
  usePanels,
  useEntryPins,
  useShortcuts,
"""

OLD_PINS = """  const panels = usePanels(snapshot => snapshot)
  const unpinned = useEntryPins(ids => ids)
  const activePanelId = usePanelInfo(info => info.activePanelId)
  const hasEntryActions = useEntryActions(registered => registered)
"""
NEW_PINS = """  const panels = usePanels(snapshot => snapshot)
  const unpinned = useEntryPins(ids => ids)
  const activePanelId = usePanelInfo(info => info.activePanelId)
"""

OLD_ACCOUNT = """        <section className={clsx(css.navGroup, css.footerActions)} data-dsh-nav-group="account" aria-label="账户">
          <div className={css.navGroupLabel}>账户</div>
          {renderSlot('sidebar.footer.action', { wide }, { only: 'desk-usage' })}
          {hasEntryActions && (
            <PanelMoreMenu
              wide={wide}
              label={t('panels.more')}
              entries={panels.filter(({ id }) => id !== FIXED_PANEL_ID)
                .map(({ id, label }) => ({ id, label, pinned: !unpinned.includes(id), active: id === activePanelId }))}
              onOpen={(id) => {
                const entry = officialEntry(id)
                if (entry !== undefined) trackEntryClick({ menu_name: entry, position: 'sidebar_more' })
                const panel = panels.find(candidate => candidate.id === id)
                if (panel !== undefined) selectPanel(panel.id)
              }}
              onPinnedChange={setPinned}
              trackEntryClick={trackEntryClick}
              renderSlot={renderSlot}
            />
          )}
        </section>
"""
NEW_ACCOUNT = """        <section className={clsx(css.navGroup, css.footerActions)} data-dsh-nav-group="account" aria-label="账户">
          <div className={css.navGroupLabel}>账户</div>
          {renderSlot('sidebar.footer.action', { wide }, { only: 'desk-usage' })}
          {/* ANYWORK Docker image (cut 2026-10-26 sidebar-more-to-plugins):
              account card no longer draws panels.more. Settings and sign-in
              stay on sidebar.settings in the foot. */}
        </section>
"""

OLD_MENU_IMPORT = """import {
  IconCheckOutlineRegular, IconPluginPinwheelOutlineRegular, IconPlusOutlineRegular, MenuItemButton,
} from '@deepseek-ai/dsh-client-ui-primitives'
"""
NEW_MENU_IMPORT = """import {
  Button, IconCheckOutlineRegular, IconPluginPinwheelOutlineRegular, IconPlusOutlineRegular, MenuItemButton,
} from '@deepseek-ai/dsh-client-ui-primitives'
"""

OLD_MENU_ROWS = """    <MenuItemButton separatorBefore={moreEntries.length > 0} icon={<IconPluginPinwheelOutlineRegular size={16} />}
      onSelect={() => { onDismiss(); browsePlugins() }}>
      {t('install')}
    </MenuItemButton>
    <MenuItemButton icon={<IconPlusOutlineRegular size={16} />} onSelect={() => { onDismiss(); createPlugin() }}>
      {t('create')}
    </MenuItemButton>
  </>
}
"""
NEW_MENU_ROWS = """    {/* ANYWORK Docker image (cut 2026-10-26 sidebar-more-to-plugins):
        「浏览更多插件」 stays on the conversation More menu only.
        Left and right sidebar menus do not render it. */}
    {region === 'conversation' ? (
      <MenuItemButton separatorBefore={moreEntries.length > 0} icon={<IconPluginPinwheelOutlineRegular size={16} />}
        onSelect={() => { onDismiss(); browsePlugins() }}>
        {t('install')}
      </MenuItemButton>
    ) : null}
    <MenuItemButton icon={<IconPlusOutlineRegular size={16} />} onSelect={() => { onDismiss(); createPlugin() }}>
      {t('create')}
    </MenuItemButton>
  </>
}

/**
 * Visible create control on the Plugins main-list toolbar.
 * @param props - localized label and the sidebar Creator action.
 * @returns the toolbar button. The click does not send the draft.
 */
export function CreatePluginToolbarButton({
  t, createPlugin,
}: PropsRuntime<'plugins.toolbar.actions'>
  & PropsLocale<'entryCustomization'>
  & InjectFace<Pick<EntryMenuInjected, 'createPlugin'>>) {
  return (
    <Button variant="outline" size="sm" className={css.createPlugin} icon={<IconPlusOutlineRegular size={13} />}
      onClick={() => { createPlugin() }}>
      {t('create')}
    </Button>
  )
}
"""

CSS_APPEND = """
/* cut 2026-10-26 sidebar-more-to-plugins: match the Plugins toolbar Add button. */
.createPlugin {
  height: 32px;
  font-size: 13px;
  line-height: 20px;
  padding: 0 12px;
  border-radius: var(--dsw-radius-md);
}
"""

OLD_ENTRY_IMPORT = """import { EntryMenuContent, type EntryMenuInjected, type EntryRegion } from './EntryMenuContent.tsx'
"""
NEW_ENTRY_IMPORT = """import { CreatePluginToolbarButton, EntryMenuContent, type EntryMenuInjected, type EntryRegion } from './EntryMenuContent.tsx'
"""

OLD_INJECTED = """  const injected = (region: EntryRegion): EntryMenuInjected => ({
    region,
    browsePlugins: () => {
      ctx.get('productAnalytics')?.track('more_menu_item_click', { region, action: 'browse_plugins' })
      ctx.pluginNavigation.openList()
    },
    createPlugin: () => {
      ctx.get('productAnalytics')?.track('more_menu_item_click', { region, action: 'create_plugin' })
      ctx.uiWorkspace.startSession(undefined, {
        agentPreset: 'cordis', prompt: t(`createPrompt.${region}`), whenDraftExists: 'append',
      })
    },
  })
"""
NEW_INJECTED = """  // ANYWORK Docker image (cut 2026-10-26 sidebar-more-to-plugins):
  // Plugins toolbar and the remaining More rows share this Creator draft.
  // Same arguments the sidebar 「创建你的插件」 row used. It does not send.
  const openCreator = (region: EntryRegion): void => {
    ctx.uiWorkspace.startSession(undefined, {
      agentPreset: 'cordis', prompt: t(`createPrompt.${region}`), whenDraftExists: 'append',
    })
  }
  const injected = (region: EntryRegion): EntryMenuInjected => ({
    region,
    browsePlugins: () => {
      ctx.get('productAnalytics')?.track('more_menu_item_click', { region, action: 'browse_plugins' })
      ctx.pluginNavigation.openList()
    },
    createPlugin: () => {
      ctx.get('productAnalytics')?.track('more_menu_item_click', { region, action: 'create_plugin' })
      openCreator(region)
    },
  })
"""

OLD_RIGHTBAR = """  ctx.slots.inject('sidebar.right.tab.guide.actions', () => ctx.slots.register({
    name: 'sidebar.right.tab.guide.actions', id: 'entry-customization', locale: 'entryCustomization',
    inject: () => injected('rightbar'),
  }, EntryMenuContent))
}
"""
NEW_RIGHTBAR = """  ctx.slots.inject('sidebar.right.tab.guide.actions', () => ctx.slots.register({
    name: 'sidebar.right.tab.guide.actions', id: 'entry-customization', locale: 'entryCustomization',
    inject: () => injected('rightbar'),
  }, EntryMenuContent))
  ctx.slots.inject('plugins.toolbar.actions', () => ctx.slots.register({
    name: 'plugins.toolbar.actions', id: 'create-plugin', locale: 'entryCustomization',
    inject: () => ({ createPlugin: () => { openCreator('sidebar') } }),
  }, CreatePluginToolbarButton))
}
"""

OLD_ADD_PROPS = """export interface PluginAddActionsProps {
  /** Close the add-plugin menu before starting the contributed action. */
  readonly onDismiss: () => void
}
"""
NEW_ADD_PROPS = """export interface PluginAddActionsProps {
  /** Close the add-plugin menu before starting the contributed action. */
  readonly onDismiss: () => void
}

/** Visible control on the Plugins main-list toolbar. The entry owns the click. */
export interface PluginToolbarActionsProps {
  /** Where the page draws the entry. cut 2026-10-26 sidebar-more-to-plugins. */
  readonly placement: 'toolbar'
}
"""

OLD_ADD_SLOT = """    'plugins.add.actions': { kind: 'list'; scope: 'root'; owner: PluginAddActionsProps }
"""
NEW_ADD_SLOT = """    'plugins.add.actions': { kind: 'list'; scope: 'root'; owner: PluginAddActionsProps }
    /** Visible toolbar actions on the Plugins main list, before Add plugin. */
    'plugins.toolbar.actions': { kind: 'list'; scope: 'root'; owner: PluginToolbarActionsProps }
"""

OLD_PM_CHILD = """        'plugins.add.actions': { kind: 'list', scope: 'root' },
        'plugins.tab': { kind: 'list', scope: 'root' },
"""
NEW_PM_CHILD = """        'plugins.add.actions': { kind: 'list', scope: 'root' },
        // ANYWORK Docker image (cut 2026-10-26 sidebar-more-to-plugins):
        // 「创建你的插件」 renders in the Plugins toolbar.
        'plugins.toolbar.actions': { kind: 'list', scope: 'root' },
        'plugins.tab': { kind: 'list', scope: 'root' },
"""

OLD_PAGE_UNION = """    | 'plugins.add.actions' | 'plugins.tab'
"""
NEW_PAGE_UNION = """    | 'plugins.add.actions' | 'plugins.tab' | 'plugins.toolbar.actions'
"""

OLD_TOOLBAR = """              </Tooltip>
              {state.install.requestId === undefined
"""
NEW_TOOLBAR = """              </Tooltip>
              {/* ANYWORK Docker image (cut 2026-10-26 sidebar-more-to-plugins):
                  visible 「创建你的插件」. Same Creator draft as the old sidebar row. */}
              {renderSlot('plugins.toolbar.actions', { placement: 'toolbar' })}
              {state.install.requestId === undefined
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


def _chunk(text, start_key, end_key):
    start = text.find(start_key)
    end = text.find(end_key, start + 1) if start >= 0 else -1
    if start < 0 or end < start:
        return ""
    return text[start:end]


def tsx_ok(text):
    if text.count(MARKER) != 1 or text.count(CHAT_MARKER) != 1 or text.count(WORK_MARKER) != 1:
        return False
    if text.count(GROUPS_MARKER) != 1:
        return False
    work = text.find('data-dsh-nav-group="work"')
    extend = text.find('data-dsh-nav-group="extend"')
    account = text.find('data-dsh-nav-group="account"')
    except_at = text.find(NEW_EXCEPT)
    workspaces = text.find("renderSlot('sidebar.workspaces'")
    if min(work, extend, account, except_at, workspaces) < 0:
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
    if "onClickCapture" not in extend_chunk or "desk-fv" not in extend_chunk:
        return False
    if "onClickCapture" in work_chunk or "onClickCapture" in account_chunk:
        return False
    if "only: 'desk-usage'" not in account_chunk:
        return False
    if "PanelMoreMenu" in text or "t('panels.more')" in text or "panels.more" not in account_chunk:
        return False
    if "hasEntryActions" in text or "useEntryActions" in text or "setPinned" in text:
        return False
    if "IconAppsAddOutlineRegular" in text or "SidebarPanelActionsOwnerProps" in text:
        return False
    if "<Menu " in text or "\n  Menu," in text:
        return False
    if "function PanelMoreMenu" in text:
        return False
    if text.count("only: 'desk-usage'") != 1 or text.count("only: 'chat-import'") != 1:
        return False
    if text.count("only: 'desk-skills-conn'") != 1:
        return False
    if text.count("only: 'desk-bots'") != 1 or text.count("only: 'desk-hub'") != 1:
        return False
    if text.count(NEW_EXCEPT) != 1:
        return False
    if text.count("renderSlot('sidebar.footer.action'") != 6:
        return False
    if text.count("renderSlot('sidebar.settings'") != 1:
        return False
    if text.count("activePanelId") < 1:
        return False
    if "id === 'schedules'" not in work_chunk:
        return False
    if "团队资料" in text:
        return False
    return True


def menu_ok(text):
    if text.count(MARKER) != 1:
        return False
    if "export function CreatePluginToolbarButton" not in text:
        return False
    if text.count("t('create')") != 2 or text.count("t('install')") != 1:
        return False
    # Upstream already gates folded rows with `region === 'conversation'`.
    # The browse action gets the same gate; sidebar and rightbar skip it.
    guard = text.find("{region === 'conversation' ? (")
    install = text.find("t('install')")
    browse = text.find("browsePlugins()")
    if min(guard, install, browse) < 0 or not (guard < browse < install):
        return False
    if text.count("browsePlugins()") != 1:
        return False
    if "onClick={() => { createPlugin() }}" not in text:
        return False
    if 'variant="outline"' not in text or "css.createPlugin" not in text:
        return False
    if "PropsRuntime<'plugins.toolbar.actions'>" not in text:
        return False
    return True


def css_ok(text):
    if text.count(MARKER) != 1:
        return False
    if ".createPlugin {" not in text or "height: 32px;" not in text:
        return False
    return True


def entry_ok(text):
    if text.count(MARKER) != 1:
        return False
    if "CreatePluginToolbarButton" not in text:
        return False
    if text.count("ctx.uiWorkspace.startSession(undefined, {") != 1:
        return False
    if CREATOR_CALL not in text:
        return False
    if "const openCreator = (region: EntryRegion): void => {" not in text:
        return False
    if "openCreator(region)" not in text or "openCreator('sidebar')" not in text:
        return False
    if "name: 'plugins.toolbar.actions', id: 'create-plugin'" not in text:
        return False
    if "name: 'sidebar.panellist.actions'" not in text:
        return False
    if "name: 'conversation.session.header.views.actions'" not in text:
        return False
    if "name: 'sidebar.right.tab.guide.actions'" not in text:
        return False
    if "ctx.pluginNavigation.openList()" not in text:
        return False
    return True


def contract_ok(text):
    if text.count(MARKER) != 1:
        return False
    if "export interface PluginToolbarActionsProps" not in text:
        return False
    if "readonly placement: 'toolbar'" not in text:
        return False
    slot = "'plugins.toolbar.actions': { kind: 'list'; scope: 'root'; owner: PluginToolbarActionsProps }"
    add = "'plugins.add.actions': { kind: 'list'; scope: 'root'; owner: PluginAddActionsProps }"
    if slot not in text or add not in text:
        return False
    return True


def pm_ok(text):
    if text.count(MARKER) != 1:
        return False
    add = text.find("'plugins.add.actions': { kind: 'list', scope: 'root' }")
    tool = text.find("'plugins.toolbar.actions': { kind: 'list', scope: 'root' }")
    if add < 0 or tool < add:
        return False
    return True


def page_ok(text):
    if text.count(MARKER) != 1:
        return False
    if "'plugins.toolbar.actions'" not in text:
        return False
    toolbar = text.find("className={css.toolbar}")
    slot = text.find("renderSlot('plugins.toolbar.actions', { placement: 'toolbar' })")
    add = text.find("<AddPluginMenu")
    if min(toolbar, slot, add) < 0 or not (toolbar < slot < add):
        return False
    return True


def _paths(root):
    return {
        "tsx": os.path.join(root, REL_TSX),
        "menu": os.path.join(root, REL_MENU),
        "css": os.path.join(root, REL_MENU_CSS),
        "entry": os.path.join(root, REL_ENTRY),
        "contract": os.path.join(root, REL_CONTRACT),
        "pm": os.path.join(root, REL_PM),
        "page": os.path.join(root, REL_PAGE),
    }


def _ok(texts):
    return (
        tsx_ok(texts["tsx"])
        and menu_ok(texts["menu"])
        and css_ok(texts["css"])
        and entry_ok(texts["entry"])
        and contract_ok(texts["contract"])
        and pm_ok(texts["pm"])
        and page_ok(texts["page"])
    )


def _apply(texts):
    updated = dict(texts)
    updated["tsx"] = _replace_one(texts["tsx"], OLD_IMPORTS, NEW_IMPORTS, REL_TSX)
    updated["tsx"] = _replace_one(updated["tsx"], OLD_MORE_FN, NEW_MORE_FN, REL_TSX + " PanelMoreMenu")
    updated["tsx"] = _replace_one(updated["tsx"], OLD_HOOKS, NEW_HOOKS, REL_TSX + " hooks")
    updated["tsx"] = _replace_one(updated["tsx"], OLD_PINS, NEW_PINS, REL_TSX + " pins")
    updated["tsx"] = _replace_one(updated["tsx"], OLD_ACCOUNT, NEW_ACCOUNT, REL_TSX + " account")
    updated["menu"] = _replace_one(texts["menu"], OLD_MENU_IMPORT, NEW_MENU_IMPORT, REL_MENU)
    updated["menu"] = _replace_one(updated["menu"], OLD_MENU_ROWS, NEW_MENU_ROWS, REL_MENU + " rows")
    updated["css"] = texts["css"] + CSS_APPEND
    updated["entry"] = _replace_one(texts["entry"], OLD_ENTRY_IMPORT, NEW_ENTRY_IMPORT, REL_ENTRY)
    updated["entry"] = _replace_one(updated["entry"], OLD_INJECTED, NEW_INJECTED, REL_ENTRY + " injected")
    updated["entry"] = _replace_one(updated["entry"], OLD_RIGHTBAR, NEW_RIGHTBAR, REL_ENTRY + " rightbar")
    updated["contract"] = _replace_one(texts["contract"], OLD_ADD_PROPS, NEW_ADD_PROPS, REL_CONTRACT)
    updated["contract"] = _replace_one(updated["contract"], OLD_ADD_SLOT, NEW_ADD_SLOT, REL_CONTRACT + " slot")
    updated["pm"] = _replace_one(texts["pm"], OLD_PM_CHILD, NEW_PM_CHILD, REL_PM)
    updated["page"] = _replace_one(texts["page"], OLD_PAGE_UNION, NEW_PAGE_UNION, REL_PAGE)
    updated["page"] = _replace_one(updated["page"], OLD_TOOLBAR, NEW_TOOLBAR, REL_PAGE + " toolbar")
    return updated


def main():
    root = os.environ.get("DSH_SRC", "").strip()
    if not root:
        sys.exit(
            "DSH_SRC is required. Docker image build sets it to the clone inside the image. "
            "This patch does not target a native install."
        )
    tsx_path = os.path.join(root, REL_TSX)
    tsx = _read(tsx_path)
    if CHAT_MARKER not in tsx or WORK_MARKER not in tsx or 'data-dsh-nav-group="account"' not in tsx:
        sys.exit("chat-import sidebar is missing; run dsh-sidebar-chat-import-open.py first")
    paths = _paths(root)
    texts = {key: _read(path) for key, path in paths.items()}
    present = [key for key, text in texts.items() if MARKER in text]
    if present:
        if len(present) != len(texts) or not _ok(texts):
            sys.exit("marker present but sidebar more-to-plugins path is wrong")
        print("skip（已打）:", REL_TSX)
        return
    updated = _apply(texts)
    if not _ok(updated):
        sys.exit("patched sidebar more-to-plugins path is wrong")
    for key, path in paths.items():
        io.open(path, "w", encoding="utf-8").write(updated[key])
    print("ok:", REL_TSX)


if __name__ == "__main__":
    main()
