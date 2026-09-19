#!/usr/bin/env bash
# DSH-ANYWORK 统一管理入口（systemd 封装；以 root 运行：sudo bash scripts/desk.sh ...）
# 用法: scripts/desk.sh status|start|stop|restart [all|server|u1|u2|u3]
set -uo pipefail

action="${1:-status}"
target="${2:-all}"

all_units=(desk-server desk-agent-boss desk-agent-bob desk-agent-alice)

case "$target" in
  all) units=("${all_units[@]}") ;;
  server) units=(desk-server) ;;
  u1) units=(desk-agent-boss) ;;
  u2) units=(desk-agent-bob) ;;
  u3) units=(desk-agent-alice) ;;
  *) echo "未知目标: $target（all|server|u1|u2|u3）" >&2; exit 1 ;;
esac

if [ "$action" = "status" ]; then
  for u in "${all_units[@]}"; do
    printf "%-22s %s\n" "$u" "$(systemctl is-active "$u" 2>/dev/null || true)"
  done
  echo "—— 健康检查 ——"
  printf "portal  : %s\n" "$(curl -s -m 3 -o /dev/null -w '%{http_code}' http://127.0.0.1:8080/ 2>/dev/null || echo 000)"
  printf "gateway : %s\n" "$(curl -s -m 3 -o /dev/null -w '%{http_code}' http://127.0.0.1:8100/healthz 2>/dev/null || echo 000)"
  for p in 3301 3302 3303; do
    printf "agent %s: %s\n" "$p" "$(curl -s -m 3 -o /dev/null -w '%{http_code}' "http://127.0.0.1:$p/" 2>/dev/null || echo 000)"
  done
  exit 0
fi

case "$action" in
  start|stop|restart) ;;
  *) echo "未知动作: $action（status|start|stop|restart）" >&2; exit 1 ;;
esac

systemctl "$action" "${units[@]}"
echo "已 $action: ${units[*]}"
