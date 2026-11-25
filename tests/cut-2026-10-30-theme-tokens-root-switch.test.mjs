// Cut 2026-10-30 theme-tokens-root-switch.
// One token set on body[data-ds-dark-theme]. Popup-r2 drawer behavior stays
// in the portal. No portal color !important layer. Plugin lazy-load stays put.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, readFileSync, rmSync, mkdirSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawnSync } from 'node:child_process'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const script = join(root, 'deploy/docker/dsh-theme-tokens-root-switch.py')
const chatShell = join(root, 'deploy/docker/dsh-chat-shell-ui.py')
const dockerfile = join(root, 'deploy/docker/Dockerfile')
const portal = join(root, 'src/portal.ts')
const lazy = join(root, 'deploy/docker/dsh-plugin-lazy-first-paint.py')

function load(file, names) {
  const result = spawnSync('python3', ['-c', `
import importlib.util, json
spec = importlib.util.spec_from_file_location("mod", ${JSON.stringify(file)})
mod = importlib.util.module_from_spec(spec)
spec.loader.exec_module(mod)
print(json.dumps({k: getattr(mod, k) for k in ${JSON.stringify(names)}}))
`], { encoding: 'utf8' })
  assert.equal(result.status, 0, result.stderr)
  return JSON.parse(result.stdout)
}

const patch = load(script, [
  'OLD_TOKENS', 'NEW_TOKENS', 'OLD_BUBBLE', 'NEW_BUBBLE', 'OLD_ASSIST', 'NEW_ASSIST',
  'OLD_BOOT_COLORS', 'OLD_BOOT_LIGHT', 'OLD_BOOT_DARK',
  'OLD_DESK_USER', 'OLD_DESK_ASSIST', 'MARKER', 'PREV', 'DESIGN', 'BOOT', 'SHELL', 'BUBBLE', 'ASSIST', 'DESK',
])
const shell = load(chatShell, ['TOKEN_BLOCK', 'NEW_BUBBLE', 'NEW_ASSIST'])

function write(dir, rel, body) {
  const path = join(dir, rel)
  mkdirSync(dirname(path), { recursive: true })
  writeFileSync(path, body)
}

function layoutDsh(dir) {
  write(dir, patch.DESIGN, 'body[data-ds-dark-theme] {\n  --dsw-alias-bg-base: var(--dsw-static-neutral-bluish-950);\n}\n')
  write(dir, patch.BOOT, `${patch.OLD_BOOT_COLORS}\nconst light = \`:root{color-scheme:light}${patch.OLD_BOOT_LIGHT}}\`\nconst dark = \`:root{color-scheme:dark}${patch.OLD_BOOT_DARK}}\`\n`)
  write(dir, patch.SHELL, patch.OLD_TOKENS + '.root { background: var(--chrome, var(--dsw-alias-bg-base)); }\n')
  write(dir, patch.BUBBLE, patch.OLD_BUBBLE)
  write(dir, patch.ASSIST, patch.OLD_ASSIST)
}

function layoutDesk(dir) {
  write(dir, patch.DESK, [
    `// ${patch.PREV}`,
    'h("div", { className: "tx", "data-bubble": you ? "user" : "assistant" }, mm.text)',
    patch.OLD_DESK_USER + ',',
    patch.OLD_DESK_ASSIST + ',',
  ].join('\n'))
}

function run(env) {
  return spawnSync('python3', [script], {
    env: { ...process.env, ...env },
    encoding: 'utf8',
  })
}

test('anchors still match the chat-shell tokens and bubbles this patch replaces', () => {
  assert.equal(patch.OLD_TOKENS, shell.TOKEN_BLOCK)
  assert.equal(patch.OLD_BUBBLE, shell.NEW_BUBBLE)
  assert.equal(patch.OLD_ASSIST, shell.NEW_ASSIST)
})

test('harness patch publishes one token set on the root switch and strips bubbles', () => {
  const dir = mkdtempSync(join(tmpdir(), 'theme-tokens-'))
  layoutDsh(dir)
  const result = run({ DSH_SRC: dir, ANYWORK_SRC: '' })
  assert.equal(result.status, 0, result.stderr)
  const design = readFileSync(join(dir, patch.DESIGN), 'utf8')
  const boot = readFileSync(join(dir, patch.BOOT), 'utf8')
  const shellCss = readFileSync(join(dir, patch.SHELL), 'utf8')
  const bubble = readFileSync(join(dir, patch.BUBBLE), 'utf8')
  const assist = readFileSync(join(dir, patch.ASSIST), 'utf8')
  assert.match(design, /body\[data-ds-dark-theme\]/)
  assert.match(design, /--aw-page: #ffffff/)
  assert.match(design, /--aw-page: #000000/)
  assert.match(design, /--aw-main:/)
  assert.match(design, /--aw-sidebar:/)
  assert.match(design, /--aw-text: #000000/)
  assert.match(design, /--aw-text: #ffffff/)
  assert.match(design, /--aw-border:/)
  assert.match(design, /--aw-divider:/)
  assert.match(design, /--chrome: var\(--aw-page\)/)
  assert.match(design, /--pane: var\(--aw-main\)/)
  assert.match(design, /--dsw-alias-bg-base: var\(--aw-page\) !important/)
  assert.match(design, /--dsw-alias-label-primary: var\(--aw-text\) !important/)
  assert.match(design, /@media \(max-width: 820px\)/)
  assert.equal(design.includes('#fcfcfc'), false)
  assert.equal(design.includes('hLcygG'), false)
  assert.equal(design.includes('CtUWPa'), false)
  assert.match(shellCss, /--accent: #1680f3/)
  assert.equal(shellCss.includes('#fcfcfc'), false)
  assert.equal(shellCss.includes('--chrome: #'), false)
  assert.match(bubble, /background: transparent/)
  assert.equal(bubble.includes('border-radius: 18px'), false)
  assert.match(assist, /background: transparent/)
  assert.equal(assist.includes('#1c1c1c0f'), false)
  assert.match(boot, /DARK_BACKGROUND = '#000000'/)
  assert.match(boot, /color:#000000/)
  assert.match(boot, /color:#ffffff/)
  const again = run({ DSH_SRC: dir, ANYWORK_SRC: '' })
  assert.equal(again.status, 0, again.stderr)
  assert.match(again.stdout, /skip/)
  rmSync(dir, { recursive: true, force: true })
})

test('desk patch removes message bubble boxes', () => {
  const dir = mkdtempSync(join(tmpdir(), 'theme-tokens-desk-'))
  layoutDesk(dir)
  const result = run({ ANYWORK_SRC: dir, DSH_SRC: '' })
  assert.equal(result.status, 0, result.stderr)
  const desk = readFileSync(join(dir, patch.DESK), 'utf8')
  assert.match(desk, /background:transparent/)
  assert.equal(desk.includes('background:#1c1c1c0f'), false)
  assert.match(desk, /data-bubble/)
  const again = run({ ANYWORK_SRC: dir, DSH_SRC: '' })
  assert.equal(again.status, 0, again.stderr)
  assert.match(again.stdout, /skip/)
  rmSync(dir, { recursive: true, force: true })
})

test('patch refuses to run without the chat-shell predecessor or an image root', () => {
  const dir = mkdtempSync(join(tmpdir(), 'theme-tokens-miss-'))
  write(dir, patch.SHELL, '.root { background: red; }\n')
  write(dir, patch.BUBBLE, '.bubble { background: red; }\n')
  write(dir, patch.ASSIST, '.root { background: red; }\n')
  write(dir, patch.DESIGN, 'body { --dsw-alias-bg-base: #fff; }\nbody[data-ds-dark-theme] {}\n')
  write(dir, patch.BOOT, patch.OLD_BOOT_COLORS + '\n')
  const missing = run({ DSH_SRC: dir, ANYWORK_SRC: '' })
  assert.notEqual(missing.status, 0)
  assert.match(missing.stderr, /chat shell is missing/)
  const env = { ...process.env }
  delete env.DSH_SRC
  delete env.ANYWORK_SRC
  const bare = spawnSync('python3', [script], { env, encoding: 'utf8' })
  assert.notEqual(bare.status, 0)
  assert.match(bare.stderr, /DSH_SRC or ANYWORK_SRC is required/)
  rmSync(dir, { recursive: true, force: true })
})

test('portal keeps popup-r2 drawer behavior and drops the color hotfix sheet', () => {
  const source = readFileSync(portal, 'utf8')
  assert.match(source, /z-index: 200/)
  assert.match(source, /left: 0 !important/)
  assert.match(source, /width: 100% !important/)
  assert.match(source, /border-radius: 0 !important/)
  assert.match(source, /deskIsAc1Stay/)
  assert.match(source, /deskIsAc1bHit/)
  assert.match(source, /更多/)
  assert.match(source, /自动化/)
  assert.match(source, /插件/)
  assert.match(source, /sessionRow/)
  assert.match(source, /newSession/)
  assert.match(source, /cut 2026-10-30 mobile-more-sidebar-stay AC1b/)
  assert.equal(source.includes('DESK_MOBILE_THEME_CSS'), false)
  assert.equal(source.includes('data-desk-dark'), false)
  assert.equal(source.includes("id='desk-sb-grip'"), false)
  assert.equal(source.includes('#desk-sb-grip'), false)
  assert.equal(source.includes('#151515'), false)
  assert.equal(source.includes('#fcfcfc'), false)
  assert.equal(source.includes('#111111'), false)
  assert.equal(source.includes('--dsw-alias-bg-base:'), false)
  assert.match(source, /path === '\/healthz'/)
})

test('image build orders tokens after chat-shell and before plugin lazy-load', () => {
  const docker = readFileSync(dockerfile, 'utf8')
  const shellAt = docker.indexOf('python3 /tmp/dsh-chat-shell-ui.py')
  const themeCopy = docker.indexOf('COPY deploy/docker/dsh-theme-tokens-root-switch.py')
  const themeRun = docker.indexOf('DSH_SRC=/src/deepseek-harness python3 /tmp/dsh-theme-tokens-root-switch.py')
  const lazyCopy = docker.indexOf('COPY deploy/docker/dsh-plugin-lazy-first-paint.py')
  const buildAt = docker.indexOf('RUN pnpm build')
  const deskShell = docker.indexOf('ANYWORK_SRC=/opt/anywork python3 /opt/anywork/deploy/docker/dsh-chat-shell-ui.py')
  const deskTheme = docker.indexOf('ANYWORK_SRC=/opt/anywork python3 /opt/anywork/deploy/docker/dsh-theme-tokens-root-switch.py')
  assert.ok(shellAt > 0 && themeCopy > shellAt && themeRun > themeCopy && lazyCopy > themeRun && buildAt > lazyCopy)
  assert.ok(deskShell > 0 && deskTheme > deskShell)
  assert.equal(docker.includes('DSH_REF=dsh-v0.2.1-rc.3'), true)
  assert.match(docker, /curl -fsS http:\/\/127\.0\.0\.1:8080\/healthz/)
  assert.equal(readFileSync(lazy, 'utf8').includes(patch.MARKER), false)
  assert.equal(readFileSync(script, 'utf8').includes('tokyo'), false)
  assert.equal(readFileSync(script, 'utf8').includes('Tokyo'), false)
})
