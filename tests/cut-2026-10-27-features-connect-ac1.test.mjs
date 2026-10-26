// Cut 2026-10-27 features-connect-use-path AC1 fix.
// Portal role ids become registry rows. The mode chip stays the four shipped presets.
// The settings.update call passes the third argument the client proxy requires.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync, cpSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawnSync } from 'node:child_process'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const script = join(root, 'deploy/docker/dsh-features-connect-ac1.py')
const usePath = join(root, 'deploy/docker/dsh-features-connect-use-path.py')
const dockerfile = join(root, 'deploy/docker/Dockerfile')
const presets = join(root, 'presets-template')
const ROLES = [
  'team-assistant',
  'research-assistant',
  'doc-writer',
  'data-organizer',
  'dev-partner',
  'meeting-secretary',
]

const STANDARD = `# Agent preset standard
- insert:
    - id: preset-standard
      name: '@deepseek-ai/dsh-agent-preset'
      config:
        id: standard
        order: 1
        plugins:
          - id: persona
            name: '@deepseek-ai/dsh-persona'
            config:
              prefix: You are a coding agent powered by the {{model}} model.
              - id: tool-subagent-fork
                name: '@deepseek-ai/dsh-tool-subagent'
                config:
                  provider: fork
                  toolName: subagent_fork
              - id: workflow-ptc
                name: '@deepseek-ai/dsh-workflow-ptc'
`

const PKG = `{
  "name": "@deepseek-ai/dsh-web-app",
  "files": [
    "presets/standard.patch.yml",
    "presets/ptc.patch.yml",
    "presets/minimal.patch.yml",
    "presets/cordis.patch.yml",
    "lib/public-url-*.js"
  ],
  "dsh": {
    "bundle": {
      "patch": [
        "./cordis.patch.yml",
        "./presets/standard.patch.yml",
        "./presets/ptc.patch.yml",
        "./presets/minimal.patch.yml",
        "./presets/cordis.patch.yml"
      ]
    }
  }
}
`

const SEAT = `import { presetDisplayText } from './locales.ts'
import { requiresCodingTools } from './settings-store.ts'
export function Seat() {
  const options = useMemo(
    () => state.options.filter(option => developerTools || !requiresCodingTools(option)),
    [state.options, developerTools],
  )
  return options
}
`

function layout(dir) {
  const web = join(dir, 'packages/bundle/web-app')
  mkdirSync(join(web, 'presets'), { recursive: true })
  writeFileSync(join(web, 'presets/standard.patch.yml'), STANDARD)
  writeFileSync(join(web, 'presets/ptc.patch.yml'), 'id: ptc\norder: 2\n')
  writeFileSync(join(web, 'package.json'), PKG)
  const seatDir = join(dir, 'packages/client/ui-agent-preset/src/client')
  mkdirSync(seatDir, { recursive: true })
  writeFileSync(join(seatDir, 'AgentPresetSeat.tsx'), SEAT)
}

function run(dir, extra = {}) {
  return spawnSync('python3', [script], {
    env: { ...process.env, DSH_SRC: dir, PRESETS_SRC: presets, ...extra },
    encoding: 'utf8',
  })
}

test('registers the six portal ids and leaves the four engine rows alone', () => {
  const dir = mkdtempSync(join(tmpdir(), 'ac1-'))
  layout(dir)
  const standardPath = join(dir, 'packages/bundle/web-app/presets/standard.patch.yml')
  const before = readFileSync(standardPath, 'utf8')
  const first = run(dir)
  assert.equal(first.status, 0, first.stderr)
  assert.equal(readFileSync(standardPath, 'utf8'), before)
  assert.equal(readFileSync(join(dir, 'packages/bundle/web-app/presets/ptc.patch.yml'), 'utf8'), 'id: ptc\norder: 2\n')
  const pkg = JSON.parse(readFileSync(join(dir, 'packages/bundle/web-app/package.json'), 'utf8'))
  const patches = pkg.dsh.bundle.patch
  for (const role of ROLES) {
    assert.ok(patches.includes(`./presets/${role}.patch.yml`))
    assert.ok(pkg.files.includes(`presets/${role}.patch.yml`))
    const body = readFileSync(join(dir, 'packages/bundle/web-app/presets', `${role}.patch.yml`), 'utf8')
    assert.match(body, new RegExp(`id: preset-${role}\\n`))
    assert.match(body, new RegExp(`\\n        id: ${role}\\n`))
    assert.equal(body.includes('id: standard\n'), false)
    assert.equal(body.includes('id: preset-standard'), false)
    assert.match(body, /prefix: \|/)
  }
  const dev = readFileSync(join(dir, 'packages/bundle/web-app/presets/dev-partner.patch.yml'), 'utf8')
  assert.match(dev, /"开发搭档"/)
  assert.match(dev, /你是 DSH-ANYWORK 团队工作台的开发搭档/)
  assert.match(dev, /toolName: subagent_codex/)
  const team = readFileSync(join(dir, 'packages/bundle/web-app/presets/team-assistant.patch.yml'), 'utf8')
  assert.match(team, /"团队助理"/)
  assert.equal(team.includes('subagent_codex'), false)
  const seat = readFileSync(join(dir, 'packages/client/ui-agent-preset/src/client/AgentPresetSeat.tsx'), 'utf8')
  assert.match(seat, /isBuiltInPreset\(option\)/)
  assert.match(seat, /import \{ isBuiltInPreset, presetDisplayText \}/)
  for (const role of ROLES) assert.equal(seat.includes(role), false)
  assert.equal(seat.includes('presetStandardName'), false)
  const second = run(dir)
  assert.equal(second.status, 0, second.stderr)
  assert.match(second.stdout, /skip/)
  assert.equal(readFileSync(standardPath, 'utf8'), before)
  rmSync(dir, { recursive: true, force: true })
})

test('refuses to run without DSH_SRC and PRESETS_SRC', () => {
  const env = { ...process.env }
  delete env.DSH_SRC
  delete env.PRESETS_SRC
  delete env.ANYWORK_SRC
  const result = spawnSync('python3', [script], { env, encoding: 'utf8' })
  assert.notEqual(result.status, 0)
  assert.match(result.stderr, /DSH_SRC and PRESETS_SRC are required/)
})

test('fails closed when the standard preset anchor moved', () => {
  const dir = mkdtempSync(join(tmpdir(), 'ac1-bad-'))
  layout(dir)
  writeFileSync(join(dir, 'packages/bundle/web-app/presets/standard.patch.yml'), 'id: other\n')
  const result = run(dir)
  assert.notEqual(result.status, 0)
  assert.match(result.stderr, /anchor count=/)
  rmSync(dir, { recursive: true, force: true })
})

test('image build registers roles before the client bundle and keeps the third settings argument', () => {
  const docker = readFileSync(dockerfile, 'utf8')
  const hint = docker.indexOf('python3 /tmp/dsh-agent-preset-mode-hint.py')
  const ac1 = docker.indexOf('PRESETS_SRC=/tmp/anywork-presets-template python3 /tmp/dsh-features-connect-ac1.py')
  const build = docker.indexOf('RUN pnpm build')
  assert.ok(hint > 0 && ac1 > hint && build > ac1)
  assert.match(docker, /ARG DSH_REF=dsh-v0\.2\.1-rc\.3/)
  const use = readFileSync(usePath, 'utf8')
  assert.match(use, /settings\.update\("agent-preset-registry", \{ selectedDefault: id \}, undefined\)/)
  assert.equal(use.includes('expanduser'), false)
  const source = readFileSync(script, 'utf8')
  assert.equal(source.includes('expanduser'), false)
  assert.equal(source.includes('USERPROFILE'), false)
  assert.equal(source.includes('~/'), false)
  assert.equal(source.includes('presets-template-redesign'), false)
})

test('presets-template role files are still the source of the persona text', () => {
  const dev = readFileSync(join(presets, 'dev-partner/preset.yml'), 'utf8')
  const agent = readFileSync(join(presets, 'dev-partner/agent.cordis.yml'), 'utf8')
  assert.match(dev, /^name: 开发搭档$/m)
  assert.match(dev, /^codex: true$/m)
  assert.match(agent, /prefix: >-/)
  assert.match(agent, /开发搭档/)
  assert.equal(readFileSync(script, 'utf8').includes('cp -r'), false)
})
