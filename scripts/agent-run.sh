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

# 虚拟钥匙：写入可写凭据存储 $DSH_HOME/.credentials.yaml（不再走启动环境变量——
# 环境层只读且永远压过存储层，会让 Models 设置页的 API Key 输入框被锁死 writable:false）
# dsh 0.1.5 起凭据文档为 version:1 + refs:/records: 结构（旧扁平格式引擎会自动迁移）；
# 补种必须同时兼容两种形态（迁移后键带缩进），否则会在文末追加重复的扁平行 → 启动失败。
doc="$home/.credentials.yaml"
key_value="$(tr -d '\n' < "$key_file")"
if [ ! -f "$doc" ]; then
  printf 'version: 1\nrefs:\n  DEEPSEEK_API_KEY: %s\n' "$key_value" > "$doc"
elif ! grep -qE '^[[:space:]]*DEEPSEEK_API_KEY:' "$doc"; then
  if grep -q '^refs:' "$doc"; then
    awk -v k="$key_value" '{ print } /^refs:[[:space:]]*$/ && !done { print "  DEEPSEEK_API_KEY: " k; done = 1 }' "$doc" > "$doc.tmp" && mv "$doc.tmp" "$doc"
  else
    printf 'DEEPSEEK_API_KEY: %s\n' "$key_value" >> "$doc"
  fi
fi
chmod 600 "$doc"

exec node "$dsh_entry" web --port "$port" --trusted-host "$authority"
