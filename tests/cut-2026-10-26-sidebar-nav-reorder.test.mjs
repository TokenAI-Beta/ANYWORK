// Cut 2026-10-26 sidebar-nav-reorder: sidebar.footer.action renders under
// New Session and above the plugins panel list. sidebar.settings stays in
// the foot. The relay-login AccountMenu patch is not part of this change.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawnSync } from 'node:child_process'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const script = join(root, 'deploy/docker/dsh-sidebar-nav-reorder.py')
const dockerfile = join(root, 'deploy/docker/Dockerfile')
const relayScript = join(root, 'deploy/docker/dsh-sidebar-relay-login.py')
const REL = 'packages/client/ui-sidebar/src/client/SidebarRoot.tsx'
const ACCOUNT = 'packages/client/ui-settings-account/src/client/AccountMenu.tsx'
const RELAY = 'https://api.cntokenai.top/login'
const MARKER = 'cut 2026-10-26 sidebar-nav-reorder'

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
const OLD = triple(scriptSource, 'OLD')

const ACCOUNT_MENU = `const beginSignIn = (): void => { window.open('${RELAY}', '_blank', 'noopener,noreferrer') }\n`

function layout(dir, sidebar) {
  const path = join(dir, REL)
  mkdirSync(dirname(path), { recursive: true })
  writeFileSync(path, sidebar)
  const account = join(dir, ACCOUNT)
  mkdirSync(dirname(account), { recursive: true })
  writeFileSync(account, ACCOUNT_MENU)
  return path
}

function upstreamSidebar() {
  return [
    '<span className={css.buildVersion}>{buildVersion}</span>',
    OLD,
    '',
  ].join('\n')
}

function run(dir, extraEnv = {}) {
  return spawnSync('python3', [script], {
    env: { ...process.env, DSH_SRC: dir, ...extraEnv },
    encoding: 'utf8',
  })
}

function orderOf(text) {
  return [
    text.indexOf("renderSlot('sidebar.footer.action'"),
    text.indexOf('<nav className={css.panelList}'),
    text.indexOf("renderSlot('sidebar.workspaces'"),
    text.indexOf('<div className={css.footArea}>'),
    text.indexOf("renderSlot('sidebar.settings'"),
  ]
}

test('footer actions move above the plugins list and are not repeated in the foot', () => {
  const dir = mkdtempSync(join(tmpdir(), 'nav-reorder-'))
  const path = layout(dir, upstreamSidebar())
  const first = run(dir)
  assert.equal(first.status, 0, first.stderr)
  const patched = readFileSync(path, 'utf8')
  assert.match(patched, new RegExp(MARKER))
  const order = orderOf(patched)
  assert.ok(order.every((index) => index >= 0), order.join(','))
  assert.deepEqual(order, [...order].sort((a, b) => a - b))
  assert.equal(patched.split("renderSlot('sidebar.footer.action'").length - 1, 1)
  assert.equal(patched.split("renderSlot('sidebar.settings'").length - 1, 1)
  const foot = patched.slice(patched.indexOf('<div className={css.footArea}>'))
  assert.equal(foot.includes('sidebar.footer.action'), false)
  assert.match(foot, /renderSlot\('sidebar\.settings'/)
  assert.match(patched, /css\.buildVersion/)
  assert.match(patched, /sidebar\.workspaces/)
  assert.equal(readFileSync(join(dir, ACCOUNT), 'utf8'), ACCOUNT_MENU)
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

test('script has no native-install default path', () => {
  assert.equal(scriptSource.includes('expanduser'), false)
  assert.equal(scriptSource.includes('USERPROFILE'), false)
  assert.equal(scriptSource.includes('AppData'), false)
  assert.equal(scriptSource.includes('~/'), false)
})

test('image build applies the reorder after relay login and before pnpm build', () => {
  const docker = readFileSync(dockerfile, 'utf8')
  assert.match(docker, /ARG DSH_REF=dsh-v0\.2\.1-rc\.3/)
  const relayRun = docker.indexOf('python3 /tmp/dsh-sidebar-relay-login.py')
  const navCopy = docker.indexOf('COPY deploy/docker/dsh-sidebar-nav-reorder.py /tmp/dsh-sidebar-nav-reorder.py')
  const navRun = docker.indexOf('python3 /tmp/dsh-sidebar-nav-reorder.py')
  const buildAt = docker.indexOf('RUN pnpm build')
  assert.ok(relayRun > 0 && navCopy > relayRun && navRun > navCopy && buildAt > navRun)
})

test('plugin pins stay on the docker scripts', () => {
  const bootstrap = readFileSync(join(root, 'deploy/docker/bootstrap.sh'), 'utf8')
  const provision = readFileSync(join(root, 'deploy/docker/member-provision.sh'), 'utf8')
  for (const text of [bootstrap, provision]) {
    assert.match(text, /dsh-better-sidebar@0\.28\.0/)
    assert.match(text, /dsh-client-ui-aqua/)
    assert.match(text, /1\.4\.2/)
    assert.match(text, /dsh-agents-md/)
    assert.match(text, /0\.4\.0/)
    assert.match(text, /dsh-chat-import@0\.26\.2/)
    assert.match(text, /DEFERRED_PLUGINS=\(\)/)
  }
})

test('reorder patch does not change the relay login URL', () => {
  const urls = scriptSource.match(/https:\/\/[^\s'")]+/g) || []
  assert.deepEqual(urls, [])
  assert.equal(scriptSource.includes('AccountMenu'), true)
  assert.equal(scriptSource.includes('beginSignIn'), false)
  const relay = readFileSync(relayScript, 'utf8')
  assert.match(relay, /https:\/\/api\.cntokenai\.top\/login/)
  assert.match(relay, /beginSignIn/)
})

test('missing anchor fails closed', () => {
  const dir = mkdtempSync(join(tmpdir(), 'nav-reorder-miss-'))
  layout(dir, '<span className={css.buildVersion}>{buildVersion}</span>\n')
  const result = run(dir)
  assert.notEqual(result.status, 0)
  assert.match(result.stderr, /anchor count=0/)
  assert.match(readFileSync(join(dir, REL), 'utf8'), /css\.buildVersion/)
})

test('a marker without the new order fails closed', () => {
  const dir = mkdtempSync(join(tmpdir(), 'nav-reorder-bad-'))
  layout(dir, `/* ${MARKER} */\n<div className={css.footArea}>{renderSlot('sidebar.footer.action', { wide })}</div>\n`)
  const result = run(dir)
  assert.notEqual(result.status, 0)
  assert.match(result.stderr, /sidebar order is wrong/)
})
