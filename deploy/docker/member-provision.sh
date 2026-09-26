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

# 1) 实例目录 + 共享区软链（与 bootstrap 同款）
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

# 3) 插件：优先从既有成员复制 profile（秒级、免网络）；无模板才在线安装
prof="$h/profiles"
tpl=""
for c in $(ls "$home/desk-test" 2>/dev/null || true); do
  [ "$c" = "$u" ] && continue
  cand="$home/desk-test/$c/profiles/web/package.json"
  if [ -f "$cand" ] && grep -q "dsh-better-sidebar" "$cand"; then
    tpl="$home/desk-test/$c/profiles/web"
    break
  fi
done
if [ ! -f "$prof/web/package.json" ] && [ -n "$tpl" ]; then
  log "从既有成员复制插件配置：$tpl"
  mkdir -p "$prof"
  cp -r "$tpl" "$prof/web"
fi
if [ ! -f "$prof/web/package.json" ]; then
  log "无可复制模板，改为在线安装插件（需要外网）"
  DSH_HOME="$h" node "$dsh" plugin --profile web list >/dev/null 2>&1 || true
  for spec in "file:$repo/plugin/desk-panel" "https://github.com/Zagadka-3906/DSH-Transparent-UI-Plugin-dsh015.git" "dsh-chat-import" "dsh-better-sidebar@latest"; do
    DSH_HOME="$h" node "$dsh" plugin --profile web add "$spec" >/dev/null 2>&1 || log "插件安装失败（可重启容器重试）：$spec"
  done
fi

# 4) aqua key 补丁（幂等；复制来的通常已打）
python3 - <<'AQUA_PATCH' || log "警告：aqua key 补丁未执行"
import glob, os
old = '\t\t\t\tname: "settings.plugin.item",\n\t\t\t\tid: "aqua",\n\t\t\t\torder: 5,'
new = '\t\t\t\tname: "settings.plugin.item",\n\t\t\t\tid: "aqua",\n\t\t\t\tkey: "ui-aqua",\n\t\t\t\torder: 5,'
for f in glob.glob(os.path.join(os.environ.get("HOME", "/data"), "desk-test", "*", "profiles/web/node_modules/dsh-client-ui-aqua/lib/client.js")):
    s = open(f, encoding="utf-8").read()
    if 'key: "ui-aqua"' in s:
        continue
    if s.count(old) == 1:
        open(f, "w", encoding="utf-8").write(s.replace(old, new))
        print("[provision] aqua key 补丁:", f)
AQUA_PATCH

log "配置完成"
