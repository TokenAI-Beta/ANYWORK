#!/usr/bin/env bash
# 从零/增量初始化 DSH-ANYWORK（幂等自检 + 补齐缺失项）
# 用法: bash scripts/setup.sh [--with-services]   （--with-services 需 root）
set -uo pipefail
here="$(cd "$(dirname "$0")/.." && pwd)"
fail=0
step() { printf "%-34s" "$1"; }
ok() { echo "✓ ${1:-}"; }
bad() { echo "✗ ${1:-}"; fail=1; }
note() { echo "· $1"; }

NODE_BIN="$HOME/opt/node-v24.19.0-linux-x64/bin/node"
if [ ! -x "$NODE_BIN" ]; then NODE_BIN="$(command -v node || true)"; fi

step "[1/8] Node.js"
if [ -n "$NODE_BIN" ] && "$NODE_BIN" -v >/dev/null 2>&1; then ok "$("$NODE_BIN" -v)"; else bad "找不到 node（期望 ~/opt/node-v24.19.0-linux-x64/bin/node 或 PATH 中 node 24+）"; fi

step "[2/8] dsh 检出"
if [ -f "$HOME/deepseek-harness/apps/cli/lib/bin.js" ]; then ok "~/deepseek-harness"; else bad "缺少 ~/deepseek-harness（官方 dsh 检出）"; fi

step "[3/8] 真 key（~/.desk/keys.env）"
mkdir -p "$HOME/.desk"
if [ -f "$HOME/.desk/keys.env" ]; then
  chmod 600 "$HOME/.desk/keys.env"
  ok "存在（600）"
else
  echo 'DEEPSEEK_API_KEY=sk-在这里填真key' > "$HOME/.desk/keys.env"
  chmod 600 "$HOME/.desk/keys.env"
  bad "已生成模板——请填写真 key 后重跑"
fi

step "[4/8] 数据目录"
mkdir -p "$HOME/desk-data" "$HOME/desk-backups"
ok "~/desk-data · ~/desk-backups"

step "[5/8] 知识库 / 公司盘 / 技能库 / 预设 / Soul / 安全闸门 落位"
mkdir -p "$HOME/desk-data/kb" "$HOME/desk-data/drive" "$HOME/desk-data/skills" "$HOME/desk-data/presets"
cp -rn "$here/kb-template/." "$HOME/desk-data/kb/" 2>/dev/null || true
cp -rn "$here/drive-template/." "$HOME/desk-data/drive/" 2>/dev/null || true
cp -rn "$here/skills-template/." "$HOME/desk-data/skills/" 2>/dev/null || true
cp -rn "$here/presets-template/." "$HOME/desk-data/presets/" 2>/dev/null || true
bash "$here/scripts/apply-soul.sh" >/dev/null 2>&1 || true
bash "$here/scripts/install-hooks.sh" >/dev/null 2>&1 || true
mkdir -p "$HOME/desk-data/bin"
cp -f "$here/scripts/desk-notify" "$HOME/desk-data/bin/desk-notify"
cp -f "$here/scripts/desk-remind" "$HOME/desk-data/bin/desk-remind"
cp -f "$here/scripts/desk-kb" "$HOME/desk-data/bin/desk-kb"
chmod 755 "$HOME/desk-data/bin/desk-notify" "$HOME/desk-data/bin/desk-remind" "$HOME/desk-data/bin/desk-kb"
ok "kb / drive / skills / presets / soul / hooks / desk-notify / desk-remind / desk-kb（已存在的不覆盖）"

step "[6/8] 数据库迁移（建表 + 增量列）"
if (cd "$here" && "$NODE_BIN" --input-type=module -e "import { openDb } from './src/db.ts'; openDb();" >/dev/null 2>&1); then ok "ok"; else bad "迁移失败（先跑一次 node src/server.ts 看报错）"; fi

step "[7/8] 服务自检"
if curl -s -m 3 http://127.0.0.1:8100/healthz >/dev/null 2>&1; then ok "网关在线"; else note "网关未运行（安装 systemd 或手动 node src/server.ts）"; fi
if curl -s -m 3 -o /dev/null http://127.0.0.1:8080/ 2>/dev/null; then ok "门户在线"; else note "门户未运行"; fi

step "[8/8] systemd 单元"
if [ "${1:-}" = "--with-services" ]; then
  if [ "$(id -u)" = "0" ]; then bash "$here/scripts/install-services.sh"; else bad "需要 root：sudo bash scripts/setup.sh --with-services"; fi
else
  note "跳过（安装自启：sudo bash scripts/install-services.sh）"
fi

echo
if [ "$fail" = "0" ]; then echo "setup 自检通过 ✓"; else echo "setup 存在未通过项 ✗（处理后重跑）"; fi
exit "$fail"
