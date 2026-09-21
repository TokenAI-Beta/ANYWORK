#!/usr/bin/env node
// DSH-ANYWORK 团队安全闸门 · PreToolUse 检查器（Claude Code 钩子方言）
// 输入：stdin 的钩子载荷 JSON（tool_name / tool_input.command / cwd …）
// 输出：放行 = 静默退出；拦截 = stdout 输出 permissionDecision（deny / ask）
// 规则：同目录 rules.json（每次调用重读，改完即生效；语法错则跳过该条）
// 拦截（deny）时经通知桥推一条微信（detached，不阻塞判定）。
import { readFileSync, existsSync } from 'node:fs'
import { spawn } from 'node:child_process'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = dirname(fileURLToPath(import.meta.url))
const NOTIFY = '/home/yangc/desk-data/bin/desk-notify'

function readStdin() {
  return new Promise((resolve) => {
    let buf = ''
    process.stdin.setEncoding('utf8')
    process.stdin.on('data', (c) => (buf += c))
    process.stdin.on('end', () => resolve(buf))
    process.stdin.on('error', () => resolve(buf))
  })
}

function loadRules() {
  try {
    return JSON.parse(readFileSync(join(HERE, 'rules.json'), 'utf8'))
  } catch {
    return { deny: [], ask: [] }
  }
}

function test(rules, cmd) {
  for (const r of rules.deny || []) {
    try {
      if (new RegExp(r.re, 'i').test(cmd)) return { kind: 'deny', label: r.label }
    } catch {
      // 坏规则跳过
    }
  }
  for (const r of rules.ask || []) {
    try {
      if (new RegExp(r.re, 'i').test(cmd)) return { kind: 'ask', label: r.label }
    } catch {
      // 坏规则跳过
    }
  }
  return null
}

function notifyDeny(label, cmd, cwd) {
  try {
    if (!existsSync(NOTIFY)) return
    const short = cmd.length > 140 ? cmd.slice(0, 140) + '…' : cmd
    const body = '命中规则：' + label + '\n命令：' + short + '\n目录：' + (cwd || '-')
    spawn('python3', [NOTIFY, '【安全闸门·已拦截】', body], { detached: true, stdio: 'ignore' }).unref()
  } catch {
    // 通知失败不影响拦截
  }
}

function reply(decision, reason) {
  process.stdout.write(
    JSON.stringify({
      hookSpecificOutput: { hookEventName: 'PreToolUse', permissionDecision: decision, permissionDecisionReason: reason },
    }) + '\n',
  )
  process.exit(0)
}

const raw = await readStdin()
let payload = {}
try {
  payload = JSON.parse(raw || '{}')
} catch {
  process.exit(0) // 载荷异常：不拦（桥侧有超时与最严合并兜底）
}

if (String(payload.tool_name || '') !== 'bash') process.exit(0)
const input = payload.tool_input || {}
const cmd = typeof input.command === 'string' ? input.command : ''
if (!cmd.trim()) process.exit(0)

const hit = test(loadRules(), cmd)
if (!hit) process.exit(0)

if (hit.kind === 'deny') {
  notifyDeny(hit.label, cmd, payload.cwd)
  reply(
    'deny',
    '团队安全闸门拦截：' + hit.label + '。该命令属破坏性操作，已被策略拦下；如确需执行，请联系管理员调整 ~/desk-data/hooks/rules.json。',
  )
}
reply('ask', '团队安全闸门：' + hit.label + '——该命令需要人工确认，请选择允许或拒绝。')
