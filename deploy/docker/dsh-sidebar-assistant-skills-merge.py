# -*- coding: utf-8 -*-
"""Docker image only: merge sidebar 「助理」 and 「技能·连接器」.

Decision A (cut 2026-10-26 assistant-skills-merge). On dsh-v0.2.1-rc.3 the
two outer entries are plugin/desk-panel sidebar.footer.action registrations,
not harness UI:

    id desk-assistants   order 86  label asst.tab  「助理」
    id desk-skills-conn  order 87  label skl.tab   「技能·连接器」

This patch drops the assistants registration and renames the skills entry
to 「功能与连接」. Opening it still mounts SkillsConnPanel: skills and
connectors stay the body (the existing 技能 / 连接器 tabs). The former
assistants preset gallery is an in-panel lead-in above that body, not a
second outer item and not an intro tab.

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

MARKER = "cut 2026-10-26 assistant-skills-merge"
REL = "plugin/desk-panel/lib/client.js"

OLD_ZH = """      "skl.title": "专家技能库 + 连接器状态",
      "skl.tab": "技能·连接器","""
NEW_ZH = """      "skl.title": "功能与连接",
      "skl.tab": "功能与连接",
      "fn.lead": "功能介绍","""

OLD_ZH_SHORT = '      "skl.titleShort": "专家技能 · 连接器",'
NEW_ZH_SHORT = '      "skl.titleShort": "功能与连接",'

OLD_EN = """      "skl.title": "Skill library + connector status",
      "skl.tab": "Skills & connectors","""
NEW_EN = """      "skl.title": "Features & connectors",
      "skl.tab": "Features & connectors",
      "fn.lead": "Feature intro","""

OLD_EN_SHORT = '      "skl.titleShort": "Expert skills · connectors",'
NEW_EN_SHORT = '      "skl.titleShort": "Features & connectors",'

OLD_STATE = """      var dPair = React.useState({ phase: "none", id: "", name: "", content: "" });
      var langTick = useLocaleSignal();
      var det = dPair[0];"""
NEW_STATE = """      var dPair = React.useState({ phase: "none", id: "", name: "", content: "" });
      var langTick = useLocaleSignal();
      var asPair = React.useState({ phase: "loading", presets: [] });
      var asst = asPair[0];
      var setAsst = asPair[1];
      var det = dPair[0];"""

OLD_EFFECT = """          .catch(function () {
            setSt({ phase: "error", skills: [], items: [], platforms: [], role: "member" });
          });
      }
      React.useEffect(function () {
        load();
      }, [langTick]);"""
NEW_EFFECT = """          .catch(function () {
            setSt({ phase: "error", skills: [], items: [], platforms: [], role: "member" });
          });
      }
      function loadAssist() {
        fetch("/portal/api/panel/presets", { headers: { accept: "application/json" } })
          .then(function (r) {
            if (!r.ok) throw new Error("HTTP " + r.status);
            return r.json();
          })
          .then(function (d) {
            setAsst({ phase: "ready", presets: (d && d.presets) || [] });
          })
          .catch(function () {
            setAsst({ phase: "error", presets: [] });
          });
      }
      React.useEffect(function () {
        load();
        loadAssist();
      }, [langTick]);"""

OLD_KIDS = """        wide ? h("span", { className: "lbl" }, tr("skl.tab")) : null
      );
      if (!open) return h("div", null, trigger);

      var kids = [];
      kids.push(
        h(
          "div",
          { key: "tabs", className: "tabs" },
          h(
            "button",
            {
              className: "tb" + (tab === "skills" ? " on" : ""),"""
NEW_KIDS = """        wide ? h("span", { className: "lbl" }, tr("skl.tab")) : null
      );
      if (!open) return h("div", null, trigger);

      var kids = [];
      assistantsLead(asst).forEach(function (node) { kids.push(node); });
      kids.push(
        h(
          "div",
          { key: "tabs", className: "tabs" },
          h(
            "button",
            {
              className: "tb" + (tab === "skills" ? " on" : ""),"""

OLD_REG = """      ctx.slots.inject("sidebar.footer.action", function () {
        return ctx.slots.register(
          {
            name: "sidebar.footer.action",
            id: "desk-assistants",
            order: 86,
            label: function () {
              return tr("asst.tab");
            },
          },
          AssistantsPanel
        );
      });
"""
NEW_REG = """      // ANYWORK Docker image (cut 2026-10-26 assistant-skills-merge):
      // desk-assistants is not a sidebar entry. 「功能与连接」 is desk-skills-conn.
"""

LEAD_FN = """    // ANYWORK Docker image (cut 2026-10-26 assistant-skills-merge):
    // former 「助理」 preset gallery, as the lead-in above skills/connectors.
    function assistantsLead(st) {
      var nodes = [];
      nodes.push(h("div", { key: "fn-lead", className: "lb" }, tr("fn.lead")));
      if (!st || st.phase === "loading") {
        nodes.push(h("div", { key: "fn-ld", className: "empty" }, tr("common.loading")));
        return nodes;
      }
      if (st.phase === "error") {
        nodes.push(h("div", { key: "fn-er", className: "empty" }, tr("asst.failHint")));
        return nodes;
      }
      var presets = (st && st.presets) || [];
      if (!presets.length) {
        nodes.push(h("div", { key: "fn-none", className: "empty" }, tr("asst.empty")));
      } else {
        var team = [];
        var builtin = [];
        presets.forEach(function (p) { (p.trust === "system" ? builtin : team).push(p); });
        if (team.length) {
          nodes.push(h("div", { key: "fn-lb-t", className: "lb" }, tr("asst.groupTeam")));
          nodes.push(h("div", { key: "fn-cards", className: "rolegrid" }, team.map(function (p) {
            return h("div", { key: "fnp" + p.id, className: "rolecard" },
              h("div", { className: "rc-top" },
                h("span", { className: "rc-ico" }, dicon(roleIcon(p.id), 16)),
                h("span", { className: "rc-name" }, p.name),
                p.defaultHint ? h("span", { className: "bdg" }, tr("asst.defaultTag")) : null,
                p.codex ? h("span", { className: "bdg" }, tr("asst.codex")) : null
              ),
              h("div", { className: "rc-d" }, p.description || p.id)
            );
          })));
        }
        if (builtin.length) {
          nodes.push(h("div", { key: "fn-lb-b", className: "lb" }, tr("asst.groupBuiltin")));
          nodes.push(h("div", { key: "fn-brows", className: "list" }, builtin.map(function (p) {
            return h("div", { key: "fnb" + p.id, className: "it" },
              h("span", { className: "ico2" }, dicon(roleIcon(p.id), 15)),
              h("div", { className: "gr" },
                h("div", { className: "th" }, h("span", { className: "t" }, p.name), h("span", { className: "tag" }, tr("asst.builtinTag"))),
                h("div", { className: "d" }, p.description || p.id)
              )
            );
          })));
        }
      }
      nodes.push(h("div", { key: "fn-tip", className: "ft" }, tr("asst.note")));
      return nodes;
    }

"""

REPLACEMENTS = (
    (OLD_ZH, NEW_ZH),
    (OLD_ZH_SHORT, NEW_ZH_SHORT),
    (OLD_EN, NEW_EN),
    (OLD_EN_SHORT, NEW_EN_SHORT),
    (OLD_STATE, NEW_STATE),
    (OLD_EFFECT, NEW_EFFECT),
    (OLD_KIDS, NEW_KIDS),
    (OLD_REG, NEW_REG),
)


def merged_ok(text):
    if MARKER not in text:
        return False
    if 'id: "desk-assistants"' in text:
        return False
    if text.count('id: "desk-skills-conn"') != 1:
        return False
    if text.count('"skl.tab": "功能与连接"') != 1:
        return False
    if text.count('"skl.tab": "Features & connectors"') != 1:
        return False
    if '"skl.tab": "技能·连接器"' in text:
        return False
    if "function assistantsLead(" not in text:
        return False
    if "assistantsLead(asst)" not in text:
        return False
    if "loadAssist()" not in text:
        return False
    if 'tab === "intro"' in text or "tab === 'intro'" in text:
        return False
    if 'tr("skl.skills")' not in text or 'tr("skl.connectors")' not in text:
        return False
    if 'tr("fn.lead")' not in text:
        return False
    for sid in ("desk-auto", "desk-agents", "desk-announce", "desk-bots", "desk-hub", "desk-usage"):
        if ('id: "%s"' % sid) not in text:
            return False
    lines = text.splitlines()
    if any(line.strip() == "AssistantsPanel" for line in lines):
        return False
    lead = text.find("assistantsLead(asst)")
    tabs = text.find('tab === "skills"')
    if lead < 0 or tabs < 0 or lead > tabs:
        return False
    reg = text.find('id: "desk-skills-conn"')
    if reg < 0:
        return False
    window = text[reg:reg + 400]
    if 'return tr("skl.tab")' not in window:
        return False
    if "SkillsConnPanel" not in window:
        return False
    return True


def apply_all(text):
    updated = text
    if "function assistantsLead(" not in updated:
        needle = "    function SkillsConnPanel(props) {"
        count = updated.count(needle)
        if count != 1:
            sys.exit("anchor count=%d for SkillsConnPanel (expect 1)" % count)
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
            sys.exit("marker present but assistant/skills merge is wrong: %s" % REL)
        print("skip（已打）:", REL)
        return
    updated = apply_all(text)
    if not merged_ok(updated):
        sys.exit("patched assistant/skills merge is wrong: %s" % REL)
    io.open(path, "w", encoding="utf-8").write(updated)
    print("ok:", REL)


if __name__ == "__main__":
    main()
