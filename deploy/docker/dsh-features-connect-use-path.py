# -*- coding: utf-8 -*-
"""Docker image only: use paths on 「功能与连接」.

Cut 2026-10-27 features-connect-use-path, Decision A. Runs after
dsh-sidebar-assistant-skills-merge.py, which injects assistantsLead()
into plugin/desk-panel/lib/client.js. This script does not edit the
harness, the four engine modes, or 「设置 → Agent 预设」.

APIs (verified on dsh-v0.2.1-rc.3, not assumed from defaultHint):

- defaultHint in preset.yml is a static badge. The live default is the
  settings field the Agent presets section writes:
  remote.settings.update("agent-preset-registry", { selectedDefault }).
  See packages/client/ui-agent-preset/src/client/settings-store.ts on
  that tag (writeDefaultPreset). The desk panel already posts
  /api/settings/mutate with one args object; /api/settings/update uses
  the same envelope when the remote service is not on ctx yet.
- Which id is default comes from remote.agentPresets.list()
  (row.isDefault), the roster the settings section renders.
- A new session uses uiWorkspace.startSession(undefined, { agentPreset }),
  the same option ui-workspace startSession forwards to sessions.create.
  Fallback: POST /api/session/create with args.request.agentPreset,
  matching the session/create calls already in this repo.
- There is no settings-open helper on the desk panel. The footnote
  button clicks the existing sidebar.settings trigger (aria-haspopup
  dialog) and then the 「Agent 预设」 nav row.

ANYWORK_SRC is required. No home-directory default, so a Windows
checkout of the plugin is left alone.
"""
import io
import os
import sys

MARKER = "cut 2026-10-27 features-connect-use-path"
NEED = "cut 2026-10-26 assistant-skills-merge"
REL = "plugin/desk-panel/lib/client.js"

OLD_CTX = "    var DESK_CTX = null;"
NEW_CTX = """    var DESK_CTX = null;
    var DESK_REMOTE = null;
    var DESK_WS = null;
    var DESK_ROLE = null;"""

OLD_APPLY = """    function apply(ctx) {
      DESK_CTX = ctx;
      try {
        ctx.effect(function () { return ctx.locale.register(DESK_NS, { zh: LOC_ZH, en: LOC_EN }); });"""
NEW_APPLY = """    function apply(ctx) {
      DESK_CTX = ctx;
      // Nested inject, same services Settings and the new-session flow use.
      // A missing service must not keep the rest of the desk panel from loading.
      try {
        ctx.inject(["remote", "remote.settings", "remote.agentPresets"], function (scope) {
          DESK_REMOTE = scope.remote;
        });
      } catch (e) { /* HTTP fallback below */ }
      try {
        ctx.inject(["uiWorkspace"], function (scope) {
          DESK_WS = scope.uiWorkspace;
        });
      } catch (e2) { /* session/create fallback below */ }
      try {
        ctx.effect(function () { return ctx.locale.register(DESK_NS, { zh: LOC_ZH, en: LOC_EN }); });"""

OLD_ZH_NOTE = '      "asst.note": "助理 = 预设人格与工具组合。默认用哪个：设置 → Agent 预设；共享区 presets/ 下可自行增减，新会话生效。",'
NEW_ZH_NOTE = """      "asst.note": "团队角色是人格与工具组合，和引擎的标准 / PTC / 极简 / 创造是两层。默认与切换用卡片上的「用此角色新建会话」「设为默认」，或「设置 → Agent 预设」。只对之后新建的会话生效。",
      "asst.newSession": "用此角色新建会话",
      "asst.setDefault": "设为默认",
      "asst.defaultNow": "已是默认",
      "asst.sessionOpened": "已用此角色新建会话",
      "asst.sessionFail": "新建会话失败",
      "asst.defaultSaved": "已设为默认，之后新建的会话使用这个角色",
      "asst.defaultFail": "设为默认失败",
      "asst.codexHelpTitle": "开发搭档用法",
      "asst.codexHelp": "选用开发搭档后，会话里可以派 Codex 子代理。徽章「Codex 并行」表示这个能力。技能「Codex 并行（worktree）」是 git worktree 并行流程，不是这个徽章。",
      "asst.openSettings": "设置 → Agent 预设","""

OLD_EN_NOTE = '      "asst.note": "An assistant = a preset persona + tool set. Default choice: Settings → Agent presets; add or remove directories under presets/ in the shared area — applies to new sessions.",'
NEW_EN_NOTE = """      "asst.note": "Team roles are a persona plus a tool set, a different layer from Standard / PTC / Minimal / Creator. Set the default or switch with \\"New session with this role\\" and \\"Set as default\\" on the card, or Settings → Agent presets. This applies to sessions created afterward.",
      "asst.newSession": "New session with this role",
      "asst.setDefault": "Set as default",
      "asst.defaultNow": "Already the default",
      "asst.sessionOpened": "New session opened with this role",
      "asst.sessionFail": "Could not open a session",
      "asst.defaultSaved": "Default saved. Sessions created afterward use this role",
      "asst.defaultFail": "Could not set the default",
      "asst.codexHelpTitle": "How Dev partner uses Codex",
      "asst.codexHelp": "After you pick Dev partner, a session can dispatch a Codex subagent. The Codex parallel badge means that. The skill Codex parallel (worktree) is the git worktree flow, not this badge.",
      "asst.openSettings": "Settings → Agent presets","""

OLD_ZH_HINT = '      "skl.hint": "点击任意技能查看全文；新增 = 往共享区 skills/ 放一个文件夹，各实例自动分发。",'
NEW_ZH_HINT = """      "skl.hint": "默认只显示标题和一句何时用；点开才看全文。新增 = 往共享区 skills/ 放一个文件夹，各实例自动分发。",
      "skl.codexWorktree": "Codex 并行（worktree）",
      "skl.codexWorktreeWhen": "这是 worktree 并行流程。会话里的「Codex 并行」徽章是开发搭档的子代理，不是本技能。",
      "skl.teamReport": "团队报告写作规范",
      "skl.missing": "缺依赖：","""

OLD_EN_HINT = '      "skl.hint": "Click a skill to read it in full; to add one, drop a folder into skills/ in the shared area — every instance gets it automatically.",'
NEW_EN_HINT = """      "skl.hint": "The list shows a title and one line on when to use it. Open a row for the full text. To add one, drop a folder into skills/ in the shared area — every instance gets it.",
      "skl.codexWorktree": "Codex parallel (worktree)",
      "skl.codexWorktreeWhen": "This is the worktree flow. The Codex parallel badge on Dev partner is the session subagent, not this skill.",
      "skl.teamReport": "Team report style",
      "skl.missing": "Missing: ","""

OLD_CSS = ".ddp .rc-d { font-size:12.5px; color:var(--dsw-alias-label-secondary, #5f6570); line-height:1.65; }"
NEW_CSS = """.ddp .rc-d { font-size:12.5px; color:var(--dsw-alias-label-secondary, #5f6570); line-height:1.65; }
.ddp button.bdg { border:0; cursor:pointer; font-family:inherit; }
.ddp .rc-acts { display:flex; flex-wrap:wrap; gap:6px; margin-top:10px; }
.ddp .rc-help { margin-top:8px; padding:8px 10px; border-radius:8px; background:rgba(79,124,247,.08); font-size:12px; line-height:1.55; color:var(--dsw-alias-label-secondary, #5f6570); }
.ddp .rc-help-t { font-weight:650; margin-bottom:2px; }
.ddp .ft .linkish { display:inline-block; margin-top:4px; border:0; background:transparent; padding:0; color:#4f7cf7; font:inherit; cursor:pointer; text-decoration:underline; }"""

OLD_STATE = """      var asPair = React.useState({ phase: "loading", presets: [] });
      var asst = asPair[0];
      var setAsst = asPair[1];
      var det = dPair[0];"""
NEW_STATE = """      var asPair = React.useState({ phase: "loading", presets: [] });
      var asst = asPair[0];
      var setAsst = asPair[1];
      var rolePair = React.useState({ busy: "", msg: "", kind: "", codex: false });
      var roleUi = rolePair[0];
      var setRoleUi = rolePair[1];
      var det = dPair[0];"""

OLD_LOAD = """      function loadAssist() {
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
      }"""
NEW_LOAD = """      function loadAssist() {
        var portal = fetch("/portal/api/panel/presets", { headers: { accept: "application/json" } })
          .then(function (r) {
            if (!r.ok) throw new Error("HTTP " + r.status);
            return r.json();
          })
          .then(function (d) { return (d && d.presets) || []; });
        Promise.all([portal, readRoleRoster()])
          .then(function (pair) {
            var presets = pair[0];
            var rows = pair[1];
            var live = {};
            var saw = false;
            if (rows && rows.length) {
              saw = true;
              rows.forEach(function (row) {
                if (row && row.id) live[row.id] = row.isDefault === true;
              });
            }
            presets.forEach(function (p) {
              if (saw && Object.prototype.hasOwnProperty.call(live, p.id)) p.isDefault = live[p.id];
            });
            setAsst({ phase: "ready", presets: presets, roster: saw ? "ready" : "miss" });
          })
          .catch(function () {
            setAsst({ phase: "error", presets: [], roster: "miss" });
          });
      }"""

OLD_CALL = """      assistantsLead(asst).forEach(function (node) { kids.push(node); });"""
NEW_CALL = """      function roleAct() {
        return {
          busy: roleUi.busy,
          msg: roleUi.msg,
          kind: roleUi.kind,
          codex: roleUi.codex,
          onNew: function (p) { startRoleSession(p, setRoleUi); },
          onDefault: function (p) { saveRoleDefault(p, setRoleUi, loadAssist); },
          onCodex: function () {
            setRoleUi(function (prev) {
              return { busy: prev.busy, msg: prev.msg, kind: prev.kind, codex: !prev.codex };
            });
          },
          onSettings: openAgentPresetSettings
        };
      }
      DESK_ROLE = roleAct();
      assistantsLead(asst).forEach(function (node) { kids.push(node); });"""

OLD_VIEW = """      function viewSkill(sh) {
        setDet({ phase: "loading", id: sh.id, name: sh.name, content: "" });
        fetch("/portal/api/panel/skill?name=" + encodeURIComponent(sh.id) + "&lang=" + deskLang(), { headers: { accept: "application/json" } })
          .then(function (r) {
            return r.json();
          })
          .then(function (d) {
            if (d && d.error) setDet({ phase: "error", id: sh.id, name: sh.name, content: d.error });
            else setDet({ phase: "ready", id: sh.id, name: sh.name, content: (d && d.content) || "" });
          })
          .catch(function () {
            setDet({ phase: "error", id: sh.id, name: sh.name, content: tr("common.loadFailed") });
          });
      }"""
NEW_VIEW = """      function viewSkill(sh) {
        var title = skillTitle(sh);
        setDet({ phase: "loading", id: sh.id, name: title, content: "" });
        fetch("/portal/api/panel/skill?name=" + encodeURIComponent(sh.id) + "&lang=" + deskLang(), { headers: { accept: "application/json" } })
          .then(function (r) {
            return r.json();
          })
          .then(function (d) {
            if (d && d.error) setDet({ phase: "error", id: sh.id, name: title, content: d.error });
            else setDet({ phase: "ready", id: sh.id, name: title, content: (d && d.content) || "" });
          })
          .catch(function () {
            setDet({ phase: "error", id: sh.id, name: title, content: tr("common.loadFailed") });
          });
      }"""

OLD_ROWS = """          var rows = [];
          st.skills.forEach(function (sh) {
            rows.push(
              h(
                "div",
                { key: "s" + sh.id, className: "it hv", onClick: function () { viewSkill(sh); } },
                h("span", { className: "ico2" }, "📘"),
                h(
                  "div",
                  { className: "gr" },
                  h("div", { className: "th" }, h("span", { className: "t" }, sh.name), h("span", { className: "tag" }, sh.id)),
                  h("div", { className: "d" }, sh.description || ""),
                  sh.whenToUse ? h("div", { className: "d" }, tr("skl.trigger") + sh.whenToUse) : null
                )
              )
            );
          });"""
NEW_ROWS = """          var rows = [];
          st.skills.forEach(function (sh) {
            var when = skillWhen(sh);
            var miss = skillMiss(sh);
            rows.push(
              h(
                "div",
                { key: "s" + sh.id, className: "it hv", onClick: function () { viewSkill(sh); } },
                h("span", { className: "ico2" }, "📘"),
                h(
                  "div",
                  { className: "gr" },
                  h("div", { className: "th" }, h("span", { className: "t" }, skillTitle(sh))),
                  when ? h("div", { className: "d" }, when) : null,
                  miss ? h("div", { className: "d" }, tr("skl.missing") + miss) : null
                )
              )
            );
          });"""

OLD_SIG = """    function assistantsLead(st) {
      var nodes = [];"""
NEW_SIG = """    function assistantsLead(st, act) {
      act = act || DESK_ROLE || {};
      var nodes = [];"""

OLD_CARDS = """          nodes.push(h("div", { key: "fn-cards", className: "rolegrid" }, team.map(function (p) {
            return h("div", { key: "fnp" + p.id, className: "rolecard" },
              h("div", { className: "rc-top" },
                h("span", { className: "rc-ico" }, dicon(roleIcon(p.id), 16)),
                h("span", { className: "rc-name" }, p.name),
                p.defaultHint ? h("span", { className: "bdg" }, tr("asst.defaultTag")) : null,
                p.codex ? h("span", { className: "bdg" }, tr("asst.codex")) : null
              ),
              h("div", { className: "rc-d" }, p.description || p.id)
            );
          })));"""
NEW_CARDS = """          nodes.push(h("div", { key: "fn-cards", className: "rolegrid" }, team.map(function (p) {
            var liveDefault = p.isDefault === true || (st.roster !== "ready" && p.defaultHint);
            var locked = act.busy === p.id;
            return h("div", { key: "fnp" + p.id, className: "rolecard" },
              h("div", { className: "rc-top" },
                h("span", { className: "rc-ico" }, dicon(roleIcon(p.id), 16)),
                h("span", { className: "rc-name" }, p.name),
                liveDefault ? h("span", { className: "bdg" }, tr("asst.defaultTag")) : null,
                p.codex ? h("button", {
                  type: "button",
                  className: "bdg",
                  onClick: function () { if (act.onCodex) act.onCodex(p); }
                }, tr("asst.codex")) : null
              ),
              h("div", { className: "rc-d" }, p.description || p.id),
              p.codex && act.codex ? h("div", { className: "rc-help" },
                h("div", { className: "rc-help-t" }, tr("asst.codexHelpTitle")),
                h("div", null, tr("asst.codexHelp"))
              ) : null,
              h("div", { className: "rc-acts" },
                h("button", {
                  type: "button",
                  className: "bbtn pri",
                  disabled: locked,
                  onClick: function () { if (act.onNew) act.onNew(p); }
                }, tr("asst.newSession")),
                h("button", {
                  type: "button",
                  className: "bbtn",
                  disabled: locked || p.isDefault === true,
                  onClick: function () { if (act.onDefault) act.onDefault(p); }
                }, p.isDefault === true ? tr("asst.defaultNow") : tr("asst.setDefault"))
              )
            );
          })));"""

OLD_TIP = """      nodes.push(h("div", { key: "fn-tip", className: "ft" }, tr("asst.note")));"""
NEW_TIP = """      nodes.push(h("div", { key: "fn-tip", className: "ft" },
        h("div", null, tr("asst.note")),
        h("button", {
          type: "button",
          className: "linkish",
          onClick: function () { if (act.onSettings) act.onSettings(); }
        }, tr("asst.openSettings"))
      ));
      if (act.msg) {
        nodes.push(h("div", { key: "fn-msg", className: "msg" + (act.kind === "err" ? " err" : act.kind === "ok" ? " ok" : "") }, act.msg));
      }"""

HELPERS = r"""    // ANYWORK Docker image (cut 2026-10-27 features-connect-use-path):
    // defaultHint is the static preset.yml badge. The live default is
    // settings namespace agent-preset-registry / selectedDefault, the write
    // Settings → Agent presets uses on dsh-v0.2.1-rc.3. New sessions pass
    // agentPreset through uiWorkspace.startSession, same as the workspace.
    function skillTitle(sh) {
      if (!sh) return "";
      if (sh.id === "codex-parallel-worktrees") return tr("skl.codexWorktree");
      if (sh.id === "team-report-style") return tr("skl.teamReport");
      if (sh.name && sh.name !== sh.id) return sh.name;
      return sh.name || sh.id || "";
    }
    function skillWhen(sh) {
      if (!sh) return "";
      if (sh.id === "codex-parallel-worktrees") return tr("skl.codexWorktreeWhen");
      if (sh.whenToUse) return sh.whenToUse;
      return sh.description || "";
    }
    function skillMiss(sh) {
      var raw = sh && (sh.missing || sh.missingDeps || sh.requires);
      if (!raw) return "";
      if (typeof raw === "string") return raw;
      if (raw && typeof raw.join === "function") return raw.join("、");
      return "";
    }
    function readRoleRoster() {
      var remote = DESK_REMOTE;
      if (remote && remote.agentPresets && typeof remote.agentPresets.list === "function") {
        return Promise.resolve()
          .then(function () { return remote.agentPresets.list(); })
          .then(function (res) {
            if (res && res.ok && res.value && res.value.presets) return res.value.presets;
            if (res && res.presets) return res.presets;
            return null;
          })
          .catch(function () { return null; });
      }
      return fetch("/api/agentPresets/list", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          type: "client-request",
          rpcId: "desk-role-roster-" + Date.now(),
          method: "agentPresets/list",
          payload: { args: {} }
        })
      })
        .then(function (r) { return r.json(); })
        .then(function (j) {
          var value = j && j.result && j.result.value;
          if (value && value.presets) return value.presets;
          return null;
        })
        .catch(function () { return null; });
    }
    function startRoleSession(p, setRoleUi) {
      var id = String((p && p.id) || "");
      if (!/^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/.test(id)) {
        setRoleUi(function (prev) { return { busy: "", msg: tr("asst.sessionFail"), kind: "err", codex: prev.codex }; });
        return;
      }
      setRoleUi(function (prev) { return { busy: id, msg: "", kind: "", codex: prev.codex }; });
      var ws = DESK_WS;
      if (ws && typeof ws.startSession === "function") {
        try {
          ws.startSession(undefined, { agentPreset: id });
          try { fvNotify(null); } catch (e) {}
          setRoleUi(function (prev) { return { busy: "", msg: tr("asst.sessionOpened"), kind: "ok", codex: prev.codex }; });
          return;
        } catch (e1) { /* session/create below */ }
      }
      fetch("/api/session/create", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          type: "client-request",
          rpcId: "desk-role-new-" + Date.now(),
          method: "session/create",
          payload: { args: { request: { agentPreset: id } } }
        })
      })
        .then(function (r) { return r.json(); })
        .then(function (j) {
          var value = j && j.result && j.result.ok ? j.result.value : null;
          if (!value || !value.sessionId) {
            var err = j && j.result && j.result.error;
            throw new Error((err && err.message) || tr("asst.sessionFail"));
          }
          try { fvNotify(null); } catch (e2) {}
          setRoleUi(function (prev) { return { busy: "", msg: tr("asst.sessionOpened"), kind: "ok", codex: prev.codex }; });
        })
        .catch(function (e) {
          setRoleUi(function (prev) { return { busy: "", msg: String((e && e.message) || e), kind: "err", codex: prev.codex }; });
        });
    }
    function saveRoleDefault(p, setRoleUi, reload) {
      var id = String((p && p.id) || "");
      if (!/^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/.test(id)) {
        setRoleUi(function (prev) { return { busy: "", msg: tr("asst.defaultFail"), kind: "err", codex: prev.codex }; });
        return;
      }
      setRoleUi(function (prev) { return { busy: id, msg: "", kind: "", codex: prev.codex }; });
      var write;
      var remote = DESK_REMOTE;
      if (remote && remote.settings && typeof remote.settings.update === "function") {
        write = Promise.resolve()
          .then(function () { return remote.settings.update("agent-preset-registry", { selectedDefault: id }); })
          .then(function (res) {
            if (res && res.ok === false) throw new Error((res.error && res.error.message) || tr("asst.defaultFail"));
          });
      } else {
        write = fetch("/api/settings/update", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            type: "client-request",
            rpcId: "desk-role-def-" + Date.now(),
            method: "settings/update",
            payload: { args: { ns: "agent-preset-registry", patch: { selectedDefault: id } } }
          })
        })
          .then(function (r) { return r.json(); })
          .then(function (j) {
            if (!(j && j.result && j.result.ok)) {
              var err = j && j.result && j.result.error;
              throw new Error((err && err.message) || tr("asst.defaultFail"));
            }
          });
      }
      write
        .then(function () {
          setRoleUi(function (prev) { return { busy: "", msg: tr("asst.defaultSaved"), kind: "ok", codex: prev.codex }; });
          if (reload) reload();
        })
        .catch(function (e) {
          setRoleUi(function (prev) { return { busy: "", msg: String((e && e.message) || e), kind: "err", codex: prev.codex }; });
        });
    }
    function openAgentPresetSettings() {
      try { fvNotify(null); } catch (e) {}
      window.setTimeout(function () {
        var root = document.querySelector('[data-slot="sidebar.settings"]');
        var btn = root && root.querySelector('button[aria-haspopup="dialog"]');
        if (!btn) return;
        if (btn.getAttribute("aria-expanded") !== "true") btn.click();
        window.setTimeout(function () {
          var dialog = document.querySelector('[data-shortcut-modal="settings"]');
          if (!dialog) return;
          var buttons = dialog.querySelectorAll("button");
          for (var i = 0; i < buttons.length; i++) {
            var label = (buttons[i].textContent || "").replace(/\s+/g, "");
            if (label === "Agent预设" || label === "Agentpresets") { buttons[i].click(); break; }
          }
        }, 60);
      }, 60);
    }

"""

REPLACEMENTS = (
    (OLD_CTX, NEW_CTX),
    (OLD_APPLY, NEW_APPLY),
    (OLD_ZH_NOTE, NEW_ZH_NOTE),
    (OLD_EN_NOTE, NEW_EN_NOTE),
    (OLD_ZH_HINT, NEW_ZH_HINT),
    (OLD_EN_HINT, NEW_EN_HINT),
    (OLD_CSS, NEW_CSS),
    (OLD_STATE, NEW_STATE),
    (OLD_LOAD, NEW_LOAD),
    (OLD_CALL, NEW_CALL),
    (OLD_VIEW, NEW_VIEW),
    (OLD_ROWS, NEW_ROWS),
    (OLD_SIG, NEW_SIG),
    (OLD_CARDS, NEW_CARDS),
    (OLD_TIP, NEW_TIP),
)


def use_ok(text):
    if text.count(MARKER) != 1:
        return False
    if NEED not in text:
        return False
    if "function assistantsLead(st, act)" not in text:
        return False
    if "DESK_ROLE = roleAct()" not in text:
        return False
    if "assistantsLead(asst)" not in text:
        return False
    if "function loadAssist()" not in text:
        return False
    if "function skillTitle(" not in text or "function skillWhen(" not in text:
        return False
    if 'remote.settings.update("agent-preset-registry", { selectedDefault: id })' not in text:
        return False
    if 'ns: "agent-preset-registry", patch: { selectedDefault: id }' not in text:
        return False
    if 'method: "settings/update"' not in text:
        return False
    if 'method: "agentPresets/list"' not in text:
        return False
    if "ws.startSession(undefined, { agentPreset: id })" not in text:
        return False
    if 'method: "session/create"' not in text:
        return False
    if 'payload: { args: { request: { agentPreset: id } } }' not in text:
        return False
    if 'tr("asst.newSession")' not in text or 'tr("asst.setDefault")' not in text:
        return False
    if 'tr("asst.codex")' not in text or 'tr("asst.codexHelpTitle")' not in text:
        return False
    if 'tr("asst.openSettings")' not in text:
        return False
    if 'tr("skl.codexWorktree")' not in text or 'tr("skl.codexWorktreeWhen")' not in text:
        return False
    if 'className: "tag" }, sh.id' in text:
        return False
    if "function viewSkill(sh)" not in text:
        return False
    if '"/portal/api/panel/skill?name="' not in text:
        return False
    if 'h("pre", { key: "dc", className: "code" }, det.content)' not in text:
        return False
    if text.count('"asst.newSession": "用此角色新建会话"') != 1:
        return False
    if text.count('"asst.setDefault": "设为默认"') != 1:
        return False
    if text.count('"skl.codexWorktree": "Codex 并行（worktree）"') != 1:
        return False
    if text.count('"asst.codexHelpTitle": "开发搭档用法"') != 1:
        return False
    if text.count('"asst.codex": "Codex 并行"') != 1:
        return False
    if "设置 → Agent 预设" not in text:
        return False
    if "标准 / PTC / 极简 / 创造" not in text:
        return False
    if text.count('id: "desk-skills-conn"') != 1:
        return False
    if 'id: "desk-assistants"' in text:
        return False
    if 'tr("fn.lead")' not in text:
        return False
    if 'tr("skl.skills")' not in text or 'tr("skl.connectors")' not in text:
        return False
    if 'id: "desk-usage"' not in text or "settings.section" not in text:
        return False
    for sid in ("desk-announce", "desk-bots", "desk-hub"):
        if ('id: "%s"' % sid) not in text:
            return False
    if "presetStandard" in text or "presetPtc" in text:
        return False
    return True


def apply_all(text):
    if "function assistantsLead(" not in text or NEED not in text:
        sys.exit("assistant/skills merge is missing; run dsh-sidebar-assistant-skills-merge.py first")
    updated = text
    needle = "    function assistantsLead(st) {"
    if updated.count(needle) != 1:
        sys.exit("anchor count=%d for assistantsLead (expect 1)" % updated.count(needle))
    updated = updated.replace(needle, HELPERS + needle, 1)
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
        if not use_ok(text):
            sys.exit("marker present but features-connect use path is wrong: %s" % REL)
        print("skip（已打）:", REL)
        return
    updated = apply_all(text)
    if not use_ok(updated):
        sys.exit("patched features-connect use path is wrong: %s" % REL)
    io.open(path, "w", encoding="utf-8").write(updated)
    print("ok:", REL)


if __name__ == "__main__":
    main()
