#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""dsh-anywork 微信（iLink）成员接入工具
用法: python zz-weixin-bind.py <成员名> [--timeout 秒数]
流程: 生成成员二维码(PNG) → 成员用微信扫码并确认 → 自动保存绑定凭据
产物:
  zz-wx-qr-<成员名>.png     二维码图片（发给成员扫）
  zz-wx-bind-<成员名>.json  绑定凭据 {account_id, token, base_url, user_id}（600 权限，勿外传）
"""
import json
import os
import sys
import time
import urllib.request

BASE = "https://ilinkai.weixin.qq.com"
STAGE = os.path.dirname(os.path.abspath(__file__))


def get(url):
    req = urllib.request.Request(url, headers={"User-Agent": "dsh-anywork-bind/1.0"})
    with urllib.request.urlopen(req, timeout=15) as r:
        return json.loads(r.read().decode("utf-8"))


def fetch_qr():
    j = get(BASE + "/ilink/bot/get_bot_qrcode?bot_type=3")
    if j.get("ret") not in (0, None) or not j.get("qrcode"):
        raise SystemExit("取码失败: %s" % j)
    return j["qrcode"], j["qrcode_img_content"]


def render(text, path):
    import qrcode
    img = qrcode.make(text)
    img.save(path)


def poll(qr, host):
    if host == "ilinkai.weixin.qq.com":
        url = BASE + "/ilink/bot/get_qrcode_status?qrcode=" + qr
    else:
        url = "https://%s/ilink/bot/get_qrcode_status?qrcode=%s" % (host, qr)
    return get(url)


def main():
    name = sys.argv[1] if len(sys.argv) > 1 and not sys.argv[1].startswith("--") else "member"
    timeout = 300
    if "--timeout" in sys.argv:
        timeout = int(sys.argv[sys.argv.index("--timeout") + 1])
    qr, content = fetch_qr()
    png = os.path.join(STAGE, "zz-wx-qr-%s.png" % name)
    render(content, png)
    print("QR-PNG: %s" % png)
    print("QR-URL: %s" % content)
    print("请把 PNG 发给【%s】，让其用微信扫码并在微信里点【确认】。轮询中…（最多 %ds）" % (name, timeout))
    host = "ilinkai.weixin.qq.com"
    t0 = time.time()
    last = None
    refreshes = 0
    while time.time() - t0 < timeout:
        try:
            j = poll(qr, host)
        except Exception as e:
            print("poll 异常（忽略继续）: %s" % e)
            time.sleep(2)
            continue
        st = j.get("status")
        if st != last:
            extra = (" redirect_host=%s" % j.get("redirect_host")) if st == "scaned_but_redirect" else ""
            print("[%s] status: %s%s" % (time.strftime("%H:%M:%S"), st, extra))
            last = st
        if st == "scaned_but_redirect" and j.get("redirect_host"):
            host = j["redirect_host"]
        elif st == "confirmed":
            acct = j.get("ilink_bot_id")
            tok = j.get("bot_token")
            base = j.get("baseurl") or BASE
            uid = j.get("ilink_user_id")
            out = os.path.join(STAGE, "zz-wx-bind-%s.json" % name)
            with open(out, "w", encoding="utf-8") as f:
                json.dump({"name": name, "account_id": acct, "token": tok, "base_url": base, "user_id": uid, "ts": time.strftime("%Y-%m-%d %H:%M:%S")}, f)
            try:
                os.chmod(out, 0o600)
            except OSError:
                pass
            print("CONFIRMED: 已保存 %s" % out)
            print("account_id 尾4: ...%s | user_id: %s | base: %s" % (str(acct)[-4:], uid, base))
            return
        elif st == "expired":
            if refreshes < 2:
                refreshes += 1
                qr, content = fetch_qr()
                render(content, png)
                print("已刷新二维码（第%d次）: %s" % (refreshes, png))
            else:
                print("二维码过期且刷新次数用尽，请重跑。")
                return
        time.sleep(2)
    print("等待超时。")


if __name__ == "__main__":
    main()
