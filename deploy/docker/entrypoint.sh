#!/usr/bin/env bash
# DSH-ANYWORK 容器入口：环境检查 → 幂等 bootstrap → 轻量监督（server + 各成员实例）
# 由镜像 ENTRYPOINT 调用（tini 作 PID1 负责收尸与信号转发）
set -euo pipefail
log() { echo "[anywork] $*"; }

: "${ANYWORK_HOST:?请设置 ANYWORK_HOST（你访问工作台用的地址，如 192.168.1.50:8080）}"
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

# 成员实例循环（清单由 bootstrap 生成：成员<TAB>端口<TAB>家目录）
# 实例被会话删除等功能杀掉后，这里 5 秒自拉（与 systemd RestartSec=5 同语义）
INST="$HOME/.desk/run/instances.tsv"
if [ -s "$INST" ]; then
  while IFS=$'\t' read -r m_user m_port m_home; do
    [ -n "${m_user:-}" ] || continue
    (
      while :; do
        bash /opt/anywork/scripts/agent-run.sh "$m_user" "$m_port" "$m_home" &
        child=$!
        echo "$child" > "$HOME/.desk/run/$m_user.pid"
        wait "$child" || true
        log "实例 $m_user 退出，5 秒后自动重启"
        sleep 5
      done
    ) & PIDS+=("$!")
  done < "$INST"
fi

log "全部就绪：请浏览器打开 http://$ANYWORK_HOST/（容器内端口 8080）"
wait
