// Cut 2026-10-26 chat-import-open (Decision A).
// 扩展「导入会话」stays only:'chat-import'. A click on that footer action
// returns to the chat shell and closes desk full-views before the plugin
// opens the import tab. Work / account membership is unchanged.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawnSync } from 'node:child_process'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const script = join(root, 'deploy/docker/dsh-sidebar-chat-import-open.py')
const workScript = join(root, 'deploy/docker/dsh-sidebar-work-group-bots-vault.py')
const groupsScript = join(root, 'deploy/docker/dsh-sidebar-groups.py')
const chromeScript = join(root, 'deploy/docker/dsh-sidebar-entry-chrome.py')
const relayScript = join(root, 'deploy/docker/dsh-sidebar-relay-login.py')
const dockerfile = join(root, 'deploy/docker/Dockerfile')
const bootstrap = join(root, 'deploy/docker/bootstrap.sh')

const REL = 'packages/client/ui-sidebar/src/client/SidebarRoot.tsx'
const CSS = 'packages/client/ui-sidebar/src/client/SidebarRoot.module.css'
const ACCOUNT = 'packages/client/ui-settings-account/src/client/AccountMenu.tsx'
const INDEX = 'packages/client/ui-slots/src/index.ts'
const RENDERER = 'packages/client/ui-slots/src/renderer.ts'
const SCOPED = 'packages/client/ui-renderer/src/client/scoped-slots.tsx'
const MARKER = 'cut 2026-10-26 chat-import-open'
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

function layout(dir) {
  writeRel(dir, REL, `onClick={openNewSession}\n${OLD_TSX}`)
  writeRel(dir, CSS, upstreamCss())
  writeRel(dir, ACCOUNT, ACCOUNT_UPSTREAM)
  writeRel(dir, INDEX, `export interface RenderOpts {\n${triple(groupsSource, 'OLD_INDEX')}}\n`)
  writeRel(dir, RENDERER, `export interface RenderOpts {\n${triple(groupsSource, 'OLD_RENDERER')}}\n`)
  writeRel(dir, SCOPED, `${triple(groupsSource, 'OLD_LIST')}\n`)
}

function runPy(file, dir) {
  const env = { ...process.env, DSH_SRC: dir }
  delete env.ANYWORK_SRC
  return spawnSync('python3', [file], { env, encoding: 'utf8' })
}

function workGroupedDir() {
  const dir = mkdtempSync(join(tmpdir(), 'chat-import-open-'))
  layout(dir)
  for (const file of [chromeScript, groupsScript, relayScript, workScript]) {
    const step = runPy(file, dir)
    assert.equal(step.status, 0, `${file}\n${step.stderr}`)
  }
  return dir
}

function chunk(text, startKey, endKey) {
  const start = text.indexOf(startKey)
  const end = text.indexOf(endKey, start + 1)
  assert.ok(start >= 0 && end > start, `${startKey} .. ${endKey}`)
  return text.slice(start, end)
}

test('AC1: extend 导入会话 click reveals the chat shell and closes full-views', () => {
  const dir = workGroupedDir()
  const before = readFileSync(join(dir, REL), 'utf8')
  assert.equal(before.includes(MARKER), false)
  assert.match(before, /only: 'chat-import'/)

  const first = runPy(script, dir)
  assert.equal(first.status, 0, first.stderr)
  const tsx = readFileSync(join(dir, REL), 'utf8')
  assert.equal(tsx.split(MARKER).length - 1, 1)

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
  assert.equal(work.includes('onClickCapture'), false)
  assert.equal(work.includes('desk-fv'), false)
  assert.equal(extend.includes('desk-bots'), false)
  assert.equal(extend.includes('desk-hub'), false)
  assert.match(extend, />扩展</)
  assert.match(extend, /only: 'chat-import'/)
  assert.match(extend, /id === FIXED_PANEL_ID/)
  assert.match(extend, /onClickCapture/)
  assert.match(extend, /\[data-slot="sidebar\.footer\.action"\]/)
  assert.match(extend, /activePanelId !== null/)
  assert.match(extend, /\(selectPanel as unknown as \(id: null\) => void\)\(null\)/)
  assert.match(extend, /new CustomEvent\('desk-fv', \{ detail: \{ id: null \} \}\)/)
  assert.equal(extend.includes('stopPropagation'), false)
  assert.equal(extend.includes('preventDefault'), false)
  assert.equal(extend.includes('startSession()'), false)
  assert.equal(extend.split('selectPanel={selectPanel}').length - 1, 1)
  assert.equal(account.includes('onClickCapture'), false)
  assert.equal(account.includes('desk-fv'), false)
  assert.match(account, />账户</)
  assert.match(account, /only: 'desk-usage'/)
  assert.match(account, /PanelMoreMenu/)
  assert.equal(tsx.split("only: 'chat-import'").length - 1, 1)
  assert.equal(tsx.split("renderSlot('sidebar.footer.action'").length - 1, 6)
  assert.equal(tsx.split(NEW_EXCEPT).length - 1, 1)
  assert.ok(tsx.indexOf(NEW_EXCEPT) > tsx.indexOf('data-dsh-nav-group="account"'))

  const second = runPy(script, dir)
  assert.equal(second.status, 0, second.stderr)
  assert.match(second.stdout, /skip/)
  assert.equal(readFileSync(join(dir, REL), 'utf8'), tsx)

  const regroup = runPy(workScript, dir)
  assert.equal(regroup.status, 0, regroup.stderr)
  assert.match(regroup.stdout, /skip/)
  assert.equal(readFileSync(join(dir, REL), 'utf8'), tsx)
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
  assert.match(scriptSource, /dsh-chat-import@0\.26\.2/)
  assert.equal(scriptSource.includes('dsh-chat-import@0.19'), false)
  assert.equal(scriptSource.includes('plugin add'), false)
  assert.match(readFileSync(bootstrap, 'utf8'), /dsh-chat-import@0\.26\.2/)
})

test('image build runs after work-group and before pnpm build', () => {
  const docker = readFileSync(dockerfile, 'utf8')
  assert.match(docker, /ARG DSH_REF=dsh-v0\.2\.1-rc\.3/)
  const workRun = docker.indexOf('DSH_SRC=/src/deepseek-harness python3 /tmp/dsh-sidebar-work-group-bots-vault.py')
  const copyAt = docker.indexOf('COPY deploy/docker/dsh-sidebar-chat-import-open.py /tmp/dsh-sidebar-chat-import-open.py')
  const runAt = docker.indexOf('DSH_SRC=/src/deepseek-harness python3 /tmp/dsh-sidebar-chat-import-open.py')
  const buildAt = docker.indexOf('RUN pnpm build')
  assert.ok(workRun > 0 && copyAt > workRun && runAt > copyAt && buildAt > runAt)
  assert.equal(docker.includes('ANYWORK_SRC=/opt/anywork python3 /opt/anywork/deploy/docker/dsh-sidebar-chat-import-open.py'), false)
  assert.equal(docker.includes('deploy/windows'), false)
})

test('work-group must already be applied', () => {
  const dir = mkdtempSync(join(tmpdir(), 'chat-import-open-nowork-'))
  layout(dir)
  for (const file of [chromeScript, groupsScript]) {
    const step = runPy(file, dir)
    assert.equal(step.status, 0, step.stderr)
  }
  const before = readFileSync(join(dir, REL), 'utf8')
  const result = runPy(script, dir)
  assert.notEqual(result.status, 0)
  assert.match(result.stderr, /work-group sidebar is missing/)
  assert.equal(readFileSync(join(dir, REL), 'utf8'), before)
  rmSync(dir, { recursive: true, force: true })
})

test('a marker without the click path fails closed', () => {
  const dir = workGroupedDir()
  const path = join(dir, REL)
  const broken = readFileSync(path, 'utf8').replace(
    'data-dsh-nav-group="extend"',
    `data-dsh-nav-group="extend" {/* ${MARKER} */}`,
  )
  writeFileSync(path, broken)
  const result = runPy(script, dir)
  assert.notEqual(result.status, 0)
  assert.match(result.stderr, /chat-import open path is wrong/)
  assert.equal(readFileSync(path, 'utf8'), broken)
  rmSync(dir, { recursive: true, force: true })
})
