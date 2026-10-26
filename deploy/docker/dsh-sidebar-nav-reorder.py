# -*- coding: utf-8 -*-
"""Docker image only: move sidebar footer actions above the plugins list.

On dsh-v0.2.1-rc.3 the left sidebar shell is
packages/client/ui-sidebar/src/client/SidebarRoot.tsx.

The nine primary entries are one list slot, sidebar.footer.action, rendered
inside .footArea (above sidebar.settings):

- 导入会话 — dsh-chat-import@0.26.2, id chat-import, order 0
- 助理 / 技能·连接器 / 自动化 / 子代理 / 公告 / Bots / 团队资料 / 用量
  — plugin/desk-panel sidebar.footer.action (orders 86–92)

The block above the workspaces is not that list. ui-sidebar renders
sidebar.panellist in nav.panelList between New Session and
sidebar.workspaces. The fixed row is ui-plugin-manager id plugins
(zh label 插件, order 0). 自动化任务 is ui-schedule id schedules
(order 10). 更多 on that list is PanelMoreMenu (panels.more).

This patch moves the footerActions element to sit after the New Session
control and before that panel list. The foot keeps sidebar.settings, whose
trigger reads 更多. Entries are not rendered twice.

better-sidebar@0.28.0 owns the right-hand workbench, not this column.
AccountMenu (relay login) is a different file and is not edited.

Invoked only from deploy/docker/Dockerfile with
DSH_SRC=/src/deepseek-harness (the clone inside the image build).
DSH_SRC is required. There is no home-directory default, so the script
cannot land on a native install.
"""
import io
import os
import sys

MARKER = "cut 2026-10-26 sidebar-nav-reorder"
REL = "packages/client/ui-sidebar/src/client/SidebarRoot.tsx"
OLD = """      </Tooltip>

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

      {/* Footer actions stack above Settings in both sidebar widths. */}
      <div className={css.footArea}>
        <div className={css.footerActions}>
          {renderSlot('sidebar.footer.action', { wide })}
        </div>
        <div className={css.settingsArea}>
          {renderSlot('sidebar.settings', { wide })}
        </div>
      </div>
"""
NEW = """      </Tooltip>

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


def layout_ok(text):
    def at(needle):
        return text.find(needle)

    footer = at("renderSlot('sidebar.footer.action'")
    panel = at("<nav className={css.panelList}")
    work = at("renderSlot('sidebar.workspaces'")
    foot = at("<div className={css.footArea}>")
    settings = at("renderSlot('sidebar.settings'")
    if min(footer, panel, work, foot, settings) < 0:
        return False
    if not (footer < panel < work < foot < settings):
        return False
    if text.count("renderSlot('sidebar.footer.action'") != 1:
        return False
    if text.count("renderSlot('sidebar.settings'") != 1:
        return False
    if "sidebar.footer.action" in text[foot:]:
        return False
    if MARKER not in text:
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
        if not layout_ok(text):
            sys.exit("marker present but sidebar order is wrong: %s" % REL)
        print("skip（已打）:", REL)
        return
    count = text.count(OLD)
    if count != 1:
        sys.exit("anchor count=%d in %s (expect 1)" % (count, REL))
    updated = text.replace(OLD, NEW, 1)
    if not layout_ok(updated):
        sys.exit("patched sidebar order is wrong: %s" % REL)
    io.open(path, "w", encoding="utf-8").write(updated)
    print("ok:", REL)


if __name__ == "__main__":
    main()
