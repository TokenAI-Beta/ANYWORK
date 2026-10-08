# 部署说明（一页版）

> 两种部署方式：**方式一 Docker（推荐，任何 Linux 服务器，一条命令）**；方式二 Windows 11 + WSL2（本页后半部分）。两者数据互不相通，任选其一。
> 日常运维速查在文末；已知问题见 [`KNOWN-ISSUES.md`](KNOWN-ISSUES.md)。

## 方式一：Docker（推荐，Linux 服务器通用）

```bash
git clone https://github.com/bugbyc0922/DSH-ANYWORK.git && cd DSH-ANYWORK
cp .env.example .env    # 填两个必填项：ANYWORK_HOST（你的访问地址，如 192.168.1.50:8080）与 DEEPSEEK_API_KEY
docker compose up -d --build
```

- 打开 `http://<ANYWORK_HOST>/`，用 `.env` 里的管理员账号登录；密码留空则首次启动自动生成并打印一次（也可在卷内 `.desk/admin-password` 查看）。
- **组成**：单容器 = 门户(:8080) + 模型网关(:8100，仅容器内) + 每个成员一个 dsh 实例；数据全部在卷 `anywork_anywork-data`。
- **记账**：成员的模型请求都经容器内网关转发入账（真实 key 只留在容器内，成员拿不到）；用量在「设置 → 用量」按人查看。
- **首次启动**：自动建管理员号、发虚拟钥匙、配实例、装团队插件（需外网；装失败的插件重启容器会自动重试）。
- **加成员**：`.env` 里改 `ANYWORK_MEMBERS=alice,bob` 后 `docker compose up -d`（自动建号；初始密码在卷内 `.desk/accounts.txt`，转告本人后建议删除）；也可用 设置 →「成员管理」在线建。
- **升级**：`git pull && docker compose up -d --build`；换 dsh 版本改 `deploy/docker/Dockerfile` 里的 `DSH_REF`。
- **备份**：`docker run --rm -v anywork_anywork-data:/data -v "$PWD":/out alpine tar czf /out/anywork-backup-$(date +%F).tar.gz -C /data .`
- **排查**：
  - 页面打不开：确认端口（默认 8080，可改 `ANYWORK_PORT`）未被占用、防火墙放行；
  - 登录后立刻 401/白屏：核对 `ANYWORK_HOST` 与浏览器地址**完全一致**（含端口）——信任围栏按它校验；
  - 拉基础镜像慢：给 Docker 配国内镜像加速（daemon `registry-mirrors`）。

---

## 方式二：Windows 11 + WSL2 部署

### 前置

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
node src/cli.ts user add alice --admin   # 管理员（可进 设置 →「成员管理」）
node src/cli.ts user passwd alice <密码> # 门户登录密码
node src/cli.ts user budget alice 50     # 月度预算 CNY（off = 不限）
node src/cli.ts user agent alice 3303    # 绑定实例端口
node src/cli.ts user rm alice            # 删除成员（清钥匙行+会话；历史账本保留）

# 4b) 通知桥（可选，管理员在 工作台 设置 →「通知」里配置通道；agent 侧脚本随 setup 落位）
#   agent 发通知：~/desk-data/bin/desk-notify "标题" "正文"
#   定时提醒：~/desk-data/bin/desk-remind "10:00" "内容"（到点自动推；list / rm <id>）
#   通道两类：webhook（企业微信/钉钉机器人 URL）· hermes（微信等 通知平台，目标如 weixin）

# 5) 给该成员挂上实例单元（deploy/systemd/desk-agent-*.service 里改名字/端口/目录后）
sudo bash scripts/install-services.sh
```

浏览器打开 `http://<机器局域网IP>:8080` 登录；管理员在工作台 设置 →「成员管理」里管理成员与模型通道。

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

## 凭据（Models 设置页可编辑）

- 虚拟钥匙存 `~/desk-test/uN/.credentials.yaml`（0600，YAML：`DEEPSEEK_API_KEY: sk-desk-…`）。
- **别再 export `DEEPSEEK_API_KEY`**——环境层只读且压过存储层，会把 Models 页的密钥输入框锁死（`writable:false`）。
- 播种/修复：`bash scripts/seed-credentials.sh [user …] [--force]`（默认只补缺；用户自定义值保留）。
- 团队共用真 key（默认上游）：成员管理 →「团队共用上游」查看打码值 / 更换（写 `~/.desk/keys.env` 后自动退出进程由 systemd 拉起，5~10 秒）；也可直接编辑该文件后 `kill -9` desk-server 的 MainPID。
- 排障一句：`curl -s -X POST http://127.0.0.1:33xx/api/credentials.describe -H 'content-type: application/json' -d '{"type":"client-request","rpcId":"x","method":"credentials.describe","payload":{"refs":["DEEPSEEK_API_KEY"]}}'` → 期望 `source:"file", writable:true`。改钥匙免重启（watch 热加载 + 每请求解析）。

## 界面主题（Aqua 玻璃主题，可选）

- 安装/重装：`bash scripts/install-transparent-ui.sh [user …]`（装 npm 包 `dsh-client-ui-aqua@1.3.1` 到各实例 web profile；幂等）。
- 开关：工作台 设置 → 插件 → 插件配置 →「玻璃主题」（每人浏览器本地开关，关掉即完整还原）。
- 版本对表：本插件 1.3.x 面向 DSH 0.1.0-rc.5；升级 dsh 后需换对应 fork（Zagadka-3906 / afrel1024 / du-u-uck）。


## 中国大陆网络构建（可选）

境内构建若遇 Docker Hub / npm / GitHub / Debian 源不稳定：

1. **Docker 镜像加速**（一次性）：Docker Desktop → Settings → Docker Engine 加入并 Apply：

```json
{ "registry-mirrors": ["https://docker.1ms.run"] }
```

2. **一键构建**（npm→npmmirror、apt→阿里云、dsh 源码→gh-proxy）：

```bash
bash deploy/docker/build-cn.sh
```

3. 若 gh-proxy.com 不通：编辑 `deploy/docker/build-cn.sh`，去掉 `--build-arg DSH_REPO=…` 行（即回退 GitHub 直连）。

## 方式三：云端部署（GHCR 镜像 + 服务器只拉不编）

适合小型云服务器（2 核 / 3.5G 也能跑）：**服务器永不编译**，镜像由 GitHub Actions 云端构建。

```
代码 push/打 tag ──▶ GitHub Actions（.github/workflows/build-image.yml）
                     构建并推送镜像 ghcr.io/bugbyc0922/dsh-anywork:{latest, vX.Y, sha}
                              │
服务器：docker compose pull && docker compose up -d   （只拉取运行，分钟级）
```

**服务器侧最小步骤**（以东京机为例）：

```bash
git clone https://github.com/bugbyc0922/DSH-ANYWORK.git /opt/dsh-anywork && cd /opt/dsh-anywork
cat > .env <<'EOF'
ANYWORK_HOST=你的域名:8443
ANYWORK_BIND=127.0.0.1          # 只监听本机，公网走 nginx 反代
ANYWORK_PORT=8080
ANYWORK_ADMIN_USER=admin001
ANYWORK_ADMIN_PASSWORD=<管理员密码>
ANYWORK_MEMBERS=<成员列表>
DEEPSEEK_API_KEY=<真 key>
ANYWORK_IMAGE_TAG=v1.4          # 钉版本；也可用 latest 或提交 sha
EOF
chmod 600 .env
docker compose pull && docker compose up -d
curl -s -o /dev/null -w '%{http_code}\n' http://127.0.0.1:8080/healthz   # 期望 200
```

**HTTPS（nginx + acme.sh，脚本化）**：`bash deploy/docker/setup-https.sh` —— 80 口 ACME 验证 + 301 跳转、签发证书、8443 反代（含 WebSocket 与长超时）。

**更新与回滚**：
- 更新：改代码 → 打 tag（如 `git tag -a v1.4 -m ... && git push origin v1.3`）→ CI 自动构建 → 服务器 `docker compose pull && docker compose up -d`。
- 回滚：`.env` 改 `ANYWORK_IMAGE_TAG=<旧版本或旧 sha>` → `docker compose pull && docker compose up -d`（约 2 分钟）。

**说明**：
- 镜像默认公开（`ghcr.io/bugbyc0922/dsh-anywork`），服务器无需登录即可拉取；仓库公开、镜像内不含任何密钥。
- 手动触发构建：Actions → build-image → Run workflow。
- 境内本机构建仍可用 `bash deploy/docker/build-cn.sh`（见本页末节加速通道）。
