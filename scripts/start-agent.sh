#!/usr/bin/env bash
# 启动某成员的工作台实例（P2-15 信任自动化；P3 会升级为 desk agent 管理）
# 用法: scripts/start-agent.sh <username> <port> [DSH_HOME]
#   - 虚拟钥匙从 ~/.desk/agents/<username>.key 读取
#   - 自动附带 --trusted-host <门户 authority>（默认 192.168.0.171:8080，可用 DESK_PORTAL_AUTHORITY 覆盖）
#   - 网关默认 http://127.0.0.1:8100（可用 DESK_GATEWAY_URL 覆盖）
set -euo pipefail

user="${1:?用法: scripts/start-agent.sh <username> <port> [DSH_HOME]}"
port="${2:?缺少端口}"
home="${3:-$HOME/desk-test/$user}"
authority="${DESK_PORTAL_AUTHORITY:-192.168.0.171:8080}"
gateway="${DESK_GATEWAY_URL:-http://127.0.0.1:8100}"
key_file="$HOME/.desk/agents/$user.key"
dsh_entry="$HOME/deepseek-harness/apps/cli/lib/bin.js"

[ -f "$key_file" ] || { echo "缺少虚拟钥匙文件: $key_file" >&2; exit 1; }
[ -f "$dsh_entry" ] || { echo "找不到 dsh: $dsh_entry" >&2; exit 1; }

export PATH="$HOME/opt/node-v24.19.0-linux-x64/bin:$HOME/bin:$PATH"
mkdir -p "$home"

DSH_HOME="$home" \
DEEPSEEK_BASE_URL="$gateway" \
DEEPSEEK_API_KEY="$(tr -d '\n' < "$key_file")" \
setsid node "$dsh_entry" web --port "$port" \
  --trusted-host "$authority" \
  </dev/null >> "$home/web.log" 2>&1 &

echo "已启动 $user → http://127.0.0.1:$port · 门户 authority=$authority · DSH_HOME=$home"
