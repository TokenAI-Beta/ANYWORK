# 本工作区提示（工作台 README）

- 团队知识库（企业知识库）位于 /home/yangc/desk-data/kb（共享目录，全员可读）。
  查资料：用 shell 检索该目录；成员也可以在 工作台 → 设置 → 知识库 里搜索。
- 公司盘（共享文件区）位于 /home/yangc/desk-data/drive（全员共用，可读写；界面入口：设置 → 公司盘）。
- 团队技能库（共享技能目录）位于 /home/yangc/desk-data/skills（dsh 自动发现、放进去即生效）。
- 需要给人发通知（提醒 / 告警 / 任务完成）：运行 `~/desk-data/bin/desk-notify "标题" "正文"`（单参数时视为正文）。
- 要设定时提醒（到点自动推手机）：`~/desk-data/bin/desk-remind "10:00" "内容"`（支持 +30m / 明天 09:00 / 09-22 10:00；`desk-remind list` / `desk-remind rm <id>` 管理）。
- 长任务不要阻塞会话：用 bash 工具的后台方式（`run_in_background: true`）提交，随后用 `job_list` / `job_output` / `job_kill` 查看、收取与终止（会话头显示后台任务条）。
- 重活可以派子代理：`subagent`（新建独立子代理）与 `subagent_fork`（叉出当前会话上下文的副本）跑子任务并回报；互相独立的方向可并行委派；用 `send_message` / `list_agents` 继续对话或点名。
- 沉淀知识：把有价值的结论/口径/方法**沉淀成笔记**进共享知识库：`~/desk-data/bin/desk-kb "标题" "正文"`（长文：`desk-kb "标题"` 后从 stdin 读入；`desk-kb list` / `desk-kb search 关键词` 可查）。全员可搜（设置 →「知识库」）；删除仅管理员。
- Codex 可用：编码/执行类子任务用 `subagent_codex` 工具委派给 Codex；大规模多路并行编排用 `workflow` 工具（子任务跑在 Codex 上；它不支持结构化输出 schema，用纯文本约定返回值）；批量互不干扰的代码任务（修 issue / 审 PR / 重构拆分）按技能 `codex-parallel-worktrees` 的 worktree 套路并行跑——都在本会话工作区里跑。
- **提交署名（人机可分辨）**：AI 代写的 git 提交，在 message 末尾追加两行尾注——`Generated-by: dsh-anywork-agent`（必加）；本次工作对应任务板任务时再加 `Refs: task #<任务号>`。人工手写的提交不加。评审人看到尾注即知"这段是 AI 产出、重点核对"，并可在任务卡「关联会话」里回看 AI 当时的操作。
- **项目仓库约定**：团队共用的代码仓库，须在**仓库根目录**放一份 `AGENTS.md` 并提交进 git（全队克隆即继承）——写清：包管理器（统一用一个，如 pnpm）、提交前要跑的命令（lint / 测试）、评审重点。某模块需要额外规则时，在子目录再放一份（就近优先、越近越强）。团队底线以本文件为准，无需在每个仓库重复。
- 团队 Soul（行为准则）在本实例 DSH_HOME 下的 AGENTS.md（全团队同源）。

<!-- ── 以上内容由 DSH-ANYWORK scripts/apply-soul.sh 维护（更新时刷新）；此线以下为你的自定义区——个人偏好、备注等写在这里，更新时会原样保留 ── -->
