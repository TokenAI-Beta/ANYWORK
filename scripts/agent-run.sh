#!/usr/bin/env bash
# 前台运行某成员实例（供 systemd 使用；手工启动请用 start-agent.sh）
# 用法: scripts/agent-run.sh <username> <port> [DSH_HOME]
set -euo pipefail

user="${1:?用法: scripts/agent-run.sh <username> <port> [DSH_HOME]}"
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
export DSH_HOME="$home"
export DEEPSEEK_BASE_URL="$gateway"
export DEEPSEEK_API_KEY="$(tr -d '\n' < "$key_file")"

exec node "$dsh_entry" web --port "$port" --trusted-host "$authority"
