#!/usr/bin/env bash
# DSH-ANYWORK 容器入口：环境检查 → 幂等 bootstrap → 轻量监督（server + 各成员实例）
# 由镜像 ENTRYPOINT 调用（tini 作 PID1 负责收尸与信号转发）
set -euo pipefail
log() { echo "[anywork] $*"; }

: "${ANYWORK_HOST:?请设置 ANYWORK_HOST（你访问工作台用的地址，如 192.168.1.50:8080）。本服务必须用 Docker Compose 启动（仓库文件夹里双击 deploy.bat），不要在 Docker Desktop 里直接运行镜像}"
: "${DEEPSEEK_API_KEY:?请设置 DEEPSEEK_API_KEY（DeepSeek 真 key，只留在服务器上）}"

export HOME="${HOME:-/data}"
mkdir -p "$HOME"

# 软链：镜像里的代码挂进 HOME（仓库脚本都按 ~/deepseek-harness、~/dsh-anywork 找路径）
ln -sfn /opt/deepseek-harness "$HOME/deepseek-harness"
ln -sfn /opt/anywork "$HOME/dsh-anywork"

# 管理员密码：未配置则生成一次、持久化、只打印这一次
if [ -z "${ANYWORK_ADMIN_PASSWORD:-}" ]; then
  if [ -s "$HOME/.desk/admin-password" ]; then
    ANYWORK_ADMIN_PASSWORD="$(cat "$HOME/.desk/admin-password")"
    log "沿用已保存的管理员密码（见 $HOME/.desk/admin-password）"
  else
    ANYWORK_ADMIN_PASSWORD="$(head -c 32 /dev/urandom | base64 | tr -dc 'A-Za-z0-9' | head -c 14)"
    mkdir -p "$HOME/.desk"
    printf '%s' "$ANYWORK_ADMIN_PASSWORD" > "$HOME/.desk/admin-password"
    chmod 600 "$HOME/.desk/admin-password"
    log "=========================================================="
    log " 已生成管理员密码（只打印这一次，请立即记录）：$ANYWORK_ADMIN_PASSWORD"
    log "=========================================================="
  fi
fi
export ANYWORK_ADMIN_PASSWORD

# 幂等初始化（建号/钥匙/端口/共享区/插件）
bash /opt/anywork/deploy/docker/bootstrap.sh

# 抹掉容器层继承的敏感环境：成员实例绝不能拿到真 key ——
# 否则 dsh 的环境层会拿它直连上游（绕过网关、不进账本，且锁死 Models 页）。
# 服务进程不受影响：desk-server 从 ~/.desk/keys.env 读真 key。
unset DEEPSEEK_API_KEY ANYWORK_ADMIN_PASSWORD

# 实例共用环境
export DESK_PORTAL_AUTHORITY="$ANYWORK_HOST"
export DESK_GATEWAY_URL="http://127.0.0.1:8100"
export DESK_TRUSTED_HOSTS="${ANYWORK_TRUSTED_HOSTS:-}"

PIDS=()
stop() {
  log "收到停止信号，退出中…"
  for p in "${PIDS[@]}"; do kill "$p" 2>/dev/null || true; done
  exit 0
}
trap stop TERM INT

# desk-server（门户 :8080 + 网关 :8100）
(
  cd /opt/anywork
  while :; do
    node src/server.ts || true
    log "desk-server 退出，3 秒后自动重启"
    sleep 3
  done
) & PIDS+=("$!")

# 成员实例动态监督（2026-09-26）：每 15 秒对账一次——
#   新成员入列后先自动配置（member-provision.sh），配置完成即拉起实例；
#   已在跑的成员保持“5 秒自拉”语义（会话删除等杀进程后会自愈）。
declare -A SUP=()
supervise() {
  while :; do
    # 期望清单：从数据库重算（新成员建号即入列）
    if node --input-type=module -e "
import { openDb } from '/opt/anywork/src/db.ts'
const db = openDb()
for (const r of db.prepare('SELECT username, agent_port FROM users WHERE agent_port IS NOT NULL ORDER BY id').all()) {
  console.log(r.username + '\t' + r.agent_port + '\t' + process.env.HOME + '/desk-test/' + r.username)
}
" > "$HOME/.desk/run/instances.tsv.new" 2>/dev/null; then
      mv "$HOME/.desk/run/instances.tsv.new" "$HOME/.desk/run/instances.tsv"
    fi
    local m_user m_port m_home
    while IFS=$'\t' read -r m_user m_port m_home; do
      [ -n "${m_user:-}" ] || continue
      if [ ! -f "$HOME/.desk/run/$m_user.prov" ]; then
        # 未配置：异步配置（避免阻塞对账循环）；完成后置 .prov 标记
        if [ ! -f "$HOME/.desk/run/$m_user.provisioning" ]; then
          touch "$HOME/.desk/run/$m_user.provisioning"
          log "检测到新成员 $m_user，开始自动配置…"
          (
            bash /opt/anywork/deploy/docker/member-provision.sh "$m_user" "$m_port" "$m_home" >> "$HOME/.desk/run/$m_user.provision.log" 2>&1 \
              && touch "$HOME/.desk/run/$m_user.prov" && log "成员 $m_user 配置完成"
            rm -f "$HOME/.desk/run/$m_user.provisioning"
          ) &
        fi
        continue
      fi
      if [ -z "${SUP[$m_user]:-}" ]; then
        touch "$HOME/.desk/run/$m_user.keep"
        (
          while :; do
            [ -f "$HOME/.desk/run/$m_user.keep" ] || break
            bash /opt/anywork/scripts/agent-run.sh "$m_user" "$m_port" "$m_home" &
            child=$!
            echo "$child" > "$HOME/.desk/run/$m_user.pid"
            wait "$child" || true
            [ -f "$HOME/.desk/run/$m_user.keep" ] || break
            log "实例 $m_user 退出，5 秒后自动重启"
            sleep 5
          done
        ) & PIDS+=("$!")
        SUP[$m_user]=1
        log "实例 $m_user（端口 $m_port）已拉起"
      fi
    done < "$HOME/.desk/run/instances.tsv"
    # 成员回收对账：有运行痕迹但不在清单里的成员——账户已删 → 连工作台数据一并回收；账户在（仅撤端口）→ 只停实例
    _cands="$(cd "$HOME/.desk/run" && ls *.keep *.pid *.prov 2>/dev/null | sed 's/\.[A-Za-z]*$//' | sort -u)"
    for m_rec in $_cands; do
      awk -F '\t' -v u="$m_rec" '$1 == u { f = 1 } END { exit(f ? 0 : 1) }' "$HOME/.desk/run/instances.tsv" && continue
      rm -f "$HOME/.desk/run/$m_rec.keep"
      # 杀实例：优先按 pid 文件精确杀（agent-run 用 exec 变成 node 进程，pkill 模式可能失效）；
      # /proc/<pid>/environ 的 DSH_HOME 校验目标身份，避免误杀复用的 pid
      _p="$(cat "$HOME/.desk/run/$m_rec.pid" 2>/dev/null || true)"
      if [ -n "${_p:-}" ] && [ -d "/proc/$_p" ] && tr '\0' '\n' < "/proc/$_p/environ" 2>/dev/null | grep -q "^DSH_HOME=$HOME/desk-test/$m_rec$"; then
        kill -9 "$_p" 2>/dev/null || true
      else
        pkill -f "agent-run.sh $m_rec " 2>/dev/null || true
      fi
      if node --input-type=module -e "
import { openDb } from '/opt/anywork/src/db.ts'
const db = openDb()
process.exit(db.prepare('SELECT 1 FROM users WHERE username = ?').get('$m_rec') ? 0 : 1)
" 2>/dev/null; then
        unset "SUP[$m_rec]"
        log "成员 $m_rec 实例已停（账户保留、端口撤下）"
      else
        rm -rf "$HOME/desk-test/$m_rec"
        rm -f "$HOME/.desk/agents/$m_rec.key" "$HOME/.desk/run/$m_rec.pid" "$HOME/.desk/run/$m_rec.prov" "$HOME/.desk/run/$m_rec.provisioning" "$HOME/.desk/run/$m_rec.provision.log"
        unset "SUP[$m_rec]"
        log "成员 $m_rec 已删除：工作台实例已停止、数据已回收"
      fi
    done
    sleep 15
  done
}
# 启动时同步一次「通道模型 → 各实例 settings.yaml」（在实例拉起前执行，确保模型选择器清单最新）
(cd /opt/anywork && node src/cli.ts sync-models) >> "$HOME/.desk/run/models-sync.log" 2>&1 || true

supervise &

log "全部就绪：请浏览器打开 http://$ANYWORK_HOST/（容器内端口 8080）"
wait
