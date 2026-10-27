// Cut 2026-10-27 chat-shell-ui-from-workbench (Decision B).
// Docker image patches only. Alias map and agent.cordis stay put.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, readFileSync, rmSync, mkdirSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawnSync } from 'node:child_process'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const script = join(root, 'deploy/docker/dsh-chat-shell-ui.py')
const dockerfile = join(root, 'deploy/docker/Dockerfile')
const scriptText = readFileSync(script, 'utf8')

const SWATCH = {
  'collab-default': '#1680f3',
  'research-report': '#0d9488',
  'formal-docs': '#7c3aed',
  'eng-codex': '#c2410c',
}

function run(env, extra = {}) {
  return spawnSync('python3', [script], {
    env: { ...process.env, ...env },
    encoding: 'utf8',
    ...extra,
  })
}

function loadAnchors() {
  const result = spawnSync('python3', ['-c', `
import importlib.util, json
spec = importlib.util.spec_from_file_location("shell", ${JSON.stringify(script)})
mod = importlib.util.module_from_spec(spec)
spec.loader.exec_module(mod)
names = [k for k in dir(mod) if k.startswith("OLD_") or k in ("BUBBLE_CSS","ASSIST_CSS","SHELL_CSS","SHELL_TSX","LABEL_TSX","LABEL_CSS","INPUT_TSX","INPUT_CSS","EDITABLE_TSX","RUNTIME_TS","PROJECT_TS","SKILL_TSX","SKILL_CSS","DESK","NEED_USE_PATH")]
print(json.dumps({k: getattr(mod, k) for k in names}))
`], { encoding: 'utf8' })
  assert.equal(result.status, 0, result.stderr)
  return JSON.parse(result.stdout)
}

function write(dir, rel, body) {
  const path = join(dir, rel)
  mkdirSync(dirname(path), { recursive: true })
  writeFileSync(path, body)
}

function layoutDsh(dir, a) {
  write(dir, a.BUBBLE_CSS, a.OLD_BUBBLE)
  write(dir, a.ASSIST_CSS, a.OLD_ASSIST)
  write(dir, a.SHELL_CSS, `.root {\n${a.OLD_SHELL_BG}`)
  write(dir, a.SHELL_TSX, a.OLD_SHELL_DIV)
  write(dir, a.LABEL_TSX, `${a.OLD_LABEL_IMPORT}\n${a.OLD_LABEL_FN}  sessionId, useSessions, useAgentPresets, load, t,\n}: AgentPresetLabelProps) {\n${a.OLD_LABEL_TAIL}`)
  write(dir, a.LABEL_CSS, a.OLD_LABEL_ICON)
  write(dir, a.INPUT_TSX, [
    a.OLD_INPUT_IMPORT,
    a.OLD_INPUT_RETURN,
    a.OLD_ATTACH,
    a.OLD_PLUS,
    a.OLD_SEND,
  ].join('\n'))
  write(dir, a.INPUT_CSS, [
    a.OLD_CARD_BG,
    a.OLD_PLACEHOLDER_COLOR,
    '}\n',
    a.OLD_PRIMARY_BG,
    a.OLD_PRIMARY_HOVER,
  ].join('\n'))
  write(dir, a.EDITABLE_TSX, a.OLD_EDITABLE)
  write(dir, a.RUNTIME_TS, a.OLD_RUNTIME_IMPORT + a.OLD_RUNTIME_NODES)
  write(dir, a.PROJECT_TS, a.OLD_PROJECT_IMPORT + a.OLD_PROJECT_WALK)
  write(dir, a.SKILL_CSS, [
    a.OLD_TITLE,
    a.OLD_SUMMARY,
    a.OLD_BODY,
    a.OLD_HEADER_COLOR,
    a.OLD_MOTION,
  ].join('\n'))
  write(dir, a.SKILL_TSX, a.OLD_SKILL_BODY)
}

function layoutDesk(dir, a) {
  write(dir, a.DESK, [
    `// ${a.NEED_USE_PATH}`,
    a.OLD_ROLE_ICON,
    a.OLD_CARD,
    'tr("asst.newSession")',
    'tr("asst.setDefault")',
    a.OLD_LINKISH,
    a.OLD_TX,
    a.OLD_BOT_MSG,
    a.OLD_ROOM_MSG,
  ].join('\n'))
}

test('harness patch paints bubbles, tokens, reveal, and a short code embed', () => {
  const a = loadAnchors()
  const dir = mkdtempSync(join(tmpdir(), 'chat-shell-dsh-'))
  layoutDsh(dir, a)
  const result = run({ DSH_SRC: dir, ANYWORK_SRC: '' })
  assert.equal(result.status, 0, result.stderr)
  const bubble = readFileSync(join(dir, a.BUBBLE_CSS), 'utf8')
  const assist = readFileSync(join(dir, a.ASSIST_CSS), 'utf8')
  const shell = readFileSync(join(dir, a.SHELL_CSS), 'utf8')
  const skill = readFileSync(join(dir, a.SKILL_CSS), 'utf8')
  const input = readFileSync(join(dir, a.INPUT_TSX), 'utf8')
  const code = readFileSync(join(dir, 'packages/client/ui-conversation/src/client/input/editor/composer-code-node.tsx'), 'utf8')
  assert.match(bubble, /background: var\(--ink, #1c1c1c\)/)
  assert.match(bubble, /color: var\(--on-ink, #fff\)/)
  assert.match(bubble, /border-radius: 18px/)
  assert.match(bubble, /padding: 7px 14px/)
  assert.match(bubble, /line-height: 22px/)
  assert.match(bubble, /min-height: 36px/)
  assert.equal(bubble.includes('#c2410c'), false)
  assert.match(assist, /background: #1c1c1c0f/)
  assert.match(assist, /border: 1px solid #1c1c1c14/)
  assert.match(assist, /inset 3px 0 0 var\(--role-swatch, transparent\)/)
  assert.match(shell, /--ink: #1c1c1c/)
  assert.match(shell, /--on-ink: #ffffff/)
  assert.match(shell, /--chrome: #fcfcfc/)
  assert.match(shell, /--pane: #ffffff/)
  assert.match(shell, /--accent: #1680f3/)
  assert.match(shell, /--accent-hover: #126fd4/)
  assert.match(shell, /--text-100: color-mix\(in srgb, var\(--ink\) 100%/)
  assert.match(shell, /68%/)
  assert.match(shell, /56%/)
  assert.match(shell, /40%/)
  assert.match(skill, /grid-template-rows: 0fr/)
  assert.match(skill, /grid-template-rows: 1fr/)
  assert.match(skill, /transition: max-width 180ms ease/)
  assert.match(input, /data-composer-embed="attachment"/)
  assert.match(input, /data-send-state=\{empty \? 'empty' : 'ready'\}/)
  assert.match(input, /onInsertCode/)
  assert.match(code, /getTextContent/)
  assert.match(code, /slice\(0, 12\)/)
  const again = run({ DSH_SRC: dir, ANYWORK_SRC: '' })
  assert.equal(again.status, 0, again.stderr)
  assert.match(again.stdout, /skip/)
  rmSync(dir, { recursive: true, force: true })
})

test('desk patch adds four role swatches without dropping use-path actions', () => {
  const a = loadAnchors()
  const dir = mkdtempSync(join(tmpdir(), 'chat-shell-desk-'))
  layoutDesk(dir, a)
  const result = run({ ANYWORK_SRC: dir, DSH_SRC: '' })
  assert.equal(result.status, 0, result.stderr)
  const desk = readFileSync(join(dir, a.DESK), 'utf8')
  for (const [id, color] of Object.entries(SWATCH)) {
    assert.match(desk, new RegExp(`"${id}": "${color}"`))
  }
  assert.match(desk, /data-role-swatch/)
  assert.match(desk, /boxShadow: "inset 3px 0 0 "/)
  assert.match(desk, /data-bubble/)
  assert.match(desk, /background:#1c1c1c0f/)
  assert.match(desk, /border:1px solid #1c1c1c14/)
  assert.match(desk, /tr\("asst\.newSession"\)/)
  assert.match(desk, /tr\("asst\.setDefault"\)/)
  assert.equal(desk.includes('canonPreset'), false)
  const again = run({ ANYWORK_SRC: dir, DSH_SRC: '' })
  assert.equal(again.status, 0, again.stderr)
  assert.match(again.stdout, /skip/)
  rmSync(dir, { recursive: true, force: true })
})

test('desk patch refuses to run before the use-path image script', () => {
  const dir = mkdtempSync(join(tmpdir(), 'chat-shell-early-'))
  const rel = 'plugin/desk-panel/lib/client.js'
  write(dir, rel, 'function roleIcon(id) { return ROLE_ICON[id] || "assist"; }\n')
  const result = run({ ANYWORK_SRC: dir, DSH_SRC: '' })
  assert.notEqual(result.status, 0)
  assert.match(result.stderr, /use path is missing/)
  rmSync(dir, { recursive: true, force: true })
})

test('patch refuses to run without an image root', () => {
  const env = { ...process.env }
  delete env.DSH_SRC
  delete env.ANYWORK_SRC
  const result = spawnSync('python3', [script], { env, encoding: 'utf8' })
  assert.notEqual(result.status, 0)
  assert.match(result.stderr, /DSH_SRC or ANYWORK_SRC is required/)
})

test('image build keeps healthz and stays Docker-only', () => {
  const docker = readFileSync(dockerfile, 'utf8')
  assert.match(docker, /ARG DSH_REF=dsh-v0\.2\.1-rc\.3/)
  assert.match(docker, /curl -fsS http:\/\/127\.0\.0\.1:8080\/healthz/)
  const aliasRun = docker.indexOf('python3 /tmp/dsh-preset-alias.py')
  const shellCopy = docker.indexOf('COPY deploy/docker/dsh-chat-shell-ui.py')
  const shellDsh = docker.indexOf('DSH_SRC=/src/deepseek-harness python3 /tmp/dsh-chat-shell-ui.py')
  const buildAt = docker.indexOf('RUN pnpm build')
  const useRun = docker.indexOf('ANYWORK_SRC=/opt/anywork python3 /opt/anywork/deploy/docker/dsh-features-connect-use-path.py')
  const vaultRun = docker.indexOf('ANYWORK_SRC=/opt/anywork python3 /opt/anywork/deploy/docker/dsh-sidebar-work-group-bots-vault.py')
  const shellDesk = docker.indexOf('ANYWORK_SRC=/opt/anywork python3 /opt/anywork/deploy/docker/dsh-chat-shell-ui.py')
  assert.ok(aliasRun > 0 && shellCopy > aliasRun && shellDsh > shellCopy && buildAt > shellDsh)
  assert.ok(useRun > 0 && vaultRun > useRun && shellDesk > vaultRun)
  assert.equal(scriptText.includes('agent.cordis.yml'), false)
  assert.equal(scriptText.includes('presets-template'), false)
  assert.match(readFileSync(join(root, 'deploy/docker/dsh-preset-alias.py'), 'utf8'), /canonPreset/)
})
