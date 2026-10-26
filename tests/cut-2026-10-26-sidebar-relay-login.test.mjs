// Cut 2026-10-26 sidebar-relay-login: the signed-out sidebar 「登录」 item
// opens the relay login. DeepSeek account start() is not on that item.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawnSync } from 'node:child_process'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const script = join(root, 'deploy/docker/dsh-sidebar-relay-login.py')
const dockerfile = join(root, 'deploy/docker/Dockerfile')
const REL = 'packages/client/ui-settings-account/src/client/AccountMenu.tsx'
const RELAY = 'https://app.cntokenai.top/login'

const UPSTREAM = `
  // The plugin's start publishes \`loginFailed\` before it rejects, so the dialog owns the report.
  const beginSignIn = (): void => { setOpen(false); void start().catch(() => undefined) }
  return <div ref={anchor} className={css.root}>
      onSelect={(id) => {
        if (id === 'settings') { setOpen(false); trigger.current?.focus(); openSettings() }
        else if (id === 'contact') { setOpen(false); contactUs() }
        else if (id === 'signin') beginSignIn()
        else void requestSignOut()
      }} />
    {account.loginVisible && !account.onboarding && <SignInDialog account={account} colorScheme={colorScheme}
      start={start} cancel={cancel} t={t}
`

function layout(dir) {
  const path = join(dir, REL)
  mkdirSync(dirname(path), { recursive: true })
  writeFileSync(path, UPSTREAM)
  return path
}

function run(dir, extraEnv = {}) {
  return spawnSync('python3', [script], {
    env: { ...process.env, DSH_SRC: dir, ...extraEnv },
    encoding: 'utf8',
  })
}

test('sidebar sign-in opens the relay and does not call DeepSeek start()', () => {
  const dir = mkdtempSync(join(tmpdir(), 'relay-login-'))
  const path = layout(dir)
  const first = run(dir)
  assert.equal(first.status, 0, first.stderr)
  const patched = readFileSync(path, 'utf8')
  assert.match(patched, /window\.open\('https:\/\/app\.cntokenai\.top\/login', '_blank', 'noopener,noreferrer'\)/)
  assert.match(patched, /else if \(id === 'signin'\) beginSignIn\(\)/)
  const begin = patched.indexOf('const beginSignIn')
  const ret = patched.indexOf('return <div', begin)
  assert.ok(begin >= 0 && ret > begin)
  assert.equal(patched.slice(begin, ret).includes('start('), false)
  assert.match(patched, /<SignInDialog[\s\S]*start=\{start\}/)
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
  const source = readFileSync(script, 'utf8')
  assert.equal(source.includes('expanduser'), false)
  assert.equal(source.includes('USERPROFILE'), false)
  assert.equal(source.includes('AppData'), false)
  assert.equal(source.includes('~/'), false)
})

test('image build applies the patch before pnpm build and does not bump the engine', () => {
  const docker = readFileSync(dockerfile, 'utf8')
  assert.match(docker, /ARG DSH_REF=dsh-v0\.2\.1-rc\.3/)
  const copyAt = docker.indexOf('COPY deploy/docker/dsh-sidebar-relay-login.py /tmp/dsh-sidebar-relay-login.py')
  const runAt = docker.indexOf('DSH_SRC=/src/deepseek-harness python3 /tmp/dsh-sidebar-relay-login.py')
  const buildAt = docker.indexOf('RUN pnpm build')
  assert.ok(copyAt > 0 && runAt > copyAt && buildAt > runAt)
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

test('relay URL is the only login target introduced by the patch', () => {
  const source = readFileSync(script, 'utf8')
  const urls = source.match(/https:\/\/[^\s'")]+/g) || []
  assert.deepEqual([...new Set(urls)], [RELAY])
})
