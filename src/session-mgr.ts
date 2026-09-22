// 会话管理（团队层）：会话列表（经实例 RPC）+ 删除（停实例 → 删文件 → 改注册表 → systemd 自拉重读）
// 背景：dsh 只有「归档」（注册表标记位），没有删除 RPC；会话 = sessions/<bucket>/<sessionId>/session.jsonl.zstd
// + storages/workspace.json 注册表（实例内存缓存）。删除必须趁实例不在：杀进程（systemd RestartSec=5 → 5 秒窗口）→
// 删目录 + 注册表除名 → 实例自动重启后读取到的就是删干净的状态。
import { execFileSync } from 'node:child_process'
import { existsSync, readdirSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { homedir } from 'node:os'
import type { DatabaseSync } from 'node:sqlite'

export interface SessionSummaryLite {
  sessionId: string
  updatedAt: number
  running: boolean
  blank: boolean
  cwd?: string
  parentSessionId?: string
  origin?: string
  agentPreset?: string
}

const SESSION_ID_RE = /^session-[0-9a-fA-F-]{8,64}$/

/** 实例家目录：优先从 systemd 单元推导（ExecStart 末尾的 desk-test/uN），兜底 desk-test/<用户名> */
export function userHome(username: string): string {
  try {
    const out = execFileSync('systemctl', ['show', `desk-agent-${username}`, '-p', 'ExecStart', '--value'], {
      encoding: 'utf8',
      timeout: 5000,
    })
    const hit = out
      .split(/\s+/)
      .filter((t) => /\/desk-test\/[A-Za-z0-9_-]+$/.test(t))
      .pop()
    if (hit) return hit
  } catch {
    // 兜底
  }
  return join(homedir(), 'desk-test', username)
}

export function userPort(db: DatabaseSync, username: string): number | null {
  const r = db.prepare(`SELECT agent_port FROM users WHERE username = ?`).get(username) as { agent_port: number | null } | undefined
  return r?.agent_port ?? null
}

/** 经实例 RPC 读取该成员的会话列表（经 loopback，受信任围栏放行） */
export async function listUserSessions(
  db: DatabaseSync,
  username: string,
): Promise<{ ok: true; sessions: SessionSummaryLite[] } | { error: string }> {
  const port = userPort(db, username)
  if (!port) return { error: `成员 ${username} 未分配实例` }
  const ctrl = new AbortController()
  const t = setTimeout(() => ctrl.abort(), 8000)
  try {
    const r = await fetch(`http://127.0.0.1:${port}/api/session.list`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ type: 'client-request', rpcId: 'smgr', method: 'session.list', payload: {} }),
      signal: ctrl.signal,
    })
    const j = (await r.json()) as { result?: { ok?: boolean; value?: { items?: SessionSummaryLite[] } } }
    const items = j?.result?.value?.items
    if (!Array.isArray(items)) return { error: '实例返回异常（session.list）' }
    const sessions = items.map((s) => ({
      sessionId: s.sessionId,
      updatedAt: s.updatedAt,
      running: s.running === true,
      blank: s.blank === true,
      cwd: s.cwd,
      parentSessionId: s.parentSessionId,
      origin: s.origin,
      agentPreset: s.agentPreset,
    }))
    return { ok: true, sessions }
  } catch (e) {
    return { error: `读取会话失败：${String((e as Error)?.message || e).slice(0, 120)}` }
  } finally {
    clearTimeout(t)
  }
}

/** 删除某成员的一个会话：杀实例（systemd 5s 后自拉）→ 删会话目录 → 注册表除名 */
export function deleteSession(username: string, sessionId: string): { ok: true; killed: boolean; removed: number } | { error: string } {
  if (!SESSION_ID_RE.test(sessionId)) return { error: '会话 ID 不合法' }
  const home = userHome(username)
  if (!existsSync(home)) return { error: `找不到实例目录 ${home}` }

  let killed = false
  try {
    const pidStr = execFileSync('systemctl', ['show', `desk-agent-${username}`, '-p', 'MainPID', '--value'], {
      encoding: 'utf8',
      timeout: 5000,
    }).trim()
    const pid = Number(pidStr)
    if (Number.isFinite(pid) && pid > 1) {
      process.kill(pid, 'SIGKILL')
      killed = true
    }
  } catch {
    // 实例未运行也继续清理
  }

  let removed = 0
  try {
    const sessionsDir = join(home, 'sessions')
    if (existsSync(sessionsDir)) {
      for (const bucket of readdirSync(sessionsDir)) {
        const p = join(sessionsDir, bucket, sessionId)
        if (existsSync(p)) {
          rmSync(p, { recursive: true, force: true })
          removed++
        }
      }
    }
  } catch (e) {
    return { error: `删除会话文件失败：${String((e as Error)?.message || e).slice(0, 120)}` }
  }

  try {
    const reg = join(home, 'storages', 'workspace.json')
    if (existsSync(reg)) {
      const doc = JSON.parse(readFileSync(reg, 'utf8')) as {
        global?: { archivedSessionIds?: string[] }
        tables?: { workspaces?: Record<string, { sessionIds?: string[] }> }
      }
      if (doc.global && Array.isArray(doc.global.archivedSessionIds)) {
        doc.global.archivedSessionIds = doc.global.archivedSessionIds.filter((x) => x !== sessionId)
      }
      const ws = doc.tables?.workspaces
      if (ws) {
        for (const k of Object.keys(ws)) {
          const cell = ws[k]
          if (cell && Array.isArray(cell.sessionIds)) cell.sessionIds = cell.sessionIds.filter((x) => x !== sessionId)
        }
      }
      const tmp = reg + '.tmp-smgr'
      writeFileSync(tmp, JSON.stringify(doc, null, 2) + '\n', { mode: 0o600 })
      renameSync(tmp, reg)
    }
  } catch (e) {
    return { error: `更新会话注册表失败：${String((e as Error)?.message || e).slice(0, 120)}` }
  }

  return { ok: true, killed, removed }
}
