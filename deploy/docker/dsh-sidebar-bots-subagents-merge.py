# -*- coding: utf-8 -*-
"""Docker image only: merge sidebar 「Bots」 and 「子代理」.

Decision A (cut 2026-10-26 bots-subagents-merge). On dsh-v0.2.1-rc.3 the
two outer entries are plugin/desk-panel sidebar.footer.action registrations,
not harness UI:

    id desk-agents   order 89  label agt.tab  「子代理」  panel AgentsPanel
    id desk-bots     order 90  label "Bots"   「Bots」    panel BotsPanel

This patch keeps desk-bots as the one outer entry and renames its display
to 「机器人」. It stops registering desk-agents. Opening 「机器人」 still
mounts BotsPanel (bot list, rooms, bot-chat). The former subagent console
is an in-panel lead-in above that body: the existing agt.sub sentence,
then AgentsPanel in embedded mode (工作动态 / 定义管理, same fetches).
Embedded mode does not paint a sidebar button and does not open a second
full-page shell, so useFvSync on the bots panel is left alone.

Run this after dsh-sidebar-automation-merge.py. That script's success
check still expects id desk-agents, and assistant-skills-merge expects
it too. Neither of those scripts edits the anchors below.

This patch does not edit the harness sidebar shell, the three-card
only/except lists, or the harness clone. desk-bots is not one of the
card only ids, so the renamed entry stays in the except outlet under
the cards. Dropping desk-agents only removes one occupant of that outlet.

The file is not part of the harness pnpm build. The image copies the repo
to /opt/anywork and bootstrap installs plugin/desk-panel from there, so
this script runs against that copy (ANYWORK_SRC). It does not edit the
harness clone and it has no home-directory default, so a Windows checkout
of the plugin is left alone unless this image build runs.

ANYWORK_SRC is required.
"""
import io
import os
import sys

MARKER = "cut 2026-10-26 bots-subagents-merge"
REL = "plugin/desk-panel/lib/client.js"

OLD_ZH = '      "bts.sub": "团队共用的常驻 Bot 与群聊：定义在共享区，聊天各自独立",'
NEW_ZH = """      "bts.sub": "团队共用的常驻 Bot 与群聊：定义在共享区，聊天各自独立",
      "bts.tab": "机器人",
      "bot.lead": "子代理","""

OLD_EN = '      "bts.sub": "Shared standing bots and group chats: definitions live in the shared area, chats stay per member",'
NEW_EN = """      "bts.sub": "Shared standing bots and group chats: definitions live in the shared area, chats stay per member",
      "bts.tab": "Robots",
      "bot.lead": "Subagents","""

OLD_OPEN = """    function AgentsPanel(props) {
      var wide = !!(props && props.wide);
      var openPair = React.useState(false);
      var open = openPair[0];
      var setOpen = openPair[1];
      useFvSync(open, setOpen);"""
NEW_OPEN = """    function AgentsPanel(props) {
      var wide = !!(props && props.wide);
      var embedded = !!(props && props.embedded);
      var openPair = React.useState(false);
      var open = openPair[0];
      var setOpen = openPair[1];
      useFvSync(embedded ? false : open, setOpen);"""

OLD_EFFECT = """      React.useEffect(function () { load(); }, []);
      React.useEffect(function () {
        if (!open) return;
        loadModels();
      }, [open]);
      var hasRunNow = anyRunning();
      React.useEffect(function () {
        if (!open || st.tab !== "runs") return;
        loadRuns();
        var iv = setInterval(loadRuns, hasRunNow ? 8000 : 30000);
        return function () { clearInterval(iv); };
      }, [open, st.tab, hasRunNow]);
      React.useEffect(function () {
        if (!open || st.tab !== "runs" || !hasRunNow) return;
        var tick = setInterval(function () { pset({ tickN: (st.tickN || 0) + 1 }); }, 1000);
        return function () { clearInterval(tick); };
      }, [open, st.tab, hasRunNow]);"""
NEW_EFFECT = """      React.useEffect(function () { load(); }, []);
      React.useEffect(function () {
        if (!embedded && !open) return;
        loadModels();
      }, [embedded, open]);
      var hasRunNow = anyRunning();
      React.useEffect(function () {
        if (!(embedded || open) || st.tab !== "runs") return;
        loadRuns();
        var iv = setInterval(loadRuns, hasRunNow ? 8000 : 30000);
        return function () { clearInterval(iv); };
      }, [embedded, open, st.tab, hasRunNow]);
      React.useEffect(function () {
        if (!(embedded || open) || st.tab !== "runs" || !hasRunNow) return;
        var tick = setInterval(function () { pset({ tickN: (st.tickN || 0) + 1 }); }, 1000);
        return function () { clearInterval(tick); };
      }, [embedded, open, st.tab, hasRunNow]);"""

OLD_TRIGGER = """      var trigger = h("button", { className: "ddb" + (wide ? "" : " rail") + (open ? " on" : ""), onClick: toggle, title: tr("agt.title") },
        h("span", { className: "ic" }, dicon("bots", 15)),
        wide ? h("span", { className: "lbl" }, tr("agt.tab")) : null
      );
      if (!open) return h("div", null, trigger);"""
NEW_TRIGGER = """      var trigger = h("button", { className: "ddb" + (wide ? "" : " rail") + (open ? " on" : ""), onClick: toggle, title: tr("agt.title") },
        h("span", { className: "ic" }, dicon("bots", 15)),
        wide ? h("span", { className: "lbl" }, tr("agt.tab")) : null
      );
      if (!embedded && !open) return h("div", null, trigger);"""

OLD_RETURN = """      return h("div", null, trigger, h("div", { key: "panel", className: "ddp fv" },
        h("div", { className: "hd" },
          h("span", { className: "ico" }, dicon("bots", 22)),
          h("div", { style: { flex: 1, minWidth: 0 } },
            h("div", { className: "t1" }, tr("agt.title")),
            h("div", { className: "t2" }, tr("agt.sub"))
          ),
          h("button", { className: "x", onClick: function () { setOpen(false); } }, "← " + tr("fv.back"))
        ),
        h("div", { className: "bd" }, kids)
      ));
    }"""
NEW_RETURN = """      if (embedded) return h("div", { className: "bot-agents" }, kids);
      return h("div", null, trigger, h("div", { key: "panel", className: "ddp fv" },
        h("div", { className: "hd" },
          h("span", { className: "ico" }, dicon("bots", 22)),
          h("div", { style: { flex: 1, minWidth: 0 } },
            h("div", { className: "t1" }, tr("agt.title")),
            h("div", { className: "t2" }, tr("agt.sub"))
          ),
          h("button", { className: "x", onClick: function () { setOpen(false); } }, "← " + tr("fv.back"))
        ),
        h("div", { className: "bd" }, kids)
      ));
    }"""

OLD_BOT_BTN = """      var trigger = h("button", { className: "ddb" + (wide ? "" : " rail") + (open ? " on" : ""), onClick: toggle, title: "Bots", "data-desk": "bots" },
        h("span", { className: "ic" }, dicon("bots", 15)),
        wide ? h("span", { className: "lbl" }, "Bots") : null
      );"""
NEW_BOT_BTN = """      var trigger = h("button", { className: "ddb" + (wide ? "" : " rail") + (open ? " on" : ""), onClick: toggle, title: tr("bts.tab"), "data-desk": "bots" },
        h("span", { className: "ic" }, dicon("bots", 15)),
        wide ? h("span", { className: "lbl" }, tr("bts.tab")) : null
      );"""

OLD_BOT_TITLE = '            h("div", { className: "t1" }, "Bots"),'
NEW_BOT_TITLE = '            h("div", { className: "t1" }, tr("bts.tab")),'

OLD_BODY = """      var bodyKids = [];
      if (st.msg) bodyKids.push(h("div", { key: "toast", className: "bts-toast" + (st.msg.kind === "err" ? " err" : "") }, st.msg.text));"""
NEW_BODY = """      var bodyKids = [];
      agentsLead(wide).forEach(function (node) { bodyKids.push(node); });
      if (st.msg) bodyKids.push(h("div", { key: "toast", className: "bts-toast" + (st.msg.kind === "err" ? " err" : "") }, st.msg.text));"""

OLD_REG = """      ctx.slots.inject("sidebar.footer.action", function () {
        return ctx.slots.register(
          {
            name: "sidebar.footer.action",
            id: "desk-agents",
            order: 89,
            label: function () {
              return tr("agt.tab");
            },
          },
          AgentsPanel
        );
      });
"""
NEW_REG = """      // ANYWORK Docker image (cut 2026-10-26 bots-subagents-merge):
      // desk-agents is not a sidebar entry. 「机器人」 is desk-bots.
"""

OLD_LABEL = """            label: function () {
              return "Bots";
            },"""
NEW_LABEL = """            label: function () {
              return tr("bts.tab");
            },"""

LEAD_FN = """    // ANYWORK Docker image (cut 2026-10-26 bots-subagents-merge):
    // former 「子代理」 console, as the lead-in above bots and rooms.
    function agentsLead(wide) {
      return [
        h("div", { key: "bot-lead", className: "lb" }, tr("bot.lead")),
        h("div", { key: "bot-sub", className: "ft" }, tr("agt.sub")),
        h(AgentsPanel, { key: "bot-agents", wide: wide, embedded: true })
      ];
    }

"""

REPLACEMENTS = (
    (OLD_ZH, NEW_ZH),
    (OLD_EN, NEW_EN),
    (OLD_OPEN, NEW_OPEN),
    (OLD_EFFECT, NEW_EFFECT),
    (OLD_TRIGGER, NEW_TRIGGER),
    (OLD_RETURN, NEW_RETURN),
    (OLD_BOT_BTN, NEW_BOT_BTN),
    (OLD_BOT_TITLE, NEW_BOT_TITLE),
    (OLD_BODY, NEW_BODY),
    (OLD_REG, NEW_REG),
    (OLD_LABEL, NEW_LABEL),
)

KEEP_IDS = (
    "desk-skills-conn",
    "desk-announce",
    "desk-bots",
    "desk-hub",
    "desk-usage",
)

FETCHES = (
    "/portal/api/panel/agents",
    "/portal/api/panel/agent-runs",
    "/portal/api/panel/bots",
    "/portal/api/panel/bot-chat",
    "/portal/api/panel/room",
)


def merged_ok(text):
    if MARKER not in text:
        return False
    if 'id: "desk-agents"' in text:
        return False
    if text.count('id: "desk-bots"') != 1:
        return False
    if text.count('"bts.tab": "机器人"') != 1:
        return False
    if text.count('"bts.tab": "Robots"') != 1:
        return False
    if text.count('"bot.lead": "子代理"') != 1:
        return False
    if text.count('"bot.lead": "Subagents"') != 1:
        return False
    if 'return "Bots"' in text or 'title: "Bots"' in text:
        return False
    if 'return tr("agt.tab")' in text:
        return False
    if text.count('return tr("bts.tab")') != 1:
        return False
    if "function agentsLead(" not in text:
        return False
    if "agentsLead(wide).forEach" not in text:
        return False
    if "function AgentsPanel(" not in text or "function BotsPanel(" not in text:
        return False
    if text.count("embedded: true") != 1:
        return False
    if 'if (embedded) return h("div", { className: "bot-agents" }, kids);' not in text:
        return False
    if 'if (!embedded && !open) return h("div", null, trigger);' not in text:
        return False
    if 'tr("agt.sub")' not in text or 'tr("bot.lead")' not in text:
        return False
    if 'tr("agt.tabRuns")' not in text or 'tr("agt.tabDefs")' not in text:
        return False
    if '"BOTS"' not in text or 'tr("bts.secRooms")' not in text:
        return False
    for path in FETCHES:
        if path not in text:
            return False
    for sid in KEEP_IDS:
        if ('id: "%s"' % sid) not in text:
            return False
    # desk-usage is also a settings section and a header chip. The sidebar
    # registration is the one footer entry; the others are not outer nav.
    if text.count('id: "desk-skills-conn"') != 1:
        return False
    if any(line.strip() == "AgentsPanel" for line in text.splitlines()):
        return False
    bots_fn = text.find("function BotsPanel(")
    guard = text.find('if (!open) return h("div", null, trigger);', bots_fn)
    call = text.find("agentsLead(wide).forEach", bots_fn)
    wrap = text.find('className: "bts-wrap"', bots_fn)
    if bots_fn < 0 or guard < 0 or call < 0 or wrap < 0:
        return False
    if not (bots_fn < guard < call < wrap):
        return False
    reg = text.find('id: "desk-bots"')
    window = text[reg:reg + 400]
    if 'return tr("bts.tab")' not in window or "BotsPanel" not in window:
        return False
    if "AgentsPanel" in window:
        return False
    return True


def apply_all(text):
    updated = text
    if "function agentsLead(" not in updated:
        needle = "    function BotsPanel(props) {"
        count = updated.count(needle)
        if count != 1:
            sys.exit("anchor count=%d for BotsPanel (expect 1)" % count)
        updated = updated.replace(needle, LEAD_FN + needle, 1)
    for old, new in REPLACEMENTS:
        count = updated.count(old)
        if count != 1:
            sys.exit("anchor count=%d (expect 1) for: %s" % (count, old.splitlines()[0].strip()[:80]))
        updated = updated.replace(old, new, 1)
    return updated


def main():
    root = os.environ.get("ANYWORK_SRC", "").strip()
    if not root:
        sys.exit(
            "ANYWORK_SRC is required. Docker image build sets it to /opt/anywork. "
            "This patch does not target a native install."
        )
    path = os.path.join(root, REL)
    if not os.path.isfile(path):
        sys.exit("missing %s" % path)
    text = io.open(path, encoding="utf-8").read()
    if MARKER in text:
        if not merged_ok(text):
            sys.exit("marker present but bots/subagents merge is wrong: %s" % REL)
        print("skip（已打）:", REL)
        return
    updated = apply_all(text)
    if not merged_ok(updated):
        sys.exit("patched bots/subagents merge is wrong: %s" % REL)
    io.open(path, "w", encoding="utf-8").write(updated)
    print("ok:", REL)


if __name__ == "__main__":
    main()
