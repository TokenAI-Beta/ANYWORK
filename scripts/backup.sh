#!/usr/bin/env bash
# 备份：账本快照（VACUUM INTO）+ 数据目录 + 密钥 → ~/desk-backups/desk-<时间>.tar.gz
# 保留最近 14 份（可用 desk-backup.timer 每日自动跑；恢复见 scripts/restore.sh）
set -euo pipefail
here="$(cd "$(dirname "$0")/.." && pwd)"
out_dir="$HOME/desk-backups"
keep=14
mkdir -p "$out_dir"

NODE_BIN="$HOME/opt/node-v24.19.0-linux-x64/bin/node"
[ -x "$NODE_BIN" ] || NODE_BIN="$(command -v node)"

ts=$(date +%Y%m%d-%H%M%S)
file="$out_dir/desk-$ts.tar.gz"
tmp=$(mktemp -d)
trap 'rm -rf "$tmp"' EXIT

# 1) 账本干净快照（运行中也安全）
if [ -f "$HOME/desk-data/desk.db" ]; then
  (cd "$here" && "$NODE_BIN" --input-type=module -e "import { openDb } from './src/db.ts'; openDb().exec(\"VACUUM INTO '$tmp/desk.db'\"); console.log('db snapshot ok')")
fi

# 2) 打包：快照 + 数据目录（排除活动中的 db 文件）+ 密钥目录
extra=()
for u in u1 u2 u3; do
  [ -f "$HOME/desk-test/$u/.credentials.yaml" ] && extra+=("desk-test/$u/.credentials.yaml")
done

tar czf "$file" \
  -C "$tmp" desk.db \
  -C "$HOME" --exclude='desk-data/desk.db*' desk-data .desk "${extra[@]}"

ls -lh "$file" | awk '{print "已备份:", $NF, "(" $5 ")"}'

# 3) 轮转：保留最近 $keep 份
ls -1t "$out_dir"/desk-*.tar.gz 2>/dev/null | tail -n +$((keep + 1)) | xargs -r rm --
echo "保留 $(ls -1 "$out_dir"/desk-*.tar.gz 2>/dev/null | wc -l) 份于 $out_dir"
