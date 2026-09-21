// DSH-ANYWORK 设置页（浏览器侧 cordis 插件）：工作台用量 + 企业知识库 + 公司盘 + 成员管理
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
            "打开完整门户页（用量明细）→"
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

    function AdminSection() {
      var dataPair = React.useState({ phase: "loading", members: [], channels: [], message: "" });
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
            setData({ phase: "ready", members: d.members || [], channels: d.channels || [], message: "" });
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
              "#" + u.id + " · 实例 " + (u.port || "-") + " · 预算 " + (u.budget != null ? "¥" + u.budget : "不限") + " · 本月 " + fmt(u.monthCost) + " / " + u.monthEvents + " 次 · 建 " + String(u.createdAt || "").slice(0, 10)
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
          "删除成员不可撤销；其历史用量保留在账本。若该成员配了实例服务，可在服务器用 scripts/desk.sh 停掉。通道 Key 只存在服务器数据库。"
        )
      );
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
    }

    exports.apply = apply;
    exports.inject = inject;
    return module.exports;
  },
});
