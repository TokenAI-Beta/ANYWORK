# -*- coding: utf-8 -*-
# ANYWORK-ToKenAI 品牌补丁（改的是 dsh 检出源码；升级 dsh 后重放本脚本）
#   1. locale zh/en: brand.localBuild -> "ANYWORK-ToKenAI"
#   2. ui-conversation locales: hero.headline -> "ANYWORK-ToKenAI"（zh/en）；删除 hero.preview
#   3. EmptyHero.tsx: 删除「预览版」徽章 span
# 幂等：已含 ANYWORK-ToKenAI / 已无 hero.preview 的项自动跳过。
import io, os

ROOT = os.environ.get("DSH_SRC", os.path.expanduser("~/deepseek-harness"))

def load(rel):
    return io.open(os.path.join(ROOT, rel), encoding="utf-8").read()

def save(rel, s):
    io.open(os.path.join(ROOT, rel), "w", encoding="utf-8").write(s)

def rep(rel, pairs, marker):
    s = load(rel)
    if marker is not None and marker in s:
        print("skip（已打）:", rel)
        return
    for old, new, cnt in pairs:
        n = s.count(old)
        assert n == cnt, (rel, "count=", n, "expect", cnt, "|", old[:60])
        s = s.replace(old, new)
    save(rel, s)
    print("ok:", rel)

rep("packages/client/locale/src/locales/zh.ts",
    [("'brand.localBuild': 'DSH 本地构建'", "'brand.localBuild': 'ANYWORK-ToKenAI'", 1)],
    "ANYWORK-ToKenAI")

rep("packages/client/locale/src/locales/en.ts",
    [("'brand.localBuild': 'DSH Local Build'", "'brand.localBuild': 'ANYWORK-ToKenAI'", 1)],
    "ANYWORK-ToKenAI")

rep("packages/client/ui-conversation/src/client/locales.ts",
    [("  'hero.headline': '探索未至之境',\n  'hero.preview': '预览版',",
      "  'hero.headline': 'ANYWORK-ToKenAI',", 1),
     ("  'hero.headline': 'Into the Unknown',\n  'hero.preview': 'Preview',",
      "  'hero.headline': 'ANYWORK-ToKenAI',", 1)],
    "ANYWORK-ToKenAI")

# EmptyHero：幂等判定 = 已无 hero.preview 引用
rel = "packages/client/ui-conversation/src/client/skeleton/EmptyHero.tsx"
s = load(rel)
if "hero.preview" not in s:
    print("skip（已打）:", rel)
else:
    old = ("            <span>{t('hero.headline')}</span>\n"
           "            <span className={css.previewBadge}>{t('hero.preview')}</span>")
    n = s.count(old)
    assert n == 1, (rel, "count=", n)
    save(rel, s.replace(old, "            <span>{t('hero.headline')}</span>"))
    print("ok:", rel)

print("品牌补丁完成")
