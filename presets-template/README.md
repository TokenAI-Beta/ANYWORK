# 团队 Agent 预设（角色模板）

dsh 的「Agent 预设」= 一个目录（`preset.yml` + `agent.cordis.yml`），决定某个会话用什么工具、什么提示词、什么身份。本目录是团队预设模板，部署时复制到 `~/desk-data/presets/`。

## 已包含

- `team-assistant/`（**团队助理**）：`standard` 模式 + 团队版 persona

## 怎么生效

- 每个成员实例通过 `DSH_HOME/.agent-presets` 软链到这里（与技能库同机制）
- 成员在工作台 **设置 → Agent 预设** 里选它（可设为"对此后新建的会话生效"）
- 新建会话时也可指定：`session.create` 带 `agentPreset: "team-assistant"`

## 加新预设 / 升级后维护

1. 复制 dsh 自带模式做底：
   `cp -r ~/deepseek-harness/apps/cli/config/agent-presets/standard ~/desk-data/presets/<新id>`
2. 改 `preset.yml` 的 `name` / `description` / `order`
3. 改 `agent.cordis.yml`：persona 可一键换成团队版——`node scripts/apply-team-persona.mjs <该目录>/agent.cordis.yml`；其余行按需增删
4. 放进去即被实例发现（刷新页面即可见）
5. **dsh 升级后**：按 1–3 重抄一遍（见下）

## 边界（v1）

- 预设是"拷贝"而非"继承"：dsh 升级后内置模式若有变化，团队预设不会自动跟随（按上面步骤重抄即可）
- 权限档位（沙箱 / 审批）不在预设里，在实例本身的权限设置中
