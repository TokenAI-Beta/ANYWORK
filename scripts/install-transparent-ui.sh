#!/usr/bin/env bash
# 安装 Aqua 玻璃主题（npm 包 dsh-client-ui-aqua，社区插件，MIT）
# 版本对表：原版 1.3.x 的 peerDependencies 钉 ^0.1.0-rc.5 —— 与本部署 DSH 0.1.0-rc.5 同代。
# （新版 DSH 请改用对应 fork：Zagadka-3906(dsh015) / afrel1024(rc.7) / du-u-uck）
# 幂等：已装跳过。装完重启对应实例生效（kill -9 MainPID，systemd 自拉）。
# 卸载：DSH_HOME=<home> node apps/cli/lib/bin.js plugin --profile web remove dsh-client-ui-aqua
# 总开关位置：工作台 设置 → 插件 → 插件配置 →「玻璃主题」（开关是浏览器本地偏好，每人各自开关）
set -euo pipefail
export PATH="$HOME/opt/node-v24.19.0-linux-x64/bin:$HOME/bin:$PATH"
cd "$HOME/deepseek-harness"
PKG="${AQUA_PKG:-dsh-client-ui-aqua@1.3.1}"
users=("$@")
[ "${#users[@]}" -eq 0 ] && users=(boss bob alice)

for u in "${users[@]}"; do
  home="$(systemctl show "desk-agent-$u" -p ExecStart --value 2>/dev/null | tr " " "\n" | grep -E "/desk-test/[A-Za-z0-9_-]+$" | tail -1)"
  [ -z "$home" ] && home="$HOME/desk-test/$u"
  if DSH_HOME="$home" node apps/cli/lib/bin.js --profile web --dump-config 2>/dev/null | grep -q "ui-aqua"; then
    echo "[ok] $u：已装，跳过（$home）"
  else
    DSH_HOME="$home" node apps/cli/lib/bin.js plugin --profile web add "$PKG" >/dev/null 2>&1
    echo "[done] $u：已安装 $PKG（$home）"
  fi
done
echo "重启实例生效：kill -9 各 desk-agent-<user> 的 MainPID"
