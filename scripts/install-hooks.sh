#!/usr/bin/env bash
# 给各实例装「团队安全闸门」（hooks-claude-code 桥 + 危险命令策略）——幂等可重复跑
# 用法: bash scripts/install-hooks.sh
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SHARED="$HOME/desk-data/hooks"
PKG=/home/yangc/deepseek-harness/packages/hooks/hooks-claude-code
CLI=/home/yangc/deepseek-harness/apps/cli/lib/bin.js
export PATH="$HOME/opt/node-v24.19.0-linux-x64/bin:$HOME/bin:$PATH"

echo "== 1/3 部署钩子文件到共享区 =="
mkdir -p "$SHARED"
cp "$ROOT/hooks-template/hooks.json" "$ROOT/hooks-template/danger-gate.mjs" "$ROOT/hooks-template/rules.json" "$SHARED/"
chmod 644 "$SHARED/hooks.json" "$SHARED/danger-gate.mjs" "$SHARED/rules.json"
echo "  $SHARED/{hooks.json,danger-gate.mjs,rules.json}"

for home in "$HOME"/desk-test/u1 "$HOME"/desk-test/u2 "$HOME"/desk-test/u3; do
  [ -d "$home" ] || continue
  echo
  echo "== [$home] 2/3 装桥依赖（link:）=="
  p="$home/profiles/web/cordis.patch.yml"
  [ -f "$p" ] || { echo "  跳过（无 profile 补丁文件）"; continue; }
  if grep -q "^\[\]$" "$p"; then
    awk '!/^\[\]$/' "$p" > "$p.tmp" && mv "$p.tmp" "$p"
    echo "  已移除占位符 []"
  fi
  DSH_HOME="$home" node "$CLI" plugin --profile web add "link:$PKG" 2>&1 | tail -2

  echo "== [$home] 3/3 写 profile 补丁 =="
  if grep -q "hooks-claude-code" "$p"; then
    echo "  补丁已存在，跳过"
  else
    printf '\n# DSH-ANYWORK：团队安全闸门（危险命令 PreToolUse 拦截；规则在共享区 rules.json）\n- insert:\n    - id: hooks-claude-code\n      name: "@deepseek-ai/dsh-hooks-claude-code"\n      config:\n        configPath: %s/hooks.json\n' "$SHARED" >> "$p"
    echo "  已写入 $p"
  fi
done

echo
echo "完成。重启实例生效（kill -9 MainPID 让 systemd 自拉，或 sudo systemctl restart）。"
