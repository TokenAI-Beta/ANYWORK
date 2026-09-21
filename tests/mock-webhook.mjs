// 测试桩：本地 mock webhook（通知桥联调用）
// 用法: node tests/mock-webhook.mjs   （监听 http://127.0.0.1:8091）
import { createServer } from 'node:http'

createServer((req, res) => {
  let b = ''
  req.on('data', (c) => (b += c))
  req.on('end', () => {
    console.log('[mock-webhook]', new Date().toISOString(), req.method, req.url, b)
    res.writeHead(200, { 'content-type': 'application/json' })
    res.end('{"ok":true}')
  })
}).listen(8091, '127.0.0.1', () => console.log('mock webhook on http://127.0.0.1:8091'))
