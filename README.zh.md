# DSH-ANYWORK

[English](README.md) | 中文

**基于 DeepSeek Harness 的自托管团队工作台。**

成员各自登录、各自独立工作区；模型的钥匙集中保管、按人计量。大家一起用 agent 干活，产出、账目、方法都留在自己的机器上。

> **状态：建设中（公开开发）。** 第一版先把地基做完：登录 + 每人独立工作区 + 模型网关按人计量。完整路线图与任务清单见 [`docs/PLAN.md`](docs/PLAN.md)，每日进展见 [`docs/devlog/`](docs/devlog/)。

## 这是什么

- **引擎**：官方 [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness)（dsh，MIT）——agent 能力、工具、沙箱直接复用，不改它的源码。
- **外壳（本项目）**：账号与登录、每人一个独立 dsh 实例与工作区、模型网关（真 key 不下发、按人记账、可限额）、门户页面。
- 一句话：**dsh 管干活，DSH-ANYWORK 管"谁能用、用在哪、花了多少"。**

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
| P0 | 可行性验证：多实例 / 启动参数 / 网关截获 / 局域网 | ⬜ |
| P1 | 模型网关 + 按人计量 | ⬜ |
| P2 | 账号、登录、门户 | ⬜ |
| P3 | 每人独立工作区（实例管理、自启守护） | ⬜ |
| P4 | 交付化（安装 / 备份 / 试用验收） | ⬜ |

任务共 22 项、每项带验收标准，见 [`docs/PLAN.md`](docs/PLAN.md)。

## 许可

[MIT](LICENSE)。第三方项目，与 DeepSeek 官方无关。
