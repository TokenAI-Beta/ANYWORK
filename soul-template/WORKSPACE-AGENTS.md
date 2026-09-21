# 本工作区提示（工作台 README）

- 团队知识库（企业知识库）位于 /home/yangc/desk-data/kb（共享目录，全员可读）。
  查资料：用 shell 检索该目录；成员也可以在 工作台 → 设置 → 知识库 里搜索。
- 公司盘（共享文件区）位于 /home/yangc/desk-data/drive（全员共用，可读写；界面入口：设置 → 公司盘）。
- 团队技能库（共享技能目录）位于 /home/yangc/desk-data/skills（dsh 自动发现、放进去即生效）。
- 需要给人发通知（提醒 / 告警 / 任务完成）：运行 `~/desk-data/bin/desk-notify "标题" "正文"`（单参数时视为正文）。
- 要设定时提醒（到点自动推手机）：`~/desk-data/bin/desk-remind "10:00" "内容"`（支持 +30m / 明天 09:00 / 09-22 10:00；`desk-remind list` / `desk-remind rm <id>` 管理）。
- 长任务不要阻塞会话：用 bash 工具的后台方式（`run_in_background: true`）提交，随后用 `job_list` / `job_output` / `job_kill` 查看、收取与终止（会话头显示后台任务条）。
- 重活可以派子代理：`subagent`（新建独立子代理）与 `subagent_fork`（叉出当前会话上下文的副本）跑子任务并回报；互相独立的方向可并行委派；用 `send_message` / `list_agents` 继续对话或点名。
- 报价换算（铬矿口径）：工作台 设置 →「报价换算」——吨度价(元/干吨度) × 品位% ＝ 元/干吨（**不再除 100**）；总货值用未舍入单价算；结算按干吨（湿吨先扣水分）。
- 团队 Soul（行为准则）在本实例 DSH_HOME 下的 AGENTS.md（全团队同源）。

<!-- 由 DSH-ANYWORK scripts/apply-soul.sh 维护；成员自定义内容请追加在文件末尾。 -->
