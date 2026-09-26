#!/usr/bin/env bash
# 中国大陆网络环境一键构建（DSH-ANYWORK）
#   通道说明：Docker Hub → daemon.json 镜像源（如 https://docker.1ms.run，需在 Docker Desktop 配置一次）
#             npm/corepack → registry.npmmirror.com
#             Debian apt    → mirrors.aliyun.com
#             dsh 源码 clone → gh-proxy.com（GitHub 直连不稳时使用；若不通可去掉该行）
# 用法： bash deploy/docker/build-cn.sh
set -euo pipefail
cd "$(dirname "$0")/../.."

# compose 解析所需的必填变量：仅构建期占位，不参与运行（运行配置在服务器 .env）
export DEEPSEEK_API_KEY="${DEEPSEEK_API_KEY:-sk-build-placeholder}"
export ANYWORK_HOST="${ANYWORK_HOST:-127.0.0.1:8080}"

docker compose build \
  --build-arg NPM_REGISTRY=https://registry.npmmirror.com \
  --build-arg DEBIAN_MIRROR=mirrors.aliyun.com \
  --build-arg DSH_REPO=https://gh-proxy.com/https://github.com/deepseek-ai/deepseek-harness.git

echo "✅ 构建完成（大陆加速通道）"
echo "   镜像：docker images | grep dsh-anywork  （另见 docker compose config --images）"
