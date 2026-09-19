// 模型网关（P1）：OpenAI 兼容代理
// - 校验虚拟钥匙（Bearer sk-desk-…）→ 换真 key 转发上游
// - 流式 / 非流式都提取 usage → 写 usage_events（缺失时用粗估并标 estimated=1）
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http'
import type { DatabaseSync } from 'node:sqlite'
import { hashToken } from './keys.ts'

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

function record(
  db: DatabaseSync,
  userId: number,
  model: string | null,
  usage: Usage | undefined,
  status: string,
  fallback?: { prompt: number; completion: number },
): void {
  const u = usage ?? {}
  db.prepare(
    `INSERT INTO usage_events
       (user_id, model, prompt_tokens, completion_tokens, cache_hit_tokens, cache_miss_tokens, estimated, status, usage_json)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    userId,
    model,
    u.prompt_tokens ?? fallback?.prompt ?? 0,
    u.completion_tokens ?? fallback?.completion ?? 0,
    u.prompt_cache_hit_tokens ?? 0,
    u.prompt_cache_miss_tokens ?? 0,
    usage ? 0 : 1,
    status,
    usage ? JSON.stringify(usage) : null,
  )
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
        const r = await fetch(opts.upstream + '/models', {
          headers: { authorization: `Bearer ${opts.realKey}` },
        })
        const text = await r.text()
        res.writeHead(r.status, { 'content-type': r.headers.get('content-type') ?? 'application/json' })
        return res.end(text)
      }

      if (req.method === 'POST' && url.pathname === '/chat/completions') {
        const user = authenticate(opts.db, req)
        if (!user) {
          return json(res, 401, { error: { message: 'invalid or missing api key', type: 'auth_error' } })
        }

        let body = ''
        for await (const chunk of req) body += chunk
        let requestedModel: string | null = null
        try {
          requestedModel = JSON.parse(body)?.model ?? null
        } catch {
          return json(res, 400, { error: { message: 'invalid JSON body', type: 'bad_request' } })
        }

        let upstreamRes: Response
        try {
          upstreamRes = await fetch(opts.upstream + '/chat/completions', {
            method: 'POST',
            headers: { 'content-type': 'application/json', authorization: `Bearer ${opts.realKey}` },
            body,
          })
        } catch (err) {
          record(opts.db, user.id, requestedModel, undefined, 'upstream-error')
          console.log(`[gw] user=${user.username} model=${requestedModel} upstream-error: ${String(err)}`)
          return json(res, 502, { error: { message: 'upstream unreachable', type: 'upstream_error' } })
        }

        const ctype = upstreamRes.headers.get('content-type') ?? ''
        res.writeHead(upstreamRes.status, { 'content-type': ctype })

        if (!upstreamRes.body) {
          res.end()
          record(opts.db, user.id, requestedModel, undefined, `empty-${upstreamRes.status}`)
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
          record(opts.db, user.id, requestedModel, usage, 'ok', {
            prompt: estimateTokens(body),
            completion: estimateTokens(tail),
          })
          console.log(`[gw] user=${user.username} model=${requestedModel} stream usage=${usage ? 'found' : 'estimated'}`)
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
          record(opts.db, user.id, respModel ?? requestedModel, usage, 'ok', {
            prompt: estimateTokens(body),
            completion: estimateTokens(text),
          })
          console.log(`[gw] user=${user.username} model=${respModel ?? requestedModel} usage=${usage ? 'found' : 'estimated'}`)
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
