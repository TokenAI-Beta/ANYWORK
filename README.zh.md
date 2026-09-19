# DSH-ANYWORK

[English](README.md) | 中文

**基于 DeepSeek Harness 的自托管团队工作台。**

成员各自登录、各自独立工作区；模型的钥匙集中保管、按人计量。大家一起用 agent 干活，产出、账目、方法都留在自己的机器上。

> **状态：建设中（公开开发）。** P0（可行性验证）与 P1（模型网关 + 按人计量）已完成，并对真实 API 做了端到端验证。P2 进行中——登录与用量门户已上线，下一步是实例登录闸门/反代。完整路线图与任务清单见 [`docs/PLAN.md`](docs/PLAN.md)，验证记录见 [`docs/BASELINE.md`](docs/BASELINE.md)，每日进展见 [`docs/devlog/`](docs/devlog/)。

## 这是什么

- **引擎**：官方 [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness)（dsh，MIT）——agent 能力、工具、沙箱直接复用，不改它的源码。
- **外壳（本项目）**：账号与登录、每人一个独立 dsh 实例与工作区、模型网关（真 key 不下发、按人记账、可限额）、门户页面。
- 一句话：**dsh 管干活，DSH-ANYWORK 管“谁能用、用在哪、花了多少”。**

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
| P2 | 账号、登录、门户 | 🟡 登录与门户已上线；反代下一步 |
| P3 | 每人独立工作区（实例管理、自启守护） | ⬜ |
| P4 | 交付化（安装 / 备份 / 试用验收） | ⬜ |

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

# 3. CLI：用户、密码、预算、用量
node src/cli.ts user add alice             # 虚拟钥匙只显示一次
node src/cli.ts user passwd alice <密码>    # 门户登录密码
node src/cli.ts user budget alice 50       # 月度预算（CNY；off = 不限）
node src/cli.ts usage alice --month
```

浏览器打开 `http://<机器>:8080`——成员登录后查看自己的用量；管理员在 `/portal/admin` 管理成员。任何 dsh 实例挂到网关（用成员的虚拟钥匙）：

```sh
DEEPSEEK_BASE_URL=http://127.0.0.1:8100 DEEPSEEK_API_KEY=sk-desk-… dsh web --port 3301
```

## 许可

[MIT](LICENSE)。第三方项目，与 DeepSeek 官方无关。
