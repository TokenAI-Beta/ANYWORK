// Cut 2026-10-26 agent-presets-tune (Decision A).
// The runtime-mode chip gains a hint and does not list team-role ids.
// Engine mode names stay. The four-card templates live in the 2026-10-27 test.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawnSync } from 'node:child_process'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const script = join(root, 'deploy/docker/dsh-agent-preset-mode-hint.py')
const refresh = join(root, 'deploy/docker/refresh-shipped-presets.sh')
const dockerfile = join(root, 'deploy/docker/Dockerfile')
const bootstrap = join(root, 'deploy/docker/bootstrap.sh')
const moreScript = join(root, 'deploy/docker/dsh-sidebar-more-to-plugins.py')

const SEAT = 'packages/client/ui-agent-preset/src/client/AgentPresetSeat.tsx'
const LOCALES = 'packages/client/ui-agent-preset/src/client/locales.ts'
const CSS = 'packages/client/ui-agent-preset/src/client/AgentPresetSeat.module.css'
const MARKER = 'cut 2026-10-26 agent-presets-tune'
const ZH = '团队角色在「设置 → Agent 预设」，与标准 / PTC / 极简 / 创造不是同一层。'
const IDS = [
  'team-assistant',
  'research-assistant',
  'doc-writer',
  'data-organizer',
  'dev-partner',
  'meeting-secretary',
]
function layout(dir) {
  const seat = join(dir, SEAT)
  const locales = join(dir, LOCALES)
  const css = join(dir, CSS)
  mkdirSync(dirname(seat), { recursive: true })
  mkdirSync(dirname(locales), { recursive: true })
  mkdirSync(dirname(css), { recursive: true })
  writeFileSync(seat, [
    'items={options.map((option) => {',
    '  return { id: option.id }',
    '})}',
    '      />}',
    '      {toast !== null && (',
    '        <Toast',
    '          key={toast.seq}',
    "          text={t('switchRefused', { name: presetDisplayText(toast.error.preset, t).name, reason: toast.error.reason })}",
    '',
  ].join('\n'))
  writeFileSync(locales, [
    "presetStandardName: '标准模式',",
    "presetPtcName: 'PTC 模式',",
    "presetMinimalName: '极简模式',",
    "presetCordisName: '创造模式',",
    "  | 'seatHint'",
    "  | 'headerHint'",
    "  seatHint: 'Choose the agent preset for your new task',",
    "  headerHint: 'The agent preset chosen when this task started',",
    "  seatHint: '选择新任务使用的 Agent 预设',",
    "  headerHint: '本任务的 Agent 预设，在任务开始时确定',",
    '',
  ].join('\n'))
  writeFileSync(css, [
    '.itemDesc {',
    '  font-size: 12px;',
    '  line-height: 16px;',
    '  color: var(--dsw-alias-label-caption);',
    '  white-space: normal;',
    '}',
    '',
  ].join('\n'))
  return { seat, locales, css }
}

function run(dir) {
  return spawnSync('python3', [script], {
    env: { ...process.env, DSH_SRC: dir },
    encoding: 'utf8',
  })
}

test('mode hint sits beside the chip and leaves the four engine modes', () => {
  const dir = mkdtempSync(join(tmpdir(), 'preset-hint-'))
  const paths = layout(dir)
  const first = run(dir)
  assert.equal(first.status, 0, first.stderr)
  const seat = readFileSync(paths.seat, 'utf8')
  const locales = readFileSync(paths.locales, 'utf8')
  const css = readFileSync(paths.css, 'utf8')
  assert.match(seat, /css\.teamHint/)
  assert.match(seat, /t\('teamRolesHint'\)/)
  assert.match(seat, /options\.map/)
  assert.match(locales, new RegExp(ZH.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')))
  assert.match(locales, /Team roles are under Settings → Agent presets/)
  assert.match(locales, /presetStandardName: '标准模式'/)
  assert.match(locales, /presetPtcName: 'PTC 模式'/)
  assert.match(locales, /presetMinimalName: '极简模式'/)
  assert.match(locales, /presetCordisName: '创造模式'/)
  assert.match(css, new RegExp(MARKER))
  assert.match(css, /\.teamHint/)
  for (const id of IDS) assert.equal(seat.includes(id), false)
  const second = run(dir)
  assert.equal(second.status, 0, second.stderr)
  assert.match(second.stdout, /skip/)
  assert.equal(readFileSync(paths.seat, 'utf8'), seat)
  rmSync(dir, { recursive: true, force: true })
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

test('image build applies the hint after more-to-plugins and before pnpm build', () => {
  const docker = readFileSync(dockerfile, 'utf8')
  assert.match(docker, /ARG DSH_REF=dsh-v0\.2\.1-rc\.3/)
  assert.match(docker, /curl -fsS http:\/\/127\.0\.0\.1:8080\/healthz/)
  const moreRun = docker.indexOf('python3 /tmp/dsh-sidebar-more-to-plugins.py')
  const hintCopy = docker.indexOf('COPY deploy/docker/dsh-agent-preset-mode-hint.py')
  const hintRun = docker.indexOf('python3 /tmp/dsh-agent-preset-mode-hint.py')
  const buildAt = docker.indexOf('RUN pnpm build')
  assert.ok(moreRun > 0 && hintCopy > moreRun && hintRun > hintCopy && buildAt > hintRun)
  assert.equal(docker.includes('ANYWORK_SRC=/opt/anywork python3 /opt/anywork/deploy/docker/dsh-agent-preset-mode-hint.py'), false)
  assert.match(readFileSync(moreScript, 'utf8'), /cut 2026-10-26 sidebar-more-to-plugins/)
})

test('bootstrap still refreshes shipped presets and keeps chat-import pinned', () => {
  const boot = readFileSync(bootstrap, 'utf8')
  assert.match(boot, /cp -rn "\$repo\/presets-template\/\." "\$home\/desk-data\/presets\/"/)
  assert.match(boot, /refresh-shipped-presets\.sh/)
  assert.match(boot, /dsh-chat-import@0\.26\.2/)
  assert.match(boot, /default: collab-default/)
  assert.equal(boot.includes('default: team-assistant'), false)
})

test('refresh script has no Windows default', () => {
  const source = readFileSync(refresh, 'utf8')
  assert.equal(source.includes('USERPROFILE'), false)
  assert.equal(source.includes('AppData'), false)
  assert.equal(source.includes('~/'), false)
})
