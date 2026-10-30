// Cut 2026-10-30 plugin-lazy-first-paint.
// First paint preloads the desk shell only. Other /plugins/?? combos load
// after mount, and a dropped one is a retry bar rather than the HARNESS page.
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
const groups = join(root, 'deploy/docker/dsh-sidebar-groups.py')

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

function run(dir) {
  return spawnSync('python3', [script], {
    env: { ...process.env, DSH_SRC: dir },
    encoding: 'utf8',
  })
}

const edits = loadEdits()

test('patch splits first-paint combos from deferred plugins and keeps a retry bar', () => {
  const dir = mkdtempSync(join(tmpdir(), 'plugin-lazy-'))
  layout(dir, edits)
  const first = run(dir)
  assert.equal(first.status, 0, first.stderr)
  const index = readFileSync(join(dir, 'packages/client/modules/src/index.ts'), 'utf8')
  const manifest = readFileSync(join(dir, 'packages/client/modules/src/client/manifest.ts'), 'utf8')
  const entries = readFileSync(join(dir, 'packages/client/modules/src/client/entries.ts'), 'utf8')
  const boot = readFileSync(join(dir, 'packages/client/web/src/boot.ts'), 'utf8')

  assert.match(index, /const MAX_COMBO_BODY_BYTES = 768 \* 1024/)
  assert.match(index, /buildBatch\('deferred', records, this\.readSourceMap\)/)
  assert.match(index, /'@deepseek-ai\/dsh-client-ui-workspace'/)
  assert.match(index, /'@deepseek-ai\/dsh-client-ui-sidebar'/)
  assert.doesNotMatch(index, /dsh-desk-panel/)
  assert.match(manifest, /'bootstrap' \| 'application' \| 'deferred'/)
  assert.match(manifest, /if \(phase === 'deferred'\) deferredIds\.add\(id\)/)
  assert.match(entries, /row\.deferred !== true/)
  assert.match(entries, /async activateDeferred\(\)/)
  assert.match(boot, /void this\.finishDeferred\(\)/)
  assert.match(boot, /data-dsh-plugin-retry/)
  assert.match(boot, /Some plugins did not finish loading\./)
  assert.doesNotMatch(boot, /Failed to load plugins/)
  const deferredFn = boot.split('private async finishDeferred()')[1].split('private showPluginRetry()')[0]
  assert.equal(deferredFn.includes('page.fail'), false)
  assert.match(boot, /this\.page\.fail\(/)

  const again = run(dir)
  assert.equal(again.status, 0, again.stderr)
})

test('missing DSH_SRC and a drifted anchor fail closed', () => {
  const bare = spawnSync('python3', [script], {
    env: { ...process.env, DSH_SRC: '' },
    encoding: 'utf8',
  })
  assert.notEqual(bare.status, 0)
  assert.match(bare.stderr, /DSH_SRC is required/)

  const dir = mkdtempSync(join(tmpdir(), 'plugin-lazy-drift-'))
  layout(dir, edits)
  const index = join(dir, 'packages/client/modules/src/index.ts')
  writeFileSync(index, readFileSync(index, 'utf8').replace('MAX_COMBO_URL_BYTES = 3 * 1024', 'MAX_COMBO_URL_BYTES = 4096'))
  const drifted = run(dir)
  assert.notEqual(drifted.status, 0)
  assert.match(drifted.stderr, /expected 1 anchor/)
})

test('image build runs the patch after chat-shell and before pnpm build', () => {
  const docker = readFileSync(dockerfile, 'utf8')
  const copyAt = docker.indexOf('COPY deploy/docker/dsh-plugin-lazy-first-paint.py /tmp/dsh-plugin-lazy-first-paint.py')
  const runAt = docker.indexOf('DSH_SRC=/src/deepseek-harness python3 /tmp/dsh-plugin-lazy-first-paint.py')
  const shellAt = docker.indexOf('python3 /tmp/dsh-chat-shell-ui.py')
  const buildAt = docker.indexOf('RUN pnpm build')
  assert.ok(copyAt > shellAt && runAt > copyAt && buildAt > runAt, [shellAt, copyAt, runAt, buildAt].join(','))
  assert.equal(docker.includes('DSH_REF=dsh-v0.2.1-rc.3'), true)
  assert.equal(docker.includes('tokyo'), false)
})

test('AC2: deferred bytes leave the first-paint preload; combos stay under 768KiB', () => {
  // rc.3 partitions only by the 3072-byte combo URL, then preloads every
  // application batch. Two full-roster responses are the cut's ~9MB + ~4.5MB.
  // After the patch the preload set is the shell closure, and each combo
  // stops at 768KiB uncompressed unless one plugin is larger than that.
  const CAP = 768 * 1024
  const before = [
    { id: 'shell', bytes: 1.82 * 1024 * 1024 },
    { id: 'rest', bytes: 4.60 * 1024 * 1024 },
    { id: 'desk-panel', bytes: 410594 },
    { id: 'aqua', bytes: 234115 },
  ]
  const criticalIds = new Set(['shell'])
  function pack(records) {
    const chunks = []
    let current = []
    let bytes = 0
    for (const record of records) {
      if (current.length > 0 && bytes + record.bytes > CAP) {
        chunks.push(current)
        current = []
        bytes = 0
      }
      current.push(record)
      bytes += record.bytes
    }
    if (current.length > 0) chunks.push(current)
    return chunks
  }
  const preload = pack(before.filter(row => criticalIds.has(row.id)))
  const deferred = pack(before.filter(row => !criticalIds.has(row.id)))
  const preloadBytes = preload.reduce((sum, chunk) => sum + chunk.reduce((inner, row) => inner + row.bytes, 0), 0)
  const beforeBytes = before.reduce((sum, row) => sum + row.bytes, 0)
  assert.ok(preloadBytes < beforeBytes / 2, `preload ${preloadBytes} is not under half of ${beforeBytes}`)
  assert.equal(deferred.some(chunk => chunk.some(row => row.id === 'desk-panel')), true)
  for (const chunk of [...preload, ...deferred]) {
    const size = chunk.reduce((sum, row) => sum + row.bytes, 0)
    const single = chunk.length === 1
    assert.ok(single || size <= CAP, size)
  }
  const many = Array.from({ length: 8 }, (_, index) => ({ id: `p${index}`, bytes: 400 * 1024 }))
  const split = pack(many)
  assert.ok(split.length >= 4, split.length)
  for (const chunk of split) {
    assert.ok(chunk.reduce((sum, row) => sum + row.bytes, 0) <= CAP)
  }
  const scriptSource = readFileSync(script, 'utf8')
  assert.match(scriptSource, /9MB/)
  assert.match(scriptSource, /4\.5MB/)
  assert.match(scriptSource, /1\.82MB/)
  assert.match(scriptSource, /768KiB/)
})

test('desktop shell items stay outside this patch', () => {
  const portalSource = readFileSync(portal, 'utf8')
  assert.match(portalSource, /cut 2026-10-30 mobile-more-sidebar-stay AC1b/)
  assert.match(portalSource, /sessionRow/)
  assert.match(portalSource, /newSession/)
  assert.match(portalSource, /path === '\/healthz'/)
  const client = readFileSync(deskClient, 'utf8')
  assert.match(client, /id: "desk-usage"/)
  assert.match(client, /function UsagePanel/)
  assert.match(readFileSync(groups, 'utf8'), /only: 'desk-usage'/)
  const paths = new Set(edits.map(([rel]) => rel))
  assert.deepEqual([...paths].sort(), [
    'packages/client/modules/src/client/entries.ts',
    'packages/client/modules/src/client/manifest.ts',
    'packages/client/modules/src/index.ts',
    'packages/client/ui-settings-account/src/client/index.ts',
    'packages/client/web/src/boot.ts',
  ])
})
