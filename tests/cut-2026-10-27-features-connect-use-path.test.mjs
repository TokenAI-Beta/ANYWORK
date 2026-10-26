// Cut 2026-10-27 features-connect-use-path (Decision A).
// Docker image only: role cards can start a session and set the default,
// the skill list is a short path, and the Codex badge is not the worktree skill.
// The committed plugin stays the gallery. Engine mode copy stays.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync, cpSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawnSync } from 'node:child_process'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const script = join(root, 'deploy/docker/dsh-features-connect-use-path.py')
const mergeScript = join(root, 'deploy/docker/dsh-sidebar-assistant-skills-merge.py')
const dockerfile = join(root, 'deploy/docker/Dockerfile')
const modeHint = join(root, 'deploy/docker/dsh-agent-preset-mode-hint.py')
const sourceClient = join(root, 'plugin/desk-panel/lib/client.js')
const devPartner = join(root, 'presets-template/dev-partner/preset.yml')
const REL = 'plugin/desk-panel/lib/client.js'
const MARKER = 'cut 2026-10-27 features-connect-use-path'
const MERGE = 'cut 2026-10-26 assistant-skills-merge'

const scriptSource = readFileSync(script, 'utf8')
const sourceText = readFileSync(sourceClient, 'utf8')
const modeHintText = readFileSync(modeHint, 'utf8')
const devPartnerText = readFileSync(devPartner, 'utf8')

function run(file, dir) {
  return spawnSync('python3', [file], {
    env: { ...process.env, ANYWORK_SRC: dir },
    encoding: 'utf8',
  })
}

test('committed desk-panel is still the gallery without this cut', () => {
  assert.equal(sourceText.includes(MARKER), false)
  assert.match(sourceText, /id: "desk-assistants"/)
  assert.match(sourceText, /className: "tag" \}, sh\.id/)
  assert.equal(sourceText.includes('用此角色新建会话'), false)
  assert.equal(sourceText.includes('agent-preset-registry'), false)
})

test('image copy adds session, default, skill summary, and Codex copy', () => {
  const dir = mkdtempSync(join(tmpdir(), 'use-path-'))
  cpSync(join(root, 'plugin'), join(dir, 'plugin'), { recursive: true })
  const path = join(dir, REL)
  const merged = run(mergeScript, dir)
  assert.equal(merged.status, 0, merged.stderr)
  const first = run(script, dir)
  assert.equal(first.status, 0, first.stderr)
  const patched = readFileSync(path, 'utf8')
  assert.equal(patched.split(MARKER).length - 1, 1)
  assert.match(patched, /function assistantsLead\(st, act\)/)
  assert.match(patched, /DESK_ROLE = roleAct\(\)/)
  assert.match(patched, /assistantsLead\(asst\)/)
  assert.match(patched, /tr\("asst\.newSession"\)/)
  assert.match(patched, /tr\("asst\.setDefault"\)/)
  assert.match(patched, /"asst\.newSession": "用此角色新建会话"/)
  assert.match(patched, /"asst\.setDefault": "设为默认"/)
  assert.match(patched, /"asst\.newSession": "New session with this role"/)
  assert.match(patched, /"asst\.setDefault": "Set as default"/)
  assert.match(patched, /remote\.settings\.update\("agent-preset-registry", \{ selectedDefault: id \}\)/)
  assert.match(patched, /ns: "agent-preset-registry", patch: \{ selectedDefault: id \}/)
  assert.match(patched, /method: "settings\/update"/)
  assert.match(patched, /method: "agentPresets\/list"/)
  assert.match(patched, /ws\.startSession\(undefined, \{ agentPreset: id \}\)/)
  assert.match(patched, /method: "session\/create"/)
  assert.match(patched, /payload: \{ args: \{ request: \{ agentPreset: id \} \} \}/)
  assert.match(patched, /"asst\.codex": "Codex 并行"/)
  assert.match(patched, /"asst\.codexHelpTitle": "开发搭档用法"/)
  assert.match(patched, /"skl\.codexWorktree": "Codex 并行（worktree）"/)
  assert.match(patched, /"skl\.codexWorktreeWhen":/)
  assert.match(patched, /"skl\.teamReport": "团队报告写作规范"/)
  assert.match(patched, /标准 \/ PTC \/ 极简 \/ 创造/)
  assert.match(patched, /设置 → Agent 预设/)
  assert.equal(patched.includes('className: "tag" }, sh.id'), false)
  assert.match(patched, /function viewSkill\(sh\)/)
  assert.match(patched, /"\/portal\/api\/panel\/skill\?name="/)
  assert.match(patched, /className: "code" \}, det\.content/)
  assert.match(patched, /tr\("fn\.lead"\)/)
  assert.match(patched, /tr\("skl\.skills"\)/)
  assert.match(patched, /tr\("skl\.connectors"\)/)
  assert.equal(patched.includes('id: "desk-assistants"'), false)
  assert.equal(patched.split('id: "desk-skills-conn"').length - 1, 1)
  assert.match(patched, /id: "desk-usage"/)
  assert.match(patched, /settings\.section/)
  assert.equal(patched.includes('presetStandard'), false)
  assert.equal(patched.includes(MERGE), true)
  const check = spawnSync('node', ['--check', path], { encoding: 'utf8' })
  assert.equal(check.status, 0, check.stderr)
  assert.equal(readFileSync(sourceClient, 'utf8'), sourceText)
  const second = run(script, dir)
  assert.equal(second.status, 0, second.stderr)
  assert.match(second.stdout, /skip/)
  assert.equal(readFileSync(path, 'utf8'), patched)
  const again = run(mergeScript, dir)
  assert.equal(again.status, 0, again.stderr)
  assert.match(again.stdout, /skip/)
  rmSync(dir, { recursive: true, force: true })
})

test('refuses to run without ANYWORK_SRC', () => {
  const env = { ...process.env }
  delete env.ANYWORK_SRC
  delete env.DSH_SRC
  const result = spawnSync('python3', [script], { env, encoding: 'utf8' })
  assert.notEqual(result.status, 0)
  assert.match(result.stderr, /ANYWORK_SRC is required/)
})

test('refuses to patch before the assistant/skills merge', () => {
  const dir = mkdtempSync(join(tmpdir(), 'use-path-early-'))
  const path = join(dir, REL)
  mkdirSync(dirname(path), { recursive: true })
  writeFileSync(path, sourceText)
  const result = run(script, dir)
  assert.notEqual(result.status, 0)
  assert.match(result.stderr, /assistant\/skills merge is missing/)
  assert.equal(readFileSync(path, 'utf8'), sourceText)
  rmSync(dir, { recursive: true, force: true })
})

test('script has no native-install default path', () => {
  assert.equal(scriptSource.includes('expanduser'), false)
  assert.equal(scriptSource.includes('USERPROFILE'), false)
  assert.equal(scriptSource.includes('AppData'), false)
  assert.equal(scriptSource.includes('~/'), false)
  assert.equal(scriptSource.includes('deploy/windows'), false)
  assert.equal(scriptSource.includes('DSH_SRC'), false)
  const urls = scriptSource.match(/https:\/\/[^\s'")]+/g) || []
  assert.deepEqual(urls, [])
  assert.match(scriptSource, /ANYWORK_SRC is required/)
})

test('image build wires the patch after the merge and leaves the engine alone', () => {
  const docker = readFileSync(dockerfile, 'utf8')
  assert.match(docker, /ARG DSH_REF=dsh-v0\.2\.1-rc\.3/)
  assert.match(docker, /curl -fsS http:\/\/127\.0\.0\.1:8080\/healthz/)
  const copyAt = docker.indexOf('COPY . /opt/anywork')
  const mergeRun = docker.indexOf('ANYWORK_SRC=/opt/anywork python3 /opt/anywork/deploy/docker/dsh-sidebar-assistant-skills-merge.py')
  const useRun = docker.indexOf('ANYWORK_SRC=/opt/anywork python3 /opt/anywork/deploy/docker/dsh-features-connect-use-path.py')
  const autoRun = docker.indexOf('ANYWORK_SRC=/opt/anywork python3 /opt/anywork/deploy/docker/dsh-sidebar-automation-merge.py')
  assert.ok(copyAt > 0 && mergeRun > copyAt && useRun > mergeRun && autoRun > useRun)
  assert.match(modeHintText, /presetStandardName: '标准模式'/)
  assert.match(modeHintText, /presetPtcName: 'PTC 模式'/)
  assert.match(modeHintText, /presetMinimalName: '极简模式'/)
  assert.match(modeHintText, /presetCordisName: '创造模式'/)
  assert.match(modeHintText, /团队角色在「设置 → Agent 预设」/)
  assert.match(devPartnerText, /codex: true/)
  assert.match(devPartnerText, /开发搭档/)
  assert.equal(scriptSource.includes('presetStandardName'), false)
})

test('a marker without the use path fails closed', () => {
  const dir = mkdtempSync(join(tmpdir(), 'use-path-bad-'))
  const path = join(dir, REL)
  mkdirSync(dirname(path), { recursive: true })
  writeFileSync(path, `/* ${MARKER} */\n`)
  const result = run(script, dir)
  assert.notEqual(result.status, 0)
  assert.match(result.stderr, /use path is wrong/)
  rmSync(dir, { recursive: true, force: true })
})
