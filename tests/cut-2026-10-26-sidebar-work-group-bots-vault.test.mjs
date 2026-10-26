// Cut 2026-10-26 sidebar-work-group-bots-vault (Decision A + AC4).
// Work card gains desk-bots and desk-hub. Outer label 团队资料 becomes 资料库.
// The left-bottom 更多 menu (AccountMenu t('more')) drops 意见反馈.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync, cpSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawnSync } from 'node:child_process'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const script = join(root, 'deploy/docker/dsh-sidebar-work-group-bots-vault.py')
const groupsScript = join(root, 'deploy/docker/dsh-sidebar-groups.py')
const chromeScript = join(root, 'deploy/docker/dsh-sidebar-entry-chrome.py')
const relayScript = join(root, 'deploy/docker/dsh-sidebar-relay-login.py')
const skillsScript = join(root, 'deploy/docker/dsh-sidebar-assistant-skills-merge.py')
const autoScript = join(root, 'deploy/docker/dsh-sidebar-automation-merge.py')
const botsScript = join(root, 'deploy/docker/dsh-sidebar-bots-subagents-merge.py')
const dockerfile = join(root, 'deploy/docker/Dockerfile')
const sourceClient = join(root, 'plugin/desk-panel/lib/client.js')

const REL = 'packages/client/ui-sidebar/src/client/SidebarRoot.tsx'
const CSS = 'packages/client/ui-sidebar/src/client/SidebarRoot.module.css'
const ACCOUNT = 'packages/client/ui-settings-account/src/client/AccountMenu.tsx'
const CLIENT = 'plugin/desk-panel/lib/client.js'
const INDEX = 'packages/client/ui-slots/src/index.ts'
const RENDERER = 'packages/client/ui-slots/src/renderer.ts'
const SCOPED = 'packages/client/ui-renderer/src/client/scoped-slots.tsx'
const MARKER = 'cut 2026-10-26 sidebar-work-group-bots-vault'
const RELAY = 'https://api.cntokenai.top/login'
const OLD_EXCEPT = "except: ['desk-skills-conn', 'chat-import', 'desk-usage']"
const NEW_EXCEPT = "except: ['desk-skills-conn', 'chat-import', 'desk-usage', 'desk-bots', 'desk-hub']"

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

function layout(dir, tsx, css, menu = ACCOUNT_UPSTREAM) {
  const sidebar = `onClick={openNewSession}\n${tsx}`
  writeRel(dir, REL, sidebar)
  writeRel(dir, CSS, css)
  writeRel(dir, ACCOUNT, menu)
  writeRel(dir, INDEX, `export interface RenderOpts {\n${triple(groupsSource, 'OLD_INDEX')}}\n`)
  writeRel(dir, RENDERER, `export interface RenderOpts {\n${triple(groupsSource, 'OLD_RENDERER')}}\n`)
  writeRel(dir, SCOPED, `${triple(groupsSource, 'OLD_LIST')}\n`)
  return sidebar
}

function runPy(file, dir, envName) {
  const env = { ...process.env }
  delete env.DSH_SRC
  delete env.ANYWORK_SRC
  env[envName] = dir
  return spawnSync('python3', [file], { env, encoding: 'utf8' })
}

function applyChrome(dir) {
  const result = runPy(chromeScript, dir, 'DSH_SRC')
  assert.equal(result.status, 0, result.stderr)
}

function applyGroups(dir) {
  const result = runPy(groupsScript, dir, 'DSH_SRC')
  assert.equal(result.status, 0, result.stderr)
}

function groupedDir() {
  const dir = mkdtempSync(join(tmpdir(), 'work-group-'))
  layout(dir, OLD_TSX, upstreamCss())
  applyChrome(dir)
  applyGroups(dir)
  const relay = runPy(relayScript, dir, 'DSH_SRC')
  assert.equal(relay.status, 0, relay.stderr)
  return dir
}

function chunk(text, startKey, endKey) {
  const start = text.indexOf(startKey)
  const end = text.indexOf(endKey, start + 1)
  assert.ok(start >= 0 && end > start, `${startKey} .. ${endKey}`)
  return text.slice(start, end)
}

test('AC1–AC4: work card holds bots and vault; 更多 drops 意见反馈', () => {
  const dir = groupedDir()
  const first = runPy(script, dir, 'DSH_SRC')
  assert.equal(first.status, 0, first.stderr)
  const tsx = readFileSync(join(dir, REL), 'utf8')
  const menu = readFileSync(join(dir, ACCOUNT), 'utf8')
  assert.equal(tsx.split(MARKER).length - 1, 1)
  assert.equal(menu.split(MARKER).length - 1, 1)

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
  assert.match(work, />工作</)
  assert.equal(extend.includes('desk-bots'), false)
  assert.equal(extend.includes('desk-hub'), false)
  assert.equal(account.includes('desk-bots'), false)
  assert.equal(account.includes('desk-hub'), false)
  assert.match(extend, />扩展</)
  assert.match(extend, /only: 'chat-import'/)
  assert.match(account, />账户</)
  assert.match(account, /only: 'desk-usage'/)
  assert.match(account, /PanelMoreMenu/)
  assert.match(account, /t\('panels\.more'\)/)
  const groupsNew = triple(groupsSource, 'NEW_TSX')
  const moreAt = groupsNew.indexOf('<PanelMoreMenu')
  const more = groupsNew.slice(moreAt, groupsNew.indexOf('/>', moreAt) + 2)
  assert.equal(tsx.split(more).length - 1, 1)
  assert.ok(tsx.indexOf(NEW_EXCEPT) > tsx.indexOf('data-dsh-nav-group="account"'))
  assert.equal(tsx.includes(OLD_EXCEPT), false)
  assert.equal(tsx.split("renderSlot('sidebar.footer.action'").length - 1, 6)
  assert.equal(tsx.split("renderSlot('sidebar.settings'").length - 1, 1)
  assert.equal(tsx.split('onClick={openNewSession}').length - 1, 2)
  assert.equal(tsx.includes('团队资料'), false)

  const items = menu.slice(menu.indexOf('items={['), menu.indexOf(']}', menu.indexOf('items={[')))
  assert.equal(items.includes("id: 'contact'"), false)
  assert.equal(items.includes("t('contactUs')"), false)
  assert.equal(items.includes('IconPaperPlaneOutlineMedium'), false)
  assert.match(items, /id: 'settings'/)
  assert.match(items, /id: 'signin'/)
  assert.match(items, /id: 'signout'/)
  assert.match(menu, /t\('more'\)/)
  assert.match(menu, /openSettings\(\)/)
  assert.match(menu, /else if \(id === 'signin'\) beginSignIn\(\)/)
  assert.match(menu, /contactUs\(\)/)
  assert.match(menu, /window\.open\('https:\/\/api\.cntokenai\.top\/login', '_blank', 'noopener,noreferrer'\)/)
  const begin = menu.indexOf('const beginSignIn')
  const ret = menu.indexOf('return <div', begin)
  assert.equal(menu.slice(begin, ret).includes('start('), false)

  const second = runPy(script, dir, 'DSH_SRC')
  assert.equal(second.status, 0, second.stderr)
  assert.match(second.stdout, /skip/)
  assert.equal(readFileSync(join(dir, REL), 'utf8'), tsx)
  assert.equal(readFileSync(join(dir, ACCOUNT), 'utf8'), menu)

  const regroup = runPy(groupsScript, dir, 'DSH_SRC')
  assert.notEqual(regroup.status, 0)
  assert.match(regroup.stderr, /sidebar groups are wrong/)
  assert.equal(readFileSync(join(dir, REL), 'utf8'), tsx)
  rmSync(dir, { recursive: true, force: true })
})

test('refuses to run without DSH_SRC or ANYWORK_SRC', () => {
  const env = { ...process.env }
  delete env.DSH_SRC
  delete env.ANYWORK_SRC
  const result = spawnSync('python3', [script], { env, encoding: 'utf8' })
  assert.notEqual(result.status, 0)
  assert.match(result.stderr, /DSH_SRC or ANYWORK_SRC is required/)
})

test('script has no native-install default and does not retarget login', () => {
  assert.equal(scriptSource.includes('expanduser'), false)
  assert.equal(scriptSource.includes('USERPROFILE'), false)
  assert.equal(scriptSource.includes('AppData'), false)
  assert.equal(scriptSource.includes('~/'), false)
  assert.equal(scriptSource.includes('deploy/windows'), false)
  const urls = scriptSource.match(/https:\/\/[^\s'")]+/g) || []
  assert.deepEqual(urls, [])
  assert.match(groupsSource, new RegExp(OLD_EXCEPT.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')))
  assert.equal(groupsSource.includes('desk-bots'), false)
  assert.equal(groupsSource.includes('desk-hub'), false)
  assert.match(scriptSource, new RegExp(NEW_EXCEPT.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')))
})

test('image build patches SidebarRoot after groups and the label after bots merge', () => {
  const docker = readFileSync(dockerfile, 'utf8')
  assert.match(docker, /ARG DSH_REF=dsh-v0\.2\.1-rc\.3/)
  const groupsRun = docker.indexOf('python3 /tmp/dsh-sidebar-groups.py')
  const dshCopy = docker.indexOf('COPY deploy/docker/dsh-sidebar-work-group-bots-vault.py /tmp/dsh-sidebar-work-group-bots-vault.py')
  const dshRun = docker.indexOf('DSH_SRC=/src/deepseek-harness python3 /tmp/dsh-sidebar-work-group-bots-vault.py')
  const buildAt = docker.indexOf('RUN pnpm build')
  const botsRun = docker.indexOf('ANYWORK_SRC=/opt/anywork python3 /opt/anywork/deploy/docker/dsh-sidebar-bots-subagents-merge.py')
  const anyRun = docker.indexOf('ANYWORK_SRC=/opt/anywork python3 /opt/anywork/deploy/docker/dsh-sidebar-work-group-bots-vault.py')
  assert.ok(groupsRun > 0 && dshCopy > groupsRun && dshRun > dshCopy && buildAt > dshRun)
  assert.ok(botsRun > buildAt && anyRun > botsRun)
  assert.match(docker, /curl -fsS http:\/\/127\.0\.0\.1:8080\/healthz/)
  assert.equal(docker.includes('deploy/windows'), false)
  assert.match(readFileSync(relayScript, 'utf8'), /api\.cntokenai\.top\/login/)
})

test('groups must already be applied', () => {
  const dir = mkdtempSync(join(tmpdir(), 'work-group-nogroups-'))
  layout(dir, OLD_TSX, upstreamCss())
  applyChrome(dir)
  const before = readFileSync(join(dir, REL), 'utf8')
  const result = runPy(script, dir, 'DSH_SRC')
  assert.notEqual(result.status, 0)
  assert.match(result.stderr, /sidebar groups are missing/)
  assert.equal(readFileSync(join(dir, REL), 'utf8'), before)
  rmSync(dir, { recursive: true, force: true })
})

test('missing account-menu anchor fails closed without writing the sidebar', () => {
  const dir = groupedDir()
  const before = readFileSync(join(dir, REL), 'utf8')
  writeFileSync(join(dir, ACCOUNT), ACCOUNT_UPSTREAM.replace(
    "        { id: 'contact', label: t('contactUs'), icon: <IconPaperPlaneOutlineMedium size={16} /> },\n",
    '',
  ))
  const result = runPy(script, dir, 'DSH_SRC')
  assert.notEqual(result.status, 0)
  assert.match(result.stderr, /anchor count=0/)
  assert.equal(readFileSync(join(dir, REL), 'utf8'), before)
  rmSync(dir, { recursive: true, force: true })
})

test('committed desk-panel still says 团队资料', () => {
  const source = readFileSync(sourceClient, 'utf8')
  assert.match(source, /"th\.tab": "团队资料"/)
  assert.equal(source.includes(MARKER), false)
  assert.match(source, /id: "desk-hub"/)
  assert.match(source, /id: "desk-announce"/)
  assert.match(source, /"ann\.feedbackTab": "意见反馈"/)
})

test('AC1–AC3: image copy renames 资料库 and keeps both panels', () => {
  const dir = mkdtempSync(join(tmpdir(), 'work-group-panel-'))
  cpSync(join(root, 'plugin'), join(dir, 'plugin'), { recursive: true })
  const path = join(dir, CLIENT)
  for (const file of [skillsScript, autoScript, botsScript]) {
    const step = runPy(file, dir, 'ANYWORK_SRC')
    assert.equal(step.status, 0, `${file}\n${step.stderr}`)
  }
  const merged = readFileSync(path, 'utf8')
  assert.equal(merged.includes('id: "desk-auto"'), false)
  assert.equal(merged.includes('id: "desk-agents"'), false)
  assert.match(merged, /"bts\.tab": "机器人"/)
  const first = runPy(script, dir, 'ANYWORK_SRC')
  assert.equal(first.status, 0, first.stderr)
  const patched = readFileSync(path, 'utf8')
  assert.equal(patched.includes('团队资料'), false)
  assert.equal(patched.split('"th.tab": "资料库"').length - 1, 1)
  assert.match(patched, /"th\.tab": "Team files"/)
  assert.equal(patched.split('id: "desk-hub"').length - 1, 1)
  const hub = patched.indexOf('id: "desk-hub"')
  const window = patched.slice(hub, hub + 350)
  assert.match(window, /return tr\("th\.tab"\)/)
  assert.match(window, /TeamHub/)
  assert.match(patched, /id: "desk-bots"/)
  assert.match(patched, /"bts\.tab": "机器人"/)
  assert.equal(patched.includes('id: "desk-agents"'), false)
  assert.equal(patched.includes('id: "desk-auto"'), false)
  assert.match(patched, /id: "desk-announce"/)
  assert.match(patched, /"ann\.tab": "公告"/)
  assert.match(patched, /"ann\.feedbackTab": "意见反馈"/)
  assert.match(patched, /function TeamHub\(/)
  assert.match(patched, /function BotsPanel\(/)
  assert.match(patched, /function AnnounceBoard\(/)
  for (const api of [
    '/portal/api/drive/list',
    '/portal/api/drive/upload',
    '/portal/api/drive/mkdir',
    '/portal/api/drive/download',
    '/portal/api/kb/list',
    '/portal/api/kb/note',
    '/portal/api/kb/save',
    '/portal/api/panel/bots',
    '/portal/api/panel/bot-chat',
    '/portal/api/panel/agents',
    '/portal/api/announcements',
    '/portal/api/feedback',
  ]) {
    assert.ok(patched.includes(api), api)
  }
  const second = runPy(script, dir, 'ANYWORK_SRC')
  assert.equal(second.status, 0, second.stderr)
  assert.match(second.stdout, /skip/)
  assert.equal(readFileSync(path, 'utf8'), patched)
  rmSync(dir, { recursive: true, force: true })
})

test('missing vault anchor fails closed', () => {
  const dir = mkdtempSync(join(tmpdir(), 'work-group-novault-'))
  const path = writeRel(dir, CLIENT, 'function TeamHub(props) {}\n')
  const result = runPy(script, dir, 'ANYWORK_SRC')
  assert.notEqual(result.status, 0)
  assert.match(result.stderr, /anchor count=0/)
  assert.equal(readFileSync(path, 'utf8'), 'function TeamHub(props) {}\n')
  rmSync(dir, { recursive: true, force: true })
})

test('a marker without the vault rename fails closed', () => {
  const dir = mkdtempSync(join(tmpdir(), 'work-group-bad-'))
  const path = writeRel(dir, CLIENT, `/* ${MARKER} */\n"th.tab": "团队资料",\n`)
  const result = runPy(script, dir, 'ANYWORK_SRC')
  assert.notEqual(result.status, 0)
  assert.match(result.stderr, /vault rename is wrong/)
  assert.equal(readFileSync(path, 'utf8'), `/* ${MARKER} */\n"th.tab": "团队资料",\n`)
  rmSync(dir, { recursive: true, force: true })
})
