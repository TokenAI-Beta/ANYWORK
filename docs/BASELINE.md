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

## P0-3 网关截获 ✅（2026-09-19）

**结论**：`DEEPSEEK_BASE_URL` 指向自建服务器即可完整接管模型出口；dsh 的请求格式已完整记录（假网关：`~/desk-test/fake-deepseek.mjs`，日志 `~/desk-test/fake-requests.log`）。

假网关实测收到的请求：
- `GET /models`（无认证头；dsh 会调用 → 网关必须实现）。
- `POST /chat/completions`（一次发言触发 2 条）：
  1. 主请求：`model=deepseek-v4-flash`、`stream=true`、`stream_options={"include_usage":true}`，字段集 `model, messages, stream, stream_options, thinking, reasoning_effort, tools(25), max_tokens`，认证头 `Authorization: Bearer <key>`；
  2. 会话标题生成请求（更小、无 tools）。
- **关键发现：dsh 自带 `stream_options.include_usage:true`，usage 随流末块返回** → 网关记账直接读末块 usage（缺失才兜底估算）。
- 假流式回包被完整解析：assistant 内容入历史；usage（123/45，含缓存命中 23）正确进入会话统计（`uncachedInput=100, cacheRead=23, output=45`）。

补充（RPC 载荷）：`session.prompt` = `{sessionId, mode:'queue', content:[{type:'text',text}], clientTimeZone?}`；事件流：`turn/start → step/start → user/message → request/header → assistant/chunk… → assistant/message → step/end → turn/end`。

## P0-4 局域网可达 ◐（2026-09-19：Windows 侧全通；手机实测待确认）

链路：`局域网设备 → 本机:8080 →（netsh portproxy）→ WSL IP:8090 → WSL 内服务`

- WSL IP 会随 WSL 重启变化（当前 `172.25.49.59`）；NAT 模式必须 portproxy + 防火墙。
- 已执行（管理员，一次性）：

```powershell
netsh interface portproxy add v4tov4 listenaddress=0.0.0.0 listenport=8080 connectaddress=<WSLIP> connectport=8090
New-NetFirewallRule -DisplayName 'DSH-DESK-P0-4' -Direction Inbound -Action Allow -Protocol TCP -LocalPort 8080 -Profile Any
```

- 已验证：Windows `http://127.0.0.1:8080/` → 200（测试页）；`netstat` 见 `0.0.0.0:8080 LISTENING`。
- 待确认：手机（同一 Wi-Fi）访问 `http://192.168.0.171:8080/`。
- 备注：正式版 P2 门户将直接监听局域网地址并反代回环实例；WSL IP 变化在部署脚本里自动刷新（或改用 mirrored 模式）。

## 环境速记

- node：`~/opt/node-v24.19.0-linux-x64/bin/node`；dsh 入口：`~/deepseek-harness/apps/cli/lib/bin.js`。
- 测试实例：`~/desk-test/u1`、`u2`、`u3`（P0 期间常驻，可随时清理）。
- 局域网测试页：`~/desk-test/www`（python http.server :8090 + 端口转发 8080）；Windows 局域网 IP `192.168.0.171`（WLAN）。
- DeepSeek 计费（2026-08-16 起）：高峰＝北京时间周一至周五 9:00–12:00、14:00–18:00；其余（含整周末）为空闲时段，价格恰为高峰一半。
