// Cut 2026-10-27 presets-template-redesign (Decision B).
// Four cards, alias map, Docker registry patch. Engine modes stay.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync, rmSync, readdirSync, statSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawnSync } from 'node:child_process'
import { renderAll, CARDS, ALIAS } from '../deploy/docker/emit-team-preset-patch.mjs'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const aliasScript = join(root, 'deploy/docker/dsh-preset-alias.py')
const refresh = join(root, 'deploy/docker/refresh-shipped-presets.sh')
const dockerfile = join(root, 'deploy/docker/Dockerfile')
const bootstrap = join(root, 'deploy/docker/bootstrap.sh')
const provision = join(root, 'deploy/docker/member-provision.sh')
const setup = join(root, 'scripts/setup.sh')
const usePath = join(root, 'deploy/docker/dsh-sidebar-assistant-skills-merge.py')
const REGISTRY = 'packages/preset/agent-preset-registry/src/index.ts'

const OLD = [
  'team-assistant',
  'research-assistant',
  'doc-writer',
  'meeting-secretary',
  'data-organizer',
  'dev-partner',
]

function read(rel) {
  return readFileSync(join(root, rel), 'utf8')
}

function row(text, id) {
  const token = `- id: ${id}\n`
  const start = text.indexOf(token)
  assert.ok(start >= 0, id)
  const rest = text.slice(start)
  const next = rest.slice(1).search(/\n(?:    )?- id: /)
  return next < 0 ? rest : rest.slice(0, next + 1)
}

function layoutRegistry(dir) {
  const path = join(dir, REGISTRY)
  mkdirSync(dirname(path), { recursive: true })
  writeFileSync(path, [
    '  /** Default preset for a subsequently created session. */',
    '  get defaultId(): string { return this.config.selectedDefault.get() ?? this.config.default }',
    '',
    '  async resolve(id?: string): Promise<AgentPreset> {',
    '    const wanted = id ?? this.defaultId',
    '    const record = this.definitions.get(wanted)',
    '',
    '  readDocument(agentPreset: string): Promise<AgentPresetDocument> {',
    '    const record = this.definitions.get(agentPreset)',
    '    if (record === undefined) {',
    '      return Promise.reject(new RemoteError(\'agent-preset/not-found\', `Unknown agent preset: ${agentPreset}`,',
    '        { agentPreset, available: [...this.definitions.keys()] }))',
    '    }',
    '',
    '  private async retain(id?: string): Promise<Generation> {',
    '    const wanted = id ?? this.defaultId',
    '',
    '      const current = this.definitions.get(agentPreset)?.generation',
    '      if (current !== undefined && this.generationFor(agent.ctx) === current',
    "        && this.owner.sessionProjections.stateOf(agent.session, 'agentPreset') === agentPreset) return agentPreset",
    '      const preset = await this.recompose(agent.ctx, agentPreset)',
    '',
  ].join('\n'))
  return path
}

test('shipped files match the emitter and the panel directory is four cards', () => {
  const files = renderAll()
  for (const [rel, body] of Object.entries(files)) {
    assert.equal(read(rel), body, rel)
  }
  const dirs = readdirSync(join(root, 'presets-template')).filter((name) => {
    return statSync(join(root, 'presets-template', name)).isDirectory()
  })
  assert.deepEqual(dirs.sort(), CARDS.map((card) => card.id).sort())
  for (const id of OLD) {
    assert.equal(dirs.includes(id), false)
  }
})

test('preset.yml copies the pinned table', () => {
  assert.equal(CARDS.map((card) => card.id).join(','), 'collab-default,research-report,formal-docs,eng-codex')
  for (const card of CARDS) {
    const text = read(`presets-template/${card.id}/preset.yml`)
    assert.match(text, new RegExp(`^name: ${card.name}$`, 'm'))
    assert.match(text, new RegExp(`^description: ${card.description.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'm'))
    assert.match(text, new RegExp(`^order: ${card.order}$`, 'm'))
    assert.match(text, new RegExp(`^defaultHint: ${card.defaultHint}$`, 'm'))
    assert.match(text, new RegExp(`^codex: ${card.codex}$`, 'm'))
    assert.match(text, new RegExp(`^whenToUse: ${card.whenToUse.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'm'))
  }
  assert.equal(CARDS.filter((card) => card.defaultHint).map((card) => card.id).join(','), 'collab-default')
  assert.equal(CARDS.filter((card) => card.codex).map((card) => card.id).join(','), 'eng-codex')
})

test('persona one-liners and shared file tools are on every card', () => {
  for (const card of CARDS) {
    const text = read(`presets-template/${card.id}/agent.cordis.yml`)
    assert.ok(text.includes(card.personaLine), card.id)
    assert.ok(text.includes(card.skillLine), card.id)
    for (const id of ['tool-fs', 'tool-fs-search', 'tool-bash', 'tool-pwsh', 'plan-mode', 'tool-web']) {
      assert.ok(text.includes(`- id: ${id}`), `${card.id} ${id}`)
    }
    const fs = row(text, 'tool-fs')
    const search = row(text, 'tool-fs-search')
    assert.equal(fs.includes('disabled:'), false)
    assert.equal(search.includes('disabled:'), false)
    assert.match(text, /disabled: !!js process\.platform === 'win32'/)
    assert.match(text, /disabled: !!js process\.platform !== 'win32'/)
  }
})

test('research and formal deny ralph, workflow, and codex; eng keeps codex and files', () => {
  for (const id of ['research-report', 'formal-docs']) {
    const text = read(`presets-template/${id}/agent.cordis.yml`)
    assert.match(row(text, 'tool-workflow'), /disabled: true/)
    assert.match(row(text, 'workflow-ptc'), /disabled: true/)
    assert.match(row(text, 'tool-subagent-codex'), /disabled: true/)
    assert.match(text, /Deny tool-ralph/)
    assert.match(text, /workflow-worker-thread/)
    assert.equal(text.includes('- id: tool-ralph'), false)
    assert.equal(text.includes('- id: workflow-worker-thread'), false)
  }
  const collab = read('presets-template/collab-default/agent.cordis.yml')
  assert.match(row(collab, 'tool-subagent-codex'), /disabled: true/)
  assert.equal(row(collab, 'tool-workflow').includes('disabled:'), false)
  assert.equal(row(collab, 'workflow-ptc').includes('disabled:'), false)
  assert.equal(collab.includes('- id: tool-ralph'), false)

  const eng = read('presets-template/eng-codex/agent.cordis.yml')
  const codex = row(eng, 'tool-subagent-codex')
  assert.match(codex, /provider: codex/)
  assert.match(codex, /toolName: subagent_codex/)
  assert.equal(codex.includes('disabled:'), false)
  assert.equal(row(eng, 'tool-workflow').includes('disabled:'), false)
  assert.equal(row(eng, 'workflow-ptc').includes('disabled:'), false)
  assert.equal(eng.includes("name: '@deepseek-ai/dsh-subagent-codex'"), false)
  assert.equal(eng.includes('id: subagent-codex'), false)
  assert.equal(eng.includes('- id: tool-ralph'), false)
})

test('registry patch carries the same four bodies and does not retarget engine modes', () => {
  const patch = read('plugin/dsh-team-presets/cordis.patch.yml')
  for (const card of CARDS) {
    assert.match(patch, new RegExp(`id: ${card.id}`))
    assert.ok(patch.includes(card.description))
    assert.ok(patch.includes(card.personaLine))
    const body = read(`presets-template/${card.id}/agent.cordis.yml`).trimEnd()
    const indented = body.split('\n').map((line) => (line.length ? `          ${line}` : line)).join('\n')
    assert.ok(patch.includes(indented), card.id)
  }
  assert.equal(patch.includes('preset-standard'), false)
  assert.equal(patch.includes('id: standard'), false)
  assert.equal(patch.includes("name: '@deepseek-ai/dsh-subagent-codex'"), false)
})

test('alias map matches the registry patch and leaves standard alone', () => {
  const yml = read('presets-template/alias-map.yml')
  const py = read('deploy/docker/dsh-preset-alias.py')
  assert.deepEqual(ALIAS, {
    'team-assistant': 'collab-default',
    'research-assistant': 'research-report',
    'doc-writer': 'formal-docs',
    'meeting-secretary': 'formal-docs',
    'data-organizer': 'eng-codex',
    'dev-partner': 'eng-codex',
  })
  for (const [from, to] of Object.entries(ALIAS)) {
    assert.match(yml, new RegExp(`^${from}: ${to}$`, 'm'))
    assert.ok(py.includes(`'${from}': '${to}'`))
  }
  assert.equal(yml.includes('standard:'), false)
  assert.equal(py.includes('expanduser'), false)
  assert.equal(py.includes('USERPROFILE'), false)
  assert.equal(py.includes('~/'), false)
})

test('alias patch rewrites registry lookups and is idempotent', () => {
  const dir = mkdtempSync(join(tmpdir(), 'preset-alias-'))
  const path = layoutRegistry(dir)
  const run = () => spawnSync('python3', [aliasScript], {
    env: { ...process.env, DSH_SRC: dir },
    encoding: 'utf8',
  })
  const first = run()
  assert.equal(first.status, 0, first.stderr)
  const patched = readFileSync(path, 'utf8')
  assert.match(patched, /private canonPreset/)
  assert.match(patched, /this\.canonPreset\(id \?\? this\.defaultId\)/)
  assert.match(patched, /this\.canonPreset\(agentPreset\)/)
  assert.match(patched, /definitions\.has\('collab-default'\)/)
  assert.equal(patched.includes('const wanted = id ?? this.defaultId'), false)
  assert.equal(patched.includes('标准模式'), false)
  const second = run()
  assert.equal(second.status, 0, second.stderr)
  assert.match(second.stdout, /skip/)
  assert.equal(readFileSync(path, 'utf8'), patched)
  rmSync(dir, { recursive: true, force: true })
})

test('alias patch refuses to run without DSH_SRC', () => {
  const env = { ...process.env }
  delete env.DSH_SRC
  const result = spawnSync('python3', [aliasScript], { env, encoding: 'utf8' })
  assert.notEqual(result.status, 0)
  assert.match(result.stderr, /DSH_SRC is required/)
})

test('image build applies the alias after the mode hint and before pnpm build', () => {
  const docker = readFileSync(dockerfile, 'utf8')
  assert.match(docker, /ARG DSH_REF=dsh-v0\.2\.1-rc\.3/)
  assert.match(docker, /curl -fsS http:\/\/127\.0\.0\.1:8080\/healthz/)
  const hintRun = docker.indexOf('python3 /tmp/dsh-agent-preset-mode-hint.py')
  const ac1 = docker.indexOf('PRESETS_SRC=/tmp/anywork-presets-template python3 /tmp/dsh-features-connect-ac1.py')
  const aliasCopy = docker.indexOf('COPY deploy/docker/dsh-preset-alias.py')
  const aliasRun = docker.indexOf('python3 /tmp/dsh-preset-alias.py')
  const buildAt = docker.indexOf('RUN pnpm build')
  assert.ok(hintRun > 0 && ac1 > hintRun && aliasCopy > ac1 && aliasRun > aliasCopy && buildAt > aliasRun)
  assert.equal(docker.includes('ANYWORK_SRC=/opt/anywork python3 /opt/anywork/deploy/docker/dsh-preset-alias.py'), false)
})

test('bootstrap and member provision default to collab-default without a second preset plugin', () => {
  const boot = readFileSync(bootstrap, 'utf8')
  const prov = readFileSync(provision, 'utf8')
  for (const text of [boot, prov]) {
    assert.match(text, /default: collab-default/)
    assert.equal(text.includes('default: team-assistant'), false)
    assert.equal(text.includes('file:$repo/plugin/dsh-team-presets'), false)
    assert.match(text, /dsh-agents-md/)
  }
  const use = readFileSync(join(root, 'deploy/docker/dsh-features-connect-use-path.py'), 'utf8')
  assert.match(use, /settings\.update\("agent-preset-registry", \{ selectedDefault: id \}, undefined\)/)
  const native = readFileSync(setup, 'utf8')
  assert.equal(native.includes('dsh-preset-alias'), false)
  assert.equal(native.includes('dsh-team-presets'), false)
  assert.equal(native.includes('refresh-shipped-presets'), false)
  const merge = readFileSync(usePath, 'utf8')
  assert.equal(merge.includes('collab-default'), false)
  assert.equal(merge.includes('presets-template-redesign'), false)
})

test('refresh replaces the six ids, keeps a custom role, and migrates defaults once per stamp', () => {
  const repo = mkdtempSync(join(tmpdir(), 'preset-repo-'))
  const home = mkdtempSync(join(tmpdir(), 'preset-home-'))
  mkdirSync(join(repo, 'presets-template'), { recursive: true })
  for (const card of CARDS) {
    const to = join(repo, 'presets-template', card.id)
    mkdirSync(to, { recursive: true })
    writeFileSync(join(to, 'preset.yml'), read(`presets-template/${card.id}/preset.yml`))
    writeFileSync(join(to, 'agent.cordis.yml'), read(`presets-template/${card.id}/agent.cordis.yml`))
  }
  const presets = join(home, 'desk-data', 'presets')
  for (const id of OLD) mkdirSync(join(presets, id), { recursive: true })
  mkdirSync(join(presets, 'custom-role'), { recursive: true })
  writeFileSync(join(presets, 'team-assistant', 'preset.yml'), 'description: 示例预设，可自改\n')
  writeFileSync(join(presets, 'custom-role', 'preset.yml'), 'name: 自建\n')
  const settings = join(home, 'desk-test', 'boss')
  mkdirSync(settings, { recursive: true })
  writeFileSync(join(settings, 'settings.yaml'), [
    'llm-deepseek:',
    '  baseURL: http://127.0.0.1:8100',
    'agent-presets:',
    '  default: team-assistant',
    'agent-preset-registry:',
    '  selectedDefault: dev-partner',
    '  default: standard',
    'other:',
    '  default: custom-role',
    '',
  ].join('\n'))
  const profile = join(home, 'desk-test', 'boss', 'profiles', 'web')
  mkdirSync(profile, { recursive: true })
  writeFileSync(join(profile, 'settings.yaml'), [
    'agent-preset-registry:',
    '  selectedDefault: data-organizer',
    'agent-presets:',
    '',
  ].join('\n'))

  const first = spawnSync('bash', [refresh, repo, home], { encoding: 'utf8' })
  assert.equal(first.status, 0, first.stderr)
  assert.match(first.stdout, /refreshed/)
  for (const id of OLD) assert.equal(statExists(join(presets, id)), false)
  assert.match(readFileSync(join(presets, 'custom-role', 'preset.yml'), 'utf8'), /自建/)
  assert.match(readFileSync(join(presets, 'collab-default', 'preset.yml'), 'utf8'), /日常协作默认/)
  assert.match(readFileSync(join(presets, 'eng-codex', 'agent.cordis.yml'), 'utf8'), /工程搭档：读仓改功能/)
  const yaml = readFileSync(join(settings, 'settings.yaml'), 'utf8')
  assert.match(yaml, /default: collab-default/)
  assert.match(yaml, /selectedDefault: eng-codex/)
  assert.match(yaml, /default: standard/)
  assert.match(yaml, /default: custom-role/)
  assert.equal(yaml.includes('team-assistant'), false)
  assert.equal(yaml.includes('dev-partner'), false)
  const profileYaml = readFileSync(join(profile, 'settings.yaml'), 'utf8')
  assert.match(profileYaml, /selectedDefault: eng-codex/)
  assert.match(profileYaml, /default: collab-default/)

  writeFileSync(join(presets, 'collab-default', 'preset.yml'), 'description: 成员改过\n')
  const second = spawnSync('bash', [refresh, repo, home], { encoding: 'utf8' })
  assert.equal(second.status, 0, second.stderr)
  assert.match(second.stdout, /skip/)
  assert.match(readFileSync(join(presets, 'collab-default', 'preset.yml'), 'utf8'), /成员改过/)

  writeFileSync(join(home, '.desk', 'presets-cut'), 'older-cut\n')
  const third = spawnSync('bash', [refresh, repo, home], { encoding: 'utf8' })
  assert.equal(third.status, 0, third.stderr)
  assert.match(readFileSync(join(presets, 'collab-default', 'preset.yml'), 'utf8'), /日常协作默认/)
  assert.match(readFileSync(join(presets, 'custom-role', 'preset.yml'), 'utf8'), /自建/)
  rmSync(repo, { recursive: true, force: true })
  rmSync(home, { recursive: true, force: true })
})

function statExists(path) {
  try {
    statSync(path)
    return true
  } catch {
    return false
  }
}

test('refresh script has no Windows default', () => {
  const source = readFileSync(refresh, 'utf8')
  assert.equal(source.includes('USERPROFILE'), false)
  assert.equal(source.includes('AppData'), false)
  assert.equal(source.includes('~/'), false)
})
