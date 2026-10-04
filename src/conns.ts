// 平台连接（会议 / 工作平台卡片）：GitHub / Notion / 腾讯会议 等
// 与 notify_routes 区分：这里存的是「账号 / 链接型」连接，测试走各平台自检接口，不做消息群发。
import type { DatabaseSync } from 'node:sqlite'

export interface PlatformConn {
  platform: string
  config: string
  updated_at: string
}

/** 允许连接的平台（conn/add、conn/rm、conn/test 的白名单） */
export const CONN_PLATFORMS = new Set(['github', 'notion', 'meeting-tencent'])

export function listConns(db: DatabaseSync): PlatformConn[] {
  try {
    return db.prepare(`SELECT platform, config, updated_at FROM platform_conns`).all() as unknown as PlatformConn[]
  } catch {
    return []
  }
}

export function getConn(db: DatabaseSync, platform: string): PlatformConn | undefined {
  try {
    return db.prepare(`SELECT platform, config, updated_at FROM platform_conns WHERE platform = ?`).get(platform) as unknown as PlatformConn | undefined
  } catch {
    return undefined
  }
}

export function setConn(db: DatabaseSync, platform: string, config: string): void {
  db.prepare(`INSERT OR REPLACE INTO platform_conns (platform, config, updated_at) VALUES (?, ?, datetime('now'))`).run(platform, config)
}

export function removeConn(db: DatabaseSync, platform: string): void {
  db.prepare(`DELETE FROM platform_conns WHERE platform = ?`).run(platform)
}

/** 保存前格式校验；返回错误文案或 null。 */
const Lc = (lang: string, zh: string, en: string): string => (lang === 'en' ? en : zh)

export function validateConnConfig(platform: string, config: string, lang: string = 'zh'): string | null {
  const c = config.trim()
  if (!c) return Lc(lang, '内容不能为空', 'Cannot be empty')
  if (platform === 'github' && !/^(gh[pousr]_|github_pat_)/.test(c)) return Lc(lang, 'GitHub Token 应以 github_pat_ / ghp_ / gho_ 等开头', 'GitHub token should start with github_pat_ / ghp_ / gho_')
  if (platform === 'notion' && !/^(ntn_|secret_)/.test(c)) return Lc(lang, 'Notion Token 应以 ntn_ 或 secret_ 开头', 'Notion token should start with ntn_ or secret_')
  if (platform === 'meeting-tencent') {
    const okLink = /^https:\/\/meeting\.tencent\.com\/(dm|j|p)\/[A-Za-z0-9._-]+/.test(c)
    const okCode = /^[0-9]{9,11}$/.test(c)
    if (!okLink && !okCode) return Lc(lang, '填会议链接（https://meeting.tencent.com/dm/…）或 9~11 位会议号', 'Enter a meeting link (https://meeting.tencent.com/dm/…) or a 9–11 digit meeting number')
  }
  return null
}

/** 连接自检（在线验证各平台凭据）。 */
export async function testConn(platform: string, config: string, lang: string = 'zh'): Promise<{ ok: boolean; info: string }> {
  const c = config.trim()
  try {
    if (platform === 'github') {
      const r = await fetch('https://api.github.com/user', {
        headers: { authorization: 'Bearer ' + c, 'user-agent': 'dsh-anywork', accept: 'application/vnd.github+json' },
        signal: AbortSignal.timeout(12000),
      })
      if (r.status === 401) return { ok: false, info: Lc(lang, '失败：Token 无效或已过期（HTTP 401）', 'Failed: invalid or expired token (HTTP 401)') }
      if (!r.ok) return { ok: false, info: Lc(lang, '失败：HTTP ', 'Failed: HTTP ') + r.status }
      const d = (await r.json()) as { login?: string; name?: string }
      return { ok: true, info: Lc(lang, '成功：已连接 GitHub 账号 ', 'OK: connected as GitHub user ') + (d.login || '?') }
    }
    if (platform === 'notion') {
      const r = await fetch('https://api.notion.com/v1/users/me', {
        headers: { authorization: 'Bearer ' + c, 'notion-version': '2022-06-28' },
        signal: AbortSignal.timeout(12000),
      })
      if (r.status === 401) return { ok: false, info: Lc(lang, '失败：集成 Token 无效（HTTP 401）——检查是否复制完整', 'Failed: invalid integration token (HTTP 401) — check that you copied it fully') }
      if (!r.ok) return { ok: false, info: Lc(lang, '失败：HTTP ', 'Failed: HTTP ') + r.status }
      const d = (await r.json()) as { name?: string }
      return { ok: true, info: Lc(lang, '成功：已连接 Notion 集成', 'OK: connected to Notion integration ') + (d.name ? '「' + d.name + '」' : '') }
    }
    if (platform === 'meeting-tencent') {
      return { ok: true, info: Lc(lang, '链接型连接不用在线测试——点「打开」验证一下就行', 'Link-type connections need no online test — hit Open to verify') }
    }
    return { ok: false, info: Lc(lang, '该平台暂不支持测试', 'Testing is not supported for this platform yet') }
  } catch (e) {
    const cause = (e as { cause?: { message?: string } })?.cause?.message
    return { ok: false, info: Lc(lang, '失败：', 'Failed: ') + String(cause || (e as Error)?.message || e).slice(0, 140) }
  }
}
