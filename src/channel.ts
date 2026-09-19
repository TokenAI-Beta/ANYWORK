// 多上游通道：模型分流与通道计价
// 表 channels 存"外部 OpenAI 兼容上游"；默认通道 = DeepSeek 官方（不在此表内，由网关启动参数提供）
import type { DatabaseSync } from 'node:sqlite'

export interface Channel {
  id: number
  name: string
  base_url: string
  api_key: string | null
  models: string[]
  prices: Record<string, { in?: number; out?: number }>
  enabled: number
  note: string | null
}

function parseJson<T>(s: unknown, fallback: T): T {
  try {
    return JSON.parse(String(s)) as T
  } catch {
    return fallback
  }
}

export function listChannels(db: DatabaseSync): Channel[] {
  const rows = db.prepare(`SELECT * FROM channels ORDER BY id`).all() as Array<Record<string, unknown>>
  return rows.map((r) => ({
    id: Number(r.id),
    name: String(r.name),
    base_url: String(r.base_url),
    api_key: (r.api_key as string | null) ?? null,
    models: parseJson<string[]>(r.models, []),
    prices: parseJson<Record<string, { in?: number; out?: number }>>(r.prices, {}),
    enabled: Number(r.enabled ?? 1),
    note: (r.note as string | null) ?? null,
  }))
}

/** 模型名 → 通道（enabled 且 models 精确命中）；未命中返回 undefined = 走默认通道 */
export function routeFor(channels: Channel[], model: string | null): Channel | undefined {
  if (!model) return undefined
  return channels.find((c) => c.enabled === 1 && c.models.includes(model))
}

/** 通道费用（¥）：价目表按 ¥/百万 tokens；通道未配该模型价目表返回 null（记 0） */
export function channelCost(ch: Channel, model: string | null, promptTokens: number, completionTokens: number): number | null {
  if (!model) return null
  const p = ch.prices[model]
  if (!p) return null
  return (promptTokens * (p.in ?? 0) + completionTokens * (p.out ?? 0)) / 1e6
}

export function addChannel(
  db: DatabaseSync,
  input: {
    name: string
    base_url: string
    api_key?: string
    models: string[]
    prices?: Record<string, { in?: number; out?: number }>
    note?: string
  },
): { ok: true; id: number } | { error: string } {
  const name = input.name.trim()
  if (!/^[a-z0-9][a-z0-9_-]{0,31}$/.test(name)) return { error: '通道名需为小写字母数字（可含 - _），不超过 32 位' }
  if (!/^https?:\/\//.test(input.base_url)) return { error: 'Base URL 需以 http(s):// 开头' }
  if (!input.models.length) return { error: '至少要写一个模型名' }
  const dup = db.prepare(`SELECT id FROM channels WHERE name = ?`).get(name)
  if (dup) return { error: `通道名已存在：${name}` }
  const info = db
    .prepare(`INSERT INTO channels (name, base_url, api_key, models, prices, note) VALUES (?, ?, ?, ?, ?, ?)`)
    .run(
      name,
      input.base_url.trim(),
      input.api_key ?? null,
      JSON.stringify(input.models),
      JSON.stringify(input.prices ?? {}),
      input.note ?? null,
    )
  return { ok: true, id: Number(info.lastInsertRowid) }
}

export function removeChannel(db: DatabaseSync, name: string): boolean {
  const info = db.prepare(`DELETE FROM channels WHERE name = ?`).run(name)
  return Number(info.changes) > 0
}

export function setChannelEnabled(db: DatabaseSync, name: string, on: boolean): boolean {
  const info = db.prepare(`UPDATE channels SET enabled = ? WHERE name = ?`).run(on ? 1 : 0, name)
  return Number(info.changes) > 0
}
