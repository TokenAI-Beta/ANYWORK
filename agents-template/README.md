# agents-template — 子代理定义模板

复制到 `~/desk-data/agents/`（容器内 `/data/desk-data/agents/`）即被 dsh-agents-md 插件收录，
下一轮对话生效；工作台侧栏「子代理」页可可视化管理（管理员）。

格式：`<名称>.md` = YAML frontmatter（两条 `---` 之间）+ 正文（= 子代理人设）。
必填 `name`、`description`；可选 `tools`（工具白名单）/ `disallowed-tools`（黑名单）/
`model` / `effort` / `provider`（spawn|fork）/ `background` / `max-depth` / `color`。
