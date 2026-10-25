# AC0 — aqua pin（Cut 2026-10-25 Decision A）

钉版：`dsh-client-ui-aqua@1.4.2`  
安装规格：`file:plugin/dsh-client-ui-aqua`

`1.4.0` 在 rc.3 上加载失败：`require("@deepseek-ai/dsh-client-runtime/client")` 不在模块表。`1.4.1` 改为平台种子 `@deepseek-ai/dsh-client-store`（`defineStore`），`dsh.client.inject` 为 `[]`。`1.4.2` 把勾选图标从已删除的 `IconCheckOutline16` 换成 `IconCheckOutlineRegular`。玻璃开着时旧图标是 `undefined`，设置行抛错后被槽丢掉，图层还在。已装过更早版本的实例要先 `dsh plugin --profile web remove dsh-client-ui-aqua`，再 `add file:<仓库根>/plugin/dsh-client-ui-aqua`。启动脚本对不是 1.4.2 的安装会自己卸下再装。

这是 npm `1.3.1` 的仓内 MIT fork（见 `plugin/dsh-client-ui-aqua/NOTICE`）。静态四门由 `node plugin/dsh-client-ui-aqua/check-ac0.mjs` 核对。`deploy/docker/bootstrap.sh` 与 `member-provision.sh` 已钉 `file:plugin/dsh-client-ui-aqua`（1.4.2），`DEFERRED_PLUGINS` 不再包含 `dsh-client-ui-aqua`。本说明不代表已经在容器里重启验收。

不要装：

- npm `dsh-client-ui-aqua@1.3.0`、`@1.3.1`（无 `engines.dsh`，peer 含 `@deepseek-ai/dsh-invariants`，导出 `./invariant`，注册 `settings.plugin.item`）
- `github:Zagadka-3906/DSH-Transparent-UI-Plugin-dsh015` @ `1.3.1-dsh015.2`（peer `^0.1.5`，仍是旧槽和 invariant）

`engines.dsh` 为 `>=0.2.1-rc.3 <0.3.0`。无 `peerDependencies`。`exports` 只有 `.`、`./client`、`./cordis.patch.yml`、`./package.json`。总开关在 `settings.general.item`（`aqua-toggle`）。玻璃选择器打到 `data-composer-stat="activity"` 与 `data-composer-stat="usage"`。
