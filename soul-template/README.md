# 团队 Soul 与工作区 README（统一行为准则）

两块内容，一个脚本铺到所有实例（幂等）：

| 文件 | 落在哪 | 作用 |
|---|---|---|
| `SOUL.md` | `~/desk-data/soul/SOUL.md`；实例 `~/desk-test/uN/AGENTS.md` 软链指向它 | dsh 的"用户全局指令"——每个会话注入一次（位置等价于团队 SOUL） |
| `WORKSPACE-AGENTS.md` | `~/desk-test/uN/workspace/AGENTS.md` | 工作区 README：告诉 agent 知识库 / 公司盘 / 技能库在哪 |

## 用法

```sh
bash scripts/apply-soul.sh          # 铺全部实例（幂等；新会话即生效）
```

- 改 soul：编辑 `~/desk-data/soul/SOUL.md`（或改本目录 `SOUL.md` 后重跑脚本）——全体成员 agent 同步。
- 改工作区 README：编辑本目录 `WORKSPACE-AGENTS.md` 后重跑脚本。
- **同源约定**：`SOUL.md` 的正文与团队统一 `SOUL.md` 保持一致；仅身份句按工作台语境调整。
