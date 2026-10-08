// 「我的微信」自助绑定：出码（SVG）→ 成员扫码确认 → 自动接入（微信桥 + 通知路由）
// 流程：POST /portal/api/wx/bind-start → { ok, id, svg }
//       GET  /portal/api/wx/bind-status?id= → { status: wait|scaned|confirmed|expired }
import type { DatabaseSync } from 'node:sqlite'
import { createRequire } from 'node:module'
import { randomUUID } from 'node:crypto'
import { addNotifyRoute, listNotifyRoutes } from './notify.ts'

const require_ = createRequire(import.meta.url)
const qrcodeLib = require_('./vendor/qrcode-generator.cjs') as (typeNumber: number, level: string) => {
  addData: (data: string) => void
  make: () => void
  createSvgTag: (opts?: Record<string, unknown>) => string
}

const BASE_DEFAULT = 'https://ilinkai.weixin.qq.com'
const PENDING_TTL_MS = 10 * 60_000

interface BindRec {
  user: string
  qrcode: string
  host: string
  createdAt: number
}

const pending = new Map<string, BindRec>()

async function getJson(url: string): Promise<Record<string, unknown>> {
  const ctrl = new AbortController()
  const t = setTimeout(() => ctrl.abort(), 12000)
  try {
    const r = await fetch(url, { signal: ctrl.signal })
    const txt = await r.text()
    try {
      const j = JSON.parse(txt) as unknown
      return j && typeof j === 'object' ? (j as Record<string, unknown>) : {}
    } catch {
      return {}
    }
  } finally {
    clearTimeout(t)
  }
}

/** 把内容渲染成 SVG 二维码（服务端零依赖） */
export function renderQrSvg(content: string): string {
  const qr = qrcodeLib(0, 'M')
  qr.addData(content)
  qr.make()
  return qr.createSvgTag({ cellSize: 5, margin: 2 })
}

/** 出码：为该成员生成一个新二维码（同一成员旧的待扫二维码自动作废） */
export async function startWxBind(user: string): Promise<{ ok: true; id: string; svg: string } | { error: string }> {
  for (const [k, v] of pending) if (v.user === user) pending.delete(k)
  const j = await getJson(BASE_DEFAULT + '/ilink/bot/get_bot_qrcode?bot_type=3')
  const qr = String(j['qrcode'] || '')
  const content = String(j['qrcode_img_content'] || '')
  if (!qr || !content) return { error: '取码失败，请稍后重试（Failed to fetch a QR code）' }
  const id = randomUUID()
  pending.set(id, { user, qrcode: qr, host: 'ilinkai.weixin.qq.com', createdAt: Date.now() })
  return { ok: true, id, svg: renderQrSvg(content) }
}

/** 轮询状态；confirmed 时落库（微信桥绑定 + 通知路由） */
export async function checkWxBind(db: DatabaseSync, user: string, id: string): Promise<Record<string, unknown>> {
  const rec = pending.get(id)
  if (!rec || rec.user !== user) return { status: 'expired' }
  if (Date.now() - rec.createdAt > PENDING_TTL_MS) {
    pending.delete(id)
    return { status: 'expired' }
  }
  let j: Record<string, unknown> = {}
  try {
    const host = rec.host || 'ilinkai.weixin.qq.com'
    j = await getJson(`https://${host}/ilink/bot/get_qrcode_status?qrcode=${encodeURIComponent(rec.qrcode)}`)
  } catch {
    return { status: 'wait' }
  }
  const st = String(j['status'] || 'wait')
  if (st === 'scaned_but_redirect') {
    if (j['redirect_host']) rec.host = String(j['redirect_host'])
    return { status: 'scaned' }
  }
  if (st === 'wait' || st === 'scaned') return { status: st }
  if (st === 'expired') {
    pending.delete(id)
    return { status: 'expired' }
  }
  if (st !== 'confirmed') return { status: 'wait' }
  const openid = String(j['ilink_user_id'] || '')
  const token = String(j['bot_token'] || '')
  const base = String(j['baseurl'] || j['base_url'] || BASE_DEFAULT)
  if (!openid || !token) {
    pending.delete(id)
    return { status: 'expired' }
  }
  // 替换旧绑定（同一成员重新接入）
  const olds = db.prepare(`SELECT id FROM wx_chat WHERE account = ?`).all(user) as unknown as { id: number }[]
  for (const o of olds) {
    db.prepare(`DELETE FROM wx_chat_log WHERE chat_id = ?`).run(o.id)
    db.prepare(`DELETE FROM wx_chat WHERE id = ?`).run(o.id)
  }
  db.prepare(`INSERT INTO wx_chat (account, label, openid, token, base_url, enabled) VALUES (?, ?, ?, ?, ?, 1)`).run(
    user,
    user,
    openid,
    token,
    base,
  )
  // 通知路由（同名更新）
  const routeName = `wechat-${user}`
  const target = openid + '|' + token + '|' + base
  if (listNotifyRoutes(db).some((r) => r.name === routeName)) {
    db.prepare(`UPDATE notify_routes SET target = ?, kind = 'weixin', enabled = 1 WHERE name = ?`).run(target, routeName)
  } else {
    addNotifyRoute(db, { name: routeName, kind: 'weixin', target })
  }
  pending.delete(id)
  return { status: 'confirmed', bound: true }
}
