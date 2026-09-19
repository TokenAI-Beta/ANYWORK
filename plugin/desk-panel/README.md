# desk-panel（dsh 客户端插件）

DSH-ANYWORK 的「工作台用量」设置页：以 dsh 官方客户端插件机制注入（**不改 dsh 源码**）——
往 `settings.section` 槽位注册一个页面，数据来自门户的 `/portal/api/usage`。

## 挂载（每台实例）

```sh
DSH_HOME=<实例 home> node ~/deepseek-harness/apps/cli/lib/bin.js \
  plugin --profile web add file:<本目录绝对路径>
# 重启该实例后生效；`dsh plugin` 会自动把声明了 dsh.bundle 的包收进 profile 的 bundles 层
```

- 结构：`package.json`（`dsh.bundle.patch` + `dsh.client`）· `cordis.patch.yml`（插入 row）· `lib/index.js`（宿主空体）· `lib/client.js`（浏览器 bundle，闭包工厂格式）
- 仅依赖 `react`（平台种子模块，运行时由模块表提供），无构建步骤、无 npm 依赖。
- 直连实例端口时读不到账本（fetch /portal/api/usage 404）；从门户地址打开即可。
