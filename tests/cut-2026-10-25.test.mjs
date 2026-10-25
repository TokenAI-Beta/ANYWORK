// 2026-10-25 两条绿线：工作台检索不再裸 401；微信编号写回同一会话。
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createServer } from 'node:http'
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { zstdCompressSync } from 'node:zlib'
import { openDb } from '../src/db.ts'
import { hashToken } from '../src/keys.ts'
import {
  SEARCH_MISSING_KEY,
  SEARCH_NOT_CONFIGURED,
  SEARCH_UPSTREAM_REJECTED,
  resolveSearchUpstream,
  startGateway,
} from '../src/gateway.ts'
import { forwardChoice, isChoiceText, wxDebugDecode } from '../src/wx-bridge.ts'
import { apply, selectByNumbers } from '../plugin/dsh-wx-answerer/index.js'

function listen(server) {
  return new Promise((resolve) => {
    server.listen(0, '127.0.0.1', () => resolve(server.address().port))
  })
}

function whenListening(server) {
  return new Promise((resolve) => {
    server.once('listening', () => resolve(server.address().port))
    if (server.listening) resolve(server.address().port)
  })
}

function seed(db, token) {
  db.prepare(`INSERT INTO users (username, role, status) VALUES ('alice', 'member', 'active')`).run()
  const id = db.prepare(`SELECT id FROM users WHERE username = 'alice'`).get().id
  db.prepare(`INSERT INTO api_keys (user_id, token_hash, prefix) VALUES (?, ?, 'sk-desk')`).run(id, hashToken(token))
}

test('resolveSearchUpstream derives the Anthropic messages path and refuses an unconfigured key', () => {
  assert.equal(
    resolveSearchUpstream('https://api.deepseek.com', undefined, 'sk-real').url,
    'https://api.deepseek.com/anthropic/v1/messages',
  )
  assert.equal(
    resolveSearchUpstream('https://api.deepseek.com/v1/', '', 'sk-real').url,
    'https://api.deepseek.com/anthropic/v1/messages',
  )
  assert.equal(resolveSearchUpstream('https://api.deepseek.com', 'off', 'sk-real').error, SEARCH_NOT_CONFIGURED)
  assert.equal(resolveSearchUpstream('https://api.deepseek.com', undefined, '  ').error, SEARCH_NOT_CONFIGURED)
})

test('workbench search is relayed with the real key and is never a bare 401', async () => {
  const seen = []
  const upstream = createServer(async (req, res) => {
    const chunks = []
    for await (const c of req) chunks.push(c)
    seen.push({
      url: req.url,
      authorization: req.headers.authorization,
      apiKey: req.headers['x-api-key'],
      body: Buffer.concat(chunks).toString('utf8'),
    })
    if (req.headers.authorization === 'Bearer sk-bad-real') {
      res.writeHead(401, { 'content-type': 'application/json' })
      res.end(JSON.stringify({ error: { message: 'Authentication Fails, Your api key is invalid' } }))
      return
    }
    res.writeHead(200, { 'content-type': 'application/json' })
    res.end(JSON.stringify({
      content: [{
        type: 'web_search_tool_result',
        content: [{ type: 'web_search_result', url: 'https://example.test/a', title: 'A' }],
      }],
    }))
  })
  const upPort = await listen(upstream)
  const dir = mkdtempSync(join(tmpdir(), 'desk-gw-'))
  const db = openDb(join(dir, 'desk.db'))
  const virtual = 'sk-desk-virtual-test'
  seed(db, virtual)
  const gw = startGateway({
    db,
    upstream: `http://127.0.0.1:${upPort}`,
    realKey: 'sk-real',
    port: 0,
  })
  const gwPort = await whenListening(gw)
  const prev = process.env.DESK_SEARCH_UPSTREAM
  delete process.env.DESK_SEARCH_UPSTREAM
  try {
    const searchBody = JSON.stringify({
      model: 'deepseek-v4-flash',
      max_tokens: 128,
      messages: [{ role: 'user', content: [{ type: 'text', text: 'Perform a web search for the query: dsh' }] }],
      tools: [{ type: 'web_search_20250305', name: 'web_search', max_uses: 1 }],
    })
    const ok = await fetch(`http://127.0.0.1:${gwPort}/anthropic/v1/messages`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${virtual}`,
        'x-api-key': virtual,
        'anthropic-version': '2023-06-01',
      },
      body: searchBody,
    })
    const okJson = await ok.json()
    assert.equal(ok.status, 200)
    assert.equal(okJson.content[0].type, 'web_search_tool_result')
    assert.equal(okJson.content[0].content[0].url, 'https://example.test/a')
    assert.equal(seen[0].url, '/anthropic/v1/messages')
    assert.equal(seen[0].authorization, 'Bearer sk-real')
    assert.equal(seen[0].apiKey, 'sk-real')
    assert.equal(seen[0].body, searchBody)
    assert.equal(seen[0].authorization.includes(virtual), false)

    const chat = await fetch(`http://127.0.0.1:${gwPort}/chat/completions`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: '{}',
    })
    assert.equal(chat.status, 401)
    assert.equal((await chat.json()).error.message, 'invalid or missing api key')

    const bare = await fetch(`http://127.0.0.1:${gwPort}/anthropic/v1/messages`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: searchBody,
    })
    const bareJson = await bare.json()
    assert.notEqual(bare.status, 401)
    assert.equal(bare.status, 403)
    assert.equal(bareJson.error.message, SEARCH_MISSING_KEY)

    process.env.DESK_SEARCH_UPSTREAM = 'off'
    const off = await fetch(`http://127.0.0.1:${gwPort}/anthropic/v1/messages`, {
      method: 'POST',
      headers: { authorization: `Bearer ${virtual}`, 'content-type': 'application/json' },
      body: searchBody,
    })
    const offJson = await off.json()
    assert.notEqual(off.status, 401)
    assert.equal(off.status, 503)
    assert.equal(offJson.error.message, SEARCH_NOT_CONFIGURED)
    assert.match(offJson.error.message, /裸 HTTP 401/)
  } finally {
    if (prev === undefined) delete process.env.DESK_SEARCH_UPSTREAM
    else process.env.DESK_SEARCH_UPSTREAM = prev
    gw.close()
    upstream.close()
    db.close()
    rmSync(dir, { recursive: true, force: true })
  }
})

test('an upstream search 401 is rewritten into a clear non-401 error', async () => {
  const upstream = createServer((_req, res) => {
    res.writeHead(401)
    res.end('Unauthorized')
  })
  const upPort = await listen(upstream)
  const dir = mkdtempSync(join(tmpdir(), 'desk-gw-'))
  const db = openDb(join(dir, 'desk.db'))
  const virtual = 'sk-desk-virtual-test'
  seed(db, virtual)
  const gw = startGateway({ db, upstream: 'http://127.0.0.1:9', realKey: 'sk-bad-real', port: 0 })
  const gwPort = await whenListening(gw)
  const prev = process.env.DESK_SEARCH_UPSTREAM
  process.env.DESK_SEARCH_UPSTREAM = `http://127.0.0.1:${upPort}/anthropic/v1`
  try {
    const r = await fetch(`http://127.0.0.1:${gwPort}/anthropic/v1/messages`, {
      method: 'POST',
      headers: { authorization: `Bearer ${virtual}`, 'content-type': 'application/json' },
      body: '{}',
    })
    const j = await r.json()
    assert.notEqual(r.status, 401)
    assert.equal(r.status, 502)
    assert.equal(j.error.message, SEARCH_UPSTREAM_REJECTED)
    assert.match(j.error.message, /DEEPSEEK_API_KEY/)
  } finally {
    if (prev === undefined) delete process.env.DESK_SEARCH_UPSTREAM
    else process.env.DESK_SEARCH_UPSTREAM = prev
    gw.close()
    upstream.close()
    db.close()
    rmSync(dir, { recursive: true, force: true })
  }
})

test('a numbered WeChat reply resolves the same ask_user_question the workbench is showing', async () => {
  const home = mkdtempSync(join(tmpdir(), 'desk-ans-'))
  const prevHome = process.env.DSH_HOME
  process.env.DSH_HOME = home
  const stops = []
  const ctx = {
    on(name, fn, opts) {
      ctx.listener = { name, fn, prepend: opts === true }
      return () => {}
    },
    effect(run) {
      const stop = run()
      stops.push(stop)
    },
  }
  apply(ctx)
  assert.equal(ctx.listener.name, 'user-questions/request')
  assert.equal(ctx.listener.prepend, true)

  const sid = 'session-abc'
  let webOffered = false
  let releaseWeb
  const web = new Promise((resolve) => { releaseWeb = resolve })
  const asked = ctx.listener.fn(
    {
      agent: { id: sid },
      questions: [{
        id: 'q1',
        question: '用哪种？',
        options: [{ label: 'Alpha' }, { label: 'Beta' }],
      }],
    },
    () => {
      webOffered = true
      return web
    },
  )
  const file = join(home, 'wx-answerer.json')
  let ep
  for (let i = 0; i < 50 && !ep; i++) {
    try { ep = JSON.parse(readFileSync(file, 'utf8')) } catch { await new Promise((r) => setTimeout(r, 20)) }
  }
  assert.ok(ep?.port && ep.token)

  const written = await forwardChoice(home, sid, '2')
  assert.equal(written.ok, true)
  assert.equal(written.summary, '2. Beta')
  const answer = await asked
  assert.deepEqual(answer, { answers: [{ id: 'q1', selected: ['Beta'] }] })
  assert.equal(webOffered, true)

  const late = await forwardChoice(home, sid, '1')
  assert.equal(late.ok, false)
  assert.equal(late.code, 'no-pending')

  releaseWeb({ answers: [{ id: 'q1', selected: ['Alpha'] }] })
  for (const stop of stops) stop()
  if (prevHome === undefined) delete process.env.DSH_HOME
  else process.env.DSH_HOME = prevHome
  rmSync(home, { recursive: true, force: true })
})

test('a web click wins, and a later number does not overwrite that answer', async () => {
  const { createAnswerer } = await import('../plugin/dsh-wx-answerer/index.js')
  const answerer = createAnswerer()
  const webAnswer = { answers: [{ id: 'q1', selected: ['Alpha'] }] }
  const asked = answerer.onRequest(
    {
      agent: { id: 'session-web' },
      questions: [{ id: 'q1', question: '用哪种？', options: [{ label: 'Alpha' }, { label: 'Beta' }] }],
    },
    async () => webAnswer,
  )
  assert.deepEqual(await asked, webAnswer)
  const again = answerer.submit('session-web', '2')
  assert.equal(again.ok, false)
  assert.equal(again.code, 'no-pending')
})

test('choice parsing and the session the bridge reads agree on a pending question', () => {
  assert.equal(isChoiceText('2'), true)
  assert.equal(isChoiceText('1 3'), true)
  assert.equal(isChoiceText('1,3'), true)
  assert.equal(isChoiceText('明天 2 点'), false)
  assert.equal(selectByNumbers(
    [{ id: 'q', question: '多选', multiSelect: true, options: [{ label: 'A' }, { label: 'B' }, { label: 'C' }] }],
    '1 3',
  ).answer.answers[0].selected.join(','), 'A,C')
  const bad = selectByNumbers(
    [{ id: 'q', question: '单选', options: [{ label: 'A' }, { label: 'B' }] }],
    '9',
  )
  assert.equal(bad.ok, false)
  assert.match(bad.error, /1 到 2/)

  const home = mkdtempSync(join(tmpdir(), 'desk-sess-'))
  const sid = 'session-pend'
  const dir = join(home, 'sessions', 'ab', sid)
  mkdirSync(dir, { recursive: true })
  const line = JSON.stringify({
    type: 'tool/call',
    data: {
      callId: 'call-1',
      name: 'ask_user_question',
      arguments: JSON.stringify({
        questions: [{ id: 'q1', question: '用哪种？', options: [{ label: 'Alpha' }, { label: 'Beta' }] }],
      }),
    },
  })
  writeFileSync(join(dir, 'session.jsonl.zstd'), zstdCompressSync(Buffer.from(line + '\n')))
  const st = wxDebugDecode(home, sid)
  assert.equal(st.pendingAsk.question, '用哪种？')
  assert.deepEqual(st.pendingAsk.options.map((o) => o.label), ['Alpha', 'Beta'])
  rmSync(home, { recursive: true, force: true })
})
