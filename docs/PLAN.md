# DSH-ANYWORK 团队工作台 — 实施计划

**状态：** 实施中（P0 ✅ / P1 ✅ / P2 ✅；下一步 P3） · **日期：** 2026-09-18（2026-09-19 更新） · **底座：** 官方 DeepSeek Harness（`@deepseek-ai/dsh`，MIT） · **托管：** github.com/bugbyc0922/DSH-ANYWORK（公开） · **明确不做：** 不采用 TDHarness-coding 的任何代码，独立实现。

> 更新（2026-09-19）：P0 全部通过、P1 完成、**P2 全部完成**（12–15 ✅：登录 / 门户 / 登录闸门+反代 / 信任自动化，均实机验证）；计划外打通 **dsh 客户端插件机制**（设置内嵌「工作台用量」页）；**企业知识库 v1** 上线（共享目录 + 检索接口 + 设置「知识库」页）—— 见 [`BASELINE.md`](BASELINE.md) 与 [`devlog/2026-09-19.md`](devlog/2026-09-19.md)。

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
| 本期待列 | 任务卡 + 提交验收四格、花名册/同事视图、通知、远程接入、客户端模式、**公司盘**、**多上游通道管理（订阅 / key）**、**知识库深化（权限过滤 / 自动更新）** |

## 二、已核实的技术情报（写码前 P0 只做复核）

1. **模型出口可替换**：`packages/llm/llm-deepseek` 的 baseURL 回退到 `$DEEPSEEK_BASE_URL`，请求路径为 `POST {baseURL}/chat/completions` —— 自建网关截流可行，**不用改 dsh 源码**。
2. **`DSH_HOME` 可配置**：profiles / 会话 / 全局配置都在其下 —— 每人一份 home = 会话与设置天然隔离。
3. **启动参数**：`dsh web` 支持 `--port`、可重复的 `--trusted-host`（`apps/cli/reference/README.zh.md`）；`--trusted-host` 用来让非回环访问通过 `/api` 浏览器信任围栏 —— 门户反代需要它。
4. **多实例共存**：默认端口来自 `ctx.webStartup.port ?? 3080`（`packages/bundle/web-app/cordis.patch.yml`），换端口即可同机跑多个实例。
5. **前端事件面**：WebSocket（`/api/events.mux`、`/api/events.host`）+ `POST /api` RPC —— 反代必须透传 WS。
6. **`--host` 说法不一**：参考文档称 CLI 有意不支持 `0.0.0.0` 并直接报用法错误 —— 不影响本方案：实例只绑回环，由门户代理对外。
7. **现有环境**：dsh 在 WSL `~/deepseek-harness`（0.1.0-rc.5，已 build）；node 24 + pnpm 就绪；KRouter 已挂 headless。
8. **客户端插件机制（2026-09-19 打通）**：dsh 前端本身由插件组合（`ui-slots` 槽位 + `ui-settings-*` 系列）；外部包声明 `dsh.bundle.patch`（`cordis.patch.yml`，插入行用 `- insert:` 块）+ `dsh.client`（`{platform:'web', inject:[]}` + `./client` 导出），经 `dsh plugin --profile web add file:` 挂载后自动进入 bundles 层；浏览器侧 bundle 为闭包工厂格式，`require` 仅限平台模块（react / ui-slots / ui-primitives / web-react / schema-form / attachment / cordis）。→ 设置内嵌页面零改源码可实现。

P0 复核结果：第 3 条已实测（`--port` 有效；非回环假 Host 对 `/api` 返回 **403**；放行侧已补测 `--trusted-host` 生效）；WSL 局域网方案已定案（portproxy + 防火墙，见 BASELINE）；**流式 usage 随末块返回已确认**（dsh 自带 `stream_options.include_usage:true`）。

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
│  ├─ server.ts        # 入口：门户 :8080 + 网关 :8100（一个进程）
│  ├─ portal.ts        # 门户：登录/登出、我的用量、成员管理、登录闸门 + 反代（内联 HTML）
│  ├─ gateway.ts       # /chat/completions、/models 转发 + 计量 + 预算
│  ├─ auth.ts          # 密码散列（scrypt）+ 会话 Cookie
│  ├─ db.ts            # SQLite schema + 迁移（node:sqlite，零依赖）
│  ├─ pricing.ts       # 价格表读取 + 费用计算（峰谷）
│  ├─ keys.ts          # 虚拟钥匙生成 / 哈希（只存 sha256）
│  └─ cli.ts           # desk user / passwd / budget / agent / usage
├─ plugin/
│  └─ desk-panel/      # dsh 客户端插件：「工作台用量」设置页（settings.section 槽；零构建、零依赖）
├─ config/
│  └─ prices.json      # 模型价格表（JSON；缓存命中/未命中分开）
├─ scripts/
│  └─ start-agent.sh   # 实例启动（自动带 --trusted-host；setup/backup 脚本在 P4）
└─ tests/              # 测试（P2+ 补）
```

## 五、数据模型（SQLite 草案）

- `users`(id, username, display_name, role, password_hash, status, agent_port, workspace, created_at, last_login_at, monthly_budget_cny)
- `login_sessions`(id, user_id, token_hash, created_at, expires_at, ip, user_agent)
- `api_keys`(id, user_id, token_hash, label, created_at, revoked_at)  — 虚拟钥匙，只存 hash
- `usage_events`(id, user_id, ts, model, prompt_tokens, completion_tokens, cache_hit_tokens, cache_miss_tokens, usage_json, estimated, status)
- `budgets`(user_id, period, limit_cny, warn_ratio)
- `audit_events`(id, ts, actor_user_id, action, detail_json)

已落地：`users`（含 `monthly_budget_cny`、`password_hash`、`agent_port`）、`api_keys`、`usage_events`、`login_sessions`；其余表随对应阶段建。

## 六、对外接口（草案）

- 网关：`POST /chat/completions`（Bearer 虚拟钥匙）、`GET /models`、`GET /healthz`
- 门户：`GET|POST /login`、`POST /logout`、`GET /portal/me`、`GET|POST /portal/admin/users`、`GET /portal/api/usage`（JSON，供设置页插件/小组件）；其余路径 → 本人实例（HTTP + WS）
- CLI（已实现）：`user add|list|passwd|budget|agent`、`usage [u] [--month]`；`desk agent start|stop|status`（P3）、`desk backup`（P4）

## 七、阶段与任务（共 22 项，一次做一项，每项有绿线）

### P0 可行性验证 ✅（2026-09-19 全部过线）

1. ✅ **dsh 多实例**：两个 DSH_HOME + 两个端口各起 web 实例。绿线：两实例并存，会话互不可见。
2. ✅ **启动参数实测**：`--port`、`--trusted-host` 实机行为（含非回环 Host 对 /api 的拒绝/放行）。绿线：curl 假 Host/Origin 结果符合预期，命令原文记进 BASELINE。（`--port` ✅；拒绝侧 403 ✅；放行侧已补测：Host=门户 authority → 200）
3. ✅ **网关截获**：DEEPSEEK_BASE_URL 指向临时假服务器，观察 dsh 真实请求（路径/头/流式格式），并回一段假流式。绿线：假服务器完整记录一轮，dsh UI 正常出字。
4. ◐ **局域网开放**：Windows→WSL 方案定案（netsh portproxy 或 .wslconfig mirrored）。绿线：手机/另一台电脑能打开测试页。（Windows 侧 ✅；手机实测待确认）
   → 产出 `docs/BASELINE.md`（事实 + 命令原文）。✅

### P1 模型网关 + 按人计量 ✅（2026-09-19 完成并实机验证）

5. ✅ **脚手架**：repo + `/healthz`。绿线：健康检查 200。（实现口径：**零依赖** —— Node 24 内建 `node:http` + `node:sqlite` + 直跑 TypeScript，未引入 Fastify / better-sqlite3。）
6. ✅ **用户与虚拟钥匙**：users / api_keys 表 + `desk user add`。绿线：钥匙只显示一次，库里只有 hash。
7. ✅ **网关（非流式）**：鉴权 → 转发 → usage 落库。绿线：curl 走网关真实调用一次，usage_events 数字正确。
8. ✅ **网关（流式）**：SSE 透传 + 末块 usage 提取；缺失时估算并标 `estimated=1`。绿线：流式落库；数字与平台账单同量级。
9. ✅ **计费**：`/models` 透传 + 价格表 + `desk usage`。绿线：一条命令打出"用量 tokens + 估算费用"。（价格表为 `config/prices.json`。）
10. ✅ **预算拦截**：月预算 + 超限 429（`DESK_BUDGET_WARN_ONLY=1` 可切告警模式）。绿线：预算设低，下一个请求被拒。
11. ✅ **dsh 实测接入**：web 实例指向网关跑一轮。绿线：会话正常 + 计量落库 + UI 统计正常。（u3：7653 输入 tokens 入账。）

### P2 账号、登录、门户 ✅（2026-09-19 完成）

12. ✅ **登录**：httpOnly cookie + 登录/登出页。绿线：错密码拒绝、对密码进入。（实现口径：密码散列用内建 **scrypt** 代替 argon2，维持零依赖；登录失败 5 次限速 60 秒。）
13. ✅ **门户页**：`/portal/me`（我的用量）、`/portal/admin`（成员管理 + 页面建号发钥匙）。绿线：两页可用，数字来自 P1 账本。
14. ✅ **登录闸门 + 反代**：未登录跳登录；登录后根路径透传本人实例；WS 透传；跨成员拒绝。绿线：两台设备两个账号互测，谁都进不了对方工作台。（实现：Host/Origin 原样透传 + 实例 `--trusted-host` 信任门户 authority；三账号三实例隔离实测通过，WS 101。）
15. ✅ **信任自动化**：实例启动自动带 `--trusted-host <门户 authority>`。绿线：去掉手工参数重起，页面照常。（`scripts/start-agent.sh`；已用该脚本重起三实例验证。）
    ➕ 计划外：**设置页插件**（`plugin/desk-panel/`）——借 dsh 官方客户端插件机制把「工作台用量」做进工作台「设置」（`settings.section` 槽位；零构建零依赖、未改 dsh 源码；三实例已挂载验证）。
    ➕ 计划外：**企业知识库 v1**——共享目录 `~/desk-data/kb/`（`kb-template/` 首启落位）+ `/portal/api/kb/search` 检索接口 + 设置「知识库」查询页；workspace AGENTS.md 提示 agent 可直接读。

### P3 每人独立工作区（下一步）

16. **实例管理**：`desk agent start/stop/status`（模板 DSH_HOME 复制、端口分配、cwd、env 注入、日志）。绿线：一条命令起停；日志进 logs/。
17. **工作区规范**：`users/<u>/workspace` + AGENTS.md 模板 + 权限收紧。绿线：A 的 agent 写文件只落 A 目录。
18. **自启与守护**：systemd --user（WSL 不便则脚本+cron 守护；崩溃重拉）。绿线：重启机器后自动恢复，门户可用。
19. **隔离复查脚本**：key 不外泄、目录互不可读、用量各记各的。绿线：复查脚本全绿。

### P4 交付化（可给别人用）

20. **运维**：setup / backup / restore / logs 脚本 + 一页部署说明。绿线：按文档从零重装一遍成功。
21. **试用验收**：1–2 个试用账号完整走"登录 → 干活 → 查账"。绿线：清单全过。
22. **收尾**：已知问题清单 + 下一期候选（任务卡/提交验收、花名册、通知、远程接入、**公司知识库 / 公司盘**、**多上游通道管理**）。

## 八、安全与边界（如实说）

- 真 key 只存在网关（`~/.desk/keys.env`，chmod 600；不入库、不进 git、不进日志）。建议为工作台**单独开一枚 key**（先用现有 key 过渡）。
- 用户只拿虚拟钥匙（服务器留档 `~/.desk/agents/<u>.key`，600），可单独吊销，不影响别人。门户密码只存 scrypt 散列；会话 Cookie httpOnly + SameSite=Lax。
- 反代信任模型：实例只信任回环 + `--trusted-host` 声明的门户 authority；未登录一律跳登录，跨成员按会话映射天然隔离。
- 设置页插件在浏览器侧运行、只读门户接口（`/portal/api/usage` 需登录会话）；不触达模型请求。
- 隔离强度：同一 OS 账号下的"目录级 + 进程级"隔离，够 1–3 人内部试用；升级路径 = 独立系统用户 / 容器 / 独立机器。
- 门户先只开局域网；对公网暴露前需加 HTTPS、限速、审计（本期不做）。

## 九、风险与开放问题

- dsh 处于 rc 阶段，flag 与内部接口会变 → 钉版本（记录基线 0.1.0-rc.5），升级走回归清单（含客户端插件机制回归）。
- WSL 局域网可达性：portproxy 方案已定案（WSL IP 变化在部署脚本自动刷新）。
- 流式 usage 缺失时按估算记账，口径写明"以网关为准"。
- 每实例一个 Node 进程，1–3 人可控；>5 人要评估资源。
- 仓库名已定 `DSH-ANYWORK`；本地开发目录 `~/dsh-anywork`。

## 十、GitHub 与每日维护

- **托管**：GitHub 公开仓库 `DSH-ANYWORK`（MIT），当开源项目运营（README 中英、CI、Issue 模板逐步齐备）。
- **就位进度**：✅ gh 登录（bugbyc0922）· ✅ 账号旧内容清空（8 个旧仓库已删）· ✅ 建仓 + 首版推送 · ⬜ CI · ✅ 每日巡逻任务（2026-09-19 起，每天约 21:30，首跑已成功）。
- **每日维护（双轨）**：
  1. 真人节奏：按 TODO 一天推进，完成即提交（conventional commits）。
  2. 巡逻兜底（定时任务，每天约 21:30）：拉最新 → 跑测试 → 写 `docs/devlog/YYYY-MM-DD.md`（当天提交/进展/待办）→ 有改动就提交推送；机器未开机则顺延。
