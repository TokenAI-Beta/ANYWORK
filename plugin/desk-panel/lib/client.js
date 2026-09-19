// DSH-ANYWORK「工作台用量」设置页（浏览器侧 cordis 插件）
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

      var wrap = {
        maxWidth: 560,
        fontSize: 13,
        lineHeight: "20px",
        color: "var(--dsw-alias-label-primary, #1c1e21)",
        display: "flex",
        flexDirection: "column",
        gap: 10,
      };

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
    }

    exports.apply = apply;
    exports.inject = inject;
    return module.exports;
  },
});
