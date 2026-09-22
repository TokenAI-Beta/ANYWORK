// DSH-ANYWORK 工作台扩展（浏览器侧 cordis 插件）：设置页=用量/任务板/会话管理/知识库（含沉淀）/公司盘/成员管理/通知/运维；侧栏=公告 + 助理 + 技能·连接器 + 自动化
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
    // —— i18n：接入官方 locale 服务（设置 → 语言 中英实时切换；缺服务时退回中文）—— //
    var DESK_NS = "desk-panel";
    var LOC_ZH = {
      "usage.loading": "读取用量中…",
      "usage.failOpen": "暂时读不到用量数据（",
      "usage.portalHint": "本面板通过门户读取账本：请从门户地址打开工作台（例如 http://192.168.0.171:8080）再查看；直连实例端口时不可用。",
      "usage.monthPrefix": "本月 · 请求 ",
      "usage.mid": " 次 · 未命中 ",
      "usage.outMid": " / 输出 ",
      "usage.todayPrefix": "今日 ",
      "usage.reqSuffix": " 次",
      "usage.budgetPrefix": "预算 ¥",
      "usage.overLimit": "已超限",
      "usage.remainingPrefix": "剩余 ¥",
      "usage.openPortal": "打开完整门户页（用量明细）→",
      "common.required": "内容不能为空",
      "common.saving": "保存中…",
      "kb.savedTo": "已沉淀：notes/",
      "common.loading": "读取中…",
      "common.loadFailed": "读取失败",
      "kb.delNote": "删除笔记：",
      "common.deletedColon": "已删除：",
      "kb.newNote": "沉淀一条新笔记（写入共享知识库）",
      "kb.titlePh": "标题（如：铬矿报价速算口径）",
      "common.tagsOpt": "标签（可选）",
      "kb.bodyPh": "正文（Markdown）——建议写结论 / 口径 / 方法，方便后来人复用",
      "kb.saveBtn": "沉淀入库",
      "kb.recentOpen": "最近沉淀（",
      "kb.recentFailOpen": "读不到沉淀列表（",
      "common.collapse": "收起",
      "common.view": "查看",
      "common.delete": "删除",
      "kb.empty": "还没有沉淀笔记。",
      "kb.searchPh": "要查什么？（关键词）",
      "common.query": "查询",
      "kb.failOpen": "读不到知识库（",
      "kb.portalHint2": "）。本面板需从门户打开（经登录会话访问服务器知识库）。",
      "kb.hitsPrefix": "命中 ",
      "kb.hitsSuffix": " 条",
      "kb.truncated": "（已截断）",
      "kb.noHits": "没有命中。试试更短的关键词。",
      "kb.statsPrefix": "知识库：",
      "kb.statsMid": " 个文件 · ",
      "kb.statsUpdated": "最后更新 ",
      "kb.statsEmpty": "空（把文档放进 kb 目录即可）",
      "kb.statsHint": "把文档放进服务器 ~/desk-data/kb（目录内有 README）；会话里的 agent 也能直接读它。",
      "drive.uploading": "上传中：",
      "drive.uploadFail": "上传失败：",
      "sec.drive": "公司盘",
      "common.refresh": "刷新",
      "drive.uploadBtn": "上传文件",
      "drive.failOpen": "读不到公司盘（",
      "drive.portalHint2": "）。本面板需从门户打开（经登录会话访问服务器文件区）。",
      "drive.emptyHint": "（空文件夹：点「上传文件」，或把文件放进服务器 ~/desk-data/drive）",
      "drive.pathHint": "服务器路径 ~/desk-data/drive（Windows：\\\\\\\\wsl.localhost\\\\Ubuntu\\\\home\\\\yangc\\\\desk-data\\\\drive）；单文件上限 50MB。",
      "common.processing": "处理中…",
      "admin.pasteKey": "请先粘贴新 key",
      "admin.sameKey": "与当前 key 相同，无需更换。",
      "admin.updatedOpen": "已更新（",
      "admin.restartSuffix": "），网关重启中——约 5~10 秒后自动刷新。",
      "admin.loadingMembers": "读取成员与通道中…",
      "admin.adminOnly": "本页仅管理员可用。",
      "admin.adminOnlySub": "用管理员账号从门户登录后，在工作台设置里管理成员与模型通道。",
      "admin.loadFailOpen": "读不到管理数据（",
      "admin.portalHint": "请从门户地址打开工作台（经登录会话）再试；直连实例端口时不可用。",
      "admin.soleAdmin": "唯一管理员",
      "admin.delMember": "删除成员 ",
      "admin.delMemberWarn": "？\\n将吊销其虚拟钥匙并清除登录会话（不可撤销；历史用量保留在账本）。",
      "admin.delMemberDone": "已删除成员：",
      "admin.rowInstance": " · 实例 ",
      "admin.rowBudget": " · 预算 ",
      "admin.unlimited": "不限",
      "admin.rowCreated": " · 建 ",
      "admin.rowMonth": "本月 ",
      "admin.rowMonthMid": " 次 · 近 7 天 ",
      "admin.activeSess": "● 活跃会话",
      "admin.noSess": "○ 无会话",
      "admin.lastLogin": " · 最后登录 ",
      "admin.never": "从未",
      "common.enable": "启用",
      "common.disable": "停用",
      "admin.channelToggled": "通道已",
      "admin.delChannel": "删除通道 ",
      "admin.channelDeleted": "通道已删除：",
      "admin.teamUsage7d": "近 7 天团队用量 · 合计 ",
      "admin.upstreamTitle": "团队共用上游（默认）",
      "admin.upstreamDesc": "所有成员默认经这里出网；外部通道按模型名分流（见下方「模型通道」）。Key 只存服务器，成员不可见。",
      "admin.upstreamSrc": "（来源 ",
      "admin.keyMissing": "Key 未配置",
      "admin.keyPh": "sk-…（粘贴新的 DeepSeek API Key；保存后网关自动重启约 5~10 秒）",
      "admin.updateKey": "更新 Key",
      "admin.keyEnvLocked": "当前 Key 来自服务环境变量（DESK_REAL_KEY），请在服务环境里修改。",
      "admin.keyScopeNote": "换 Key 只影响默认上游；给特定模型接别的上游 / Key 用下方「模型通道」。",
      "admin.membersCount": "成员（",
      "admin.newMember": "新建成员",
      "admin.phUsername": "用户名（小写字母数字，2-32 位）",
      "admin.phPassword": "初始密码（至少 6 位）",
      "admin.phBudget": "月预算 CNY（可留空 = 不限）",
      "admin.memberCreated": "成员已创建：",
      "admin.createMember": "创建成员",
      "admin.newKeyShown": "新成员虚拟钥匙（只显示这一次，请立即复制交给 ",
      "admin.copied": "已复制到剪贴板",
      "common.copyFail": "复制失败，请手动选中复制",
      "common.copy": "复制",
      "common.keyDone": "已交给成员，清除显示",
      "admin.channelsCount": "模型通道（",
      "admin.noChannels": "暂无外部通道（默认走 DeepSeek 官方）",
      "admin.addChannel": "加入通道",
      "admin.phChannelName": "名称（英文小写，如 kimi）",
      "admin.phBaseUrl": "Base URL（OpenAI 兼容，含 /v1）",
      "admin.phModels": "模型名（英文逗号分隔）",
      "admin.phPrices": "价目表 JSON（可选，¥/百万 tokens）",
      "common.phNote": "备注（可选）",
      "admin.badPrices": "价目表 JSON 解析失败",
      "admin.channelAdded": "通道已加入：",
      "admin.dangerNote": "删除成员不可撤销；其历史用量保留在账本。成员预算到 80% / 100% 时会经「通知」通道自动提醒管理员。若该成员配了实例服务，可在服务器用 scripts/desk.sh 停掉。通道 Key 只存在服务器数据库。",
      "notify.loading": "读取通知通道中…",
      "notify.adminHint": "用管理员账号从门户登录后配置通知通道。",
      "notify.loadFailOpen": "读不到通知配置（",
      "notify.portalHint": "请从门户地址打开工作台（经登录会话）再试。",
      "notify.enabledSuffix": " · 启用",
      "notify.disabledSuffix": " · 停用",
      "notify.toggled": "已切换：",
      "notify.delChannel": "删除通知通道 ",
      "notify.channelsCount": "通知通道（",
      "notify.empty": "还没有通知通道——加一个，工作台就能往外推消息（提醒 / 告警 / 任务完成）。",
      "notify.addChannel": "添加通道",
      "notify.kindWebhook": "webhook —— 企业微信 / 钉钉 / 任意 HTTP 端点",
      "notify.kindHermes": "hermes —— 经 通知平台（weixin 微信等）",
      "notify.kindTelegram": "telegram —— Bot API（BotFather 机器人，直连/反代）",
      "notify.kindWhatsapp": "whatsapp —— CallMeBot（免费个人）/ green-api / UltraMsg",
      "notify.phName": "名称（英文小写，如 wecom-group / wechat-me）",
      "notify.phTelegram": "bot_token|chat_id（可选 |api_base 反代）",
      "notify.phWhatsapp": "callmebot|apikey|手机号 或 greenapi|id|token|chatId 或 ultramsg|id|token|to",
      "notify.tgHint": "向 @BotFather 要 bot_token；chat_id 用 @频道名或数字 ID；直连失败时追加 |api_base 指向反代。",
      "notify.waHint": "CallMeBot：给 +34 644 51 95 23 发消息索取 apikey（免费、个人通知）；green-api / UltraMsg 为商业网关（实例 ID + 令牌 + 收件人）。",
      "notify.added": "通道已添加：",
      "notify.testSend": "发送测试通知",
      "notify.testSendHint": "会发往所有启用通道（含手机）",
      "notify.removed": "已删除提醒 #",
      "notify.remindersCount": "定时提醒（",
      "notify.noReminders": "没有待发提醒。设置：让 agent 跑 ~/desk-data/bin/desk-remind \"10:00\" \"内容\"",
      "notify.recentSent": "最近发送",
      "notify.noSent": "还没有发送记录",
      "notify.help": "agent 侧：desk-notify \\\"标题\\\" \\\"正文\\\" 立即发；desk-remind \\\"10:00\\\" \\\"内容\\\" 定时发（到点自动推，支持 +30m / 明天 09:00）。企业微信群机器人：群设置 → 群机器人 → 复制 Webhook 地址，粘进上面的通道即可。",
      "relTime.days": " 天 ",
      "relTime.hours": " 小时",
      "relTime.hoursMid": " 小时 ",
      "relTime.mins": " 分",
      "relTime.minutes": " 分钟",
      "ops.loading": "读取运维状态中…",
      "ops.adminHint": "用管理员账号从门户登录后查看。",
      "ops.loadFailOpen": "读不到运维数据（",
      "ops.portalHint": "请从门户地址打开工作台再试。",
      "ops.services": "服务（systemd）",
      "ops.ports": "端口探活",
      "ops.backups": "备份（",
      "ops.backupMid": " 份 · 合计 ",
      "ops.backupLast": "最后：",
      "ops.noBackups": "（还没有备份产物；定时器每日 03:40 跑）",
      "ops.disk": "磁盘 / 数据",
      "ops.free": "空闲 ",
      "ops.ofTotal": " / 共 ",
      "ops.kbSize": "知识库 ",
      "ops.driveSize": " · 公司盘 ",
      "ops.host": "主机 / 进程",
      "ops.uptime": "WSL 已运行 ",
      "ops.mem": " · 内存 ",
      "ops.procs": "工作台进程 ",
      "ann.title": "团队公告与意见反馈",
      "ann.tab": "公告",
      "ann.failHint": "读不到公告（需从门户地址打开且已登录）。",
      "ann.publish": "发布公告",
      "ann.phTitle": "公告标题（可选）",
      "ann.phBody": "公告内容…",
      "ann.posted": "公告已发布",
      "ann.untitled": "(无标题)",
      "ann.delConfirm": "删除该公告？",
      "common.deleted": "已删除",
      "ann.empty": "暂无公告",
      "ann.feedbackTab": "意见反馈",
      "ann.everyone": "（全员）",
      "ann.phFeedback": "给管理员提意见 / 报问题…",
      "ann.feedbackThanks": "反馈已提交，谢谢！",
      "ann.submitFeedback": "提交反馈",
      "common.noFeedback": "暂无反馈",
      "common.noFeedbackMine": "你还没有提过反馈",
      "ann.titleShort": "团队公告",
      "ann.footerLabel": "公告与意见反馈",
      "asst.title": "团队助理：Agent 预设一览（专家模式）",
      "asst.tab": "助理",
      "asst.failHint": "读不到预设（请从门户地址打开且已登录）。",
      "asst.empty": "共享区还没有预设。",
      "asst.codex": "Codex 并行",
      "asst.available": "可用助理",
      "asst.note": "助理 = 预设人格与工具组合。默认用哪个：设置 → Agent 预设；共享区 presets/ 下可自行增减，新会话生效。",
      "asst.team": "团队助理",
      "asst.panelTitle": "Agent 预设（专家模式）",
      "skl.title": "专家技能库 + 连接器状态",
      "skl.tab": "技能·连接器",
      "skl.skills": "技能",
      "skl.connectors": "连接器",
      "common.failHint": "读不到（请从门户地址打开且已登录）。",
      "common.back": "← 返回",
      "skl.empty": "共享技能库空空如也。",
      "skl.trigger": "触发：",
      "skl.hint": "点击任意技能查看全文；新增 = 往共享区 skills/ 放一个文件夹，各实例自动分发。",
      "skl.noConn": "暂无连接信息。",
      "skl.legend": "状态为只读探测：绿 = 已接通，灰 = 未配置（可选），红 = 异常。",
      "skl.titleShort": "专家技能 · 连接器",
      "skl.panelTitle": "技能库全文 + 连接器状态",
      "auto.phTime": "时间格式：10:00 / 明天 09:00 / 09-22 10:00 / +30m",
      "auto.added": "已添加：到点会推送提醒（微信/Webhook 通道）",
      "auto.title": "自动化：定时提醒与团队自动化",
      "auto.tab": "自动化",
      "auto.pending": "待发送提醒（",
      "auto.emptyPending": "还没有待发送的提醒。",
      "auto.phTime2": "10:00 / +30m / 明天 09:00",
      "auto.phText": "提醒内容",
      "common.add": "添加",
      "auto.hintAdmin": "到点由通知桥推送微信。也可以直接对助理说：提醒我 明天 09:00 开会。",
      "auto.hintMember": "成员可见提醒列表；新增 / 删除请找管理员，或直接对助理说：提醒我 明天 09:00 开会。",
      "auto.recent": "最近已发送",
      "auto.panelTitle": "定时提醒与团队自动化",
      "sess.tab": "会话",
      "sess.notStarted": " · 未开始",
      "sess.pending": "⏳ 待审批",
      "sess.approved": "✅ 已批准",
      "sess.rejected": "❌ 已驳回",
      "sess.cancelled": "已撤销",
      "sec.sessions": "会话管理",
      "sess.intro": "删除需管理员确认：成员提交申请 → 管理员批准后执行；管理员可直接删除。执行删除时，对应实例会短暂重启（约 10~30 秒）。",
      "sess.mine": "我的会话（",
      "sess.loadHint": "读不到会话列表（需从工作台页面打开）。",
      "sess.empty": "暂无会话。",
      "sess.delDirect": "直接删除该会话？（管理员直删，实例将短暂重启）",
      "sess.deletedRestarting": "已删除，实例重启中（约 10~30 秒）",
      "sess.requestCancelled": "已撤销申请",
      "common.withdraw": "撤销",
      "sess.waitingAdmin": "⏳ 待管理员确认",
      "sess.requested": "已提交，等待管理员确认",
      "sess.requestDelete": "申请删除",
      "sess.running": " · ● 进行中",
      "sess.child": " · 子会话",
      "sess.preset": " · 预设 ",
      "sess.myRequests": "我的申请",
      "sess.requestedAt": " · 申请于 ",
      "sess.noRequests": "暂无申请记录。",
      "sess.pendingCount": "待审批（",
      "sess.approveDelete": "批准并删除 ",
      "sess.approveDeleteQ": " 的该会话？（对方实例将短暂重启）",
      "sess.approvedDone": "已批准并执行删除（实例约 10~30 秒后自动重启）",
      "sess.approveBtn": "批准删除",
      "sess.rejectedToast": "已驳回",
      "sess.rejectBtn": "驳回",
      "sess.noPending": "没有待审批的申请。",
      "sess.memberSessions": "成员会话",
      "sess.pickMember": "选择成员…",
      "sess.noInstance": "（无实例）",
      "sess.pickFirst": "先选择成员",
      "sess.loadBtn": "加载会话",
      "sess.delOther": "直接删除 ",
      "sess.delOtherQ": " 的该会话？",
      "sess.delDirectBtn": "直接删除",
      "sess.memberNone": "该成员暂无会话。",
      "sess.recent": "最近处理",
      "task.loading": "读取任务板…",
      "task.failHint": "读不到任务板（需从门户地址打开且已登录）。",
      "task.todo": "待办",
      "task.doing": "进行中",
      "task.done": "已完成",
      "task.start": "开始",
      "task.finish": "完成",
      "task.reopen": "重开",
      "task.unassigned": "未指派",
      "task.titlePh": "任务标题",
      "task.created": "任务已创建",
      "task.new": "新建任务",
      "task.inReview": "待验收",
      "task.accepted": "已验收",
      "task.returned": "已打回",
      "task.filterAll": "全部 ",
      "task.filterTodo": "待办 ",
      "task.filterDoing": "进行中 ",
      "task.filterReview": "待验收 ",
      "task.filterDone": "已完成 ",
      "task.filterMine": "我的 ",
      "task.updated": "已更新",
      "task.advance": "推进",
      "task.submitReview": "提交验收",
      "task.withdrawQ": "撤回对「",
      "task.withdrawQ2": "」的提交？",
      "task.withdrawDone": "已撤回提交",
      "task.withdrawBtn": "撤回",
      "task.acceptedToast": "已验收通过",
      "task.approveBtn": "通过",
      "task.returnPrompt": "打回理由（必填）：",
      "task.returnBtn": "打回",
      "task.claimed": "已接领",
      "task.claimBtn": "接领",
      "task.delTask": "删除任务：",
      "task.assign": "指派：",
      "task.submittedBy": " · 提交：",
      "task.note": "说明：",
      "task.linkedSess": "关联会话：",
      "task.returnReason": "打回理由：",
      "task.reviewNote": "评审意见：",
      "task.phCommits": "提交内容（每行一条：commit 链接 / sha + 说明；可空）",
      "task.phSubmitNote": "提交说明（一句话，可空）",
      "task.loadingSess": "读取会话中…",
      "task.pickSess": "关联会话（可选）",
      "task.noSess": "关联会话（暂无可选）",
      "task.submittedToast": "已提交，等待验收",
      "task.submitBtn": "提交",
      "common.cancel": "取消",
      "task.empty": "暂无任务，先在上面建一条。",
      "task.emptyFilter": "此筛选下暂无任务",
      "sec.usage": "工作台用量",
      "sec.kb": "知识库",
      "sec.members": "成员管理",
      "sec.notify": "通知",
      "sec.ops": "运维",
      "sec.tasks": "任务板",
    };
    var LOC_EN = {
      "usage.loading": "Loading usage…",
      "usage.failOpen": "Usage data is temporarily unavailable (",
      "usage.portalHint": "This panel reads the ledger through the portal — open the workbench from the portal address (e.g. http://192.168.0.171:8080). Not available over the raw instance port.",
      "usage.monthPrefix": "This month · ",
      "usage.mid": " requests · missed ",
      "usage.outMid": " / output ",
      "usage.todayPrefix": "Today ",
      "usage.reqSuffix": " requests",
      "usage.budgetPrefix": "Budget ¥",
      "usage.overLimit": " over limit",
      "usage.remainingPrefix": "Remaining ¥",
      "usage.openPortal": "Open the full portal page (usage details) →",
      "common.required": "Content cannot be empty",
      "common.saving": "Saving…",
      "kb.savedTo": "Saved: notes/",
      "common.loading": "Loading…",
      "common.loadFailed": "Failed to load",
      "kb.delNote": "Delete note: ",
      "common.deletedColon": "Deleted: ",
      "kb.newNote": "Save a new note (into the shared knowledge base)",
      "kb.titlePh": "Title (e.g. pricing quick-calc conventions)",
      "common.tagsOpt": "Tags (optional)",
      "kb.bodyPh": "Body (Markdown) — write down conclusions / conventions / methods so teammates can reuse them",
      "kb.saveBtn": "Save to knowledge base",
      "kb.recentOpen": "Recent notes (",
      "kb.recentFailOpen": "Cannot read the notes list (",
      "common.collapse": "Collapse",
      "common.view": "View",
      "common.delete": "Delete",
      "kb.empty": "No notes yet.",
      "kb.searchPh": "Search (keywords)",
      "common.query": "Search",
      "kb.failOpen": "Knowledge base unavailable (",
      "kb.portalHint2": "). Open this panel from the portal (a logged-in session is required to reach the server knowledge base).",
      "kb.hitsPrefix": "Hits: ",
      "kb.hitsSuffix": " items",
      "kb.truncated": "(truncated)",
      "kb.noHits": "No matches. Try shorter keywords.",
      "kb.statsPrefix": "Knowledge base: ",
      "kb.statsMid": " files · ",
      "kb.statsUpdated": "updated ",
      "kb.statsEmpty": "empty (drop documents into the kb directory)",
      "kb.statsHint": "Put documents into ~/desk-data/kb on the server (a README lives there); agents in chat can read them too.",
      "drive.uploading": "Uploading: ",
      "drive.uploadFail": "Upload failed: ",
      "sec.drive": "Company drive",
      "common.refresh": "Refresh",
      "drive.uploadBtn": "Upload file",
      "drive.failOpen": "Company drive unavailable (",
      "drive.portalHint2": "). Open this panel from the portal (a logged-in session is required to reach the server drive).",
      "drive.emptyHint": "(Empty folder — click “Upload file”, or drop files into ~/desk-data/drive on the server)",
      "drive.pathHint": "Server path ~/desk-data/drive (Windows: \\\\wsl.localhost\\Ubuntu\\home\\yangc\\desk-data\\drive); 50 MB per file.",
      "common.processing": "Working…",
      "admin.pasteKey": "Paste the new key first",
      "admin.sameKey": "Same as the current key — nothing to change.",
      "admin.updatedOpen": "Updated (",
      "admin.restartSuffix": "), gateway restarting — the page refreshes in about 5–10 s.",
      "admin.loadingMembers": "Loading members and channels…",
      "admin.adminOnly": "This page is for administrators.",
      "admin.adminOnlySub": "Sign in from the portal with an admin account to manage members and model channels in the workbench settings.",
      "admin.loadFailOpen": "Cannot load admin data (",
      "admin.portalHint": "Open the workbench from the portal address (logged-in session); not available over the raw instance port.",
      "admin.soleAdmin": "sole administrator",
      "admin.delMember": "Delete member ",
      "admin.delMemberWarn": "?\nTheir virtual key will be revoked and login sessions cleared (irreversible; historical usage stays in the ledger).",
      "admin.delMemberDone": "Member deleted: ",
      "admin.rowInstance": " · instance ",
      "admin.rowBudget": " · budget ",
      "admin.unlimited": "unlimited",
      "admin.rowCreated": " · created ",
      "admin.rowMonth": "This month ",
      "admin.rowMonthMid": " requests · last 7 days ",
      "admin.activeSess": "● active",
      "admin.noSess": "○ no sessions",
      "admin.lastLogin": " · last login ",
      "admin.never": "never",
      "common.enable": "Enable",
      "common.disable": "Disable",
      "admin.channelToggled": "Channel now ",
      "admin.delChannel": "Delete channel ",
      "admin.channelDeleted": "Channel deleted: ",
      "admin.teamUsage7d": "Team usage, last 7 days · total ",
      "admin.upstreamTitle": "Team upstream (default)",
      "admin.upstreamDesc": "All members go upstream through here by default; external channels route by model name (see “Model channels” below). The key stays on the server — members never see it.",
      "admin.upstreamSrc": " (source ",
      "admin.keyMissing": "Key not configured",
      "admin.keyPh": "sk-… (paste a new DeepSeek API key; saving restarts the gateway in ~5–10 s)",
      "admin.updateKey": "Update key",
      "admin.keyEnvLocked": "The current key comes from the service environment (DESK_REAL_KEY); change it there.",
      "admin.keyScopeNote": "Changing the key only affects the default upstream; route specific models to other upstreams/keys with “Model channels” below.",
      "admin.membersCount": "Members (",
      "admin.newMember": "New member",
      "admin.phUsername": "Username (lowercase letters/digits, 2–32)",
      "admin.phPassword": "Initial password (min 6 chars)",
      "admin.phBudget": "Monthly budget CNY (leave empty = unlimited)",
      "admin.memberCreated": "Member created: ",
      "admin.createMember": "Create member",
      "admin.newKeyShown": "New member virtual key (shown once — copy it now for ",
      "admin.copied": "Copied to clipboard",
      "common.copyFail": "Copy failed — select and copy manually",
      "common.copy": "Copy",
      "common.keyDone": "Handed over — clear it",
      "admin.channelsCount": "Model channels (",
      "admin.noChannels": "No external channels yet (models go to DeepSeek official by default)",
      "admin.addChannel": "Add channel",
      "admin.phChannelName": "Name (lowercase, e.g. kimi)",
      "admin.phBaseUrl": "Base URL (OpenAI-compatible, include /v1)",
      "admin.phModels": "Model names (comma-separated)",
      "admin.phPrices": "Price table JSON (optional, ¥ per million tokens)",
      "common.phNote": "Note (optional)",
      "admin.badPrices": "Price table JSON parse failed",
      "admin.channelAdded": "Channel added: ",
      "admin.dangerNote": "Deleting a member is irreversible; historical usage stays in the ledger. When a member reaches 80% / 100% of budget the admins get an automatic notice through the notification channels. If the member has an instance service, stop it on the server with scripts/desk.sh. Channel keys live only in the server database.",
      "notify.loading": "Loading notification channels…",
      "notify.adminHint": "Sign in from the portal with an admin account to configure notification channels.",
      "notify.loadFailOpen": "Cannot read notification config (",
      "notify.portalHint": "Open the workbench from the portal address (logged-in session) and try again.",
      "notify.enabledSuffix": " · enabled",
      "notify.disabledSuffix": " · disabled",
      "notify.toggled": "Toggled: ",
      "notify.delChannel": "Delete notification channel ",
      "notify.channelsCount": "Notification channels (",
      "notify.empty": "No notification channels yet — add one and the workbench can push messages out (reminders / alerts / task updates).",
      "notify.addChannel": "Add channel",
      "notify.kindWebhook": "webhook — WeCom / DingTalk / any HTTP endpoint",
      "notify.kindHermes": "hermes — via the Hermes platform (WeChat etc.)",
      "notify.kindTelegram": "telegram — Bot API (BotFather bot; direct or proxied)",
      "notify.kindWhatsapp": "whatsapp — CallMeBot (free, personal) / green-api / UltraMsg",
      "notify.phName": "Name (lowercase, e.g. wecom-group / wechat-me)",
      "notify.phTelegram": "bot_token|chat_id (optional |api_base proxy)",
      "notify.phWhatsapp": "callmebot|apikey|phone or greenapi|id|token|chatId or ultramsg|id|token|to",
      "notify.tgHint": "Get a bot_token from @BotFather; chat_id is @channelname or a numeric ID; append |api_base to point at a reverse proxy when direct access fails.",
      "notify.waHint": "CallMeBot: message +34 644 51 95 23 to request an apikey (free, personal). green-api / UltraMsg are commercial gateways (instance ID + token + recipient).",
      "notify.added": "Channel added: ",
      "notify.testSend": "Send test notification",
      "notify.testSendHint": "Goes to every enabled channel (including phones)",
      "notify.removed": "Reminder deleted #",
      "notify.remindersCount": "Scheduled reminders (",
      "notify.noReminders": "No pending reminders. To add one: have an agent run ~/desk-data/bin/desk-remind \"10:00\" \"text\"",
      "notify.recentSent": "Recently sent",
      "notify.noSent": "Nothing sent yet",
      "notify.help": "Agent side: desk-notify \"title\" \"body\" sends immediately; desk-remind \"10:00\" \"text\" schedules one (auto-pushed at the time; supports +30m / tomorrow 09:00). WeCom group bot: group settings → group bot → copy the webhook URL into a channel above.",
      "relTime.days": "d ",
      "relTime.hours": "h",
      "relTime.hoursMid": "h ",
      "relTime.mins": "m",
      "relTime.minutes": "m",
      "ops.loading": "Loading ops status…",
      "ops.adminHint": "Sign in from the portal with an admin account to view this.",
      "ops.loadFailOpen": "Cannot read ops data (",
      "ops.portalHint": "Open the workbench from the portal address and try again.",
      "ops.services": "Services (systemd)",
      "ops.ports": "Port probes",
      "ops.backups": "Backups (",
      "ops.backupMid": " sets · total ",
      "ops.backupLast": "latest: ",
      "ops.noBackups": "(no backup artifacts yet; the timer runs daily at 03:40)",
      "ops.disk": "Disk / data",
      "ops.free": "Free ",
      "ops.ofTotal": " / of ",
      "ops.kbSize": "knowledge base ",
      "ops.driveSize": " · drive ",
      "ops.host": "Host / processes",
      "ops.uptime": "WSL up ",
      "ops.mem": " · memory ",
      "ops.procs": "workbench processes ",
      "ann.title": "Team announcements & feedback",
      "ann.tab": "Announcements",
      "ann.failHint": "Cannot load announcements (open from the portal and sign in).",
      "ann.publish": "Post announcement",
      "ann.phTitle": "Title (optional)",
      "ann.phBody": "Announcement…",
      "ann.posted": "Announcement posted",
      "ann.untitled": "(untitled)",
      "ann.delConfirm": "Delete this announcement?",
      "common.deleted": "Deleted",
      "ann.empty": "No announcements",
      "ann.feedbackTab": "Feedback",
      "ann.everyone": "(everyone)",
      "ann.phFeedback": "Send feedback or report an issue to the admins…",
      "ann.feedbackThanks": "Feedback submitted — thanks!",
      "ann.submitFeedback": "Submit feedback",
      "common.noFeedback": "No feedback yet",
      "common.noFeedbackMine": "You haven't submitted feedback yet",
      "ann.titleShort": "Team announcements",
      "ann.footerLabel": "Announcements & feedback",
      "asst.title": "Team assistants: agent preset gallery (expert mode)",
      "asst.tab": "Assistants",
      "asst.failHint": "Cannot load presets (open from the portal and sign in).",
      "asst.empty": "No presets in the shared area yet.",
      "asst.codex": "Codex parallel",
      "asst.available": "Available assistants",
      "asst.note": "An assistant = a preset persona + tool set. Default choice: Settings → Agent presets; add or remove directories under presets/ in the shared area — applies to new sessions.",
      "asst.team": "Team assistant",
      "asst.panelTitle": "Agent presets (expert mode)",
      "skl.title": "Skill library + connector status",
      "skl.tab": "Skills & connectors",
      "skl.skills": "Skills",
      "skl.connectors": "Connectors",
      "common.failHint": "Cannot load (open from the portal and sign in).",
      "common.back": "← Back",
      "skl.empty": "The shared skill library is empty.",
      "skl.trigger": "Trigger: ",
      "skl.hint": "Click a skill to read it in full; to add one, drop a folder into skills/ in the shared area — every instance gets it automatically.",
      "skl.noConn": "No connector info.",
      "skl.legend": "Status is read-only probing: green = connected, grey = not configured (optional), red = error.",
      "skl.titleShort": "Expert skills · connectors",
      "skl.panelTitle": "Skill library full text + connector status",
      "auto.phTime": "Time format: 10:00 / tomorrow 09:00 / 09-22 10:00 / +30m",
      "auto.added": "Added — the reminder is pushed at the set time (WeChat/Webhook channels)",
      "auto.title": "Automation: reminders & team automation",
      "auto.tab": "Automation",
      "auto.pending": "Pending reminders (",
      "auto.emptyPending": "No pending reminders.",
      "auto.phTime2": "10:00 / +30m / tomorrow 09:00",
      "auto.phText": "Reminder text",
      "common.add": "Add",
      "auto.hintAdmin": "Pushed through the notification bridge at the set time. You can also just tell an assistant: remind me tomorrow 09:00 meeting.",
      "auto.hintMember": "Members can view the reminder list; ask an admin to add / remove, or tell an assistant: remind me tomorrow 09:00 meeting.",
      "auto.recent": "Recently sent",
      "auto.panelTitle": "Reminders & team automation",
      "sess.tab": "Sessions",
      "sess.notStarted": " · not started",
      "sess.pending": "⏳ Pending approval",
      "sess.approved": "✅ Approved",
      "sess.rejected": "❌ Rejected",
      "sess.cancelled": "Cancelled",
      "sec.sessions": "Sessions",
      "sess.intro": "Deletion needs admin confirmation: members submit a request → an admin approves and it runs; admins can delete directly. Deleting briefly restarts the affected instance (about 10–30 s).",
      "sess.mine": "My sessions (",
      "sess.loadHint": "Cannot load sessions (open from the workbench page).",
      "sess.empty": "No sessions.",
      "sess.delDirect": "Delete this session directly? (Admin delete; the instance will restart briefly)",
      "sess.deletedRestarting": "Deleted — instance restarting (about 10–30 s)",
      "sess.requestCancelled": "Request withdrawn",
      "common.withdraw": "Withdraw",
      "sess.waitingAdmin": "⏳ Waiting for admin approval",
      "sess.requested": "Submitted — waiting for admin approval",
      "sess.requestDelete": "Request deletion",
      "sess.running": " · ● running",
      "sess.child": " · child session",
      "sess.preset": " · preset ",
      "sess.myRequests": "My requests",
      "sess.requestedAt": " · requested at ",
      "sess.noRequests": "No requests yet.",
      "sess.pendingCount": "Pending approval (",
      "sess.approveDelete": "Approve & delete ",
      "sess.approveDeleteQ": " session for this user? (their instance will restart briefly)",
      "sess.approvedDone": "Approved and deleted (the instance restarts automatically in ~10–30 s)",
      "sess.approveBtn": "Approve deletion",
      "sess.rejectedToast": "Rejected",
      "sess.rejectBtn": "Reject",
      "sess.noPending": "No pending requests.",
      "sess.memberSessions": "Member sessions",
      "sess.pickMember": "Choose a member…",
      "sess.noInstance": "(no instance)",
      "sess.pickFirst": "Choose a member first",
      "sess.loadBtn": "Load sessions",
      "sess.delOther": "Delete ",
      "sess.delOtherQ": " session for this user?",
      "sess.delDirectBtn": "Delete now",
      "sess.memberNone": "This member has no sessions.",
      "sess.recent": "Recently handled",
      "task.loading": "Loading task board…",
      "task.failHint": "Cannot load the task board (open from the portal and sign in).",
      "task.todo": "To-do",
      "task.doing": "In progress",
      "task.done": "Done",
      "task.start": "Start",
      "task.finish": "Finish",
      "task.reopen": "Reopen",
      "task.unassigned": "Unassigned",
      "task.titlePh": "Task title",
      "task.created": "Task created",
      "task.new": "New task",
      "task.inReview": "In review",
      "task.accepted": "Accepted",
      "task.returned": "Returned",
      "task.filterAll": "All ",
      "task.filterTodo": "To-do ",
      "task.filterDoing": "In progress ",
      "task.filterReview": "In review ",
      "task.filterDone": "Done ",
      "task.filterMine": "Mine ",
      "task.updated": "Updated",
      "task.advance": "Advance",
      "task.submitReview": "Submit for review",
      "task.withdrawQ": "Withdraw the submission for “",
      "task.withdrawQ2": "”?",
      "task.withdrawDone": "Submission withdrawn",
      "task.withdrawBtn": "Withdraw",
      "task.acceptedToast": "Accepted",
      "task.approveBtn": "Approve",
      "task.returnPrompt": "Return reason (required):",
      "task.returnBtn": "Return",
      "task.claimed": "Claimed",
      "task.claimBtn": "Claim",
      "task.delTask": "Delete task: ",
      "task.assign": "Assign: ",
      "task.submittedBy": " · submitted: ",
      "task.note": "Note: ",
      "task.linkedSess": "Linked sessions: ",
      "task.returnReason": "Return reason: ",
      "task.reviewNote": "Review note: ",
      "task.phCommits": "Submitted content (one per line: commit link / sha + note; can be empty)",
      "task.phSubmitNote": "Submission note (one sentence, optional)",
      "task.loadingSess": "Loading sessions…",
      "task.pickSess": "Linked session (optional)",
      "task.noSess": "Linked session (none available)",
      "task.submittedToast": "Submitted — awaiting review",
      "task.submitBtn": "Submit",
      "common.cancel": "Cancel",
      "task.empty": "No tasks yet — create one above.",
      "task.emptyFilter": "No tasks under this filter",
      "sec.usage": "Usage",
      "sec.kb": "Knowledge base",
      "sec.members": "Members",
      "sec.notify": "Notifications",
      "sec.ops": "Ops",
      "sec.tasks": "Task board",
    };
    var DESK_CTX = null;
    var DESK_T = null;
    function tr(key) {
      if (DESK_T) { try { var v = DESK_T(key); if (v) return v; } catch (e) { /* fallthrough */ } }
      return LOC_ZH[key] || key;
    }
    function deskLang() {
      try { return (DESK_CTX && DESK_CTX.locale && DESK_CTX.locale.getLocale().active === "en") ? "en" : "zh"; } catch (e) { return "zh"; }
    }
    /** 语言信号：宿主接管/用户切换语言后 +1；组件用它重取"服务端按语言生成"的文案 */
    function useLocaleSignal() {
      var pair = React.useState(0);
      React.useEffect(function () {
        try {
          if (!DESK_CTX || !DESK_CTX.locale) return undefined;
          return DESK_CTX.locale.subscribe(function () {
            pair[1](function (x) { return x + 1; });
          });
        } catch (e) {
          return undefined;
        }
      }, []);
      return pair[0];
    }
    var DESK_CSS = `
.ddb { display:flex; align-items:center; gap:10px; width:100%; padding:7px 10px; border:0; border-radius:10px; background:transparent; color:inherit; cursor:pointer; font-size:13px; text-align:left; transition:background .13s ease; }
.ddb:hover { background:var(--dsw-alias-interactive-bg-hover-default, rgba(127,127,127,.12)); }
.ddb.rail { justify-content:center; padding:7px 6px; }
.ddb .ic { width:26px; height:26px; border-radius:8px; display:flex; align-items:center; justify-content:center; font-size:15px; background:var(--dsw-alias-bg-base, rgba(127,127,127,.10)); flex:0 0 auto; }
.ddb .lbl { flex:1; min-width:0; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
.ddb .badge { font-size:10.5px; font-weight:700; line-height:1; padding:3px 7px; border-radius:999px; background:#d64545; color:#fff; }
.ddp { position:fixed; left:12px; bottom:76px; width:428px; max-width:calc(100vw - 24px); max-height:74vh; display:flex; flex-direction:column; background:var(--dsw-alias-bg-layer-2, #fff); border:1px solid var(--dsw-alias-border-l2, #d0d3d9); border-radius:16px; box-shadow:0 18px 50px rgba(16,24,40,.22), 0 2px 8px rgba(16,24,40,.08); z-index:9999; color:inherit; overflow:hidden; }
.ddp .hd { display:flex; align-items:center; gap:11px; padding:13px 14px 12px; border-bottom:1px solid var(--dsw-alias-border-l2, #e8eaed); }
.ddp .hd .ico { width:34px; height:34px; border-radius:10px; display:flex; align-items:center; justify-content:center; font-size:17px; background:var(--dsw-alias-bg-base, #f2f3f5); flex:0 0 auto; }
.ddp .hd .t1 { font-weight:700; font-size:14px; line-height:1.3; }
.ddp .hd .t2 { font-size:11.5px; color:var(--dsw-alias-label-tertiary, #8a8f98); margin-top:1px; }
.ddp .hd .x { margin-left:auto; width:28px; height:28px; border:0; border-radius:8px; background:transparent; color:inherit; cursor:pointer; font-size:13px; opacity:.75; flex:0 0 auto; }
.ddp .hd .x:hover { background:rgba(127,127,127,.14); opacity:1; }
.ddp .bd { padding:4px 14px 14px; overflow-y:auto; }
.ddp .lb { font-size:11px; font-weight:600; letter-spacing:.4px; color:var(--dsw-alias-label-tertiary, #8a8f98); margin:12px 0 2px; }
.ddp .list { display:flex; flex-direction:column; }
.ddp .it { display:flex; gap:10px; align-items:flex-start; padding:9px 8px; margin:0 -8px; border-radius:10px; }
.ddp .it.hv { cursor:pointer; transition:background .12s; }
.ddp .it.hv:hover { background:rgba(127,127,127,.10); }
.ddp .it .ico2 { width:26px; height:26px; border-radius:8px; display:flex; align-items:center; justify-content:center; font-size:14px; background:var(--dsw-alias-bg-base, #f2f3f5); flex:0 0 auto; margin-top:1px; }
.ddp .gr { flex:1; min-width:0; }
.ddp .th { display:flex; align-items:center; justify-content:space-between; gap:8px; }
.ddp .t { font-weight:600; font-size:13px; line-height:1.4; }
.ddp .d { font-size:12px; color:var(--dsw-alias-label-tertiary, #8a8f98); margin-top:2px; line-height:1.55; }
.ddp .bd2 { font-size:12.5px; margin-top:4px; white-space:pre-wrap; line-height:1.6; }
.ddp .bdg { display:inline-block; font-size:10px; font-weight:600; line-height:1; padding:3px 7px; border-radius:999px; background:rgba(79,124,247,.12); color:#4f7cf7; margin-left:6px; vertical-align:1px; flex:0 0 auto; }
.ddp .tag { display:inline-block; font-size:10px; line-height:1; padding:3px 7px; border-radius:999px; background:var(--dsw-alias-bg-base, #f2f3f5); color:var(--dsw-alias-label-tertiary, #8a8f98); flex:0 0 auto; }
.ddp .dot { width:9px; height:9px; border-radius:50%; flex:0 0 auto; margin-top:7px; box-shadow:0 0 0 3px rgba(127,127,127,.08); }
.ddp .dot.ok { background:#31a24c; } .ddp .dot.bad { background:#d64545; } .ddp .dot.off { background:#b6bbc2; }
.ddp .tabs { display:flex; gap:3px; padding:3px; margin:10px 0 2px; background:var(--dsw-alias-bg-base, #f2f3f5); border-radius:10px; }
.ddp .tabs .tb { flex:1; border:0; border-radius:8px; padding:6px 8px; background:transparent; color:var(--dsw-alias-label-secondary, #5f6570); font-size:12.5px; font-weight:500; cursor:pointer; }
.ddp .tabs .tb.on { background:var(--dsw-alias-bg-layer-2, #fff); color:inherit; font-weight:600; box-shadow:0 1px 3px rgba(16,24,40,.12); }
.ddp .code { font-family:ui-monospace, Consolas, monospace; font-size:12px; line-height:1.65; background:var(--dsw-alias-bg-base, #f6f7f8); border:1px solid var(--dsw-alias-border-l2, #e8eaed); border-radius:10px; padding:10px 12px; white-space:pre-wrap; word-break:break-word; max-height:360px; overflow:auto; margin:2px 0 0; }
.ddp .ft { border-top:1px solid var(--dsw-alias-border-l2, #e8eaed); margin-top:12px; padding:9px 2px 0; font-size:12px; color:var(--dsw-alias-label-secondary, #65676b); line-height:1.65; }
.ddp .fm { display:flex; flex-direction:column; gap:8px; margin-top:8px; }
.ddp .row { display:flex; gap:8px; align-items:center; margin-top:8px; flex-wrap:wrap; }
.ddp .inp { width:100%; min-width:0; height:34px; border:1px solid var(--dsw-alias-border-l2, #d4d7dc); border-radius:9px; padding:0 11px; font-size:12.5px; background:transparent; color:inherit; outline:none; box-sizing:border-box; transition:border-color .15s, box-shadow .15s; }
.ddp .inp.ta { height:auto; min-height:64px; padding:9px 11px; resize:vertical; line-height:1.6; font-family:inherit; }
.ddp .inp:focus { border-color:#4f7cf7; box-shadow:0 0 0 3px rgba(79,124,247,.15); }
.ddp .btn { height:33px; padding:0 14px; border:0; border-radius:9px; background:#4f7cf7; color:#fff; font-size:12.5px; font-weight:600; cursor:pointer; transition:background .15s; }
.ddp .btn:hover { background:#3f6be6; }
.ddp .btn.gh { background:transparent; border:1px solid var(--dsw-alias-border-l2, #d4d7dc); color:inherit; font-weight:500; }
.ddp .btn.gh:hover { background:rgba(127,127,127,.10); }
.ddp .mini { border:1px solid var(--dsw-alias-border-l2, #d4d7dc); background:transparent; color:inherit; font-size:11.5px; padding:3px 10px; border-radius:7px; cursor:pointer; flex:0 0 auto; opacity:.85; }
.ddp .mini:hover { background:rgba(127,127,127,.10); opacity:1; }
.ddp .msg { font-size:12px; margin-top:9px; color:var(--dsw-alias-label-tertiary, #8a8f98); }
.ddp .msg.err { color:#d64545; } .ddp .msg.ok { color:#31a24c; }
.ddp .empty { color:var(--dsw-alias-label-tertiary, #8a8f98); font-size:12.5px; padding:10px 2px; }
.ddp .sub { font-size:12px; color:var(--dsw-alias-label-tertiary, #8a8f98); margin:6px 0 2px; }
/* 侧栏底部动作区：壳默认为「横排不换行」，多个带文字入口会溢出被挤掉 —— 强制纵向堆叠成菜单 */
[class*="footerActions"] { flex-direction: column !important; align-items: stretch !important; gap: 2px !important; }
[class*="footerActions"] > div { width: 100%; }
`;
    (function () {
      try {
        if (!document.getElementById("dsh-desk-css")) {
          var st = document.createElement("style");
          st.id = "dsh-desk-css";
          st.textContent = DESK_CSS;
          (document.head || document.documentElement).appendChild(st);
        }
      } catch (e) { /* 注入失败不影响功能 */ }
    })();

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
    function fmtAt(s) {
      if (!s) return "";
      var d = new Date(String(s).replace(" ", "T") + "Z");
      if (isNaN(d.getTime())) return String(s).slice(5, 16);
      function p2(x) {
        return (x < 10 ? "0" : "") + x;
      }
      return p2(d.getMonth() + 1) + "-" + p2(d.getDate()) + " " + p2(d.getHours()) + ":" + p2(d.getMinutes());
    }
    var footBtn = {
      display: "flex",
      alignItems: "center",
      justifyContent: "flex-start",
      gap: 6,
      padding: "8px 12px",
      border: 0,
      borderRadius: 8,
      background: "transparent",
      color: "inherit",
      cursor: "pointer",
      fontSize: 13,
      width: "100%",
      textAlign: "left",
    };
    var panelStyle = {
      position: "fixed",
      left: 12,
      bottom: 76,
      width: 400,
      maxWidth: "calc(100vw - 24px)",
      maxHeight: "72vh",
      overflowY: "auto",
      background: "var(--dsw-alias-bg-layer-1, #fff)",
      border: "1px solid var(--dsw-alias-border-l2, #ccd0d5)",
      borderRadius: 12,
      boxShadow: "0 10px 30px rgba(0,0,0,0.18)",
      zIndex: 9999,
      padding: 12,
      display: "flex",
      flexDirection: "column",
      gap: 8,
      fontSize: 13,
      color: "var(--dsw-alias-label-primary, #1c1e21)",
    };
    var formCol = { display: "flex", flexDirection: "column", gap: 6 };
    var textareaStyle = {
      width: "100%",
      boxSizing: "border-box",
      padding: "8px 10px",
      border: "1px solid var(--dsw-alias-border-l2, #ccd0d5)",
      borderRadius: 8,
      background: "var(--dsw-alias-bg-layer-1, #fff)",
      color: "inherit",
      fontSize: 13,
      minHeight: 60,
      resize: "vertical",
      fontFamily: "inherit",
    };
    var btnPill = {
      padding: "6px 10px",
      border: "1px solid var(--dsw-alias-border-l2, #ccd0d5)",
      borderRadius: 999,
      background: "transparent",
      color: "inherit",
      cursor: "pointer",
      fontSize: 12,
    };
    var btnPillOn = {
      padding: "6px 10px",
      border: "1px solid var(--dsw-alias-border-l2, #ccd0d5)",
      borderRadius: 999,
      background: "var(--dsw-alias-bg-base, #f0f1f3)",
      color: "inherit",
      cursor: "pointer",
      fontSize: 12,
      fontWeight: 600,
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

    function fmtTs(ep) {
      var d = new Date(Number(ep) * 1000);
      var p = function (n) {
        return (n < 10 ? "0" : "") + n;
      };
      return d.getMonth() + 1 + "-" + p(d.getDate()) + " " + p(d.getHours()) + ":" + p(d.getMinutes());
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

      if (state.phase === "loading") return h("div", { style: wrap }, tr("usage.loading"));

      if (state.phase === "error") {
        return h(
          "div",
          { style: wrap },
          h("div", null, tr("usage.failOpen") + state.message + "）。"),
          h(
            "div",
            { style: muted },
            tr("usage.portalHint")
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
            tr("usage.monthPrefix") + d.month.events + tr("usage.mid") + d.month.miss + tr("usage.outMid") + d.month.out + " tokens"
          )
        )
      );
      kids.push(h("div", { key: "today", style: muted }, tr("usage.todayPrefix") + fmt(d.day.cost) + " · " + d.day.events + tr("usage.reqSuffix")));
      if (d.budget != null) {
        kids.push(
          h(
            "div",
            { key: "budget", style: muted },
            tr("usage.budgetPrefix") + d.budget + "(" + (d.month.cost >= d.budget ? tr("usage.overLimit") : tr("usage.remainingPrefix") + (d.budget - d.month.cost).toFixed(4)) + ")"
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
            tr("usage.openPortal")
          )
        )
      );
      return h("div", { style: wrap }, kids);
    }

    function KbDeposit() {
      var pair = React.useState({ phase: "loading", role: "member", notes: [], message: "", expanded: "", expandedContent: "" });
      var st = pair[0];
      var setSt = pair[1];
      var tRef = React.useRef(null);
      var gRef = React.useRef(null);
      var cRef = React.useRef(null);

      function setMsg(msg) {
        var n = {};
        for (var k in st) n[k] = st[k];
        n.message = msg;
        setSt(n);
      }

      React.useEffect(function () {
        fetch("/portal/api/kb/list", { headers: { accept: "application/json" } })
          .then(function (r) {
            if (!r.ok) throw new Error("HTTP " + r.status);
            return r.json();
          })
          .then(function (d) {
            setSt({ phase: "ready", role: d.role || "member", notes: d.notes || [], message: "", expanded: "", expandedContent: "" });
          })
          .catch(function (e) {
            setSt({ phase: "error", role: "member", notes: [], message: String((e && e.message) || e), expanded: "", expandedContent: "" });
          });
      }, []);

      function reload(msg) {
        fetch("/portal/api/kb/list", { headers: { accept: "application/json" } })
          .then(function (r) {
            return r.json();
          })
          .then(function (d) {
            setSt({ phase: "ready", role: d.role || "member", notes: d.notes || [], message: msg || "", expanded: "", expandedContent: "" });
          })
          .catch(function () {
            setMsg(msg || "");
          });
      }

      function save() {
        var title = tRef.current ? tRef.current.value : "";
        var tags = gRef.current ? gRef.current.value : "";
        var content = cRef.current ? cRef.current.value : "";
        if (!String(content).trim()) {
          setMsg(tr("common.required"));
          return;
        }
        setMsg(tr("common.saving"));
        fetch("/portal/api/kb/save?lang=" + deskLang(), { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ title: title, tags: tags, content: content }) })
          .then(function (r) {
            return r.json().then(function (d) {
              return { status: r.status, d: d };
            });
          })
          .then(function (res) {
            if (res.status !== 200) {
              setMsg((res.d && res.d.error) || "HTTP " + res.status);
              return;
            }
            if (tRef.current) tRef.current.value = "";
            if (gRef.current) gRef.current.value = "";
            if (cRef.current) cRef.current.value = "";
            reload(tr("kb.savedTo") + res.d.name);
          })
          .catch(function (e) {
            setMsg(String((e && e.message) || e));
          });
      }

      function openNote(name) {
        if (st.expanded === name) {
          var n1 = {};
          for (var k1 in st) n1[k1] = st[k1];
          n1.expanded = "";
          n1.expandedContent = "";
          setSt(n1);
          return;
        }
        var n2 = {};
        for (var k2 in st) n2[k2] = st[k2];
        n2.expanded = name;
        n2.expandedContent = tr("common.loading");
        setSt(n2);
        fetch("/portal/api/kb/note?name=" + encodeURIComponent(name), { headers: { accept: "application/json" } })
          .then(function (r) {
            return r.json();
          })
          .then(function (d) {
            var n3 = {};
            for (var k3 in st) n3[k3] = st[k3];
            n3.expanded = name;
            n3.expandedContent = d.ok ? d.content : d.error || tr("common.loadFailed");
            setSt(n3);
          })
          .catch(function (e) {
            var n4 = {};
            for (var k4 in st) n4[k4] = st[k4];
            n4.expanded = name;
            n4.expandedContent = String((e && e.message) || e);
            setSt(n4);
          });
      }

      function del(name) {
        if (!window.confirm(tr("kb.delNote") + name + "?")) return;
        fetch("/portal/api/kb/rm?lang=" + deskLang(), { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ name: name }) })
          .then(function (r) {
            return r.json().then(function (d) {
              return { status: r.status, d: d };
            });
          })
          .then(function (res) {
            reload(res.status === 200 ? tr("common.deletedColon") + name : (res.d && res.d.error) || "HTTP " + res.status);
          })
          .catch(function (e) {
            setMsg(String((e && e.message) || e));
          });
      }

      var kids = [];
      kids.push(h("div", { key: "hd", style: { fontWeight: 600, marginBottom: 6 } }, tr("kb.newNote")));
      kids.push(
        h(
          "div",
          { key: "f", style: { display: "flex", flexDirection: "column", gap: 6 } },
          h(
            "div",
            { style: { display: "flex", gap: 8 } },
            h("input", { ref: tRef, placeholder: tr("kb.titlePh"), style: Object.assign({}, field, { flex: 1 }) }),
            h("input", { ref: gRef, placeholder: tr("common.tagsOpt"), style: Object.assign({}, field, { width: 140 }) })
          ),
          h("textarea", { ref: cRef, placeholder: tr("kb.bodyPh"), style: Object.assign({}, textareaStyle, { minHeight: 100 }) }),
          h("div", null, h("button", { style: btnDark, onClick: save }, tr("kb.saveBtn")))
        )
      );
      if (st.message) kids.push(h("div", { key: "msg", style: Object.assign({ fontSize: 12 }, muted) }, st.message));
      kids.push(h("div", { key: "rec", style: { fontWeight: 600, margin: "10px 0 4px" } }, tr("kb.recentOpen") + st.notes.length + ")"));
      if (st.phase === "error") {
        kids.push(h("div", { key: "err", style: muted }, tr("kb.recentFailOpen") + st.message + "）。"));
      } else {
        var rows = [];
        for (var i = 0; i < st.notes.length; i++) {
          (function (n) {
            var isOpen = st.expanded === n.name;
            var actions = [h("button", { key: "v", style: btnSmall, onClick: function () { openNote(n.name); } }, isOpen ? tr("common.collapse") : tr("common.view"))];
            if (st.role === "admin") {
              actions.push(h("button", { key: "d", style: btnSmall, onClick: function () { del(n.name); } }, tr("common.delete")));
            }
            rows.push(
              h(
                "div",
                { key: "n" + n.name, style: rowBase },
                h(
                  "div",
                  { style: { display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 } },
                  h("span", { style: { fontWeight: 600 } }, n.title),
                  h("span", null, actions)
                ),
                h("div", { style: Object.assign({ fontSize: 11 }, muted) }, n.mtime + (n.author ? " · " + n.author : "")),
                isOpen ? h("div", { style: { whiteSpace: "pre-wrap", marginTop: 4 } }, st.expandedContent) : null
              )
            );
          })(st.notes[i]);
        }
        kids.push(h("div", { key: "rows" }, rows.length ? rows : h("div", { style: muted }, tr("kb.empty"))));
      }
      return h("div", { key: "deposit", style: { marginTop: 14, borderTop: "1px solid var(--dsw-alias-border-l2, #ccd0d5)", paddingTop: 10 } }, kids);
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
        placeholder: tr("kb.searchPh"),
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
            tr("common.query")
          )
        ),
      ];

      if (st.phase === "error") {
        kids.push(
          h("div", { key: "err", style: muted }, tr("kb.failOpen") + st.message + tr("kb.portalHint2"))
        );
      }
      if (st.phase === "ready") {
        if (st.q) {
          kids.push(h("div", { key: "cnt", style: muted }, tr("kb.hitsPrefix") + st.hits.length + tr("kb.hitsSuffix") + (st.truncated ? tr("kb.truncated") : "")));
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
          if (!hitNodes.length) kids.push(h("div", { key: "none", style: muted }, tr("kb.noHits")));
          kids.push(h("div", { key: "hits" }, hitNodes));
        }
      }
      if (st.stats) {
        kids.push(
          h(
            "div",
            { key: "stats", style: muted },
            tr("kb.statsPrefix") + st.stats.files + tr("kb.statsMid") + (st.stats.updatedAt ? tr("kb.statsUpdated") + st.stats.updatedAt.slice(0, 16).replace("T", " ") + "（UTC）" : tr("kb.statsEmpty"))
          )
        );
      }
      kids.push(h("div", { key: "tip", style: muted }, tr("kb.statsHint")));
      kids.push(h(KbDeposit, { key: "deposit" }));
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
        setSt({ phase: "loading", path: st.path, entries: st.entries, message: tr("drive.uploading") + f.name + " …" });
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
            setSt({ phase: "ready", path: st.path, entries: st.entries, message: tr("drive.uploadFail") + String((e && e.message) || e) });
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
          tr("sec.drive")
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
          tr("common.refresh")
        ),
        h(
          "button",
          {
            onClick: function () {
              if (fileRef.current) fileRef.current.click();
            },
            style: btnDark,
          },
          tr("drive.uploadBtn")
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
        kids.push(h("div", { key: "err", style: muted }, tr("drive.failOpen") + st.message + tr("drive.portalHint2")));
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
        kids.push(h("div", { key: "empty", style: muted }, tr("drive.emptyHint")));
      }
      kids.push(
        h(
          "div",
          { key: "tip", style: muted },
          tr("drive.pathHint")
        )
      );
      return h("div", { style: wrap }, kids);
    }

    function AdminSection() {
      var dataPair = React.useState({ phase: "loading", members: [], channels: [], trend: [], message: "" });
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
      var upPair = React.useState({ phase: "loading", upstream: "", keySet: false, keyMasked: "", source: "", writable: true });
      var up = upPair[0];
      var setUp = upPair[1];
      var upKeyRef = React.useRef(null);

      function load(quiet) {
        if (!quiet) setData({ phase: "loading", members: [], channels: [], message: "" });
        fetch("/portal/api/admin/upstream?lang=" + deskLang(), { headers: { accept: "application/json" } })
          .then(function (r) { return r.ok ? r.json() : {}; })
          .then(function (d) { setUp({ phase: "ready", upstream: d.upstream || "", keySet: !!d.keySet, keyMasked: d.keyMasked || "", source: d.source || "", writable: d.writable !== false }); })
          .catch(function () { setUp({ phase: "error", upstream: "", keySet: false, keyMasked: "", source: "", writable: true }); });
        fetch("/portal/api/admin/overview", { headers: { accept: "application/json" } })
          .then(function (r) {
            if (r.status === 403) throw new Error("NOPERM");
            if (r.status === 401) throw new Error("NOLOGIN");
            if (!r.ok) throw new Error("HTTP " + r.status);
            return r.json();
          })
          .then(function (d) {
            setData({ phase: "ready", members: d.members || [], channels: d.channels || [], trend: d.trend || [], message: "" });
          })
          .catch(function (e) {
            setData({ phase: "error", members: [], channels: [], message: String((e && e.message) || e) });
          });
      }
      React.useEffect(function () {
        load(false);
      }, []);

      function post(path, body, okText) {
        setMsg({ kind: "info", text: tr("common.processing") });
        return fetch(path + (path.indexOf("?") >= 0 ? "&" : "?") + "lang=" + deskLang(), { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) })
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

      function saveUpstream(raw) {
        if (!raw) {
          setMsg({ kind: "err", text: tr("admin.pasteKey") });
          return;
        }
        setMsg({ kind: "info", text: tr("common.saving") });
        fetch("/portal/api/admin/upstream-set?lang=" + deskLang(), { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ api_key: raw }) })
          .then(function (r) {
            return r.json().then(function (d) {
              return { status: r.status, d: d };
            });
          })
          .then(function (res) {
            if (res.status !== 200 || (res.d && res.d.error)) {
              setMsg({ kind: "err", text: (res.d && res.d.error) || "HTTP " + res.status });
              return;
            }
            if (res.d && res.d.unchanged) {
              setMsg({ kind: "ok", text: tr("admin.sameKey") });
              return;
            }
            if (upKeyRef.current) upKeyRef.current.value = "";
            setMsg({ kind: "ok", text: tr("admin.updatedOpen") + ((res.d && res.d.keyMasked) || "") + tr("admin.restartSuffix") });
            setTimeout(function () { load(true); }, 12000);
          })
          .catch(function (e) {
            setMsg({ kind: "err", text: String((e && e.message) || e) });
          });
      }

      if (data.phase === "loading") return h("div", { style: wrap }, tr("admin.loadingMembers"));
      if (data.phase === "error") {
        if (data.message === "NOPERM")
          return h(
            "div",
            { style: wrap },
            h("div", null, tr("admin.adminOnly")),
            h("div", { style: muted }, tr("admin.adminOnlySub"))
          );
        return h(
          "div",
          { style: wrap },
          h("div", null, tr("admin.loadFailOpen") + data.message + "）。"),
          h("div", { style: muted }, tr("admin.portalHint"))
        );
      }

      var adminCount = 0;
      for (var i = 0; i < data.members.length; i++) if (data.members[i].role === "admin") adminCount++;

      var memberRows = [];
      for (var m = 0; m < data.members.length; m++) {
        var u = data.members[m];
        var ops;
        if (u.role === "admin" && adminCount <= 1) {
          ops = h("span", { style: Object.assign({ fontSize: 12 }, muted) }, tr("admin.soleAdmin"));
        } else {
          ops = h(
            "button",
            {
              style: btnDanger,
              onClick: (function (name) {
                return function () {
                  if (!window.confirm(tr("admin.delMember") + name + tr("admin.delMemberWarn"))) return;
                  post("/portal/api/admin/member-delete", { username: name }, tr("admin.delMemberDone") + name);
                };
              })(u.username),
            },
            tr("common.delete")
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
              "#" + u.id + tr("admin.rowInstance") + (u.port || "-") + tr("admin.rowBudget") + (u.budget != null ? "¥" + u.budget : tr("admin.unlimited")) + tr("admin.rowCreated") + String(u.createdAt || "").slice(0, 10)
            ),
            h(
              "div",
              { style: Object.assign({ fontSize: 12 }, muted) },
              tr("admin.rowMonth") + fmt(u.monthCost) + " / " + u.monthEvents + tr("admin.rowMonthMid") + fmt(u.week7) + " · " + (u.online ? tr("admin.activeSess") : tr("admin.noSess")) + tr("admin.lastLogin") + (u.lastLogin ? String(u.lastLogin).slice(5, 16) : tr("admin.never"))
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
              h("span", null, ch.name + " ", h("span", { style: Object.assign({ fontSize: 12 }, muted) }, ch.enabled ? tr("common.enable") : tr("common.disable"))),
              h(
                "span",
                { style: { display: "flex", gap: 6 } },
                h(
                  "button",
                  {
                    style: btnSmall,
                    onClick: (function (name, on) {
                      return function () {
                        post("/portal/api/admin/channel-toggle", { name: name }, tr("admin.channelToggled") + (on ? tr("common.disable") : tr("common.enable")) + ": " + name);
                      };
                    })(ch.name, ch.enabled),
                  },
                  ch.enabled ? tr("common.disable") : tr("common.enable")
                ),
                h(
                  "button",
                  {
                    style: btnDanger,
                    onClick: (function (name) {
                      return function () {
                        if (!window.confirm(tr("admin.delChannel") + name + "?")) return;
                        post("/portal/api/admin/channel-delete", { name: name }, tr("admin.channelDeleted") + name);
                      };
                    })(ch.name),
                  },
                  tr("common.delete")
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
      var trend = data.trend || [];
      var maxV = 0;
      for (var ti = 0; ti < trend.length; ti++) if (trend[ti].s > maxV) maxV = trend[ti].s;
      var total7 = 0;
      for (var tj = 0; tj < trend.length; tj++) total7 += trend[tj].s;
      var barNodes = [];
      for (var tk = 0; tk < trend.length; tk++) {
        var t = trend[tk];
        barNodes.push(
          h(
            "div",
            { key: "bar" + tk, style: { display: "flex", flexDirection: "column", alignItems: "center", gap: 2 } },
            h("div", {
              style: {
                width: 16,
                height: Math.max(2, Math.round((t.s / (maxV || 1)) * 44)),
                background: "var(--dsw-alias-state-business-primary, #4f7cf7)",
                borderRadius: 3,
              },
            }),
            h("div", { style: { fontSize: 9, color: "var(--dsw-alias-label-tertiary, #65676b)" } }, t.d)
          )
        );
      }
      kids.push(
        h(
          "div",
          { key: "trend" },
          h("div", { style: { fontWeight: 600 } }, tr("admin.teamUsage7d") + fmt(total7)),
          h("div", { style: { display: "flex", gap: 6, alignItems: "flex-end" } }, barNodes)
        )
      );
      kids.push(
        h(
          "div",
          { key: "up" },
          h("div", { style: { fontSize: 15, fontWeight: 700 } }, tr("admin.upstreamTitle")),
          h(
            "div",
            { style: Object.assign({ fontSize: 12, marginTop: 2 }, muted) },
            tr("admin.upstreamDesc")
          ),
          h(
            "div",
            { style: { marginTop: 6 } },
            "🌐 " + (up.upstream || "-") + "　",
            h(
              "span",
              { style: Object.assign({ fontSize: 12 }, muted) },
              up.keySet ? "Key " + up.keyMasked + tr("admin.upstreamSrc") + up.source + ")" : tr("admin.keyMissing")
            )
          ),
          up.writable
            ? h(
                "div",
                { style: { display: "flex", gap: 6, marginTop: 6, flexWrap: "wrap" } },
                h("input", { ref: upKeyRef, type: "password", placeholder: tr("admin.keyPh"), style: field }),
                h(
                  "button",
                  {
                    style: btnDark,
                    onClick: function () {
                      saveUpstream(upKeyRef.current ? upKeyRef.current.value.trim() : "");
                    },
                  },
                  tr("admin.updateKey")
                )
              )
            : h("div", { style: Object.assign({ fontSize: 12, marginTop: 6 }, muted) }, tr("admin.keyEnvLocked")),
          h(
            "div",
            { style: Object.assign({ fontSize: 12, marginTop: 6 }, muted) },
            tr("admin.keyScopeNote")
          )
        )
      );
      kids.push(h("div", { key: "t1", style: { fontSize: 15, fontWeight: 700 } }, tr("admin.membersCount") + data.members.length + ")"));
      kids.push(h("div", { key: "mr", style: {} }, memberRows));
      kids.push(
        h(
          "div",
          { key: "mnf", style: { display: "flex", flexDirection: "column", gap: 6, marginTop: 4 } },
          h("div", { style: { fontWeight: 600 } }, tr("admin.newMember")),
          h("input", { ref: uRef, placeholder: tr("admin.phUsername"), style: field }),
          h("input", { ref: pRef, placeholder: tr("admin.phPassword"), type: "password", style: field }),
          h("input", { ref: bRef, placeholder: tr("admin.phBudget"), style: field }),
          h(
            "button",
            {
              style: btnDark,
              onClick: function () {
                var username = uRef.current ? uRef.current.value.trim() : "";
                var password = pRef.current ? pRef.current.value : "";
                var budget = bRef.current ? bRef.current.value.trim() : "";
                post("/portal/api/admin/member-create", { username: username, password: password, budget: budget }, tr("admin.memberCreated") + username).then(function (d) {
                  if (d && d.key) {
                    setKeyInfo({ username: d.username, key: d.key });
                    if (pRef.current) pRef.current.value = "";
                  }
                });
              },
            },
            tr("admin.createMember")
          )
        )
      );
      if (keyInfo) {
        kids.push(
          h(
            "div",
            { key: "key", style: { border: "1px solid var(--dsw-alias-border-l2, #ccd0d5)", borderRadius: 8, padding: 10, display: "flex", flexDirection: "column", gap: 8 } },
            h("div", null, tr("admin.newKeyShown") + keyInfo.username + "): "),
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
                          setMsg({ kind: "ok", text: tr("admin.copied") });
                        },
                        function () {
                          setMsg({ kind: "err", text: tr("common.copyFail") });
                        }
                      );
                    } else {
                      setMsg({ kind: "err", text: tr("common.copyFail") });
                    }
                  },
                },
                tr("common.copy")
              ),
              h(
                "button",
                {
                  style: btnLight,
                  onClick: function () {
                    setKeyInfo(null);
                  },
                },
                tr("common.keyDone")
              )
            )
          )
        );
      }
      kids.push(h("div", { key: "t2", style: { fontSize: 15, fontWeight: 700, marginTop: 8 } }, tr("admin.channelsCount") + data.channels.length + ")"));
      kids.push(h("div", { key: "cr", style: {} }, chRows.length ? chRows : h("div", { style: muted }, tr("admin.noChannels"))));
      kids.push(
        h(
          "div",
          { key: "cnf", style: { display: "flex", flexDirection: "column", gap: 6, marginTop: 4 } },
          h("div", { style: { fontWeight: 600 } }, tr("admin.addChannel")),
          h("input", { ref: chNameRef, placeholder: tr("admin.phChannelName"), style: field }),
          h("input", { ref: chUrlRef, placeholder: tr("admin.phBaseUrl"), style: field }),
          h("input", { ref: chKeyRef, placeholder: "API Key（sk-...）", type: "password", style: field }),
          h("input", { ref: chModelsRef, placeholder: tr("admin.phModels"), style: field }),
          h("input", { ref: chPricesRef, placeholder: tr("admin.phPrices"), style: field }),
          h("input", { ref: chNoteRef, placeholder: tr("common.phNote"), style: field }),
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
                    setMsg({ kind: "err", text: tr("admin.badPrices") });
                    return;
                  }
                }
                post("/portal/api/admin/channel-create", payload, tr("admin.channelAdded") + name);
              },
            },
            tr("admin.addChannel")
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
          tr("admin.dangerNote")
        )
      );
      return h("div", { style: Object.assign({}, wrap, { maxWidth: 640 }) }, kids);
    }

    function NotifySection() {
      var dataPair = React.useState({ phase: "loading", routes: [], log: [], reminders: [], message: "" });
      var data = dataPair[0];
      var setData = dataPair[1];
      var msgPair = React.useState({ kind: "", text: "" });
      var msg = msgPair[0];
      var setMsg = msgPair[1];
      var testPair = React.useState(null);
      var testRes = testPair[0];
      var setTestRes = testPair[1];
      var kindPair = React.useState("webhook");
      var kind = kindPair[0];
      var setKind = kindPair[1];
      var nRef = React.useRef(null);
      var tRef = React.useRef(null);

      function load() {
        fetch("/portal/api/admin/notify", { headers: { accept: "application/json" } })
          .then(function (r) {
            if (r.status === 403) throw new Error("NOPERM");
            if (r.status === 401) throw new Error("NOLOGIN");
            if (!r.ok) throw new Error("HTTP " + r.status);
            return r.json();
          })
          .then(function (d) {
            setData({ phase: "ready", routes: d.routes || [], log: d.log || [], reminders: (d.reminders && d.reminders.pending) || [], message: "" });
          })
          .catch(function (e) {
            setData({ phase: "error", routes: [], log: [], message: String((e && e.message) || e) });
          });
      }
      React.useEffect(function () {
        load();
      }, []);

      function post(path, body, okText) {
        setMsg({ kind: "info", text: tr("common.processing") });
        return fetch(path + (path.indexOf("?") >= 0 ? "&" : "?") + "lang=" + deskLang(), { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) })
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
            load();
            return res.d;
          })
          .catch(function (e) {
            setMsg({ kind: "err", text: String((e && e.message) || e) });
            return null;
          });
      }

      if (data.phase === "loading") return h("div", { style: wrap }, tr("notify.loading"));
      if (data.phase === "error") {
        if (data.message === "NOPERM")
          return h(
            "div",
            { style: wrap },
            h("div", null, tr("admin.adminOnly")),
            h("div", { style: muted }, tr("notify.adminHint"))
          );
        return h(
          "div",
          { style: wrap },
          h("div", null, tr("notify.loadFailOpen") + data.message + "）。"),
          h("div", { style: muted }, tr("notify.portalHint"))
        );
      }

      var routeRows = [];
      for (var i = 0; i < data.routes.length; i++) {
        var r = data.routes[i];
        routeRows.push(
          h(
            "div",
            { key: "r" + i, style: rowBase },
            h(
              "div",
              { style: { display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 } },
              h(
                "span",
                null,
                r.name + " ",
                h("span", { style: Object.assign({ fontSize: 12 }, muted) }, String(r.kind || "-") + (r.enabled === 1 ? tr("notify.enabledSuffix") : tr("notify.disabledSuffix")))
              ),
              h(
                "span",
                { style: { display: "flex", gap: 6 } },
                h(
                  "button",
                  {
                    style: btnSmall,
                    onClick: (function (name) {
                      return function () {
                        post("/portal/api/admin/notify/route-toggle", { name: name }, tr("notify.toggled") + name);
                      };
                    })(r.name),
                  },
                  r.enabled === 1 ? tr("common.disable") : tr("common.enable")
                ),
                h(
                  "button",
                  {
                    style: btnDanger,
                    onClick: (function (name) {
                      return function () {
                        if (!window.confirm(tr("notify.delChannel") + name + "?")) return;
                        post("/portal/api/admin/notify/route-delete", { name: name }, tr("common.deletedColon") + name);
                      };
                    })(r.name),
                  },
                  tr("common.delete")
                )
              )
            ),
            h("div", { style: Object.assign({ fontSize: 12 }, muted) }, (function () {
              var t = String(r.target || "");
              if (r.kind === "telegram" || r.kind === "whatsapp") {
                var p = t.split("|");
                if (r.kind === "telegram") return "token=***|chat=" + (p[1] || "") + (p[2] ? "|" + p[2] : "");
                if (p[0] === "callmebot") return "callmebot|***|" + (p[2] || "");
                return (p[0] || "") + "|" + (p[1] || "") + "|***|" + (p[3] || "") + (p[4] ? "|" + p[4] : "");
              }
              return t.length > 72 ? t.slice(0, 72) + "…" : t;
            })())
          )
        );
      }

      var logRows = [];
      for (var j = 0; j < Math.min(data.log.length, 8); j++) {
        var g = data.log[j];
        logRows.push(
          h(
            "div",
            { key: "l" + j, style: { display: "flex", gap: 8, fontSize: 12, padding: "3px 0" } },
            h("span", { style: muted }, String(g.ts || "").slice(5, 16)),
            h("span", null, String(g.route_name || "-")),
            h(
              "span",
              { style: g.ok === 1 ? muted : { color: "#c0392b" } },
              (g.ok === 1 ? "✓ " : "✗ ") + String(g.title || g.text || "").slice(0, 24)
            )
          )
        );
      }

      var kids = [];
      kids.push(h("div", { key: "t1", style: { fontSize: 15, fontWeight: 700 } }, tr("notify.channelsCount") + data.routes.length + ")"));
      kids.push(h("div", { key: "rr", style: {} }, routeRows.length ? routeRows : h("div", { style: muted }, tr("notify.empty"))));
      kids.push(
        h(
          "div",
          { key: "nf", style: { display: "flex", flexDirection: "column", gap: 6, marginTop: 4 } },
          h("div", { style: { fontWeight: 600 } }, tr("notify.addChannel")),
          h(
            "select",
            {
              value: kind,
              onChange: function (e) {
                setKind(e.target.value);
              },
              style: field,
            },
            h("option", { value: "webhook" }, tr("notify.kindWebhook")),
            h("option", { value: "hermes" }, tr("notify.kindHermes")),
            h("option", { value: "telegram" }, tr("notify.kindTelegram")),
            h("option", { value: "whatsapp" }, tr("notify.kindWhatsapp"))
          ),
          h("input", { ref: nRef, placeholder: tr("notify.phName"), style: field }),
          h("input", {
            ref: tRef,
            placeholder:
              kind === "webhook"
                ? "https://qyapi.weixin.qq.com/cgi-bin/webhook/send?key=…"
                : kind === "hermes"
                  ? "weixin"
                  : kind === "telegram"
                    ? tr("notify.phTelegram")
                    : tr("notify.phWhatsapp"),
            style: field,
          }),
          kind === "telegram" || kind === "whatsapp"
            ? h(
                "div",
                { style: Object.assign({ fontSize: 12 }, muted) },
                kind === "telegram"
                  ? tr("notify.tgHint")
                  : tr("notify.waHint")
              )
            : null,
          h(
            "button",
            {
              style: btnDark,
              onClick: function () {
                var name = nRef.current ? nRef.current.value.trim() : "";
                var target = tRef.current ? tRef.current.value.trim() : "";
                post("/portal/api/admin/notify/route-add", { name: name, kind: kind, target: target }, tr("notify.added") + name).then(function (d) {
                  if (d && tRef.current) tRef.current.value = "";
                });
              },
            },
            tr("notify.addChannel")
          )
        )
      );
      kids.push(
        h(
          "div",
          { key: "test", style: { display: "flex", alignItems: "center", gap: 8, marginTop: 4 } },
          h(
            "button",
            {
              style: btnLight,
              onClick: function () {
                setTestRes({ phase: "loading" });
                fetch("/portal/api/admin/notify-test?lang=" + deskLang(), { method: "POST", headers: { "content-type": "application/json" }, body: "{}" })
                  .then(function (r) {
                    return r.json();
                  })
                  .then(function (d) {
                    setTestRes({ phase: "ready", results: d.results || [] });
                    load();
                  })
                  .catch(function (e) {
                    setTestRes({ phase: "ready", results: [{ route: "-", ok: false, info: String((e && e.message) || e) }] });
                  });
              },
            },
            tr("notify.testSend")
          ),
          h("span", { style: Object.assign({ fontSize: 12 }, muted) }, tr("notify.testSendHint"))
        )
      );
      if (testRes && testRes.phase === "ready") {
        var trNodes = [];
        for (var k = 0; k < testRes.results.length; k++) {
          var tr = testRes.results[k];
          trNodes.push(
            h(
              "div",
              { key: "tr" + k, style: { fontSize: 12, color: tr.ok ? undefined : "#c0392b" } },
              (tr.ok ? "✓ " : "✗ ") + tr.route + ": " + tr.info
            )
          );
        }
        kids.push(h("div", { key: "trs", style: { display: "flex", flexDirection: "column", gap: 3 } }, trNodes));
      }
      var remRows = [];
      for (var q = 0; q < (data.reminders || []).length; q++) {
        var rem = data.reminders[q];
        remRows.push(
          h(
            "div",
            { key: "rem" + q, style: rowBase },
            h(
              "div",
              { style: { display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 } },
              h(
                "span",
                null,
                fmtTs(rem.at_epoch) + " ",
                h("span", { style: Object.assign({ fontSize: 12 }, muted) }, String(rem.title || rem.text || "").slice(0, 30))
              ),
              h(
                "button",
                {
                  style: btnSmall,
                  onClick: (function (id) {
                    return function () {
                      post("/portal/api/admin/reminders/rm", { id: id }, tr("notify.removed") + id);
                    };
                  })(rem.id),
                },
                tr("common.delete")
              )
            )
          )
        );
      }
      kids.push(h("div", { key: "t3", style: { fontSize: 15, fontWeight: 700, marginTop: 8 } }, tr("notify.remindersCount") + (data.reminders || []).length + ")"));
      kids.push(
        h(
          "div",
          { key: "rems", style: {} },
          remRows.length ? remRows : h("div", { style: muted }, tr("notify.noReminders"))
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
      kids.push(h("div", { key: "t2", style: { fontSize: 15, fontWeight: 700, marginTop: 8 } }, tr("notify.recentSent")));
      kids.push(h("div", { key: "logs", style: {} }, logRows.length ? logRows : h("div", { style: muted }, tr("notify.noSent"))));
      kids.push(
        h(
          "div",
          { key: "tip", style: muted },
          tr("notify.help")
        )
      );
      return h("div", { style: Object.assign({}, wrap, { maxWidth: 640 }) }, kids);
    }

    function OpsSection() {
      var pair = React.useState({ phase: "loading", message: "" });
      var st = pair[0];
      var setSt = pair[1];
      var langTick = useLocaleSignal();

      function fmtBytes(n) {
        var v = Number(n || 0);
        if (v < 1024) return v + " B";
        if (v < 1024 * 1024) return (v / 1024).toFixed(1) + " KB";
        if (v < 1024 * 1024 * 1024) return (v / 1024 / 1024).toFixed(1) + " MB";
        return (v / 1024 / 1024 / 1024).toFixed(2) + " GB";
      }
      function fmtDur(sec) {
        sec = Math.round(Number(sec || 0));
        var d = Math.floor(sec / 86400);
        var h = Math.floor((sec % 86400) / 3600);
        var mm = Math.floor((sec % 3600) / 60);
        if (d > 0) return d + tr("relTime.days") + h + tr("relTime.hours");
        if (h > 0) return h + tr("relTime.hoursMid") + mm + tr("relTime.mins");
        return mm + tr("relTime.minutes");
      }
      function load() {
        setSt({ phase: "loading", message: "" });
        fetch("/portal/api/admin/ops?lang=" + deskLang(), { headers: { accept: "application/json" } })
          .then(function (r) {
            if (r.status === 403) throw new Error("NOPERM");
            if (r.status === 401) throw new Error("NOLOGIN");
            if (!r.ok) throw new Error("HTTP " + r.status);
            return r.json();
          })
          .then(function (d) {
            setSt({ phase: "ready", data: d, message: "" });
          })
          .catch(function (e) {
            setSt({ phase: "error", message: String((e && e.message) || e) });
          });
      }
      React.useEffect(function () {
        load();
      }, [langTick]);

      if (st.phase === "loading") return h("div", { style: wrap }, tr("ops.loading"));
      if (st.phase === "error") {
        if (st.message === "NOPERM")
          return h("div", { style: wrap }, h("div", null, tr("admin.adminOnly")), h("div", { style: muted }, tr("ops.adminHint")));
        return h("div", { style: wrap }, h("div", null, tr("ops.loadFailOpen") + st.message + "）。"), h("div", { style: muted }, tr("ops.portalHint")));
      }

      var d = st.data;
      var kids = [];

      var svcRows = (d.services || []).map(function (s, i) {
        return h(
          "div",
          { key: "s" + i, style: { display: "flex", justifyContent: "space-between", fontSize: 12, padding: "3px 0" } },
          h("span", null, (s.active ? "● " : "○ ") + s.name),
          h("span", { style: muted }, (s.pid ? "pid " + s.pid + " · " : "") + String(s.since || "").slice(4, 20))
        );
      });
      kids.push(h("div", { key: "svc" }, h("div", { style: { fontWeight: 600 } }, tr("ops.services")), svcRows));

      var http = d.http || {};
      var httpNodes = Object.keys(http).map(function (k, i) {
        var v = http[k];
        var ok = v === 200 || v === 302;
        return h("span", { key: "h" + i, style: { marginRight: 12, fontSize: 12, color: ok ? undefined : "#c0392b" } }, k + " → " + v);
      });
      kids.push(h("div", { key: "http" }, h("div", { style: { fontWeight: 600 } }, tr("ops.ports")), h("div", null, httpNodes)));

      var b = d.backup || {};
      kids.push(
        h(
          "div",
          { key: "bk" },
          h("div", { style: { fontWeight: 600 } }, tr("ops.backups") + (b.count || 0) + tr("ops.backupMid") + fmtBytes(b.totalBytes) + ")"),
          h(
            "div",
            { style: muted },
            b.last
              ? tr("ops.backupLast") + b.last.name + " · " + fmtBytes(b.last.size) + " · " + (b.last.mtimeLocal || String(b.last.mtime || "").slice(5, 16).replace("T", " "))
              : tr("ops.noBackups")
          )
        )
      );

      var dk = d.disk || {};
      var dd = d.data || {};
      kids.push(
        h(
          "div",
          { key: "dk" },
          h("div", { style: { fontWeight: 600 } }, tr("ops.disk")),
          h("div", { style: muted }, tr("ops.free") + fmtBytes(dk.free) + tr("ops.ofTotal") + fmtBytes(dk.total) + " · desk.db " + fmtBytes(dd.dbBytes)),
          h("div", { style: muted }, tr("ops.kbSize") + fmtBytes(dd.kbBytes) + tr("ops.driveSize") + fmtBytes(dd.driveBytes))
        )
      );

      var hst = d.host || {};
      var dsk = d.desk || {};
      kids.push(
        h(
          "div",
          { key: "hst" },
          h("div", { style: { fontWeight: 600 } }, tr("ops.host")),
          h(
            "div",
            { style: muted },
            tr("ops.uptime") + fmtDur(hst.uptime) + tr("ops.mem") + fmtBytes(Number(hst.totalmem || 0) - Number(hst.freemem || 0)) + " / " + fmtBytes(hst.totalmem) + " · load " + Number(hst.load1 || 0).toFixed(2)
          ),
          h("div", { style: muted }, tr("ops.procs") + fmtDur(dsk.uptime) + " · node " + (dsk.node || ""))
        )
      );

      kids.push(h("div", { key: "rf" }, h("button", { style: btnLight, onClick: load }, tr("common.refresh"))));
      return h("div", { style: Object.assign({}, wrap, { maxWidth: 640 }) }, kids);
    }

    function AnnounceBoard(props) {
      var wide = !!(props && props.wide);
      var dataPair = React.useState({ phase: "loading", role: "member", announcements: [], feedback: [] });
      var data = dataPair[0];
      var setData = dataPair[1];
      var openPair = React.useState(false);
      var open = openPair[0];
      var setOpen = openPair[1];
      var unreadPair = React.useState(0);
      var unread = unreadPair[0];
      var setUnread = unreadPair[1];
      var msgPair = React.useState({ kind: "", text: "" });
      var msg = msgPair[0];
      var setMsg = msgPair[1];
      var tRef = React.useRef(null);
      var bRef = React.useRef(null);
      var fRef = React.useRef(null);

      function load(markSeenNow) {
        fetch("/portal/api/announcements", { headers: { accept: "application/json" } })
          .then(function (r) {
            if (!r.ok) throw new Error("HTTP " + r.status);
            return r.json();
          })
          .then(function (d) {
            var ann = d.announcements || [];
            setData({ phase: "ready", role: d.role || "member", announcements: ann, feedback: d.feedback || [] });
            var m = 0;
            for (var i = 0; i < ann.length; i++) if (ann[i].id > m) m = ann[i].id;
            if (markSeenNow && m > 0) window.localStorage.setItem("desk-announce-seen", String(m));
            var seen = Number(window.localStorage.getItem("desk-announce-seen") || 0) || 0;
            var n = 0;
            for (var j = 0; j < ann.length; j++) if (ann[j].id > seen) n++;
            setUnread(n);
          })
          .catch(function () {
            setData({ phase: "error", role: "member", announcements: [], feedback: [] });
          });
      }
      React.useEffect(function () {
        load(false);
      }, []);

      function post(path, body, okText) {
        setMsg({ kind: "info", text: tr("common.processing") });
        fetch(path, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) })
          .then(function (r) {
            return r.json().then(function (d) {
              return { status: r.status, d: d };
            });
          })
          .then(function (res) {
            if (res.status !== 200) {
              setMsg({ kind: "err", text: (res.d && res.d.error) || "HTTP " + res.status });
              return;
            }
            setMsg({ kind: "ok", text: okText });
            if (tRef.current) tRef.current.value = "";
            if (bRef.current) bRef.current.value = "";
            if (fRef.current) fRef.current.value = "";
            load(true);
          })
          .catch(function (e) {
            setMsg({ kind: "err", text: String((e && e.message) || e) });
          });
      }

      function toggle() {
        var next = !open;
        setOpen(next);
        if (next) load(true);
      }

      var trigger = h(
        "button",
        { className: "ddb" + (wide ? "" : " rail"), onClick: toggle, title: tr("ann.title") },
        h("span", { className: "ic" }, "📢"),
        wide ? h("span", { className: "lbl" }, tr("ann.tab")) : null,
        wide && unread > 0 ? h("span", { className: "badge" }, unread) : null
      );
      if (!open) return h("div", null, trigger);

      var kids = [];
      if (data.phase === "loading") kids.push(h("div", { key: "ld", className: "empty" }, tr("common.loading")));
      if (data.phase === "error") kids.push(h("div", { key: "er", className: "empty" }, tr("ann.failHint")));
      if (data.phase === "ready") {
        if (data.role === "admin") {
          kids.push(h("div", { key: "nf-lb", className: "lb" }, tr("ann.publish")));
          kids.push(
            h(
              "div",
              { key: "nf", className: "fm" },
              h("input", { ref: tRef, className: "inp", placeholder: tr("ann.phTitle") }),
              h("textarea", { ref: bRef, className: "inp ta", placeholder: tr("ann.phBody") }),
              h(
                "div",
                null,
                h(
                  "button",
                  {
                    className: "btn",
                    onClick: function () {
                      post("/portal/api/announcements/post", { title: tRef.current ? tRef.current.value : "", body: bRef.current ? bRef.current.value : "" }, tr("ann.posted"));
                    },
                  },
                  tr("ann.publish")
                )
              )
            )
          );
        }
        var anns = [];
        for (var i = 0; i < data.announcements.length; i++) {
          var a = data.announcements[i];
          anns.push(
            h(
              "div",
              { key: "a" + a.id, className: "it" },
              h("span", { className: "ico2" }, "📣"),
              h(
                "div",
                { className: "gr" },
                h(
                  "div",
                  { className: "th" },
                  h("span", { className: "t" }, a.title || tr("ann.untitled")),
                  data.role === "admin"
                    ? h(
                        "button",
                        {
                          className: "mini",
                          onClick: (function (id) {
                            return function () {
                              if (window.confirm(tr("ann.delConfirm"))) post("/portal/api/announcements/rm", { id: id }, tr("common.deleted"));
                            };
                          })(a.id),
                        },
                        tr("common.delete")
                      )
                    : null
                ),
                h("div", { className: "d" }, fmtAt(a.created_at) + (a.created_by ? " · " + a.created_by : "")),
                h("div", { className: "bd2" }, a.body)
              )
            )
          );
        }
        kids.push(h("div", { key: "anns", className: "list" }, anns.length ? anns : h("div", { className: "empty" }, tr("ann.empty"))));
        kids.push(h("div", { key: "fdiv", className: "lb" }, tr("ann.feedbackTab") + (data.role === "admin" ? tr("ann.everyone") : "")));
        if (data.role !== "admin") {
          kids.push(
            h(
              "div",
              { key: "ff", className: "fm" },
              h("textarea", { ref: fRef, className: "inp ta", placeholder: tr("ann.phFeedback") }),
              h(
                "div",
                null,
                h(
                  "button",
                  {
                    className: "btn gh",
                    onClick: function () {
                      post("/portal/api/feedback", { text: fRef.current ? fRef.current.value : "" }, tr("ann.feedbackThanks"));
                    },
                  },
                  tr("ann.submitFeedback")
                )
              )
            )
          );
        }
        var fbs = [];
        for (var j = 0; j < data.feedback.length; j++) {
          var fb = data.feedback[j];
          fbs.push(
            h(
              "div",
              { key: "fb" + fb.id, className: "it" },
              h("span", { className: "ico2" }, "💬"),
              h(
                "div",
                { className: "gr" },
                h(
                  "div",
                  { className: "th" },
                  h("span", { className: "d" }, (fb.username || "-") + " · " + fmtAt(fb.created_at)),
                  data.role === "admin"
                    ? h(
                        "button",
                        {
                          className: "mini",
                          onClick: (function (id) {
                            return function () {
                              post("/portal/api/feedback/rm", { id: id }, tr("common.deleted"));
                            };
                          })(fb.id),
                        },
                        tr("common.delete")
                      )
                    : null
                ),
                h("div", { className: "bd2" }, fb.text)
              )
            )
          );
        }
        kids.push(h("div", { key: "fbs", className: "list" }, fbs.length ? fbs : h("div", { className: "empty" }, data.role === "admin" ? tr("common.noFeedback") : tr("common.noFeedbackMine"))));
      }
      if (msg.kind) {
        kids.push(h("div", { key: "msg", className: "msg" + (msg.kind === "err" ? " err" : msg.kind === "ok" ? " ok" : "") }, msg.text));
      }
      return h(
        "div",
        null,
        trigger,
        h(
          "div",
          { key: "panel", className: "ddp" },
          h(
            "div",
            { className: "hd" },
            h("span", { className: "ico" }, "📢"),
            h("div", null, h("div", { className: "t1" }, tr("ann.titleShort")), h("div", { className: "t2" }, tr("ann.footerLabel"))),
            h("button", { className: "x", onClick: toggle }, "✕")
          ),
          h("div", { className: "bd" }, kids)
        )
      );
    }

    function AssistantsPanel(props) {
      var wide = !!(props && props.wide);
      var aPair = React.useState({ phase: "loading", presets: [] });
      var st = aPair[0];
      var setSt = aPair[1];
      var oPair = React.useState(false);
      var open = oPair[0];
      var setOpen = oPair[1];

      function load() {
        fetch("/portal/api/panel/presets", { headers: { accept: "application/json" } })
          .then(function (r) {
            if (!r.ok) throw new Error("HTTP " + r.status);
            return r.json();
          })
          .then(function (d) {
            setSt({ phase: "ready", presets: (d && d.presets) || [] });
          })
          .catch(function () {
            setSt({ phase: "error", presets: [] });
          });
      }
      React.useEffect(function () {
        load();
      }, []);

      function toggle() {
        var next = !open;
        setOpen(next);
        if (next) load();
      }

      var trigger = h(
        "button",
        { className: "ddb" + (wide ? "" : " rail"), onClick: toggle, title: tr("asst.title") },
        h("span", { className: "ic" }, "🧑‍💼"),
        wide ? h("span", { className: "lbl" }, tr("asst.tab")) : null
      );
      if (!open) return h("div", null, trigger);

      var kids = [];
      if (st.phase === "loading") kids.push(h("div", { key: "ld", className: "empty" }, tr("common.loading")));
      if (st.phase === "error") kids.push(h("div", { key: "er", className: "empty" }, tr("asst.failHint")));
      if (st.phase === "ready") {
        if (!st.presets.length) {
          kids.push(h("div", { key: "none", className: "empty" }, tr("asst.empty")));
        } else {
          var rows = [];
          st.presets.forEach(function (p) {
            rows.push(
              h(
                "div",
                { key: "p" + p.id, className: "it" },
                h("span", { className: "ico2" }, "🤖"),
                h(
                  "div",
                  { className: "gr" },
                  h("div", { className: "th" }, h("span", { className: "t" }, p.name), p.codex ? h("span", { className: "bdg" }, tr("asst.codex")) : null),
                  h("div", { className: "d" }, p.description || p.id)
                )
              )
            );
          });
          kids.push(h("div", { key: "lb", className: "lb" }, tr("asst.available")));
          kids.push(h("div", { key: "rows", className: "list" }, rows));
        }
        kids.push(h("div", { key: "tip", className: "ft" }, tr("asst.note")));
      }
      return h(
        "div",
        null,
        trigger,
        h(
          "div",
          { key: "panel", className: "ddp" },
          h(
            "div",
            { className: "hd" },
            h("span", { className: "ico" }, "🧑‍💼"),
            h("div", null, h("div", { className: "t1" }, tr("asst.team")), h("div", { className: "t2" }, tr("asst.panelTitle"))),
            h("button", { className: "x", onClick: toggle }, "✕")
          ),
          h("div", { className: "bd" }, kids)
        )
      );
    }

    function SkillsConnPanel(props) {
      var wide = !!(props && props.wide);
      var sPair = React.useState({ phase: "loading", skills: [], items: [] });
      var st = sPair[0];
      var setSt = sPair[1];
      var tPair = React.useState("skills");
      var tab = tPair[0];
      var setTab = tPair[1];
      var oPair = React.useState(false);
      var open = oPair[0];
      var setOpen = oPair[1];
      var dPair = React.useState({ phase: "none", id: "", name: "", content: "" });
      var langTick = useLocaleSignal();
      var det = dPair[0];
      var setDet = dPair[1];

      function load() {
        Promise.all([
          fetch("/portal/api/panel/skills", { headers: { accept: "application/json" } }).then(function (r) {
            if (!r.ok) throw new Error("HTTP " + r.status);
            return r.json();
          }),
          fetch("/portal/api/panel/connectors?lang=" + deskLang(), { headers: { accept: "application/json" } }).then(function (r) {
            if (!r.ok) throw new Error("HTTP " + r.status);
            return r.json();
          }),
        ])
          .then(function (rs) {
            setSt({ phase: "ready", skills: (rs[0] && rs[0].skills) || [], items: (rs[1] && rs[1].items) || [] });
          })
          .catch(function () {
            setSt({ phase: "error", skills: [], items: [] });
          });
      }
      React.useEffect(function () {
        load();
      }, [langTick]);

      function toggle() {
        var next = !open;
        setOpen(next);
        if (!next) setDet({ phase: "none", id: "", name: "", content: "" });
      }

      function viewSkill(sh) {
        setDet({ phase: "loading", id: sh.id, name: sh.name, content: "" });
        fetch("/portal/api/panel/skill?name=" + encodeURIComponent(sh.id) + "&lang=" + deskLang(), { headers: { accept: "application/json" } })
          .then(function (r) {
            return r.json();
          })
          .then(function (d) {
            if (d && d.error) setDet({ phase: "error", id: sh.id, name: sh.name, content: d.error });
            else setDet({ phase: "ready", id: sh.id, name: sh.name, content: (d && d.content) || "" });
          })
          .catch(function () {
            setDet({ phase: "error", id: sh.id, name: sh.name, content: tr("common.loadFailed") });
          });
      }

      var trigger = h(
        "button",
        { className: "ddb" + (wide ? "" : " rail"), onClick: toggle, title: tr("skl.title") },
        h("span", { className: "ic" }, "🧩"),
        wide ? h("span", { className: "lbl" }, tr("skl.tab")) : null
      );
      if (!open) return h("div", null, trigger);

      var kids = [];
      kids.push(
        h(
          "div",
          { key: "tabs", className: "tabs" },
          h(
            "button",
            {
              className: "tb" + (tab === "skills" ? " on" : ""),
              onClick: function () {
                setTab("skills");
                setDet({ phase: "none", id: "", name: "", content: "" });
              },
            },
            tr("skl.skills") + (st.phase === "ready" ? "(" + st.skills.length + ")" : "")
          ),
          h(
            "button",
            {
              className: "tb" + (tab === "conn" ? " on" : ""),
              onClick: function () {
                setTab("conn");
                setDet({ phase: "none", id: "", name: "", content: "" });
              },
            },
            tr("skl.connectors") + (st.phase === "ready" ? "(" + st.items.length + ")" : "")
          )
        )
      );
      if (st.phase === "loading") kids.push(h("div", { key: "ld", className: "empty" }, tr("common.loading")));
      else if (st.phase === "error") kids.push(h("div", { key: "er", className: "empty" }, tr("common.failHint")));
      else if (tab === "skills") {
        if (det.phase !== "none") {
          kids.push(
            h(
              "div",
              { key: "det-hd", className: "row", style: { marginBottom: 2 } },
              h(
                "button",
                {
                  className: "mini",
                  onClick: function () {
                    setDet({ phase: "none", id: "", name: "", content: "" });
                  },
                },
                tr("common.back")
              ),
              h("span", { className: "t" }, det.name || det.id)
            )
          );
          if (det.phase === "loading") kids.push(h("div", { key: "dl", className: "empty" }, tr("common.loading")));
          else kids.push(h("pre", { key: "dc", className: "code" }, det.content));
        } else if (!st.skills.length) {
          kids.push(h("div", { key: "none", className: "empty" }, tr("skl.empty")));
        } else {
          var rows = [];
          st.skills.forEach(function (sh) {
            rows.push(
              h(
                "div",
                { key: "s" + sh.id, className: "it hv", onClick: function () { viewSkill(sh); } },
                h("span", { className: "ico2" }, "📘"),
                h(
                  "div",
                  { className: "gr" },
                  h("div", { className: "th" }, h("span", { className: "t" }, sh.name), h("span", { className: "tag" }, sh.id)),
                  h("div", { className: "d" }, sh.description || ""),
                  sh.whenToUse ? h("div", { className: "d" }, tr("skl.trigger") + sh.whenToUse) : null
                )
              )
            );
          });
          kids.push(h("div", { key: "rows", className: "list" }, rows));
          kids.push(h("div", { key: "tip", className: "ft" }, tr("skl.hint")));
        }
      } else {
        var crows = [];
        st.items.forEach(function (it) {
          var dotCls = it.ok === true ? "dot ok" : it.ok === false ? "dot bad" : "dot off";
          crows.push(
            h(
              "div",
              { key: "c" + it.name, className: "it" },
              h("span", { className: dotCls }),
              h("div", { className: "gr" }, h("div", { className: "t" }, it.name), h("div", { className: "d" }, it.detail || ""))
            )
          );
        });
        kids.push(h("div", { key: "crows", className: "list" }, crows.length ? crows : h("div", { className: "empty" }, tr("skl.noConn"))));
        kids.push(h("div", { key: "ctip", className: "ft" }, tr("skl.legend")));
      }
      return h(
        "div",
        null,
        trigger,
        h(
          "div",
          { key: "panel", className: "ddp" },
          h(
            "div",
            { className: "hd" },
            h("span", { className: "ico" }, "🧩"),
            h("div", null, h("div", { className: "t1" }, tr("skl.titleShort")), h("div", { className: "t2" }, tr("skl.panelTitle"))),
            h("button", { className: "x", onClick: toggle }, "✕")
          ),
          h("div", { className: "bd" }, kids)
        )
      );
    }

    function AutomationPanel(props) {
      var wide = !!(props && props.wide);
      var aPair = React.useState({ phase: "loading", role: "member", reminders: [], recent: [] });
      var st = aPair[0];
      var setSt = aPair[1];
      var oPair = React.useState(false);
      var open = oPair[0];
      var setOpen = oPair[1];
      var mPair = React.useState({ kind: "", text: "" });
      var msg = mPair[0];
      var setMsg = mPair[1];
      var wRef = React.useRef(null);
      var tRef = React.useRef(null);

      function load() {
        fetch("/portal/api/panel/auto", { headers: { accept: "application/json" } })
          .then(function (r) {
            if (!r.ok) throw new Error("HTTP " + r.status);
            return r.json();
          })
          .then(function (d) {
            setSt({ phase: "ready", role: (d && d.role) || "member", reminders: (d && d.reminders) || [], recent: (d && d.recent) || [] });
          })
          .catch(function () {
            setSt({ phase: "error", role: "member", reminders: [], recent: [] });
          });
      }
      React.useEffect(function () {
        load();
      }, []);

      function toggle() {
        var next = !open;
        setOpen(next);
        if (next) load();
      }

      function fmtEp(sec) {
        var d = new Date(Number(sec) * 1000);
        if (isNaN(d.getTime())) return "";
        function p2(x) {
          return (x < 10 ? "0" : "") + x;
        }
        return p2(d.getMonth() + 1) + "-" + p2(d.getDate()) + " " + p2(d.getHours()) + ":" + p2(d.getMinutes());
      }

      function parseWhen(s) {
        s = String(s || "").trim();
        var now = new Date();
        var m;
        if ((m = /^\+(\d{1,4})\s*m(in)?$/i.exec(s))) return Math.floor(Date.now() / 1000) + Number(m[1]) * 60;
        if ((m = /^\+(\d{1,3})\s*h(our|r)?$/i.exec(s))) return Math.floor(Date.now() / 1000) + Number(m[1]) * 3600;
        if ((m = /^明天\s*(\d{1,2}):(\d{2})$/.exec(s))) {
          var t1 = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, Number(m[1]), Number(m[2]), 0, 0);
          return Math.floor(t1.getTime() / 1000);
        }
        if ((m = /^(\d{1,2}):(\d{2})$/.exec(s))) {
          var t2 = new Date(now.getFullYear(), now.getMonth(), now.getDate(), Number(m[1]), Number(m[2]), 0, 0);
          if (t2.getTime() <= Date.now()) t2 = new Date(t2.getTime() + 86400000);
          return Math.floor(t2.getTime() / 1000);
        }
        if ((m = /^(\d{1,2})-(\d{1,2})\s+(\d{1,2}):(\d{2})$/.exec(s))) {
          var t3 = new Date(now.getFullYear(), Number(m[1]) - 1, Number(m[2]), Number(m[3]), Number(m[4]), 0, 0);
          if (isNaN(t3.getTime())) return 0;
          if (t3.getTime() <= Date.now()) t3 = new Date(now.getFullYear() + 1, Number(m[1]) - 1, Number(m[2]), Number(m[3]), Number(m[4]), 0, 0);
          return Math.floor(t3.getTime() / 1000);
        }
        return 0;
      }

      function post(path, body, okText) {
        setMsg({ kind: "info", text: tr("common.processing") });
        fetch(path, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) })
          .then(function (r) {
            return r.json().then(function (d) {
              return { status: r.status, d: d };
            });
          })
          .then(function (res) {
            if (res.status !== 200) {
              setMsg({ kind: "err", text: (res.d && res.d.error) || "HTTP " + res.status });
              return;
            }
            setMsg({ kind: "ok", text: okText });
            if (wRef.current) wRef.current.value = "";
            if (tRef.current) tRef.current.value = "";
            load();
          })
          .catch(function (e) {
            setMsg({ kind: "err", text: String((e && e.message) || e) });
          });
      }

      function add() {
        var text = tRef.current ? tRef.current.value : "";
        if (!String(text).trim()) {
          setMsg({ kind: "err", text: tr("common.required") });
          return;
        }
        var at = parseWhen(wRef.current ? wRef.current.value : "");
        if (!at) {
          setMsg({ kind: "err", text: tr("auto.phTime") });
          return;
        }
        post("/portal/api/admin/reminders/add", { at_epoch: at, text: text }, tr("auto.added"));
      }

      var trigger = h(
        "button",
        { className: "ddb" + (wide ? "" : " rail"), onClick: toggle, title: tr("auto.title") },
        h("span", { className: "ic" }, "⚡"),
        wide ? h("span", { className: "lbl" }, tr("auto.tab")) : null
      );
      if (!open) return h("div", null, trigger);

      var kids = [];
      if (st.phase === "loading") kids.push(h("div", { key: "ld", className: "empty" }, tr("common.loading")));
      if (st.phase === "error") kids.push(h("div", { key: "er", className: "empty" }, tr("common.failHint")));
      if (st.phase === "ready") {
        kids.push(h("div", { key: "sub", className: "lb" }, tr("auto.pending") + st.reminders.length + ")"));
        if (!st.reminders.length) kids.push(h("div", { key: "nr", className: "empty" }, tr("auto.emptyPending")));
        var rows = [];
        st.reminders.forEach(function (r) {
          rows.push(
            h(
              "div",
              { key: "r" + r.id, className: "it" },
              h("span", { className: "ico2" }, "⏰"),
              h(
                "div",
                { className: "gr" },
                h(
                  "div",
                  { className: "th" },
                  h("span", { className: "t" }, r.text),
                  st.role === "admin"
                    ? h(
                        "button",
                        {
                          className: "mini",
                          onClick: function () {
                            post("/portal/api/admin/reminders/rm", { id: r.id }, tr("common.deleted"));
                          },
                        },
                        tr("common.delete")
                      )
                    : null
                ),
                h("div", { className: "d" }, "⏰ " + fmtEp(r.at_epoch) + (r.title ? " · " + r.title : ""))
              )
            )
          );
        });
        if (rows.length) kids.push(h("div", { key: "rows", className: "list" }, rows));
        if (st.role === "admin") {
          kids.push(
            h(
              "div",
              { key: "add", className: "row" },
              h("input", { ref: wRef, className: "inp", style: { width: 160, flex: "0 0 auto" }, placeholder: tr("auto.phTime2"), onKeyDown: function (e) { if (e.key === "Enter") add(); } }),
              h("input", { ref: tRef, className: "inp", style: { flex: "1 1 120px", width: "auto" }, placeholder: tr("auto.phText"), onKeyDown: function (e) { if (e.key === "Enter") add(); } }),
              h("button", { className: "btn", onClick: add }, tr("common.add"))
            )
          );
          kids.push(h("div", { key: "tip", className: "ft" }, tr("auto.hintAdmin")));
        } else {
          kids.push(h("div", { key: "tip", className: "ft" }, tr("auto.hintMember")));
        }
        if (st.recent && st.recent.length) {
          kids.push(h("div", { key: "rh", className: "lb" }, tr("auto.recent")));
          st.recent.forEach(function (r) {
            kids.push(h("div", { key: "rs" + r.id, className: "sub" }, "· " + r.text + "(" + fmtEp(r.at_epoch) + ")"));
          });
        }
      }
      if (msg.kind) {
        kids.push(h("div", { key: "msg", className: "msg" + (msg.kind === "err" ? " err" : msg.kind === "ok" ? " ok" : "") }, msg.text));
      }
      return h(
        "div",
        null,
        trigger,
        h(
          "div",
          { key: "panel", className: "ddp" },
          h(
            "div",
            { className: "hd" },
            h("span", { className: "ico" }, "⚡"),
            h("div", null, h("div", { className: "t1" }, tr("auto.tab")), h("div", { className: "t2" }, tr("auto.panelTitle"))),
            h("button", { className: "x", onClick: toggle }, "✕")
          ),
          h("div", { className: "bd" }, kids)
        )
      );
    }

    function SessionsMgrSection() {
      var ownPair = React.useState({ phase: "loading", items: [] });
      var own = ownPair[0];
      var setOwn = ownPair[1];
      var minePair = React.useState({ phase: "loading", requests: [] });
      var mine = minePair[0];
      var setMine = minePair[1];
      var admPair = React.useState({ phase: "idle", me: "", pending: [], recent: [], members: [] });
      var adm = admPair[0];
      var setAdm = admPair[1];
      var selPair = React.useState({ user: "", phase: "idle", sessions: [], note: "" });
      var sel = selPair[0];
      var setSel = selPair[1];
      var msgPair = React.useState({ kind: "", text: "" });
      var msg = msgPair[0];
      var setMsg = msgPair[1];

      function p2(x) {
        return (x < 10 ? "0" : "") + x;
      }

      function sessLabel(s) {
        var base = String((s && s.cwd) || "").split("/").filter(Boolean).pop() || tr("sess.tab");
        var d = new Date(Number(s && s.updatedAt) || 0);
        var when = isNaN(d.getTime()) ? "" : p2(d.getMonth() + 1) + "-" + p2(d.getDate()) + " " + p2(d.getHours()) + ":" + p2(d.getMinutes());
        return base + " · " + String((s && s.sessionId) || "").slice(8, 16) + " · " + when + (s && s.blank ? tr("sess.notStarted") : "");
      }

      function listItemsOf(d) {
        var items = d && d.result && d.result.value && d.result.value.items;
        return Array.isArray(items) ? items : null;
      }

      function loadOwn() {
        // dsh 0.1.5+：两段式端点 + {args} 载荷；失败自动回退旧协议（session.list + 空载荷）
        fetch("/api/session/list", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            type: "client-request",
            rpcId: "panel-" + Date.now(),
            method: "session/list",
            payload: { args: { _request: {} } },
          }),
        })
          .then(function (r) { return r.json().catch(function () { return null; }); })
          .then(function (d) {
            var items = listItemsOf(d);
            if (items) {
              setOwn({ phase: "ready", items: items });
              return null;
            }
            return fetch("/api/session.list", {
              method: "POST",
              headers: { "content-type": "application/json" },
              body: JSON.stringify({ type: "client-request", rpcId: "panel-" + Date.now(), method: "session.list", payload: {} }),
            })
              .then(function (r2) { return r2.json(); })
              .then(function (d2) { setOwn({ phase: "ready", items: listItemsOf(d2) || [] }); });
          })
          .catch(function () { setOwn({ phase: "error", items: [] }); });
      }

      function loadMine() {
        fetch("/portal/api/session-mgr/mine", { headers: { accept: "application/json" } })
          .then(function (r) { return r.json(); })
          .then(function (d) { setMine({ phase: "ready", requests: (d && d.requests) || [] }); })
          .catch(function () { setMine({ phase: "error", requests: [] }); });
      }

      function loadAdmin() {
        fetch("/portal/api/admin/session-mgr", { headers: { accept: "application/json" } })
          .then(function (r) {
            if (r.status === 403) return null;
            if (!r.ok) throw new Error("HTTP " + r.status);
            return r.json();
          })
          .then(function (d) {
            if (!d) { setAdm({ phase: "member", me: "", pending: [], recent: [], members: [] }); return; }
            setAdm({ phase: "ready", me: d.me || "", pending: d.pending || [], recent: d.recent || [], members: d.members || [] });
          })
          .catch(function () { setAdm({ phase: "member", me: "", pending: [], recent: [], members: [] }); });
      }

      function loadMember(u) {
        setSel({ user: u, phase: "loading", sessions: [], note: "" });
        fetch("/portal/api/admin/session-mgr/list?user=" + encodeURIComponent(u), { headers: { accept: "application/json" } })
          .then(function (r) { return r.json(); })
          .then(function (d) {
            if (d && d.error) { setSel({ user: u, phase: "error", sessions: [], note: d.error }); return; }
            setSel({ user: u, phase: "ready", sessions: (d && d.sessions) || [], note: "" });
          })
          .catch(function (e) { setSel({ user: u, phase: "error", sessions: [], note: String((e && e.message) || e) }); });
      }

      React.useEffect(function () {
        loadOwn();
        loadMine();
        loadAdmin();
      }, []);

      function post(path, body, okText, after) {
        setMsg({ kind: "info", text: tr("common.processing") });
        fetch(path, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) })
          .then(function (r) { return r.json().then(function (d) { return { status: r.status, d: d }; }); })
          .then(function (res) {
            if (res.status !== 200 || (res.d && res.d.error)) {
              setMsg({ kind: "err", text: (res.d && res.d.error) || "HTTP " + res.status });
              return;
            }
            setMsg({ kind: "ok", text: okText });
            if (after) after();
          })
          .catch(function (e) { setMsg({ kind: "err", text: String((e && e.message) || e) }); });
      }

      function pendingFor(sessionId) {
        for (var i = 0; i < mine.requests.length; i++) {
          if (mine.requests[i].session_id === sessionId && mine.requests[i].status === "pending") return mine.requests[i];
        }
        return null;
      }

      function statusChip(st) {
        if (st === "pending") return tr("sess.pending");
        if (st === "approved") return tr("sess.approved");
        if (st === "rejected") return tr("sess.rejected");
        if (st === "cancelled") return tr("sess.cancelled");
        return String(st);
      }

      var kids = [];
      kids.push(h("div", { key: "t", style: { fontSize: 15, fontWeight: 700 } }, tr("sec.sessions")));
      kids.push(
        h(
          "div",
          { key: "sub", style: Object.assign({ fontSize: 12 }, muted) },
          tr("sess.intro")
        )
      );

      kids.push(h("div", { key: "own-t", style: { fontSize: 15, fontWeight: 700, marginTop: 10 } }, tr("sess.mine") + own.items.length + ")"));
      if (own.phase === "loading") kids.push(h("div", { key: "own-ld", style: muted }, tr("common.loading")));
      else if (own.phase === "error") kids.push(h("div", { key: "own-er", style: muted }, tr("sess.loadHint")));
      else if (!own.items.length) kids.push(h("div", { key: "own-none", style: muted }, tr("sess.empty")));
      else {
        var orows = [];
        own.items.forEach(function (s) {
          var pend = pendingFor(s.sessionId);
          var ops = [];
          if (adm.phase === "ready") {
            ops.push(
              h(
                "button",
                {
                  key: "del",
                  style: btnDanger,
                  onClick: function () {
                    if (!window.confirm(tr("sess.delDirect"))) return;
                    post("/portal/api/admin/session-mgr/delete", { user: adm.me, session_id: s.sessionId }, tr("sess.deletedRestarting"), function () {
                      setTimeout(loadOwn, 11000);
                    });
                  },
                },
                tr("common.delete")
              )
            );
            if (pend) {
              ops.push(
                h(
                  "button",
                  {
                    key: "cancel",
                    style: btnLight,
                    onClick: function () {
                      post("/portal/api/session-mgr/cancel", { id: pend.id }, tr("sess.requestCancelled"), loadMine);
                    },
                  },
                  tr("common.withdraw")
                )
              );
            }
          } else if (pend) {
            ops.push(h("span", { key: "pend", style: Object.assign({ fontSize: 12 }, muted) }, tr("sess.waitingAdmin")));
            ops.push(
              h(
                "button",
                {
                  key: "cancel",
                  style: btnLight,
                  onClick: function () {
                    post("/portal/api/session-mgr/cancel", { id: pend.id }, tr("sess.requestCancelled"), loadMine);
                  },
                },
                tr("common.withdraw")
              )
            );
          } else {
            ops.push(
              h(
                "button",
                {
                  key: "req",
                  style: btnSmall,
                  onClick: function () {
                    post("/portal/api/session-mgr/request", { session_id: s.sessionId, title: sessLabel(s) }, tr("sess.requested"), loadMine);
                  },
                },
                tr("sess.requestDelete")
              )
            );
          }
          orows.push(
            h(
              "div",
              { key: s.sessionId, style: rowBase },
              h(
                "div",
                { style: { display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 } },
                h(
                  "span",
                  null,
                  sessLabel(s),
                  s.running ? h("span", { style: Object.assign({ fontSize: 12 }, muted) }, tr("sess.running")) : null,
                  s.parentSessionId ? h("span", { style: Object.assign({ fontSize: 12 }, muted) }, tr("sess.child")) : null
                ),
                h("span", { style: { display: "flex", gap: 6, alignItems: "center" } }, ops)
              ),
              h("div", { style: Object.assign({ fontSize: 12 }, muted) }, (s.cwd || "-") + (s.agentPreset ? tr("sess.preset") + s.agentPreset : ""))
            )
          );
        });
        kids.push(h("div", { key: "own-rows", style: {} }, orows));
      }

      kids.push(h("div", { key: "mine-t", style: { fontSize: 15, fontWeight: 700, marginTop: 10 } }, tr("sess.myRequests")));
      var qrows = [];
      mine.requests.forEach(function (q) {
        qrows.push(
          h(
            "div",
            { key: "q" + q.id, style: rowBase },
            h(
              "div",
              { style: { display: "flex", justifyContent: "space-between", gap: 8 } },
              h("span", null, (q.title || q.session_id) + " "),
              h("span", { style: Object.assign({ fontSize: 12 }, muted) }, statusChip(q.status) + (q.decided_by ? "(" + q.decided_by + ")" : ""))
            ),
            h("div", { style: Object.assign({ fontSize: 12 }, muted) }, String(q.session_id).slice(0, 26) + tr("sess.requestedAt") + String(q.created_at || "").slice(5, 16))
          )
        );
      });
      kids.push(h("div", { key: "mine-rows", style: {} }, qrows.length ? qrows : h("div", { style: muted }, tr("sess.noRequests"))));

      if (adm.phase === "ready") {
        kids.push(h("div", { key: "adm-t", style: { fontSize: 15, fontWeight: 700, marginTop: 10 } }, tr("sess.pendingCount") + adm.pending.length + ")"));
        var prows = [];
        adm.pending.forEach(function (q) {
          prows.push(
            h(
              "div",
              { key: "p" + q.id, style: rowBase },
              h(
                "div",
                { style: { display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 } },
                h("span", null, q.username + "：「" + (q.title || q.session_id) + "」"),
                h(
                  "span",
                  { style: { display: "flex", gap: 6 } },
                  h(
                    "button",
                    {
                      style: btnDark,
                      onClick: function () {
                        if (!window.confirm(tr("sess.approveDelete") + q.username + tr("sess.approveDeleteQ"))) return;
                        post("/portal/api/admin/session-mgr/decide", { id: q.id, action: "approve" }, tr("sess.approvedDone"), function () {
                          loadMine();
                          loadAdmin();
                        });
                      },
                    },
                    tr("sess.approveBtn")
                  ),
                  h(
                    "button",
                    {
                      style: btnLight,
                      onClick: function () {
                        post("/portal/api/admin/session-mgr/decide", { id: q.id, action: "reject" }, tr("sess.rejectedToast"), function () {
                          loadAdmin();
                        });
                      },
                    },
                    tr("sess.rejectBtn")
                  )
                )
              ),
              h("div", { style: Object.assign({ fontSize: 12 }, muted) }, String(q.session_id).slice(0, 26) + " · " + String(q.created_at || "").slice(5, 16))
            )
          );
        });
        kids.push(h("div", { key: "adm-pending", style: {} }, prows.length ? prows : h("div", { style: muted }, tr("sess.noPending"))));

        kids.push(h("div", { key: "m-t", style: { fontSize: 15, fontWeight: 700, marginTop: 10 } }, tr("sess.memberSessions")));
        kids.push(
          h(
            "div",
            { key: "m-bar", style: { display: "flex", gap: 6, marginTop: 4, flexWrap: "wrap" } },
            h(
              "select",
              {
                value: sel.user,
                onChange: function (e) {
                  setSel({ user: e.target.value, phase: "idle", sessions: [], note: "" });
                },
                style: field,
              },
              h("option", { value: "" }, tr("sess.pickMember")),
              adm.members.map(function (m) {
                return h("option", { key: m.username, value: m.username }, m.username + (m.agent_port ? "" : tr("sess.noInstance")));
              })
            ),
            h(
              "button",
              {
                style: btnLight,
                onClick: function () {
                  if (!sel.user) {
                    setMsg({ kind: "err", text: tr("sess.pickFirst") });
                    return;
                  }
                  loadMember(sel.user);
                },
              },
              tr("sess.loadBtn")
            )
          )
        );
        if (sel.phase === "loading") kids.push(h("div", { key: "m-ld", style: muted }, tr("common.loading")));
        else if (sel.phase === "error") kids.push(h("div", { key: "m-er", style: muted }, sel.note || tr("common.loadFailed")));
        else if (sel.phase === "ready") {
          var mrows = [];
          sel.sessions.forEach(function (s) {
            mrows.push(
              h(
                "div",
                { key: "ms" + s.sessionId, style: rowBase },
                h(
                  "div",
                  { style: { display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 } },
                  h("span", null, sessLabel(s), s.running ? h("span", { style: Object.assign({ fontSize: 12 }, muted) }, " · ●") : null),
                  h(
                    "button",
                    {
                      style: btnDanger,
                      onClick: function () {
                        if (!window.confirm(tr("sess.delOther") + sel.user + tr("sess.delOtherQ"))) return;
                        post("/portal/api/admin/session-mgr/delete", { user: sel.user, session_id: s.sessionId }, tr("sess.deletedRestarting"), function () {
                          setTimeout(function () {
                            loadMember(sel.user);
                          }, 11000);
                        });
                      },
                    },
                    tr("sess.delDirectBtn")
                  )
                ),
                h("div", { style: Object.assign({ fontSize: 12 }, muted) }, (s.cwd || "-") + " · " + String(s.sessionId).slice(8, 26))
              )
            );
          });
          kids.push(h("div", { key: "m-rows", style: {} }, mrows.length ? mrows : h("div", { style: muted }, tr("sess.memberNone"))));
        }

        if (adm.recent.length) {
          kids.push(h("div", { key: "r-t", style: { fontSize: 15, fontWeight: 700, marginTop: 10 } }, tr("sess.recent")));
          adm.recent.forEach(function (q) {
            kids.push(
              h(
                "div",
                { key: "r" + q.id, style: { fontSize: 12, color: "var(--dsw-alias-label-tertiary, #8a8f98)", padding: "3px 0" } },
                q.username + " · " + (q.title || q.session_id) + " → " + statusChip(q.status) + (q.decided_by ? "(" + q.decided_by + ")" : "") + " · " + String(q.decided_at || q.created_at || "").slice(5, 16)
              )
            );
          });
        }
      }

      if (msg.kind) {
        kids.push(h("div", { key: "msg", style: msg.kind === "err" ? { color: "#c0392b", fontSize: 12, marginTop: 8 } : Object.assign({ fontSize: 12, marginTop: 8 }, muted) }, msg.text));
      }
      return h("div", { style: Object.assign({}, wrap, { maxWidth: 640 }) }, kids);
    }

    function TaskBoard() {
      var pair = React.useState({ phase: "loading", role: "member", me: "", members: [], tasks: [] });
      var st = pair[0];
      var setSt = pair[1];
      var fPair = React.useState("all");
      var filter = fPair[0];
      var setFilter = fPair[1];
      var msgPair = React.useState({ kind: "", text: "" });
      var msg = msgPair[0];
      var setMsg = msgPair[1];
      var tRef = React.useRef(null);
      var nRef = React.useRef(null);
      var aRef = React.useRef(null);
      var subPair = React.useState(0);
      var submitFor = subPair[0];
      var setSubmitFor = subPair[1];
      var sessPair = React.useState({ phase: "idle", items: [] });
      var sess = sessPair[0];
      var setSess = sessPair[1];
      var cRef = React.useRef(null);
      var snRef = React.useRef(null);
      var sesRef = React.useRef(null);

      function load() {
        fetch("/portal/api/tasks", { headers: { accept: "application/json" } })
          .then(function (r) {
            if (!r.ok) throw new Error("HTTP " + r.status);
            return r.json();
          })
          .then(function (d) {
            setSt({ phase: "ready", role: d.role, me: d.me, members: d.members || [], tasks: d.tasks || [] });
          })
          .catch(function () {
            setSt({ phase: "error", role: "member", me: "", members: [], tasks: [] });
          });
      }
      React.useEffect(function () {
        load();
      }, []);

      function post(path, body, okText, clear) {
        setMsg({ kind: "info", text: tr("common.processing") });
        fetch(path, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) })
          .then(function (r) {
            return r.json().then(function (d) {
              return { status: r.status, d: d };
            });
          })
          .then(function (res) {
            if (res.status !== 200) {
              setMsg({ kind: "err", text: (res.d && res.d.error) || "HTTP " + res.status });
              return;
            }
            setMsg({ kind: "ok", text: okText });
            if (clear) {
              if (tRef.current) tRef.current.value = "";
              if (nRef.current) nRef.current.value = "";
              if (aRef.current) aRef.current.value = "";
            }
            load();
          })
          .catch(function (e) {
            setMsg({ kind: "err", text: String((e && e.message) || e) });
          });
      }

      function sessLabel(s) {
        var base = String((s && s.cwd) || "").split("/").filter(Boolean).pop() || tr("sess.tab");
        var d = new Date(Number(s && s.updatedAt) || 0);
        function p2(x) { return (x < 10 ? "0" : "") + x; }
        var when = isNaN(d.getTime()) ? "" : p2(d.getMonth() + 1) + "-" + p2(d.getDate()) + " " + p2(d.getHours()) + ":" + p2(d.getMinutes());
        return base + " · " + String((s && s.sessionId) || "").slice(8, 16) + " · " + when + (s && s.blank ? tr("sess.notStarted") : "");
      }

      function loadSessions() {
        // 双协议（0.1.5 两段式优先，失败回退旧 session.list）
        if (sess.phase !== "idle") return;
        setSess({ phase: "loading", items: [] });
        fetch("/api/session/list", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ type: "client-request", rpcId: "task-" + Date.now(), method: "session/list", payload: { args: { _request: {} } } }),
        })
          .then(function (r) { return r.json().catch(function () { return null; }); })
          .then(function (d) {
            var items = d && d.result && d.result.value && d.result.value.items;
            if (Array.isArray(items)) { setSess({ phase: "ready", items: items }); return null; }
            return fetch("/api/session.list", {
              method: "POST",
              headers: { "content-type": "application/json" },
              body: JSON.stringify({ type: "client-request", rpcId: "task-" + Date.now(), method: "session.list", payload: {} }),
            })
              .then(function (r2) { return r2.json().catch(function () { return null; }); })
              .then(function (d2) {
                var it = d2 && d2.result && d2.result.value && d2.result.value.items;
                setSess({ phase: "ready", items: Array.isArray(it) ? it : [] });
              });
          })
          .catch(function () { setSess({ phase: "ready", items: [] }); });
      }

      function shortSessionRefs(raw) {
        try {
          var arr = JSON.parse(raw);
          if (Array.isArray(arr)) {
            return arr.map(function (x) { return String((x && x.id) || "").slice(8, 24); }).filter(Boolean).join(", ");
          }
        } catch (e) {}
        return String(raw || "").slice(0, 60);
      }

      if (st.phase === "loading") return h("div", { style: wrap }, tr("task.loading"));
      if (st.phase === "error") return h("div", { style: wrap }, h("div", null, tr("task.failHint")));

      var SM = { todo: [tr("task.todo"), "#8a8f98"], doing: [tr("task.doing"), "#2f6fed"], done: [tr("task.done"), "#1f9d55"] };
      var NEXT = { todo: "doing", doing: "done", done: "todo" };
      var NEXT_LABEL = { todo: tr("task.start"), doing: tr("task.finish"), done: tr("task.reopen") };

      var cTodo = 0;
      var cDoing = 0;
      var cDone = 0;
      var cMine = 0;
      var cReview = 0;
      for (var ci = 0; ci < st.tasks.length; ci++) {
        var tt = st.tasks[ci];
        if (tt.status === "todo") cTodo++;
        else if (tt.status === "doing") cDoing++;
        else cDone++;
        if (tt.assignee === st.me || tt.created_by === st.me) cMine++;
        if (tt.review_state === "submitted") cReview++;
      }
      var list = st.tasks.filter(function (t) {
        if (filter === "review") return t.review_state === "submitted";
        if (filter === "mine") return t.assignee === st.me || t.created_by === st.me;
        if (filter === "all") return true;
        return t.status === filter;
      });

      var kids = [];

      var opts = [h("option", { key: "__none", value: "" }, tr("task.unassigned"))];
      for (var mi = 0; mi < st.members.length; mi++) opts.push(h("option", { key: st.members[mi], value: st.members[mi] }, st.members[mi]));
      kids.push(
        h(
          "div",
          { key: "nf", style: { display: "flex", flexDirection: "column", gap: 6 } },
          h("input", { ref: tRef, placeholder: tr("task.titlePh"), style: field }),
          h("input", { ref: nRef, placeholder: tr("common.phNote"), style: field }),
          h(
            "div",
            { style: { display: "flex", gap: 8, alignItems: "center" } },
            h("select", { ref: aRef, style: Object.assign({}, field, { width: 160 }) }, opts),
            h(
              "button",
              {
                style: btnDark,
                onClick: function () {
                  post(
                    "/portal/api/tasks/create",
                    { title: tRef.current ? tRef.current.value : "", note: nRef.current ? nRef.current.value : "", assignee: aRef.current ? aRef.current.value : "" },
                    tr("task.created"),
                    true
                  );
                },
              },
              tr("task.new")
            )
          )
        )
      );

      var RVC = { submitted: [tr("task.inReview"), "#b7791f"], accepted: [tr("task.accepted"), "#1f9d55"], rejected: [tr("task.returned"), "#c0392b"] };
      var sessOpts = [];
      if (sess.phase === "ready") {
        sessOpts = (sess.items || []).filter(function (s) { return !s.blank; });
        if (!sessOpts.length) sessOpts = (sess.items || []).slice(0, 12);
      }
      var fdefs = [
        ["all", tr("task.filterAll") + st.tasks.length],
        ["todo", tr("task.filterTodo") + cTodo],
        ["doing", tr("task.filterDoing") + cDoing],
        ["review", tr("task.filterReview") + cReview],
        ["done", tr("task.filterDone") + cDone],
        ["mine", tr("task.filterMine") + cMine],
      ];
      var fbtns = [];
      for (var fi = 0; fi < fdefs.length; fi++) {
        (function (key, label) {
          fbtns.push(h("button", { key: key, onClick: function () { setFilter(key); }, style: filter === key ? btnPillOn : btnPill }, label));
        })(fdefs[fi][0], fdefs[fi][1]);
      }
      kids.push(h("div", { key: "fl", style: { display: "flex", gap: 6, flexWrap: "wrap" } }, fbtns));

      var rows = [];
      for (var ri = 0; ri < list.length; ri++) {
        (function (t) {
          var sm = SM[t.status] || SM.todo;
          var canDel = st.role === "admin" || t.created_by === st.me;
          var isReviewer = st.role === "admin" || t.created_by === st.me;
          var isSubmitter = !!t.submitted_by && t.submitted_by === st.me;
          var canSubmit = st.role === "admin" || t.assignee === st.me || t.created_by === st.me;
          var isSubmitted = t.review_state === "submitted";
          var actions = [];
          if (!isSubmitted) {
            actions.push(
              h(
                "button",
                {
                  key: "nx",
                  style: btnSmall,
                  onClick: function () {
                    post("/portal/api/tasks/update", { id: t.id, status: NEXT[t.status] || "todo" }, tr("task.updated"), false);
                  },
                },
                NEXT_LABEL[t.status] || tr("task.advance")
              )
            );
          }
          if (canSubmit && !isSubmitted) {
            actions.push(
              h(
                "button",
                { key: "sb", style: btnSmall, onClick: function () { setSubmitFor(submitFor === t.id ? 0 : t.id); loadSessions(); } },
                submitFor === t.id ? tr("common.collapse") : tr("task.submitReview")
              )
            );
          }
          if (isSubmitted && isSubmitter) {
            actions.push(
              h(
                "button",
                {
                  key: "cx",
                  style: btnSmall,
                  onClick: function () {
                    if (window.confirm(tr("task.withdrawQ") + t.title + tr("task.withdrawQ2"))) post("/portal/api/tasks/review", { id: t.id, action: "cancel" }, tr("task.withdrawDone"), false);
                  },
                },
                tr("task.withdrawBtn")
              )
            );
          }
          if (isSubmitted && isReviewer) {
            actions.push(
              h(
                "button",
                { key: "ap", style: btnSmall, onClick: function () { post("/portal/api/tasks/review", { id: t.id, action: "accept" }, tr("task.acceptedToast"), false); } },
                tr("task.approveBtn")
              )
            );
            actions.push(
              h(
                "button",
                {
                  key: "rj",
                  style: btnSmall,
                  onClick: function () {
                    var r = window.prompt(tr("task.returnPrompt"));
                    if (r && r.trim()) post("/portal/api/tasks/review", { id: t.id, action: "reject", note: r.trim() }, tr("task.returned"), false);
                  },
                },
                tr("task.returnBtn")
              )
            );
          }
          if (!t.assignee) {
            actions.push(
              h(
                "button",
                {
                  key: "cl",
                  style: btnSmall,
                  onClick: function () {
                    post("/portal/api/tasks/update", { id: t.id, assignee: st.me }, tr("task.claimed"), false);
                  },
                },
                tr("task.claimBtn")
              )
            );
          }
          if (canDel) {
            actions.push(
              h(
                "button",
                {
                  key: "dl",
                  style: btnSmall,
                  onClick: function () {
                    if (window.confirm(tr("task.delTask") + t.title + "?")) post("/portal/api/tasks/delete", { id: t.id }, tr("common.deleted"), false);
                  },
                },
                tr("common.delete")
              )
            );
          }
          rows.push(
            h(
              "div",
              { key: "t" + t.id, style: rowBase },
              h(
                "div",
                { style: { display: "flex", alignItems: "center", gap: 8 } },
                h("span", { style: { color: sm[1], fontWeight: 600, fontSize: 12, whiteSpace: "nowrap" } }, "● " + sm[0]),
                h("span", { style: { fontWeight: 600, flex: 1, textDecoration: t.status === "done" ? "line-through" : "none", opacity: t.status === "done" ? 0.6 : 1 } }, t.title)
              ),
              t.note ? h("div", { style: { whiteSpace: "pre-wrap" } }, t.note) : null,
              h("div", { style: Object.assign({ fontSize: 11 }, muted) }, tr("task.assign") + (t.assignee || tr("task.unassigned")) + " · " + (t.created_by || "-") + " · " + fmtAt(t.updated_at)),
              t.review_state && t.review_state !== "none"
                ? h(
                    "div",
                    { style: { marginTop: 4, padding: "6px 8px", borderRadius: 6, background: "rgba(127,127,127,0.08)", fontSize: 12, display: "flex", flexDirection: "column", gap: 2 } },
                    h(
                      "div",
                      { style: { fontWeight: 600, color: (RVC[t.review_state] || [])[1] || "#8a8f98" } },
                      ((RVC[t.review_state] || [t.review_state])[0] || t.review_state) + tr("task.submittedBy") + (t.submitted_by || "-") + (t.submitted_at ? " · " + fmtAt(t.submitted_at) : "")
                    ),
                    t.submit_note ? h("div", null, tr("task.note") + t.submit_note) : null,
                    t.commit_refs ? h("div", { style: { whiteSpace: "pre-wrap", fontFamily: "monospace", fontSize: 11, opacity: 0.85 } }, t.commit_refs) : null,
                    t.session_refs ? h("div", { style: { opacity: 0.85 } }, tr("task.linkedSess") + shortSessionRefs(t.session_refs)) : null,
                    t.review_note
                      ? h("div", null, (t.review_state === "rejected" ? tr("task.returnReason") : tr("task.reviewNote")) + t.review_note + (t.reviewed_by ? "(" + t.reviewed_by + ")" : ""))
                      : null
                  )
                : null,
              submitFor === t.id
                ? h(
                    "div",
                    { style: { marginTop: 4, padding: "8px", borderRadius: 6, background: "rgba(127,127,127,0.08)", display: "flex", flexDirection: "column", gap: 6, fontSize: 12 } },
                    h("div", { style: { fontWeight: 600 } }, tr("task.submitReview")),
                    h("textarea", { ref: cRef, placeholder: tr("task.phCommits"), style: Object.assign({}, field, { minHeight: 52, fontFamily: "inherit", resize: "vertical" }) }),
                    h("input", { ref: snRef, placeholder: tr("task.phSubmitNote"), style: field }),
                    h(
                      "select",
                      { ref: sesRef, style: field },
                      [h("option", { key: "none", value: "" }, sess.phase === "loading" ? tr("task.loadingSess") : sessOpts.length ? tr("task.pickSess") : tr("task.noSess"))].concat(
                        sessOpts.map(function (s) {
                          return h("option", { key: s.sessionId, value: s.sessionId }, sessLabel(s));
                        })
                      )
                    ),
                    h(
                      "div",
                      { style: { display: "flex", gap: 6 } },
                      h(
                        "button",
                        {
                          style: btnSmall,
                          onClick: function () {
                            setSubmitFor(0);
                            post(
                              "/portal/api/tasks/submit",
                              {
                                id: t.id,
                                note: snRef.current ? snRef.current.value : "",
                                commits: cRef.current ? cRef.current.value : "",
                                session_id: sesRef.current ? sesRef.current.value : "",
                              },
                              tr("task.submittedToast"),
                              false
                            );
                          },
                        },
                        tr("task.submitBtn")
                      ),
                      h("button", { style: btnSmall, onClick: function () { setSubmitFor(0); } }, tr("common.cancel"))
                    )
                  )
                : null,
              h("div", { style: { display: "flex", gap: 6 } }, actions)
            )
          );
        })(list[ri]);
      }
      kids.push(
        h(
          "div",
          { key: "rows", style: { display: "flex", flexDirection: "column" } },
          rows.length ? rows : h("div", { style: muted }, filter === "all" ? tr("task.empty") : tr("task.emptyFilter"))
        )
      );
      if (msg.kind) {
        kids.push(
          h("div", { key: "msg", style: msg.kind === "err" ? { color: "#c0392b", fontSize: 12 } : Object.assign({ fontSize: 12 }, muted) }, msg.text)
        );
      }
      return h("div", { style: Object.assign({}, wrap, { maxWidth: 640 }) }, kids);
    }

    var inject = ["slots", "locale"];

    function apply(ctx) {
      DESK_CTX = ctx;
      try {
        ctx.effect(function () { return ctx.locale.register(DESK_NS, { zh: LOC_ZH, en: LOC_EN }); });
        DESK_T = ctx.locale.bind(DESK_NS);
      } catch (e) { /* 无语言服务时退回中文 */ }
      ctx.slots.inject("settings.section", function () {
        return ctx.slots.register(
          {
            name: "settings.section",
            id: "desk-usage",
            order: 50,
            label: function () {
              return tr("sec.usage");
            },
          },
          DeskUsageSection
        );
      });
      ctx.slots.inject("settings.section", function () {
        return ctx.slots.register(
          {
            name: "settings.section",
            id: "desk-sessions",
            order: 58,
            label: function () {
              return tr("sec.sessions");
            },
          },
          SessionsMgrSection
        );
      });
      ctx.slots.inject("settings.section", function () {
        return ctx.slots.register(
          {
            name: "settings.section",
            id: "desk-kb",
            order: 60,
            label: function () {
              return tr("sec.kb");
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
              return tr("sec.drive");
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
              return tr("sec.members");
            },
          },
          AdminSection
        );
      });
      ctx.slots.inject("settings.section", function () {
        return ctx.slots.register(
          {
            name: "settings.section",
            id: "desk-notify",
            order: 90,
            label: function () {
              return tr("sec.notify");
            },
          },
          NotifySection
        );
      });
      ctx.slots.inject("sidebar.footer.action", function () {
        return ctx.slots.register(
          {
            name: "sidebar.footer.action",
            id: "desk-announce",
            order: 90,
            label: function () {
              return tr("ann.tab");
            },
          },
          AnnounceBoard
        );
      });
      ctx.slots.inject("sidebar.footer.action", function () {
        return ctx.slots.register(
          {
            name: "sidebar.footer.action",
            id: "desk-assistants",
            order: 86,
            label: function () {
              return tr("asst.tab");
            },
          },
          AssistantsPanel
        );
      });
      ctx.slots.inject("sidebar.footer.action", function () {
        return ctx.slots.register(
          {
            name: "sidebar.footer.action",
            id: "desk-skills-conn",
            order: 87,
            label: function () {
              return tr("skl.tab");
            },
          },
          SkillsConnPanel
        );
      });
      ctx.slots.inject("sidebar.footer.action", function () {
        return ctx.slots.register(
          {
            name: "sidebar.footer.action",
            id: "desk-auto",
            order: 88,
            label: function () {
              return tr("auto.tab");
            },
          },
          AutomationPanel
        );
      });
      ctx.slots.inject("settings.section", function () {
        return ctx.slots.register(
          {
            name: "settings.section",
            id: "desk-ops",
            order: 100,
            label: function () {
              return tr("sec.ops");
            },
          },
          OpsSection
        );
      });
      ctx.slots.inject("settings.section", function () {
        return ctx.slots.register(
          {
            name: "settings.section",
            id: "desk-tasks",
            order: 55,
            label: function () {
              return tr("sec.tasks");
            },
          },
          TaskBoard
        );
      });
    }

    exports.apply = apply;
    exports.inject = inject;
    return module.exports;
  },
});
