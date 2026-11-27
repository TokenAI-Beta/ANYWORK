// Cut 2026-10-31 sidebar-restore-fv.
// Desk-panel sheets (机器人 / 资料库 / 用量 and the same .ddp peers) stay
// .ddp.fv on a narrow rail. Session rows and new chat still arm the rail close.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, mkdirSync, cpSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawnSync } from 'node:child_process'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const clientPath = join(root, 'plugin/desk-panel/lib/client.js')
const portalPath = join(root, 'src/portal.ts')
const mergeScript = join(root, 'deploy/docker/dsh-sidebar-bots-subagents-merge.py')
const client = readFileSync(clientPath, 'utf8')
const portal = readFileSync(portalPath, 'utf8')

function between(source, start, end) {
  const from = source.indexOf(start)
  const to = source.indexOf(end, from + start.length)
  assert.ok(from >= 0 && to > from, `missing slice ${start}`)
  return source.slice(from, to)
}

test('desk sheets use .ddp.fv even when the sidebar is not wide', () => {
  assert.equal(client.includes('wide ? " fv"'), false)
  assert.match(client, /cut 2026-10-31 sidebar-restore-fv/)
  const agents = between(client, 'function AgentsPanel(props)', 'function BotsPanel(props)')
  const bots = between(client, 'function BotsPanel(props)', 'var DESK_ICONS')
  const hub = between(client, 'function TeamHub(props)', 'function AnnounceBoard(props)')
  const usage = between(client, 'function UsagePanel(props)', 'function UsageChip(')
  for (const [name, slice] of [['agents', agents], ['bots', bots], ['hub', hub], ['usage', usage]]) {
    assert.match(slice, /className: "ddp fv"/, name)
    assert.match(slice, /fv\.back/, name)
    assert.equal(slice.includes('wide ? " fv"'), false, name)
  }
  assert.match(usage, /tr\("fv\.back"\)/)
  assert.match(hub, /tr\("fv\.back"\)/)
  assert.match(bots, /← 返回对话|tr\("fv\.back"\)/)
})

test('mobile fv geometry is full-bleed and the rail collapse is not armed for .ddb', () => {
  assert.match(client, /\.ddp\.fv \{ position:fixed; left:0; top:0; right:0; bottom:0; width:auto;/)
  const clickAt = portal.indexOf("document.addEventListener('click',function(ev)")
  assert.ok(clickAt > 0)
  const click = portal.slice(clickAt, portal.indexOf(',true);', clickAt))
  const ddbAt = click.indexOf("t.closest('.ddb')")
  const hitAt = click.indexOf("t.closest('[class*=sessionRow]')")
  assert.ok(ddbAt > 0 && hitAt > ddbAt)
  assert.match(click, /t\.closest\('\.ddp'\)/)
  assert.match(click, /newSession/)
  assert.match(portal, /cut 2026-10-30 mobile-more-sidebar-stay AC1b/)
  assert.match(portal, /if\(document\.querySelector\('\.ddp\.fv'\)\)/)
  assert.doesNotMatch(click, /textContent|innerText/)
  const themeAt = portal.indexOf('const DESK_MOBILE_THEME_CSS')
  const theme = portal.slice(themeAt, themeAt + 400)
  assert.match(theme, /--dsw-alias-bg-base: #151515 !important/)
})

test('fv pin keeps the sheet on the viewport when the column is transformed', () => {
  const src = between(client, 'function fvMobile()', 'function fvMeasure()')
  const styles = new Map()
  const nodes = []
  function make(className, computed) {
    const attrs = { class: className }
    const node = {
      parentElement: null,
      classList: { contains: (name) => className.split(/\s+/).includes(name) },
      getAttribute: (key) => (key in attrs ? attrs[key] : null),
      setAttribute: (key, value) => { attrs[key] = value },
      removeAttribute: (key) => { delete attrs[key] },
      style: {
        setProperty: (key, value, prio) => styles.set(node, Object.assign(styles.get(node) || {}, { [key]: { value, prio } })),
        removeProperty: (key) => {
          const bag = styles.get(node)
          if (bag) delete bag[key]
        },
      },
      computed,
    }
    nodes.push(node)
    return node
  }
  const frame = make('desk-frame', { transform: 'none', filter: 'none', backdropFilter: 'none', perspective: 'none', contain: 'none', willChange: 'auto' })
  const side = make('sidebarCol haTdLq', { transform: 'matrix(1, 0, 0, 1, 0, 0)', filter: 'none', backdropFilter: 'none', perspective: 'none', contain: 'none', willChange: 'auto' })
  const sheet = make('ddp fv', { transform: 'none', filter: 'none', backdropFilter: 'none', perspective: 'none', contain: 'none', willChange: 'auto' })
  side.parentElement = frame
  sheet.parentElement = side
  const live = [sheet]
  const documentMock = {
    body: frame,
    documentElement: { parentElement: null },
    querySelector: (sel) => (sel === '.ddp.fv' ? (live[0] || null) : null),
    querySelectorAll: (sel) => {
      if (sel === '.ddp.fv') return live.slice()
      if (sel === '[data-desk-fv-untrap]') return nodes.filter((node) => node.getAttribute('data-desk-fv-untrap') === '1')
      return []
    },
  }
  const windowMock = {
    matchMedia: () => ({ matches: true }),
    getComputedStyle: (el) => el.computed,
  }
  const fn = new Function('document', 'window', `${src}\nreturn { fvUntrap };`)
  const api = fn(documentMock, windowMock)
  api.fvUntrap()
  const pinned = styles.get(sheet)
  assert.equal(pinned.position.value, 'fixed')
  assert.equal(pinned.position.prio, 'important')
  assert.equal(pinned.left.value, '0')
  assert.equal(pinned.right.value, '0')
  assert.equal(pinned.width.value, 'auto')
  assert.equal(pinned['max-height'].value, 'none')
  assert.equal(styles.get(side).transform.value, 'none')
  assert.equal(styles.get(side).transform.prio, 'important')
  side.computed = { transform: 'none', filter: 'none', backdropFilter: 'none', perspective: 'none', contain: 'none', willChange: 'auto' }
  api.fvUntrap()
  assert.equal(styles.get(sheet).left.value, '0')
  assert.equal(styles.get(side).transform.value, 'none')
  live.length = 0
  api.fvUntrap()
  assert.equal(sheet.getAttribute('data-desk-fv-untrap'), null)
  assert.equal(styles.get(sheet).left, undefined)
  assert.equal(side.getAttribute('data-desk-fv-untrap'), null)
  assert.equal(styles.get(side).transform, undefined)
})

test('portal arms the rail for new chat and sessions, not for desk-panel entries', () => {
  const clickAt = portal.indexOf("document.addEventListener('click',function(ev)")
  const clickEnd = portal.indexOf(',true);', clickAt)
  const clickSrc = portal.slice(clickAt + "document.addEventListener('click',".length, clickEnd)
  let armed = 0
  const documentMock = {
    querySelector: () => ({ getAttribute: () => null }),
  }
  const timers = []
  const windowMock = { setTimeout: (fn) => { timers.push(fn); return timers.length } }
  const targetFor = (hits) => ({
    closest: (sel) => (hits.includes(sel) ? {} : null),
  })
  const run = new Function('document', 'window', 'deskCloseDrawer', 'setTimeout', `return ${clickSrc}`)
  const onClick = run(documentMock, windowMock, () => { armed += 1 }, (fn) => { timers.push(fn) })
  onClick({ target: targetFor(['[class*=sidebarCol]', '.ddb']) })
  onClick({ target: targetFor(['[class*=sidebarCol]', '.ddp']) })
  onClick({ target: targetFor(['[class*=sidebarCol]', '[class*=newSession]']) })
  onClick({ target: targetFor(['[class*=sidebarCol]', '[class*=sessionRow]']) })
  onClick({ target: targetFor(['[class*=sidebarCol]']) })
  assert.equal(timers.length, 2)
  assert.equal(armed, 0)
  for (const fn of timers) fn()
  assert.equal(armed, 2)
})

test('image merge still installs 机器人 without putting fv behind wide', () => {
  const dir = mkdtempSync(join(tmpdir(), 'sidebar-restore-fv-'))
  cpSync(join(root, 'plugin'), join(dir, 'plugin'), { recursive: true })
  mkdirSync(join(dir, 'plugin/desk-panel/lib'), { recursive: true })
  const result = spawnSync('python3', [mergeScript], {
    env: { ...process.env, ANYWORK_SRC: dir },
    encoding: 'utf8',
  })
  assert.equal(result.status, 0, result.stderr)
  const patched = readFileSync(join(dir, 'plugin/desk-panel/lib/client.js'), 'utf8')
  assert.equal(patched.includes('wide ? " fv"'), false)
  const bots = between(patched, 'function BotsPanel(props)', 'var DESK_ICONS')
  assert.match(bots, /className: "ddp fv"/)
  assert.match(bots, /tr\("bts\.tab"\)/)
  assert.doesNotMatch(bots, /return "Bots"/)
  rmSync(dir, { recursive: true, force: true })
})
