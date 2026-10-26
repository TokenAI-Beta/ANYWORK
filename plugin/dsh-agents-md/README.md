# dsh-agents-md — agents/*.md 子代理定义桥

把工作台的 `agents/*.md` 定义（Markdown + YAML frontmatter，正文 = persona）接入
dsh 的委派（subagent）体系：模型获得一个 `agent` 工具，按 `subagent_type` 把独立
任务交给定义好的子代理——**独立上下文、只返回最终结果**（跑在 dsh 引擎上）。

零依赖、零构建：纯 ESM JavaScript（只用 node 内置模块）。`defineTool` 在运行时从
**正在运行的 dsh 安装**动态加载（由 `process.argv[1]` 推导安装根，`config.dshRoot`
可覆盖）。结算不走作业队列：每次委派调用 `ctx.subagents.startActivation`
（`delivery: 'parent'`），工具立刻返回子会话 id，完成通知由运行时投递给父会话。

## 定义文件

放在扫描目录下，任意文件名（建议 `<name>.md`）：

```markdown
---
name: code-reviewer
description: 代码审查：找 bug、性能问题并给修改建议
tools: [bash, read, grep]          # 可选：工具白名单（全局工具名）
disallowed-tools: [write]          # 可选：黑名单
model: deepseek-chat               # 可选：该子代理使用的模型
effort: high                       # 可选：推理强度（low|medium|high，适配器相关）
provider: spawn                    # 可选：spawn（默认）| fork（继承当前对话）
background: true                   # 仍可写；rc.3 忽略（activation 一律立即返回 id）
max-depth: 2                       # 可选：绝对委派深度上限（默认 3）
color: blue                        # 可选：面板配色
---

正文就是子代理的人设/系统提示词（写职责、口径、输出格式；知识放技能里）。
```

- `name`、`description` 必填；其余可选。
- 未知字段会给出 warning（防拼写错误）；有 error 的定义不可被委派（面板可见原因）。
- 别名：`maxDepth` / `disallowedTools` 也接受（对应 `max-depth` / `disallowed-tools`）。

## 扫描目录（优先级从高到低，同名先出现者生效）

1. `config.dirs`（显式配置，靠前者优先）
2. `$DSH_HOME/agents`（实例私有）
3. `~/desk-data/agents`（团队共享，容器内即 `/data/desk-data/agents`）

## 安装（每实例一次）

```sh
DSH_HOME=<实例> node <dsh>/apps/cli/lib/bin.js plugin --profile web add file:<本目录>
# 重启实例生效（host 组合插件）
```

容器版由 `deploy/docker/bootstrap.sh` 与 `member-provision.sh` 安装
`file:$repo/plugin/dsh-agents-md`（`dsh-agents-md@0.4.0`）。`file:` 是副本；
不是 0.4.0，或副本与仓库不一致时，启动脚本先卸再装。不要用 `link:` 装回 0.3.0。

## 行为要点

- 定义目录内容变化（文件名/mtime/size 指纹）→ 下一次工具调用前自动重登记，工具描述里的目录随之刷新。
- 每次调用都是一次 managed activation：`startActivation({ provider, label, request, signal, delivery: 'parent' })`，返回 `{ kind: 'activation', subagentId }`。父会话在子代理结束时收到完成通知。没有 `run_in_background`，也不再走 `job_output` / `job_kill`。
- rc.3 的 activation 请求没有 `persona` / `toolFilter`。定义正文，以及 `tools` / `disallowed-tools`，写进交给子代理的 prompt。工具名单是指令，不是 `tools.restrict`；插件会打一条错误日志说明这一点。模型与推理强度仍走 `agentOptions`，深度仍走 `maxDepth`；provider 不支持时**响亮报错**。
- 字段对应：`name`/`description` 同名同义；`tools` = prompt 里的工具约束；`model` = 模型；正文 = 放进子代理 prompt 的 persona；`background` 被接受但不再改变执行方式。

## 结算通知（可选）

子代理结束时（`subagent/end`，按 `startActivation` 的 `childId` 匹配），插件经通知桥 `POST <url>`（令牌文件认证）推送
「🔧 子代理「<label>」(<type>) 完成：…」。默认推送本插件启动的 activation、目标路由按实例成员名推导
（`wechat-<成员名>`，容器即 `/data/desk-data/notify.token` + `http://127.0.0.1:8080/portal/api/notify`）。
可在 row config 覆盖或关闭：

```yaml
config:
  notify:
    events: all                    # background（默认）| all
    routes: [wechat-admin001]      # 覆盖默认目标（精确路由名）
    url: http://127.0.0.1:8080/portal/api/notify
    tokenFile: /data/desk-data/notify.token
  # notify: false                    # 完全关闭
```

## 调用方式（v0.3.0：自然语言）

对话里直接点名即可（助理按注入的系统提示精准路由）：

- 「让 code-reviewer 审一下 demo/app.py」
- 「交给 researcher 查一下…」
- 「@probe-lite 看下这个文件」
- 或显式：「用 agent 工具委派 code-reviewer，prompt：…」

`description` 参数已降为可选（缺省时自动从任务文本生成标签）。名字不在目录里或意图有歧义时，
助理会先追问一句——不会乱猜名字，也不会悄悄退回内置 `subagent` 工具。

