// DSH-ANYWORK 工作台扩展（浏览器侧 cordis 插件）：设置页=用量/任务板/知识库（含沉淀）/公司盘/成员管理/通知/运维；侧栏=公告 + 助理 + 技能·连接器 + 自动化
// 产出格式与 dsh 官方客户端插件一致：window.__ModuleLoader__.load({ id, factory })
// 依赖仅 react（平台种子模块），全部走闭包 require。
window.__ModuleLoader__.load({
  id: "dsh-desk-panel",
  factory: (require) => {
    var module = { exports: {} };
    var exports = module.exports;
    Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
    let React = require("react");

    var h = React.createElement;
    var DESK_CSS = `
.ddb { display:flex; align-items:center; gap:10px; width:100%; padding:7px 10px; border:0; border-radius:10px; background:transparent; color:inherit; cursor:pointer; font-size:13px; text-align:left; transition:background .13s ease; }
.ddb:hover { background:var(--dsw-alias-interactive-bg-hover-default, rgba(127,127,127,.12)); }
.ddb.rail { justify-content:center; padding:7px 6px; }
.ddb .ic { width:26px; height:26px; border-radius:8px; display:flex; align-items:center; justify-content:center; font-size:15px; background:var(--dsw-alias-bg-base, rgba(127,127,127,.10)); flex:0 0 auto; }
.ddb .lbl { flex:1; min-width:0; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
.ddb .badge { font-size:10.5px; font-weight:700; line-height:1; padding:3px 7px; border-radius:999px; background:#d64545; color:#fff; }
.ddp { position:fixed; left:12px; bottom:76px; width:428px; max-width:calc(100vw - 24px); max-height:74vh; display:flex; flex-direction:column; background:var(--dsw-alias-bg-layer-2, #fff); border:1px solid var(--dsw-alias-border-l2, #d0d3d9); border-radius:16px; box-shadow:0 18px 50px rgba(16,24,40,.22), 0 2px 8px rgba(16,24,40,.08); z-index:9999; color:inherit; overflow:hidden; }
.ddp .hd { display:flex; align-items:center; gap:11px; padding:13px 14px 12px; border-bottom:1px solid var(--dsw-alias-border-l2, #e8eaed); }
.ddp .hd .ico { width:34px; height:34px; border-radius:10px; display:flex; align-items:center; justify-content:center; font-size:17px; background:var(--dsw-alias-bg-base, #f2f3f5); flex:0 0 auto; }
.ddp .hd .t1 { font-weight:700; font-size:14px; line-height:1.3; }
.ddp .hd .t2 { font-size:11.5px; color:var(--dsw-alias-label-tertiary, #8a8f98); margin-top:1px; }
.ddp .hd .x { margin-left:auto; width:28px; height:28px; border:0; border-radius:8px; background:transparent; color:inherit; cursor:pointer; font-size:13px; opacity:.75; flex:0 0 auto; }
.ddp .hd .x:hover { background:rgba(127,127,127,.14); opacity:1; }
.ddp .bd { padding:4px 14px 14px; overflow-y:auto; }
.ddp .lb { font-size:11px; font-weight:600; letter-spacing:.4px; color:var(--dsw-alias-label-tertiary, #8a8f98); margin:12px 0 2px; }
.ddp .list { display:flex; flex-direction:column; }
.ddp .it { display:flex; gap:10px; align-items:flex-start; padding:9px 8px; margin:0 -8px; border-radius:10px; }
.ddp .it.hv { cursor:pointer; transition:background .12s; }
.ddp .it.hv:hover { background:rgba(127,127,127,.10); }
.ddp .it .ico2 { width:26px; height:26px; border-radius:8px; display:flex; align-items:center; justify-content:center; font-size:14px; background:var(--dsw-alias-bg-base, #f2f3f5); flex:0 0 auto; margin-top:1px; }
.ddp .gr { flex:1; min-width:0; }
.ddp .th { display:flex; align-items:center; justify-content:space-between; gap:8px; }
.ddp .t { font-weight:600; font-size:13px; line-height:1.4; }
.ddp .d { font-size:12px; color:var(--dsw-alias-label-tertiary, #8a8f98); margin-top:2px; line-height:1.55; }
.ddp .bd2 { font-size:12.5px; margin-top:4px; white-space:pre-wrap; line-height:1.6; }
.ddp .bdg { display:inline-block; font-size:10px; font-weight:600; line-height:1; padding:3px 7px; border-radius:999px; background:rgba(79,124,247,.12); color:#4f7cf7; margin-left:6px; vertical-align:1px; flex:0 0 auto; }
.ddp .tag { display:inline-block; font-size:10px; line-height:1; padding:3px 7px; border-radius:999px; background:var(--dsw-alias-bg-base, #f2f3f5); color:var(--dsw-alias-label-tertiary, #8a8f98); flex:0 0 auto; }
.ddp .dot { width:9px; height:9px; border-radius:50%; flex:0 0 auto; margin-top:7px; box-shadow:0 0 0 3px rgba(127,127,127,.08); }
.ddp .dot.ok { background:#31a24c; } .ddp .dot.bad { background:#d64545; } .ddp .dot.off { background:#b6bbc2; }
.ddp .tabs { display:flex; gap:3px; padding:3px; margin:10px 0 2px; background:var(--dsw-alias-bg-base, #f2f3f5); border-radius:10px; }
.ddp .tabs .tb { flex:1; border:0; border-radius:8px; padding:6px 8px; background:transparent; color:var(--dsw-alias-label-secondary, #5f6570); font-size:12.5px; font-weight:500; cursor:pointer; }
.ddp .tabs .tb.on { background:var(--dsw-alias-bg-layer-2, #fff); color:inherit; font-weight:600; box-shadow:0 1px 3px rgba(16,24,40,.12); }
.ddp .code { font-family:ui-monospace, Consolas, monospace; font-size:12px; line-height:1.65; background:var(--dsw-alias-bg-base, #f6f7f8); border:1px solid var(--dsw-alias-border-l2, #e8eaed); border-radius:10px; padding:10px 12px; white-space:pre-wrap; word-break:break-word; max-height:360px; overflow:auto; margin:2px 0 0; }
.ddp .ft { border-top:1px solid var(--dsw-alias-border-l2, #e8eaed); margin-top:12px; padding:9px 2px 0; font-size:12px; color:var(--dsw-alias-label-secondary, #65676b); line-height:1.65; }
.ddp .fm { display:flex; flex-direction:column; gap:8px; margin-top:8px; }
.ddp .row { display:flex; gap:8px; align-items:center; margin-top:8px; flex-wrap:wrap; }
.ddp .inp { width:100%; min-width:0; height:34px; border:1px solid var(--dsw-alias-border-l2, #d4d7dc); border-radius:9px; padding:0 11px; font-size:12.5px; background:transparent; color:inherit; outline:none; box-sizing:border-box; transition:border-color .15s, box-shadow .15s; }
.ddp .inp.ta { height:auto; min-height:64px; padding:9px 11px; resize:vertical; line-height:1.6; font-family:inherit; }
.ddp .inp:focus { border-color:#4f7cf7; box-shadow:0 0 0 3px rgba(79,124,247,.15); }
.ddp .btn { height:33px; padding:0 14px; border:0; border-radius:9px; background:#4f7cf7; color:#fff; font-size:12.5px; font-weight:600; cursor:pointer; transition:background .15s; }
.ddp .btn:hover { background:#3f6be6; }
.ddp .btn.gh { background:transparent; border:1px solid var(--dsw-alias-border-l2, #d4d7dc); color:inherit; font-weight:500; }
.ddp .btn.gh:hover { background:rgba(127,127,127,.10); }
.ddp .mini { border:1px solid var(--dsw-alias-border-l2, #d4d7dc); background:transparent; color:inherit; font-size:11.5px; padding:3px 10px; border-radius:7px; cursor:pointer; flex:0 0 auto; opacity:.85; }
.ddp .mini:hover { background:rgba(127,127,127,.10); opacity:1; }
.ddp .msg { font-size:12px; margin-top:9px; color:var(--dsw-alias-label-tertiary, #8a8f98); }
.ddp .msg.err { color:#d64545; } .ddp .msg.ok { color:#31a24c; }
.ddp .empty { color:var(--dsw-alias-label-tertiary, #8a8f98); font-size:12.5px; padding:10px 2px; }
.ddp .sub { font-size:12px; color:var(--dsw-alias-label-tertiary, #8a8f98); margin:6px 0 2px; }
/* 侧栏底部动作区：壳默认为「横排不换行」，多个带文字入口会溢出被挤掉 —— 强制纵向堆叠成菜单 */
[class*="footerActions"] { flex-direction: column !important; align-items: stretch !important; gap: 2px !important; }
[class*="footerActions"] > div { width: 100%; }
`;
    (function () {
      try {
        if (!document.getElementById("dsh-desk-css")) {
          var st = document.createElement("style");
          st.id = "dsh-desk-css";
          st.textContent = DESK_CSS;
          (document.head || document.documentElement).appendChild(st);
        }
      } catch (e) { /* 注入失败不影响功能 */ }
    })();

    var muted = { color: "var(--dsw-alias-label-tertiary, #65676b)" };
    var wrap = {
      maxWidth: 560,
      fontSize: 13,
      lineHeight: "20px",
      color: "var(--dsw-alias-label-primary, #1c1e21)",
      display: "flex",
      flexDirection: "column",
      gap: 10,
    };
    var rowBase = { padding: "6px 0", borderBottom: "1px solid var(--dsw-alias-border-l2, #f0f1f3)" };
    var btnDark = {
      padding: "8px 14px",
      border: 0,
      borderRadius: 8,
      background: "var(--dsw-alias-label-primary, #1c1e21)",
      color: "var(--dsw-alias-bg-layer-1, #fff)",
      cursor: "pointer",
      fontSize: 13,
    };
    var btnLight = {
      padding: "8px 14px",
      border: "1px solid var(--dsw-alias-border-l2, #ccd0d5)",
      borderRadius: 8,
      background: "transparent",
      color: "inherit",
      cursor: "pointer",
      fontSize: 13,
    };
    var crumb = { color: "var(--dsw-alias-state-business-primary, #4f7cf7)", cursor: "pointer", textDecoration: "none" };
    var field = {
      width: "100%",
      boxSizing: "border-box",
      padding: "8px 10px",
      border: "1px solid var(--dsw-alias-border-l2, #ccd0d5)",
      borderRadius: 8,
      background: "var(--dsw-alias-bg-layer-1, #fff)",
      color: "inherit",
      fontSize: 13,
    };
    var btnSmall = {
      padding: "4px 10px",
      border: "1px solid var(--dsw-alias-border-l2, #ccd0d5)",
      borderRadius: 6,
      background: "transparent",
      color: "inherit",
      cursor: "pointer",
      fontSize: 12,
    };
    var btnDanger = {
      padding: "4px 10px",
      border: 0,
      borderRadius: 6,
      background: "#c0392b",
      color: "#fff",
      cursor: "pointer",
      fontSize: 12,
    };
    var codeBox = {
      fontFamily: "ui-monospace, Consolas, monospace",
      background: "var(--dsw-alias-bg-base, #f0f1f3)",
      border: "1px solid var(--dsw-alias-border-l2, #ccd0d5)",
      borderRadius: 8,
      padding: "10px 12px",
      wordBreak: "break-all",
      fontSize: 13,
    };
    function fmtAt(s) {
      if (!s) return "";
      var d = new Date(String(s).replace(" ", "T") + "Z");
      if (isNaN(d.getTime())) return String(s).slice(5, 16);
      function p2(x) {
        return (x < 10 ? "0" : "") + x;
      }
      return p2(d.getMonth() + 1) + "-" + p2(d.getDate()) + " " + p2(d.getHours()) + ":" + p2(d.getMinutes());
    }
    var footBtn = {
      display: "flex",
      alignItems: "center",
      justifyContent: "flex-start",
      gap: 6,
      padding: "8px 12px",
      border: 0,
      borderRadius: 8,
      background: "transparent",
      color: "inherit",
      cursor: "pointer",
      fontSize: 13,
      width: "100%",
      textAlign: "left",
    };
    var panelStyle = {
      position: "fixed",
      left: 12,
      bottom: 76,
      width: 400,
      maxWidth: "calc(100vw - 24px)",
      maxHeight: "72vh",
      overflowY: "auto",
      background: "var(--dsw-alias-bg-layer-1, #fff)",
      border: "1px solid var(--dsw-alias-border-l2, #ccd0d5)",
      borderRadius: 12,
      boxShadow: "0 10px 30px rgba(0,0,0,0.18)",
      zIndex: 9999,
      padding: 12,
      display: "flex",
      flexDirection: "column",
      gap: 8,
      fontSize: 13,
      color: "var(--dsw-alias-label-primary, #1c1e21)",
    };
    var formCol = { display: "flex", flexDirection: "column", gap: 6 };
    var textareaStyle = {
      width: "100%",
      boxSizing: "border-box",
      padding: "8px 10px",
      border: "1px solid var(--dsw-alias-border-l2, #ccd0d5)",
      borderRadius: 8,
      background: "var(--dsw-alias-bg-layer-1, #fff)",
      color: "inherit",
      fontSize: 13,
      minHeight: 60,
      resize: "vertical",
      fontFamily: "inherit",
    };
    var btnPill = {
      padding: "6px 10px",
      border: "1px solid var(--dsw-alias-border-l2, #ccd0d5)",
      borderRadius: 999,
      background: "transparent",
      color: "inherit",
      cursor: "pointer",
      fontSize: 12,
    };
    var btnPillOn = {
      padding: "6px 10px",
      border: "1px solid var(--dsw-alias-border-l2, #ccd0d5)",
      borderRadius: 999,
      background: "var(--dsw-alias-bg-base, #f0f1f3)",
      color: "inherit",
      cursor: "pointer",
      fontSize: 12,
      fontWeight: 600,
    };

    function fmt(n) {
      return "¥" + Number(n || 0).toFixed(4);
    }

    function fmtSize(n) {
      var v = Number(n || 0);
      if (v < 1024) return v + " B";
      if (v < 1024 * 1024) return (v / 1024).toFixed(1) + " KB";
      if (v < 1024 * 1024 * 1024) return (v / 1024 / 1024).toFixed(1) + " MB";
      return (v / 1024 / 1024 / 1024).toFixed(2) + " GB";
    }

    function fmtTs(ep) {
      var d = new Date(Number(ep) * 1000);
      var p = function (n) {
        return (n < 10 ? "0" : "") + n;
      };
      return d.getMonth() + 1 + "-" + p(d.getDate()) + " " + p(d.getHours()) + ":" + p(d.getMinutes());
    }

    function DeskUsageSection() {
      var pair = React.useState({ phase: "loading" });
      var state = pair[0];
      var setState = pair[1];
      React.useEffect(function () {
        var alive = true;
        fetch("/portal/api/usage", { headers: { accept: "application/json" } })
          .then(function (r) {
            if (!r.ok) throw new Error("HTTP " + r.status);
            return r.json();
          })
          .then(function (d) {
            if (alive) setState({ phase: "ready", data: d });
          })
          .catch(function (e) {
            if (alive) setState({ phase: "error", message: String((e && e.message) || e) });
          });
        return function () {
          alive = false;
        };
      }, []);

      if (state.phase === "loading") return h("div", { style: wrap }, "读取用量中…");

      if (state.phase === "error") {
        return h(
          "div",
          { style: wrap },
          h("div", null, "暂时读不到用量数据（" + state.message + "）。"),
          h(
            "div",
            { style: muted },
            "本面板通过门户读取账本：请从门户地址打开工作台（例如 http://192.168.0.171:8080）再查看；直连实例端口时不可用。"
          )
        );
      }

      var d = state.data;
      var kids = [];
      kids.push(
        h(
          "div",
          { key: "month" },
          h("div", { style: { fontSize: 22, fontWeight: 700 } }, fmt(d.month.cost)),
          h(
            "div",
            { style: muted },
            "本月 · 请求 " + d.month.events + " 次 · 未命中 " + d.month.miss + " / 输出 " + d.month.out + " tokens"
          )
        )
      );
      kids.push(h("div", { key: "today", style: muted }, "今日 " + fmt(d.day.cost) + " · " + d.day.events + " 次"));
      if (d.budget != null) {
        kids.push(
          h(
            "div",
            { key: "budget", style: muted },
            "预算 ¥" + d.budget + "（" + (d.month.cost >= d.budget ? "已超限" : "剩余 ¥" + (d.budget - d.month.cost).toFixed(4)) + "）"
          )
        );
      }
      var rows = (d.recent || []).map(function (r, i) {
        return h(
          "div",
          { key: "r" + i, style: { display: "flex", justifyContent: "space-between", gap: 12 } },
          h("span", { style: muted }, r.time),
          h("span", null, r.model + (r.channel ? " @" + r.channel : "")),
          h("span", null, fmt(r.cost))
        );
      });
      kids.push(h("div", { key: "rows" }, rows));
      kids.push(
        h(
          "div",
          { key: "link" },
          h(
            "a",
            { href: "/portal/me", target: "_blank", rel: "noreferrer", style: crumb },
            "打开完整门户页（用量明细）→"
          )
        )
      );
      return h("div", { style: wrap }, kids);
    }

    function KbDeposit() {
      var pair = React.useState({ phase: "loading", role: "member", notes: [], message: "", expanded: "", expandedContent: "" });
      var st = pair[0];
      var setSt = pair[1];
      var tRef = React.useRef(null);
      var gRef = React.useRef(null);
      var cRef = React.useRef(null);

      function setMsg(msg) {
        var n = {};
        for (var k in st) n[k] = st[k];
        n.message = msg;
        setSt(n);
      }

      React.useEffect(function () {
        fetch("/portal/api/kb/list", { headers: { accept: "application/json" } })
          .then(function (r) {
            if (!r.ok) throw new Error("HTTP " + r.status);
            return r.json();
          })
          .then(function (d) {
            setSt({ phase: "ready", role: d.role || "member", notes: d.notes || [], message: "", expanded: "", expandedContent: "" });
          })
          .catch(function (e) {
            setSt({ phase: "error", role: "member", notes: [], message: String((e && e.message) || e), expanded: "", expandedContent: "" });
          });
      }, []);

      function reload(msg) {
        fetch("/portal/api/kb/list", { headers: { accept: "application/json" } })
          .then(function (r) {
            return r.json();
          })
          .then(function (d) {
            setSt({ phase: "ready", role: d.role || "member", notes: d.notes || [], message: msg || "", expanded: "", expandedContent: "" });
          })
          .catch(function () {
            setMsg(msg || "");
          });
      }

      function save() {
        var title = tRef.current ? tRef.current.value : "";
        var tags = gRef.current ? gRef.current.value : "";
        var content = cRef.current ? cRef.current.value : "";
        if (!String(content).trim()) {
          setMsg("内容不能为空");
          return;
        }
        setMsg("保存中…");
        fetch("/portal/api/kb/save", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ title: title, tags: tags, content: content }) })
          .then(function (r) {
            return r.json().then(function (d) {
              return { status: r.status, d: d };
            });
          })
          .then(function (res) {
            if (res.status !== 200) {
              setMsg((res.d && res.d.error) || "HTTP " + res.status);
              return;
            }
            if (tRef.current) tRef.current.value = "";
            if (gRef.current) gRef.current.value = "";
            if (cRef.current) cRef.current.value = "";
            reload("已沉淀：notes/" + res.d.name);
          })
          .catch(function (e) {
            setMsg(String((e && e.message) || e));
          });
      }

      function openNote(name) {
        if (st.expanded === name) {
          var n1 = {};
          for (var k1 in st) n1[k1] = st[k1];
          n1.expanded = "";
          n1.expandedContent = "";
          setSt(n1);
          return;
        }
        var n2 = {};
        for (var k2 in st) n2[k2] = st[k2];
        n2.expanded = name;
        n2.expandedContent = "读取中…";
        setSt(n2);
        fetch("/portal/api/kb/note?name=" + encodeURIComponent(name), { headers: { accept: "application/json" } })
          .then(function (r) {
            return r.json();
          })
          .then(function (d) {
            var n3 = {};
            for (var k3 in st) n3[k3] = st[k3];
            n3.expanded = name;
            n3.expandedContent = d.ok ? d.content : d.error || "读取失败";
            setSt(n3);
          })
          .catch(function (e) {
            var n4 = {};
            for (var k4 in st) n4[k4] = st[k4];
            n4.expanded = name;
            n4.expandedContent = String((e && e.message) || e);
            setSt(n4);
          });
      }

      function del(name) {
        if (!window.confirm("删除笔记：" + name + "？")) return;
        fetch("/portal/api/kb/rm", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ name: name }) })
          .then(function (r) {
            return r.json().then(function (d) {
              return { status: r.status, d: d };
            });
          })
          .then(function (res) {
            reload(res.status === 200 ? "已删除：" + name : (res.d && res.d.error) || "HTTP " + res.status);
          })
          .catch(function (e) {
            setMsg(String((e && e.message) || e));
          });
      }

      var kids = [];
      kids.push(h("div", { key: "hd", style: { fontWeight: 600, marginBottom: 6 } }, "沉淀一条新笔记（写入共享知识库）"));
      kids.push(
        h(
          "div",
          { key: "f", style: { display: "flex", flexDirection: "column", gap: 6 } },
          h(
            "div",
            { style: { display: "flex", gap: 8 } },
            h("input", { ref: tRef, placeholder: "标题（如：铬矿报价速算口径）", style: Object.assign({}, field, { flex: 1 }) }),
            h("input", { ref: gRef, placeholder: "标签（可选）", style: Object.assign({}, field, { width: 140 }) })
          ),
          h("textarea", { ref: cRef, placeholder: "正文（Markdown）——建议写结论 / 口径 / 方法，方便后来人复用", style: Object.assign({}, textareaStyle, { minHeight: 100 }) }),
          h("div", null, h("button", { style: btnDark, onClick: save }, "沉淀入库"))
        )
      );
      if (st.message) kids.push(h("div", { key: "msg", style: Object.assign({ fontSize: 12 }, muted) }, st.message));
      kids.push(h("div", { key: "rec", style: { fontWeight: 600, margin: "10px 0 4px" } }, "最近沉淀（" + st.notes.length + "）"));
      if (st.phase === "error") {
        kids.push(h("div", { key: "err", style: muted }, "读不到沉淀列表（" + st.message + "）。"));
      } else {
        var rows = [];
        for (var i = 0; i < st.notes.length; i++) {
          (function (n) {
            var isOpen = st.expanded === n.name;
            var actions = [h("button", { key: "v", style: btnSmall, onClick: function () { openNote(n.name); } }, isOpen ? "收起" : "查看")];
            if (st.role === "admin") {
              actions.push(h("button", { key: "d", style: btnSmall, onClick: function () { del(n.name); } }, "删除"));
            }
            rows.push(
              h(
                "div",
                { key: "n" + n.name, style: rowBase },
                h(
                  "div",
                  { style: { display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 } },
                  h("span", { style: { fontWeight: 600 } }, n.title),
                  h("span", null, actions)
                ),
                h("div", { style: Object.assign({ fontSize: 11 }, muted) }, n.mtime + (n.author ? " · " + n.author : "")),
                isOpen ? h("div", { style: { whiteSpace: "pre-wrap", marginTop: 4 } }, st.expandedContent) : null
              )
            );
          })(st.notes[i]);
        }
        kids.push(h("div", { key: "rows" }, rows.length ? rows : h("div", { style: muted }, "还没有沉淀笔记。")));
      }
      return h("div", { key: "deposit", style: { marginTop: 14, borderTop: "1px solid var(--dsw-alias-border-l2, #ccd0d5)", paddingTop: 10 } }, kids);
    }

    function KbSection() {
      var pair = React.useState({ phase: "idle", q: "", hits: [], stats: null, message: "", truncated: false });
      var st = pair[0];
      var setSt = pair[1];
      var inputRef = React.useRef(null);

      function run(q) {
        var query = String(q == null ? "" : q).trim();
        setSt({ phase: "loading", q: query, hits: [], stats: null, message: "", truncated: false });
        fetch("/portal/api/kb/search?q=" + encodeURIComponent(query))
          .then(function (r) {
            if (!r.ok) throw new Error("HTTP " + r.status);
            return r.json();
          })
          .then(function (d) {
            setSt({ phase: "ready", q: query, hits: d.hits || [], stats: d.stats || null, message: "", truncated: d.truncated === true });
          })
          .catch(function (e) {
            setSt({ phase: "error", q: query, hits: [], stats: null, message: String((e && e.message) || e), truncated: false });
          });
      }
      React.useEffect(function () {
        run("");
      }, []);

      var input = h("input", {
        ref: inputRef,
        placeholder: "要查什么？（关键词）",
        style: {
          flex: 1,
          padding: "8px 10px",
          border: "1px solid var(--dsw-alias-border-l2, #ccd0d5)",
          borderRadius: 8,
          background: "var(--dsw-alias-bg-layer-1, #fff)",
          color: "inherit",
          fontSize: 13,
        },
        onKeyDown: function (e) {
          if (e.key === "Enter") run(e.target.value);
        },
      });

      var kids = [
        h(
          "div",
          { key: "bar", style: { display: "flex", gap: 8 } },
          input,
          h(
            "button",
            {
              onClick: function () {
                run(inputRef.current ? inputRef.current.value : "");
              },
              style: btnDark,
            },
            "查询"
          )
        ),
      ];

      if (st.phase === "error") {
        kids.push(
          h("div", { key: "err", style: muted }, "读不到知识库（" + st.message + "）。本面板需从门户打开（经登录会话访问服务器知识库）。")
        );
      }
      if (st.phase === "ready") {
        if (st.q) {
          kids.push(h("div", { key: "cnt", style: muted }, "命中 " + st.hits.length + " 条" + (st.truncated ? "（已截断）" : "")));
          var hitNodes = [];
          for (var i = 0; i < st.hits.length; i++) {
            hitNodes.push(
              h(
                "div",
                { key: "k" + i, style: rowBase },
                h("div", { style: Object.assign({ fontSize: 12 }, muted) }, st.hits[i].file + " : " + st.hits[i].line),
                h("div", null, st.hits[i].text)
              )
            );
          }
          if (!hitNodes.length) kids.push(h("div", { key: "none", style: muted }, "没有命中。试试更短的关键词。"));
          kids.push(h("div", { key: "hits" }, hitNodes));
        }
      }
      if (st.stats) {
        kids.push(
          h(
            "div",
            { key: "stats", style: muted },
            "知识库：" + st.stats.files + " 个文件 · " + (st.stats.updatedAt ? "最后更新 " + st.stats.updatedAt.slice(0, 16).replace("T", " ") + "（UTC）" : "空（把文档放进 kb 目录即可）")
          )
        );
      }
      kids.push(h("div", { key: "tip", style: muted }, "把文档放进服务器 ~/desk-data/kb（目录内有 README）；会话里的 agent 也能直接读它。"));
      kids.push(h(KbDeposit, { key: "deposit" }));
      return h("div", { style: wrap }, kids);
    }

    function DriveSection() {
      var pair = React.useState({ phase: "loading", path: "", entries: [], message: "" });
      var st = pair[0];
      var setSt = pair[1];
      var fileRef = React.useRef(null);

      function load(path) {
        var p = String(path == null ? "" : path);
        setSt({ phase: "loading", path: p, entries: [], message: "" });
        fetch("/portal/api/drive/list?path=" + encodeURIComponent(p))
          .then(function (r) {
            if (!r.ok) throw new Error("HTTP " + r.status);
            return r.json();
          })
          .then(function (d) {
            setSt({ phase: "ready", path: d.path != null ? d.path : p, entries: d.entries || [], message: "" });
          })
          .catch(function (e) {
            setSt({ phase: "error", path: p, entries: [], message: String((e && e.message) || e) });
          });
      }
      React.useEffect(function () {
        load("");
      }, []);

      function upload(files) {
        var f = files && files[0];
        if (!f) return;
        setSt({ phase: "loading", path: st.path, entries: st.entries, message: "上传中：" + f.name + " …" });
        fetch("/portal/api/drive/upload?path=" + encodeURIComponent(st.path) + "&name=" + encodeURIComponent(f.name), {
          method: "POST",
          body: f,
        })
          .then(function (r) {
            if (!r.ok) throw new Error("HTTP " + r.status);
            return r.json();
          })
          .then(function () {
            load(st.path);
          })
          .catch(function (e) {
            setSt({ phase: "ready", path: st.path, entries: st.entries, message: "上传失败：" + String((e && e.message) || e) });
          });
      }

      var segs = st.path.split("/").filter(function (s) {
        return s;
      });
      var crumbs = [
        h(
          "a",
          {
            key: "c0",
            href: "#",
            onClick: function (e) {
              e.preventDefault();
              load("");
            },
            style: crumb,
          },
          "公司盘"
        ),
      ];
      var acc = "";
      for (var i = 0; i < segs.length; i++) {
        acc = acc ? acc + "/" + segs[i] : segs[i];
        crumbs.push(h("span", { key: "sep" + i, style: muted }, " / "));
        crumbs.push(
          h(
            "a",
            {
              key: "c" + i,
              href: "#",
              onClick: (function (p) {
                return function (e) {
                  e.preventDefault();
                  load(p);
                };
              })(acc),
              style: crumb,
            },
            segs[i]
          )
        );
      }

      var bar = h(
        "div",
        { key: "bar", style: { display: "flex", gap: 8, alignItems: "center" } },
        h(
          "button",
          {
            onClick: function () {
              load(st.path);
            },
            style: btnLight,
          },
          "刷新"
        ),
        h(
          "button",
          {
            onClick: function () {
              if (fileRef.current) fileRef.current.click();
            },
            style: btnDark,
          },
          "上传文件"
        ),
        h("input", {
          ref: fileRef,
          type: "file",
          style: { display: "none" },
          onChange: function (e) {
            upload(e.target.files);
            e.target.value = "";
          },
        })
      );

      var kids = [h("div", { key: "crumbs", style: { fontSize: 12 } }, crumbs), bar];
      if (st.message && st.phase !== "error") kids.push(h("div", { key: "msg", style: muted }, st.message));
      if (st.phase === "error") {
        kids.push(h("div", { key: "err", style: muted }, "读不到公司盘（" + st.message + "）。本面板需从门户打开（经登录会话访问服务器文件区）。"));
      } else if (st.entries.length) {
        var rowNodes = [];
        for (var j = 0; j < st.entries.length; j++) {
          var en = st.entries[j];
          if (en.dir) {
            rowNodes.push(
              h(
                "div",
                {
                  key: "d" + j,
                  onClick: (function (p) {
                    return function () {
                      load(p);
                    };
                  })(st.path ? st.path + "/" + en.name : en.name),
                  style: Object.assign({ cursor: "pointer" }, rowBase),
                },
                "📁 " + en.name + " /"
              )
            );
          } else {
            rowNodes.push(
              h(
                "div",
                { key: "f" + j, style: rowBase },
                h(
                  "a",
                  {
                    href: "/portal/api/drive/download?path=" + encodeURIComponent(st.path ? st.path + "/" + en.name : en.name),
                    style: crumb,
                  },
                  "📄 " + en.name
                ),
                h("span", { style: Object.assign({ marginLeft: 8, fontSize: 12 }, muted) }, fmtSize(en.size))
              )
            );
          }
        }
        kids.push(h("div", { key: "rows" }, rowNodes));
      } else if (st.phase === "ready") {
        kids.push(h("div", { key: "empty", style: muted }, "（空文件夹：点「上传文件」，或把文件放进服务器 ~/desk-data/drive）"));
      }
      kids.push(
        h(
          "div",
          { key: "tip", style: muted },
          "服务器路径 ~/desk-data/drive（Windows：\\\\wsl.localhost\\Ubuntu\\home\\yangc\\desk-data\\drive）；单文件上限 50MB。"
        )
      );
      return h("div", { style: wrap }, kids);
    }

    function AdminSection() {
      var dataPair = React.useState({ phase: "loading", members: [], channels: [], trend: [], message: "" });
      var data = dataPair[0];
      var setData = dataPair[1];
      var msgPair = React.useState({ kind: "", text: "" });
      var msg = msgPair[0];
      var setMsg = msgPair[1];
      var keyPair = React.useState(null);
      var keyInfo = keyPair[0];
      var setKeyInfo = keyPair[1];

      var uRef = React.useRef(null);
      var pRef = React.useRef(null);
      var bRef = React.useRef(null);
      var chNameRef = React.useRef(null);
      var chUrlRef = React.useRef(null);
      var chKeyRef = React.useRef(null);
      var chModelsRef = React.useRef(null);
      var chPricesRef = React.useRef(null);
      var chNoteRef = React.useRef(null);

      function load(quiet) {
        if (!quiet) setData({ phase: "loading", members: [], channels: [], message: "" });
        fetch("/portal/api/admin/overview", { headers: { accept: "application/json" } })
          .then(function (r) {
            if (r.status === 403) throw new Error("NOPERM");
            if (r.status === 401) throw new Error("NOLOGIN");
            if (!r.ok) throw new Error("HTTP " + r.status);
            return r.json();
          })
          .then(function (d) {
            setData({ phase: "ready", members: d.members || [], channels: d.channels || [], trend: d.trend || [], message: "" });
          })
          .catch(function (e) {
            setData({ phase: "error", members: [], channels: [], message: String((e && e.message) || e) });
          });
      }
      React.useEffect(function () {
        load(false);
      }, []);

      function post(path, body, okText) {
        setMsg({ kind: "info", text: "处理中…" });
        return fetch(path, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) })
          .then(function (r) {
            return r.json().then(function (d) {
              return { status: r.status, d: d };
            });
          })
          .then(function (res) {
            if (res.status !== 200) {
              setMsg({ kind: "err", text: (res.d && res.d.error) || "HTTP " + res.status });
              return null;
            }
            setMsg({ kind: "ok", text: okText });
            load(true);
            return res.d;
          })
          .catch(function (e) {
            setMsg({ kind: "err", text: String((e && e.message) || e) });
            return null;
          });
      }

      if (data.phase === "loading") return h("div", { style: wrap }, "读取成员与通道中…");
      if (data.phase === "error") {
        if (data.message === "NOPERM")
          return h(
            "div",
            { style: wrap },
            h("div", null, "本页仅管理员可用。"),
            h("div", { style: muted }, "用管理员账号从门户登录后，在工作台设置里管理成员与模型通道。")
          );
        return h(
          "div",
          { style: wrap },
          h("div", null, "读不到管理数据（" + data.message + "）。"),
          h("div", { style: muted }, "请从门户地址打开工作台（经登录会话）再试；直连实例端口时不可用。")
        );
      }

      var adminCount = 0;
      for (var i = 0; i < data.members.length; i++) if (data.members[i].role === "admin") adminCount++;

      var memberRows = [];
      for (var m = 0; m < data.members.length; m++) {
        var u = data.members[m];
        var ops;
        if (u.role === "admin" && adminCount <= 1) {
          ops = h("span", { style: Object.assign({ fontSize: 12 }, muted) }, "唯一管理员");
        } else {
          ops = h(
            "button",
            {
              style: btnDanger,
              onClick: (function (name) {
                return function () {
                  if (!window.confirm("删除成员 " + name + "？\n将吊销其虚拟钥匙并清除登录会话（不可撤销；历史用量保留在账本）。")) return;
                  post("/portal/api/admin/member-delete", { username: name }, "已删除成员：" + name);
                };
              })(u.username),
            },
            "删除"
          );
        }
        memberRows.push(
          h(
            "div",
            { key: "m" + m, style: rowBase },
            h(
              "div",
              { style: { display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 } },
              h(
                "span",
                null,
                u.username + " ",
                h("span", { style: Object.assign({ fontSize: 12 }, muted) }, u.role + (u.status && u.status !== "active" ? " · " + u.status : ""))
              ),
              ops
            ),
            h(
              "div",
              { style: Object.assign({ fontSize: 12 }, muted) },
              "#" + u.id + " · 实例 " + (u.port || "-") + " · 预算 " + (u.budget != null ? "¥" + u.budget : "不限") + " · 建 " + String(u.createdAt || "").slice(0, 10)
            ),
            h(
              "div",
              { style: Object.assign({ fontSize: 12 }, muted) },
              "本月 " + fmt(u.monthCost) + " / " + u.monthEvents + " 次 · 近 7 天 " + fmt(u.week7) + " · " + (u.online ? "● 活跃会话" : "○ 无会话") + " · 最后登录 " + (u.lastLogin ? String(u.lastLogin).slice(5, 16) : "从未")
            )
          )
        );
      }

      var chRows = [];
      for (var c = 0; c < data.channels.length; c++) {
        var ch = data.channels[c];
        chRows.push(
          h(
            "div",
            { key: "c" + c, style: rowBase },
            h(
              "div",
              { style: { display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 } },
              h("span", null, ch.name + " ", h("span", { style: Object.assign({ fontSize: 12 }, muted) }, ch.enabled ? "启用" : "停用")),
              h(
                "span",
                { style: { display: "flex", gap: 6 } },
                h(
                  "button",
                  {
                    style: btnSmall,
                    onClick: (function (name, on) {
                      return function () {
                        post("/portal/api/admin/channel-toggle", { name: name }, "通道已" + (on ? "停用" : "启用") + "：" + name);
                      };
                    })(ch.name, ch.enabled),
                  },
                  ch.enabled ? "停用" : "启用"
                ),
                h(
                  "button",
                  {
                    style: btnDanger,
                    onClick: (function (name) {
                      return function () {
                        if (!window.confirm("删除通道 " + name + "？")) return;
                        post("/portal/api/admin/channel-delete", { name: name }, "通道已删除：" + name);
                      };
                    })(ch.name),
                  },
                  "删除"
                )
              )
            ),
            h(
              "div",
              { style: Object.assign({ fontSize: 12 }, muted) },
              ch.models.join(", ") + (ch.baseUrl ? " · " + ch.baseUrl : "") + (ch.keyPrefix ? " · key " + ch.keyPrefix : "")
            )
          )
        );
      }

      var kids = [];
      var trend = data.trend || [];
      var maxV = 0;
      for (var ti = 0; ti < trend.length; ti++) if (trend[ti].s > maxV) maxV = trend[ti].s;
      var total7 = 0;
      for (var tj = 0; tj < trend.length; tj++) total7 += trend[tj].s;
      var barNodes = [];
      for (var tk = 0; tk < trend.length; tk++) {
        var t = trend[tk];
        barNodes.push(
          h(
            "div",
            { key: "bar" + tk, style: { display: "flex", flexDirection: "column", alignItems: "center", gap: 2 } },
            h("div", {
              style: {
                width: 16,
                height: Math.max(2, Math.round((t.s / (maxV || 1)) * 44)),
                background: "var(--dsw-alias-state-business-primary, #4f7cf7)",
                borderRadius: 3,
              },
            }),
            h("div", { style: { fontSize: 9, color: "var(--dsw-alias-label-tertiary, #65676b)" } }, t.d)
          )
        );
      }
      kids.push(
        h(
          "div",
          { key: "trend" },
          h("div", { style: { fontWeight: 600 } }, "近 7 天团队用量 · 合计 " + fmt(total7)),
          h("div", { style: { display: "flex", gap: 6, alignItems: "flex-end" } }, barNodes)
        )
      );
      kids.push(h("div", { key: "t1", style: { fontSize: 15, fontWeight: 700 } }, "成员（" + data.members.length + "）"));
      kids.push(h("div", { key: "mr", style: {} }, memberRows));
      kids.push(
        h(
          "div",
          { key: "mnf", style: { display: "flex", flexDirection: "column", gap: 6, marginTop: 4 } },
          h("div", { style: { fontWeight: 600 } }, "新建成员"),
          h("input", { ref: uRef, placeholder: "用户名（小写字母数字，2-32 位）", style: field }),
          h("input", { ref: pRef, placeholder: "初始密码（至少 6 位）", type: "password", style: field }),
          h("input", { ref: bRef, placeholder: "月预算 CNY（可留空 = 不限）", style: field }),
          h(
            "button",
            {
              style: btnDark,
              onClick: function () {
                var username = uRef.current ? uRef.current.value.trim() : "";
                var password = pRef.current ? pRef.current.value : "";
                var budget = bRef.current ? bRef.current.value.trim() : "";
                post("/portal/api/admin/member-create", { username: username, password: password, budget: budget }, "成员已创建：" + username).then(function (d) {
                  if (d && d.key) {
                    setKeyInfo({ username: d.username, key: d.key });
                    if (pRef.current) pRef.current.value = "";
                  }
                });
              },
            },
            "创建成员"
          )
        )
      );
      if (keyInfo) {
        kids.push(
          h(
            "div",
            { key: "key", style: { border: "1px solid var(--dsw-alias-border-l2, #ccd0d5)", borderRadius: 8, padding: 10, display: "flex", flexDirection: "column", gap: 8 } },
            h("div", null, "新成员虚拟钥匙（只显示这一次，请立即复制交给 " + keyInfo.username + "）："),
            h("div", { style: codeBox }, keyInfo.key),
            h(
              "div",
              { style: { display: "flex", gap: 8 } },
              h(
                "button",
                {
                  style: btnDark,
                  onClick: function () {
                    if (navigator.clipboard && navigator.clipboard.writeText) {
                      navigator.clipboard.writeText(keyInfo.key).then(
                        function () {
                          setMsg({ kind: "ok", text: "已复制到剪贴板" });
                        },
                        function () {
                          setMsg({ kind: "err", text: "复制失败，请手动选中复制" });
                        }
                      );
                    } else {
                      setMsg({ kind: "err", text: "复制失败，请手动选中复制" });
                    }
                  },
                },
                "复制"
              ),
              h(
                "button",
                {
                  style: btnLight,
                  onClick: function () {
                    setKeyInfo(null);
                  },
                },
                "已交给成员，清除显示"
              )
            )
          )
        );
      }
      kids.push(h("div", { key: "t2", style: { fontSize: 15, fontWeight: 700, marginTop: 8 } }, "模型通道（" + data.channels.length + "）"));
      kids.push(h("div", { key: "cr", style: {} }, chRows.length ? chRows : h("div", { style: muted }, "暂无外部通道（默认走 DeepSeek 官方）")));
      kids.push(
        h(
          "div",
          { key: "cnf", style: { display: "flex", flexDirection: "column", gap: 6, marginTop: 4 } },
          h("div", { style: { fontWeight: 600 } }, "加入通道"),
          h("input", { ref: chNameRef, placeholder: "名称（英文小写，如 kimi）", style: field }),
          h("input", { ref: chUrlRef, placeholder: "Base URL（OpenAI 兼容，含 /v1）", style: field }),
          h("input", { ref: chKeyRef, placeholder: "API Key（sk-...）", type: "password", style: field }),
          h("input", { ref: chModelsRef, placeholder: "模型名（英文逗号分隔）", style: field }),
          h("input", { ref: chPricesRef, placeholder: "价目表 JSON（可选，¥/百万 tokens）", style: field }),
          h("input", { ref: chNoteRef, placeholder: "备注（可选）", style: field }),
          h(
            "button",
            {
              style: btnDark,
              onClick: function () {
                var name = chNameRef.current ? chNameRef.current.value.trim() : "";
                var baseUrl = chUrlRef.current ? chUrlRef.current.value.trim() : "";
                var apiKey = chKeyRef.current ? chKeyRef.current.value.trim() : "";
                var models = chModelsRef.current ? chModelsRef.current.value : "";
                var prices = chPricesRef.current ? chPricesRef.current.value.trim() : "";
                var note = chNoteRef.current ? chNoteRef.current.value.trim() : "";
                var payload = { name: name, base_url: baseUrl, api_key: apiKey, models: models, note: note };
                if (prices) {
                  try {
                    payload.prices = JSON.parse(prices);
                  } catch (e) {
                    setMsg({ kind: "err", text: "价目表 JSON 解析失败" });
                    return;
                  }
                }
                post("/portal/api/admin/channel-create", payload, "通道已加入：" + name);
              },
            },
            "加入通道"
          )
        )
      );
      if (msg.kind) {
        kids.push(
          h(
            "div",
            { key: "msg", style: msg.kind === "err" ? { color: "#c0392b", fontSize: 12 } : Object.assign({ fontSize: 12 }, muted) },
            msg.text
          )
        );
      }
      kids.push(
        h(
          "div",
          { key: "tip", style: muted },
          "删除成员不可撤销；其历史用量保留在账本。成员预算到 80% / 100% 时会经「通知」通道自动提醒管理员。若该成员配了实例服务，可在服务器用 scripts/desk.sh 停掉。通道 Key 只存在服务器数据库。"
        )
      );
      return h("div", { style: Object.assign({}, wrap, { maxWidth: 640 }) }, kids);
    }

    function NotifySection() {
      var dataPair = React.useState({ phase: "loading", routes: [], log: [], reminders: [], message: "" });
      var data = dataPair[0];
      var setData = dataPair[1];
      var msgPair = React.useState({ kind: "", text: "" });
      var msg = msgPair[0];
      var setMsg = msgPair[1];
      var testPair = React.useState(null);
      var testRes = testPair[0];
      var setTestRes = testPair[1];
      var kindPair = React.useState("webhook");
      var kind = kindPair[0];
      var setKind = kindPair[1];
      var nRef = React.useRef(null);
      var tRef = React.useRef(null);

      function load() {
        fetch("/portal/api/admin/notify", { headers: { accept: "application/json" } })
          .then(function (r) {
            if (r.status === 403) throw new Error("NOPERM");
            if (r.status === 401) throw new Error("NOLOGIN");
            if (!r.ok) throw new Error("HTTP " + r.status);
            return r.json();
          })
          .then(function (d) {
            setData({ phase: "ready", routes: d.routes || [], log: d.log || [], reminders: (d.reminders && d.reminders.pending) || [], message: "" });
          })
          .catch(function (e) {
            setData({ phase: "error", routes: [], log: [], message: String((e && e.message) || e) });
          });
      }
      React.useEffect(function () {
        load();
      }, []);

      function post(path, body, okText) {
        setMsg({ kind: "info", text: "处理中…" });
        return fetch(path, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) })
          .then(function (r) {
            return r.json().then(function (d) {
              return { status: r.status, d: d };
            });
          })
          .then(function (res) {
            if (res.status !== 200) {
              setMsg({ kind: "err", text: (res.d && res.d.error) || "HTTP " + res.status });
              return null;
            }
            setMsg({ kind: "ok", text: okText });
            load();
            return res.d;
          })
          .catch(function (e) {
            setMsg({ kind: "err", text: String((e && e.message) || e) });
            return null;
          });
      }

      if (data.phase === "loading") return h("div", { style: wrap }, "读取通知通道中…");
      if (data.phase === "error") {
        if (data.message === "NOPERM")
          return h(
            "div",
            { style: wrap },
            h("div", null, "本页仅管理员可用。"),
            h("div", { style: muted }, "用管理员账号从门户登录后配置通知通道。")
          );
        return h(
          "div",
          { style: wrap },
          h("div", null, "读不到通知配置（" + data.message + "）。"),
          h("div", { style: muted }, "请从门户地址打开工作台（经登录会话）再试。")
        );
      }

      var routeRows = [];
      for (var i = 0; i < data.routes.length; i++) {
        var r = data.routes[i];
        routeRows.push(
          h(
            "div",
            { key: "r" + i, style: rowBase },
            h(
              "div",
              { style: { display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 } },
              h(
                "span",
                null,
                r.name + " ",
                h("span", { style: Object.assign({ fontSize: 12 }, muted) }, (r.kind === "webhook" ? "webhook" : "hermes") + (r.enabled === 1 ? " · 启用" : " · 停用"))
              ),
              h(
                "span",
                { style: { display: "flex", gap: 6 } },
                h(
                  "button",
                  {
                    style: btnSmall,
                    onClick: (function (name) {
                      return function () {
                        post("/portal/api/admin/notify/route-toggle", { name: name }, "已切换：" + name);
                      };
                    })(r.name),
                  },
                  r.enabled === 1 ? "停用" : "启用"
                ),
                h(
                  "button",
                  {
                    style: btnDanger,
                    onClick: (function (name) {
                      return function () {
                        if (!window.confirm("删除通知通道 " + name + "？")) return;
                        post("/portal/api/admin/notify/route-delete", { name: name }, "已删除：" + name);
                      };
                    })(r.name),
                  },
                  "删除"
                )
              )
            ),
            h("div", { style: Object.assign({ fontSize: 12 }, muted) }, String(r.target || "").length > 72 ? String(r.target).slice(0, 72) + "…" : String(r.target || ""))
          )
        );
      }

      var logRows = [];
      for (var j = 0; j < Math.min(data.log.length, 8); j++) {
        var g = data.log[j];
        logRows.push(
          h(
            "div",
            { key: "l" + j, style: { display: "flex", gap: 8, fontSize: 12, padding: "3px 0" } },
            h("span", { style: muted }, String(g.ts || "").slice(5, 16)),
            h("span", null, String(g.route_name || "-")),
            h(
              "span",
              { style: g.ok === 1 ? muted : { color: "#c0392b" } },
              (g.ok === 1 ? "✓ " : "✗ ") + String(g.title || g.text || "").slice(0, 24)
            )
          )
        );
      }

      var kids = [];
      kids.push(h("div", { key: "t1", style: { fontSize: 15, fontWeight: 700 } }, "通知通道（" + data.routes.length + "）"));
      kids.push(h("div", { key: "rr", style: {} }, routeRows.length ? routeRows : h("div", { style: muted }, "还没有通知通道——加一个，工作台就能往外推消息（提醒 / 告警 / 任务完成）。")));
      kids.push(
        h(
          "div",
          { key: "nf", style: { display: "flex", flexDirection: "column", gap: 6, marginTop: 4 } },
          h("div", { style: { fontWeight: 600 } }, "添加通道"),
          h(
            "select",
            {
              value: kind,
              onChange: function (e) {
                setKind(e.target.value);
              },
              style: field,
            },
            h("option", { value: "webhook" }, "webhook —— 企业微信 / 钉钉 / 任意 HTTP 端点"),
            h("option", { value: "hermes" }, "hermes —— 经 通知平台（weixin 微信等）")
          ),
          h("input", { ref: nRef, placeholder: "名称（英文小写，如 wecom-group / wechat-me）", style: field }),
          h("input", {
            ref: tRef,
            placeholder: kind === "webhook" ? "https://qyapi.weixin.qq.com/cgi-bin/webhook/send?key=…" : "weixin",
            style: field,
          }),
          h(
            "button",
            {
              style: btnDark,
              onClick: function () {
                var name = nRef.current ? nRef.current.value.trim() : "";
                var target = tRef.current ? tRef.current.value.trim() : "";
                post("/portal/api/admin/notify/route-add", { name: name, kind: kind, target: target }, "通道已添加：" + name).then(function (d) {
                  if (d && tRef.current) tRef.current.value = "";
                });
              },
            },
            "添加通道"
          )
        )
      );
      kids.push(
        h(
          "div",
          { key: "test", style: { display: "flex", alignItems: "center", gap: 8, marginTop: 4 } },
          h(
            "button",
            {
              style: btnLight,
              onClick: function () {
                setTestRes({ phase: "loading" });
                fetch("/portal/api/admin/notify-test", { method: "POST", headers: { "content-type": "application/json" }, body: "{}" })
                  .then(function (r) {
                    return r.json();
                  })
                  .then(function (d) {
                    setTestRes({ phase: "ready", results: d.results || [] });
                    load();
                  })
                  .catch(function (e) {
                    setTestRes({ phase: "ready", results: [{ route: "-", ok: false, info: String((e && e.message) || e) }] });
                  });
              },
            },
            "发送测试通知"
          ),
          h("span", { style: Object.assign({ fontSize: 12 }, muted) }, "会发往所有启用通道（含手机）")
        )
      );
      if (testRes && testRes.phase === "ready") {
        var trNodes = [];
        for (var k = 0; k < testRes.results.length; k++) {
          var tr = testRes.results[k];
          trNodes.push(
            h(
              "div",
              { key: "tr" + k, style: { fontSize: 12, color: tr.ok ? undefined : "#c0392b" } },
              (tr.ok ? "✓ " : "✗ ") + tr.route + "：" + tr.info
            )
          );
        }
        kids.push(h("div", { key: "trs", style: { display: "flex", flexDirection: "column", gap: 3 } }, trNodes));
      }
      var remRows = [];
      for (var q = 0; q < (data.reminders || []).length; q++) {
        var rem = data.reminders[q];
        remRows.push(
          h(
            "div",
            { key: "rem" + q, style: rowBase },
            h(
              "div",
              { style: { display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 } },
              h(
                "span",
                null,
                fmtTs(rem.at_epoch) + " ",
                h("span", { style: Object.assign({ fontSize: 12 }, muted) }, String(rem.title || rem.text || "").slice(0, 30))
              ),
              h(
                "button",
                {
                  style: btnSmall,
                  onClick: (function (id) {
                    return function () {
                      post("/portal/api/admin/reminders/rm", { id: id }, "已删除提醒 #" + id);
                    };
                  })(rem.id),
                },
                "删除"
              )
            )
          )
        );
      }
      kids.push(h("div", { key: "t3", style: { fontSize: 15, fontWeight: 700, marginTop: 8 } }, "定时提醒（" + (data.reminders || []).length + "）"));
      kids.push(
        h(
          "div",
          { key: "rems", style: {} },
          remRows.length ? remRows : h("div", { style: muted }, '没有待发提醒。设置：让 agent 跑 ~/desk-data/bin/desk-remind "10:00" "内容"')
        )
      );
      if (msg.kind) {
        kids.push(
          h(
            "div",
            { key: "msg", style: msg.kind === "err" ? { color: "#c0392b", fontSize: 12 } : Object.assign({ fontSize: 12 }, muted) },
            msg.text
          )
        );
      }
      kids.push(h("div", { key: "t2", style: { fontSize: 15, fontWeight: 700, marginTop: 8 } }, "最近发送"));
      kids.push(h("div", { key: "logs", style: {} }, logRows.length ? logRows : h("div", { style: muted }, "还没有发送记录")));
      kids.push(
        h(
          "div",
          { key: "tip", style: muted },
          "agent 侧：desk-notify \"标题\" \"正文\" 立即发；desk-remind \"10:00\" \"内容\" 定时发（到点自动推，支持 +30m / 明天 09:00）。企业微信群机器人：群设置 → 群机器人 → 复制 Webhook 地址，粘进上面的通道即可。"
        )
      );
      return h("div", { style: Object.assign({}, wrap, { maxWidth: 640 }) }, kids);
    }

    function OpsSection() {
      var pair = React.useState({ phase: "loading", message: "" });
      var st = pair[0];
      var setSt = pair[1];

      function fmtBytes(n) {
        var v = Number(n || 0);
        if (v < 1024) return v + " B";
        if (v < 1024 * 1024) return (v / 1024).toFixed(1) + " KB";
        if (v < 1024 * 1024 * 1024) return (v / 1024 / 1024).toFixed(1) + " MB";
        return (v / 1024 / 1024 / 1024).toFixed(2) + " GB";
      }
      function fmtDur(sec) {
        sec = Math.round(Number(sec || 0));
        var d = Math.floor(sec / 86400);
        var h = Math.floor((sec % 86400) / 3600);
        var mm = Math.floor((sec % 3600) / 60);
        if (d > 0) return d + " 天 " + h + " 小时";
        if (h > 0) return h + " 小时 " + mm + " 分";
        return mm + " 分钟";
      }
      function load() {
        setSt({ phase: "loading", message: "" });
        fetch("/portal/api/admin/ops", { headers: { accept: "application/json" } })
          .then(function (r) {
            if (r.status === 403) throw new Error("NOPERM");
            if (r.status === 401) throw new Error("NOLOGIN");
            if (!r.ok) throw new Error("HTTP " + r.status);
            return r.json();
          })
          .then(function (d) {
            setSt({ phase: "ready", data: d, message: "" });
          })
          .catch(function (e) {
            setSt({ phase: "error", message: String((e && e.message) || e) });
          });
      }
      React.useEffect(function () {
        load();
      }, []);

      if (st.phase === "loading") return h("div", { style: wrap }, "读取运维状态中…");
      if (st.phase === "error") {
        if (st.message === "NOPERM")
          return h("div", { style: wrap }, h("div", null, "本页仅管理员可用。"), h("div", { style: muted }, "用管理员账号从门户登录后查看。"));
        return h("div", { style: wrap }, h("div", null, "读不到运维数据（" + st.message + "）。"), h("div", { style: muted }, "请从门户地址打开工作台再试。"));
      }

      var d = st.data;
      var kids = [];

      var svcRows = (d.services || []).map(function (s, i) {
        return h(
          "div",
          { key: "s" + i, style: { display: "flex", justifyContent: "space-between", fontSize: 12, padding: "3px 0" } },
          h("span", null, (s.active ? "● " : "○ ") + s.name),
          h("span", { style: muted }, (s.pid ? "pid " + s.pid + " · " : "") + String(s.since || "").slice(4, 20))
        );
      });
      kids.push(h("div", { key: "svc" }, h("div", { style: { fontWeight: 600 } }, "服务（systemd）"), svcRows));

      var http = d.http || {};
      var httpNodes = Object.keys(http).map(function (k, i) {
        var v = http[k];
        var ok = v === 200 || v === 302;
        return h("span", { key: "h" + i, style: { marginRight: 12, fontSize: 12, color: ok ? undefined : "#c0392b" } }, k + " → " + v);
      });
      kids.push(h("div", { key: "http" }, h("div", { style: { fontWeight: 600 } }, "端口探活"), h("div", null, httpNodes)));

      var b = d.backup || {};
      kids.push(
        h(
          "div",
          { key: "bk" },
          h("div", { style: { fontWeight: 600 } }, "备份（" + (b.count || 0) + " 份 · 合计 " + fmtBytes(b.totalBytes) + "）"),
          h(
            "div",
            { style: muted },
            b.last
              ? "最后：" + b.last.name + " · " + fmtBytes(b.last.size) + " · " + (b.last.mtimeLocal || String(b.last.mtime || "").slice(5, 16).replace("T", " "))
              : "（还没有备份产物；定时器每日 03:40 跑）"
          )
        )
      );

      var dk = d.disk || {};
      var dd = d.data || {};
      kids.push(
        h(
          "div",
          { key: "dk" },
          h("div", { style: { fontWeight: 600 } }, "磁盘 / 数据"),
          h("div", { style: muted }, "空闲 " + fmtBytes(dk.free) + " / 共 " + fmtBytes(dk.total) + " · desk.db " + fmtBytes(dd.dbBytes)),
          h("div", { style: muted }, "知识库 " + fmtBytes(dd.kbBytes) + " · 公司盘 " + fmtBytes(dd.driveBytes))
        )
      );

      var hst = d.host || {};
      var dsk = d.desk || {};
      kids.push(
        h(
          "div",
          { key: "hst" },
          h("div", { style: { fontWeight: 600 } }, "主机 / 进程"),
          h(
            "div",
            { style: muted },
            "WSL 已运行 " + fmtDur(hst.uptime) + " · 内存 " + fmtBytes(Number(hst.totalmem || 0) - Number(hst.freemem || 0)) + " / " + fmtBytes(hst.totalmem) + " · load " + Number(hst.load1 || 0).toFixed(2)
          ),
          h("div", { style: muted }, "工作台进程 " + fmtDur(dsk.uptime) + " · node " + (dsk.node || ""))
        )
      );

      kids.push(h("div", { key: "rf" }, h("button", { style: btnLight, onClick: load }, "刷新")));
      return h("div", { style: Object.assign({}, wrap, { maxWidth: 640 }) }, kids);
    }

    function AnnounceBoard(props) {
      var wide = !!(props && props.wide);
      var dataPair = React.useState({ phase: "loading", role: "member", announcements: [], feedback: [] });
      var data = dataPair[0];
      var setData = dataPair[1];
      var openPair = React.useState(false);
      var open = openPair[0];
      var setOpen = openPair[1];
      var unreadPair = React.useState(0);
      var unread = unreadPair[0];
      var setUnread = unreadPair[1];
      var msgPair = React.useState({ kind: "", text: "" });
      var msg = msgPair[0];
      var setMsg = msgPair[1];
      var tRef = React.useRef(null);
      var bRef = React.useRef(null);
      var fRef = React.useRef(null);

      function load(markSeenNow) {
        fetch("/portal/api/announcements", { headers: { accept: "application/json" } })
          .then(function (r) {
            if (!r.ok) throw new Error("HTTP " + r.status);
            return r.json();
          })
          .then(function (d) {
            var ann = d.announcements || [];
            setData({ phase: "ready", role: d.role || "member", announcements: ann, feedback: d.feedback || [] });
            var m = 0;
            for (var i = 0; i < ann.length; i++) if (ann[i].id > m) m = ann[i].id;
            if (markSeenNow && m > 0) window.localStorage.setItem("desk-announce-seen", String(m));
            var seen = Number(window.localStorage.getItem("desk-announce-seen") || 0) || 0;
            var n = 0;
            for (var j = 0; j < ann.length; j++) if (ann[j].id > seen) n++;
            setUnread(n);
          })
          .catch(function () {
            setData({ phase: "error", role: "member", announcements: [], feedback: [] });
          });
      }
      React.useEffect(function () {
        load(false);
      }, []);

      function post(path, body, okText) {
        setMsg({ kind: "info", text: "处理中…" });
        fetch(path, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) })
          .then(function (r) {
            return r.json().then(function (d) {
              return { status: r.status, d: d };
            });
          })
          .then(function (res) {
            if (res.status !== 200) {
              setMsg({ kind: "err", text: (res.d && res.d.error) || "HTTP " + res.status });
              return;
            }
            setMsg({ kind: "ok", text: okText });
            if (tRef.current) tRef.current.value = "";
            if (bRef.current) bRef.current.value = "";
            if (fRef.current) fRef.current.value = "";
            load(true);
          })
          .catch(function (e) {
            setMsg({ kind: "err", text: String((e && e.message) || e) });
          });
      }

      function toggle() {
        var next = !open;
        setOpen(next);
        if (next) load(true);
      }

      var trigger = h(
        "button",
        { className: "ddb" + (wide ? "" : " rail"), onClick: toggle, title: "团队公告与意见反馈" },
        h("span", { className: "ic" }, "📢"),
        wide ? h("span", { className: "lbl" }, "公告") : null,
        wide && unread > 0 ? h("span", { className: "badge" }, unread) : null
      );
      if (!open) return h("div", null, trigger);

      var kids = [];
      if (data.phase === "loading") kids.push(h("div", { key: "ld", className: "empty" }, "读取中…"));
      if (data.phase === "error") kids.push(h("div", { key: "er", className: "empty" }, "读不到公告（需从门户地址打开且已登录）。"));
      if (data.phase === "ready") {
        if (data.role === "admin") {
          kids.push(h("div", { key: "nf-lb", className: "lb" }, "发布公告"));
          kids.push(
            h(
              "div",
              { key: "nf", className: "fm" },
              h("input", { ref: tRef, className: "inp", placeholder: "公告标题（可选）" }),
              h("textarea", { ref: bRef, className: "inp ta", placeholder: "公告内容…" }),
              h(
                "div",
                null,
                h(
                  "button",
                  {
                    className: "btn",
                    onClick: function () {
                      post("/portal/api/announcements/post", { title: tRef.current ? tRef.current.value : "", body: bRef.current ? bRef.current.value : "" }, "公告已发布");
                    },
                  },
                  "发布公告"
                )
              )
            )
          );
        }
        var anns = [];
        for (var i = 0; i < data.announcements.length; i++) {
          var a = data.announcements[i];
          anns.push(
            h(
              "div",
              { key: "a" + a.id, className: "it" },
              h("span", { className: "ico2" }, "📣"),
              h(
                "div",
                { className: "gr" },
                h(
                  "div",
                  { className: "th" },
                  h("span", { className: "t" }, a.title || "(无标题)"),
                  data.role === "admin"
                    ? h(
                        "button",
                        {
                          className: "mini",
                          onClick: (function (id) {
                            return function () {
                              if (window.confirm("删除该公告？")) post("/portal/api/announcements/rm", { id: id }, "已删除");
                            };
                          })(a.id),
                        },
                        "删除"
                      )
                    : null
                ),
                h("div", { className: "d" }, fmtAt(a.created_at) + (a.created_by ? " · " + a.created_by : "")),
                h("div", { className: "bd2" }, a.body)
              )
            )
          );
        }
        kids.push(h("div", { key: "anns", className: "list" }, anns.length ? anns : h("div", { className: "empty" }, "暂无公告")));
        kids.push(h("div", { key: "fdiv", className: "lb" }, "意见反馈" + (data.role === "admin" ? "（全员）" : "")));
        if (data.role !== "admin") {
          kids.push(
            h(
              "div",
              { key: "ff", className: "fm" },
              h("textarea", { ref: fRef, className: "inp ta", placeholder: "给管理员提意见 / 报问题…" }),
              h(
                "div",
                null,
                h(
                  "button",
                  {
                    className: "btn gh",
                    onClick: function () {
                      post("/portal/api/feedback", { text: fRef.current ? fRef.current.value : "" }, "反馈已提交，谢谢！");
                    },
                  },
                  "提交反馈"
                )
              )
            )
          );
        }
        var fbs = [];
        for (var j = 0; j < data.feedback.length; j++) {
          var fb = data.feedback[j];
          fbs.push(
            h(
              "div",
              { key: "fb" + fb.id, className: "it" },
              h("span", { className: "ico2" }, "💬"),
              h(
                "div",
                { className: "gr" },
                h(
                  "div",
                  { className: "th" },
                  h("span", { className: "d" }, (fb.username || "-") + " · " + fmtAt(fb.created_at)),
                  data.role === "admin"
                    ? h(
                        "button",
                        {
                          className: "mini",
                          onClick: (function (id) {
                            return function () {
                              post("/portal/api/feedback/rm", { id: id }, "已删除");
                            };
                          })(fb.id),
                        },
                        "删除"
                      )
                    : null
                ),
                h("div", { className: "bd2" }, fb.text)
              )
            )
          );
        }
        kids.push(h("div", { key: "fbs", className: "list" }, fbs.length ? fbs : h("div", { className: "empty" }, data.role === "admin" ? "暂无反馈" : "你还没有提过反馈")));
      }
      if (msg.kind) {
        kids.push(h("div", { key: "msg", className: "msg" + (msg.kind === "err" ? " err" : msg.kind === "ok" ? " ok" : "") }, msg.text));
      }
      return h(
        "div",
        null,
        trigger,
        h(
          "div",
          { key: "panel", className: "ddp" },
          h(
            "div",
            { className: "hd" },
            h("span", { className: "ico" }, "📢"),
            h("div", null, h("div", { className: "t1" }, "团队公告"), h("div", { className: "t2" }, "公告与意见反馈")),
            h("button", { className: "x", onClick: toggle }, "✕")
          ),
          h("div", { className: "bd" }, kids)
        )
      );
    }

    function AssistantsPanel(props) {
      var wide = !!(props && props.wide);
      var aPair = React.useState({ phase: "loading", presets: [] });
      var st = aPair[0];
      var setSt = aPair[1];
      var oPair = React.useState(false);
      var open = oPair[0];
      var setOpen = oPair[1];

      function load() {
        fetch("/portal/api/panel/presets", { headers: { accept: "application/json" } })
          .then(function (r) {
            if (!r.ok) throw new Error("HTTP " + r.status);
            return r.json();
          })
          .then(function (d) {
            setSt({ phase: "ready", presets: (d && d.presets) || [] });
          })
          .catch(function () {
            setSt({ phase: "error", presets: [] });
          });
      }
      React.useEffect(function () {
        load();
      }, []);

      function toggle() {
        var next = !open;
        setOpen(next);
        if (next) load();
      }

      var trigger = h(
        "button",
        { className: "ddb" + (wide ? "" : " rail"), onClick: toggle, title: "团队助理：Agent 预设一览（专家模式）" },
        h("span", { className: "ic" }, "🧑‍💼"),
        wide ? h("span", { className: "lbl" }, "助理") : null
      );
      if (!open) return h("div", null, trigger);

      var kids = [];
      if (st.phase === "loading") kids.push(h("div", { key: "ld", className: "empty" }, "读取中…"));
      if (st.phase === "error") kids.push(h("div", { key: "er", className: "empty" }, "读不到预设（请从门户地址打开且已登录）。"));
      if (st.phase === "ready") {
        if (!st.presets.length) {
          kids.push(h("div", { key: "none", className: "empty" }, "共享区还没有预设。"));
        } else {
          var rows = [];
          st.presets.forEach(function (p) {
            rows.push(
              h(
                "div",
                { key: "p" + p.id, className: "it" },
                h("span", { className: "ico2" }, "🤖"),
                h(
                  "div",
                  { className: "gr" },
                  h("div", { className: "th" }, h("span", { className: "t" }, p.name), p.codex ? h("span", { className: "bdg" }, "Codex 并行") : null),
                  h("div", { className: "d" }, p.description || p.id)
                )
              )
            );
          });
          kids.push(h("div", { key: "lb", className: "lb" }, "可用助理"));
          kids.push(h("div", { key: "rows", className: "list" }, rows));
        }
        kids.push(h("div", { key: "tip", className: "ft" }, "助理 = 预设人格与工具组合。默认用哪个：设置 → Agent 预设；共享区 presets/ 下可自行增减，新会话生效。"));
      }
      return h(
        "div",
        null,
        trigger,
        h(
          "div",
          { key: "panel", className: "ddp" },
          h(
            "div",
            { className: "hd" },
            h("span", { className: "ico" }, "🧑‍💼"),
            h("div", null, h("div", { className: "t1" }, "团队助理"), h("div", { className: "t2" }, "Agent 预设（专家模式）")),
            h("button", { className: "x", onClick: toggle }, "✕")
          ),
          h("div", { className: "bd" }, kids)
        )
      );
    }

    function SkillsConnPanel(props) {
      var wide = !!(props && props.wide);
      var sPair = React.useState({ phase: "loading", skills: [], items: [] });
      var st = sPair[0];
      var setSt = sPair[1];
      var tPair = React.useState("skills");
      var tab = tPair[0];
      var setTab = tPair[1];
      var oPair = React.useState(false);
      var open = oPair[0];
      var setOpen = oPair[1];
      var dPair = React.useState({ phase: "none", id: "", name: "", content: "" });
      var det = dPair[0];
      var setDet = dPair[1];

      function load() {
        Promise.all([
          fetch("/portal/api/panel/skills", { headers: { accept: "application/json" } }).then(function (r) {
            if (!r.ok) throw new Error("HTTP " + r.status);
            return r.json();
          }),
          fetch("/portal/api/panel/connectors", { headers: { accept: "application/json" } }).then(function (r) {
            if (!r.ok) throw new Error("HTTP " + r.status);
            return r.json();
          }),
        ])
          .then(function (rs) {
            setSt({ phase: "ready", skills: (rs[0] && rs[0].skills) || [], items: (rs[1] && rs[1].items) || [] });
          })
          .catch(function () {
            setSt({ phase: "error", skills: [], items: [] });
          });
      }
      React.useEffect(function () {
        load();
      }, []);

      function toggle() {
        var next = !open;
        setOpen(next);
        if (!next) setDet({ phase: "none", id: "", name: "", content: "" });
      }

      function viewSkill(sh) {
        setDet({ phase: "loading", id: sh.id, name: sh.name, content: "" });
        fetch("/portal/api/panel/skill?name=" + encodeURIComponent(sh.id), { headers: { accept: "application/json" } })
          .then(function (r) {
            return r.json();
          })
          .then(function (d) {
            if (d && d.error) setDet({ phase: "error", id: sh.id, name: sh.name, content: d.error });
            else setDet({ phase: "ready", id: sh.id, name: sh.name, content: (d && d.content) || "" });
          })
          .catch(function () {
            setDet({ phase: "error", id: sh.id, name: sh.name, content: "读取失败" });
          });
      }

      var trigger = h(
        "button",
        { className: "ddb" + (wide ? "" : " rail"), onClick: toggle, title: "专家技能库 + 连接器状态" },
        h("span", { className: "ic" }, "🧩"),
        wide ? h("span", { className: "lbl" }, "技能·连接器") : null
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
              className: "tb" + (tab === "skills" ? " on" : ""),
              onClick: function () {
                setTab("skills");
                setDet({ phase: "none", id: "", name: "", content: "" });
              },
            },
            "技能" + (st.phase === "ready" ? "（" + st.skills.length + "）" : "")
          ),
          h(
            "button",
            {
              className: "tb" + (tab === "conn" ? " on" : ""),
              onClick: function () {
                setTab("conn");
                setDet({ phase: "none", id: "", name: "", content: "" });
              },
            },
            "连接器" + (st.phase === "ready" ? "（" + st.items.length + "）" : "")
          )
        )
      );
      if (st.phase === "loading") kids.push(h("div", { key: "ld", className: "empty" }, "读取中…"));
      else if (st.phase === "error") kids.push(h("div", { key: "er", className: "empty" }, "读不到（请从门户地址打开且已登录）。"));
      else if (tab === "skills") {
        if (det.phase !== "none") {
          kids.push(
            h(
              "div",
              { key: "det-hd", className: "row", style: { marginBottom: 2 } },
              h(
                "button",
                {
                  className: "mini",
                  onClick: function () {
                    setDet({ phase: "none", id: "", name: "", content: "" });
                  },
                },
                "← 返回"
              ),
              h("span", { className: "t" }, det.name || det.id)
            )
          );
          if (det.phase === "loading") kids.push(h("div", { key: "dl", className: "empty" }, "读取中…"));
          else kids.push(h("pre", { key: "dc", className: "code" }, det.content));
        } else if (!st.skills.length) {
          kids.push(h("div", { key: "none", className: "empty" }, "共享技能库空空如也。"));
        } else {
          var rows = [];
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
                  sh.whenToUse ? h("div", { className: "d" }, "触发：" + sh.whenToUse) : null
                )
              )
            );
          });
          kids.push(h("div", { key: "rows", className: "list" }, rows));
          kids.push(h("div", { key: "tip", className: "ft" }, "点击任意技能查看全文；新增 = 往共享区 skills/ 放一个文件夹，各实例自动分发。"));
        }
      } else {
        var crows = [];
        st.items.forEach(function (it) {
          var dotCls = it.ok === true ? "dot ok" : it.ok === false ? "dot bad" : "dot off";
          crows.push(
            h(
              "div",
              { key: "c" + it.name, className: "it" },
              h("span", { className: dotCls }),
              h("div", { className: "gr" }, h("div", { className: "t" }, it.name), h("div", { className: "d" }, it.detail || ""))
            )
          );
        });
        kids.push(h("div", { key: "crows", className: "list" }, crows.length ? crows : h("div", { className: "empty" }, "暂无连接信息。")));
        kids.push(h("div", { key: "ctip", className: "ft" }, "状态为只读探测：绿 = 已接通，灰 = 未配置（可选），红 = 异常。"));
      }
      return h(
        "div",
        null,
        trigger,
        h(
          "div",
          { key: "panel", className: "ddp" },
          h(
            "div",
            { className: "hd" },
            h("span", { className: "ico" }, "🧩"),
            h("div", null, h("div", { className: "t1" }, "专家技能 · 连接器"), h("div", { className: "t2" }, "技能库全文 + 连接器状态")),
            h("button", { className: "x", onClick: toggle }, "✕")
          ),
          h("div", { className: "bd" }, kids)
        )
      );
    }

    function AutomationPanel(props) {
      var wide = !!(props && props.wide);
      var aPair = React.useState({ phase: "loading", role: "member", reminders: [], recent: [] });
      var st = aPair[0];
      var setSt = aPair[1];
      var oPair = React.useState(false);
      var open = oPair[0];
      var setOpen = oPair[1];
      var mPair = React.useState({ kind: "", text: "" });
      var msg = mPair[0];
      var setMsg = mPair[1];
      var wRef = React.useRef(null);
      var tRef = React.useRef(null);

      function load() {
        fetch("/portal/api/panel/auto", { headers: { accept: "application/json" } })
          .then(function (r) {
            if (!r.ok) throw new Error("HTTP " + r.status);
            return r.json();
          })
          .then(function (d) {
            setSt({ phase: "ready", role: (d && d.role) || "member", reminders: (d && d.reminders) || [], recent: (d && d.recent) || [] });
          })
          .catch(function () {
            setSt({ phase: "error", role: "member", reminders: [], recent: [] });
          });
      }
      React.useEffect(function () {
        load();
      }, []);

      function toggle() {
        var next = !open;
        setOpen(next);
        if (next) load();
      }

      function fmtEp(sec) {
        var d = new Date(Number(sec) * 1000);
        if (isNaN(d.getTime())) return "";
        function p2(x) {
          return (x < 10 ? "0" : "") + x;
        }
        return p2(d.getMonth() + 1) + "-" + p2(d.getDate()) + " " + p2(d.getHours()) + ":" + p2(d.getMinutes());
      }

      function parseWhen(s) {
        s = String(s || "").trim();
        var now = new Date();
        var m;
        if ((m = /^\+(\d{1,4})\s*m(in)?$/i.exec(s))) return Math.floor(Date.now() / 1000) + Number(m[1]) * 60;
        if ((m = /^\+(\d{1,3})\s*h(our|r)?$/i.exec(s))) return Math.floor(Date.now() / 1000) + Number(m[1]) * 3600;
        if ((m = /^明天\s*(\d{1,2}):(\d{2})$/.exec(s))) {
          var t1 = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, Number(m[1]), Number(m[2]), 0, 0);
          return Math.floor(t1.getTime() / 1000);
        }
        if ((m = /^(\d{1,2}):(\d{2})$/.exec(s))) {
          var t2 = new Date(now.getFullYear(), now.getMonth(), now.getDate(), Number(m[1]), Number(m[2]), 0, 0);
          if (t2.getTime() <= Date.now()) t2 = new Date(t2.getTime() + 86400000);
          return Math.floor(t2.getTime() / 1000);
        }
        if ((m = /^(\d{1,2})-(\d{1,2})\s+(\d{1,2}):(\d{2})$/.exec(s))) {
          var t3 = new Date(now.getFullYear(), Number(m[1]) - 1, Number(m[2]), Number(m[3]), Number(m[4]), 0, 0);
          if (isNaN(t3.getTime())) return 0;
          if (t3.getTime() <= Date.now()) t3 = new Date(now.getFullYear() + 1, Number(m[1]) - 1, Number(m[2]), Number(m[3]), Number(m[4]), 0, 0);
          return Math.floor(t3.getTime() / 1000);
        }
        return 0;
      }

      function post(path, body, okText) {
        setMsg({ kind: "info", text: "处理中…" });
        fetch(path, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) })
          .then(function (r) {
            return r.json().then(function (d) {
              return { status: r.status, d: d };
            });
          })
          .then(function (res) {
            if (res.status !== 200) {
              setMsg({ kind: "err", text: (res.d && res.d.error) || "HTTP " + res.status });
              return;
            }
            setMsg({ kind: "ok", text: okText });
            if (wRef.current) wRef.current.value = "";
            if (tRef.current) tRef.current.value = "";
            load();
          })
          .catch(function (e) {
            setMsg({ kind: "err", text: String((e && e.message) || e) });
          });
      }

      function add() {
        var text = tRef.current ? tRef.current.value : "";
        if (!String(text).trim()) {
          setMsg({ kind: "err", text: "内容不能为空" });
          return;
        }
        var at = parseWhen(wRef.current ? wRef.current.value : "");
        if (!at) {
          setMsg({ kind: "err", text: "时间格式：10:00 / 明天 09:00 / 09-22 10:00 / +30m" });
          return;
        }
        post("/portal/api/admin/reminders/add", { at_epoch: at, text: text }, "已添加：到点会推送提醒（微信/Webhook 通道）");
      }

      var trigger = h(
        "button",
        { className: "ddb" + (wide ? "" : " rail"), onClick: toggle, title: "自动化：定时提醒与团队自动化" },
        h("span", { className: "ic" }, "⚡"),
        wide ? h("span", { className: "lbl" }, "自动化") : null
      );
      if (!open) return h("div", null, trigger);

      var kids = [];
      if (st.phase === "loading") kids.push(h("div", { key: "ld", className: "empty" }, "读取中…"));
      if (st.phase === "error") kids.push(h("div", { key: "er", className: "empty" }, "读不到（请从门户地址打开且已登录）。"));
      if (st.phase === "ready") {
        kids.push(h("div", { key: "sub", className: "lb" }, "待发送提醒（" + st.reminders.length + "）"));
        if (!st.reminders.length) kids.push(h("div", { key: "nr", className: "empty" }, "还没有待发送的提醒。"));
        var rows = [];
        st.reminders.forEach(function (r) {
          rows.push(
            h(
              "div",
              { key: "r" + r.id, className: "it" },
              h("span", { className: "ico2" }, "⏰"),
              h(
                "div",
                { className: "gr" },
                h(
                  "div",
                  { className: "th" },
                  h("span", { className: "t" }, r.text),
                  st.role === "admin"
                    ? h(
                        "button",
                        {
                          className: "mini",
                          onClick: function () {
                            post("/portal/api/admin/reminders/rm", { id: r.id }, "已删除");
                          },
                        },
                        "删除"
                      )
                    : null
                ),
                h("div", { className: "d" }, "⏰ " + fmtEp(r.at_epoch) + (r.title ? " · " + r.title : ""))
              )
            )
          );
        });
        if (rows.length) kids.push(h("div", { key: "rows", className: "list" }, rows));
        if (st.role === "admin") {
          kids.push(
            h(
              "div",
              { key: "add", className: "row" },
              h("input", { ref: wRef, className: "inp", style: { width: 160, flex: "0 0 auto" }, placeholder: "10:00 / +30m / 明天 09:00", onKeyDown: function (e) { if (e.key === "Enter") add(); } }),
              h("input", { ref: tRef, className: "inp", style: { flex: "1 1 120px", width: "auto" }, placeholder: "提醒内容", onKeyDown: function (e) { if (e.key === "Enter") add(); } }),
              h("button", { className: "btn", onClick: add }, "添加")
            )
          );
          kids.push(h("div", { key: "tip", className: "ft" }, "到点由通知桥推送微信。也可以直接对助理说：提醒我 明天 09:00 开会。"));
        } else {
          kids.push(h("div", { key: "tip", className: "ft" }, "成员可见提醒列表；新增 / 删除请找管理员，或直接对助理说：提醒我 明天 09:00 开会。"));
        }
        if (st.recent && st.recent.length) {
          kids.push(h("div", { key: "rh", className: "lb" }, "最近已发送"));
          st.recent.forEach(function (r) {
            kids.push(h("div", { key: "rs" + r.id, className: "sub" }, "· " + r.text + "（" + fmtEp(r.at_epoch) + "）"));
          });
        }
      }
      if (msg.kind) {
        kids.push(h("div", { key: "msg", className: "msg" + (msg.kind === "err" ? " err" : msg.kind === "ok" ? " ok" : "") }, msg.text));
      }
      return h(
        "div",
        null,
        trigger,
        h(
          "div",
          { key: "panel", className: "ddp" },
          h(
            "div",
            { className: "hd" },
            h("span", { className: "ico" }, "⚡"),
            h("div", null, h("div", { className: "t1" }, "自动化"), h("div", { className: "t2" }, "定时提醒与团队自动化")),
            h("button", { className: "x", onClick: toggle }, "✕")
          ),
          h("div", { className: "bd" }, kids)
        )
      );
    }

    function TaskBoard() {
      var pair = React.useState({ phase: "loading", role: "member", me: "", members: [], tasks: [] });
      var st = pair[0];
      var setSt = pair[1];
      var fPair = React.useState("all");
      var filter = fPair[0];
      var setFilter = fPair[1];
      var msgPair = React.useState({ kind: "", text: "" });
      var msg = msgPair[0];
      var setMsg = msgPair[1];
      var tRef = React.useRef(null);
      var nRef = React.useRef(null);
      var aRef = React.useRef(null);

      function load() {
        fetch("/portal/api/tasks", { headers: { accept: "application/json" } })
          .then(function (r) {
            if (!r.ok) throw new Error("HTTP " + r.status);
            return r.json();
          })
          .then(function (d) {
            setSt({ phase: "ready", role: d.role, me: d.me, members: d.members || [], tasks: d.tasks || [] });
          })
          .catch(function () {
            setSt({ phase: "error", role: "member", me: "", members: [], tasks: [] });
          });
      }
      React.useEffect(function () {
        load();
      }, []);

      function post(path, body, okText, clear) {
        setMsg({ kind: "info", text: "处理中…" });
        fetch(path, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) })
          .then(function (r) {
            return r.json().then(function (d) {
              return { status: r.status, d: d };
            });
          })
          .then(function (res) {
            if (res.status !== 200) {
              setMsg({ kind: "err", text: (res.d && res.d.error) || "HTTP " + res.status });
              return;
            }
            setMsg({ kind: "ok", text: okText });
            if (clear) {
              if (tRef.current) tRef.current.value = "";
              if (nRef.current) nRef.current.value = "";
              if (aRef.current) aRef.current.value = "";
            }
            load();
          })
          .catch(function (e) {
            setMsg({ kind: "err", text: String((e && e.message) || e) });
          });
      }

      if (st.phase === "loading") return h("div", { style: wrap }, "读取任务板…");
      if (st.phase === "error") return h("div", { style: wrap }, h("div", null, "读不到任务板（需从门户地址打开且已登录）。"));

      var SM = { todo: ["待办", "#8a8f98"], doing: ["进行中", "#2f6fed"], done: ["已完成", "#1f9d55"] };
      var NEXT = { todo: "doing", doing: "done", done: "todo" };
      var NEXT_LABEL = { todo: "开始", doing: "完成", done: "重开" };

      var cTodo = 0;
      var cDoing = 0;
      var cDone = 0;
      var cMine = 0;
      for (var ci = 0; ci < st.tasks.length; ci++) {
        var tt = st.tasks[ci];
        if (tt.status === "todo") cTodo++;
        else if (tt.status === "doing") cDoing++;
        else cDone++;
        if (tt.assignee === st.me || tt.created_by === st.me) cMine++;
      }
      var list = st.tasks.filter(function (t) {
        if (filter === "mine") return t.assignee === st.me || t.created_by === st.me;
        if (filter === "all") return true;
        return t.status === filter;
      });

      var kids = [];

      var opts = [h("option", { key: "__none", value: "" }, "未指派")];
      for (var mi = 0; mi < st.members.length; mi++) opts.push(h("option", { key: st.members[mi], value: st.members[mi] }, st.members[mi]));
      kids.push(
        h(
          "div",
          { key: "nf", style: { display: "flex", flexDirection: "column", gap: 6 } },
          h("input", { ref: tRef, placeholder: "任务标题", style: field }),
          h("input", { ref: nRef, placeholder: "备注（可选）", style: field }),
          h(
            "div",
            { style: { display: "flex", gap: 8, alignItems: "center" } },
            h("select", { ref: aRef, style: Object.assign({}, field, { width: 160 }) }, opts),
            h(
              "button",
              {
                style: btnDark,
                onClick: function () {
                  post(
                    "/portal/api/tasks/create",
                    { title: tRef.current ? tRef.current.value : "", note: nRef.current ? nRef.current.value : "", assignee: aRef.current ? aRef.current.value : "" },
                    "任务已创建",
                    true
                  );
                },
              },
              "新建任务"
            )
          )
        )
      );

      var fdefs = [
        ["all", "全部 " + st.tasks.length],
        ["todo", "待办 " + cTodo],
        ["doing", "进行中 " + cDoing],
        ["done", "已完成 " + cDone],
        ["mine", "我的 " + cMine],
      ];
      var fbtns = [];
      for (var fi = 0; fi < fdefs.length; fi++) {
        (function (key, label) {
          fbtns.push(h("button", { key: key, onClick: function () { setFilter(key); }, style: filter === key ? btnPillOn : btnPill }, label));
        })(fdefs[fi][0], fdefs[fi][1]);
      }
      kids.push(h("div", { key: "fl", style: { display: "flex", gap: 6, flexWrap: "wrap" } }, fbtns));

      var rows = [];
      for (var ri = 0; ri < list.length; ri++) {
        (function (t) {
          var sm = SM[t.status] || SM.todo;
          var canDel = st.role === "admin" || t.created_by === st.me;
          var actions = [];
          actions.push(
            h(
              "button",
              {
                key: "nx",
                style: btnSmall,
                onClick: function () {
                  post("/portal/api/tasks/update", { id: t.id, status: NEXT[t.status] || "todo" }, "已更新", false);
                },
              },
              NEXT_LABEL[t.status] || "推进"
            )
          );
          if (!t.assignee) {
            actions.push(
              h(
                "button",
                {
                  key: "cl",
                  style: btnSmall,
                  onClick: function () {
                    post("/portal/api/tasks/update", { id: t.id, assignee: st.me }, "已接领", false);
                  },
                },
                "接领"
              )
            );
          }
          if (canDel) {
            actions.push(
              h(
                "button",
                {
                  key: "dl",
                  style: btnSmall,
                  onClick: function () {
                    if (window.confirm("删除任务：" + t.title + "？")) post("/portal/api/tasks/delete", { id: t.id }, "已删除", false);
                  },
                },
                "删除"
              )
            );
          }
          rows.push(
            h(
              "div",
              { key: "t" + t.id, style: rowBase },
              h(
                "div",
                { style: { display: "flex", alignItems: "center", gap: 8 } },
                h("span", { style: { color: sm[1], fontWeight: 600, fontSize: 12, whiteSpace: "nowrap" } }, "● " + sm[0]),
                h("span", { style: { fontWeight: 600, flex: 1, textDecoration: t.status === "done" ? "line-through" : "none", opacity: t.status === "done" ? 0.6 : 1 } }, t.title)
              ),
              t.note ? h("div", { style: { whiteSpace: "pre-wrap" } }, t.note) : null,
              h("div", { style: Object.assign({ fontSize: 11 }, muted) }, "指派：" + (t.assignee || "未指派") + " · " + (t.created_by || "-") + " · " + fmtAt(t.updated_at)),
              h("div", { style: { display: "flex", gap: 6 } }, actions)
            )
          );
        })(list[ri]);
      }
      kids.push(
        h(
          "div",
          { key: "rows", style: { display: "flex", flexDirection: "column" } },
          rows.length ? rows : h("div", { style: muted }, filter === "all" ? "暂无任务，先在上面建一条。" : "此筛选下暂无任务")
        )
      );
      if (msg.kind) {
        kids.push(
          h("div", { key: "msg", style: msg.kind === "err" ? { color: "#c0392b", fontSize: 12 } : Object.assign({ fontSize: 12 }, muted) }, msg.text)
        );
      }
      return h("div", { style: Object.assign({}, wrap, { maxWidth: 640 }) }, kids);
    }

    var inject = ["slots"];

    function apply(ctx) {
      ctx.slots.inject("settings.section", function () {
        return ctx.slots.register(
          {
            name: "settings.section",
            id: "desk-usage",
            order: 50,
            label: function () {
              return "工作台用量";
            },
          },
          DeskUsageSection
        );
      });
      ctx.slots.inject("settings.section", function () {
        return ctx.slots.register(
          {
            name: "settings.section",
            id: "desk-kb",
            order: 60,
            label: function () {
              return "知识库";
            },
          },
          KbSection
        );
      });
      ctx.slots.inject("settings.section", function () {
        return ctx.slots.register(
          {
            name: "settings.section",
            id: "desk-drive",
            order: 70,
            label: function () {
              return "公司盘";
            },
          },
          DriveSection
        );
      });
      ctx.slots.inject("settings.section", function () {
        return ctx.slots.register(
          {
            name: "settings.section",
            id: "desk-admin",
            order: 80,
            label: function () {
              return "成员管理";
            },
          },
          AdminSection
        );
      });
      ctx.slots.inject("settings.section", function () {
        return ctx.slots.register(
          {
            name: "settings.section",
            id: "desk-notify",
            order: 90,
            label: function () {
              return "通知";
            },
          },
          NotifySection
        );
      });
      ctx.slots.inject("sidebar.footer.action", function () {
        return ctx.slots.register(
          {
            name: "sidebar.footer.action",
            id: "desk-announce",
            order: 90,
            label: function () {
              return "公告";
            },
          },
          AnnounceBoard
        );
      });
      ctx.slots.inject("sidebar.footer.action", function () {
        return ctx.slots.register(
          {
            name: "sidebar.footer.action",
            id: "desk-assistants",
            order: 86,
            label: function () {
              return "助理";
            },
          },
          AssistantsPanel
        );
      });
      ctx.slots.inject("sidebar.footer.action", function () {
        return ctx.slots.register(
          {
            name: "sidebar.footer.action",
            id: "desk-skills-conn",
            order: 87,
            label: function () {
              return "技能·连接器";
            },
          },
          SkillsConnPanel
        );
      });
      ctx.slots.inject("sidebar.footer.action", function () {
        return ctx.slots.register(
          {
            name: "sidebar.footer.action",
            id: "desk-auto",
            order: 88,
            label: function () {
              return "自动化";
            },
          },
          AutomationPanel
        );
      });
      ctx.slots.inject("settings.section", function () {
        return ctx.slots.register(
          {
            name: "settings.section",
            id: "desk-ops",
            order: 100,
            label: function () {
              return "运维";
            },
          },
          OpsSection
        );
      });
      ctx.slots.inject("settings.section", function () {
        return ctx.slots.register(
          {
            name: "settings.section",
            id: "desk-tasks",
            order: 55,
            label: function () {
              return "任务板";
            },
          },
          TaskBoard
        );
      });
    }

    exports.apply = apply;
    exports.inject = inject;
    return module.exports;
  },
});
