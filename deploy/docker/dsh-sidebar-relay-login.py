# -*- coding: utf-8 -*-
"""Docker image only: sidebar 「登录」 opens the relay password page.

The entry is the signed-out item in upstream
packages/client/ui-settings-account/src/client/AccountMenu.tsx
(settings.launcher → AccountMenu, locale signIn = 「登录」).
On dsh-v0.2.1-rc.3 that item calls beginSignIn() → start() →
remote.account.startSignIn, which is the DeepSeek account browser login.

This patch keeps the same menu item and drops that call. The click opens
https://app.cntokenai.top/login in a new tab. The relay /console is the
success state; this session does not wait for a return.

Invoked only from deploy/docker/Dockerfile with
DSH_SRC=/src/deepseek-harness (the clone inside the image build).
DSH_SRC is required. There is no home-directory default, so the script
cannot land on a native install.
"""
import io
import os
import sys

MARKER = "https://app.cntokenai.top/login"
REL = "packages/client/ui-settings-account/src/client/AccountMenu.tsx"
OLD = (
    "  // The plugin's start publishes `loginFailed` before it rejects, so the dialog owns the report.\n"
    "  const beginSignIn = (): void => { setOpen(false); void start().catch(() => undefined) }"
)
NEW = (
    "  // ANYWORK Docker image (cut 2026-10-26 sidebar-relay-login): this sidebar\n"
    "  // item opens the relay password login and does not call DeepSeek account start().\n"
    "  // Success is the relay /console; this session does not wait for a return.\n"
    "  const beginSignIn = (): void => {\n"
    "    setOpen(false)\n"
    "    window.open('https://app.cntokenai.top/login', '_blank', 'noopener,noreferrer')\n"
    "  }"
)
SIGNIN_SELECT = "else if (id === 'signin') beginSignIn()"


def main():
    root = os.environ.get("DSH_SRC", "").strip()
    if not root:
        sys.exit(
            "DSH_SRC is required. Docker image build sets it to the clone inside the image. "
            "This patch does not target a native install."
        )
    path = os.path.join(root, REL)
    if not os.path.isfile(path):
        sys.exit("missing %s" % path)
    text = io.open(path, encoding="utf-8").read()
    if MARKER in text:
        if "window.open('%s'" % MARKER not in text:
            sys.exit("marker present but sidebar open() is missing: %s" % REL)
        if SIGNIN_SELECT not in text:
            sys.exit("signin menu item no longer calls beginSignIn: %s" % REL)
        print("skip（已打）:", REL)
        return
    count = text.count(OLD)
    if count != 1:
        sys.exit("anchor count=%d in %s (expect 1)" % (count, REL))
    if SIGNIN_SELECT not in text:
        sys.exit("signin menu item does not call beginSignIn: %s" % REL)
    updated = text.replace(OLD, NEW, 1)
    if "void start()" in updated.split("const beginSignIn", 1)[1].split("return <div", 1)[0]:
        sys.exit("beginSignIn still calls start()")
    io.open(path, "w", encoding="utf-8").write(updated)
    print("ok:", REL)


if __name__ == "__main__":
    main()
