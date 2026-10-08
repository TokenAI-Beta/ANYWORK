// 通知桥：把消息推给工作台外的渠道（webhook / 通知平台如微信）
// 零依赖：webhook 走全局 fetch；Hermes 走 Windows 侧 CLI（WSL interop 可直接执行）
import { execFile } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { createHmac, randomBytes } from 'node:crypto'
import { join } from 'node:path'
import { eventCost, monthStartUtc } from './pricing.ts'
import type { DatabaseSync } from 'node:sqlite'
import { ruleEnabled } from './auto.ts'

// Hermes CLI（可用 DESK_HERMES_CLI 覆盖；迁移机器时改这里）
const HERMES_CLI = process.env.DESK_HERMES_CLI || '/mnt/d/hermes/hermes-agent/venv/Scripts/hermes.exe'

export interface NotifyRoute {
  id: number
  name: string
  kind: string // webhook | hermes | telegram | whatsapp | feishu | dingtalk | wecom | discord | slack | teams | ntfy | zoom
  target: string
  enabled: number
  created_at: string
}

export interface NotifyMsg {
  title?: string
  text: string
  source?: string
  lang?: string
}

export interface NotifyResult {
  route: string
  kind: string
  ok: boolean
  info: string
}

export function listNotifyRoutes(db: DatabaseSync): NotifyRoute[] {
  return db.prepare(`SELECT id, name, kind, target, enabled, created_at FROM notify_routes ORDER BY id`).all() as unknown as NotifyRoute[]
}

/** 服务端双语（简易） */
function Ln(lang: string | undefined, zh: string, en: string): string {
  return lang === 'en' ? en : zh
}

/** 失败前缀（按消息语言） */
function pfail(msg: NotifyMsg): string {
  return msg.lang === 'en' ? 'Failed: ' : '失败：'
}

export function addNotifyRoute(db: DatabaseSync, r: { name: string; kind: string; target: string; lang?: string }): { ok: true } | { error: string } {
  const name = r.name.trim()
  const kind = r.kind.trim()
  const target = r.target.trim()
  const lang = r.lang
  if (!/^[a-z0-9][a-z0-9_-]{0,31}$/.test(name)) return { error: Ln(lang, '名称请用英文小写（如 wechat-me / wecom-group）', 'Name must be lowercase (e.g. wechat-me / wecom-group)') }
  const KINDS = ['webhook', 'hermes', 'telegram', 'whatsapp', 'feishu', 'dingtalk', 'wecom', 'discord', 'slack', 'teams', 'ntfy', 'zoom']
  if (!KINDS.includes(kind)) return { error: Ln(lang, 'kind 只支持 webhook / hermes / telegram / whatsapp / feishu / dingtalk / wecom / discord / slack / teams / ntfy / zoom', 'kind must be one of webhook / hermes / telegram / whatsapp / feishu / dingtalk / wecom / discord / slack / teams / ntfy / zoom') }
  if (!target) return { error: Ln(lang, '目标不能为空', 'Target cannot be empty') }
  if (kind === 'webhook' && !/^https?:\/\//.test(target)) return { error: Ln(lang, 'webhook 目标需为 http(s):// 开头的 URL', 'webhook target must be an http(s):// URL') }
  if ((kind === 'feishu' || kind === 'wecom' || kind === 'discord' || kind === 'slack' || kind === 'teams' || kind === 'zoom') && !/^https?:\/\//.test(target.split('|')[0].trim()))
    return { error: kind + Ln(lang, ' 目标需为 http(s):// Webhook 地址', ' target must be an http(s):// webhook URL') }
  if (kind === 'dingtalk' && !/^https?:\/\//.test(target.split('|')[0].trim()))
    return { error: Ln(lang, 'dingtalk 目标格式：webhook地址[|加签Secret]', 'dingtalk target: webhook URL[|secret]') }
  if (kind === 'ntfy') {
    const pn = target.split('|').map((x) => x.trim())
    if (!pn[0]) return { error: Ln(lang, 'ntfy 目标格式：主题名[|服务器地址[|Token]]', 'ntfy target: topic[|server[|token]]') }
  }
  if (kind === 'telegram') {
    const p = target.split('|')
    if (!p[0] || !p[1]) return { error: Ln(lang, 'telegram 目标格式：bot_token|chat_id（可加 |api_base）', 'telegram target: bot_token|chat_id (optional |api_base)') }
  }
  if (kind === 'whatsapp') {
    const p = target.split('|').map((x) => x.trim())
    const shapeOk =
      (p[0] === 'callmebot' && !!p[1] && !!p[2]) ||
      (p[0] === 'greenapi' && !!p[1] && !!p[2] && !!p[3]) ||
      (p[0] === 'ultramsg' && !!p[1] && !!p[2] && !!p[3])
    if (!shapeOk) return { error: Ln(lang, 'whatsapp 格式：callmebot|apikey|手机号 或 greenapi|id|token|chatId 或 ultramsg|id|token|to', 'whatsapp target: callmebot|apikey|phone or greenapi|id|token|chatId or ultramsg|id|token|to') }
  }
  if (db.prepare(`SELECT id FROM notify_routes WHERE name = ?`).get(name)) return { error: Ln(lang, '同名通道已存在', 'A route with this name already exists') }
  db.prepare(`INSERT INTO notify_routes (name, kind, target) VALUES (?, ?, ?)`).run(name, kind, target)
  return { ok: true }
}

export function removeNotifyRoute(db: DatabaseSync, name: string): void {
  db.prepare(`DELETE FROM notify_routes WHERE name = ?`).run(name)
}

export function toggleNotifyRoute(db: DatabaseSync, name: string): void {
  const r = db.prepare(`SELECT enabled FROM notify_routes WHERE name = ?`).get(name) as { enabled: number } | undefined
  if (r) db.prepare(`UPDATE notify_routes SET enabled = ? WHERE name = ?`).run(r.enabled === 1 ? 0 : 1, name)
}

function sendViaWebhook(url: string, msg: NotifyMsg): Promise<string> {
  return new Promise((resolve) => {
    const ctrl = new AbortController()
    const t = setTimeout(() => ctrl.abort(), 12000)
    fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ title: msg.title ?? '', text: msg.text, source: msg.source ?? 'workbench', ts: new Date().toISOString() }),
      signal: ctrl.signal,
    })
      .then((r) => r.text().then((b) => resolve(`HTTP ${r.status}${b ? ' ' + b.slice(0, 80) : ''}`)))
      .catch((e) => resolve(pfail(msg) + String((e && (e as Error).message) || e).slice(0, 120)))
      .finally(() => clearTimeout(t))
  })
}

function sendViaHermes(target: string, msg: NotifyMsg): Promise<string> {
  return new Promise((resolve) => {
    const text = (msg.title ? `【${msg.title}】\n` : '') + msg.text
    execFile(HERMES_CLI, ['send', '-t', target, '-q', text], { timeout: 60000 }, (err, stdout, stderr) => {
      if (err) {
        resolve(pfail(msg) + String(err.message).slice(0, 140) + (stderr ? ' / ' + String(stderr).slice(0, 80) : ''))
        return
      }
      resolve(`ok${stdout ? ' ' + String(stdout).trim().slice(0, 60) : ''}`)
    })
  })
}

// Telegram（Bot API；target = bot_token|chat_id[|api_base]，api_base 可指反代）
async function sendViaTelegram(target: string, msg: NotifyMsg): Promise<string> {
  const parts = target.split('|')
  const token = (parts[0] || '').trim()
  const chat = (parts[1] || '').trim()
  const base = (parts[2] || 'https://api.telegram.org').trim().replace(/\/+$/, '')
  if (!token || !chat) return Ln(msg.lang, '失败：telegram 目标格式应为 bot_token|chat_id[|api_base]', 'Failed: telegram target should be bot_token|chat_id[|api_base]')
  const text = (msg.title ? `【${msg.title}】\n` : '') + msg.text
  const ctrl = new AbortController()
  const t = setTimeout(() => ctrl.abort(), 12000)
  try {
    const r = await fetch(`${base}/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ chat_id: chat, text, disable_web_page_preview: true }),
      signal: ctrl.signal,
    })
    const b = await r.text()
    if (!r.ok) return pfail(msg) + 'HTTP ' + r.status + ' ' + b.slice(0, 120)
    return `ok tg:${chat}`
  } catch (e) {
    const cause = (e as { cause?: { message?: string } })?.cause?.message
    return pfail(msg) + String(cause || (e as Error)?.message || e).slice(0, 120)
  } finally {
    clearTimeout(t)
  }
}

// WhatsApp（三种网关；target = provider|字段…[|base]）
async function sendViaWhatsapp(target: string, msg: NotifyMsg): Promise<string> {
  const parts = target.split('|').map((x) => x.trim())
  const provider = parts[0]
  const text = (msg.title ? `【${msg.title}】\n` : '') + msg.text
  const ctrl = new AbortController()
  const t = setTimeout(() => ctrl.abort(), 12000)
  try {
    if (provider === 'callmebot') {
      const key = parts[1] || ''
      const phone = parts[2] || ''
      const base = (parts[3] || 'https://api.callmebot.com').replace(/\/+$/, '')
      if (!key || !phone) return Ln(msg.lang, '失败：whatsapp 目标格式应为 callmebot|apikey|手机号[|base]', 'Failed: whatsapp target should be callmebot|apikey|phone[|base]')
      const r = await fetch(
        `${base}/whatsapp.php?phone=${encodeURIComponent(phone)}&text=${encodeURIComponent(text)}&apikey=${encodeURIComponent(key)}`,
        { signal: ctrl.signal },
      )
      const b = await r.text()
      if (!r.ok || /error/i.test(b.slice(0, 400))) return pfail(msg) + 'HTTP ' + r.status + ' ' + b.slice(0, 100)
      return `ok wa:${provider}:${phone}`
    }
    if (provider === 'greenapi') {
      const id = parts[1] || ''
      const token = parts[2] || ''
      const chat = parts[3] || ''
      const base = (parts[4] || 'https://api.green-api.com').replace(/\/+$/, '')
      if (!id || !token || !chat) return Ln(msg.lang, '失败：whatsapp 目标格式应为 greenapi|idInstance|apiToken|chatId[|base]', 'Failed: whatsapp target should be greenapi|idInstance|apiToken|chatId[|base]')
      const r = await fetch(`${base}/waInstance${id}/sendMessage/${token}`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ chatId: chat, message: text }),
        signal: ctrl.signal,
      })
      const b = await r.text()
      if (!r.ok) return `失败：HTTP ${r.status} ${b.slice(0, 120)}`
      return `ok wa:${provider}:${chat}`
    }
    if (provider === 'ultramsg') {
      const id = parts[1] || ''
      const token = parts[2] || ''
      const to = parts[3] || ''
      const base = (parts[4] || 'https://api.ultramsg.com').replace(/\/+$/, '')
      if (!id || !token || !to) return Ln(msg.lang, '失败：whatsapp 目标格式应为 ultramsg|instanceId|token|to[|base]', 'Failed: whatsapp target should be ultramsg|instanceId|token|to[|base]')
      const form = new URLSearchParams({ token, to, body: text })
      const r = await fetch(`${base}/instance${id}/messages/chat`, {
        method: 'POST',
        headers: { 'content-type': 'application/x-www-form-urlencoded' },
        body: form.toString(),
        signal: ctrl.signal,
      })
      const b = await r.text()
      if (!r.ok) return `失败：HTTP ${r.status} ${b.slice(0, 120)}`
      return `ok wa:${provider}:${to}`
    }
    return Ln(msg.lang, '失败：whatsapp provider 仅支持 callmebot / greenapi / ultramsg', 'Failed: whatsapp provider must be callmebot / greenapi / ultramsg')
  } catch (e) {
    const cause = (e as { cause?: { message?: string } })?.cause?.message
    return pfail(msg) + String(cause || (e as Error)?.message || e).slice(0, 120)
  } finally {
    clearTimeout(t)
  }
}

// —— 平台群机器人 / Webhook（飞书 / 钉钉 / 企业微信 / Discord / Slack / Teams / ntfy）——
// 共同特征：贴一个 Webhook 地址（或主题名）就能推，属于"消息出口"。
async function postPlatform(url: string, body: unknown, headers?: Record<string, string>, en = false): Promise<{ status: number; body: string }> {
  const ctrl = new AbortController()
  const t = setTimeout(() => ctrl.abort(), 12000)
  try {
    const r = await fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json', ...(headers || {}) },
      body: JSON.stringify(body),
      signal: ctrl.signal,
    })
    const b = await r.text()
    return { status: r.status, body: b }
  } catch (e) {
    const cause = (e as { cause?: { message?: string } })?.cause?.message
    return { status: 0, body: (en ? 'Failed: ' : '失败：') + String(cause || (e as Error)?.message || e).slice(0, 120) }
  } finally {
    clearTimeout(t)
  }
}

function httpFail(status: number, body: string, en = false): string | null {
  if (status === 0) return body
  if (status >= 400) return (en ? 'Failed: HTTP ' : '失败：HTTP ') + status + ' ' + body.slice(0, 100)
  return null
}

// 飞书自定义机器人：{"code":0} 为成功
async function sendViaFeishu(target: string, msg: NotifyMsg): Promise<string> {
  const en = msg.lang === 'en'
  const url = target.split('|')[0].trim()
  const text = (msg.title ? '【' + msg.title + '】\n' : '') + msg.text
  const r = await postPlatform(url, { msg_type: 'text', content: { text } }, undefined, en)
  const f = httpFail(r.status, r.body, en)
  if (f) return f
  try {
    const d = JSON.parse(r.body) as { code?: number; msg?: string }
    if (d.code !== undefined && Number(d.code) !== 0) return ((en ? 'Failed: Feishu code=' : '失败：飞书 code=') + d.code + ' ' + String(d.msg || '')).slice(0, 160)
  } catch {
    // 非 JSON 视为 ok
  }
  return 'ok feishu'
}

// 钉钉自定义机器人：{errcode:0} 为成功；可选加签（target = url|SEC…）
async function sendViaDingtalk(target: string, msg: NotifyMsg): Promise<string> {
  const en = msg.lang === 'en'
  const parts = target.split('|').map((x) => x.trim())
  let url = parts[0]
  const secret = parts[1] || ''
  if (secret) {
    const ts = Date.now().toString()
    const sign = encodeURIComponent(createHmac('sha256', secret).update(ts + '\n' + secret).digest('base64'))
    url += (url.includes('?') ? '&' : '?') + 'timestamp=' + ts + '&sign=' + sign
  }
  const text = (msg.title ? '【' + msg.title + '】\n' : '') + msg.text
  const r = await postPlatform(url, { msgtype: 'text', text: { content: text } }, undefined, en)
  const f = httpFail(r.status, r.body, en)
  if (f) return f
  try {
    const d = JSON.parse(r.body) as { errcode?: number; errmsg?: string }
    if (d.errcode !== undefined && Number(d.errcode) !== 0) return ((en ? 'Failed: DingTalk errcode=' : '失败：钉钉 errcode=') + d.errcode + ' ' + String(d.errmsg || '')).slice(0, 160)
  } catch {
    // ignore
  }
  return 'ok dingtalk'
}

// 企业微信群机器人：{errcode:0} 为成功
async function sendViaWecom(target: string, msg: NotifyMsg): Promise<string> {
  const en = msg.lang === 'en'
  const url = target.split('|')[0].trim()
  const text = (msg.title ? '【' + msg.title + '】\n' : '') + msg.text
  const r = await postPlatform(url, { msgtype: 'text', text: { content: text } }, undefined, en)
  const f = httpFail(r.status, r.body, en)
  if (f) return f
  try {
    const d = JSON.parse(r.body) as { errcode?: number; errmsg?: string }
    if (d.errcode !== undefined && Number(d.errcode) !== 0) return ((en ? 'Failed: WeCom errcode=' : '失败：企微 errcode=') + d.errcode + ' ' + String(d.errmsg || '')).slice(0, 160)
  } catch {
    // ignore
  }
  return 'ok wecom'
}

// Discord 频道 Webhook（成功 = 204 无正文）
async function sendViaDiscord(target: string, msg: NotifyMsg): Promise<string> {
  const en = msg.lang === 'en'
  const url = target.split('|')[0].trim()
  const text = ((msg.title ? '【' + msg.title + '】\n' : '') + msg.text).slice(0, 1900)
  const r = await postPlatform(url, { content: text }, undefined, en)
  if (r.status === 0) return r.body
  if (r.status >= 400) {
    let m = ''
    try {
      m = String((JSON.parse(r.body) as { message?: string }).message || '')
    } catch {
      // ignore
    }
    return (en ? 'Failed: HTTP ' : '失败：HTTP ') + r.status + ' ' + (m || r.body.slice(0, 80))
  }
  return 'ok discord'
}

// Slack Incoming Webhook（成功正文为 ok）
async function sendViaSlack(target: string, msg: NotifyMsg): Promise<string> {
  const en = msg.lang === 'en'
  const url = target.split('|')[0].trim()
  const text = (msg.title ? '【' + msg.title + '】\n' : '') + msg.text
  const r = await postPlatform(url, { text }, undefined, en)
  const f = httpFail(r.status, r.body, en)
  if (f) return f
  if (!/^ok/i.test(r.body.trim())) return ((en ? 'Failed: Slack returned ' : '失败：Slack 返回 ') + r.body.slice(0, 100))
  return 'ok slack'
}

// Microsoft Teams 频道 Incoming Webhook
async function sendViaTeams(target: string, msg: NotifyMsg): Promise<string> {
  const en = msg.lang === 'en'
  const url = target.split('|')[0].trim()
  const text = (msg.title ? '【' + msg.title + '】\n' : '') + msg.text
  const r = await postPlatform(url, { text }, undefined, en)
  const f = httpFail(r.status, r.body, en)
  if (f) return f
  if (/error/i.test(r.body.slice(0, 200))) return ((en ? 'Failed: Teams returned ' : '失败：Teams 返回 ') + r.body.slice(0, 100))
  return 'ok teams'
}

// ntfy（target = 主题名[|服务器地址[|Token]]；默认公共服务器 ntfy.sh）
async function sendViaNtfy(target: string, msg: NotifyMsg): Promise<string> {
  const en = msg.lang === 'en'
  const parts = target.split('|').map((x) => x.trim())
  const topic = parts[0]
  const server = (parts[1] || 'https://ntfy.sh').replace(/\/+$/, '')
  const token = parts[2] || ''
  if (!topic) return Ln(msg.lang, '失败：ntfy 目标格式应为 主题名[|服务器地址[|Token]]', 'Failed: ntfy target should be topic[|server[|token]]')
  const headers: Record<string, string> = {}
  if (token) headers.authorization = 'Bearer ' + token
  const r = await postPlatform(server, { topic, title: msg.title || '', message: msg.text, tags: [] }, headers, en)
  const f = httpFail(r.status, r.body, en)
  if (f) return f
  try {
    const d = JSON.parse(r.body) as { id?: string }
    if (!d.id) return ((en ? 'Failed: ntfy returned ' : '失败：ntfy 返回 ') + r.body.slice(0, 100))
  } catch {
    return ((en ? 'Failed: ntfy returned ' : '失败：ntfy 返回 ') + r.body.slice(0, 100))
  }
  return 'ok ntfy'
}

// Zoom Team Chat Incoming Webhook（Zoom 客户端 → 聊天 → 应用 → Incoming Webhook，付费版）
async function sendViaZoom(target: string, msg: NotifyMsg): Promise<string> {
  const en = msg.lang === 'en'
  const url = target.split('|')[0].trim()
  const text = (msg.title ? '【' + msg.title + '】\n' : '') + msg.text
  const r = await postPlatform(url, { content: { head: { text: msg.title || 'DSH-ANYWORK' }, body: [{ type: 'message', text }] } }, undefined, en)
  const f = httpFail(r.status, r.body, en)
  if (f) return f
  return 'ok zoom'
}

// 微信（hermes 通道）失败重试：阶梯退避（iLink 上游限流带 30s 冷却；被拒时 CLI 非零退出）
// 逐次把结果回填 notify_log：某次成功则置 ok=1；全部失败则保留最后一次错误
const HERMES_RETRY_DELAYS_MS = [45_000, 180_000, 600_000]
function scheduleHermesRetry(db: DatabaseSync, logId: number, target: string, msg: NotifyMsg, attempt = 0): void {
  if (attempt >= HERMES_RETRY_DELAYS_MS.length) return
  const timer = setTimeout(() => {
    void (async () => {
      try {
        const info = await sendViaHermes(target, msg)
        if (!/^(失败|未知|Failed|Unknown)/.test(info)) {
          db.prepare(`UPDATE notify_log SET ok = 1, info = ? WHERE id = ?`).run(Ln(msg.lang, `ok（第 ${attempt + 1} 次重试成功）`, `ok (retry #${attempt + 1} succeeded)`), logId)
        } else {
          db.prepare(`UPDATE notify_log SET info = ? WHERE id = ?`).run(info.slice(0, 200), logId)
          scheduleHermesRetry(db, logId, target, msg, attempt + 1)
        }
      } catch {
        // 重试本身异常：保持已有记录
      }
    })()
  }, HERMES_RETRY_DELAYS_MS[attempt])
  if (typeof timer.unref === 'function') timer.unref()
}

const SENDERS: Record<string, (target: string, msg: NotifyMsg) => Promise<string>> = {
  webhook: sendViaWebhook,
  hermes: sendViaHermes,
  telegram: sendViaTelegram,
  whatsapp: sendViaWhatsapp,
  feishu: sendViaFeishu,
  dingtalk: sendViaDingtalk,
  wecom: sendViaWecom,
  discord: sendViaDiscord,
  slack: sendViaSlack,
  teams: sendViaTeams,
  ntfy: sendViaNtfy,
  zoom: sendViaZoom,
}

export async function dispatchNotify(db: DatabaseSync, msg: NotifyMsg, opts?: { kind?: string; lang?: string }): Promise<NotifyResult[]> {
  if (opts && opts.lang && !msg.lang) msg.lang = opts.lang
  let routes = listNotifyRoutes(db).filter((r) => r.enabled === 1)
  if (opts && opts.kind) routes = routes.filter((r) => r.kind === opts.kind)
  const results: NotifyResult[] = []
  for (const r of routes) {
    const sender = SENDERS[r.kind]
    const info = sender ? await sender(r.target, msg) : Ln(msg.lang, '未知通道类型', 'Unknown channel type')
    const ok = !/^(失败|未知|Failed|Unknown)/.test(info)
    const ins = db.prepare(`INSERT INTO notify_log (route_id, route_name, title, text, ok, info) VALUES (?, ?, ?, ?, ?, ?)`).run(
      r.id,
      r.name,
      msg.title ?? '',
      msg.text.slice(0, 500),
      ok ? 1 : 0,
      info,
    )
    if (r.kind === 'hermes' && !ok) scheduleHermesRetry(db, Number(ins.lastInsertRowid), r.target, msg)
    results.push({ route: r.name, kind: r.kind, ok, info })
  }
  if (!routes.length) {
    results.push(
      opts && opts.kind
        ? { route: '(' + opts.kind + Ln(msg.lang, ' 未配置)', ' not configured)'), kind: opts.kind, ok: false, info: Ln(msg.lang, '该平台还没有配置通道——先在连接器页「连接」一个', 'No route for this platform yet — connect one on the Connectors page') }
        : { route: Ln(msg.lang, '(无启用的通知通道)', '(no enabled routes)'), kind: '-', ok: false, info: Ln(msg.lang, '请先在 设置 →「通知」里添加一个通道', 'Add a route in Settings → Notifications first') },
    )
  }
  return results
}

export function listNotifyLog(db: DatabaseSync, limit = 10): Record<string, unknown>[] {
  return db.prepare(`SELECT ts, route_name, title, text, ok, info FROM notify_log ORDER BY id DESC LIMIT ?`).all(limit) as unknown as Record<string, unknown>[]
}

// —— 令牌（agent 侧 desk-notify 脚本用；仅本机文件，无外部暴露）——
export function notifyTokenPath(dataDir: string): string {
  return join(dataDir, 'notify.token')
}

export function readOrCreateNotifyToken(dataDir: string): string {
  const p = notifyTokenPath(dataDir)
  try {
    if (existsSync(p)) {
      const t = readFileSync(p, 'utf8').trim()
      if (t) return t
    }
  } catch {
    // 读失败按不存在处理
  }
  const t = randomBytes(24).toString('hex')
  try {
    mkdirSync(dataDir, { recursive: true })
    writeFileSync(p, t + '\n', { mode: 0o600 })
  } catch {
    // 写失败时返回内存令牌（重启后更换）
  }
  return t
}

// —— 定时提醒（到点经通知桥推送）——

export interface Reminder {
  id: number
  at_epoch: number
  title: string | null
  text: string
  source: string | null
  sent: number
  sent_at: string | null
  info: string | null
  created_at: string
}

export function addReminder(
  db: DatabaseSync,
  r: { atEpoch: number; title?: string; text: string; source?: string },
): { ok: true; id: number; atEpoch: number } | { error: string } {
  const at = Math.floor(Number(r.atEpoch))
  if (!Number.isFinite(at) || at < Math.floor(Date.now() / 1000) - 60) return { error: '时间无效或已过去' }
  const text = r.text.trim()
  if (!text) return { error: '内容不能为空' }
  const info = db
    .prepare(`INSERT INTO reminders (at_epoch, title, text, source) VALUES (?, ?, ?, ?)`)
    .run(at, (r.title ?? '').trim() || null, text, r.source ?? null)
  return { ok: true, id: Number(info.lastInsertRowid), atEpoch: at }
}

export function listReminders(db: DatabaseSync): Reminder[] {
  return db.prepare(`SELECT id, at_epoch, title, text, source, sent, sent_at, info, created_at FROM reminders WHERE sent = 0 ORDER BY at_epoch LIMIT 50`).all() as unknown as Reminder[]
}

export function listRemindersSent(db: DatabaseSync, limit = 5): Reminder[] {
  return db.prepare(`SELECT id, at_epoch, title, text, source, sent, sent_at, info, created_at FROM reminders WHERE sent = 1 ORDER BY id DESC LIMIT ?`).all(limit) as unknown as Reminder[]
}

export function removeReminder(db: DatabaseSync, id: number): void {
  db.prepare(`DELETE FROM reminders WHERE id = ?`).run(id)
}

export async function checkReminders(db: DatabaseSync): Promise<number> {
  const due = db
    .prepare(`SELECT id, at_epoch, title, text, source FROM reminders WHERE sent = 0 AND at_epoch <= ? ORDER BY at_epoch`)
    .all(Math.floor(Date.now() / 1000)) as unknown as Reminder[]
  for (const r of due) {
    const results = await dispatchNotify(db, { title: r.title || '到点提醒', text: r.text, source: r.source || 'reminder' })
    const info = results
      .map((x) => `${x.route}:${x.ok ? 'ok' : x.info}`)
      .join('; ')
      .slice(0, 200)
    db.prepare(`UPDATE reminders SET sent = 1, sent_at = datetime('now'), info = ? WHERE id = ?`).run(info, r.id)
  }
  return due.length
}

// —— 预算告警（本月用量跨过 80% / 100% 时经通知桥提醒管理员；每月每档只发一次）——
function fmtCny(n: number): string {
  return n >= 0.01 ? n.toFixed(2) : n.toFixed(6)
}

export async function maybeBudgetAlert(db: DatabaseSync, userId: number): Promise<void> {
  const u = db.prepare(`SELECT username, monthly_budget_cny AS budget FROM users WHERE id = ?`).get(userId) as
    | { username: string; budget: number | null }
    | undefined
  if (!u || u.budget == null || u.budget <= 0) return
  const start = monthStartUtc()
  const rows = db.prepare(`SELECT * FROM usage_events WHERE user_id = ? AND ts >= ?`).all(userId, start) as unknown as Parameters<typeof eventCost>[0][]
  let sum = 0
  for (const r of rows) sum += eventCost(r)
  const pct = sum / u.budget
  const level = pct >= 1 ? 100 : pct >= 0.8 ? 80 : 0
  if (level === 0) return
  // 规则卡 'budget80' 关掉后不再推 80% 档（100% 档保底提醒不受影响）
  if (level === 80 && !ruleEnabled(db, 'budget80')) return
  const month = start.slice(0, 7)
  const ins = db.prepare(`INSERT OR IGNORE INTO budget_alerts (user_id, month, level) VALUES (?, ?, ?)`).run(userId, month, level)
  if (ins.changes === 0) return
  await dispatchNotify(db, {
    title: '预算提醒',
    text: `成员 ${u.username} 本月用量已到预算的 ${level}%（¥${fmtCny(sum)} / ¥${u.budget}）。`,
    source: 'budget',
  })
}
