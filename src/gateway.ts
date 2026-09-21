// 模型网关（P1 → 多通道版）：OpenAI 兼容代理
// - 校验虚拟钥匙（Bearer sk-desk-…）→ 按模型名分流（外部通道 / 默认通道）→ 换真 key 转发上游
// - 月度预算检查（超限 429；DESK_BUDGET_WARN_ONLY=1 时仅告警）
// - 流式 / 非流式都提取 usage → 写 usage_events（含通道与费用；缺失时用粗估并标 estimated=1）
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http'
import type { DatabaseSync } from 'node:sqlite'
import { hashToken } from './keys.ts'
import { eventCost, monthStartUtc } from './pricing.ts'
import { channelCost, listChannels, routeFor, type Channel } from './channel.ts'
import { maybeBudgetAlert } from './notify.ts'

export interface GatewayOptions {
  db: DatabaseSync
  upstream: string
  realKey: string
  port: number
}

interface AuthUser {
  id: number
  username: string
}

interface Usage {
  prompt_tokens?: number
  completion_tokens?: number
  prompt_cache_hit_tokens?: number
  prompt_cache_miss_tokens?: number
}

/** 很粗的兜底估算：约 2 字符 ≈ 1 token */
const estimateTokens = (s: string) => Math.ceil(s.length / 2)

function authenticate(db: DatabaseSync, req: IncomingMessage): AuthUser | undefined {
  const m = /^Bearer\s+(.+)$/i.exec(req.headers['authorization'] ?? '')
  if (!m) return undefined
  const row = db
    .prepare(
      `SELECT u.id AS id, u.username AS username
       FROM api_keys k JOIN users u ON u.id = k.user_id
       WHERE k.token_hash = ? AND k.revoked_at IS NULL AND u.status = 'active'`,
    )
    .get(hashToken(m[1].trim())) as AuthUser | undefined
  return row ?? undefined
}

function monthSpend(db: DatabaseSync, userId: number): number {
  const rows = db
    .prepare(
      `SELECT model, channel, cost_cny, ts, cache_hit_tokens, cache_miss_tokens, completion_tokens
       FROM usage_events WHERE user_id = ? AND ts >= ?`,
    )
    .all(userId, monthStartUtc()) as Array<Parameters<typeof eventCost>[0]>
  let sum = 0
  for (const r of rows) sum += eventCost(r)
  return sum
}

function record(
  db: DatabaseSync,
  userId: number,
  model: string | null,
  usage: Usage | undefined,
  status: string,
  fallback?: { prompt: number; completion: number },
  channel?: Channel,
): void {
  const u = usage ?? {}
  const promptTokens = u.prompt_tokens ?? fallback?.prompt ?? 0
  const completionTokens = u.completion_tokens ?? fallback?.completion ?? 0
  let channelName: string | null = null
  let costCny: number | null = null
  if (channel) {
    channelName = channel.name
    costCny = channelCost(channel, model, promptTokens, completionTokens)
  }
  db.prepare(
    `INSERT INTO usage_events
       (user_id, model, prompt_tokens, completion_tokens, cache_hit_tokens, cache_miss_tokens, estimated, status, usage_json, channel, cost_cny)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    userId,
    model,
    promptTokens,
    completionTokens,
    u.prompt_cache_hit_tokens ?? 0,
    channel ? (u.prompt_cache_miss_tokens ?? promptTokens) : (u.prompt_cache_miss_tokens ?? 0),
    usage ? 0 : 1,
    status,
    usage ? JSON.stringify(usage) : null,
    channelName,
    costCny,
  )
  // 预算告警（异步，不阻塞请求路径；80% / 100% 每用户每月各一次）
  void maybeBudgetAlert(db, userId).catch(() => {})
}

/** 从 SSE 文本尾部倒着找最后一个带 usage 的数据块 */
function extractUsageFromSse(tail: string): Usage | undefined {
  const lines = tail.split('\n')
  for (let i = lines.length - 1; i >= 0; i--) {
    const line = lines[i]
    if (!line.startsWith('data:')) continue
    const payload = line.slice(5).trim()
    if (!payload || payload === '[DONE]') continue
    try {
      const j = JSON.parse(payload)
      if (j && j.usage) return j.usage as Usage
    } catch {
      // 半行，跳过
    }
  }
  return undefined
}

function json(res: ServerResponse, code: number, body: unknown): void {
  res.writeHead(code, { 'content-type': 'application/json' })
  res.end(JSON.stringify(body))
}

export function startGateway(opts: GatewayOptions) {
  const server = createServer(async (req, res) => {
    const url = new URL(req.url ?? '/', 'http://localhost')
    try {
      if (req.method === 'GET' && url.pathname === '/healthz') {
        return json(res, 200, { ok: true, service: 'dsh-anywork-gateway' })
      }

      if (req.method === 'GET' && url.pathname === '/models') {
        // 默认上游（DeepSeek）列表 + 外部通道静态模型（enabled）合并下发
        const extra: Array<Record<string, unknown>> = []
        for (const ch of listChannels(opts.db)) {
          if (ch.enabled !== 1) continue
          for (const m of ch.models) extra.push({ id: m, object: 'model', owned_by: ch.name })
        }
        let upstreamText = ''
        let status = 502
        let ctype = 'application/json'
        try {
          const r = await fetch(opts.upstream + '/models', {
            headers: { authorization: `Bearer ${opts.realKey}` },
          })
          status = r.status
          ctype = r.headers.get('content-type') ?? 'application/json'
          upstreamText = await r.text()
        } catch {
          if (!extra.length) return json(res, 502, { error: { message: 'upstream unreachable', type: 'upstream_error' } })
        }
        if (!extra.length) {
          res.writeHead(status, { 'content-type': ctype })
          return res.end(upstreamText)
        }
        let data: unknown[] = []
        try {
          data = (JSON.parse(upstreamText).data ?? []) as unknown[]
        } catch {
          // 上游响应不可解析：仅返回外部通道模型
        }
        res.writeHead(200, { 'content-type': 'application/json' })
        return res.end(JSON.stringify({ object: 'list', data: [...data, ...extra] }))
      }

      if (req.method === 'POST' && url.pathname === '/chat/completions') {
        const user = authenticate(opts.db, req)
        if (!user) {
          return json(res, 401, { error: { message: 'invalid or missing api key', type: 'auth_error' } })
        }

        // 月度预算检查
        const budgetRow = opts.db
          .prepare(`SELECT monthly_budget_cny AS budget FROM users WHERE id = ?`)
          .get(user.id) as { budget: number | null } | undefined
        if (budgetRow?.budget != null) {
          const spent = monthSpend(opts.db, user.id)
          if (spent >= budgetRow.budget) {
            const message = `monthly budget exceeded (spent ¥${spent.toFixed(4)} >= budget ¥${budgetRow.budget})`
            if (process.env.DESK_BUDGET_WARN_ONLY === '1') {
              console.log(`[gw] WARN budget exceeded user=${user.username}: ${message}`)
            } else {
              console.log(`[gw] user=${user.username} blocked: ${message}`)
              return json(res, 429, { error: { message, type: 'budget_exceeded' } })
            }
          }
        }

        let body = ''
        for await (const chunk of req) body += chunk
        let requestedModel: string | null = null
        try {
          requestedModel = JSON.parse(body)?.model ?? null
        } catch {
          return json(res, 400, { error: { message: 'invalid JSON body', type: 'bad_request' } })
        }

        // 按模型名分流：外部通道精确命中 → 用通道 base/key；否则默认通道
        const routed = routeFor(listChannels(opts.db), requestedModel)
        const targetBase = (routed ? routed.base_url : opts.upstream).replace(/\/+$/, '')
        const targetKey = routed ? (routed.api_key ?? '') : opts.realKey
        const routeLabel = routed ? routed.name : 'default'

        let upstreamRes: Response
        try {
          upstreamRes = await fetch(targetBase + '/chat/completions', {
            method: 'POST',
            headers: { 'content-type': 'application/json', authorization: `Bearer ${targetKey}` },
            body,
          })
        } catch (err) {
          record(opts.db, user.id, requestedModel, undefined, 'upstream-error', undefined, routed)
          console.log(`[gw] user=${user.username} model=${requestedModel} channel=${routeLabel} upstream-error: ${String(err)}`)
          return json(res, 502, { error: { message: 'upstream unreachable', type: 'upstream_error' } })
        }

        const ctype = upstreamRes.headers.get('content-type') ?? ''
        res.writeHead(upstreamRes.status, { 'content-type': ctype })

        if (!upstreamRes.body) {
          res.end()
          record(opts.db, user.id, requestedModel, undefined, `empty-${upstreamRes.status}`, undefined, routed)
          return
        }

        if (ctype.includes('text/event-stream')) {
          const decoder = new TextDecoder()
          let tail = ''
          try {
            for await (const chunk of upstreamRes.body as unknown as AsyncIterable<Uint8Array>) {
              res.write(chunk)
              tail = (tail + decoder.decode(chunk, { stream: true })).slice(-16384)
            }
          } catch {
            // 客户端断开 / 上游中断：能记多少记多少
          }
          res.end()
          const usage = extractUsageFromSse(tail)
          record(
            opts.db,
            user.id,
            requestedModel,
            usage,
            'ok',
            {
              prompt: estimateTokens(body),
              completion: estimateTokens(tail),
            },
            routed,
          )
          console.log(
            `[gw] user=${user.username} model=${requestedModel} channel=${routeLabel} stream usage=${usage ? 'found' : 'estimated'}`,
          )
        } else {
          const text = await upstreamRes.text()
          res.end(text)
          let usage: Usage | undefined
          let respModel: string | null = null
          try {
            const j = JSON.parse(text)
            usage = j.usage
            respModel = j.model ?? null
          } catch {
            // 非 JSON 响应
          }
          record(
            opts.db,
            user.id,
            respModel ?? requestedModel,
            usage,
            'ok',
            {
              prompt: estimateTokens(body),
              completion: estimateTokens(text),
            },
            routed,
          )
          console.log(
            `[gw] user=${user.username} model=${respModel ?? requestedModel} channel=${routeLabel} usage=${usage ? 'found' : 'estimated'}`,
          )
        }
        return
      }

      return json(res, 404, { error: { message: 'not found' } })
    } catch (err) {
      console.log(`[gw] unhandled: ${String(err)}`)
      try {
        json(res, 500, { error: { message: 'internal error' } })
      } catch {
        // 响应已开始，忽略
      }
    }
  })
  server.listen(opts.port, '127.0.0.1')
  console.log(`[gw] listening on http://127.0.0.1:${opts.port} -> ${opts.upstream}`)
  return server
}
