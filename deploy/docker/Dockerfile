# syntax=docker/dockerfile:1
# DSH-ANYWORK 一体镜像：门户 + 模型网关 + 每个成员一个 dsh 实例（单容器）
# 构建：docker compose up -d --build
#   首次构建含 dsh 引擎编译（约 15~25 分钟，视网络）；之后走构建缓存很快。
# 数据：全部落在 /data 卷（镜像无状态，升级不丢数据）。

# ---------- 阶段 1：编译 dsh 引擎（钉版本 + 打品牌补丁） ----------
FROM node:24-bookworm AS dsbuild
ARG DSH_REPO=https://github.com/deepseek-ai/deepseek-harness.git
ARG DSH_REF=dsh-v0.1.5-rc.2
RUN apt-get update \
 && apt-get install -y --no-install-recommends git ca-certificates python3 build-essential \
 && rm -rf /var/lib/apt/lists/*
RUN corepack enable
WORKDIR /src
RUN git clone --depth 1 --branch "${DSH_REF}" "${DSH_REPO}" deepseek-harness
COPY patches/ /src/patches/
RUN DSH_SRC=/src/deepseek-harness python3 /src/patches/dsh-branding-anywork-tokenai.py
WORKDIR /src/deepseek-harness
RUN pnpm install
RUN pnpm build

# ---------- 阶段 2：运行时 ----------
FROM node:24-bookworm-slim AS runtime
RUN apt-get update \
 && apt-get install -y --no-install-recommends python3 ca-certificates curl procps tini git make g++ \
 && rm -rf /var/lib/apt/lists/*
RUN corepack enable
WORKDIR /opt/anywork
COPY . /opt/anywork
RUN rm -rf /opt/anywork/.git

COPY --from=dsbuild /src/deepseek-harness /opt/deepseek-harness

ENV HOME=/data
ENV NODE_ENV=production
EXPOSE 8080
VOLUME ["/data"]
HEALTHCHECK --interval=30s --timeout=5s --start-period=90s --retries=3 \
  CMD curl -fsS http://127.0.0.1:8080/healthz || exit 1
ENTRYPOINT ["/usr/bin/tini", "--", "/opt/anywork/deploy/docker/entrypoint.sh"]
