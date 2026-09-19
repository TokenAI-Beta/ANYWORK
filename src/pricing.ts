// 价格与费用计算（共享：CLI 与网关都从这里取）
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
export const prices = JSON.parse(readFileSync(join(here, '..', 'config', 'prices.json'), 'utf8'))

/** 把旧模型名折叠到当前计费名 */
export function resolveModel(m: string): string {
  return prices.aliases[m] ?? m
}

/** 按请求发生的 UTC 时刻判峰谷（高峰＝周一至周五 01:00-04:00、06:00-10:00 UTC） */
export function tierOf(ts: string): 'peak' | 'off_peak' {
  const d = new Date(ts.replace(' ', 'T') + 'Z')
  const day = d.getUTCDay()
  const h = d.getUTCHours()
  const peak = day >= 1 && day <= 5 && ((h >= 1 && h < 4) || (h >= 6 && h < 10))
  return peak ? 'peak' : 'off_peak'
}

export interface UsageRowLike {
  model?: string | null
  ts: string
  cache_hit_tokens: number
  cache_miss_tokens: number
  completion_tokens: number
}

/** 单条用量事件的估算费用（CNY） */
export function costOf(e: UsageRowLike): number {
  const mp = prices.models[resolveModel(e.model ?? '')]
  if (!mp) return 0
  const p = mp[tierOf(e.ts)]
  return (e.cache_hit_tokens * p.cache_hit + e.cache_miss_tokens * p.cache_miss + e.completion_tokens * p.output) / 1e6
}

/** 本月（UTC）起点，格式与 SQLite datetime('now') 一致 */
export function monthStartUtc(): string {
  const now = new Date()
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString().slice(0, 19).replace('T', ' ')
}
