#!/usr/bin/env bash
# 看日志：scripts/logs.sh [server|u1|u2|u3] [行数]
set -uo pipefail
target="${1:-server}"
n="${2:-60}"
case "$target" in
  server) unit=desk-server ;;
  u1) unit=desk-agent-boss ;;
  u2) unit=desk-agent-bob ;;
  u3) unit=desk-agent-alice ;;
  *) unit="$target" ;;
esac
journalctl -u "$unit" -n "$n" --no-pager 2>/dev/null || echo "（读不到 $unit 日志；单元可能未安装，或需要 sudo）"
