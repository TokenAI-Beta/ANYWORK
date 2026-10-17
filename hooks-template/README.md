# 团队安全闸门（hooks-template）

对每个成员实例的 **bash 工具**做执行前检查（dsh 官方 hooks 桥的 PreToolUse 拦截点）：

- `deny`（默认拦截）：明显破坏性命令 —— 递归强删关键路径、写块设备、删密钥/库文件、fork 炸弹、停用工作台服务、关机重启等。
- `ask`（弹审批）：风险但常见的操作 —— sudo、`curl | bash`、force push、递归改权限/属主、绝对路径递归删除（工作区外）等。成员在会话里看到审批框，允许才执行。
- 其余一律放行。拦截（deny）时会经通知桥给管理员推一条微信（`【安全闸门·已拦截】`）。

## 文件

| 文件 | 作用 |
|---|---|
| `hooks.json` | 钩子配置（PreToolUse 方言）：PreToolUse 匹配 `bash` → 跑 `danger-gate.mjs` |
| `danger-gate.mjs` | 判定脚本：读 stdin 载荷 → 按 `rules.json` 匹配 → 输出 deny/ask/放行；deny 时推微信 |
| `rules.json` | 规则表（`re` 为正则字符串，`i` 忽略大小写；deny 优先于 ask；改完**即生效**，脚本每次调用重读） |

## 部署（运维）

```sh
bash scripts/install-hooks.sh   # 幂等：铺 ~/desk-data/hooks/ + 各实例挂桥 + 重启提示
```

脚本会把本目录三件套复制到 `~/desk-data/hooks/`，并给每个实例的 profile 补丁挂上 hooks 桥行（`configPath` 指向共享区）。

## 调规则

直接编辑 `~/desk-data/hooks/rules.json`（或本目录改完重跑安装脚本）。想临时放行某个操作，把它写成更靠前的 `ask`，或从规则里去掉。语法错的规则会被跳过（不拦也不崩）。
