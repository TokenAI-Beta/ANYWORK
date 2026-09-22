# 团队技能库

这里放"让 agent 干活的方法"——dsh 会自动发现并生效，所有成员的实例共享。

## 格式（dsh 官方规则）

- 目录式（推荐）：`<技能名>/SKILL.md`（技能名用 kebab-case：小写字母、数字、连字符）
- 或单文件：`<技能名>.md`
- `SKILL.md` 必须带 frontmatter（YAML），必填字段：
  - `name`：与目录名一致（kebab-case）
  - `description`：一两句说明"做什么、什么时候用"
  - 可选 `whenToUse`；正文就是给 agent 的操作指引
- 不支持嵌套发现（别把 `SKILL.md` 放进更深层目录）

## 生效与更新

- **放进去即生效**：官方带文件监听（正文编辑也监听），无需重启、无需导入
- 优先级：成员工作区里的 `.dsh/skills/`（工作区级）> 本共享库（用户级）——需要"只给某人"的技能就放他的工作区里

## 访问路径

- 服务器（WSL）：`~/desk-data/skills/`
- Windows：资源管理器打开 `\\wsl.localhost\Ubuntu\home\yangc\desk-data\skills`
- 每个成员实例通过 `DSH_HOME/skills` 软链到这里（改一处、全员生效）

## 现有技能

- `team-report-style/` —— 团队报告写作规范（结论先行 / 标口径 / 禁编造 / 附缺口清单）
- `codex-parallel-worktrees/` —— 多个互不干扰的代码任务并行跑（git worktree + Codex：批量修 issue / 审 PR / 重构拆分）

> 新增技能后请顺手在本表登记一行（写清"干什么、什么时候用"）。

## 边界（v1）

- 全员共享、无权限过滤；技能是"软约束"（指引 agent 怎么干），不是沙箱
- agent 实际能做什么（读写文件、跑命令）仍由各自实例的权限档位决定
