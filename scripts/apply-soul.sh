#!/usr/bin/env bash
# 把团队 Soul（+ 工作区 README）铺到各实例（幂等）
#   soul        → ~/desk-data/soul/SOUL.md；实例 <DSH_HOME>/AGENTS.md 软链过去
#   工作区 README → <实例>/workspace/AGENTS.md（模板同步；成员自定义请追加在末尾）
# 用法: bash scripts/apply-soul.sh
set -euo pipefail
here="$(cd "$(dirname "$0")/.." && pwd)"
share="$HOME/desk-data/soul"
mkdir -p "$share"

echo "== 1) 共享 soul =="
cp -f "$here/soul-template/SOUL.md" "$share/SOUL.md"
echo "   已更新: $share/SOUL.md"

echo "== 2) 各实例 =="
found=0
for home in "$HOME"/desk-test/u*; do
  [ -d "$home/profiles" ] || continue
  found=1
  if [ -e "$home/AGENTS.md" ] && [ ! -L "$home/AGENTS.md" ]; then
    mv "$home/AGENTS.md" "$home/AGENTS.md.bak-$(date +%s)"
    echo "   （原 AGENTS.md 已备份为 .bak）"
  fi
  ln -sfn "$share/SOUL.md" "$home/AGENTS.md"
  echo "   $home/AGENTS.md -> $share/SOUL.md"
  ws="$home/workspace"
  [ -d "$ws" ] || mkdir -p "$ws"
  cp -f "$here/soul-template/WORKSPACE-AGENTS.md" "$ws/AGENTS.md"
  echo "   $ws/AGENTS.md 已同步"
done
[ "$found" = "1" ] || echo "   （未发现实例：~/desk-test/u*，跳过）"
echo "完成（新会话即生效；无需重启实例）"
