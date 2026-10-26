// Cut 2026-10-26 sidebar-more-to-plugins (Decision A).
// Account card drops panels.more. Sidebar menus drop 浏览更多插件.
// 创建你的插件 is a visible button on the Plugins panel toolbar and
// calls the same Creator draft the sidebar row used.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawnSync } from 'node:child_process'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const script = join(root, 'deploy/docker/dsh-sidebar-more-to-plugins.py')
const chatScript = join(root, 'deploy/docker/dsh-sidebar-chat-import-open.py')
const workScript = join(root, 'deploy/docker/dsh-sidebar-work-group-bots-vault.py')
const groupsScript = join(root, 'deploy/docker/dsh-sidebar-groups.py')
const chromeScript = join(root, 'deploy/docker/dsh-sidebar-entry-chrome.py')
const relayScript = join(root, 'deploy/docker/dsh-sidebar-relay-login.py')
const dockerfile = join(root, 'deploy/docker/Dockerfile')

const REL = 'packages/client/ui-sidebar/src/client/SidebarRoot.tsx'
const CSS = 'packages/client/ui-sidebar/src/client/SidebarRoot.module.css'
const ACCOUNT = 'packages/client/ui-settings-account/src/client/AccountMenu.tsx'
const INDEX = 'packages/client/ui-slots/src/index.ts'
const RENDERER = 'packages/client/ui-slots/src/renderer.ts'
const SCOPED = 'packages/client/ui-renderer/src/client/scoped-slots.tsx'
const MENU = 'packages/client/ui-entry-customization/src/client/EntryMenuContent.tsx'
const MENU_CSS = 'packages/client/ui-entry-customization/src/client/EntryMenu.module.css'
const ENTRY = 'packages/client/ui-entry-customization/src/client/index.ts'
const CONTRACT = 'packages/client/ui-plugin-manager/src/client/slot-contract.ts'
const PM = 'packages/client/ui-plugin-manager/src/client/index.ts'
const PAGE = 'packages/client/ui-plugin-manager/src/client/PluginManagerPage.tsx'
const MARKER = 'cut 2026-10-26 sidebar-more-to-plugins'
const NEW_EXCEPT = "except: ['desk-skills-conn', 'chat-import', 'desk-usage', 'desk-bots', 'desk-hub']"
const CREATOR = "agentPreset: 'cordis', prompt: t(`createPrompt.${region}`), whenDraftExists: 'append'"

const scriptSource = readFileSync(script, 'utf8')
const groupsSource = readFileSync(groupsScript, 'utf8')
const chromeSource = readFileSync(chromeScript, 'utf8')

function triple(source, name) {
  const key = `${name} = """`
  const start = source.indexOf(key)
  assert.ok(start >= 0, `missing ${name}`)
  const from = start + key.length
  const end = source.indexOf('"""', from)
  assert.ok(end > from, `unterminated ${name}`)
  return source.slice(from, end)
}

const OLD_TSX = triple(groupsSource, 'OLD_TSX')

const ACCOUNT_UPSTREAM = `import {
  Toast, Menu, IconEllipsisOutlineMedium, IconPaperPlaneOutlineMedium, IconSettingsOutlineMedium, IconUserOutlineMedium,
} from '@deepseek-ai/dsh-client-ui-primitives'
  // The plugin's start publishes \`loginFailed\` before it rejects, so the dialog owns the report.
  const beginSignIn = (): void => { setOpen(false); void start().catch(() => undefined) }
  return <div ref={anchor} className={css.root}>
        {wide && <span className={css.label}>{signedIn ? label : t('more')}</span>}
      items={[
        { id: 'settings', label: t('settings'), icon: <IconSettingsOutlineMedium size={16} />,
          ...(settingsShortcut === undefined ? {} : { shortcut: settingsShortcut }) },
        { id: 'contact', label: t('contactUs'), icon: <IconPaperPlaneOutlineMedium size={16} /> },
        ...(signedIn ? [{ id: 'signout', label: t('signOut'), icon: <LogoutIcon />, disabled: busy }]
          : [{ id: 'signin', label: t('signIn'), icon: <IconUserOutlineMedium size={16} /> }]),
      ]}
      onSelect={(id) => {
        if (id === 'settings') { setOpen(false); trigger.current?.focus(); openSettings() }
        else if (id === 'contact') { setOpen(false); contactUs() }
        else if (id === 'signin') beginSignIn()
        else void requestSignOut()
      }} />
`

function upstreamCss() {
  return [
    '.root {',
    triple(chromeSource, 'OLD_ROOT'),
    '  --dsh-scrollbar-thumb: var(--dsw-alias-scrollbar-bg-l2);',
    '}',
    triple(chromeSource, 'OLD_PANEL_LIST'),
    triple(chromeSource, 'OLD_PANEL_ROW'),
    '.panelRow:hover { background: var(--dsw-alias-interactive-bg-hover); }',
    '.panelRow.panelActive { background: var(--dsw-alias-interactive-bg-hover); }',
    triple(chromeSource, 'OLD_GLYPH'),
    triple(chromeSource, 'OLD_COLLAPSED_LIST'),
    triple(chromeSource, 'OLD_COLLAPSED_ROW'),
    triple(chromeSource, 'OLD_FOOT'),
    '',
  ].join('\n')
}

function writeRel(dir, rel, text) {
  const path = join(dir, rel)
  mkdirSync(dirname(path), { recursive: true })
  writeFileSync(path, text)
  return path
}

function layout(dir) {
  // Real SidebarRoot keeps imports, PanelMoreMenu, and the hook list above
  // the JSX block the earlier knives replace. The fixture has to include
  // that head or this knife's anchors never occur.
  const head = [
    triple(scriptSource, 'OLD_IMPORTS'),
    "import css from './SidebarRoot.module.css'",
    triple(scriptSource, 'OLD_MORE_FN'),
    'export function SidebarRoot({',
    '  collapsed,',
    triple(scriptSource, 'OLD_HOOKS'),
    '  usePanelInfo,',
    '  t,',
    '  renderSlot,',
    '}: SidebarRootComponentProps) {',
    triple(scriptSource, 'OLD_PINS'),
    '  const wide = true',
    '  onClick={openNewSession}',
    '',
  ].join('\n')
  writeRel(dir, REL, `${head}${OLD_TSX}`)
  writeRel(dir, CSS, upstreamCss())
  writeRel(dir, ACCOUNT, ACCOUNT_UPSTREAM)
  writeRel(dir, INDEX, `export interface RenderOpts {\n${triple(groupsSource, 'OLD_INDEX')}}\n`)
  writeRel(dir, RENDERER, `export interface RenderOpts {\n${triple(groupsSource, 'OLD_RENDERER')}}\n`)
  writeRel(dir, SCOPED, `${triple(groupsSource, 'OLD_LIST')}\n`)
}

function seedExtras(dir) {
  writeRel(dir, MENU, [
    triple(scriptSource, 'OLD_MENU_IMPORT'),
    "import type { InjectFace, PropsLocale, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'",
    "  const moreEntries = region === 'conversation' ? entries : []",
    triple(scriptSource, 'OLD_MENU_ROWS'),
    '',
  ].join('\n'))
  writeRel(dir, MENU_CSS, [
    '.entryName { display: flex; align-items: center; gap: 8px; }',
    '.entryTitle { min-width: 0; overflow-wrap: anywhere; white-space: normal; }',
    '.activeMark { flex: none; margin-left: auto; }',
    '',
  ].join('\n'))
  writeRel(dir, ENTRY, [
    triple(scriptSource, 'OLD_ENTRY_IMPORT'),
    triple(scriptSource, 'OLD_INJECTED'),
    "  ctx.slots.inject('sidebar.panellist.actions', () => ctx.slots.register({",
    "    name: 'sidebar.panellist.actions', id: 'entry-customization', locale: 'entryCustomization',",
    "    inject: () => injected('sidebar'),",
    '  }, EntryMenuContent))',
    "  ctx.slots.inject('conversation.session.header.views.actions', () => ctx.slots.register({",
    "    name: 'conversation.session.header.views.actions', id: 'entry-customization', locale: 'entryCustomization',",
    "    inject: () => injected('conversation'),",
    '  }, EntryMenuContent))',
    triple(scriptSource, 'OLD_RIGHTBAR'),
  ].join('\n'))
  writeRel(dir, CONTRACT, [
    triple(scriptSource, 'OLD_ADD_PROPS'),
    triple(scriptSource, 'OLD_ADD_SLOT'),
    '',
  ].join('\n'))
  writeRel(dir, PM, `${triple(scriptSource, 'OLD_PM_CHILD')}\n`)
  writeRel(dir, PAGE, [
    triple(scriptSource, 'OLD_PAGE_UNION'),
    '<div className={css.toolbar} hidden={!onInstalled}>',
    triple(scriptSource, 'OLD_TOOLBAR'),
    '                ? <AddPluginMenu t={t} disabled={!loaded} openInstall={props.openInstall} renderSlot={renderSlot} />',
    '',
  ].join('\n'))
}

function runPy(file, dir) {
  const env = { ...process.env, DSH_SRC: dir }
  delete env.ANYWORK_SRC
  return spawnSync('python3', [file], { env, encoding: 'utf8' })
}

function groupedDir() {
  const dir = mkdtempSync(join(tmpdir(), 'sidebar-more-to-plugins-'))
  layout(dir)
  for (const file of [chromeScript, groupsScript, relayScript, workScript, chatScript]) {
    const step = runPy(file, dir)
    assert.equal(step.status, 0, `${file}\n${step.stderr}`)
  }
  seedExtras(dir)
  return dir
}

function chunk(text, startKey, endKey) {
  const start = text.indexOf(startKey)
  const end = text.indexOf(endKey, start + 1)
  assert.ok(start >= 0 && end > start, `${startKey} .. ${endKey}`)
  return text.slice(start, end)
}

test('AC1–AC2: account 更多 is gone, browse is sidebar-off, create sits on the plugins toolbar', () => {
  const dir = groupedDir()
  const before = readFileSync(join(dir, REL), 'utf8')
  const accountBefore = readFileSync(join(dir, ACCOUNT), 'utf8')
  assert.equal(before.includes(MARKER), false)
  assert.match(before, /<PanelMoreMenu/)
  assert.match(before, /t\('panels\.more'\)/)

  const first = runPy(script, dir)
  assert.equal(first.status, 0, first.stderr)
  const tsx = readFileSync(join(dir, REL), 'utf8')
  const menu = readFileSync(join(dir, MENU), 'utf8')
  const entry = readFileSync(join(dir, ENTRY), 'utf8')
  const page = readFileSync(join(dir, PAGE), 'utf8')
  const contract = readFileSync(join(dir, CONTRACT), 'utf8')
  const pm = readFileSync(join(dir, PM), 'utf8')
  assert.equal(tsx.split(MARKER).length - 1, 1)
  assert.equal(readFileSync(join(dir, ACCOUNT), 'utf8'), accountBefore)
  assert.match(accountBefore, /beginSignIn/)
  assert.match(accountBefore, /id: 'settings'/)
  assert.match(accountBefore, /id: 'signin'/)

  const work = chunk(tsx, 'data-dsh-nav-group="work"', 'data-dsh-nav-group="extend"')
  const extend = chunk(tsx, 'data-dsh-nav-group="extend"', 'data-dsh-nav-group="account"')
  const account = chunk(tsx, 'data-dsh-nav-group="account"', NEW_EXCEPT)
  const order = [
    work.indexOf('css.newSession'),
    work.indexOf("only: 'desk-skills-conn'"),
    work.indexOf("id === 'schedules'"),
    work.indexOf("only: 'desk-bots'"),
    work.indexOf("only: 'desk-hub'"),
  ]
  assert.ok(order.every((at) => at >= 0))
  assert.deepEqual(order, [...order].sort((a, b) => a - b))
  assert.match(extend, /only: 'chat-import'/)
  assert.match(extend, /id === FIXED_PANEL_ID/)
  assert.match(extend, /onClickCapture/)
  assert.match(extend, /new CustomEvent\('desk-fv', \{ detail: \{ id: null \} \}\)/)
  assert.equal(extend.includes('desk-bots'), false)
  assert.match(account, /only: 'desk-usage'/)
  assert.equal(account.includes('PanelMoreMenu'), false)
  assert.equal(account.includes("t('panels.more')"), false)
  assert.equal(tsx.includes('PanelMoreMenu'), false)
  assert.equal(tsx.includes('hasEntryActions'), false)
  assert.equal(tsx.includes('useEntryActions'), false)
  assert.equal(tsx.includes('setPinned'), false)
  assert.equal(tsx.includes('IconAppsAddOutlineRegular'), false)
  assert.match(tsx, /activePanelId/)
  assert.equal(tsx.split("renderSlot('sidebar.settings'").length - 1, 1)
  assert.equal(tsx.split("renderSlot('sidebar.footer.action'").length - 1, 6)
  assert.equal(tsx.split(NEW_EXCEPT).length - 1, 1)
  assert.equal(tsx.includes('团队资料'), false)

  const guard = menu.indexOf("{region === 'conversation' ? (")
  const browse = menu.indexOf('browsePlugins()')
  const install = menu.indexOf("t('install')")
  assert.ok(guard >= 0 && guard < browse && browse < install)
  assert.equal(menu.split("t('install')").length - 1, 1)
  assert.equal(menu.split('browsePlugins()').length - 1, 1)
  assert.match(menu, /export function CreatePluginToolbarButton/)
  assert.match(menu, /onClick=\{\(\) => \{ createPlugin\(\) \}\}/)
  assert.match(menu, /\{t\('create'\)\}/)

  assert.equal(entry.split('ctx.uiWorkspace.startSession(undefined, {').length - 1, 1)
  assert.match(entry, new RegExp(CREATOR.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')))
  assert.match(entry, /openCreator\('sidebar'\)/)
  assert.match(entry, /openCreator\(region\)/)
  assert.match(entry, /name: 'plugins\.toolbar\.actions', id: 'create-plugin'/)
  assert.match(entry, /ctx\.pluginNavigation\.openList\(\)/)
  assert.match(entry, /name: 'sidebar\.panellist\.actions'/)
  assert.match(entry, /name: 'conversation\.session\.header\.views\.actions'/)
  assert.match(entry, /name: 'sidebar\.right\.tab\.guide\.actions'/)

  const toolbar = page.indexOf('className={css.toolbar}')
  const slot = page.indexOf("renderSlot('plugins.toolbar.actions', { placement: 'toolbar' })")
  const add = page.indexOf('<AddPluginMenu')
  assert.ok(toolbar >= 0 && toolbar < slot && slot < add)
  assert.match(page, /'plugins\.toolbar\.actions'/)
  assert.match(contract, /export interface PluginToolbarActionsProps/)
  assert.match(contract, /readonly placement: 'toolbar'/)
  assert.match(pm, /'plugins\.toolbar\.actions': \{ kind: 'list', scope: 'root' \}/)

  const second = runPy(script, dir)
  assert.equal(second.status, 0, second.stderr)
  assert.match(second.stdout, /skip/)
  assert.equal(readFileSync(join(dir, REL), 'utf8'), tsx)
  assert.equal(readFileSync(join(dir, ENTRY), 'utf8'), entry)
  rmSync(dir, { recursive: true, force: true })
})

test('refuses to run without DSH_SRC', () => {
  const env = { ...process.env }
  delete env.DSH_SRC
  delete env.ANYWORK_SRC
  const result = spawnSync('python3', [script], { env, encoding: 'utf8' })
  assert.notEqual(result.status, 0)
  assert.match(result.stderr, /DSH_SRC is required/)
})

test('script has no native-install default and does not retarget the pin or login', () => {
  assert.equal(scriptSource.includes('expanduser'), false)
  assert.equal(scriptSource.includes('USERPROFILE'), false)
  assert.equal(scriptSource.includes('AppData'), false)
  assert.equal(scriptSource.includes('~/'), false)
  assert.equal(scriptSource.includes('deploy/windows'), false)
  assert.equal(scriptSource.includes('ANYWORK_SRC'), false)
  const urls = scriptSource.match(/https:\/\/[^\s'")]+/g) || []
  assert.deepEqual(urls, [])
  assert.equal(scriptSource.includes('desk-auto'), false)
  assert.match(readFileSync(dockerfile, 'utf8'), /ARG DSH_REF=dsh-v0\.2\.1-rc\.3/)
})

test('image build runs after chat-import-open and before pnpm build', () => {
  const docker = readFileSync(dockerfile, 'utf8')
  const chatRun = docker.indexOf('DSH_SRC=/src/deepseek-harness python3 /tmp/dsh-sidebar-chat-import-open.py')
  const copyAt = docker.indexOf('COPY deploy/docker/dsh-sidebar-more-to-plugins.py /tmp/dsh-sidebar-more-to-plugins.py')
  const runAt = docker.indexOf('DSH_SRC=/src/deepseek-harness python3 /tmp/dsh-sidebar-more-to-plugins.py')
  const buildAt = docker.indexOf('RUN pnpm build')
  assert.ok(chatRun > 0 && copyAt > chatRun && runAt > copyAt && buildAt > runAt)
  assert.equal(docker.includes('ANYWORK_SRC=/opt/anywork python3 /opt/anywork/deploy/docker/dsh-sidebar-more-to-plugins.py'), false)
  assert.equal(docker.includes('deploy/windows'), false)
  assert.match(docker, /python3 \/opt\/anywork\/deploy\/docker\/dsh-sidebar-automation-merge\.py/)
})

test('chat-import sidebar must already be applied', () => {
  const dir = mkdtempSync(join(tmpdir(), 'sidebar-more-to-plugins-early-'))
  layout(dir)
  for (const file of [chromeScript, groupsScript, relayScript, workScript]) {
    const step = runPy(file, dir)
    assert.equal(step.status, 0, step.stderr)
  }
  const before = readFileSync(join(dir, REL), 'utf8')
  const result = runPy(script, dir)
  assert.notEqual(result.status, 0)
  assert.match(result.stderr, /chat-import sidebar is missing/)
  assert.equal(readFileSync(join(dir, REL), 'utf8'), before)
  rmSync(dir, { recursive: true, force: true })
})

test('a marker without the moved create path fails closed', () => {
  const dir = groupedDir()
  const path = join(dir, REL)
  const broken = readFileSync(path, 'utf8').replace(
    'data-dsh-nav-group="account"',
    `data-dsh-nav-group="account" {/* ${MARKER} */}`,
  )
  writeFileSync(path, broken)
  const result = runPy(script, dir)
  assert.notEqual(result.status, 0)
  assert.match(result.stderr, /sidebar more-to-plugins path is wrong/)
  assert.equal(readFileSync(path, 'utf8'), broken)
  assert.equal(readFileSync(join(dir, MENU), 'utf8').includes(MARKER), false)
  rmSync(dir, { recursive: true, force: true })
})
