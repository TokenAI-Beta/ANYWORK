#!/usr/bin/env bash
# 新成员实例自动配置脚本（运行中新增成员时由 entrypoint 监督器调用；幂等）
# 用法: member-provision.sh <user> <port> <home>
# 完成时刻由调用方 touch $HOME/.desk/run/<user>.prov 作为就绪标记
set -euo pipefail
u="${1:?用法: member-provision.sh <user> <port> <home>}"
p="$2"
h="$3"
home="${HOME:-/data}"
repo=/opt/anywork
dsh=/opt/deepseek-harness/apps/cli/lib/bin.js
log() { echo "[provision:$u] $*"; }

log "开始自动配置（端口 $p，家目录 $h）"

# 1) 实例目录 + 共享区软链（与 bootstrap 一致）
mkdir -p "$h"
chmod 700 "$h"
ln -sfn "$home/desk-data/skills" "$h/skills"
ln -sfn "$home/desk-data/presets" "$h/.agent-presets"

# 2) 实例路由：模型流量走团队网关（记进账本）
sf="$h/settings.yaml"
if ! grep -q "llm-deepseek" "$sf" 2>/dev/null; then
  { cat "$sf" 2>/dev/null || true; printf 'llm-deepseek:\n  baseURL: http://127.0.0.1:8100\n'; } > "$sf.tmp"
  mv "$sf.tmp" "$sf"
fi
# 新会话默认角色 = 团队助理
if ! grep -q "agent-presets" "$sf" 2>/dev/null; then
  { cat "$sf" 2>/dev/null || true; printf 'agent-presets:\n  default: team-assistant\n'; } > "$sf.tmp"
  mv "$sf.tmp" "$sf"
fi

# 3) 插件：desk-panel + dsh-wx-answerer + dsh-better-sidebar@0.28.0
#    + file:plugin/dsh-client-ui-aqua（dsh-client-ui-aqua@1.4.2，不要 npm 1.3.1）
#    + file:plugin/dsh-agents-md（dsh-agents-md@0.4.0）
#    + dsh-chat-import@0.26.2（不要 0.19.3）。
#    wx-answerer 是微信编号作答，随 main 保留。better-sidebar 钉 npm 包 0.28.0，不回到 0.19.1。
#    aqua、sidebar、agents-md、chat-import 都不在暂缓名单里。模板必须已经有 desk-panel，
#    且没有仍暂缓的插件。不是 0.26.2 的 chat-import 先卸再按钉重装。
#    恢复顺序：微信通知桥 → Bots / rooms
DEFERRED_PLUGINS=()
prof="$h/profiles"
tpl=""
for c in $(ls "$home/desk-test" 2>/dev/null || true); do
  [ "$c" = "$u" ] && continue
  cand="$home/desk-test/$c/profiles/web/package.json"
  [ -f "$cand" ] || continue
  grep -q "dsh-desk-panel" "$cand" || continue
  dirty=0
  for key in "${DEFERRED_PLUGINS[@]}"; do
    if grep -q "\"$key\"" "$cand"; then dirty=1; break; fi
  done
  [ "$dirty" = 0 ] || continue
  tpl="$home/desk-test/$c/profiles/web"
  break
done
if [ ! -f "$prof/web/package.json" ] && [ -n "$tpl" ]; then
  log "从既有成员复制插件配置：$tpl"
  mkdir -p "$prof"
  cp -r "$tpl" "$prof/web"
fi
if [ -f "$prof/web/package.json" ]; then
  for key in "${DEFERRED_PLUGINS[@]}"; do
    grep -q "\"$key\"" "$prof/web/package.json" || continue
    log "卸下 0.2.1-rc.3 暂不挂载的插件：$key"
    DSH_HOME="$h" node "$dsh" plugin --profile web remove "$key" >/dev/null 2>&1 \
      || log "插件卸载失败（可重启容器重试）：$key"
  done
fi
src_manifest="$repo/plugin/desk-panel/package.json"
dst_manifest="$prof/web/node_modules/dsh-desk-panel/package.json"
if [ -f "$src_manifest" ] && [ -f "$dst_manifest" ] && ! cmp -s "$src_manifest" "$dst_manifest"; then
  log "desk-panel 清单与仓库不一致，卸下后重装"
  DSH_HOME="$h" node "$dsh" plugin --profile web remove dsh-desk-panel >/dev/null 2>&1 || true
fi
if ! grep -q "dsh-desk-panel" "$prof/web/package.json" 2>/dev/null; then
  log "安装 desk-panel"
  DSH_HOME="$h" node "$dsh" plugin --profile web list >/dev/null 2>&1 || true
  DSH_HOME="$h" node "$dsh" plugin --profile web add "file:$repo/plugin/desk-panel" >/dev/null 2>&1 \
    || log "插件安装失败（可重启容器重试）：file:$repo/plugin/desk-panel"
fi
if ! grep -q "dsh-wx-answerer" "$prof/web/package.json" 2>/dev/null; then
  log "安装 dsh-wx-answerer"
  DSH_HOME="$h" node "$dsh" plugin --profile web list >/dev/null 2>&1 || true
  DSH_HOME="$h" node "$dsh" plugin --profile web add "link:$repo/plugin/dsh-wx-answerer" >/dev/null 2>&1 \
    || log "插件安装失败（可重启容器重试）：link:$repo/plugin/dsh-wx-answerer"
fi
# 已是 0.28.0 则跳过。别的版本先卸：add 对已装包名不会换版本。
sidebar_pkg="$prof/web/package.json"
sidebar_installed="$prof/web/node_modules/dsh-better-sidebar/package.json"
if [ -f "$sidebar_pkg" ] && grep -q '"dsh-better-sidebar"' "$sidebar_pkg"; then
  sidebar_pinned=0
  if grep -Eq '"dsh-better-sidebar"[[:space:]]*:[[:space:]]*"[^"]*0\.28\.0"' "$sidebar_pkg"; then
    sidebar_pinned=1
  fi
  if [ -f "$sidebar_installed" ] && grep -Eq '"version"[[:space:]]*:[[:space:]]*"0\.28\.0"' "$sidebar_installed"; then
    sidebar_pinned=1
  fi
  if [ "$sidebar_pinned" = 0 ]; then
    log "better-sidebar 不是 0.28.0，卸下后按钉重装"
    DSH_HOME="$h" node "$dsh" plugin --profile web remove dsh-better-sidebar >/dev/null 2>&1 \
      || log "插件卸载失败（可重启容器重试）：dsh-better-sidebar"
  fi
fi
if ! grep -q "dsh-better-sidebar" "$prof/web/package.json" 2>/dev/null; then
  log "安装 dsh-better-sidebar@0.28.0"
  DSH_HOME="$h" node "$dsh" plugin --profile web list >/dev/null 2>&1 || true
  DSH_HOME="$h" node "$dsh" plugin --profile web add "dsh-better-sidebar@0.28.0" >/dev/null 2>&1 \
    || log "插件安装失败（可重启容器重试）：dsh-better-sidebar@0.28.0"
fi
# 已是 1.4.2 则跳过。别的版本（含 1.4.1）先卸：add 对已装包名不会换版本。不要装 npm 1.3.1。
aqua_pkg="$prof/web/package.json"
aqua_installed="$prof/web/node_modules/dsh-client-ui-aqua/package.json"
if [ -f "$aqua_pkg" ] && grep -q '"dsh-client-ui-aqua"' "$aqua_pkg"; then
  aqua_pinned=0
  if grep -Eq '"dsh-client-ui-aqua"[[:space:]]*:[[:space:]]*"[^"]*1\.4\.2"' "$aqua_pkg"; then
    aqua_pinned=1
  fi
  if [ -f "$aqua_installed" ] && grep -Eq '"version"[[:space:]]*:[[:space:]]*"1\.4\.2"' "$aqua_installed"; then
    aqua_pinned=1
  fi
  if [ "$aqua_pinned" = 0 ]; then
    log "aqua 不是 1.4.2，卸下后按钉重装"
    DSH_HOME="$h" node "$dsh" plugin --profile web remove dsh-client-ui-aqua >/dev/null 2>&1 \
      || log "插件卸载失败（可重启容器重试）：dsh-client-ui-aqua"
  fi
fi
if ! grep -q "dsh-client-ui-aqua" "$prof/web/package.json" 2>/dev/null; then
  log "安装 file:$repo/plugin/dsh-client-ui-aqua（1.4.2）"
  DSH_HOME="$h" node "$dsh" plugin --profile web list >/dev/null 2>&1 || true
  DSH_HOME="$h" node "$dsh" plugin --profile web add "file:$repo/plugin/dsh-client-ui-aqua" >/dev/null 2>&1 \
    || log "插件安装失败（可重启容器重试）：file:$repo/plugin/dsh-client-ui-aqua"
fi
# 已是 0.4.0 且副本与仓库一致则跳过。旧安装（含 link:）先卸。不要用 link: 装回去。
agents_pkg="$prof/web/package.json"
agents_root="$prof/web/node_modules/dsh-agents-md"
agents_installed="$agents_root/package.json"
agents_src="$repo/plugin/dsh-agents-md"
if [ -f "$agents_pkg" ] && grep -q '"dsh-agents-md"' "$agents_pkg"; then
  agents_pinned=0
  if [ -f "$agents_installed" ] \
    && grep -Eq '"version"[[:space:]]*:[[:space:]]*"0\.4\.0"' "$agents_installed" \
    && cmp -s "$agents_src/package.json" "$agents_installed" \
    && cmp -s "$agents_src/index.js" "$agents_root/index.js" \
    && cmp -s "$agents_src/lib/catalog.js" "$agents_root/lib/catalog.js" \
    && cmp -s "$agents_src/lib/scan.js" "$agents_root/lib/scan.js" \
    && cmp -s "$agents_src/cordis.patch.yml" "$agents_root/cordis.patch.yml"; then
    agents_pinned=1
  fi
  if [ "$agents_pinned" = 0 ]; then
    log "dsh-agents-md 不是 file: 0.4.0 副本，卸下后按钉重装"
    DSH_HOME="$h" node "$dsh" plugin --profile web remove dsh-agents-md >/dev/null 2>&1 \
      || log "插件卸载失败（可重启容器重试）：dsh-agents-md"
  fi
fi
if ! grep -q "dsh-agents-md" "$prof/web/package.json" 2>/dev/null; then
  log "安装 file:$repo/plugin/dsh-agents-md（0.4.0）"
  DSH_HOME="$h" node "$dsh" plugin --profile web list >/dev/null 2>&1 || true
  DSH_HOME="$h" node "$dsh" plugin --profile web add "file:$repo/plugin/dsh-agents-md" >/dev/null 2>&1 \
    || log "插件安装失败（可重启容器重试）：file:$repo/plugin/dsh-agents-md"
fi
# 已是 0.26.2 则跳过。别的版本（含 0.19.3）先卸：add 对已装包名不会换版本。不要装 0.19.3。
chat_pkg="$prof/web/package.json"
chat_installed="$prof/web/node_modules/dsh-chat-import/package.json"
if [ -f "$chat_pkg" ] && grep -q '"dsh-chat-import"' "$chat_pkg"; then
  chat_pinned=0
  if grep -Eq '"dsh-chat-import"[[:space:]]*:[[:space:]]*"[^"]*0\.26\.2"' "$chat_pkg"; then
    chat_pinned=1
  fi
  if [ -f "$chat_installed" ] && grep -Eq '"version"[[:space:]]*:[[:space:]]*"0\.26\.2"' "$chat_installed"; then
    chat_pinned=1
  fi
  if [ "$chat_pinned" = 0 ]; then
    log "chat-import 不是 0.26.2，卸下后按钉重装"
    DSH_HOME="$h" node "$dsh" plugin --profile web remove dsh-chat-import >/dev/null 2>&1 \
      || log "插件卸载失败（可重启容器重试）：dsh-chat-import"
  fi
fi
if ! grep -q "dsh-chat-import" "$prof/web/package.json" 2>/dev/null; then
  log "安装 dsh-chat-import@0.26.2"
  DSH_HOME="$h" node "$dsh" plugin --profile web list >/dev/null 2>&1 || true
  DSH_HOME="$h" node "$dsh" plugin --profile web add "dsh-chat-import@0.26.2" >/dev/null 2>&1 \
    || log "插件安装失败（可重启容器重试）：dsh-chat-import@0.26.2"
fi

# desk-panel 前端副本（与 bootstrap 5c 相同：file: 不会因清单以外的改动自动更新）
DESK_SRC="$repo/plugin/desk-panel/lib/client.js"
DESK_DST="$prof/web/node_modules/dsh-desk-panel/lib/client.js"
if [ -f "$DESK_SRC" ] && [ -f "$DESK_DST" ] && ! cmp -s "$DESK_SRC" "$DESK_DST"; then
  cat "$DESK_SRC" > "$DESK_DST" && log "刷新 desk-panel 副本"
fi

log "配置完成"
