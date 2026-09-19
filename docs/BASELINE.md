# 基线事实（P0/P1/P2 验证记录）

> 记录日期：2026-09-19 · 环境：Windows 11 + WSL2（Ubuntu 26.04，systemd）· dsh 0.1.0-rc.5（本地构建：`~/deepseek-harness`）

## P0-1 dsh 多实例 ✅（2026-09-19）

**结论**：同一台机器上，用"一套 DSH_HOME + 一个端口"可并存多个 dsh web 实例，会话与工作区完全隔离。

方法：
- `profiles/web` 只有 4 个小文件（`cordis.yml` / `cordis.patch.yml` / `package.json` / `pnpm-workspace.yaml`），新 home 直接拷贝即可；插件从 dsh 安装目录解析，无需重装。
- 启动（两个关键：`setsid` + `</dev/null`；脚本里先 `export PATH="$HOME/opt/node-v24.19.0-linux-x64/bin:$HOME/bin:$PATH"`）：

```sh
export PATH="$HOME/opt/node-v24.19.0-linux-x64/bin:$HOME/bin:$PATH"
DSH_HOME=/home/yangc/desk-test/u1 \
  setsid node /home/yangc/deepseek-harness/apps/cli/lib/bin.js web --port 3301 \
  </dev/null >> ~/desk-test/u1/web.log 2>&1 &
```

（现用 `scripts/start-agent.sh` 一键启动，含网关接线与 `--trusted-host`。）

验证证据：
- u1(:3301) 与 u2(:3302) 同时在线（HTTP 200），跨独立调用存活。
- 在 u1 创建会话 `session-5eb3f6db-…`（cwd=`u1/workspace`）后：u1 `session.list` 可见，u2 `session.list` 为空；两侧 `storages/` 独立。
- Windows 侧可直达（WSL localhost 转发）：`http://127.0.0.1:3301` → 200。

**坑（重要）**：裸 `nohup … &` 启动的实例，在启动命令的 wsl.exe 会话退出后**会被杀掉**；必须 `setsid … </dev/null`（或 systemd）才能常驻 → P3 自启守护按 systemd 做。另：**忘了 `export PATH` 时 `setsid: failed to execute node`（静默不出进程）**。

## P0-2 启动参数与信任围栏 ✅

- `--port` 实测有效（3301/3302 各自监听）。
- `/api` 浏览器信任围栏：`Host: 127.0.0.1:3301` → 200；`Host: evil.example:3301` → **403**。**放行侧已补测（2026-09-19）**：实例带 `--trusted-host 192.168.0.171:8080` 后，`Host: 192.168.0.171:8080` → **200**。
- 围栏规则（源码 `packages/client/connection/lib/types/api-request-trust.js`）：Host 必须 ∈ {loopback, 部署 LAN IP, `trustedHosts` 声明}（trustedHosts 条目为 `host:port` 精确匹配，或裸 `host` 任意端口）；携带 `Origin` 时必须与 Host 同 authority；`sec-fetch-site: cross-site` 直接拒。→ 反代方案：Host/Origin 原样透传 + 实例启动带 `--trusted-host <门户 authority>`。
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
  1. 主请求：`model=deepseek-v4-flash`、`stream=true`、`stream_options={"include_usage":true}`，字段集 `model, messages, stream, stream_options, thinking, reasoning_effort, tools(25), max_tokens`。
  2. 会话标题生成请求（更小、无 tools）。
- **关键发现：dsh 自带 `stream_options.include_usage:true`，usage 随流末块返回** → 网关记账直接读末块 usage（缺失才兜底估算）。
- 假流式回包被完整解析：assistant 内容入历史；usage（123/45，含缓存命中 23）正确进入会话统计（`uncachedInput=100, cacheRead=23, output=45`）。

补充（RPC 载荷）：`session.prompt` = `{sessionId, mode:'queue', content:[{type:'text',text}], clientTimeZone?}`；事件流：`turn/start → step/start → user/message → request/header → assistant/chunk… → assistant/message → step/end → turn/end`。

## P0-4 局域网可达 ◐（2026-09-19：Windows 侧全通；手机实测待确认）

链路：`局域网设备 → 本机:8080 →（netsh portproxy）→ WSL:8080 → 门户`（旧测试页 :8090 已退役）。

- WSL IP 会随 WSL 重启变化（当前 `172.25.49.59`）；NAT 模式必须 portproxy + 防火墙。
- 已执行（管理员，一次性）：

```powershell
netsh interface portproxy add v4tov4 listenaddress=0.0.0.0 listenport=8080 connectaddress=<WSLIP> connectport=8080
New-NetFirewallRule -DisplayName 'DSH-DESK-P0-4' -Direction Inbound -Action Allow -Protocol TCP -LocalPort 8080 -Profile Any
```

- 已验证：Windows `http://127.0.0.1:8080/` 与 `http://192.168.0.171:8080/` 均达门户（302 → 登录页）；登录后反代与 WS 全链路通过（见 P2）。
- 待确认：手机（同一 Wi-Fi）打开 `http://192.168.0.171:8080/`。
- 备注：WSL IP 变化在部署脚本里自动刷新（或改用 mirrored 模式）。

## P1 模型网关 ✅（2026-09-19）

**结论**：零依赖网关（Node 24 内建 `node:http` + `node:sqlite`，无任何 npm 依赖）上线：虚拟钥匙鉴权 → 换真 key 转发 → usage 落库。真 key 单独保管在 `~/.desk/keys.env`（chmod 600），从不下发给成员。

- 入口：`node src/server.ts`（回环 `:8100`）：`/healthz`、`/models`（免鉴权透传）、`/chat/completions`（Bearer 虚拟钥匙 `sk-desk-…`）。
- 记账：流式读 SSE **末块 usage**（dsh 自带 `include_usage`；缺失才粗估并标 `estimated=1`）；`usage_events` 表按人/按模型记账，虚拟钥匙只存 sha256。
- 价格：`config/prices.json`（CN 区 CNY，按请求发生时刻判峰谷；空闲＝高峰半价）。
- 预算：`node src/cli.ts user budget <name> <cny|off>`；超限 **429**（`DESK_BUDGET_WARN_ONLY=1` 可改为仅告警）。
- CLI：`user add` / `user list` / `user passwd` / `user budget` / `user agent` / `usage [name] [--month]`。

实测证据（2026-09-19）：
1. 直连 curl 非流式 / 流式各一次 → usage 正确入账（34/64、33/64）。
2. **u3 实例挂真网关完成一轮发言**：模型回复入会话历史（`"1\n2\n3"`），`deepseek-v4-flash` 主请求 **7653 输入 tokens 入账 alice（¥0.0077）**；`usage alice` 可查。
3. 错钥匙 → 401；预算设 ¥0.005（已花 ¥0.0083）→ 请求被 **429** 拒绝，关闭预算后恢复 200。

## P2 门户 + 反代 ✅（2026-09-19，12–15 过线）

- 门户 :8080（与网关同一进程：`node src/server.ts`）：登录 / 登出（内建 scrypt + httpOnly 会话 Cookie、失败 5 次限速 60s）、`/portal/me`（我的用量 + 我的工作台入口）、`/portal/admin`（成员管理 + 页面建号发钥匙）。
- 反代（14）：门户对非门户路径 catch-all 反代到该成员实例（Host/Origin 原样透传）；`/api` WebSocket 升级透传（未登录 401、无实例 503）；跨成员隔离由会话→实例映射保证。
- 信任自动化（15）：`scripts/start-agent.sh <user> <port> [home]` 启动实例（自动带 `--trusted-host <门户 authority>`，读 `~/.desk/agents/<user>.key`）。
- 成员↔实例：alice→u3:3303、boss→u1:3301、bob→u2:3302（`node src/cli.ts user agent` 绑定）。演示账号：alice / boss（admin）/ bob —— 正式启用前更换密码。
- 局域网入口：Windows portproxy `0.0.0.0:8080 → WSL:8080`（门户）。
- 实测（全部通过）：
  1. 未登录跳登录 302；错密码 err=1；对密码进 `/portal/me`；member 访问管理页 403；登出后 302。
  2. 反代：alice 经门户见 u3 会话（`session-9acd7dda`）、boss 见 u1 会话（`session-5eb3f6db`）、bob 空仓 —— 三账号三实例完全隔离。
  3. WS：无 cookie 401 / 有 cookie **101 Switching Protocols**。
  4. 局域网全链路（Windows → `192.168.0.171:8080`，Origin=LAN 权威）：登录 302、反代 200、RPC 见本人会话、WS 101。

## 环境速记

- node：`~/opt/node-v24.19.0-linux-x64/bin/node`；dsh 入口：`~/deepseek-harness/apps/cli/lib/bin.js`。
- 实例：`~/desk-test/u1` / `u2` / `u3`（boss / bob / alice；由 `scripts/start-agent.sh` 启动，均带 `--trusted-host` 与网关接线）。虚拟钥匙留档 `~/.desk/agents/<user>.key`（600）。
- 网关数据：`~/desk-data/desk.db`；真 key：`~/.desk/keys.env`（600）。
- 局域网入口：Windows portproxy `0.0.0.0:8080 → WSL:8080`（门户；条目切换脚本 `C:\Users\Yangc\AppData\Local\Temp\desk-p2-portproxy.ps1`，需 UAC）；旧测试页 `~/desk-test/www`（:8090）已退役。Windows 局域网 IP `192.168.0.171`（WLAN）。
- DeepSeek 计费（2026-08-16 起）：高峰＝北京时间周一至周五 9:00–12:00、14:00–18:00；其余（含整周末）为空闲时段，价格恰为高峰一半。
