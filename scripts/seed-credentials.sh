#!/usr/bin/env bash
# 把各成员的虚拟钥匙从「启动环境变量」迁移为「可写凭据存储」$DSH_HOME/.credentials.yaml
# 背景：credentials-local 的层级 = 启动环境变量(只读,永久压过) > .credentials.yaml(可写) > .env 回退层。
#       环境变量层的钥匙会让 Models 设置页的 API Key 输入框被禁用（describe → writable:false），
#       播种 .credentials.yaml 后 source=file、writable=true：页面可编辑，改动即时生效。
# 用法: bash scripts/seed-credentials.sh [user ...] [--force]   （默认 boss bob alice）
#   默认只播种「缺失」的钥匙；已有自定义值（用户可能在 Models 页改过）保留不动，--force 强制同步。
set -euo pipefail

force=0
users=()
for a in "$@"; do
  if [ "$a" = "--force" ]; then force=1; else users+=("$a"); fi
done
if [ "${#users[@]}" -eq 0 ]; then
  users=(boss bob alice)
fi

for u in "${users[@]}"; do
  key_file="$HOME/.desk/agents/$u.key"
  # 实例家目录：优先从 systemd 单元推导（ExecStart 末尾的 desk-test/uN），兜底 desk-test/<用户名>
  home="$(systemctl show "desk-agent-$u" -p ExecStart --value 2>/dev/null | tr " " "\n" | grep -E "/desk-test/[A-Za-z0-9_-]+$" | tail -1)"
  if [ -z "$home" ] || [ ! -d "$home" ]; then
    home="$HOME/desk-test/$u"
  fi
  doc="$home/.credentials.yaml"
  if [ ! -f "$key_file" ]; then
    echo "[skip] $u：无钥匙文件 $key_file"
    continue
  fi
  mkdir -p "$home"
  chmod 700 "$home"
  key="$(tr -d '\n' < "$key_file")"
  if [ -f "$doc" ] && grep -q '^DEEPSEEK_API_KEY:' "$doc"; then
    cur="$(grep '^DEEPSEEK_API_KEY:' "$doc" | head -1 | sed 's/^DEEPSEEK_API_KEY:[[:space:]]*//')"
    if [ "$cur" = "$key" ]; then
      chmod 600 "$doc"
      echo "[ok] $u：已同值，跳过（$doc）"
      continue
    fi
    if [ "$force" != "1" ]; then
      chmod 600 "$doc"
      echo "[keep] $u：已存在其他值（可能为用户在 Models 页自定义），保留不动；--force 可强制同步（$doc）"
      continue
    fi
    tmp="$(mktemp)"
    grep -v '^DEEPSEEK_API_KEY:' "$doc" > "$tmp" || true
    printf 'DEEPSEEK_API_KEY: %s\n' "$key" >> "$tmp"
    install -m 600 "$tmp" "$doc"
    rm -f "$tmp"
    echo "[done] $u：已强制同步为当前虚拟钥匙"
  elif [ -f "$doc" ]; then
    printf 'DEEPSEEK_API_KEY: %s\n' "$key" >> "$doc"
    chmod 600 "$doc"
    echo "[done] $u：已追加"
  else
    printf '# DSH-ANYWORK 团队网关虚拟钥匙（seed-credentials.sh 维护；Models 设置页可改，改动即时生效）\nDEEPSEEK_API_KEY: %s\n' "$key" > "$doc"
    chmod 600 "$doc"
    echo "[done] $u：新建 $doc（$(wc -c < "$doc") bytes）"
  fi
done
