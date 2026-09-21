---
name: codex-parallel-worktrees
description: 需要并行跑多个互不干扰的代码任务时使用（PR 批量修复/审查、重构拆分、自动化作业）：git worktree + Codex 并行执行与收集。
---

# Codex 并行工作流（worktree 模式）

同一时间跑多条互不干扰的代码任务：**每个任务一个 git 工作树（worktree）+ 一条 Codex**。典型场景：批量修 issue、批量审 PR、把大重构拆成互不冲突的子任务、重复性自动化作业。

## 前置

- `codex --version` 有输出（WSL 已装；登录态在 `~/.codex/auth.json`，失效时报 auth 错）
- 操作对象必须是 **git 仓库**（codex 拒绝在非 git 目录工作；没有仓库就先 `git init`）
- 要推分支/开 PR/回帖：`gh` CLI 已登录

## 单发（前台，短任务）

```sh
cd <仓库> && codex exec --sandbox workspace-write "给设置页加暗色开关；改完汇报改了哪些文件"
```

- `codex exec` 非交互、跑完即退；**不要**用交互式 `codex`（需要 TTY，会卡住）
- `--sandbox workspace-write`：只能写工作区文件（本机 WSL 实测可用）
- 任务提示词必须**自包含**：路径、目标、验收标准一次说清——codex 看不到你的会话上下文

## 并行跑 N 个任务（核心套路）

1. 每任务一条分支 + 一个工作树（建议放 /tmp）：

   ```sh
   git worktree add -b fix/78 /tmp/wt/78 main
   git worktree add -b fix/99 /tmp/wt/99 main
   ```

2. 每个工作树里丢一条**后台** Codex（bash 工具 `run_in_background: true`，日志落文件）：

   ```sh
   cd /tmp/wt/78 && codex exec --sandbox workspace-write "修复：<自包含描述>" > /tmp/wt/78.log 2>&1
   ```

3. 监控与收取：`job_list` 看状态 → `job_output`（wait: true）等它跑完；完成后读日志复查。

4. **收口 commit 由编排方做（推荐）**：codex 只负责改文件，你在同一工作树里收：

   ```sh
   git -C /tmp/wt/78 add -A && git -C /tmp/wt/78 commit -m "fix #78"
   ```

   ⚠️ 别指望沙箱里的 codex 自己 commit——**worktree 的 git 元数据在主仓 `.git/worktrees/` 下，`workspace-write` 沙箱挡写 `index.lock`**（实测报 `Read-only file system`）。确实要让它自己提交 → 用 `--sandbox danger-full-access`（实测可 commit），代价是无沙箱，必须事后逐树审 diff。

5. 验收后推分支、开 PR：

   ```sh
   git -C /tmp/wt/78 push -u origin fix/78
   gh pr create --head fix/78 --title "fix: #78" --body "<摘要>"
   ```

6. 清理（失败也要清，别攒垃圾）：

   ```sh
   git worktree remove --force /tmp/wt/78
   ```

## 批量 PR 审查（只读型并行）

```sh
R=$(mktemp -d) && git clone <repo> "$R" && cd "$R"
git fetch origin '+refs/pull/*/head:refs/remotes/origin/pr/*'
# 每条 PR 一个工作树或 clone，并行丢 codex：
codex exec --sandbox workspace-write "审查 PR #86（diff：origin/main...origin/pr/86），输出：问题清单 + 风险等级 + 建议" > "$R/r86.log" 2>&1
```

汇总后回帖：`gh pr comment 86 --body "<要点>"`。
单条 PR 审查也可直接用 `subagent_codex` 工具叉给 Codex（小批量更省事）。

## 规则与坑（均为实测）

- **互不干扰的唯一保障 = 各自工作树**：并行任务绝不共享同一工作目录（会互相踩文件）
- 后台任务一律 `run_in_background`，别前台干等；长批次完成后可 `desk-notify` 推一条微信（可选）
- 沙箱挡 git 元数据写入：要么编排方收口 commit，要么 `danger-full-access`（见 4）
- Codex 消耗团队 Codex 账号额度（不进工作台账本）——批量之前先估计要烧多少
- 完成后把结论/方法**沉淀进知识库**（`desk-kb "标题" "正文"`），别把产出烂在 /tmp
