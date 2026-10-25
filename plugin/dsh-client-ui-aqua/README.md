# dsh-client-ui-aqua 1.4.0（dsh 0.2.1-rc.3）

MIT fork of npm `dsh-client-ui-aqua@1.3.1`（John Wu / `WYH66666666/DSH-Transparent-UI-Plugin`），只改 rc.3 四门。玻璃主题行为保留：总开关、模糊/磨砂、流体或壁纸、关掉即回到原生界面。

**钉版（AC0）：** `dsh-client-ui-aqua@1.4.0`，安装规格 `file:plugin/dsh-client-ui-aqua`（仓库根相对路径；绝对路径同 desk-panel）。

不要装这些已知红钉：

- npm `dsh-client-ui-aqua@1.3.0` / `@1.3.1`
- `github:Zagadka-3906/DSH-Transparent-UI-Plugin-dsh015`（`1.3.1-dsh015.2`）

本目录尚未写入 `DEFERRED_PLUGINS`、`bootstrap.sh`、`member-provision.sh`（那是 AC3）。也没有在本机 Docker 上热装。

## 相对 1.3.1 的改动

- `engines.dsh` 为 `>=0.2.1-rc.3 <0.3.0`（与 `plugin/desk-panel` 相同）。没有 `peerDependencies`，因此没有 `@deepseek-ai/dsh-invariants`。
- 不导出 `./invariant`，包内没有 `inject: ['invariants']`。宿主侧仍是空的 `apply()`。
- 不再注册 `settings.plugin.item`。总开关改挂仍存在的 `settings.general.item`（`id: aqua-toggle`，order 10）；旋钮仍是 `settings.general.item`（`id: aqua`，order 11），开关关闭时整行不渲染。
- 玻璃不再找 composer dock 里过时的 `[class*="root"]` 统计条。`data-dsh-stats` 打在含 `data-composer-stat="activity"` 与 `"usage"` 的 `[data-composer-dock]` 上；样式直接覆盖这两枚控件。槽锚点仍是 `[data-slot="conversation.composer.dock"]`（rc.3 上该锚点是 `display: contents`，玻璃盒子是 dock 行）。

静态核对：`node plugin/dsh-client-ui-aqua/check-ac0.mjs`
