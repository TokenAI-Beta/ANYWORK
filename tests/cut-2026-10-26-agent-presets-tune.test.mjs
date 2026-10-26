// Cut 2026-10-26 agent-presets-tune (Decision A).
// Six preset descriptions match the locked table. dev-partner Codex row is
// enabled. The runtime-mode chip gains a hint and does not list the six roles.
// Engine mode names stay. Sidebar / healthz wiring stays.
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
const LOCKED = {
  'team-assistant': '团队日常协作默认角色：中文优先，结论先行，数据标来源与口径；与技能库、知识库、公司盘一起用。',
  'research-assistant': '一手信源调研：结论先行、来源带链接、影响分层（相关方→行业→市场）；交付可核对报告。',
  'doc-writer': '合同、函件、正式报告：公文口吻，金额/日期/编号逐项核对，中英对照复检后出稿。',
  'data-organizer': '表格清洗与报表：先列脏数据清单再动手，统一口径后计算，输出标来源、假设与生成时间。',
  'dev-partner': '读仓库、改功能、走本地验证与提交流程；批量任务可开 Codex 并行（需本机 Codex 可用）。',
  'meeting-secretary': '会议材料整理成纪要：决议 + 待办 + 责任人 + 时间；周报用「一句话 + 要点清单」。',
}
const TOOLS = [
  'tool-bash', 'tool-pwsh', 'tool-fs', 'tool-fs-search', 'tool-jobs', 'tool-skill',
  'tool-goal', 'tool-result-pruner', 'tool-subagent-control', 'tool-subagent-list-agents',
  'tool-subagent', 'tool-subagent-fork', 'tool-subagent-codex', 'tool-workflow',
  'tool-ralph', 'tool-ask-user', 'tool-todo', 'tool-web',
]

function presetText(id, name) {
  return readFileSync(join(root, 'presets-template', id, name), 'utf8')
}

function toolIds(text) {
  return [...text.matchAll(/- id: (tool-[a-z0-9-]+)/g)].map(match => match[1])
}

function codexRow(text) {
  const start = text.indexOf('- id: tool-subagent-codex')
  assert.ok(start >= 0)
  const rest = text.slice(start)
  const next = rest.indexOf('\n    - id:', 1)
  assert.ok(next > 0)
  return rest.slice(0, next)
}

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

test('six descriptions match the locked table', () => {
  for (const id of IDS) {
    const text = presetText(id, 'preset.yml')
    assert.match(text, new RegExp(`^description: ${LOCKED[id].replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'm'))
  }
  assert.equal(presetText('team-assistant', 'preset.yml').includes('示例预设'), false)
  assert.match(presetText('team-assistant', 'preset.yml'), /defaultHint: true/)
  assert.match(presetText('meeting-secretary', 'preset.yml'), /周报用「一句话 \+ 要点清单」/)
  assert.match(presetText('dev-partner', 'preset.yml'), /^codex: true$/m)
})

test('persona prefixes follow the role and the tool rows stay', () => {
  const team = presetText('team-assistant', 'agent.cordis.yml')
  assert.match(team, /团队助理/)
  assert.match(team, /技能库、知识库、公司盘/)
  assert.equal(team.includes('示例预设'), false)
  assert.match(presetText('research-assistant', 'agent.cordis.yml'), /相关方 → 行业 → 市场/)
  assert.match(presetText('doc-writer', 'agent.cordis.yml'), /金额、日期、编号逐项核对/)
  assert.match(presetText('data-organizer', 'agent.cordis.yml'), /先列脏数据清单再动手/)
  assert.match(presetText('dev-partner', 'agent.cordis.yml'), /需本机 Codex 可用/)
  assert.match(presetText('meeting-secretary', 'agent.cordis.yml'), /周报用「一句话 \+ 要点清单」/)
  const lists = IDS.map(id => toolIds(presetText(id, 'agent.cordis.yml')))
  for (const list of lists) assert.deepEqual(list, TOOLS)
})

test('dev-partner Codex row is enabled and the other roles stay disabled', () => {
  const dev = codexRow(presetText('dev-partner', 'agent.cordis.yml'))
  assert.match(dev, /provider: codex/)
  assert.match(dev, /toolName: subagent_codex/)
  assert.equal(dev.includes('disabled:'), false)
  for (const id of IDS.filter(item => item !== 'dev-partner')) {
    const row = codexRow(presetText(id, 'agent.cordis.yml'))
    assert.match(row, /disabled: true/)
    assert.match(row, /provider: codex/)
  }
})

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

test('bootstrap refreshes the six shipped presets once per stamp', () => {
  const boot = readFileSync(bootstrap, 'utf8')
  assert.match(boot, /cp -rn "\$repo\/presets-template\/\." "\$home\/desk-data\/presets\/"/)
  assert.match(boot, /refresh-shipped-presets\.sh/)
  assert.match(boot, /dsh-chat-import@0\.26\.2/)
  assert.match(boot, /default: team-assistant/)
  const repo = mkdtempSync(join(tmpdir(), 'preset-repo-'))
  const home = mkdtempSync(join(tmpdir(), 'preset-home-'))
  mkdirSync(join(repo, 'presets-template'), { recursive: true })
  for (const id of IDS) {
    const from = join(root, 'presets-template', id)
    const to = join(repo, 'presets-template', id)
    mkdirSync(to, { recursive: true })
    writeFileSync(join(to, 'preset.yml'), readFileSync(join(from, 'preset.yml')))
    writeFileSync(join(to, 'agent.cordis.yml'), readFileSync(join(from, 'agent.cordis.yml')))
  }
  const old = join(home, 'desk-data', 'presets')
  mkdirSync(join(old, 'team-assistant'), { recursive: true })
  mkdirSync(join(old, 'dev-partner'), { recursive: true })
  mkdirSync(join(old, 'custom-role'), { recursive: true })
  writeFileSync(join(old, 'team-assistant', 'preset.yml'), 'description: 示例预设，可自改\n')
  writeFileSync(join(old, 'team-assistant', 'agent.cordis.yml'), 'old persona\n')
  writeFileSync(join(old, 'dev-partner', 'preset.yml'), 'codex: true\n')
  writeFileSync(join(old, 'dev-partner', 'agent.cordis.yml'), 'disabled: true\n')
  writeFileSync(join(old, 'custom-role', 'preset.yml'), 'name: 自建\n')
  const first = spawnSync('bash', [refresh, repo, home], { encoding: 'utf8' })
  assert.equal(first.status, 0, first.stderr)
  assert.match(first.stdout, /refreshed/)
  assert.equal(readFileSync(join(old, 'team-assistant', 'preset.yml'), 'utf8').includes('示例预设'), false)
  assert.match(readFileSync(join(old, 'team-assistant', 'preset.yml'), 'utf8'), /团队日常协作默认角色/)
  assert.equal(codexRow(readFileSync(join(old, 'dev-partner', 'agent.cordis.yml'), 'utf8')).includes('disabled:'), false)
  assert.match(readFileSync(join(old, 'custom-role', 'preset.yml'), 'utf8'), /自建/)
  writeFileSync(join(old, 'team-assistant', 'preset.yml'), 'description: 成员改过\n')
  const second = spawnSync('bash', [refresh, repo, home], { encoding: 'utf8' })
  assert.equal(second.status, 0, second.stderr)
  assert.match(second.stdout, /skip/)
  assert.match(readFileSync(join(old, 'team-assistant', 'preset.yml'), 'utf8'), /成员改过/)
  writeFileSync(join(home, '.desk', 'presets-cut'), 'older-cut\n')
  const third = spawnSync('bash', [refresh, repo, home], { encoding: 'utf8' })
  assert.equal(third.status, 0, third.stderr)
  assert.match(readFileSync(join(old, 'team-assistant', 'preset.yml'), 'utf8'), /团队日常协作默认角色/)
  assert.match(readFileSync(join(old, 'custom-role', 'preset.yml'), 'utf8'), /自建/)
  rmSync(repo, { recursive: true, force: true })
  rmSync(home, { recursive: true, force: true })
})

test('refresh script has no Windows default', () => {
  const source = readFileSync(refresh, 'utf8')
  assert.equal(source.includes('USERPROFILE'), false)
  assert.equal(source.includes('AppData'), false)
  assert.equal(source.includes('~/'), false)
})
