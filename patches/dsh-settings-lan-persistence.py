# -*- coding: utf-8 -*-
# ANYWORK 部署补丁：让「经门户登录访问」的页面也启用 host 设置持久化。
#  门户注入 window.__DSH_HOST_PERSISTENCE__=true（src/portal.ts 的 usageWidgetTag）。
#  幂等：文件里已有该标记则跳过。
#
#  0.1.5-rc.2：两处锚点
#    - ui-settings：loopback ? 'host' : 'memory'
#    - ui-settings-general：SettingsDocumentStore(..., ctx.settingsScope.describe())
#  0.2.1-rc.3：ui-settings 的 host/memory 开关已删除（已登录浏览器走 config forms，
#    见该包 README「authenticated browser」）。仍按 loopback 二选一的只剩
#    ui-settings-general，且 describe() 改为 ctx.configForms.describe()。
#    本脚本按锚点择一；0.2 上 ui-settings 无锚点则跳过，general 必须打上。
import io, os, sys

ROOT = os.environ.get("DSH_SRC", os.path.expanduser("~/deepseek-harness"))

def load(rel):
    return io.open(os.path.join(ROOT, rel), encoding="utf-8").read()

def save(rel, s):
    io.open(os.path.join(ROOT, rel), "w", encoding="utf-8").write(s)

def patch_any(rel, alternatives):
    """alternatives: [(old, new), ...]，命中且恰好一处才替换。"""
    path = os.path.join(ROOT, rel)
    if not os.path.isfile(path):
        print("skip（文件不存在）:", rel)
        return "missing"
    s = load(rel)
    if "__DSH_HOST_PERSISTENCE__" in s:
        print("skip（已打）:", rel)
        return "patched"
    for old, new in alternatives:
        n = s.count(old)
        if n == 1:
            save(rel, s.replace(old, new, 1))
            print("ok:", rel)
            return "patched"
        if n > 1:
            raise SystemExit("锚点重复 %s count=%d" % (rel, n))
    print("skip（本版本无此锚点）:", rel)
    return "skipped"

TRUST = """  // ANYWORK 部署补丁：门户登录页也可 host 持久化（__DSH_HOST_PERSISTENCE__ 由门户注入）
  const trustHostPersistence =
    (globalThis as { __DSH_HOST_PERSISTENCE__?: boolean }).__DSH_HOST_PERSISTENCE__ === true
"""

patch_any(
    "packages/client/ui-settings/src/client/index.ts",
    [(
        "  const persistence = ctx.remote.$host.isLoopback ? 'host' : 'memory'",
        TRUST + "  const persistence = ctx.remote.$host.isLoopback || trustHostPersistence ? 'host' : 'memory'",
    )],
)

general = patch_any(
    "packages/client/ui-settings-general/src/client/index.ts",
    [
        (
            """  const documentController = ctx.remote.$host.isLoopback
    ? new SettingsDocumentStore(ctx, ctx.settingsScope.describe())
    : undefined""",
            TRUST + """  const documentController = ctx.remote.$host.isLoopback || trustHostPersistence
    ? new SettingsDocumentStore(ctx, ctx.settingsScope.describe())
    : undefined""",
        ),
        (
            """  const documentController = ctx.remote.$host.isLoopback
    ? new SettingsDocumentStore(ctx, ctx.configForms.describe())
    : undefined""",
            TRUST + """  const documentController = ctx.remote.$host.isLoopback || trustHostPersistence
    ? new SettingsDocumentStore(ctx, ctx.configForms.describe())
    : undefined""",
        ),
    ],
)

if general != "patched":
    sys.exit("ui-settings-general 未打上 host 持久化（0.2.1-rc.3 应命中 configForms 锚点）")

print("补丁完成；记得重建受影响的 client 包（bundle）")
