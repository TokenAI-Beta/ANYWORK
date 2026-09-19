# 部署说明（一页版）

> 目标环境：Windows 11 + WSL2（Ubuntu，systemd）。全部服务跑在 WSL 里，Windows 只做"开机拉起 + 端口转发"。
> 日常运维速查在文末；已知问题见 [`KNOWN-ISSUES.md`](KNOWN-ISSUES.md)。

## 前置

- Windows 11 + WSL2 发行版（已启用 systemd；`wsl -l -v` 可见）
- Node 24（部署路径约定 `~/opt/node-v24.19.0-linux-x64/`，或 PATH 中任意 24+）
- 官方 dsh 检出：`~/deepseek-harness`（`apps/cli/lib/bin.js` 可执行）
- 本仓库检出：`~/dsh-anywork`

## 从零开始

```sh
# 1) 初始化自检（缺什么补什么；核心三步：填 key、起服务、建用户）
bash scripts/setup.sh

# 2) 真 key（只留服务器上；setup 会生成模板）
vi ~/.desk/keys.env        # DEEPSEEK_API_KEY=sk-…
chmod 600 ~/.desk/keys.env

# 3) 装 systemd 单元（开机自启 + 崩溃重拉 + 每日备份计时器）
sudo bash scripts/install-services.sh
bash scripts/desk.sh status          # 四单元 active + 健康检查

# 4) 建第一个成员（会打印一次性虚拟钥匙，交给本人）
node src/cli.ts user add alice --admin   # 管理员（可进 /portal/admin）
node src/cli.ts user passwd alice <密码> # 门户登录密码
node src/cli.ts user budget alice 50     # 月度预算 CNY（off = 不限）
node src/cli.ts user agent alice 3303    # 绑定实例端口

# 5) 给该成员挂上实例单元（deploy/systemd/desk-agent-*.service 里改名字/端口/目录后）
sudo bash scripts/install-services.sh
```

浏览器打开 `http://<机器局域网IP>:8080` 登录；管理员在 `/portal/admin` 管理成员与模型通道。

## Windows 侧（三条保活线）

1. **登录拉起 WSL**：`%APPDATA%\Microsoft\Windows\Start Menu\Programs\Startup\dsh-anywork-wsl-boot.vbs`（登录即 `wsl -e true`，systemd 随之自启服务）。
2. **端口转发（局域网/手机访问）**：`netsh portproxy 0.0.0.0:8080 → <WSL IP>:8080` + 防火墙规则。
   自动刷新脚本 `C:\Users\Yangc\AppData\Local\desk-anywork\desk-net-refresh.ps1`；建登录任务：管理员运行同目录 `desk-task-setup.ps1`（一次性 UAC）。
3. **禁止 WSL 空闲自动停机**：`C:\Users\Yangc\.wslconfig`：
   ```ini
   [wsl2]
   vmIdleTimeout=-1
   [general]
   instanceIdleTimeout=-1
   ```

> 改完 `.wslconfig` 需 `wsl --shutdown` 后重新进入才生效。

## 日常运维

```sh
bash scripts/desk.sh status|start|stop|restart [all|server|u1|u2|u3]
bash scripts/logs.sh [server|u1|u2|u3] [行数]     # 或 journalctl -u desk-server
bash scripts/check-isolation.sh                    # 隔离复查（密钥/权限/围栏/哈希）
python3? 不需要——零依赖
```

**备份**：`desk-backup.timer` 每天 03:40 自动跑；手工 `bash scripts/backup.sh` → `~/desk-backups/desk-<时间>.tar.gz`（含账本快照 VACUUM INTO + 数据目录 + 密钥；保留 14 份）。
**恢复**：`sudo bash scripts/restore.sh <备份.tar.gz>`（会先停服务并自动先备份现状）。

### 可选：会话导出 / 跨会话检索

- **导出**（现成可用）：会话右上角 `Session log` 按钮，或输入 `/export` → 浏览器下载 ZIP（含会话、子会话、附件）。
- **跨会话检索**（agent 搜索历史会话，opt-in）：
  ```sh
  bash scripts/enable-session-search.sh /home/yangc/desk-test/<实例>
  sudo systemctl restart desk-agent-<名字>
  ```
  幂等可重复跑；详细说明见脚本头部注释。

## 升级

- **本仓库**：`git pull` → `sudo bash scripts/install-services.sh`（单元有变时）→ `bash scripts/desk.sh restart`。
- **dsh**：升级后按回归清单重跑（多实例、信任围栏 `--trusted-host`、客户端插件挂载、网关截获、RPC 载荷格式），再重启实例单元。
- **插件**：`plugin/desk-panel/` 改动后对每实例 `remove + add` 再重启（安装副本是硬链接）。

## 排障速查

| 现象 | 先看 |
|---|---|
| 服务"莫名全死" | `wsl -l -v` 是否 Stopped；`.wslconfig` 是否在（空闲停机） |
| 局域网/手机连不上 | `netsh interface portproxy show v4tov4` 是否指向**当前** WSL IP（跑 desk-net-refresh） |
| 单实例起不来 | `bash scripts/logs.sh u1`；`~/.desk/agents/<user>.key` 是否存在（600） |
| 账本不动 | `bash scripts/logs.sh server`；网关 8100 是否在；虚拟钥匙是否被吊销 |
| 页面报 403 | 实例 `--trusted-host` 是否含门户 authority（改端口/域名后要同步改单元） |
