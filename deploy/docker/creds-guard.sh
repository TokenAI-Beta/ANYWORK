#!/usr/bin/env bash
# 个人钥匙防呆（creds-guard）：
# 实例凭据里若出现「真 key（非 sk-desk- 开头）」且其 settings.yaml 的 baseURL 仍指向
# 团队网关（127.0.0.1:8100）——这是一个必然 401 的组合（网关只认虚拟钥匙）——自动还原为虚拟钥匙。
# 若 baseURL 已改为公网直连（个人直连模式），则不动（那是合法用法）。
# 日志：/data/.desk/run/creds-guard.log；由 entrypoint 后台启动，每 15 秒检查一次。
set -u
home="${HOME:-/data}"
echo "[creds-guard] 已启动（每 15 秒检查一次）"
while :; do
  sleep 15
  for dir in "$home"/desk-test/*/; do
    [ -d "$dir" ] || continue
    u="$(basename "$dir")"
    cf="${dir}.credentials.yaml"
    [ -f "$cf" ] || continue
    v="$(sed -n 's/.*DEEPSEEK_API_KEY: *"\?\([^"[:space:]}]*\).*/\1/p' "$cf" | head -1)"
    case "$v" in
      ""|sk-desk-*) continue ;;   # 空或已是虚拟钥匙：正常
    esac
    # 是真 key：看 baseURL 指向
    base="$(sed -n 's/^ *baseURL: *//p' "${dir}settings.yaml" 2>/dev/null | head -1)"
    case "$base" in
      *127.0.0.1:8100*) ;;        # 仍指向团队网关 → 走还原
      *) continue ;;              # 公网直连（个人直连模式）→ 合法，不动
    esac
    vk="$(cat "$home/.desk/agents/$u.key" 2>/dev/null | tr -d '\r\n')"
    [ -n "$vk" ] || continue
    python3 - "$cf" "$vk" <<'PY'
import re, sys
p, vk = sys.argv[1], sys.argv[2]
try:
    s = open(p).read()
except Exception:
    sys.exit(0)
s2 = re.sub(r'(DEEPSEEK_API_KEY:\s*)"([^"]*)"', lambda m: m.group(1) + '"' + vk + '"', s, count=1)
if s2 == s:
    s2 = re.sub(r'(DEEPSEEK_API_KEY:\s*)([^\s}]+)', lambda m: m.group(1) + vk, s, count=1)
if s2 != s:
    open(p, 'w').write(s2)
    print('restored')
PY
    echo "[creds-guard] $u：检测到把真 key 填到个人卡片（仍指向团队网关，必然无效）→ 已自动还原为虚拟钥匙"
  done
done
