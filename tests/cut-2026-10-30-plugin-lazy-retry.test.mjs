// Cut 2026-10-30 plugin-lazy-retry.
// Retry re-fetches deferred failures, and settings-account art is not one
// multi-MB deferred entry.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawnSync } from 'node:child_process'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const script = join(root, 'deploy/docker/dsh-plugin-lazy-first-paint.py')
const dockerfile = join(root, 'deploy/docker/Dockerfile')
const portal = join(root, 'src/portal.ts')
const deskClient = join(root, 'plugin/desk-panel/lib/client.js')

function loadEdits() {
  const dumped = spawnSync('python3', ['-c', `
import importlib.util, json, sys
spec = importlib.util.spec_from_file_location("patch", sys.argv[1])
mod = importlib.util.module_from_spec(spec)
spec.loader.exec_module(mod)
json.dump(mod.EDITS, sys.stdout)
`, script], { encoding: 'utf8' })
  assert.equal(dumped.status, 0, dumped.stderr)
  return JSON.parse(dumped.stdout)
}

function layout(dir, edits) {
  const files = new Map()
  for (const [rel, old] of edits) {
    files.set(rel, `${files.get(rel) ?? ''}${old}\n`)
  }
  for (const [rel, text] of files) {
    const path = join(dir, rel)
    mkdirSync(dirname(path), { recursive: true })
    writeFileSync(path, text)
  }
}

function run(dir, args = []) {
  return spawnSync('python3', [script, ...args], {
    env: { ...process.env, DSH_SRC: dir },
    encoding: 'utf8',
  })
}

const ACTIVE = 2
const ACCOUNT = '@deepseek-ai/dsh-client-ui-settings-account'
const SIDEBAR = 'dsh-better-sidebar'

function wave(rows, managed) {
  const pending = []
  const removed = []
  for (const row of rows) {
    if (row.deferred !== true) continue
    const entry = managed.get(row.id)
    if (entry?.fiber?.state === ACTIVE) continue
    if (entry !== undefined) removed.push(row.id)
    pending.push(row)
  }
  const late = id => id === ACCOUNT || id === SIDEBAR
  pending.sort((left, right) => Number(late(left.id)) - Number(late(right.id)))
  return { pending: pending.map(row => row.id), removed }
}

const edits = loadEdits()

test('Retry re-activates non-ACTIVE deferred rows and splits account art', () => {
  const dir = mkdtempSync(join(tmpdir(), 'plugin-lazy-retry-'))
  layout(dir, edits)
  const first = run(dir)
  assert.equal(first.status, 0, first.stderr)
  assert.match(first.stdout, /plugin-lazy-retry/)

  const entries = readFileSync(join(dir, 'packages/client/modules/src/client/entries.ts'), 'utf8')
  const boot = readFileSync(join(dir, 'packages/client/web/src/boot.ts'), 'utf8')
  const account = readFileSync(join(dir, 'packages/client/ui-settings-account/src/client/index.ts'), 'utf8')
  const lazy = readFileSync(join(dir, 'packages/client/ui-settings-account/src/client/LazyDesktopOnboardingEntry.tsx'), 'utf8')

  assert.match(entries, /entry\?\.fiber\?\.state === ACTIVE/)
  assert.match(entries, /loader\.remove\(entry\.id\)/)
  assert.match(entries, /removeOwnedStyles\(row\.id\)/)
  assert.match(entries, /@deepseek-ai\/dsh-client-ui-settings-account/)
  assert.match(entries, /dsh-better-sidebar/)
  assert.doesNotMatch(entries, /!this\.managed\.has\(row\.id\)/)

  const click = boot.split("button.addEventListener('click'")[1].split('bar.append')[0]
  assert.match(click, /activateDeferred\(\)/)
  assert.doesNotMatch(click, /\.retry\(\)/)
  assert.match(boot, /cut 2026-10-30 plugin-lazy-first-paint/)

  assert.match(account, /import type \{ DesktopOnboardingInjected \}/)
  assert.match(account, /LazyDesktopOnboardingEntry/)
  assert.doesNotMatch(account, /import \{ DesktopOnboardingEntry/)
  assert.match(lazy, /import\('\.\/DesktopOnboardingEntry\.tsx'\)/)
  assert.match(lazy, /lazy\(async/)
  assert.doesNotMatch(lazy, /from '\.\/assets\//)

  const again = run(dir)
  assert.equal(again.status, 0, again.stderr)
  assert.equal(
    readFileSync(join(dir, 'packages/client/ui-settings-account/src/client/LazyDesktopOnboardingEntry.tsx'), 'utf8'),
    lazy,
  )
})

test('failed managed deferred rows are fetched again, heavy packs last', () => {
  const rows = [
    { id: ACCOUNT, deferred: true },
    { id: 'small-a', deferred: true },
    { id: SIDEBAR, deferred: true },
    { id: 'shell', deferred: false },
    { id: 'small-b', deferred: true },
    { id: 'already-up', deferred: true },
  ]
  const managed = new Map([
    [ACCOUNT, { fiber: { state: 3 } }],
    [SIDEBAR, { fiber: undefined }],
    ['already-up', { fiber: { state: ACTIVE } }],
  ])
  const { pending, removed } = wave(rows, managed)
  assert.deepEqual(removed, [ACCOUNT, SIDEBAR])
  assert.deepEqual(pending, ['small-a', 'small-b', ACCOUNT, SIDEBAR])
  assert.equal(pending.includes('shell'), false)
  assert.equal(pending.includes('already-up'), false)

  const fresh = wave(rows, new Map())
  assert.deepEqual(fresh.removed, [])
  assert.deepEqual(fresh.pending, ['small-a', 'small-b', 'already-up', ACCOUNT, SIDEBAR])
})

test('account bundle check rejects an inlined multi-MB entry', () => {
  const dir = mkdtempSync(join(tmpdir(), 'plugin-lazy-retry-bundle-'))
  const lib = join(dir, 'packages/client/ui-settings-account/lib')
  mkdirSync(lib, { recursive: true })

  const missing = run(dir, ['--check-account-bundle'])
  assert.notEqual(missing.status, 0)
  assert.match(missing.stderr, /missing/)

  writeFileSync(join(lib, 'client.js'), `data:image/webp;base64,${'A'.repeat(32)}`)
  const inlined = run(dir, ['--check-account-bundle'])
  assert.notEqual(inlined.status, 0)
  assert.match(inlined.stderr, /inlines onboarding webp/)

  writeFileSync(join(lib, 'client.js'), 'x'.repeat(768 * 1024 + 1))
  const huge = run(dir, ['--check-account-bundle'])
  assert.notEqual(huge.status, 0)
  assert.match(huge.stderr, /deferred combo cap/)

  writeFileSync(join(lib, 'client.js'), 'account menu entry')
  const noArt = run(dir, ['--check-account-bundle'])
  assert.notEqual(noArt.status, 0)
  assert.match(noArt.stderr, /art chunk was not emitted/)

  writeFileSync(join(lib, 'client.DesktopOnboardingEntry.js'), 'data:image/webp;base64,AAAA')
  const ok = run(dir, ['--check-account-bundle'])
  assert.equal(ok.status, 0, ok.stderr)
  assert.match(ok.stdout, /separate chunk/)
})

test('image build checks the account entry after pnpm build', () => {
  const docker = readFileSync(dockerfile, 'utf8')
  const buildAt = docker.indexOf('RUN pnpm build')
  const checkAt = docker.indexOf('python3 /tmp/dsh-plugin-lazy-first-paint.py --check-account-bundle')
  assert.ok(buildAt > 0 && checkAt > buildAt, [buildAt, checkAt].join(','))
  assert.equal(docker.includes('DSH_REF=dsh-v0.2.1-rc.3'), true)
  assert.equal(docker.includes('tokyo'), false)
})

test('desktop shell items stay outside the retry follow-up', () => {
  const rels = edits.map(([rel]) => rel)
  assert.equal(rels.some(rel => rel.includes('portal') || rel.includes('AccountMenu') || rel.includes('desk-panel')), false)
  assert.match(readFileSync(portal, 'utf8'), /cut 2026-10-30 mobile-more-sidebar-stay AC1b/)
  assert.match(readFileSync(deskClient, 'utf8'), /id: "desk-usage"/)
  assert.match(readFileSync(script, 'utf8'), /AccountMenu is not edited/)
})
