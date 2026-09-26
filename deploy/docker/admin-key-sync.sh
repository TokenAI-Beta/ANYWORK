#!/usr/bin/env bash
# 管理员钥匙桥 v2（2026-09-26）：管理员实例「设置→模型」里修改的 key 自动应用到团队网关；
# 实例侧立即还原为虚拟钥匙（否则网关不认）。仅监听管理员账号——成员账号的改动不影响团队网关。
# 兼容凭据文件两种格式：块式 "  DEEPSEEK_API_KEY: xxx" 与流式 "refs: { DEEPSEEK_API_KEY: xxx }"。
# 由 entrypoint 以独立后台循环启动（日志：/data/.desk/run/admin-key-sync.log）。
set -u
home="${HOME:-/data}"
admin="${ANYWORK_ADMIN_USER:-boss}"
CF="$home/desk-test/$admin/.credentials.yaml"
KEYENV="$home/.desk/keys.env"
VKFILE="$home/.desk/agents/$admin.key"

read_key() {
  python3 - "$1" <<'PY'
import re, sys
try:
    s = open(sys.argv[1], encoding="utf-8").read()
    m = re.search(r"DEEPSEEK_API_KEY:\s*([A-Za-z0-9_.\-]+)", s)
    print(m.group(1) if m else "")
except Exception:
    print("")
PY
}

restore_virtual() { # $1=虚拟钥匙；有改动则输出 restored
  python3 - "$CF" "$1" <<'PY'
import re, sys
p, vk = sys.argv[1], sys.argv[2]
s = open(p, encoding="utf-8").read()
s2 = re.sub(r"(DEEPSEEK_API_KEY:\s*)[A-Za-z0-9_.\-]+", lambda m: m.group(1) + vk, s, count=1)
if s2 != s:
    open(p, "w", encoding="utf-8").write(s2)
    print("restored")
PY
}

echo "[admin-key-sync] 已启动 v2（管理员：$admin；每 6 秒检查设置变更）"
while :; do
  sleep 6
  [ -f "$CF" ] || continue
  v="$(read_key "$CF")"
  [ -n "$v" ] || continue
  case "$v" in
    sk-desk-*) continue ;;   # 已是虚拟钥匙（常态），跳过
  esac
  # 走到这里：实例凭据里是一把真实 key（= 管理员刚在设置里填/paste 的）
  cur="$(sed -n 's/^DEEPSEEK_API_KEY=//p' "$KEYENV" 2>/dev/null | head -1 | tr -d '\r\n')"
  changed=0
  if [ "$v" != "$cur" ]; then
    printf 'DEEPSEEK_API_KEY=%s\n' "$v" > "$KEYENV"
    chmod 600 "$KEYENV"
    changed=1
    echo "[admin-key-sync] 检测到管理员更新 key → 已应用到团队网关（尾4 ${v: -4}）"
  fi
  vk="$(cat "$VKFILE" 2>/dev/null | tr -d '\r\n')"
  if [ -n "$vk" ]; then
    r="$(restore_virtual "$vk")"
    [ -n "$r" ] && echo "[admin-key-sync] 实例凭据已还原为虚拟钥匙"
  fi
  if [ "$changed" = "1" ]; then
    pkill -f "src/server.ts" 2>/dev/null || true
    echo "[admin-key-sync] 网关已重启，新 key 生效"
  fi
done
