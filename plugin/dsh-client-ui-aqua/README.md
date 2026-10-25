# dsh-client-ui-aqua 1.4.2（dsh 0.2.1-rc.3）

MIT fork of npm `dsh-client-ui-aqua@1.3.1`（John Wu / `WYH66666666/DSH-Transparent-UI-Plugin`），只改 rc.3 四门。玻璃主题行为保留：总开关、模糊/磨砂、流体或壁纸、关掉即回到原生界面。

**钉版：** `dsh-client-ui-aqua@1.4.2`，安装规格 `file:plugin/dsh-client-ui-aqua`（仓库根相对路径；绝对路径同 desk-panel）。

`1.4.0` 的客户端 `require("@deepseek-ai/dsh-client-runtime/client")` 不在 rc.3 模块表里（`defineStore` 已在平台种子 `@deepseek-ai/dsh-client-store`）。`1.4.1` 改要这个种子，`dsh.client.inject` 为空，与 desk-panel 一样：种子模块不写 `external`。`1.4.2` 把勾选图标换成 rc.3 的 `IconCheckOutlineRegular`（16px）。`IconCheckOutline16` 在这版 primitives 里不存在；玻璃已开启时渲染它会抛错，槽的错误边界卸掉 `settings.general.item` 的 `aqua-toggle` 和 `aqua`，总开关和旋钮一起消失，图层（`data-dsh-aqua`）还在。

已装过 `1.4.0` 的 profile 不会自己换副本。先卸再装（`--profile` 在子命令前）：

```sh
dsh plugin --profile web remove dsh-client-ui-aqua
dsh plugin --profile web add file:<仓库根>/plugin/dsh-client-ui-aqua
```

不要装这些已知红钉：

- npm `dsh-client-ui-aqua@1.3.0` / `@1.3.1`
- `github:Zagadka-3906/DSH-Transparent-UI-Plugin-dsh015`（`1.3.1-dsh015.2`）

`deploy/docker/bootstrap.sh` 与 `member-provision.sh` 已钉这份 `file:plugin/dsh-client-ui-aqua`（1.4.2）。`DEFERRED_PLUGINS` 不再包含它。已是 1.4.2 的 profile 启动时留下；1.4.1 和其它版本先卸再装。`file:` 是副本，不升版本号就不会换上这份 client。本说明不代表已经在容器里重启验收。

## 相对 1.3.1 的改动

- `engines.dsh` 为 `>=0.2.1-rc.3 <0.3.0`（与 `plugin/desk-panel` 相同）。没有 `peerDependencies`，因此没有 `@deepseek-ai/dsh-invariants`。
- 不导出 `./invariant`，包内没有 `inject: ['invariants']`。宿主侧仍是空的 `apply()`。
- 不再注册 `settings.plugin.item`。总开关改挂仍存在的 `settings.general.item`（`id: aqua-toggle`，order 10）；旋钮仍是 `settings.general.item`（`id: aqua`，order 11），开关关闭时整行不渲染。
- 玻璃不再找 composer dock 里过时的 `[class*="root"]` 统计条。`data-dsh-stats` 打在含 `data-composer-stat="activity"` 与 `"usage"` 的 `[data-composer-dock]` 上；样式直接覆盖这两枚控件。槽锚点仍是 `[data-slot="conversation.composer.dock"]`（rc.3 上该锚点是 `display: contents`，玻璃盒子是 dock 行）。

静态核对：`node plugin/dsh-client-ui-aqua/check-ac0.mjs`
