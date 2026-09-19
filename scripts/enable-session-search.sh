#!/usr/bin/env bash
# 为某个实例开启跨会话全文检索（opt-in；幂等可重复跑）
# 用法: bash scripts/enable-session-search.sh <DSH_HOME 绝对路径>
#   做两件事：1) 把 tool-session-query 以 link: 依赖装进 profile（包在 dsh 检出内，靠工作区 node_modules 解析）
#             2) 在 profile 补丁里开索引（openAt: first-search + 落盘 path）并挂上检索工具
set -euo pipefail
home="${1:?用法: bash scripts/enable-session-search.sh <DSH_HOME 绝对路径>}"
pkg=/home/yangc/deepseek-harness/packages/session-query/tool-session-query
cli=/home/yangc/deepseek-harness/apps/cli/lib/bin.js
export PATH="$HOME/opt/node-v24.19.0-linux-x64/bin:$HOME/bin:$PATH"

p="$home/profiles/web/cordis.patch.yml"
[ -d "$home/profiles/web" ] || { echo "找不到 $home/profiles/web（实例未初始化？）"; exit 1; }

echo "== [$home] 0/2 处理空数组占位符 =="
if grep -q "^\[\]$" "$p"; then
  awk "!/^\[\]\$/" "$p" > "$p.tmp" && mv "$p.tmp" "$p"
  echo "已移除占位符 []"
else
  echo "无需处理"
fi

echo "== [$home] 1/2 装检索工具依赖（link:，幂等）=="
DSH_HOME="$home" node "$cli" plugin --profile web add "link:$pkg" 2>&1 | tail -3

echo "== [$home] 2/2 写 profile 补丁（幂等）=="
grep -q "^\[\]$" "$p" && { awk "!/^\[\]\$/" "$p" > "$p.tmp" && mv "$p.tmp" "$p"; }
if grep -q "openAt: first-search" "$p"; then
  echo "补丁已存在，跳过"
else
  printf "\n# DSH-ANYWORK：跨会话全文检索（索引随首次搜索构建，落盘）\n- id: session-query-sqlite\n  config:\n    path: %s/search.db\n    openAt: first-search\n\n# 给 agent 的会话检索工具（opt-in）\n- insert:\n    - id: tool-session-query\n      name: \"@deepseek-ai/dsh-tool-session-query\"\n" "$home" >> "$p"
  echo "已写入 $p"
fi

echo "完成。重启该实例生效：sudo systemctl restart desk-agent-<name>"
