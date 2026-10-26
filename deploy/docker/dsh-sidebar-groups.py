# -*- coding: utf-8 -*-
"""Docker image only: group the sidebar column into three cards (乙·重).

On dsh-v0.2.1-rc.3 the left column shell is SidebarRoot.tsx plus
SidebarRoot.module.css. This patch runs after sidebar-nav-reorder and
sidebar-entry-style-unify, still inside the image build, before pnpm build.

Cards, in order:
  工作  新会话, 功能与连接 (sidebar.footer.action id desk-skills-conn),
        自动化任务 (sidebar.panellist id schedules, while it stays pinned)
  扩展  插件 (id plugins), 导入会话 (id chat-import)
  账户  用量 (id desk-usage), 更多 (PanelMoreMenu, t('panels.more'))

Each footer registration mounts once. The three named ids render through
renderSlot(..., { only }). Every other sidebar.footer.action id renders
through one { except } outlet under the cards, so 子代理 / 公告 / Bots /
团队资料 / cordis keep working and desk-auto is not unregistered here.
Other pinned panels stay in sidebar.panellist. sidebar.settings stays in
the foot (the account menu). AccountMenu and the login URL are not edited.

Active rows use a blue wash: the product business-primary token mixed at
18%, the same mix as the shipped demo. --dsh-sidebar-entry-* title and
icon tokens are left as style-unify published them (14px / 400 / 22px,
16px icon, 18px on the rail).

The list filter lives next to renderSlot's existing `only` option
(`except` on RenderOpts). Non-list slots ignore it.

Invoked only from deploy/docker/Dockerfile with
DSH_SRC=/src/deepseek-harness (the clone inside the image build).
DSH_SRC is required. There is no home-directory default, so the script
cannot land on a native install or a Windows checkout.
"""
import io
import os
import sys

MARKER = "cut 2026-10-26 sidebar-ui-refresh"
CHROME_MARKER = "cut 2026-10-26 sidebar-entry-style-unify"
REL_TSX = "packages/client/ui-sidebar/src/client/SidebarRoot.tsx"
REL_CSS = "packages/client/ui-sidebar/src/client/SidebarRoot.module.css"
REL_INDEX = "packages/client/ui-slots/src/index.ts"
REL_RENDERER = "packages/client/ui-slots/src/renderer.ts"
REL_SCOPED = "packages/client/ui-renderer/src/client/scoped-slots.tsx"

ENTRY_TOKENS = (
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

OLD_TSX = """      {/* The label fades before the hover/focus shortcut, including on translucent backgrounds. */}
      <Tooltip label={t('session.new.label')} shortcutKeys={newShortcut?.keys} delayMs={500} side={captionTooltipSide} disabled={wide}>
        <button
          type="button"
          className={css.newSession}
          aria-label={t('session.new.label')}
          aria-keyshortcuts={newShortcut?.aria}
          onClick={openNewSession}
        >
          <span className={css.newSessionLabelMask}><span className={css.newSessionContent}>
            {wide
              ? <IconNewChatOutlineMedium size={14} />
              : <IconNewChatOutlineRegular size={windowsTitlebar ? 16 : 18} />}
            {wide && <span className={clsx(css.newSessionLabel, css.wide)}>{t('session.new')}</span>}
          </span></span>
          {wide && newShortcut !== undefined && newShortcut.keys.length > 0 && <span className={css.newSessionShortcut} aria-hidden="true">
            <ShortcutKeys keys={newShortcut.keys} />
          </span>}
        </button>
      </Tooltip>

      {/* ANYWORK Docker image (cut 2026-10-26 sidebar-nav-reorder):
          footer actions sit under New Session and above the plugins panel
          list. Settings stays in the foot, so these entries are not repeated.
          Workspace browsing stays between that list and the foot. */}
      <div className={css.footerActions}>
        {renderSlot('sidebar.footer.action', { wide })}
      </div>

      {panels.length > 0 && (
        <nav className={css.panelList} aria-label={t('panels.label')}>
          {panels.filter(({ id }) => id === FIXED_PANEL_ID || !unpinned.includes(id)).map(({ id, label }) => (
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
        </nav>
      )}

      {/* The browsing region fills the column between the controls and the
          foot in both states; its rail icon column rides the same slot. */}
      <div className={css.regionArea}>
        {renderSlot('sidebar.workspaces', {
          wide,
          expandSidebar: () => { if (collapsed) toggleSidebar() },
        })}
      </div>

      {/* Settings stays pinned at the foot (account menu, 「更多」). */}
      <div className={css.footArea}>
        <div className={css.settingsArea}>
          {renderSlot('sidebar.settings', { wide })}
        </div>
      </div>
"""

NEW_TSX = """      {/* ANYWORK Docker image (cut 2026-10-26 sidebar-ui-refresh):
          three cards. 工作 is New Session, 功能与连接 (desk-skills-conn), and
          自动化任务 (schedules, while it stays pinned). 扩展 is 插件
          (plugins) and 导入会话 (chat-import). 账户 is 用量 (desk-usage)
          and panels.more （更多）. Each footer id mounts once: the named
          ids go through `only`, every other sidebar.footer.action id goes
          through `except` and stays under the cards. Settings stays in the
          foot. Clicks and registration are unchanged. */}
      <div className={css.navGroups}>
        <section className={clsx(css.navGroup, css.footerActions)} data-dsh-nav-group="work" aria-label="工作">
          <div className={css.navGroupLabel}>工作</div>
          {/* The label fades before the hover/focus shortcut, including on translucent backgrounds. */}
          <Tooltip label={t('session.new.label')} shortcutKeys={newShortcut?.keys} delayMs={500} side={captionTooltipSide} disabled={wide}>
            <button
              type="button"
              className={css.newSession}
              aria-label={t('session.new.label')}
              aria-keyshortcuts={newShortcut?.aria}
              onClick={openNewSession}
            >
              <span className={css.newSessionLabelMask}><span className={css.newSessionContent}>
                {wide
                  ? <IconNewChatOutlineMedium size={16} />
                  : <IconNewChatOutlineRegular size={windowsTitlebar ? 16 : 18} />}
                {wide && <span className={clsx(css.newSessionLabel, css.wide)}>{t('session.new')}</span>}
              </span></span>
              {wide && newShortcut !== undefined && newShortcut.keys.length > 0 && <span className={css.newSessionShortcut} aria-hidden="true">
                <ShortcutKeys keys={newShortcut.keys} />
              </span>}
            </button>
          </Tooltip>

          {renderSlot('sidebar.footer.action', { wide }, { only: 'desk-skills-conn' })}
          {panels.filter(({ id }) => id === 'schedules' && !unpinned.includes(id)).map(({ id, label }) => (
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
        <section className={clsx(css.navGroup, css.footerActions)} data-dsh-nav-group="extend" aria-label="扩展">
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
        <section className={clsx(css.navGroup, css.footerActions)} data-dsh-nav-group="account" aria-label="账户">
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
      </div>

      {/* Footer entries outside the three groups stay in this column, once each. */}
      <div className={css.footerActions}>
        {renderSlot('sidebar.footer.action', { wide }, { except: ['desk-skills-conn', 'chat-import', 'desk-usage'] })}
      </div>

      {panels.some(({ id }) => id !== FIXED_PANEL_ID && id !== 'schedules' && !unpinned.includes(id)) && (
        <nav className={css.panelList} aria-label={t('panels.label')}>
          {panels.filter(({ id }) => id !== FIXED_PANEL_ID && id !== 'schedules' && !unpinned.includes(id)).map(({ id, label }) => (
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
        </nav>
      )}

      {/* The browsing region fills the column between the controls and the
          foot in both states; its rail icon column rides the same slot. */}
      <div className={css.regionArea}>
        {renderSlot('sidebar.workspaces', {
          wide,
          expandSidebar: () => { if (collapsed) toggleSidebar() },
        })}
      </div>

      {/* Settings stays pinned at the foot (account menu). */}
      <div className={css.footArea}>
        <div className={css.settingsArea}>
          {renderSlot('sidebar.settings', { wide })}
        </div>
      </div>
"""

CSS_APPEND = """
/* cut 2026-10-26 sidebar-ui-refresh: three cards over the shared entry chrome.
   Labels are the shipped cut names. Active fill is the product blue at the
   demo's 18% mix. Title and icon tokens above are not redefined. */
.root {
  --dsh-sidebar-entry-active-bg: color-mix(in srgb, var(--dsw-alias-state-business-primary) 18%, transparent);
}

.navGroups {
  flex: none;
  display: flex;
  flex-direction: column;
}

.navGroup {
  flex: none;
  display: flex;
  flex-direction: column;
  gap: var(--dsh-sidebar-entry-list-gap);
  min-width: 0;
  margin: 0 0 10px;
  padding: 6px;
  box-sizing: border-box;
  border: 1px solid var(--dsw-alias-border-l2);
  border-radius: 10px;
  background: color-mix(in srgb, var(--dsw-alias-bg-layer-1) 88%, var(--dsw-specific-sidebar-fill));
  box-shadow: 0 1px 0 rgba(255, 255, 255, 0.04) inset, 0 4px 12px rgba(0, 0, 0, 0.18);
}

.navGroupLabel {
  padding: 2px 8px 4px;
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.08em;
  line-height: 16px;
  color: var(--dsw-alias-label-tertiary);
}

.collapsed .navGroupLabel {
  display: none;
}

.collapsed .navGroups {
  align-items: center;
}

.collapsed .navGroup {
  width: auto;
  margin: 0 0 12px;
  padding: 0;
  border: none;
  border-radius: 0;
  background: transparent;
  box-shadow: none;
  align-items: center;
  gap: var(--dsh-sidebar-entry-list-gap-rail);
}

/* Inside a card the New Session control reads as an entry row. The rail
   keeps the collapsed .newSession box (36px, transparent). */
.root:not(.collapsed) .navGroup .newSession {
  height: auto;
  min-height: var(--dsh-sidebar-entry-min-height);
  margin: 0 2px;
  padding: var(--dsh-sidebar-entry-pad);
  border: none;
  border-radius: var(--dsh-sidebar-entry-radius);
  background: transparent;
  font-size: var(--dsh-sidebar-entry-title-size);
  font-weight: var(--dsh-sidebar-entry-title-weight);
  line-height: var(--dsh-sidebar-entry-title-line);
  justify-content: flex-start;
}

.root:not(.collapsed) .navGroup .newSession:hover {
  background: var(--dsw-alias-interactive-bg-hover);
}

.root:not(.collapsed) .navGroup .newSessionContent {
  justify-content: flex-start;
  gap: var(--dsh-sidebar-entry-gap);
  width: auto;
}

.root:not(.collapsed) .navGroup .newSessionContent > svg {
  width: var(--dsh-sidebar-entry-icon-size);
  height: var(--dsh-sidebar-entry-icon-size);
}

.panelRow.panelActive,
.panelRow[aria-expanded='true'] {
  background: var(--dsh-sidebar-entry-active-bg);
}

.footerActions [data-slot="sidebar.footer.action"] > button[class~="on"],
.footerActions [data-slot="sidebar.footer.action"] > div > button[class~="on"],
.footerActions [data-slot="sidebar.footer.action"] > div > div > button[class~="on"],
.footerActions [data-slot="sidebar.footer.action"] > button[aria-expanded="true"],
.footerActions [data-slot="sidebar.footer.action"] > div > button[aria-expanded="true"],
.footerActions [data-slot="sidebar.footer.action"] > div > div > button[aria-expanded="true"] {
  background: var(--dsh-sidebar-entry-active-bg) !important;
}
"""


OLD_INDEX = """  entryKey?: EntryKey
  only?: string
  fallback?: ReactNode
"""
NEW_INDEX = """  entryKey?: EntryKey
  only?: string
  /** List slots: skip these ids. `only` still applies. Other kinds ignore it. */
  except?: readonly string[]
  fallback?: ReactNode
"""

OLD_RENDERER = """  entryKey?: string
  only?: string
  fallback?: ReactNode
"""
NEW_RENDERER = """  entryKey?: string
  only?: string
  /** List slots: skip these ids. `only` still applies. Other kinds ignore it. */
  except?: readonly string[]
  fallback?: ReactNode
"""

OLD_LIST = """  if (opts?.only !== undefined) list = list.filter(item => item.id === opts.only)
  if (list.length === 0) return <>{opts?.fallback ?? null}</>
"""
NEW_LIST = """  if (opts?.only !== undefined) list = list.filter(item => item.id === opts.only)
  // cut 2026-10-26 sidebar-ui-refresh: list outlets may omit ids rendered
  // elsewhere via `only`. Non-list kinds never read `except`.
  if (opts?.except !== undefined) {
    const excluded = new Set(opts.except)
    list = list.filter(item => {
      if (item.id === undefined) return true
      return !excluded.has(item.id)
    })
  }
  if (list.length === 0) return <>{opts?.fallback ?? null}</>
"""


def _read(path):
    if not os.path.isfile(path):
        sys.exit("missing %s" % path)
    return io.open(path, encoding="utf-8").read()


def _root_block(text):
    return text.split(".root {", 1)[-1].split("}", 1)[0]


def tokens_ok(css):
    root = _root_block(css)
    return all(token in root for token in ENTRY_TOKENS)


def tsx_ok(text):
    if text.count(MARKER) != 1:
        return False
    work = text.find('data-dsh-nav-group="work"')
    extend = text.find('data-dsh-nav-group="extend"')
    account = text.find('data-dsh-nav-group="account"')
    workspaces = text.find("renderSlot('sidebar.workspaces'")
    if min(work, extend, account, workspaces) < 0:
        return False
    if not (work < extend < account < workspaces):
        return False
    work_chunk = text[work:extend]
    extend_chunk = text[extend:account]
    account_chunk = text[account:workspaces]
    if ">工作<" not in work_chunk or "css.newSession" not in work_chunk:
        return False
    if "only: 'desk-skills-conn'" not in work_chunk:
        return False
    if "id === 'schedules'" not in work_chunk:
        return False
    if ">扩展<" not in extend_chunk or "id === FIXED_PANEL_ID" not in extend_chunk:
        return False
    if "only: 'chat-import'" not in extend_chunk:
        return False
    if ">账户<" not in account_chunk or "only: 'desk-usage'" not in account_chunk:
        return False
    if "PanelMoreMenu" not in account_chunk or "t('panels.more')" not in account_chunk:
        return False
    if text.count("only: 'desk-skills-conn'") != 1:
        return False
    if text.count("only: 'chat-import'") != 1:
        return False
    if text.count("only: 'desk-usage'") != 1:
        return False
    except_at = text.find("except: ['desk-skills-conn', 'chat-import', 'desk-usage']")
    if except_at < account:
        return False
    if text.count("renderSlot('sidebar.footer.action'") != 4:
        return False
    if text.count("renderSlot('sidebar.settings'") != 1:
        return False
    if text.count("renderSlot('sidebar.workspaces'") != 1:
        return False
    # Logo row (non-macOS) and the New Session capsule both start a session.
    if text.count("onClick={openNewSession}") != 2:
        return False
    # PanelRow keeps its own selectPanel(id) click. The column passes that
    # callback through, and the More menu still selects from sidebar_more.
    if text.count("selectPanel={selectPanel}") < 3 or "selectPanel(panel.id)" not in text:
        return False
    if "IconNewChatOutlineMedium size={16}" not in text:
        return False
    if "IconNewChatOutlineMedium size={14}" in text:
        return False
    return True


def css_ok(text):
    if text.count(MARKER) != 1 or CHROME_MARKER not in text:
        return False
    if not tokens_ok(text):
        return False
    if ".navGroup {" not in text or ".navGroupLabel {" not in text:
        return False
    if "border: 1px solid var(--dsw-alias-border-l2)" not in text:
        return False
    if "0 4px 12px" not in text:
        return False
    if "--dsh-sidebar-entry-active-bg:" not in text:
        return False
    active = "color-mix(in srgb, var(--dsw-alias-state-business-primary) 18%, transparent)"
    if active not in text:
        return False
    if "background: var(--dsh-sidebar-entry-active-bg)" not in text:
        return False
    if ".panelRow.panelActive" not in text:
        return False
    if "[class~=\"on\"]" not in text:
        return False
    if "font-size: 11px" not in text or "letter-spacing: 0.08em" not in text:
        return False
    if ".collapsed .navGroupLabel" not in text:
        return False
    if ".root:not(.collapsed) .navGroup .newSession" not in text:
        return False
    if "width: var(--dsh-sidebar-entry-icon-size)" not in text:
        return False
    if "width: var(--dsh-sidebar-entry-icon-rail)" not in text:
        return False
    # Title metrics stay free of !important, same contract as style-unify.
    for line in text.splitlines():
        stripped = line.strip()
        if stripped.startswith("font-size: var(--dsh-sidebar-entry-title-size)") and "!important" in stripped:
            return False
        if stripped.startswith("font-weight: var(--dsh-sidebar-entry-title-weight)") and "!important" in stripped:
            return False
        if stripped.startswith("line-height: var(--dsh-sidebar-entry-title-line)") and "!important" in stripped:
            return False
    return True


def slots_ok(index_text, renderer_text, scoped_text):
    needle = "except?: readonly string[]"
    if index_text.count(needle) != 1 or renderer_text.count(needle) != 1:
        return False
    if "opts?.except" not in scoped_text:
        return False
    if MARKER not in scoped_text:
        return False
    if "excluded.has(item.id)" not in scoped_text:
        return False
    if scoped_text.count(OLD_LIST) != 0:
        return False
    return True


def _replace_one(text, old, new, label):
    count = text.count(old)
    if count != 1:
        sys.exit("anchor count=%d in %s (expect 1)" % (count, label))
    return text.replace(old, new, 1)


def main():
    root = os.environ.get("DSH_SRC", "").strip()
    if not root:
        sys.exit(
            "DSH_SRC is required. Docker image build sets it to the clone inside the image. "
            "This patch does not target a native install."
        )
    paths = {
        "tsx": os.path.join(root, REL_TSX),
        "css": os.path.join(root, REL_CSS),
        "index": os.path.join(root, REL_INDEX),
        "renderer": os.path.join(root, REL_RENDERER),
        "scoped": os.path.join(root, REL_SCOPED),
    }
    texts = {key: _read(path) for key, path in paths.items()}
    present = MARKER in texts["tsx"] or MARKER in texts["css"] or MARKER in texts["scoped"]
    if present:
        if not (tsx_ok(texts["tsx"]) and css_ok(texts["css"]) and slots_ok(texts["index"], texts["renderer"], texts["scoped"])):
            sys.exit("marker present but sidebar groups are wrong")
        print("skip（已打）:", REL_TSX)
        return
    if CHROME_MARKER not in texts["css"] or not tokens_ok(texts["css"]):
        sys.exit("sidebar entry chrome is missing; run dsh-sidebar-entry-chrome.py first")
    if ".panelRow.panelActive" not in texts["css"]:
        sys.exit("anchor count=0 in %s (expect 1)" % REL_CSS)
    updated = {
        "tsx": _replace_one(texts["tsx"], OLD_TSX, NEW_TSX, REL_TSX),
        "css": texts["css"] + CSS_APPEND,
        "index": _replace_one(texts["index"], OLD_INDEX, NEW_INDEX, REL_INDEX),
        "renderer": _replace_one(texts["renderer"], OLD_RENDERER, NEW_RENDERER, REL_RENDERER),
        "scoped": _replace_one(texts["scoped"], OLD_LIST, NEW_LIST, REL_SCOPED),
    }
    if not tsx_ok(updated["tsx"]):
        sys.exit("patched sidebar groups are wrong: %s" % REL_TSX)
    if not css_ok(updated["css"]):
        sys.exit("patched sidebar groups are wrong: %s" % REL_CSS)
    if not slots_ok(updated["index"], updated["renderer"], updated["scoped"]):
        sys.exit("patched sidebar groups are wrong: renderSlot except")
    for key, path in paths.items():
        io.open(path, "w", encoding="utf-8").write(updated[key])
    print("ok:", REL_TSX)


if __name__ == "__main__":
    main()
