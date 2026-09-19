#!/usr/bin/env bash
# 安装/更新 systemd 单元（以 root 运行）：sudo bash scripts/install-services.sh
# 单元文件在 deploy/systemd/；此脚本复制到 /etc/systemd/system 并开机自启。
set -euo pipefail
here="$(cd "$(dirname "$0")/.." && pwd)"

[ "$(id -u)" = "0" ] || { echo "请用 root 运行: sudo bash scripts/install-services.sh"; exit 1; }

cp "$here/deploy/systemd/desk-server.service" /etc/systemd/system/
cp "$here/deploy/systemd/desk-agent-boss.service" /etc/systemd/system/
cp "$here/deploy/systemd/desk-agent-bob.service" /etc/systemd/system/
cp "$here/deploy/systemd/desk-agent-alice.service" /etc/systemd/system/
systemctl daemon-reload
systemctl enable --now desk-server desk-agent-boss desk-agent-bob desk-agent-alice
echo "已安装并启用：desk-server + 3 个实例（开机自启、崩溃自动重拉）"
echo "管理入口：sudo bash scripts/desk.sh status|start|stop|restart [all|server|u1|u2|u3]"
