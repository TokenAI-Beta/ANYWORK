# AC0 — aqua pin（Cut 2026-10-25 Decision A）

钉版：`dsh-client-ui-aqua@1.4.0`  
安装规格：`file:plugin/dsh-client-ui-aqua`

这是 npm `1.3.1` 的仓内 MIT fork（见 `plugin/dsh-client-ui-aqua/NOTICE`）。静态四门由 `node plugin/dsh-client-ui-aqua/check-ac0.mjs` 核对。本说明不代表已经热装，也不改 `DEFERRED_PLUGINS` / `bootstrap.sh` / `member-provision.sh`。

不要装：

- npm `dsh-client-ui-aqua@1.3.0`、`@1.3.1`（无 `engines.dsh`，peer 含 `@deepseek-ai/dsh-invariants`，导出 `./invariant`，注册 `settings.plugin.item`）
- `github:Zagadka-3906/DSH-Transparent-UI-Plugin-dsh015` @ `1.3.1-dsh015.2`（peer `^0.1.5`，仍是旧槽和 invariant）

`engines.dsh` 为 `>=0.2.1-rc.3 <0.3.0`。无 `peerDependencies`。`exports` 只有 `.`、`./client`、`./cordis.patch.yml`、`./package.json`。总开关在 `settings.general.item`（`aqua-toggle`）。玻璃选择器打到 `data-composer-stat="activity"` 与 `data-composer-stat="usage"`。
