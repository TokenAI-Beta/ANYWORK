# -*- coding: utf-8 -*-
# ANYWORK 部署补丁：让"经门户登录访问"的页面也启用 host 设置持久化
#  背景：dsh 0.1.5 的 ui-settings 按 `ctx.remote.$host.isLoopback` 二选一：
#   loopback=host 持久化（读写 settings.yaml），非 loopback=memory（不读不写）。
#  团队经门户（LAN IP）访问 → 语言/外观等设置全部不落盘、刷新即回退。
#  门户就是本部署的信任边界（登录闸门+反代），因此：门户注入
#  window.__DSH_HOST_PERSISTENCE__=true（见 src/portal.ts 的 usageWidgetTag），
#  两处消费点放行。幂等：含 __DSH_HOST_PERSISTENCE__ 即跳过。
# 升级 dsh 后需重放本脚本并重建两个 client 包（bundle）。
import io, os

ROOT = os.environ.get("DSH_SRC", os.path.expanduser("~/deepseek-harness"))

def load(rel):
    return io.open(os.path.join(ROOT, rel), encoding="utf-8").read()

def save(rel, s):
    io.open(os.path.join(ROOT, rel), "w", encoding="utf-8").write(s)

def patch(rel, old, new):
    s = load(rel)
    if "__DSH_HOST_PERSISTENCE__" in s:
        print("skip（已打）:", rel)
        return
    n = s.count(old)
    assert n == 1, (rel, "count=", n)
    save(rel, s.replace(old, new))
    print("ok:", rel)

patch(
    "packages/client/ui-settings/src/client/index.ts",
    "  const persistence = ctx.remote.$host.isLoopback ? 'host' : 'memory'",
    """  // ANYWORK 部署补丁：门户登录页也可 host 持久化（__DSH_HOST_PERSISTENCE__ 由门户注入）
  const trustHostPersistence =
    (globalThis as { __DSH_HOST_PERSISTENCE__?: boolean }).__DSH_HOST_PERSISTENCE__ === true
  const persistence = ctx.remote.$host.isLoopback || trustHostPersistence ? 'host' : 'memory'""",
)

patch(
    "packages/client/ui-settings-general/src/client/index.ts",
    """  const documentController = ctx.remote.$host.isLoopback
    ? new SettingsDocumentStore(ctx, ctx.settingsScope.describe())
    : undefined""",
    """  // ANYWORK 部署补丁：同 ui-settings（门户访问按可信处理）
  const trustHostPersistence =
    (globalThis as { __DSH_HOST_PERSISTENCE__?: boolean }).__DSH_HOST_PERSISTENCE__ === true
  const documentController = ctx.remote.$host.isLoopback || trustHostPersistence
    ? new SettingsDocumentStore(ctx, ctx.settingsScope.describe())
    : undefined""",
)

print("补丁完成；记得重建：dsh-client-ui-settings / dsh-client-ui-settings-general")
