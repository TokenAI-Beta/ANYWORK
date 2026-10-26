// Cut 2026-10-26 sidebar-ui-refresh (乙·重): three cards over the column
// that nav-reorder and entry-chrome already shaped. Registration, clicks,
// relay login, and desk-auto are not part of this change.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawnSync } from 'node:child_process'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const script = join(root, 'deploy/docker/dsh-sidebar-groups.py')
const chromeScript = join(root, 'deploy/docker/dsh-sidebar-entry-chrome.py')
const dockerfile = join(root, 'deploy/docker/Dockerfile')
const relayScript = join(root, 'deploy/docker/dsh-sidebar-relay-login.py')
const navScript = join(root, 'deploy/docker/dsh-sidebar-nav-reorder.py')
const mergeScript = join(root, 'deploy/docker/dsh-sidebar-assistant-skills-merge.py')
const autoScript = join(root, 'deploy/docker/dsh-sidebar-automation-merge.py')
const REL = 'packages/client/ui-sidebar/src/client/SidebarRoot.tsx'
const CSS = 'packages/client/ui-sidebar/src/client/SidebarRoot.module.css'
const ACCOUNT = 'packages/client/ui-settings-account/src/client/AccountMenu.tsx'
const CLIENT = 'plugin/desk-panel/lib/client.js'
const INDEX = 'packages/client/ui-slots/src/index.ts'
const RENDERER = 'packages/client/ui-slots/src/renderer.ts'
const SCOPED = 'packages/client/ui-renderer/src/client/scoped-slots.tsx'
const MARKER = 'cut 2026-10-26 sidebar-ui-refresh'
const RELAY = 'https://api.cntokenai.top/login'

function triple(source, name) {
  const key = `${name} = """`
  const start = source.indexOf(key)
  assert.ok(start >= 0, `missing ${name}`)
  const from = start + key.length
  const end = source.indexOf('"""', from)
  assert.ok(end > from, `unterminated ${name}`)
  return source.slice(from, end)
}

const scriptSource = readFileSync(script, 'utf8')
const chromeSource = readFileSync(chromeScript, 'utf8')
const navSource = readFileSync(navScript, 'utf8')
const OLD_TSX = triple(scriptSource, 'OLD_TSX')
const ACCOUNT_MENU = `const beginSignIn = (): void => { window.open('${RELAY}', '_blank', 'noopener,noreferrer') }\n`
const CLIENT_JS = [
  'id: "desk-auto"',
  'id: "desk-skills-conn"',
  'id: "desk-usage"',
  'id: "chat-import"',
].join('\n')

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

function layout(dir, tsx, css) {
  // The logo row also starts a session. The capsule inside OLD_TSX is the second.
  const sidebar = `onClick={openNewSession}\n${tsx}`
  writeRel(dir, REL, sidebar)
  writeRel(dir, CSS, css)
  writeRel(dir, ACCOUNT, ACCOUNT_MENU)
  writeRel(dir, CLIENT, CLIENT_JS)
  writeRel(dir, INDEX, `export interface RenderOpts {\n${triple(scriptSource, 'OLD_INDEX')}}\n`)
  writeRel(dir, RENDERER, `export interface RenderOpts {\n${triple(scriptSource, 'OLD_RENDERER')}}\n`)
  writeRel(dir, SCOPED, `${triple(scriptSource, 'OLD_LIST')}\n`)
  return sidebar
}

function run(dir, file = script, extraEnv = {}) {
  return spawnSync('python3', [file], {
    env: { ...process.env, DSH_SRC: dir, ...extraEnv },
    encoding: 'utf8',
  })
}

function applyChrome(dir) {
  const result = run(dir, chromeScript)
  assert.equal(result.status, 0, result.stderr)
}

test('three cards group the named entries and keep every other footer id', () => {
  const dir = mkdtempSync(join(tmpdir(), 'sidebar-groups-'))
  layout(dir, OLD_TSX, upstreamCss())
  applyChrome(dir)
  const first = run(dir)
  assert.equal(first.status, 0, first.stderr)
  const tsx = readFileSync(join(dir, REL), 'utf8')
  const css = readFileSync(join(dir, CSS), 'utf8')
  assert.equal(tsx.split(MARKER).length - 1, 1)
  assert.equal(css.split(MARKER).length - 1, 1)
  const work = tsx.indexOf('data-dsh-nav-group="work"')
  const extend = tsx.indexOf('data-dsh-nav-group="extend"')
  const account = tsx.indexOf('data-dsh-nav-group="account"')
  assert.ok(work > 0 && work < extend && extend < account)
  const workChunk = tsx.slice(work, extend)
  const extendChunk = tsx.slice(extend, account)
  const accountChunk = tsx.slice(account, tsx.indexOf("renderSlot('sidebar.workspaces'"))
  assert.match(workChunk, />工作</)
  assert.match(workChunk, /css\.newSession/)
  assert.match(workChunk, /only: 'desk-skills-conn'/)
  assert.match(workChunk, /id === 'schedules'/)
  assert.match(extendChunk, />扩展</)
  assert.match(extendChunk, /id === FIXED_PANEL_ID/)
  assert.match(extendChunk, /only: 'chat-import'/)
  assert.match(accountChunk, />账户</)
  assert.match(accountChunk, /only: 'desk-usage'/)
  assert.match(accountChunk, /PanelMoreMenu/)
  assert.match(accountChunk, /t\('panels\.more'\)/)
  const exceptAt = tsx.indexOf("except: ['desk-skills-conn', 'chat-import', 'desk-usage']")
  assert.ok(exceptAt > account)
  assert.equal(tsx.split("renderSlot('sidebar.footer.action'").length - 1, 4)
  assert.equal(tsx.split("renderSlot('sidebar.settings'").length - 1, 1)
  assert.equal(tsx.split('onClick={openNewSession}').length - 1, 2)
  assert.match(tsx, /IconNewChatOutlineMedium size=\{16\}/)
  assert.equal(tsx.includes('IconNewChatOutlineMedium size={14}'), false)
  for (const token of [
    '--dsh-sidebar-entry-title-size: 14px',
    '--dsh-sidebar-entry-title-weight: 400',
    '--dsh-sidebar-entry-title-line: 22px',
    '--dsh-sidebar-entry-icon-size: 16px',
    '--dsh-sidebar-entry-icon-rail: 18px',
  ]) {
    assert.ok(css.includes(token), token)
  }
  assert.match(css, /border: 1px solid var\(--dsw-alias-border-l2\)/)
  assert.match(css, /0 4px 12px/)
  assert.match(css, /font-size: 11px/)
  assert.match(css, /letter-spacing: 0\.08em/)
  assert.match(css, /--dsh-sidebar-entry-active-bg: color-mix\(in srgb, var\(--dsw-alias-state-business-primary\) 18%, transparent\)/)
  assert.match(css, /\.panelRow\.panelActive,\s*\.panelRow\[aria-expanded='true'\] \{\s*background: var\(--dsh-sidebar-entry-active-bg\);/)
  assert.match(css, /\[class~="on"\][\s\S]*background: var\(--dsh-sidebar-entry-active-bg\) !important/)
  assert.match(css, /\.root:not\(\.collapsed\) \.navGroup \.newSession \{[\s\S]*font-size: var\(--dsh-sidebar-entry-title-size\);/)
  assert.match(css, /\.navGroup \.newSessionContent > svg \{[\s\S]*width: var\(--dsh-sidebar-entry-icon-size\);/)
  assert.match(css, /\.collapsed \.navGroupLabel \{\s*display: none;/)
  const titleLines = css.split('\n').filter((line) => line.includes('font-size: var(--dsh-sidebar-entry-title-size)'))
  assert.ok(titleLines.length >= 2)
  assert.equal(titleLines.some((line) => line.includes('!important')), false)
  assert.match(readFileSync(join(dir, INDEX), 'utf8'), /except\?: readonly string\[\]/)
  assert.match(readFileSync(join(dir, RENDERER), 'utf8'), /except\?: readonly string\[\]/)
  assert.match(readFileSync(join(dir, SCOPED), 'utf8'), /opts\?\.except/)
  assert.equal(readFileSync(join(dir, ACCOUNT), 'utf8'), ACCOUNT_MENU)
  assert.equal(readFileSync(join(dir, CLIENT), 'utf8'), CLIENT_JS)
  const chromeAgain = run(dir, chromeScript)
  assert.equal(chromeAgain.status, 0, chromeAgain.stderr)
  assert.match(chromeAgain.stdout, /skip/)
  const second = run(dir)
  assert.equal(second.status, 0, second.stderr)
  assert.match(second.stdout, /skip/)
  assert.equal(readFileSync(join(dir, REL), 'utf8'), tsx)
  assert.equal(readFileSync(join(dir, CSS), 'utf8'), css)
})

test('the grouped column is the post-reorder shell, not a second nav', () => {
  const navNew = triple(navSource, 'NEW')
  assert.ok(OLD_TSX.includes(navNew))
  assert.match(OLD_TSX, /cut 2026-10-26 sidebar-nav-reorder/)
  assert.equal(OLD_TSX.split("renderSlot('sidebar.footer.action'").length - 1, 1)
})

test('refuses to run without DSH_SRC', () => {
  const env = { ...process.env }
  delete env.DSH_SRC
  const result = spawnSync('python3', [script], { env, encoding: 'utf8' })
  assert.notEqual(result.status, 0)
  assert.match(result.stderr, /DSH_SRC is required/)
})

test('script has no native-install default path and does not retarget login or desk-auto', () => {
  assert.equal(scriptSource.includes('expanduser'), false)
  assert.equal(scriptSource.includes('USERPROFILE'), false)
  assert.equal(scriptSource.includes('AppData'), false)
  assert.equal(scriptSource.includes('~/'), false)
  assert.equal(scriptSource.includes('deploy/windows'), false)
  assert.equal(scriptSource.includes('beginSignIn'), false)
  assert.equal(scriptSource.includes('plugin/desk-panel/lib/client.js'), false)
  const urls = scriptSource.match(/https:\/\/[^\s'")]+/g) || []
  assert.deepEqual(urls, [])
  assert.match(scriptSource, /desk-auto/)
  assert.match(scriptSource, /desk-skills-conn/)
  assert.match(scriptSource, /desk-usage/)
  assert.match(scriptSource, /chat-import/)
  assert.match(readFileSync(relayScript, 'utf8'), new RegExp(RELAY.replace(/[.]/g, '\\.')))
  assert.match(readFileSync(mergeScript, 'utf8'), /"desk-auto"/)
  assert.match(readFileSync(autoScript, 'utf8'), /desk-auto/)
  assert.equal(readFileSync(navScript, 'utf8').includes(MARKER), false)
})

test('image build applies the groups after entry chrome and before pnpm build', () => {
  const docker = readFileSync(dockerfile, 'utf8')
  assert.match(docker, /ARG DSH_REF=dsh-v0\.2\.1-rc\.3/)
  const chromeRun = docker.indexOf('python3 /tmp/dsh-sidebar-entry-chrome.py')
  const groupsCopy = docker.indexOf('COPY deploy/docker/dsh-sidebar-groups.py /tmp/dsh-sidebar-groups.py')
  const groupsRun = docker.indexOf('python3 /tmp/dsh-sidebar-groups.py')
  const buildAt = docker.indexOf('RUN pnpm build')
  assert.ok(chromeRun > 0 && groupsCopy > chromeRun && groupsRun > groupsCopy && buildAt > groupsRun)
  assert.match(docker, /curl -fsS http:\/\/127\.0\.0\.1:8080\/healthz/)
  assert.equal(docker.includes('deploy/windows'), false)
})

test('missing anchor fails closed', () => {
  const dir = mkdtempSync(join(tmpdir(), 'sidebar-groups-miss-'))
  layout(dir, '<div>no column</div>\n', upstreamCss())
  applyChrome(dir)
  const before = readFileSync(join(dir, REL), 'utf8')
  const result = run(dir)
  assert.notEqual(result.status, 0)
  assert.match(result.stderr, /anchor count=0/)
  assert.equal(readFileSync(join(dir, REL), 'utf8'), before)
  assert.equal(readFileSync(join(dir, ACCOUNT), 'utf8'), ACCOUNT_MENU)
  assert.equal(readFileSync(join(dir, CLIENT), 'utf8'), CLIENT_JS)
})

test('entry chrome must already be applied', () => {
  const dir = mkdtempSync(join(tmpdir(), 'sidebar-groups-nochrome-'))
  layout(dir, OLD_TSX, '.root { font-size: 14px; }\n')
  const before = readFileSync(join(dir, REL), 'utf8')
  const result = run(dir)
  assert.notEqual(result.status, 0)
  assert.match(result.stderr, /sidebar entry chrome is missing/)
  assert.equal(readFileSync(join(dir, REL), 'utf8'), before)
})

test('a marker without the three groups fails closed', () => {
  const dir = mkdtempSync(join(tmpdir(), 'sidebar-groups-bad-'))
  layout(dir, `/* ${MARKER} */\n<div />\n`, upstreamCss())
  applyChrome(dir)
  const cssPath = join(dir, CSS)
  writeFileSync(cssPath, `/* ${MARKER} */\n${readFileSync(cssPath, 'utf8')}`)
  const result = run(dir)
  assert.notEqual(result.status, 0)
  assert.match(result.stderr, /sidebar groups are wrong/)
})
