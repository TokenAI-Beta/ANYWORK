// mock-connect.mjs —— 连接器回归测试用假网关（Telegram Bot API / green-api / UltraMsg / CallMeBot）
// 用法：node tests/mock-connect.mjs   （默认 :8092）
import { createServer } from 'node:http'

const PORT = Number(process.env.MOCK_CONNECT_PORT || 8092)
const srv = createServer((req, res) => {
  let body = ''
  req.on('data', (c) => (body += c))
  req.on('end', () => {
    const line = JSON.stringify({ ts: new Date().toISOString(), method: req.method, url: req.url, body: body.slice(0, 400) })
    console.log(line)
    res.writeHead(200, { 'content-type': 'application/json' })
    if (req.url.includes('/sendMessage')) return res.end(JSON.stringify({ ok: true, result: { message_id: 1 } }))
    if (req.url.includes('whatsapp.php')) return res.end('Message sent successfully')
    res.end(JSON.stringify({ sent: true, idMessage: 'mock-1' }))
  })
})
srv.listen(PORT, () => console.log('mock-connect on :' + PORT))
