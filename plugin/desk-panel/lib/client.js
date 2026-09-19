// DSH-ANYWORK 设置页（浏览器侧 cordis 插件）：工作台用量 + 企业知识库
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

    function fmt(n) {
      return "¥" + Number(n || 0).toFixed(4);
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
          h("span", null, r.model),
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
            { href: "/portal/me", target: "_blank", rel: "noreferrer", style: { color: "var(--dsw-alias-state-business-primary, #4f7cf7)" } },
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
      var button = h(
        "button",
        {
          onClick: function () {
            run(inputRef.current ? inputRef.current.value : "");
          },
          style: {
            padding: "8px 14px",
            border: 0,
            borderRadius: 8,
            background: "var(--dsw-alias-label-primary, #1c1e21)",
            color: "var(--dsw-alias-bg-layer-1, #fff)",
            cursor: "pointer",
            fontSize: 13,
          },
        },
        "查询"
      );

      var kids = [h("div", { key: "bar", style: { display: "flex", gap: 8 } }, input, button)];

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
                { key: "k" + i, style: { padding: "6px 0", borderBottom: "1px solid var(--dsw-alias-border-l2, #f0f1f3)" } },
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
    }

    exports.apply = apply;
    exports.inject = inject;
    return module.exports;
  },
});
