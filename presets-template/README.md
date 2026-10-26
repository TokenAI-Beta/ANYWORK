# 团队 Agent 预设（四张模板）

dsh 0.2.1-rc.3 的「Agent 预设」是注册表里的一条声明，不是扫目录。本目录仍给 **功能与连接** 提供四张卡片（`preset.yml`），并给 Docker 镜像里的 `plugin/dsh-team-presets` 提供同一份工具表（`agent.cordis.yml`）。

引擎四模式（标准 / PTC / 极简 / 创造）不在这里。

## 四张卡片

| order | id | 名称 | 默认 | Codex |
|------:|----|------|------|-------|
| 10 | `collab-default` | 协作默认 | 是 | 关 |
| 20 | `research-report` | 调研报告 | | 关 |
| 30 | `formal-docs` | 正式文书 | | 关 |
| 40 | `eng-codex` | 工程 Codex | | 开 |

旧 id 在 Docker 镜像里按 `alias-map.yml` 读时改写（`team-assistant` / 空 → `collab-default`）。面板只列这四张。显式选择的 `standard` 不改写。

## 怎么生效（仅 Docker 镜像）

- 镜像编译期 `dsh-features-connect-ac1.py` 按本目录登记四张卡（`settings.update` 仍是三参数，写在 use-path 补丁里）
- 镜像编译前 `dsh-preset-alias.py` 给注册表加上旧 id 别名
- 不再另装 `plugin/dsh-team-presets`，避免同一 id 登记两次
- `scripts/setup.sh` 不打这些补丁（东京 / 本机路径不动）

## 能力差

- 四张都保留 `tool-fs` 与 `tool-fs-search`
- 协作默认：全量轻约束，只关掉 `tool-subagent-codex`
- 调研报告、正式文书：关掉 workflow（rc.3 的行 id 是 `workflow-ptc`，即原先的 `workflow-worker-thread`）、`tool-workflow`、`tool-subagent-codex`；`tool-ralph` 不写入组合（web profile 未安装该包，写一条解析失败的 disabled 行会把整张预设标成损坏）
- 工程 Codex：同一全量，并启用 `tool-subagent-codex`。Codex provider 仍是宿主单例，预设里不再注册一次
