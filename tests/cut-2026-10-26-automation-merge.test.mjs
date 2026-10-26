// Cut 2026-10-26 automation-merge (Decision A): the outer sidebar keeps
// 「自动化任务」 from ui-schedule (sidebar.panellist id schedules) and
// drops the parallel 「自动化」 footer entry (desk-auto). The committed
// plugin source stays registered; only the Docker image copy is patched.
// ui-schedule is not edited and the schedules panel is not rebuilt.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync, cpSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawnSync } from 'node:child_process'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const script = join(root, 'deploy/docker/dsh-sidebar-automation-merge.py')
const skillsScript = join(root, 'deploy/docker/dsh-sidebar-assistant-skills-merge.py')
const dockerfile = join(root, 'deploy/docker/Dockerfile')
const relayScript = join(root, 'deploy/docker/dsh-sidebar-relay-login.py')
const navScript = join(root, 'deploy/docker/dsh-sidebar-nav-reorder.py')
const sourceClient = join(root, 'plugin/desk-panel/lib/client.js')
const REL = 'plugin/desk-panel/lib/client.js'
const MARKER = 'cut 2026-10-26 automation-merge'
const SKILLS_MARKER = 'cut 2026-10-26 assistant-skills-merge'
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

function runSkills(dir) {
  return spawnSync('python3', [skillsScript], {
    env: { ...process.env, ANYWORK_SRC: dir },
    encoding: 'utf8',
  })
}

test('committed desk-panel still registers desk-auto as 「自动化」', () => {
  assert.match(sourceText, /id: "desk-auto"/)
  assert.match(sourceText, /"auto\.tab": "自动化"/)
  assert.match(sourceText, /"auto\.tab": "Automation"/)
  assert.equal(sourceText.includes('自动化任务'), false)
  assert.equal(sourceText.includes(MARKER), false)
  assert.equal(sourceText.includes('id: "schedules"'), false)
  assert.equal(sourceText.includes('ui-schedule'), false)
  assert.equal(sourceText.includes('sidebar.panellist'), false)
  const auto = footerEntries(sourceText).find(([id]) => id === 'desk-auto')
  assert.deepEqual(auto, ['desk-auto', 88])
})

test('image copy drops desk-auto and leaves the other footer entries', () => {
  const dir = mkdtempSync(join(tmpdir(), 'auto-merge-'))
  cpSync(join(root, 'plugin'), join(dir, 'plugin'), { recursive: true })
  const path = join(dir, REL)
  const first = run(dir)
  assert.equal(first.status, 0, first.stderr)
  const patched = readFileSync(path, 'utf8')
  assert.match(patched, new RegExp(MARKER))
  assert.equal(patched.includes('id: "desk-auto"'), false)
  assert.equal(patched.split('\n').some((line) => line.trim() === 'AutomationPanel'), false)
  assert.match(patched, /function AutomationPanel\(/)
  assert.match(patched, /"auto\.tab": "自动化"/)
  assert.match(patched, /"auto\.tab": "Automation"/)
  assert.equal(patched.includes('自动化任务'), false)
  assert.equal(patched.includes('id: "schedules"'), false)
  assert.equal(patched.includes('ui-schedule'), false)
  assert.equal(patched.includes('sidebar.panellist'), false)
  assert.match(patched, /id: "desk-assistants"/)
  assert.equal(patched.split('id: "desk-skills-conn"').length - 1, 1)
  const before = footerEntries(sourceText)
  const after = footerEntries(patched)
  assert.deepEqual(after, before.filter(([id]) => id !== 'desk-auto'))
  assert.equal(after.some(([id]) => id === 'desk-auto'), false)
  for (const id of ['desk-assistants', 'desk-skills-conn', 'desk-agents', 'desk-announce', 'desk-bots', 'desk-hub', 'desk-usage']) {
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

test('after assistant-skills-merge, only desk-auto is removed', () => {
  const dir = mkdtempSync(join(tmpdir(), 'auto-merge-after-skills-'))
  cpSync(join(root, 'plugin'), join(dir, 'plugin'), { recursive: true })
  const path = join(dir, REL)
  const skills = runSkills(dir)
  assert.equal(skills.status, 0, skills.stderr)
  const merged = readFileSync(path, 'utf8')
  assert.match(merged, /id: "desk-auto"/)
  assert.match(merged, /功能与连接/)
  const dropped = run(dir)
  assert.equal(dropped.status, 0, dropped.stderr)
  const patched = readFileSync(path, 'utf8')
  assert.match(patched, new RegExp(SKILLS_MARKER))
  assert.match(patched, new RegExp(MARKER))
  assert.equal(patched.includes('id: "desk-assistants"'), false)
  assert.equal(patched.includes('id: "desk-auto"'), false)
  assert.match(patched, /"skl\.tab": "功能与连接"/)
  assert.match(patched, /"auto\.tab": "自动化"/)
  assert.equal(patched.includes('自动化任务'), false)
  assert.equal(patched.includes('id: "schedules"'), false)
  assert.equal(patched.split('id: "desk-skills-conn"').length - 1, 1)
  const window = patched.slice(patched.indexOf('id: "desk-skills-conn"'), patched.indexOf('id: "desk-skills-conn"') + 400)
  assert.match(window, /return tr\("skl\.tab"\)/)
  assert.match(window, /SkillsConnPanel/)
  assert.deepEqual(
    footerEntries(patched),
    footerEntries(sourceText).filter(([id]) => id !== 'desk-assistants' && id !== 'desk-auto'),
  )
  const check = spawnSync('node', ['--check', path], { encoding: 'utf8' })
  assert.equal(check.status, 0, check.stderr)
  const again = run(dir)
  assert.equal(again.status, 0, again.stderr)
  assert.match(again.stdout, /skip/)
  assert.equal(readFileSync(sourceClient, 'utf8'), sourceText)
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
  assert.equal(scriptSource.includes('AccountMenu'), false)
  assert.equal(scriptSource.includes('SidebarRoot'), false)
})

test('image build drops desk-auto after the skills merge and does not bump the engine or move login', () => {
  const docker = readFileSync(dockerfile, 'utf8')
  assert.match(docker, /ARG DSH_REF=dsh-v0\.2\.1-rc\.3/)
  const relayRun = docker.indexOf('python3 /tmp/dsh-sidebar-relay-login.py')
  const navRun = docker.indexOf('python3 /tmp/dsh-sidebar-nav-reorder.py')
  const buildAt = docker.indexOf('RUN pnpm build')
  const copyAt = docker.indexOf('COPY . /opt/anywork')
  const skillsRun = docker.indexOf('ANYWORK_SRC=/opt/anywork python3 /opt/anywork/deploy/docker/dsh-sidebar-assistant-skills-merge.py')
  const autoRun = docker.indexOf('ANYWORK_SRC=/opt/anywork python3 /opt/anywork/deploy/docker/dsh-sidebar-automation-merge.py')
  assert.ok(relayRun > 0 && navRun > relayRun && buildAt > navRun)
  assert.ok(copyAt > buildAt && skillsRun > copyAt && autoRun > skillsRun)
  assert.match(docker, /curl -fsS http:\/\/127\.0\.0\.1:8080\/healthz/)
  const relay = readFileSync(relayScript, 'utf8')
  assert.match(relay, new RegExp(RELAY.replace(/[.]/g, '\\.')))
  assert.match(relay, /beginSignIn/)
  assert.equal(readFileSync(navScript, 'utf8').includes(MARKER), false)
  assert.equal(relay.includes(MARKER), false)
  assert.equal(readFileSync(skillsScript, 'utf8').includes(MARKER), false)
  assert.equal(docker.includes('deploy/windows'), false)
})

test('missing anchor fails closed', () => {
  const dir = mkdtempSync(join(tmpdir(), 'auto-merge-miss-'))
  const path = layout(dir, 'function AutomationPanel(props) {\n')
  const result = run(dir)
  assert.notEqual(result.status, 0)
  assert.match(result.stderr, /anchor count=0/)
  assert.equal(readFileSync(path, 'utf8'), 'function AutomationPanel(props) {\n')
  rmSync(dir, { recursive: true, force: true })
})

test('a marker without the drop fails closed', () => {
  const dir = mkdtempSync(join(tmpdir(), 'auto-merge-bad-'))
  const path = layout(dir, `/* ${MARKER} */\nid: "desk-auto"\n`)
  const result = run(dir)
  assert.notEqual(result.status, 0)
  assert.match(result.stderr, /automation merge is wrong/)
  assert.match(readFileSync(path, 'utf8'), /desk-auto/)
  rmSync(dir, { recursive: true, force: true })
})
