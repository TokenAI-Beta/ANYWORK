// 运维面板数据（只读）：服务健康 / 端口探活 / 备份 / 磁盘 / 主机 —— 供 设置 →「运维」页使用
import { execFile } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { readdir, stat, statfs } from 'node:fs/promises'
import { freemem, homedir, loadavg, totalmem, uptime as osUptime } from 'node:os'
import { join } from 'node:path'
import type { DatabaseSync } from 'node:sqlite'

function run(cmd: string, args: string[]): Promise<string> {
  return new Promise((resolve) => {
    execFile(cmd, args, { timeout: 5000 }, (err, stdout) => resolve(err ? '' : String(stdout).trim()))
  })
}

async function probe(url: string): Promise<number | string> {
  try {
    const ctrl = new AbortController()
    const t = setTimeout(() => ctrl.abort(), 3000)
    const r = await fetch(url, { signal: ctrl.signal, redirect: 'manual' })
    clearTimeout(t)
    // dsh 0.1.5+ 引擎对未认证请求回 401（浏览器会话门禁）——对探活而言「有响应」即正常
    return r.status === 401 ? 200 : r.status
  } catch {
    return '×'
  }
}

export async function collectOps(db: DatabaseSync, dataDir: string): Promise<Record<string, unknown>> {
  // —— 服务（systemd）+ 该成员实例端口 ——
  const users = db.prepare(`SELECT username, agent_port AS port FROM users WHERE agent_port IS NOT NULL ORDER BY id`).all() as unknown as {
    username: string
    port: number
  }[]
  const units = ['desk-server', ...users.map((u) => `desk-agent-${u.username}`)]
  // 容器/无 systemd 部署兜底：实例存活看 ~/.desk/run/<成员>.pid
  const pidAlive = (p: string): boolean => {
    try {
      const pid = Number(readFileSync(p, 'utf8').trim())
      if (!Number.isFinite(pid) || pid <= 1) return false
      process.kill(pid, 0)
      return true
    } catch {
      return false
    }
  }
  const hasSystemd = (await run('systemctl', ['--version'])).length > 0
  const services = await Promise.all(
    units.map(async (name) => {
      if (!hasSystemd) {
        const isServer = name === 'desk-server'
        const pidFile = join(homedir(), '.desk', 'run', `${name.replace(/^desk-agent-/, '')}.pid`)
        const pinfo = isServer
          ? { active: true, pid: String(process.pid) }
          : (() => {
              try {
                return { active: pidAlive(pidFile), pid: readFileSync(pidFile, 'utf8').trim() }
              } catch {
                return { active: false, pid: '' }
              }
            })()
        return { name, active: pinfo.active, pid: pinfo.pid, since: '', runner: 'process' }
      }
      const active = (await run('systemctl', ['is-active', name])) === 'active'
      const show = await run('systemctl', ['show', name, '-p', 'MainPID', '-p', 'ActiveEnterTimestamp'])
      const pid = /MainPID=(\d+)/.exec(show)?.[1] ?? ''
      const since = /ActiveEnterTimestamp=(.+)/.exec(show)?.[1] ?? ''
      return { name, active, pid, since, runner: 'systemd' }
    }),
  )

  // —— 端口探活 ——
  const http: Record<string, number | string> = {
    '门户 :8080': await probe('http://127.0.0.1:8080/healthz'),
    '网关 :8100': await probe('http://127.0.0.1:8100/healthz'),
  }
  for (const u of users) http[`${u.username} :${u.port}`] = await probe(`http://127.0.0.1:${u.port}/`)

  // —— 备份 ——
  const backupDir = join(homedir(), 'desk-backups')
  let backup: Record<string, unknown> = { count: 0, last: null, totalBytes: 0, dir: backupDir }
  try {
    const names = (await readdir(backupDir)).filter((n) => n.endsWith('.tar.gz') || n.endsWith('.tar'))
    let total = 0
    let latest: { name: string; size: number; mtime: string; mtimeLocal: string } | null = null
    for (const n of names) {
      try {
        const st = await stat(join(backupDir, n))
        total += st.size
        if (!latest || st.mtimeMs > Date.parse(latest.mtime)) {
          const dt = new Date(st.mtimeMs)
          const pad = (x: number) => String(x).padStart(2, '0')
          latest = {
            name: n,
            size: st.size,
            mtime: dt.toISOString(),
            mtimeLocal: `${dt.getFullYear()}-${pad(dt.getMonth() + 1)}-${pad(dt.getDate())} ${pad(dt.getHours())}:${pad(dt.getMinutes())}`,
          }
        }
      } catch {
        // 单个文件读不到跳过
      }
    }
    backup = { count: names.length, last: latest, totalBytes: total, dir: backupDir }
  } catch {
    // 目录不存在
  }

  // —— 磁盘 / 数据 ——
  let disk: Record<string, unknown> = {}
  try {
    const s = await statfs(dataDir)
    disk = { free: Number(s.bsize) * Number(s.bavail), total: Number(s.bsize) * Number(s.blocks) }
  } catch {
    disk = {}
  }
  const dirSize = async (p: string): Promise<number> => {
    const out = await run('du', ['-sb', p])
    const n = Number(out.split(/\s+/)[0])
    return Number.isFinite(n) ? n : 0
  }
  const dbBytes = await stat(join(dataDir, 'desk.db')).then((s) => s.size).catch(() => 0)
  const kbBytes = await dirSize(join(dataDir, 'kb'))
  const driveBytes = await dirSize(join(dataDir, 'drive'))

  return {
    services,
    http,
    backup,
    disk,
    data: { dbBytes, kbBytes, driveBytes },
    host: {
      uptime: Math.round(osUptime()),
      totalmem: totalmem(),
      freemem: freemem(),
      load1: loadavg()[0],
    },
    desk: {
      uptime: Math.round(process.uptime()),
      node: process.version,
      dataDir,
    },
  }
}
