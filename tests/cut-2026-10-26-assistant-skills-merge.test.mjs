// Cut 2026-10-26 assistant-skills-merge (Decision A): one outer sidebar
// entry 「功能与连接」. Skills/connectors stay the panel body. The former
// 「助理」 preset gallery is an in-panel lead-in, not a second outer item
// and not an intro tab. The committed plugin source stays two entries;
// only the Docker image copy is patched.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync, cpSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawnSync } from 'node:child_process'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const script = join(root, 'deploy/docker/dsh-sidebar-assistant-skills-merge.py')
const dockerfile = join(root, 'deploy/docker/Dockerfile')
const relayScript = join(root, 'deploy/docker/dsh-sidebar-relay-login.py')
const navScript = join(root, 'deploy/docker/dsh-sidebar-nav-reorder.py')
const sourceClient = join(root, 'plugin/desk-panel/lib/client.js')
const REL = 'plugin/desk-panel/lib/client.js'
const MARKER = 'cut 2026-10-26 assistant-skills-merge'
const RELAY = 'https://api.cntokenai.top/login'

const scriptSource = readFileSync(script, 'utf8')
const sourceText = readFileSync(sourceClient, 'utf8')

function footerEntries(text) {
  const entries = []
  const re = /name: "sidebar\.footer\.action",\s*id: "([^"]+)",\s*order: (\d+)/g
  let match
  while ((match = re.exec(text))) entries.push([match[1], Number(match[2])])
  return entries
}

function layout(dir, text) {
  const path = join(dir, REL)
  mkdirSync(dirname(path), { recursive: true })
  writeFileSync(path, text)
  return path
}

function run(dir, extraEnv = {}) {
  return spawnSync('python3', [script], {
    env: { ...process.env, ANYWORK_SRC: dir, ...extraEnv },
    encoding: 'utf8',
  })
}

test('committed desk-panel still registers both outer entries', () => {
  assert.match(sourceText, /id: "desk-assistants"/)
  assert.match(sourceText, /id: "desk-skills-conn"/)
  assert.equal(sourceText.includes('功能与连接'), false)
  assert.equal(sourceText.includes(MARKER), false)
  assert.match(sourceText, /"skl\.tab": "技能·连接器"/)
  assert.match(sourceText, /"asst\.tab": "助理"/)
})

test('image copy keeps one outer entry and a skills-panel lead-in', () => {
  const dir = mkdtempSync(join(tmpdir(), 'asst-merge-'))
  cpSync(join(root, 'plugin'), join(dir, 'plugin'), { recursive: true })
  const path = join(dir, REL)
  const first = run(dir)
  assert.equal(first.status, 0, first.stderr)
  const patched = readFileSync(path, 'utf8')
  assert.match(patched, new RegExp(MARKER))
  assert.equal(patched.includes('id: "desk-assistants"'), false)
  assert.equal(patched.split('id: "desk-skills-conn"').length - 1, 1)
  assert.match(patched, /"skl\.tab": "功能与连接"/)
  assert.match(patched, /"skl\.title": "功能与连接"/)
  assert.match(patched, /"skl\.titleShort": "功能与连接"/)
  assert.match(patched, /"skl\.tab": "Features & connectors"/)
  assert.match(patched, /"fn\.lead": "功能介绍"/)
  assert.equal(patched.includes('"skl.tab": "技能·连接器"'), false)
  assert.match(patched, /function assistantsLead\(st\)/)
  assert.match(patched, /assistantsLead\(asst\)/)
  assert.match(patched, /function loadAssist\(\)/)
  assert.match(patched, /fetch\("\/portal\/api\/panel\/presets"/)
  assert.match(patched, /fetch\("\/portal\/api\/panel\/skills"/)
  assert.match(patched, /fetch\("\/portal\/api\/panel\/connectors/)
  assert.match(patched, /tr\("skl\.skills"\)/)
  assert.match(patched, /tr\("skl\.connectors"\)/)
  assert.equal(patched.includes('tab === "intro"'), false)
  assert.equal(patched.includes("tab === 'intro'"), false)
  const leadAt = patched.indexOf('assistantsLead(asst)')
  const tabsAt = patched.indexOf('tab === "skills"')
  assert.ok(leadAt > 0 && tabsAt > leadAt)
  const reg = patched.indexOf('id: "desk-skills-conn"')
  const window = patched.slice(reg, reg + 400)
  assert.match(window, /return tr\("skl\.tab"\)/)
  assert.match(window, /SkillsConnPanel/)
  assert.equal(window.includes('AssistantsPanel'), false)
  const lines = patched.split('\n')
  assert.equal(lines.some((line) => line.trim() === 'AssistantsPanel'), false)
  const before = footerEntries(sourceText)
  const after = footerEntries(patched)
  assert.deepEqual(after, before.filter(([id]) => id !== 'desk-assistants'))
  assert.equal(after.some(([id]) => id === 'desk-assistants'), false)
  assert.equal(after.filter(([id]) => id === 'desk-skills-conn').length, 1)
  for (const id of ['desk-auto', 'desk-agents', 'desk-announce', 'desk-bots', 'desk-hub', 'desk-usage']) {
    assert.deepEqual(after.find((entry) => entry[0] === id), before.find((entry) => entry[0] === id))
  }
  const check = spawnSync('node', ['--check', path], { encoding: 'utf8' })
  assert.equal(check.status, 0, check.stderr)
  assert.equal(readFileSync(sourceClient, 'utf8'), sourceText)
  const second = run(dir)
  assert.equal(second.status, 0, second.stderr)
  assert.match(second.stdout, /skip/)
  assert.equal(readFileSync(path, 'utf8'), patched)
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

test('script has no native-install default path', () => {
  assert.equal(scriptSource.includes('expanduser'), false)
  assert.equal(scriptSource.includes('USERPROFILE'), false)
  assert.equal(scriptSource.includes('AppData'), false)
  assert.equal(scriptSource.includes('~/'), false)
  assert.equal(scriptSource.includes('deploy/windows'), false)
  assert.equal(scriptSource.includes('DSH_SRC'), false)
  const urls = scriptSource.match(/https:\/\/[^\s'")]+/g) || []
  assert.deepEqual(urls, [])
})

test('image build patches the anywork copy and does not bump the engine or move login', () => {
  const docker = readFileSync(dockerfile, 'utf8')
  assert.match(docker, /ARG DSH_REF=dsh-v0\.2\.1-rc\.3/)
  const relayRun = docker.indexOf('python3 /tmp/dsh-sidebar-relay-login.py')
  const navRun = docker.indexOf('python3 /tmp/dsh-sidebar-nav-reorder.py')
  const buildAt = docker.indexOf('RUN pnpm build')
  const copyAt = docker.indexOf('COPY . /opt/anywork')
  const mergeRun = docker.indexOf('ANYWORK_SRC=/opt/anywork python3 /opt/anywork/deploy/docker/dsh-sidebar-assistant-skills-merge.py')
  assert.ok(relayRun > 0 && navRun > relayRun && buildAt > navRun)
  assert.ok(copyAt > buildAt && mergeRun > copyAt)
  assert.match(docker, /curl -fsS http:\/\/127\.0\.0\.1:8080\/healthz/)
  const relay = readFileSync(relayScript, 'utf8')
  assert.match(relay, new RegExp(RELAY.replace(/[.]/g, '\\.')))
  assert.match(relay, /beginSignIn/)
  assert.equal(readFileSync(navScript, 'utf8').includes(MARKER), false)
  assert.equal(relay.includes(MARKER), false)
})

test('missing anchor fails closed', () => {
  const dir = mkdtempSync(join(tmpdir(), 'asst-merge-miss-'))
  const path = layout(dir, 'function SkillsConnPanel(props) {\n')
  const result = run(dir)
  assert.notEqual(result.status, 0)
  assert.match(result.stderr, /anchor count=0/)
  assert.equal(readFileSync(path, 'utf8'), 'function SkillsConnPanel(props) {\n')
  rmSync(dir, { recursive: true, force: true })
})

test('a marker without the merge fails closed', () => {
  const dir = mkdtempSync(join(tmpdir(), 'asst-merge-bad-'))
  const path = layout(dir, `/* ${MARKER} */\nid: "desk-assistants"\n`)
  const result = run(dir)
  assert.notEqual(result.status, 0)
  assert.match(result.stderr, /merge is wrong/)
  assert.match(readFileSync(path, 'utf8'), /desk-assistants/)
  rmSync(dir, { recursive: true, force: true })
})
