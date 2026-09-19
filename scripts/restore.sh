#!/usr/bin/env bash
# 恢复（危险操作，建议 root 运行）：scripts/restore.sh <备份.tar.gz> [--force]
# 流程：停服务 → 现状先备份 → 解包还原 ~/desk-data 与 ~/.desk → 起服务
set -euo pipefail
arch="${1:?用法: scripts/restore.sh <备份.tar.gz> [--force]}"
[ -f "$arch" ] || { echo "找不到备份文件: $arch"; exit 1; }

if [ "${2:-}" != "--force" ]; then
  echo "将停止服务，并用 $arch 覆盖 ~/desk-data 与 ~/.desk（含数据库与密钥）。"
  read -r -p "确认请输入 yes: " a
  [ "$a" = "yes" ] || { echo "已取消"; exit 1; }
fi

systemctl stop desk-server desk-agent-boss desk-agent-bob desk-agent-alice 2>/dev/null || true

ts=$(date +%Y%m%d-%H%M%S)
mkdir -p "$HOME/desk-backups"
tar czf "$HOME/desk-backups/pre-restore-$ts.tar.gz" -C "$HOME" desk-data .desk 2>/dev/null || true
echo "现状已先备份: ~/desk-backups/pre-restore-$ts.tar.gz"

tar xzf "$arch" -C "$HOME"
# 账本快照（归档内 desk.db 位于根）还原到数据目录
if [ -f "$HOME/desk.db" ]; then
  rm -f "$HOME/desk-data/desk.db-wal" "$HOME/desk-data/desk.db-shm"
  mv "$HOME/desk.db" "$HOME/desk-data/desk.db"
fi
chmod 600 "$HOME/.desk/keys.env" 2>/dev/null || true
chmod 700 "$HOME/.desk/agents" 2>/dev/null || true
chmod 600 "$HOME/.desk/agents/"*.key 2>/dev/null || true

if systemctl start desk-server desk-agent-boss desk-agent-bob desk-agent-alice 2>/dev/null; then
  echo "服务已重启（systemd）"
else
  echo "（systemd 不可用，请手动启动：node src/server.ts 与 scripts/start-agent.sh）"
fi
echo "恢复完成。"
