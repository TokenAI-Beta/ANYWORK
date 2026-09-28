#!/usr/bin/env bash
# 容器内应急修复：补齐缺失的原生载荷（尤其是 Landlock 启动器 bin/landlock-run）。
#
# 背景：镜像构建若未跑过 native/system 的完整构建（详见 deploy/docker/Dockerfile
#   "原生载荷" 一行），bin/landlock-run 就不存在；此时容器内 Linux 沙箱链
#   （bwrap → Landlock）两个运行器都不可用 → agent 的 bash 工具全部 fail-closed，
#   报 "sandbox mode ... no sandbox backend is usable on this host"。
#   正解是重建镜像（Dockerfile 已包含该构建步骤）。本脚本供"不能立刻重建"时应急。
#
# 用法（在装有本仓库的宿主机上）：
#   ① 容器内现场编译（需 musl-gcc；缺则 apt 安装）：
#      docker compose exec -T anywork bash /opt/anywork/deploy/docker/fix-landlock-run.sh
#   ② 直接安装预编译静态二进制（跨机通用、免 apt，适合云端/无网环境）：
#      docker compose cp deploy/docker/fix-landlock-run.sh anywork:/tmp/fix.sh
#      docker compose cp <预编译的 landlock-run> anywork:/tmp/landlock-run
#      docker compose exec -T anywork bash /tmp/fix.sh /tmp/landlock-run
#   镜像较旧时脚本可能不在容器里，先按上面 ② 的方式 cp 投送再执行。
#
# 幂等：landlock-run 已在位（且未传预编译）时只重启各实例；否则先安装/编译。
set -euo pipefail

DSH=/opt/deepseek-harness
BIN="$DSH/native/system/packages/linux-x64/bin/landlock-run"
SRC="$DSH/native/system/packages/entry/src/main.c"
RUN="${HOME:-/data}/.desk/run"
PREBUILT="${1:-}"

if [ -n "$PREBUILT" ]; then
  [ -f "$PREBUILT" ] || { echo "!! 找不到预编译文件 $PREBUILT" >&2; exit 1; }
  magic="$(head -c 4 "$PREBUILT" | od -An -tx1 | tr -d ' \n')"
  [ "$magic" = "7f454c46" ] || { echo "!! 不是 ELF 可执行文件：$PREBUILT" >&2; exit 1; }
  mkdir -p "$(dirname "$BIN")"
  install -m 755 "$PREBUILT" "$BIN"
  echo ">> 已安装预编译启动器到 $BIN"
elif [ ! -x "$BIN" ]; then
  [ -f "$SRC" ] || { echo "!! 找不到源码 $SRC（容器里没有 dsh 检出？）" >&2; exit 1; }
  if ! command -v musl-gcc >/dev/null 2>&1; then
    echo ">> 安装 musl-tools（只需一次，容器重建后失效）…"
    apt-get update -qq && apt-get install -y --no-install-recommends musl-tools >/dev/null
  fi
  mkdir -p "$(dirname "$BIN")"
  musl-gcc -std=c11 -Os -Wall -Wextra -Werror -static -s -o "$BIN" "$SRC"
  chmod 755 "$BIN"
  echo ">> 已生成 $BIN"
else
  echo ">> landlock-run 已在位，跳过安装"
fi

# 让运行中的实例重新探测：按 pid 文件 + /proc 环境校验精确重启（监督循环约 5 秒自拉）。
restarted=0
for pidf in "$RUN"/*.pid; do
  [ -f "$pidf" ] || continue
  u="$(basename "$pidf" .pid)"
  p="$(cat "$pidf" 2>/dev/null || true)"
  [ -n "$p" ] && [ -d "/proc/$p" ] || continue
  if tr '\0' '\n' < "/proc/$p/environ" 2>/dev/null | grep -q "^DSH_HOME=${HOME:-/data}/desk-test/$u$"; then
    kill -9 "$p" 2>/dev/null || true
    echo ">> 已重启实例 $u（pid $p）"
    restarted=$((restarted + 1))
  fi
done
echo ">> 完成：重启实例 $restarted 个"

cat <<'TIP'
>> 自检（期望输出 full）：
   cd /opt/deepseek-harness/packages/sandbox/sandbox-local && \
     node --input-type=module -e "const m=await import('@deepseek-ai/node-addon-system/landlock-run');console.log(m.probe(m.launcherPath(),{timeoutMs:5000}))"
TIP
