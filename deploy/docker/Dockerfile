# syntax=docker/dockerfile:1
# DSH-ANYWORK 一体镜像：门户 + 模型网关 + 每个成员一个 dsh 实例（单容器）
# 构建：docker compose up -d --build
#   首次构建含 dsh 引擎编译（约 15~25 分钟，视网络）；之后走构建缓存很快。
# 数据：全部落在 /data 卷（镜像无状态，升级不丢数据）。

# ---------- 阶段 1：编译 dsh 引擎（钉版本 + 打品牌补丁） ----------
FROM node:24-bookworm AS dsbuild
ARG DSH_REPO=https://github.com/deepseek-ai/deepseek-harness.git
ARG DSH_REF=dsh-v0.1.5-rc.2
# —— 可选：网络源覆盖（中国大陆构建建议传入；不传 = 保持官方源）——
ARG DEBIAN_MIRROR=
ARG NPM_REGISTRY=
RUN if [ -n "$DEBIAN_MIRROR" ]; then for f in /etc/apt/sources.list /etc/apt/sources.list.d/*.sources; do [ -f "$f" ] && sed -i "s|deb.debian.org|$DEBIAN_MIRROR|g" "$f"; done; fi \
 && apt-get update \
 && apt-get install -y --no-install-recommends git ca-certificates python3 build-essential \
 && rm -rf /var/lib/apt/lists/*
ENV COREPACK_NPM_REGISTRY=${NPM_REGISTRY:-https://registry.npmjs.org} \
    npm_config_registry=${NPM_REGISTRY:-https://registry.npmjs.org}
RUN corepack enable
WORKDIR /src
RUN git clone --depth 1 --branch "${DSH_REF}" "${DSH_REPO}" deepseek-harness
COPY patches/ /src/patches/
RUN DSH_SRC=/src/deepseek-harness python3 /src/patches/dsh-branding-anywork-tokenai.py
# 非 loopback（门户访问）也启用 host 设置持久化：语言/外观等设置才会落盘
RUN DSH_SRC=/src/deepseek-harness python3 /src/patches/dsh-settings-lan-persistence.py || echo "WARN: settings persistence patch skipped"
WORKDIR /src/deepseek-harness
RUN pnpm install
RUN pnpm build
RUN pnpm --filter @deepseek-ai/dsh-client-ui-settings run bundle || echo "WARN: ui-settings bundle skipped"
RUN pnpm --filter @deepseek-ai/dsh-client-ui-settings-general run bundle || echo "WARN: ui-settings-general bundle skipped"

# ---------- 阶段 2：运行时 ----------
FROM node:24-bookworm-slim AS runtime
ARG DEBIAN_MIRROR=
ARG NPM_REGISTRY=
RUN if [ -n "$DEBIAN_MIRROR" ]; then for f in /etc/apt/sources.list /etc/apt/sources.list.d/*.sources; do [ -f "$f" ] && sed -i "s|deb.debian.org|$DEBIAN_MIRROR|g" "$f"; done; fi \
 && apt-get update \
 && apt-get install -y --no-install-recommends python3 ca-certificates curl procps tini git make g++ \
 && rm -rf /var/lib/apt/lists/*
ENV COREPACK_NPM_REGISTRY=${NPM_REGISTRY:-https://registry.npmjs.org} \
    npm_config_registry=${NPM_REGISTRY:-https://registry.npmjs.org}
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
