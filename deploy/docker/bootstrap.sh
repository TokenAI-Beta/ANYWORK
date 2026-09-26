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
for d in kb drive skills presets hooks bin; do mkdir -p "$home/desk-data/$d"; done
cp -rn "$repo/kb-template/." "$home/desk-data/kb/" 2>/dev/null || true
cp -rn "$repo/drive-template/." "$home/desk-data/drive/" 2>/dev/null || true
cp -rn "$repo/skills-template/." "$home/desk-data/skills/" 2>/dev/null || true
cp -rn "$repo/presets-template/." "$home/desk-data/presets/" 2>/dev/null || true
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
  fi
done < "$home/.desk/run/instances.tsv"

# ── 5) 各实例插件（首次安装；已装跳过；失败不阻塞启动，重启容器会自动重试） ──
install_plugin() { # $1=成员 $2=安装 spec $3=检测键（依赖名） $4=可选完整性探针（文件存在才算就绪）
  local u="$1" spec="$2" key="$3" probe="${4:-}"
  local dsh_home="$home/desk-test/$u"
  local profile="$dsh_home/profiles/web"
  grep -q "\"$key\"" "$profile/package.json" 2>/dev/null && { [ -z "$probe" ] || [ -e "$probe" ]; } && return 0
  log "安装插件（$u）：$spec"
  # 预热：确保 profile 目录存在（plugin 命令会据此初始化）
  DSH_HOME="$dsh_home" node "$dsh" plugin --profile web list >/dev/null 2>&1 || true
  DSH_HOME="$dsh_home" node "$dsh" plugin --profile web add "$spec" >/dev/null 2>&1 || true
  # 原生模块（如 better-sidebar 的 node-pty）没编出来时：approve 后原地重装
  if [ -n "$probe" ] && [ ! -e "$probe" ] && [ -f "$profile/package.json" ]; then
    (cd "$profile" && pnpm approve-builds --all >/dev/null 2>&1) || true
    (cd "$profile" && pnpm install >/dev/null 2>&1) || true
  fi
  grep -q "\"$key\"" "$profile/package.json" 2>/dev/null && { [ -z "$probe" ] || [ -e "$probe" ]; } && return 0
  log "警告：插件未完全就绪（$u）：$spec —— 重启容器会自动重试"
  return 1
}

while IFS=$'\t' read -r u p h; do
  [ -n "${u:-}" ] || continue
  install_plugin "$u" "file:$repo/plugin/desk-panel" "dsh-desk-panel"
  install_plugin "$u" "https://github.com/Zagadka-3906/DSH-Transparent-UI-Plugin-dsh015.git" "dsh-client-ui-aqua"
  install_plugin "$u" "dsh-chat-import" "dsh-chat-import"
  # 注：better-sidebar 0.21+ 起不再依赖 node-pty（官方改走引擎内建终端）——不再设置 pty 探针。
  #     历史版本（0.19.x）曾需要 node-pty@build/Release/pty.node；如回到旧版本再加回探针。
  install_plugin "$u" "dsh-better-sidebar@latest" "dsh-better-sidebar"
done < "$home/.desk/run/instances.tsv"

# 本脚本已完成配置的成员：置就绪标记（运行中新增成员由监督器配置）
while IFS=$'\t' read -r _u _p _h; do
  [ -n "${_u:-}" ] && touch "$home/.desk/run/$_u.prov"
done < "$home/.desk/run/instances.tsv"

# ── 5b) aqua fork 适配：settings.plugin.item 补 key（0.1.5 keyed slot；幂等） ──
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
        print("[bootstrap] aqua key 补丁:", f)
AQUA_PATCH


# ── 6) 团队 Soul / 工作区 README（此时各实例已有 profiles 目录） ──
bash scripts/apply-soul.sh >/dev/null && log "团队 Soul / 工作区 README 已铺"

log "初始化完成（管理员：$admin · 实例清单：$home/.desk/run/instances.tsv）"
