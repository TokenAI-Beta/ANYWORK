#!/usr/bin/env bash
# P3-19 隔离复查：密钥权限 / 实例目录权限 / 信任围栏 / 账本哈希。全绿即通过。
set -uo pipefail
cd "$(dirname "$0")/.."
export PATH="$HOME/opt/node-v24.19.0-linux-x64/bin:$HOME/bin:$PATH"
fail=0
ok() { echo "  ✓ $1"; }
bad() { echo "  ✗ $1"; fail=1; }

echo "== 1) 密钥与凭据文件权限 =="
for f in "$HOME/.desk/keys.env" "$HOME/.desk/agents/"*.key; do
  [ -e "$f" ] || continue
  p=$(stat -c %a "$f")
  if [ "$p" = "600" ]; then ok "$f ($p)"; else bad "$f ($p ≠ 600)"; fi
done
for f in "$HOME/desk-test/"*"/.credentials.yaml"; do
  [ -e "$f" ] || continue
  p=$(stat -c %a "$f")
  if [ "$p" = "600" ]; then ok "$f ($p)"; else bad "$f ($p ≠ 600)"; fi
done
if git grep -IlE 'sk-desk-[0-9a-f]{16,}' -- . >/dev/null 2>&1; then
  bad "仓库里出现疑似真实虚拟钥匙"
else
  ok "仓库无钥匙泄漏"
fi

echo "== 2) 实例目录权限（同机他人不可读） =="
for d in "$HOME/desk-test/u1" "$HOME/desk-test/u2" "$HOME/desk-test/u3"; do
  [ -d "$d" ] || continue
  chmod 700 "$d" 2>/dev/null || true
  p=$(stat -c %a "$d")
  case "$p" in 700|750|770) ok "$d ($p)";; *) bad "$d ($p，建议 700)";; esac
done

echo "== 3) 信任围栏 =="
code=$(curl -s -m 3 -o /dev/null -w '%{http_code}' -H "Host: example.com:3301" http://127.0.0.1:3301/api/status 2>/dev/null || echo 000)
if [ "$code" = "403" ] || [ "$code" = "000" ]; then ok "非信任 Host 访问实例 /api → $code"; else bad "非信任 Host 意外放行: $code"; fi
code=$(curl -s -m 3 -o /dev/null -w '%{http_code}' http://127.0.0.1:8080/portal/api/usage 2>/dev/null || echo 000)
if [ "$code" = "401" ]; then ok "未登录访问 /portal/api/usage → 401"; else bad "门户接口未拦住: $code"; fi

echo "== 4) 账本只存哈希 =="
n=$(node --input-type=module -e "
import { openDb } from './src/db.ts'
const db = openDb()
const r = db.prepare(\"SELECT COUNT(*) AS n FROM api_keys WHERE token_hash LIKE 'sk-%'\").get()
console.log(r.n)
" 2>/dev/null || echo err)
if [ "$n" = "0" ]; then ok "api_keys 只存哈希（无明文）"; else bad "api_keys 异常: $n"; fi

echo
if [ "$fail" = "0" ]; then echo "隔离复查：全绿 ✓"; else echo "隔离复查：存在项失败 ✗"; fi
exit "$fail"
