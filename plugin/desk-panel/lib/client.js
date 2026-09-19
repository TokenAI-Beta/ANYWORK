// DSH-ANYWORK 设置页（浏览器侧 cordis 插件）：工作台用量 + 企业知识库 + 公司盘
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
            "打开完整门户页（用量明细 / 管理）→"
          )
        )
      );
      return h("div", { style: wrap }, kids);
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
    }

    exports.apply = apply;
    exports.inject = inject;
    return module.exports;
  },
});
