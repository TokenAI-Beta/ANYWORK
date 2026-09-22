# DSH-ANYWORK

[English](README.md) | 中文 | 📖 [使用手册](docs/GUIDE.md)

**基于 DeepSeek Harness 的自托管团队工作台。**

成员各自登录、各自独立工作区；模型的钥匙集中保管、按人计量。大家一起用 agent 干活，产出、账目、方法都留在自己的机器上。

> **状态：建设中（公开开发）。** P0–P3 均已完成并在局域网实机验证。P4（交付化）主体就绪——`setup/backup/restore/logs` 脚本、一页[部署说明](docs/DEPLOY.md)、真实的端到端[验收记录](docs/ACCEPTANCE.md)；从零重装待第二台机器实测。路线图与任务清单见 [`docs/PLAN.md`](docs/PLAN.md)，验证记录见 [`docs/BASELINE.md`](docs/BASELINE.md)，每日进展见 [`docs/devlog/`](docs/devlog/)；**使用手册见 [`docs/GUIDE.md`](docs/GUIDE.md)**。

## 这是什么

- **引擎**：官方 [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness)（dsh，MIT）——agent 能力、工具、沙箱直接复用，不改它的源码。
- **外壳（本项目）**：账号与登录、每人一个独立 dsh 实例与工作区、模型网关（真 key 不下发、按人记账、可限额）、门户页面。工作台内还有团队模块：任务板、知识库、公司盘、通知、公告，以及**会话删除（管理员批准制）**。
- 一句话：**dsh 管干活，DSH-ANYWORK 管“谁能用、用在哪、花了多少”。**

## 文档

- 📖 **[使用手册（功能使用指南）](docs/GUIDE.md)** —— 每个功能的「入口 → 怎么用 → 注意」＋功能索引总表。
- [部署说明](docs/DEPLOY.md) · [验收记录](docs/ACCEPTANCE.md) · [已知问题](docs/KNOWN-ISSUES.md)
- [路线图与任务清单](docs/PLAN.md) · [验证记录](docs/BASELINE.md) · [每日进展](docs/devlog/)

## 架构（目标形态）

```text
成员浏览器 → 门户（登录闸门 + 反向代理）
                 ├─ /portal/*  门户页（我的用量 / 管理）
                 └─ 其它路径    该成员的 dsh 实例（HTTP + WS 透传）
                        │
        dsh 实例池（每人一个：独立 home / 工作区 / 端口）
                        │  DEEPSEEK_BASE_URL 指向网关
                模型网关（持真 key、按人计量、预算拦截）
                        │
                api.deepseek.com
```

## 路线图（摘要）

| 阶段 | 内容 | 状态 |
|---|---|---|
| P0 | 可行性验证：多实例 / 启动参数 / 网关截获 / 局域网 | 🟡 手机侧待确认 |
| P1 | 模型网关 + 按人计量 | ✅ 已实机验证 |
| P2 | 账号、登录、门户 | ✅ 登录 / 门户 / 实例反代已上线 |
| P3 | 每人独立工作区（实例管理、自启守护） | ✅ systemd 单元 + 自启；隔离复查全绿 |
| P4 | 交付化（安装 / 备份 / 试用验收） | 🟡 脚本与文档就绪；验收实走全绿；从零重装待实测 |

任务共 22 项、每项带验收标准，见 [`docs/PLAN.md`](docs/PLAN.md)。

## 开发

要求：**Node 24+**，别无其他——服务零依赖（`node:http`、`node:sqlite`、内建 `fetch`），TypeScript 源码由 Node 直接运行（type stripping）。

```sh
# 1. 真 key（只留服务器上）
mkdir -p ~/.desk
echo 'DEEPSEEK_API_KEY=sk-…' > ~/.desk/keys.env
chmod 600 ~/.desk/keys.env

# 2. 门户 + 模型网关（一个进程；门户 :8080，网关 :8100 仅回环）
node src/server.ts

# 3. CLI：用户、密码、预算、实例端口、用量
node src/cli.ts user add alice             # 虚拟钥匙只显示一次
node src/cli.ts user passwd alice <密码>    # 门户登录密码
node src/cli.ts user budget alice 50       # 月度预算（CNY；off = 不限）
node src/cli.ts user agent alice 3301      # 绑定工作台实例端口
node src/cli.ts usage alice --month
```

浏览器打开 `http://<机器>:8080`——成员登录后查看自己的用量，并直接进入自己的 dsh 实例；管理员在工作台 设置 →「成员管理」里管理成员与模型通道。

> 桌面端：想要独立窗口（像软件一样），双击 `deploy/windows/dsh-workbench-app.bat`，或在浏览器里用「安装应用 / 创建快捷方式（在窗口中打开）」。壳加载的就是同一网页，功能自动与网页端同步。

侧栏还带 WorkBuddy 式模块入口：**🧑‍💼 助理**（预设一览）、**🧩 技能·连接器**（技能库全文 + 连接器状态）、**⚡ 自动化**（定时提醒增删，管理员）。

启动成员实例用辅助脚本（自动读 `~/.desk/agents/<user>.key`，自动附带门户 authority 的 `--trusted-host`）：

```sh
DESK_PORTAL_AUTHORITY=<门户 host:port> scripts/start-agent.sh alice 3301 ~/desk-test/u1
```

### 自启与管理（systemd）

本机全栈以 **systemd 单元**常驻（门户 + 每人一个实例单元；`Restart=always`），崩溃与重启自动恢复：

```sh
sudo bash scripts/install-services.sh   # 安装并启用全部单元
sudo bash scripts/desk.sh status        # status | start | stop | restart [all|server|u1|u2|u3]
journalctl -u desk-server -n 50         # 日志（各实例单元同理）
```

Windows 侧：登录启动项拉起 WSL；`.wslconfig` 关闭 WSL 空闲自动停机（`vmIdleTimeout=-1`）；一次性授权的计划任务（`desk-net-refresh.ps1`）让局域网端口转发跟着 WSL IP 走。

### 工作台设置页（dsh 客户端插件）

`plugin/desk-panel/` 是一个小型 **dsh 客户端插件**：借 dsh 官方插件机制（`settings.section` + `sidebar.footer.action` 槽位 + `dsh plugin`）在 dsh「设置」中加入一组团队页——**「工作台用量」**（我的用量）、**「任务板」**（团队待办）、**「知识库」**（共享知识：检索 + 沉淀）、**「公司盘」**（共享文件：浏览/下载/上传）、**「成员管理」**（成员与模型通道，管理员）、**「通知」**（通知桥 + 定时提醒，管理员）、**「运维」**（服务/探活/备份/磁盘，管理员），并在**侧栏底部挂「📢 公告」**（团队公告 + 意见反馈，带未读徽标）——**不改 dsh 源码、零构建、零 npm 依赖**。按实例挂载：

```sh
DSH_HOME=<实例 home> node <dsh 检出目录>/apps/cli/lib/bin.js plugin --profile web add \
  file:<本仓库>/plugin/desk-panel
```

数据来自门户的 `/portal/api/usage`——从门户打开工作台即可看到。

## 许可

[MIT](LICENSE)。第三方项目，与 DeepSeek 官方无关。
