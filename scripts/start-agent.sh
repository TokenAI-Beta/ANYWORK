#!/usr/bin/env bash
# 手工启动某成员实例（后台常驻；正式部署用 systemd：scripts/install-services.sh）
# 用法: scripts/start-agent.sh <username> <port> [DSH_HOME]
#   - 虚拟钥匙从 ~/.desk/agents/<username>.key 读取
#   - 自动附带 --trusted-host <门户 authority>（默认 192.168.0.171:8080，可用 DESK_PORTAL_AUTHORITY 覆盖）
#   - 网关默认 http://127.0.0.1:8100（可用 DESK_GATEWAY_URL 覆盖）
set -euo pipefail

user="${1:?用法: scripts/start-agent.sh <username> <port> [DSH_HOME]}"
port="${2:?缺少端口}"
home="${3:-$HOME/desk-test/$user}"
here="$(cd "$(dirname "$0")" && pwd)"

mkdir -p "$home"
setsid bash "$here/agent-run.sh" "$user" "$port" "$home" </dev/null >> "$home/web.log" 2>&1 &

echo "已启动 $user → http://127.0.0.1:$port · DSH_HOME=$home（日志: $home/web.log）"
