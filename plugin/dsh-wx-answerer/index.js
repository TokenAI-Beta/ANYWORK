/**
 * 实例本地选择题应答器。
 *
 * dsh 0.1.5 的 ask_user_question 走 `user-questions/request` 瀑布：
 * 先注册的监听者调用 next() 就把题交给后面的网页应答器。
 * 本插件 prepend，所以最先拿到题：一边 next() 让网页卡片照常出现，
 * 一边把挂起的题留在本进程里。微信桥 POST 127.0.0.1 上的 /answer，
 * 带上选项编号，这里把对应 label 写成工具结果，会话继续。
 * 网页先点选时，瀑布被网页的答案解决，编号接口会看到「已经没有挂起的题」。
 */
import { createServer } from 'node:http'
import { randomBytes, timingSafeEqual } from 'node:crypto'
import { chmodSync, unlinkSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

export const name = 'dsh-wx-answerer'

const CHOICE_RE = /^\d+(?:[,，、\s]+\d+)*[.。]?$/

export function isChoiceText(text) {
  return CHOICE_RE.test(String(text ?? '').trim())
}

export function sessionIdsOf(request) {
  const ids = []
  const agent = request?.agent
  if (agent && typeof agent.id === 'string' && agent.id) ids.push(agent.id)
  const sid = agent?.session?.id
  if (typeof sid === 'string' && sid && !ids.includes(sid)) ids.push(sid)
  return ids
}

/** 把「1」或「1 3」映射成 ask_user_question 的答案。只处理一道带编号选项的题。 */
export function selectByNumbers(questions, text) {
  if (!isChoiceText(text)) {
    return { ok: false, code: 'bad-choice', error: '请回复选项编号，例如 1' }
  }
  if (!Array.isArray(questions) || questions.length !== 1) {
    return { ok: false, code: 'bad-choice', error: '这道题不是单道选择题，请到工作台网页里点选' }
  }
  const q = questions[0] ?? {}
  const options = Array.isArray(q.options) ? q.options.filter((o) => o && typeof o.label === 'string') : []
  if (!options.length || typeof q.id !== 'string' || !q.id) {
    return { ok: false, code: 'bad-choice', error: '这道题没有可编号的选项，请到工作台网页里回答' }
  }
  const nums = String(text)
    .trim()
    .replace(/[.。]$/, '')
    .split(/[,，、\s]+/)
    .filter(Boolean)
    .map((n) => Number(n))
  const multi = q.multiSelect === true || q.multi_select === true
  if (!multi && nums.length !== 1) {
    return { ok: false, code: 'bad-choice', error: '这道题是单选，请只回复一个编号' }
  }
  const labels = []
  for (const n of nums) {
    if (!Number.isInteger(n) || n < 1 || n > options.length) {
      return { ok: false, code: 'bad-choice', error: `编号要在 1 到 ${options.length} 之间` }
    }
    labels.push(options[n - 1].label)
  }
  const summary = nums.map((n, i) => `${n}. ${labels[i]}`).join('、')
  return {
    ok: true,
    summary,
    selected: labels,
    answer: { answers: [{ id: q.id, selected: labels }] },
  }
}

export function createAnswerer() {
  const pending = new Map()

  async function onRequest(request, next) {
    const ids = sessionIdsOf(request)
    if (!ids.length) return next()
    let settle
    const local = new Promise((resolve) => {
      settle = resolve
    })
    const slot = { request, settle, done: false }
    for (const id of ids) pending.set(id, slot)
    const web = Promise.resolve()
      .then(() => next())
      .then(
        (answer) => ({ from: 'web', answer }),
        (error) => ({ from: 'web', error }),
      )
    try {
      const winner = await Promise.race([local, web])
      if (winner.error) throw winner.error
      return winner.answer
    } finally {
      slot.done = true
      for (const id of ids) if (pending.get(id) === slot) pending.delete(id)
    }
  }

  function submit(sessionId, text) {
    const slot = pending.get(String(sessionId ?? ''))
    if (!slot || slot.done) return { ok: false, code: 'no-pending', error: '当前没有挂起的选择题' }
    const picked = selectByNumbers(slot.request?.questions, text)
    if (!picked.ok) return picked
    slot.done = true
    slot.settle({ from: 'local', answer: picked.answer })
    return { ok: true, summary: picked.summary, selected: picked.selected, answer: picked.answer }
  }

  return { onRequest, submit }
}

function safeEqual(a, b) {
  const left = Buffer.from(String(a))
  const right = Buffer.from(String(b))
  if (left.length !== right.length) return false
  return timingSafeEqual(left, right)
}

function readBody(req, limit = 8192) {
  return new Promise((resolve, reject) => {
    let size = 0
    const chunks = []
    req.on('data', (c) => {
      size += c.length
      if (size > limit) {
        reject(new Error('body too large'))
        req.destroy()
        return
      }
      chunks.push(c)
    })
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')))
    req.on('error', reject)
  })
}

function sendJson(res, code, body) {
  res.writeHead(code, { 'content-type': 'application/json' })
  res.end(JSON.stringify(body))
}

export function apply(ctx) {
  const answerer = createAnswerer()
  ctx.on('user-questions/request', answerer.onRequest, true)

  const token = randomBytes(24).toString('hex')
  const server = createServer(async (req, res) => {
    try {
      const path = new URL(req.url ?? '/', 'http://127.0.0.1').pathname
      if (req.method !== 'POST' || path !== '/answer') {
        return sendJson(res, 404, { ok: false, error: 'not found' })
      }
      const header = req.headers['authorization']
      const got = /^Bearer\s+(.+)$/i.exec(typeof header === 'string' ? header : '')
      if (!got || !safeEqual(got[1].trim(), token)) {
        return sendJson(res, 403, { ok: false, error: 'forbidden' })
      }
      let payload
      try {
        payload = JSON.parse(await readBody(req))
      } catch {
        return sendJson(res, 400, { ok: false, code: 'bad-choice', error: '请求不是合法 JSON' })
      }
      const result = answerer.submit(payload?.sessionId, payload?.text)
      if (result.ok) return sendJson(res, 200, result)
      if (result.code === 'no-pending') return sendJson(res, 409, result)
      return sendJson(res, 400, result)
    } catch {
      try {
        sendJson(res, 500, { ok: false, error: 'internal error' })
      } catch {
        // 响应已开始
      }
    }
  })

  const home = process.env.DSH_HOME
  const file = home ? join(home, 'wx-answerer.json') : ''
  server.listen(0, '127.0.0.1', () => {
    const addr = server.address()
    const port = addr && typeof addr === 'object' ? addr.port : 0
    if (!file || !port) return
    writeFileSync(file, JSON.stringify({ port, token }), { mode: 0o600 })
    try {
      chmodSync(file, 0o600)
    } catch {
      // 权限尽量收紧；失败不挡应答
    }
    console.log(`[wx-answerer] listening on 127.0.0.1:${port}`)
  })

  const stop = () => {
    server.close()
    if (file) {
      try {
        unlinkSync(file)
      } catch {
        // 文件可能还没写出来
      }
    }
  }
  if (typeof ctx.effect === 'function') ctx.effect(() => stop)
  else if (typeof ctx.on === 'function') ctx.on('dispose', stop)
}
