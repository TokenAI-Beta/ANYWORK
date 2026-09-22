#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""aqua（玻璃主题 fork）在 dsh 0.1.5+ 的启动报错修复。

症状：浏览器 console 报
    Uncaught Error: keyed slot "settings.plugin.item" requires options.key
原因：dsh 0.1.5 起 `settings.plugin.item` 是 keyed slot（key = 卡片编辑的设置命名空间），
      aqua 1.3.1 的注册只带 id 没带 key。
修法：给 `settings.plugin.item` 的注册补 `key: "ui-aqua"`（aqua 的设置命名空间）。

用法：
    1) 修实例（默认扫 ~/desk-test/u*/profiles/web/node_modules/dsh-client-ui-aqua/lib/client.js）
       python3 patches/aqua-plugin-card-key.py
    2) 顺带修发行包副本（~/.opt/... 的 tgz 解包目录 + 重打 tgz）——如需要，改下方 VET 路径。
幂等：已含 key 的文件跳过。升级/重装 aqua 后需重跑。
"""
import glob
import io
import os
import subprocess

OLD = """\t\t\tctx.slots.inject("settings.plugin.item", () => ctx.slots.register({
\t\t\t\tname: "settings.plugin.item",
\t\t\t\tid: "aqua",
\t\t\t\torder: 5,"""
NEW = """\t\t\tctx.slots.inject("settings.plugin.item", () => ctx.slots.register({
\t\t\t\tname: "settings.plugin.item",
\t\t\t\tid: "aqua",
\t\t\t\tkey: "ui-aqua",
\t\t\t\torder: 5,"""

VET = os.path.expanduser("~/opt/thirdparty/aqua-vet")

def fix_file(path: str) -> str:
    s = io.open(path, encoding="utf-8").read()
    if 'key: "ui-aqua"' in s:
        return "skip(已打)"
    n = s.count(OLD)
    if n != 1:
        return "SKIP(上下文不匹配 count=%d，版本可能已变，人工检查)" % n
    io.open(path, "w", encoding="utf-8").write(s.replace(OLD, NEW))
    return "ok"

def main() -> None:
    targets = sorted(glob.glob(os.path.expanduser(
        "~/desk-test/u*/profiles/web/node_modules/dsh-client-ui-aqua/lib/client.js")))
    pkg = os.path.join(VET, "package/lib/client.js")
    if os.path.exists(pkg):
        targets.append(pkg)
    for t in targets:
        print(fix_file(t), t)
    tgz = os.path.join(VET, "dsh-client-ui-aqua-1.3.1.tgz")
    if os.path.exists(tgz) and os.path.exists(pkg):
        r = subprocess.run(
            ["bash", "-lc",
             "cd %s && cp -n %s %s.orig 2>/dev/null; "
             "rm -rf /tmp/aqua-pack && mkdir -p /tmp/aqua-pack && cp -r package /tmp/aqua-pack/ && "
             "tar -czf /tmp/aqua-pack/out.tgz -C /tmp/aqua-pack package && "
             "cp /tmp/aqua-pack/out.tgz %s"
             % (VET, os.path.basename(tgz), os.path.basename(tgz), os.path.basename(tgz))],
            capture_output=True, text=True)
        print("tgz 重打包:", r.returncode)
    print("完成。实例端无需重启（客户端包按页加载）；浏览器硬刷一次即可看到报错消失。")

if __name__ == "__main__":
    main()
