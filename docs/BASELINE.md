# 基线事实（P0 验证记录）

> 记录日期：2026-09-19 · 环境：Windows 11 + WSL2（Ubuntu 26.04，systemd）· dsh 0.1.0-rc.5（本地构建：`~/deepseek-harness`）

## P0-1 dsh 多实例 ✅（2026-09-19）

**结论**：同一台机器上，用"一套 DSH_HOME + 一个端口"可并存多个 dsh web 实例，会话与工作区完全隔离。

方法：
- `profiles/web` 只有 4 个小文件（`cordis.yml` / `cordis.patch.yml` / `package.json` / `pnpm-workspace.yaml`），新 home 直接拷贝即可；插件从 dsh 安装目录解析，无需重装。
- 启动（常驻关键：`setsid` + `</dev/null`）：

```sh
DSH_HOME=/home/yangc/desk-test/u1 \
  setsid node /home/yangc/deepseek-harness/apps/cli/lib/bin.js web --port 3301 \
  </dev/null >> ~/desk-test/u1/web.log 2>&1 &
```

验证证据：
- u1(:3301) 与 u2(:3302) 同时在线（HTTP 200），跨独立调用存活。
- 在 u1 创建会话 `session-5eb3f6db-…`（cwd=`u1/workspace`）后：u1 `session.list` 可见，u2 `session.list` 为空；两侧 `storages/` 独立。
- Windows 侧可直达（WSL localhost 转发）：`http://127.0.0.1:3301` → 200。

**坑（重要）**：裸 `nohup … &` 启动的实例，在启动命令的 wsl.exe 会话退出后**会被杀掉**；必须 `setsid … </dev/null`（或 systemd）才能常驻 → P3 自启守护按 systemd 做。

## P0-2 启动参数与信任围栏（部分 ✅）

- `--port` 实测有效（3301/3302 各自监听）。
- `/api` 浏览器信任围栏：`Host: 127.0.0.1:3301` → 200；`Host: evil.example:3301` → **403**。→ 反代部署必须给实例加 `--trusted-host <门户 authority>`；放行侧行为待补测。
- RPC 直连格式（不经浏览器）：

```sh
curl -s -X POST http://127.0.0.1:3301/api/session.list \
  -H "content-type: application/json" \
  -d "{\"type\":\"client-request\",\"rpcId\":\"r-1\",\"method\":\"session.list\",\"payload\":{}}"
```

方法表：`packages/host/apiproxy/src/api/rpc-map.ts`（`session.*` / `workspace.*` / `host.*` 等）。

## P0-3 网关截获（待做）

## P0-4 局域网可达（待做；本机已验证 Windows→WSL localhost 转发）

## 环境速记

- node：`~/opt/node-v24.19.0-linux-x64/bin/node`；dsh 入口：`~/deepseek-harness/apps/cli/lib/bin.js`。
- 测试实例：`~/desk-test/u1`、`~/desk-test/u2`（P0 期间常驻，可随时清理）。
- DeepSeek 计费（2026-08-16 起）：高峰＝北京时间周一至周五 9:00–12:00、14:00–18:00；其余（含整周末）为空闲时段，价格恰为高峰一半。
