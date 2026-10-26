// Cut 2026-10-26 bots-subagents-merge (Decision A): one outer sidebar
// entry 「机器人」. Bot list / rooms / bot-chat stay the panel body. The
// former 「子代理」 console is an in-panel lead-in (intro sentence, then
// 工作动态 / 定义管理), not a second outer item. The committed plugin
// source stays two entries; only the Docker image copy is patched.
// Three-card only/except lists from #16 are not edited.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync, cpSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawnSync } from 'node:child_process'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const script = join(root, 'deploy/docker/dsh-sidebar-bots-subagents-merge.py')
const skillsScript = join(root, 'deploy/docker/dsh-sidebar-assistant-skills-merge.py')
const autoScript = join(root, 'deploy/docker/dsh-sidebar-automation-merge.py')
const groupsScript = join(root, 'deploy/docker/dsh-sidebar-groups.py')
const dockerfile = join(root, 'deploy/docker/Dockerfile')
const relayScript = join(root, 'deploy/docker/dsh-sidebar-relay-login.py')
const navScript = join(root, 'deploy/docker/dsh-sidebar-nav-reorder.py')
const sourceClient = join(root, 'plugin/desk-panel/lib/client.js')
const REL = 'plugin/desk-panel/lib/client.js'
const MARKER = 'cut 2026-10-26 bots-subagents-merge'
const SKILLS_MARKER = 'cut 2026-10-26 assistant-skills-merge'
const AUTO_MARKER = 'cut 2026-10-26 automation-merge'
const GROUPS_MARKER = 'cut 2026-10-26 sidebar-ui-refresh'
const RELAY = 'https://api.cntokenai.top/login'
const EXCEPT = "except: ['desk-skills-conn', 'chat-import', 'desk-usage']"

const scriptSource = readFileSync(script, 'utf8')
const sourceText = readFileSync(sourceClient, 'utf8')
const groupsSource = readFileSync(groupsScript, 'utf8')

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

function runPy(file, dir) {
  return spawnSync('python3', [file], {
    env: { ...process.env, ANYWORK_SRC: dir },
    encoding: 'utf8',
  })
}

test('committed desk-panel still registers both outer entries', () => {
  assert.match(sourceText, /id: "desk-agents"/)
  assert.match(sourceText, /id: "desk-bots"/)
  assert.match(sourceText, /"agt\.tab": "子代理"/)
  assert.match(sourceText, /return "Bots"/)
  assert.equal(sourceText.includes('"bts.tab": "机器人"'), false)
  assert.equal(sourceText.includes(MARKER), false)
  assert.deepEqual(
    footerEntries(sourceText).filter(([id]) => id === 'desk-agents' || id === 'desk-bots'),
    [['desk-agents', 89], ['desk-bots', 90]],
  )
})

test('AC1 and AC2: image copy keeps one outer entry and both lists', () => {
  const dir = mkdtempSync(join(tmpdir(), 'bots-merge-'))
  cpSync(join(root, 'plugin'), join(dir, 'plugin'), { recursive: true })
  const path = join(dir, REL)
  const first = run(dir)
  assert.equal(first.status, 0, first.stderr)
  const patched = readFileSync(path, 'utf8')
  assert.match(patched, new RegExp(MARKER))

  // AC1 — outer sidebar is one entry labeled 机器人. The split pair is gone.
  assert.equal(patched.includes('id: "desk-agents"'), false)
  assert.equal(patched.split('id: "desk-bots"').length - 1, 1)
  assert.equal(patched.includes('return "Bots"'), false)
  assert.equal(patched.includes('title: "Bots"'), false)
  assert.equal(patched.includes('return tr("agt.tab")'), false)
  assert.equal(patched.split('"bts.tab": "机器人"').length - 1, 1)
  assert.match(patched, /"bts\.tab": "Robots"/)
  assert.equal(patched.split('return tr("bts.tab")').length - 1, 1)
  assert.match(patched, /title: tr\("bts\.tab"\)/)
  assert.match(patched, /className: "lbl" \}, tr\("bts\.tab"\)\)/)
  assert.match(patched, /className: "t1" \}, tr\("bts\.tab"\)\)/)
  const reg = patched.indexOf('id: "desk-bots"')
  const window = patched.slice(reg, reg + 400)
  assert.match(window, /return tr\("bts\.tab"\)/)
  assert.match(window, /BotsPanel/)
  assert.equal(window.includes('AgentsPanel'), false)
  assert.equal(patched.split('\n').some((line) => line.trim() === 'AgentsPanel'), false)
  const before = footerEntries(sourceText)
  const after = footerEntries(patched)
  assert.deepEqual(after, before.filter(([id]) => id !== 'desk-agents'))
  assert.equal(after.some(([id]) => id === 'desk-agents'), false)
  assert.deepEqual(after.find((entry) => entry[0] === 'desk-bots'), ['desk-bots', 90])
  for (const id of ['desk-auto', 'desk-assistants', 'desk-skills-conn', 'desk-announce', 'desk-hub', 'desk-usage']) {
    assert.deepEqual(after.find((entry) => entry[0] === id), before.find((entry) => entry[0] === id))
  }

  // AC2 — opening 机器人 still reaches bot and subagent capabilities.
  assert.match(patched, /function agentsLead\(wide\)/)
  assert.match(patched, /agentsLead\(wide\)\.forEach/)
  assert.match(patched, /"bot\.lead": "子代理"/)
  assert.match(patched, /tr\("bot\.lead"\)/)
  assert.match(patched, /tr\("agt\.sub"\)/)
  assert.match(patched, /h\(AgentsPanel, \{ key: "bot-agents", wide: wide, embedded: true \}\)/)
  assert.match(patched, /if \(embedded\) return h\("div", \{ className: "bot-agents" \}, kids\);/)
  assert.match(patched, /if \(!embedded && !open\) return h\("div", null, trigger\);/)
  assert.match(patched, /tr\("agt\.tabRuns"\)/)
  assert.match(patched, /tr\("agt\.tabDefs"\)/)
  assert.match(patched, /"BOTS"/)
  assert.match(patched, /tr\("bts\.secRooms"\)/)
  assert.match(patched, /tr\("bts\.noBots"\)/)
  assert.match(patched, /fetch\("\/portal\/api\/panel\/agents"/)
  assert.match(patched, /fetch\("\/portal\/api\/panel\/agent-runs"/)
  assert.match(patched, /fetch\("\/portal\/api\/panel\/bots"/)
  assert.match(patched, /fetch\("\/portal\/api\/panel\/bot-chat/)
  assert.match(patched, /fetch\("\/portal\/api\/panel\/room/)
  assert.match(patched, /function AgentsPanel\(/)
  assert.match(patched, /function BotsPanel\(/)
  const botsFn = patched.indexOf('function BotsPanel(')
  const guard = patched.indexOf('if (!open) return h("div", null, trigger);', botsFn)
  const call = patched.indexOf('agentsLead(wide).forEach', botsFn)
  const wrap = patched.indexOf('className: "bts-wrap"', botsFn)
  assert.ok(botsFn > 0 && guard > botsFn && call > guard && wrap > call)
  const check = spawnSync('node', ['--check', path], { encoding: 'utf8' })
  assert.equal(check.status, 0, check.stderr)
  assert.equal(readFileSync(sourceClient, 'utf8'), sourceText)
  const second = run(dir)
  assert.equal(second.status, 0, second.stderr)
  assert.match(second.stdout, /skip/)
  assert.equal(readFileSync(path, 'utf8'), patched)
  rmSync(dir, { recursive: true, force: true })
})

test('AC3: after the earlier sidebar knives, healthz paths and the three cards stay', () => {
  const dir = mkdtempSync(join(tmpdir(), 'bots-merge-chain-'))
  cpSync(join(root, 'plugin'), join(dir, 'plugin'), { recursive: true })
  const path = join(dir, REL)
  const skills = runPy(skillsScript, dir)
  assert.equal(skills.status, 0, skills.stderr)
  const auto = runPy(autoScript, dir)
  assert.equal(auto.status, 0, auto.stderr)
  const merged = run(dir)
  assert.equal(merged.status, 0, merged.stderr)
  const patched = readFileSync(path, 'utf8')
  assert.match(patched, new RegExp(SKILLS_MARKER))
  assert.match(patched, new RegExp(AUTO_MARKER))
  assert.match(patched, new RegExp(MARKER))
  // AC1 still holds on the image-order copy.
  assert.equal(patched.includes('id: "desk-agents"'), false)
  assert.equal(patched.includes('id: "desk-assistants"'), false)
  assert.equal(patched.split('id: "desk-bots"').length - 1, 1)
  assert.match(patched, /"bts\.tab": "机器人"/)
  assert.equal(patched.includes('return "Bots"'), false)
  // AC2 paths still hold after the earlier patches.
  assert.match(patched, /agentsLead\(wide\)\.forEach/)
  assert.match(patched, /embedded: true/)
  assert.match(patched, /fetch\("\/portal\/api\/panel\/agents"/)
  assert.match(patched, /fetch\("\/portal\/api\/panel\/bots"/)
  // AC3 — no rollback of the knives this cut must keep.
  assert.equal(patched.includes('id: "desk-auto"'), false)
  assert.match(patched, /"skl\.tab": "功能与连接"/)
  assert.equal(patched.split('id: "desk-skills-conn"').length - 1, 1)
  assert.equal(patched.includes('自动化任务'), false)
  assert.equal(patched.includes('id: "schedules"'), false)
  assert.equal(patched.includes('sidebar.panellist'), false)
  assert.deepEqual(
    footerEntries(patched),
    footerEntries(sourceText).filter(([id]) => id !== 'desk-assistants' && id !== 'desk-auto' && id !== 'desk-agents'),
  )
  const check = spawnSync('node', ['--check', path], { encoding: 'utf8' })
  assert.equal(check.status, 0, check.stderr)
  const again = run(dir)
  assert.equal(again.status, 0, again.stderr)
  assert.match(again.stdout, /skip/)
  assert.equal(readFileSync(sourceClient, 'utf8'), sourceText)
  assert.equal(readFileSync(groupsScript, 'utf8'), groupsSource)
  rmSync(dir, { recursive: true, force: true })
})

test('automation merge still requires desk-agents, so this patch stays after it', () => {
  const dir = mkdtempSync(join(tmpdir(), 'bots-merge-order-'))
  cpSync(join(root, 'plugin'), join(dir, 'plugin'), { recursive: true })
  const path = join(dir, REL)
  const first = run(dir)
  assert.equal(first.status, 0, first.stderr)
  const patched = readFileSync(path, 'utf8')
  const auto = runPy(autoScript, dir)
  assert.notEqual(auto.status, 0)
  assert.match(auto.stderr, /automation merge is wrong/)
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

test('script has no native-install default path and does not retarget groups or login', () => {
  assert.equal(scriptSource.includes('expanduser'), false)
  assert.equal(scriptSource.includes('USERPROFILE'), false)
  assert.equal(scriptSource.includes('AppData'), false)
  assert.equal(scriptSource.includes('~/'), false)
  assert.equal(scriptSource.includes('deploy/windows'), false)
  assert.equal(scriptSource.includes('DSH_SRC'), false)
  assert.equal(scriptSource.includes('SidebarRoot'), false)
  assert.equal(scriptSource.includes('AccountMenu'), false)
  assert.equal(scriptSource.includes(EXCEPT), false)
  assert.equal(scriptSource.includes('schedules'), false)
  const urls = scriptSource.match(/https:\/\/[^\s'")]+/g) || []
  assert.deepEqual(urls, [])
  assert.match(groupsSource, new RegExp(GROUPS_MARKER))
  assert.match(groupsSource, /only: 'desk-skills-conn'/)
  assert.match(groupsSource, /only: 'chat-import'/)
  assert.match(groupsSource, /only: 'desk-usage'/)
  assert.match(groupsSource, new RegExp(EXCEPT.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')))
  assert.match(groupsSource, /aria-label="工作"/)
  assert.match(groupsSource, /aria-label="扩展"/)
  assert.match(groupsSource, /aria-label="账户"/)
  assert.equal(groupsSource.includes('desk-agents'), false)
  assert.equal(groupsSource.includes('desk-bots'), false)
})

test('image build patches the anywork copy after the other sidebar merges', () => {
  const docker = readFileSync(dockerfile, 'utf8')
  assert.match(docker, /ARG DSH_REF=dsh-v0\.2\.1-rc\.3/)
  const groupsRun = docker.indexOf('python3 /tmp/dsh-sidebar-groups.py')
  const buildAt = docker.indexOf('RUN pnpm build')
  const copyAt = docker.indexOf('COPY . /opt/anywork')
  const skillsRun = docker.indexOf('ANYWORK_SRC=/opt/anywork python3 /opt/anywork/deploy/docker/dsh-sidebar-assistant-skills-merge.py')
  const autoRun = docker.indexOf('ANYWORK_SRC=/opt/anywork python3 /opt/anywork/deploy/docker/dsh-sidebar-automation-merge.py')
  const botsRun = docker.indexOf('ANYWORK_SRC=/opt/anywork python3 /opt/anywork/deploy/docker/dsh-sidebar-bots-subagents-merge.py')
  assert.ok(groupsRun > 0 && buildAt > groupsRun)
  assert.ok(copyAt > buildAt && skillsRun > copyAt && autoRun > skillsRun && botsRun > autoRun)
  assert.match(docker, /curl -fsS http:\/\/127\.0\.0\.1:8080\/healthz/)
  const relay = readFileSync(relayScript, 'utf8')
  assert.match(relay, new RegExp(RELAY.replace(/[.]/g, '\\.')))
  assert.match(relay, /beginSignIn/)
  assert.equal(readFileSync(navScript, 'utf8').includes(MARKER), false)
  assert.equal(relay.includes(MARKER), false)
  assert.equal(readFileSync(skillsScript, 'utf8').includes(MARKER), false)
  assert.equal(readFileSync(autoScript, 'utf8').includes(MARKER), false)
  assert.equal(groupsSource.includes(MARKER), false)
  assert.equal(docker.includes('deploy/windows'), false)
})

test('missing anchor fails closed', () => {
  const dir = mkdtempSync(join(tmpdir(), 'bots-merge-miss-'))
  const path = layout(dir, 'function BotsPanel(props) {\n')
  const result = run(dir)
  assert.notEqual(result.status, 0)
  assert.match(result.stderr, /anchor count=0/)
  assert.equal(readFileSync(path, 'utf8'), 'function BotsPanel(props) {\n')
  rmSync(dir, { recursive: true, force: true })
})

test('a marker without the merge fails closed', () => {
  const dir = mkdtempSync(join(tmpdir(), 'bots-merge-bad-'))
  const path = layout(dir, `/* ${MARKER} */\nid: "desk-agents"\n`)
  const result = run(dir)
  assert.notEqual(result.status, 0)
  assert.match(result.stderr, /merge is wrong/)
  assert.match(readFileSync(path, 'utf8'), /desk-agents/)
  rmSync(dir, { recursive: true, force: true })
})
