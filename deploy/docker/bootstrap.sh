#!/usr/bin/env bash
# DSH-ANYWORK 容器初始化（幂等；每次启动都会跑一遍，已完成项自动跳过）
set -euo pipefail
log() { echo "[bootstrap] $*"; }

repo=/opt/anywork
dsh=/opt/deepseek-harness/apps/cli/lib/bin.js
home="${HOME:-/data}"
admin="${ANYWORK_ADMIN_USER:-boss}"

mkdir -p "$home/.desk/agents" "$home/.desk/run" "$home/desk-data" "$home/desk-backups"
chmod 700 "$home/.desk" 2>/dev/null || true

# ── 1) 共享区目录 + 模板 + 脚本 ──
for d in kb drive skills presets hooks bin agents; do mkdir -p "$home/desk-data/$d"; done
cp -rn "$repo/kb-template/." "$home/desk-data/kb/" 2>/dev/null || true
cp -rn "$repo/drive-template/." "$home/desk-data/drive/" 2>/dev/null || true
cp -rn "$repo/skills-template/." "$home/desk-data/skills/" 2>/dev/null || true
cp -rn "$repo/presets-template/." "$home/desk-data/presets/" 2>/dev/null || true
cp -rn "$repo/agents-template/." "$home/desk-data/agents/" 2>/dev/null || true
for s in desk-notify desk-remind desk-kb; do
  if [ -f "$repo/scripts/$s" ]; then install -m 755 "$repo/scripts/$s" "$home/desk-data/bin/$s"; fi
done

# ── 2) 真 key（以环境变量为准） ──
umask 077
printf 'DEEPSEEK_API_KEY=%s\n' "$DEEPSEEK_API_KEY" > "$home/.desk/keys.env"

# ── 3) 成员与实例端口 ──
cd "$repo"
cli() { node src/cli.ts "$@"; }

add_member() { # $1=用户名 [$2=--admin]；成功=0 已存在=1
  local u="$1" admin_flag="${2:-}" out key
  if out="$(cli user add "$u" $admin_flag 2>&1)"; then
    key="$(printf '%s\n' "$out" | grep -oE 'sk-desk-[A-Za-z0-9_-]+' | head -1)"
    if [ -n "$key" ]; then
      printf '%s' "$key" > "$home/.desk/agents/$u.key"
      chmod 600 "$home/.desk/agents/$u.key"
      log "已创建成员 $u（虚拟钥匙已存档）"
    else
      log "警告：$u 已创建，但未抓到虚拟钥匙（CLI 输出格式可能变化），请检查"
    fi
    return 0
  fi
  return 1
}

ensure_port() { # 回显该成员实例端口（无则分配最小空闲端口并落库）
  local u="$1"
  node --input-type=module -e "
import { openDb } from '${repo}/src/db.ts'
const db = openDb()
const r = db.prepare('SELECT agent_port FROM users WHERE username = ?').get('${u}')
if (r && r.agent_port) { console.log(r.agent_port); process.exit(0) }
const used = new Set(db.prepare('SELECT agent_port FROM users WHERE agent_port IS NOT NULL').all().map((x) => x.agent_port))
let port = 3301
while (used.has(port)) port++
db.prepare('UPDATE users SET agent_port = ? WHERE username = ?').run(port, '${u}')
console.log(port)
"
}

if add_member "$admin" --admin; then :; else log "管理员 $admin 已存在"; fi
cli user passwd "$admin" "$ANYWORK_ADMIN_PASSWORD" >/dev/null
ensure_port "$admin" >/dev/null

IFS=',' read -r -a _members <<< "${ANYWORK_MEMBERS:-}"
for m in "${_members[@]}"; do
  m="$(echo "$m" | tr -d ' ')"
  [ -n "$m" ] || continue
  [ "$m" = "$admin" ] && continue
  if add_member "$m"; then
    pw="$(head -c 32 /dev/urandom | base64 | tr -dc 'A-Za-z0-9' | head -c 12)"
    cli user passwd "$m" "$pw" >/dev/null
    printf '%s: %s\n' "$m" "$pw" >> "$home/.desk/accounts.txt"
    chmod 600 "$home/.desk/accounts.txt"
    log "成员 $m 已创建，初始密码写入 $home/.desk/accounts.txt（转告本人后建议删除该文件）"
  fi
  ensure_port "$m" >/dev/null
done

# ── 4) 实例家目录清单（监督循环用） ──
node --input-type=module -e "
import { openDb } from '${repo}/src/db.ts'
const db = openDb()
for (const r of db.prepare('SELECT username, agent_port FROM users WHERE agent_port IS NOT NULL ORDER BY id').all()) {
  console.log(r.username + '\t' + r.agent_port + '\t' + process.env.HOME + '/desk-test/' + r.username)
}
" > "$home/.desk/run/instances.tsv"
while IFS=$'\t' read -r u p h; do
  if [ -n "${u:-}" ]; then
    mkdir -p "$h"; chmod 700 "$h"
    ln -sfn "$home/desk-data/skills" "$h/skills"
    ln -sfn "$home/desk-data/presets" "$h/.agent-presets"
    # 实例路由：模型流量走团队网关（记进账本；真 key 只留在服务进程，不下发）
    sf="$h/settings.yaml"
    if ! grep -q "llm-deepseek" "$sf" 2>/dev/null; then
      { cat "$sf" 2>/dev/null || true; printf 'llm-deepseek:\n  baseURL: http://127.0.0.1:8100\n'; } > "$sf.tmp"
      mv "$sf.tmp" "$sf"
    fi
    # 新会话默认角色 = 团队助理（成员不选也落在团队规范上）
    if ! grep -q "agent-presets" "$sf" 2>/dev/null; then
      { cat "$sf" 2>/dev/null || true; printf 'agent-presets:\n  default: team-assistant\n'; } > "$sf.tmp"
      mv "$sf.tmp" "$sf"
    fi
  fi
done < "$home/.desk/run/instances.tsv"

# ── 5) 各实例插件 ──
# 本地 Docker 引擎是 dsh-v0.2.1-rc.3。安装 desk-panel、dsh-wx-answerer，
# 钉死的 npm 包 dsh-better-sidebar@0.28.0（不要 0.19.1），
# 以及仓内 file:plugin/dsh-client-ui-aqua（dsh-client-ui-aqua@1.4.2，不要 npm 1.3.1）。
# dsh-wx-answerer 是 main 上的微信编号作答（PR #1），继续安装，不在暂缓名单里。
# better-sidebar 与 aqua 同样不在暂缓名单里：整容器重启要把它们留在卷上。
# 下面两个仍不装：agents-md 在宿主侧会炸，chat-import 的 peer 盖不住 rc.3。
# 已有卷里若还在，启动时卸掉。
# 恢复顺序见 docs/0.2-plugin-api-breakpoints.md：
#   微信通知桥 → Bots / rooms → agents-md / chat-import
DEFERRED_PLUGINS=(dsh-agents-md dsh-chat-import)

install_plugin() { # $1=成员 $2=安装 spec $3=检测键（依赖名） $4=可选完整性探针（文件存在才算就绪）
  local u="$1" spec="$2" key="$3" probe="${4:-}"
  local dsh_home="$home/desk-test/$u"
  local profile="$dsh_home/profiles/web"
  grep -q "\"$key\"" "$profile/package.json" 2>/dev/null && { [ -z "$probe" ] || [ -e "$probe" ]; } && return 0
  log "安装插件（$u）：$spec"
  # 预热：确保 profile 目录存在（plugin 命令会据此初始化）
  # --profile 必须在子命令之前（0.2.1 起写在后面会失败）
  DSH_HOME="$dsh_home" node "$dsh" plugin --profile web list >/dev/null 2>&1 || true
  DSH_HOME="$dsh_home" node "$dsh" plugin --profile web add "$spec" >/dev/null 2>&1 || true
  # 原生模块没编出来时：approve 后原地重装。当前安装的 desk-panel、wx-answerer、
  # better-sidebar@0.28.0 都不传探针（0.21+ 已不依赖 node-pty；旧 pty.node 探针会反复重装）。
  if [ -n "$probe" ] && [ ! -e "$probe" ] && [ -f "$profile/package.json" ]; then
    (cd "$profile" && pnpm approve-builds --all >/dev/null 2>&1) || true
    (cd "$profile" && pnpm install >/dev/null 2>&1) || true
  fi
  grep -q "\"$key\"" "$profile/package.json" 2>/dev/null && { [ -z "$probe" ] || [ -e "$probe" ]; } && return 0
  log "警告：插件未完全就绪（$u）：$spec —— 重启容器会自动重试"
  return 1
}

drop_deferred_plugins() { # $1=成员。未安装则跳过；失败不阻塞启动
  local u="$1" key profile="$home/desk-test/$u/profiles/web/package.json"
  [ -f "$profile" ] || return 0
  for key in "${DEFERRED_PLUGINS[@]}"; do
    grep -q "\"$key\"" "$profile" 2>/dev/null || continue
    log "卸下 0.2.1-rc.3 暂不挂载的插件（$u）：$key"
    DSH_HOME="$home/desk-test/$u" node "$dsh" plugin --profile web remove "$key" >/dev/null 2>&1 \
      || log "警告：卸载失败（$u）：$key"
  done
}

# install_plugin 只看包名。已是 0.28.0 则留下；别的版本（如 0.1.5 卷上的 0.19.1）先卸，
# 否则 add 会报 already-installed，钉不上 0.28.0。
reinstall_sidebar_unless_pinned() { # $1=成员
  local u="$1"
  local profile="$home/desk-test/$u/profiles/web"
  local pkg="$profile/package.json"
  local installed="$profile/node_modules/dsh-better-sidebar/package.json"
  [ -f "$pkg" ] || return 0
  grep -q '"dsh-better-sidebar"' "$pkg" || return 0
  if grep -Eq '"dsh-better-sidebar"[[:space:]]*:[[:space:]]*"[^"]*0\.28\.0"' "$pkg"; then
    return 0
  fi
  if [ -f "$installed" ] && grep -Eq '"version"[[:space:]]*:[[:space:]]*"0\.28\.0"' "$installed"; then
    return 0
  fi
  log "better-sidebar 不是 0.28.0，卸下后按钉重装（$u）"
  DSH_HOME="$home/desk-test/$u" node "$dsh" plugin --profile web remove dsh-better-sidebar >/dev/null 2>&1 || true
}

# install_plugin 只看包名。已是 1.4.2 则留下；别的版本（npm 1.3.1、1.4.0、1.4.1）先卸，
# 否则 add 会报 already-installed，钉不上 file: 这份 1.4.2。不要装 npm 1.3.1。
reinstall_aqua_unless_pinned() { # $1=成员
  local u="$1"
  local profile="$home/desk-test/$u/profiles/web"
  local pkg="$profile/package.json"
  local installed="$profile/node_modules/dsh-client-ui-aqua/package.json"
  [ -f "$pkg" ] || return 0
  grep -q '"dsh-client-ui-aqua"' "$pkg" || return 0
  if grep -Eq '"dsh-client-ui-aqua"[[:space:]]*:[[:space:]]*"[^"]*1\.4\.2"' "$pkg"; then
    return 0
  fi
  if [ -f "$installed" ] && grep -Eq '"version"[[:space:]]*:[[:space:]]*"1\.4\.2"' "$installed"; then
    return 0
  fi
  log "aqua 不是 1.4.2，卸下后按钉重装（$u）"
  DSH_HOME="$home/desk-test/$u" node "$dsh" plugin --profile web remove dsh-client-ui-aqua >/dev/null 2>&1 || true
}

# file: 装过一次后，清单变更不会自动进 profile。engines.dsh 变了就卸掉再装。
reinstall_desk_panel_if_manifest_drifted() { # $1=成员
  local u="$1"
  local src="$repo/plugin/desk-panel/package.json"
  local dst="$home/desk-test/$u/profiles/web/node_modules/dsh-desk-panel/package.json"
  [ -f "$src" ] && [ -f "$dst" ] || return 0
  cmp -s "$src" "$dst" && return 0
  log "desk-panel 清单与仓库不一致，卸下后重装（$u）"
  DSH_HOME="$home/desk-test/$u" node "$dsh" plugin --profile web remove dsh-desk-panel >/dev/null 2>&1 || true
}

while IFS=$'\t' read -r u p h; do
  [ -n "${u:-}" ] || continue
  drop_deferred_plugins "$u"
  reinstall_desk_panel_if_manifest_drifted "$u"
  reinstall_sidebar_unless_pinned "$u"
  reinstall_aqua_unless_pinned "$u"
  install_plugin "$u" "file:$repo/plugin/desk-panel" "dsh-desk-panel" || true
  install_plugin "$u" "link:$repo/plugin/dsh-wx-answerer" "dsh-wx-answerer" || true
  install_plugin "$u" "dsh-better-sidebar@0.28.0" "dsh-better-sidebar" || true
  install_plugin "$u" "file:$repo/plugin/dsh-client-ui-aqua" "dsh-client-ui-aqua" || true
done < "$home/.desk/run/instances.tsv"

# ── 5c) desk-panel 前端副本强制同步（幂等，原地写保 inode）──
# 坑（2026-10-04 云上实测）：file: 依赖装过一次后 pnpm 不会因镜像更新而重拷贝，
# 且 install_plugin 对已装依赖直接 skip → 成员实例会一直跑旧 client.js（界面不更新，
# 验收现象 = 组合包 grep 新标记 0 命中）。每次容器启动强制同步；实例启动时
# boot HTML 据此生成新 rev，浏览器缓存自动失效。
DESK_SRC="$repo/plugin/desk-panel/lib/client.js"
if [ -f "$DESK_SRC" ]; then
  for f in "$home"/desk-test/*/profiles/web/node_modules/dsh-desk-panel/lib/client.js; do
    [ -f "$f" ] || continue
    if ! cmp -s "$DESK_SRC" "$f"; then
      cat "$DESK_SRC" > "$f" && log "刷新 desk-panel 副本：$f"
    fi
  done
fi

# 本脚本已完成配置的成员：置就绪标记（运行中新增成员由监督器配置）
while IFS=$'\t' read -r _u _p _h; do
  [ -n "${_u:-}" ] && touch "$home/.desk/run/$_u.prov"
done < "$home/.desk/run/instances.tsv"

# aqua 的 settings.plugin.item key 补丁不在 0.2.1-rc.3 上跑：该槽已删除。
# 本脚本改钉 file:$repo/plugin/dsh-client-ui-aqua（1.4.2）。WSL 0.1.5 仍可用 patches/aqua-plugin-card-key.py。

# ── 6) 团队 Soul / 工作区 README（此时各实例已有 profiles 目录） ──
bash scripts/apply-soul.sh >/dev/null && log "团队 Soul / 工作区 README 已铺"

log "初始化完成（管理员：$admin · 实例清单：$home/.desk/run/instances.tsv）"
