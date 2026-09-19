# DSH-ANYWORK 团队工作台 — 实施计划

**状态：** 实施中（P0 未开始） · **日期：** 2026-09-18 · **底座：** 官方 DeepSeek Harness（`@deepseek-ai/dsh`，MIT） · **托管：** github.com/bugbyc0922/DSH-ANYWORK（公开） · **明确不做：** 不采用 TDHarness-coding 的任何代码，独立实现。

---

## 一、已定决策（2026-09-18 确认）

| 项 | 决定 |
|---|---|
| agent 引擎 | 官方 dsh 当引擎；我们只写外围（登录 / 任务 / 计量 / 盘） |
| 形态 | 一台常开机器集中跑，成员浏览器登录使用 |
| 先行规模 | 我 + 1~2 人试用 |
| 第一版范围 | 登录 + 每人独立工作区 + key 集中管理 + 按人计量（地基优先） |
| 代码托管 | GitHub 公开仓库 `DSH-ANYWORK`（当开源项目运营；MIT） |
| 维护节奏 | 平时按 TODO 真推进；每天自动巡逻兜底（跑测试、写开发日志、有改动就提交） |
| 本期待列 | 任务卡 + 提交验收四格、花名册/同事视图、通知、远程接入、客户端模式 |

## 二、已核实的技术情报（写码前 P0 只做复核）

1. **模型出口可替换**：`packages/llm/llm-deepseek` 的 baseURL 回退到 `$DEEPSEEK_BASE_URL`，请求路径为 `POST {baseURL}/chat/completions` —— 自建网关截流可行，**不用改 dsh 源码**。
2. **`DSH_HOME` 可配置**：profiles / 会话 / 全局配置都在其下 —— 每人一份 home = 会话与设置天然隔离。
3. **启动参数**：`dsh web` 支持 `--port`、可重复的 `--trusted-host`（`apps/cli/reference/README.zh.md`）；`--trusted-host` 用来让非回环访问通过 `/api` 浏览器信任围栏 —— 门户反代需要它。
4. **多实例共存**：默认端口来自 `ctx.webStartup.port ?? 3080`（`packages/bundle/web-app/cordis.patch.yml`），换端口即可同机跑多个实例。
5. **前端事件面**：WebSocket（`/api/events.mux`、`/api/events.host`）+ `POST /api` RPC —— 反代必须透传 WS。
6. **`--host` 说法不一**：参考文档称 CLI 有意不支持 `0.0.0.0` 并直接报用法错误 —— 不影响本方案：实例只绑回环，由门户代理对外。
7. **现有环境**：dsh 在 WSL `~/deepseek-harness`（0.1.0-rc.5，已 build）；node 24 + pnpm 就绪；KRouter 已挂 headless。

P0 待复核清单：上面第 3 条的实际 flag 行为、WSL 局域网可达方案、流式 usage 是否随末块返回。

## 三、总体架构

```text
成员浏览器
   │  http://<机器>:8080
   ▼
┌─────────────────────────────────────────────────┐
│ 工作台服务（一个 Node 进程，两个监听）             │
│  门户 :8080                                      │
│   ├─ /login、/logout、/portal/*  → 门户页        │
│   ├─ 已登录：其它一切路径 → 该成员的 dsh 实例     │
│   │    （HTTP + WS 透传；未登录一律跳登录）       │
│   └─ 跨成员访问：拒绝                             │
│  网关 :8100（仅回环）                             │
│   └─ /chat/completions、/models：校验虚拟钥匙     │
│      → 换真 key 转发 → 解析 usage → 落库          │
│      → 预算拦截                                   │
└───────┬─────────────────────────────────────────┘
        │ 回环
   ┌────┴─────────────┐   每人一个实例：
   │ dsh 实例池        │   DSH_HOME=users/<u>/.dsh
   │ alice :8101      │   cwd=users/<u>/workspace
   │ bob   :8102      │   DEEPSEEK_BASE_URL=http://127.0.0.1:8100
   └──────────────────┘   DEEPSEEK_API_KEY=sk-desk-<u>-…（虚拟）
        │ 网关持有真 key
        ▼
   api.deepseek.com
```

真 key 只在网关，从不下发。

## 四、仓库与目录

- **仓库**：本地 `~/dsh-anywork`（WSL 开发，Linux-first；先本机跑，日后整机搬到常开小主机）；远端 GitHub `bugbyc0922/DSH-ANYWORK`。
- **状态目录**：`DESK_DATA`（默认 `~/desk-data`）：`desk.db`、`users/<u>/{workspace,.dsh}`、`logs/`、`backups/`。

```text
~/dsh-anywork/
├─ src/
│  ├─ server.ts        # 入口：门户 8080 + 网关 8100
│  ├─ portal/          # 登录、门户页、管理页
│  ├─ proxy/           # 反向代理（HTTP + WS 透传 + 登录闸门）
│  ├─ gateway/         # /chat/completions、/models 转发 + 计量 + 预算
│  ├─ agents/          # dsh 实例管理（起停、端口、DSH_HOME、env）
│  ├─ db/              # SQLite schema + 迁移
│  └─ cli.ts           # desk user / agent / usage / backup
├─ portal-static/      # 门户静态页（无构建步骤）
├─ config/
│  ├─ desk.yml         # 端口、路径、预算默认值
│  └─ prices.yml       # 模型价格表（缓存命中/未命中分开）
├─ scripts/            # setup.sh / start.sh / backup.sh
└─ tests/
```

## 五、数据模型（SQLite 草案）

- `users`(id, username, display_name, role, password_hash, status, agent_port, workspace, created_at, last_login_at)
- `login_sessions`(id, user_id, token_hash, created_at, expires_at, ip, user_agent)
- `api_keys`(id, user_id, token_hash, label, created_at, revoked_at)  — 虚拟钥匙，只存 hash
- `usage_events`(id, user_id, ts, model, prompt_tokens, completion_tokens, cache_hit_tokens, cache_miss_tokens, usage_json, estimated, status)
- `budgets`(user_id, period, limit_cny, warn_ratio)
- `audit_events`(id, ts, actor_user_id, action, detail_json)

## 六、对外接口（草案）

- 网关：`POST /chat/completions`（Bearer 虚拟钥匙）、`GET /models`、`GET /healthz`
- 门户：`GET|POST /login`、`POST /logout`、`GET /portal/me`、`GET|POST /portal/admin/users`、`GET /portal/api/usage`
- CLI：`desk user add|disable|reset <u>`、`desk agent start|stop|status <u>`、`desk usage <u> [--today|--month]`、`desk backup`

## 七、阶段与任务（共 22 项，一次做一项，每项有绿线）

### P0 可行性验证（先跑这 4 项，避免返工）

1. **dsh 多实例**：两个 DSH_HOME + 两个端口各起 web 实例。绿线：两实例并存，会话互不可见。
2. **启动参数实测**：`--port`、`--trusted-host` 实机行为（含非回环 Host 对 /api 的拒绝/放行）。绿线：curl 假 Host/Origin 结果符合预期，命令原文记进 BASELINE。
3. **网关截获**：DEEPSEEK_BASE_URL 指向临时假服务器，观察 dsh 真实请求（路径/头/流式格式），并回一段假流式。绿线：假服务器完整记录一轮，dsh UI 正常出字。
4. **局域网开放**：Windows→WSL 方案定案（netsh portproxy 或 .wslconfig mirrored）。绿线：手机/另一台电脑能打开测试页。
   → 产出 `docs/BASELINE.md`（事实 + 命令原文）。

### P1 模型网关 + 按人计量

5. **脚手架**：repo + TypeScript + Fastify + better-sqlite3 + `/healthz`。绿线：`pnpm start` 健康检查 200。
6. **用户与虚拟钥匙**：users / api_keys 表 + `desk user add`。绿线：钥匙只显示一次，库里只有 hash。
7. **网关（非流式）**：鉴权 → 转发 → usage 落库。绿线：curl 走网关真实调用一次，usage_events 数字正确。
8. **网关（流式）**：SSE 透传 + 末块 usage 提取（必要时注入 `stream_options.include_usage`）；缺失时估算并标 `estimated=1`。绿线：流式落库；数字与平台账单同量级。
9. **计费**：`/models` 透传 + `prices.yml` + `desk usage`。绿线：一条命令打出"今日 tokens + 估算费用"。
10. **预算拦截**：月预算 + 超限 429（先支持 warn 模式）。绿线：预算设 ¥0.01，下一个请求被拒。
11. **dsh 实测接入**：现有 web 实例临时指向网关跑一轮。绿线：会话正常 + 计量落库 + UI 统计正常。

### P2 账号、登录、门户

12. **登录**：argon2 + httpOnly cookie；登录/登出页。绿线：错密码拒绝、对密码进入。
13. **门户页**：`/portal/me`（我的用量）、`/portal/admin`（成员管理）。绿线：两页可用，数字来自 P1 账本。
14. **登录闸门 + 反代**：未登录跳登录；登录后根路径透传本人实例；WS 透传；跨成员拒绝。绿线：两台设备两个账号互测，谁都进不了对方工作台。
15. **信任自动化**：实例启动自动带 `--trusted-host <门户 authority>`。绿线：去掉手工参数重起，页面照常。

### P3 每人独立工作区

16. **实例管理**：`desk agent start/stop/status`（模板 DSH_HOME 复制、端口分配、cwd、env 注入、日志）。绿线：一条命令起停；日志进 logs/。
17. **工作区规范**：`users/<u>/workspace` + AGENTS.md 模板 + 权限收紧。绿线：A 的 agent 写文件只落 A 目录。
18. **自启与守护**：systemd --user（WSL 不便则脚本+cron 守护；崩溃重拉）。绿线：重启机器后自动恢复，门户可用。
19. **隔离复查脚本**：key 不外泄、目录互不可读、用量各记各的。绿线：复查脚本全绿。

### P4 交付化（可给别人用）

20. **运维**：setup / backup / restore / logs 脚本 + 一页部署说明。绿线：按文档从零重装一遍成功。
21. **试用验收**：1–2 个试用账号完整走"登录 → 干活 → 查账"。绿线：清单全过。
22. **收尾**：已知问题清单 + 下一期候选（任务卡/提交验收、花名册、通知、远程接入）。

## 八、安全与边界（如实说）

- 真 key 只存在网关（`~/.desk/keys.env`，chmod 600；不入库、不进 git、不进日志）。建议为工作台**单独开一枚 key**（先用现有 key 过渡）。
- 用户只拿虚拟钥匙，可单独吊销，不影响别人。
- 隔离强度：同一 OS 账号下的"目录级 + 进程级"隔离，够 1–3 人内部试用；升级路径 = 独立系统用户 / 容器 / 独立机器。
- 门户先只开局域网；对公网暴露前需加 HTTPS、限速、审计（本期不做）。

## 九、风险与开放问题

- dsh 处于 rc 阶段，flag 与内部接口会变 → 钉版本（记录基线 0.1.0-rc.5），升级走回归清单。
- WSL 局域网可达性两方案择一（P0 定案）。
- 流式 usage 缺失时按估算记账，口径写明"以网关为准"。
- 每实例一个 Node 进程，1–3 人可控；>5 人要评估资源。
- 仓库名已定 `DSH-ANYWORK`；本地开发目录 `~/dsh-anywork`。

## 十、GitHub 与每日维护

- **托管**：GitHub 公开仓库 `DSH-ANYWORK`（MIT），当开源项目运营（README 中英、CI、Issue 模板逐步齐备）。
- **就位进度**：✅ gh 登录（bugbyc0922）· ✅ 账号旧内容清空（8 个旧仓库已删）· ✅ 建仓 + 首版推送 · ⬜ CI · ⬜ 每日巡逻任务。
- **每日维护（双轨）**：
  1. 真人节奏：按 TODO 一天推进，完成即提交（conventional commits）。
  2. 巡逻兜底（定时任务，每天约 21:30）：拉最新 → 跑测试 → 写 `docs/devlog/YYYY-MM-DD.md`（当天提交/进展/待办）→ 有改动就提交推送；机器未开机则顺延。
