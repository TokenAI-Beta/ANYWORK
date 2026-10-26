// Cut 2026-10-26 sidebar-entry-style-unify: panel rows and the footer
// actions in the same column share one title and leading-icon chrome.
// Registration, clicks, relay login, and desk-auto are not part of this change.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawnSync } from 'node:child_process'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const script = join(root, 'deploy/docker/dsh-sidebar-entry-chrome.py')
const dockerfile = join(root, 'deploy/docker/Dockerfile')
const relayScript = join(root, 'deploy/docker/dsh-sidebar-relay-login.py')
const navScript = join(root, 'deploy/docker/dsh-sidebar-nav-reorder.py')
const mergeScript = join(root, 'deploy/docker/dsh-sidebar-assistant-skills-merge.py')
const REL = 'packages/client/ui-sidebar/src/client/SidebarRoot.module.css'
const TSX = 'packages/client/ui-sidebar/src/client/SidebarRoot.tsx'
const ACCOUNT = 'packages/client/ui-settings-account/src/client/AccountMenu.tsx'
const CLIENT = 'plugin/desk-panel/lib/client.js'
const MARKER = 'cut 2026-10-26 sidebar-entry-style-unify'
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
const ACCOUNT_MENU = `const beginSignIn = (): void => { window.open('${RELAY}', '_blank', 'noopener,noreferrer') }\n`
const SIDEBAR_TSX = "renderSlot('sidebar.footer.action', { wide })\nrenderSlot('sidebar.settings', { wide })\n"
const CLIENT_JS = [
  'id: "desk-auto"',
  'id: "desk-skills-conn"',
  'id: "desk-assistants"',
  '.ddb .ic { width:26px; height:26px; }',
].join('\n')

function upstreamCss() {
  return [
    '.root {',
    triple(scriptSource, 'OLD_ROOT'),
    '  --dsh-scrollbar-thumb: var(--dsw-alias-scrollbar-bg-l2);',
    '}',
    triple(scriptSource, 'OLD_PANEL_LIST'),
    triple(scriptSource, 'OLD_PANEL_ROW'),
    '.panelRow:hover { background: var(--dsw-alias-interactive-bg-hover); }',
    '.panelRow.panelActive { background: var(--dsw-alias-interactive-bg-hover); }',
    triple(scriptSource, 'OLD_GLYPH'),
    triple(scriptSource, 'OLD_COLLAPSED_LIST'),
    triple(scriptSource, 'OLD_COLLAPSED_ROW'),
    triple(scriptSource, 'OLD_FOOT'),
    '',
  ].join('\n')
}

function layout(dir, css) {
  const path = join(dir, REL)
  mkdirSync(dirname(path), { recursive: true })
  writeFileSync(path, css)
  const tsx = join(dir, TSX)
  mkdirSync(dirname(tsx), { recursive: true })
  writeFileSync(tsx, SIDEBAR_TSX)
  const account = join(dir, ACCOUNT)
  mkdirSync(dirname(account), { recursive: true })
  writeFileSync(account, ACCOUNT_MENU)
  const client = join(dir, CLIENT)
  mkdirSync(dirname(client), { recursive: true })
  writeFileSync(client, CLIENT_JS)
  return path
}

function run(dir) {
  return spawnSync('python3', [script], {
    env: { ...process.env, DSH_SRC: dir },
    encoding: 'utf8',
  })
}

test('panel rows and footer entries share one title and leading-icon chrome', () => {
  const dir = mkdtempSync(join(tmpdir(), 'entry-chrome-'))
  const path = layout(dir, upstreamCss())
  const first = run(dir)
  assert.equal(first.status, 0, first.stderr)
  const patched = readFileSync(path, 'utf8')
  assert.equal(patched.split(MARKER).length - 1, 1)
  for (const token of [
    '--dsh-sidebar-entry-title-size: 14px',
    '--dsh-sidebar-entry-title-weight: 400',
    '--dsh-sidebar-entry-title-line: 22px',
    '--dsh-sidebar-entry-icon-size: 16px',
    '--dsh-sidebar-entry-icon-rail: 18px',
    '--dsh-sidebar-entry-gap: 8px',
    '--dsh-sidebar-entry-min-height: 36px',
    '--dsh-sidebar-entry-pad: 7px 8px',
    '--dsh-sidebar-entry-radius: var(--dsw-radius-md)',
  ]) {
    assert.ok(patched.includes(token), token)
  }
  assert.match(patched, /\.panelTitle \{[\s\S]*font-size: var\(--dsh-sidebar-entry-title-size\);/)
  assert.match(patched, /\.panelGlyph svg \{[\s\S]*width: var\(--dsh-sidebar-entry-icon-size\);/)
  assert.match(patched, /\.collapsed \.panelGlyph svg \{[\s\S]*width: var\(--dsh-sidebar-entry-icon-rail\);/)
  assert.match(patched, /\.footerActions \{[\s\S]*flex-direction: column;/)
  for (const selector of [
    '> button:hover',
    '> div > button:hover',
    '> div > div > button:hover',
    '> button[class~="on"]',
    '> div > button[aria-expanded="true"]',
    '> button > :first-child',
    '> div > button > :first-child',
    '> div > div > button > :first-child',
    '> button > svg',
    '> div > div > button > svg',
  ]) {
    assert.ok(patched.includes(selector), selector)
  }
  assert.match(patched, /\.panelRow:hover/)
  assert.match(patched, /\.panelRow\.panelActive/)
  const titleLines = patched.split('\n').filter((line) => line.includes('font-size: var(--dsh-sidebar-entry-title-size)'))
  assert.ok(titleLines.length >= 2)
  assert.equal(titleLines.some((line) => line.includes('!important')), false)
  assert.equal(readFileSync(join(dir, TSX), 'utf8'), SIDEBAR_TSX)
  assert.equal(readFileSync(join(dir, ACCOUNT), 'utf8'), ACCOUNT_MENU)
  assert.equal(readFileSync(join(dir, CLIENT), 'utf8'), CLIENT_JS)
  const second = run(dir)
  assert.equal(second.status, 0, second.stderr)
  assert.match(second.stdout, /skip/)
  assert.equal(readFileSync(path, 'utf8'), patched)
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
  assert.match(scriptSource, /id plugins/)
  assert.match(scriptSource, /id schedules/)
  assert.match(scriptSource, /chat-import/)
  assert.match(readFileSync(relayScript, 'utf8'), new RegExp(RELAY.replace(/[.]/g, '\\.')))
  assert.equal(readFileSync(navScript, 'utf8').includes(MARKER), false)
  assert.match(readFileSync(mergeScript, 'utf8'), /"desk-auto"/)
})

test('image build applies the chrome after nav reorder and before pnpm build', () => {
  const docker = readFileSync(dockerfile, 'utf8')
  assert.match(docker, /ARG DSH_REF=dsh-v0\.2\.1-rc\.3/)
  const navRun = docker.indexOf('python3 /tmp/dsh-sidebar-nav-reorder.py')
  const chromeCopy = docker.indexOf('COPY deploy/docker/dsh-sidebar-entry-chrome.py /tmp/dsh-sidebar-entry-chrome.py')
  const chromeRun = docker.indexOf('python3 /tmp/dsh-sidebar-entry-chrome.py')
  const buildAt = docker.indexOf('RUN pnpm build')
  assert.ok(navRun > 0 && chromeCopy > navRun && chromeRun > chromeCopy && buildAt > chromeRun)
})

test('missing anchor fails closed', () => {
  const dir = mkdtempSync(join(tmpdir(), 'entry-chrome-miss-'))
  layout(dir, '.root { font-size: 14px; }\n')
  const result = run(dir)
  assert.notEqual(result.status, 0)
  assert.match(result.stderr, /anchor count=0/)
  assert.match(readFileSync(join(dir, REL), 'utf8'), /font-size: 14px/)
  assert.equal(readFileSync(join(dir, ACCOUNT), 'utf8'), ACCOUNT_MENU)
})

test('a marker without the shared tokens fails closed', () => {
  const dir = mkdtempSync(join(tmpdir(), 'entry-chrome-bad-'))
  layout(dir, `/* ${MARKER} */\n.footerActions { display: flex; }\n`)
  const result = run(dir)
  assert.notEqual(result.status, 0)
  assert.match(result.stderr, /sidebar entry chrome is wrong/)
})
