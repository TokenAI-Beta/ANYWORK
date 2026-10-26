/**
 * dsh-team-presets — Docker 镜像里的四张团队预设。
 *
 * 注册发生在 cordis.patch.yml（四条 @deepseek-ai/dsh-agent-preset）。
 * 这个模块不插入自身、不扫描目录、不再注册名为 codex 的 provider。
 */
export const name = 'dsh-team-presets'
