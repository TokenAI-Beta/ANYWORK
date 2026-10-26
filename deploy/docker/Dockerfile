# syntax=docker/dockerfile:1
# DSH-ANYWORK 一体镜像：门户 + 模型网关 + 每个成员一个 dsh 实例（单容器）
# 构建：docker compose up -d --build
#   首次构建含 dsh 引擎编译（约 15~25 分钟，视网络）；之后走构建缓存很快。
# 数据：全部落在 /data 卷（镜像无状态，升级不丢数据）。

# ---------- 阶段 1：编译 dsh 引擎（钉版本 + 打品牌补丁） ----------
FROM node:24-bookworm AS dsbuild
ARG DSH_REPO=https://github.com/deepseek-ai/deepseek-harness.git
# 本地 Docker 引擎钉 dsh-v0.2.1-rc.3（不要钉 rc.2）。
# 东京云镜像与 Windows/WSL 裸机 ~/deepseek-harness 不由本 ARG 切换；
# 打 v* 标签才会进 GHCR，在插件恢复清单完成前不要发版。见 docs/0.2-plugin-api-breakpoints.md。
ARG DSH_REF=dsh-v0.2.1-rc.3
# —— 可选：网络源覆盖（中国大陆构建建议传入；不传 = 保持官方源）——
ARG DEBIAN_MIRROR=
ARG NPM_REGISTRY=
RUN if [ -n "$DEBIAN_MIRROR" ]; then for f in /etc/apt/sources.list /etc/apt/sources.list.d/*.sources; do [ -f "$f" ] && sed -i "s|deb.debian.org|$DEBIAN_MIRROR|g" "$f"; done; fi \
 && apt-get update \
 && apt-get install -y --no-install-recommends git ca-certificates python3 build-essential musl-tools \
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
# 侧栏账号菜单「登录」改为打开中转站账密页。只改本镜像里克隆的 dsh 源码，随后 pnpm build 打进客户端包。
# DSH_REF 不动。脚本要求 DSH_SRC，没有家目录默认路径。
COPY deploy/docker/dsh-sidebar-relay-login.py /tmp/dsh-sidebar-relay-login.py
RUN DSH_SRC=/src/deepseek-harness python3 /tmp/dsh-sidebar-relay-login.py
# 侧栏九项主入口（sidebar.footer.action）挪到「插件」面板列表之上、新会话之下。
# 底栏只留设置（「更多」）。不改 AccountMenu，不改 DSH_REF。脚本要求 DSH_SRC。
COPY deploy/docker/dsh-sidebar-nav-reorder.py /tmp/dsh-sidebar-nav-reorder.py
RUN DSH_SRC=/src/deepseek-harness python3 /tmp/dsh-sidebar-nav-reorder.py
# 侧栏条目 chrome：panelList（插件 / 自动化任务）与同列 sidebar.footer.action
# 共用标题字号与 leading icon。不改槽注册、不改登录 URL、不卸 desk-auto。
# 脚本要求 DSH_SRC。不打 Windows 检出，也不靠热装 desk-panel 单独改这层壳。
COPY deploy/docker/dsh-sidebar-entry-chrome.py /tmp/dsh-sidebar-entry-chrome.py
RUN DSH_SRC=/src/deepseek-harness python3 /tmp/dsh-sidebar-entry-chrome.py
# 侧栏三组卡片（乙·重）：工作（新会话 / 功能与连接 / 自动化任务）、
# 扩展（插件 / 导入会话）、账户（用量 / 面板「更多」）。
# 其余 sidebar.footer.action 仍各渲染一次。不改登录 URL，不卸 desk-auto，不改 DSH_REF。
# 必须排在 entry-chrome 之后、pnpm build 之前。脚本要求 DSH_SRC。不打 Windows 检出。
COPY deploy/docker/dsh-sidebar-groups.py /tmp/dsh-sidebar-groups.py
RUN DSH_SRC=/src/deepseek-harness python3 /tmp/dsh-sidebar-groups.py
# 工作卡收纳「机器人」(desk-bots) 与「资料库」(desk-hub)，并去掉左下角账号菜单
# （未登录文案 t('more') 「更多」）里的「意见反馈」。必须排在 groups 之后、
# pnpm build 之前：改的是已分组的 SidebarRoot 与 AccountMenu。
# groups 的成功检查仍认旧 except 名单，不能在本步之后重跑。
# 不改 PanelMoreMenu 的条目，不卸设置/登录/退出，不改登录 URL，不改 DSH_REF。
# 脚本要求 DSH_SRC。不打 Windows 检出。
COPY deploy/docker/dsh-sidebar-work-group-bots-vault.py /tmp/dsh-sidebar-work-group-bots-vault.py
RUN DSH_SRC=/src/deepseek-harness python3 /tmp/dsh-sidebar-work-group-bots-vault.py
# 扩展卡「导入会话」点开：导入 tab 挂在对话壳的右侧栏。主面板（插件）或
# desk 整页（机器人 / 资料库等 .ddp.fv）盖住对话壳时，点击只把 tab 打开在
# 盖层下面。本步在扩展卡 chat-import 的点击捕获里先回到对话（selectPanel(null)），
# 并派发 desk-fv 关掉整页。必须排在 work-group 之后、pnpm build 之前。
# 不改三卡归属，不改 dsh-chat-import@0.26.2，不改登录 URL，不改 DSH_REF。
# 脚本要求 DSH_SRC。不打 Windows 检出。
COPY deploy/docker/dsh-sidebar-chat-import-open.py /tmp/dsh-sidebar-chat-import-open.py
RUN DSH_SRC=/src/deepseek-harness python3 /tmp/dsh-sidebar-chat-import-open.py
# 账户卡卸掉面板「更多」（panels.more）。左侧栏与右侧栏不再出现「浏览更多插件」。
# 「创建你的插件」挂到扩展卡「插件」面板的工具条上，仍走原来的 Creator 草稿
# （cordis 预设、左侧栏提示语、不发送）。底栏账号菜单（设置 / 登录）不动。
# 必须排在 chat-import-open 之后、pnpm build 之前。不改三卡归属，不改登录 URL，
# 不改 DSH_REF，不卸 desk-auto。脚本要求 DSH_SRC。不打 Windows 检出。
# chat-import-open 的成功检查仍要求账户卡上有 PanelMoreMenu，本步之后不能重跑它。
COPY deploy/docker/dsh-sidebar-more-to-plugins.py /tmp/dsh-sidebar-more-to-plugins.py
RUN DSH_SRC=/src/deepseek-harness python3 /tmp/dsh-sidebar-more-to-plugins.py
# 新会话模式胶囊（标准 / PTC / 极简 / 创造）旁加一句：团队角色在设置 → Agent 预设。
# 不把六个角色塞进这个下拉，不改四模式文案，不改侧栏三卡。必须排在 more-to-plugins
# 之后、pnpm build 之前。脚本要求 DSH_SRC。不打 Windows 检出。
COPY deploy/docker/dsh-agent-preset-mode-hint.py /tmp/dsh-agent-preset-mode-hint.py
RUN DSH_SRC=/src/deepseek-harness python3 /tmp/dsh-agent-preset-mode-hint.py
WORKDIR /src/deepseek-harness
RUN pnpm install
RUN pnpm build
# 原生载荷（native/system）：默认构建只做 host-addon-only，*不会*产出静态 musl 的
# Landlock 启动器 bin/landlock-run（它需要 musl-tools，见上面的 apt 安装）。
# 缺它时容器内 Linux 沙箱链（bwrap → Landlock）两档运行器皆不可用 → agent 的
# bash 工具全部 fail-closed，报 "no sandbox backend is usable on this host"。
# 别删这一行；native 的完整载荷 = landlock-run + glibc/musl system.node。
RUN ./node_modules/.bin/tsx native/system/scripts/build.ts
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
# 侧栏「助理」与「技能·连接器」合并为一项「功能与连接」（Decision A）。
# 两项都是 desk-panel 的 sidebar.footer.action，不在 dsh 编译产物里。
# 因此打在镜像内 /opt/anywork 副本上（bootstrap 从这里装插件），不打 DSH_SRC，不改 DSH_REF。
# 脚本要求 ANYWORK_SRC，没有家目录默认路径。仓内未打补丁的插件源留给 Windows 检出。
RUN ANYWORK_SRC=/opt/anywork python3 /opt/anywork/deploy/docker/dsh-sidebar-assistant-skills-merge.py
# 功能与连接：角色卡「用此角色新建会话 / 设为默认」、技能短路径、Codex 双入口说明。
# Cut 2026-10-27 features-connect-use-path Decision A。必须排在 assistant-skills-merge
# 之后（assistantsLead 由那个脚本注入）。不改引擎四模式，不卸「设置 → Agent 预设」，
# 不打 DSH_SRC，不改 DSH_REF。脚本要求 ANYWORK_SRC。仓内未打补丁的 client.js 留给 Windows 检出。
RUN ANYWORK_SRC=/opt/anywork python3 /opt/anywork/deploy/docker/dsh-features-connect-use-path.py
# 侧栏并列「自动化」(desk-auto) 卸掉。外栏「自动化任务」仍是 ui-schedule 的
# sidebar.panellist id schedules，本脚本不改那个注册、不改文案、不重做面板。
# 必须排在 assistant-skills-merge 之后：那个脚本的成功检查仍要求 desk-auto 还在。
# 打在 /opt/anywork 副本上，不打 DSH_SRC，不改 DSH_REF。脚本要求 ANYWORK_SRC，
# 没有家目录默认路径。仓内未打补丁的插件源留给 Windows 检出。
RUN ANYWORK_SRC=/opt/anywork python3 /opt/anywork/deploy/docker/dsh-sidebar-automation-merge.py
# 侧栏「Bots」与「子代理」合并为一项「机器人」（Decision A）。
# 外栏留下 desk-bots，显示名改为「机器人」；不再注册 desk-agents。
# 点开后子代理控制台在正文开头作导语（介绍句 + 工作动态/定义管理），Bot 与群聊仍在同一面板。
# 必须排在 automation-merge 之后：那个脚本的成功检查仍要求 desk-agents 还在。
# 本步不改三卡 only/except（分组补丁在 dsbuild）。下一条才把 desk-bots 与 desk-hub
# 收进工作卡。不打 DSH_SRC，不改 DSH_REF，不改登录 URL。
# 脚本要求 ANYWORK_SRC，没有家目录默认路径。仓内未打补丁的插件源留给 Windows 检出。
RUN ANYWORK_SRC=/opt/anywork python3 /opt/anywork/deploy/docker/dsh-sidebar-bots-subagents-merge.py
# 外栏「团队资料」改为「资料库」（desk-hub 的 th.tab）。同一 TeamHub 面板。
# 必须排在 bots-subagents-merge 之后，打在 /opt/anywork 副本上。
# 分组已在 dsbuild、pnpm build 之前打进 SidebarRoot，这里不改 harness，不改 DSH_REF。
# 脚本要求 ANYWORK_SRC。仓内未打补丁的 client.js 仍是「团队资料」，Windows 检出不会跑到。
RUN ANYWORK_SRC=/opt/anywork python3 /opt/anywork/deploy/docker/dsh-sidebar-work-group-bots-vault.py

COPY --from=dsbuild /src/deepseek-harness /opt/deepseek-harness

ENV HOME=/data
ENV NODE_ENV=production
EXPOSE 8080
VOLUME ["/data"]
HEALTHCHECK --interval=30s --timeout=5s --start-period=90s --retries=3 \
  CMD curl -fsS http://127.0.0.1:8080/healthz || exit 1
ENTRYPOINT ["/usr/bin/tini", "--", "/opt/anywork/deploy/docker/entrypoint.sh"]
