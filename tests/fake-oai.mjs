// 假第二上游（OpenAI 兼容）——多通道分流测试桩；默认端口 8199
import { createServer } from 'node:http'
import { appendFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'

const LOG = process.env.FAKE_OAI_LOG ?? join(homedir(), 'desk-test', 'fake-oai.log')
const server = createServer(async (req, res) => {
  const url = new URL(req.url ?? '/', 'http://x')
  let body = ''
  for await (const c of req) body += c
  let model = null
  let stream = false
  try {
    const j = JSON.parse(body)
    model = j.model ?? null
    stream = j.stream === true
  } catch {
    // GET 等无 body 请求
  }
  appendFileSync(LOG, `${new Date().toISOString()} ${req.method} ${url.pathname} auth=${req.headers.authorization ? 'yes' : 'no'} model=${model ?? '-'}\n`)

  if (req.method === 'GET' && url.pathname.endsWith('/models')) {
    res.writeHead(200, { 'content-type': 'application/json' })
    return res.end(JSON.stringify({ object: 'list', data: [{ id: 'fake-model-a', object: 'model', owned_by: 'fake-oai' }] }))
  }

  if (req.method === 'POST' && url.pathname.endsWith('/chat/completions')) {
    const usage = { prompt_tokens: 100, completion_tokens: 50, total_tokens: 150 }
    if (stream) {
      res.writeHead(200, { 'content-type': 'text/event-stream', 'cache-control': 'no-cache' })
      res.write('data: ' + JSON.stringify({ id: 'fake-1', object: 'chat.completion.chunk', model, choices: [{ index: 0, delta: { role: 'assistant', content: 'fake ok' } }] }) + '\n\n')
      res.write('data: ' + JSON.stringify({ id: 'fake-1', object: 'chat.completion.chunk', model, choices: [{ index: 0, delta: {}, finish_reason: 'stop' }], usage }) + '\n\n')
      res.write('data: [DONE]\n\n')
      return res.end()
    }
    res.writeHead(200, { 'content-type': 'application/json' })
    return res.end(
      JSON.stringify({
        id: 'fake-1',
        object: 'chat.completion',
        model,
        choices: [{ index: 0, message: { role: 'assistant', content: 'fake ok (non-stream)' }, finish_reason: 'stop' }],
        usage,
      }),
    )
  }

  res.writeHead(404, { 'content-type': 'application/json' })
  res.end(JSON.stringify({ error: { message: 'not found' } }))
})

const port = Number(process.env.FAKE_OAI_PORT ?? 8199)
server.listen(port, '127.0.0.1', () => console.log(`[fake-oai] listening on http://127.0.0.1:${port}`))
