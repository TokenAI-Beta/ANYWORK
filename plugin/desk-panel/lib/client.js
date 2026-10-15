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
      "fv.back": "← 返回对话",
      "asst.groupTeam": "团队角色",
      "asst.defaultTag": "默认",
      "skl.platforms": "消息平台",
      "skl.tools": "开发工具",
      "skl.connect": "连接",
      "skl.addMore": "加一条",
      "skl.test": "测试",
      "skl.connected": "已连接",
      "skl.notConnected": "未连接",
      "skl.routesUnit": " 条",
      "skl.save": "保存",
      "skl.namePh": "通道名称（小写英文，如 feishu-team）",
      "skl.needNameTarget": "名称和内容都要填",
      "skl.routeSaved": "已保存，通道即刻生效",
      "skl.adminOnly": "Channel setup is admin-only — My WeChat is self-serve.",
      "skl.grpMeet": "会议",
      "skl.grpWork": "工作平台",
      "skl.planTag": "规划中",
      "skl.reconfig": "改配置",
      "skl.remove": "删除",
      "skl.open": "打开",
      "skl.confirmRm": "确定删除这个连接？",
      "skl.connSaved": "已保存，点「测试」验证一下",
      "wxq.connect": "连接微信",
      "wxq.reconnect": "重新连接",
      "wxq.title": "连接你的微信",
      "wxq.hint": "扫完码在微信里点「确认」——之后团队通知直接进微信，还能把工作台助理当成微信好友一样对话。",
      "wxq.waiting": "等待扫码…",
      "wxq.scaned": "已扫码——请在微信里点「确认」",
      "wxq.done": "完成！已接入",
      "wxq.expired": "二维码已过期",
      "wxq.refresh": "刷新二维码",
      "wxq.close": "关闭",
      "skl.connNeedConfig": "先把内容填上",
      "asst.groupBuiltin": "引擎自带模式",
      "asst.builtinTag": "自带",
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
      "th.tab": "团队资料",
      "th.sub": "文件 + 笔记 · 放进来 = 全员可见",
      "th.filesTab": "📁 文件",
      "th.notesTab": "📝 笔记",
      "th.hintFiles": "放原始文件；按项目或客户建文件夹，找起来最快",
      "th.hintNotes": "记结论和经验，搜一下就能找到 —— AI 助理也能直接引用",
      "th.newFolder": "＋ 新建文件夹",
      "th.folderNamePh": "文件夹名字，比如「客户A」「2026报价」",
      "th.create": "创建",
      "th.upload": "⬆ 上传",
      "th.uploading": "上传中：",
      "th.uploadFail": "上传失败：",
      "th.dropTitle": "⬆ 拖文件到这里上传",
      "th.dropSub": "上传到当前文件夹 · 单个 ≤50MB",
      "th.root": "根目录",
      "th.download": "下载",
      "th.openIt": "打开",
      "th.moveBtn": "移动到…",
      "th.del": "删除",
      "th.cancel": "取消",
      "th.confirmDelFolder": "删除文件夹「",
      "th.confirmDelFile": "删除文件「",
      "th.confirmDelTail": "」？此操作不可恢复。",
      "th.mvTitle": "把「",
      "th.mvTitle2": "」移动到：",
      "th.mvHere": "移到这里",
      "th.noSubFolder": "（没有子文件夹，可直接「移到这里」）",
      "th.emptyTitleA": "① 建个文件夹，把文件传进来",
      "th.emptyBodyA": "比如「客户A」「2026报价」—— 拖进去就行",
      "th.emptyTitleB": "② 记第一条笔记",
      "th.emptyBodyB": "今天有什么结论？写一句话也算",
      "th.searchPh": "搜笔记，比如「印尼」「定价」…",
      "th.searchBtn": "搜索",
      "th.saveNote": "＋ 记一条",
      "th.noteTitlePh": "标题（不填就用第一行）",
      "th.noteBodyPh": "想到什么写什么…… 一句话也算",
      "th.saveBtn": "保存 ✓",
      "th.noteSaved": "已记下 ✓",
      "th.noNotes": "还没有笔记 —— 点「＋ 记一条」写第一句",
      "th.noNotesSub": "结论、口径、经验，一句话也算",
      "th.hitsPrefix": "命中 ",
      "th.noHits": "没有命中，换个短点的词试试",
      "th.read": "查看",
      "th.hide": "收起",
      "th.backList": "返回笔记列表",
      "th.folderWord": "文件夹",
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
      "admin.upstreamSrc": "（来源 ",
      "admin.keyMissing": "Key 未配置",
      "admin.keyPh": "sk-…（粘贴新的 DeepSeek API Key；保存后网关自动重启约 5~10 秒）",
      "admin.updateKey": "更新 Key",
      "admin.keyEnvLocked": "当前 Key 来自服务环境变量（DESK_REAL_KEY），请在服务环境里修改。",
      "team.title": "团队共用模型 Key",
      "team.titleMember": "团队共用模型（固定）",
      "team.desc": "所有成员默认经团队网关出网；Key 只存服务器，成员不可见。保存后网关自动重启（约 5~10 秒）。",
      "team.descMember": "由团队管理员统一配置，你无需填写任何 Key；直接使用下列模型即可。",
      "team.models": "可用模型：",
      "team.noModels": "（尚未配置模型清单）",
      "team.hint": "上方「模型」卡片是你的个人 API 配置；如需换成自己的 key，请同时把 Base URL 改为 https://api.deepseek.com。",
      "team.loading": "读取团队模型配置中…",
      "team.locked": "已由管理员配置，固定不变",
      "admin.keyScopeNote": "换 Key 只影响默认上游；给特定模型接别的上游 / Key 在下方「模型通道」里配置。",
      "admin.channelsDesc": "按模型名把请求分流到其它上游（OpenAI 兼容）；未命中的模型走默认上游。",
      "admin.chProvider": "服务商",
      "admin.chProviderCustom": "自定义（手动填写）",
      "admin.chGetKey": "去服务商官网获取 API Key ↗",
      "admin.chPickModels": "选择模型（勾选的会加入「可用模型」，成员可选）",
      "admin.chNoModelsHint": "（该服务商暂无预置模型，请在下方手动添加）",
      "admin.chAddModelPh": "手动添加模型名（逗号分隔）",
      "admin.chAdd": "添加",
      "admin.chAdvanced": "高级设置（名称 / Base URL / 价目表 / 输出上限 / 备注）",
      "admin.chCapPh": "单次输出上限 tokens（如 32768；留空 = 不设置，可能被供应商拒）",
      "admin.chPriceHint": "价目表（可选）：留空 = 该模型不计价（仍统计 token）；单位 ¥/百万 tokens",
      "admin.chInPh": "输入价",
      "admin.chOutPh": "输出价",
      "admin.chSaveTest": "保存并测试连通",
      "admin.chTest": "测试",
      "admin.chTesting": " · 连通测试中…",
      "admin.chTestOk": "已连通（",
      "admin.chTestOkS": " 秒）",
      "admin.chTestFail": "连通测试失败：",
      "admin.chNeedKey": "请先填 API Key",
      "admin.chNeedName": "请先填通道名称",
      "admin.chNeedUrl": "请先填 Base URL",
      "admin.chNeedModels": "请至少勾选或添加一个模型",
      "admin.chKeyPh": "API Key（sk-…）",
      "admin.chRestartNote": " · 工作台将在约 10 秒内自动重启以刷新模型列表",
      "admin.membersCount": "成员（",
      "admin.newMember": "新建成员",
      "admin.phUsername": "用户名（小写字母数字，2-32 位）",
      "admin.phPassword": "初始密码（至少 6 位）",
      "admin.phBudget": "月预算 CNY（可留空 = 不限）",
      "admin.memberCreated": "成员已创建：",
      "admin.createMember": "创建成员",
      "admin.newKeyShown": "新成员虚拟钥匙——",
      "admin.newKeyTail": " 的工作台已自动配置，无需转交；仅存档需要时复制。",
      "admin.copied": "已复制到剪贴板",
      "common.copyFail": "复制失败，请手动选中复制",
      "common.copy": "复制",
      "common.keyDone": "已交给成员，清除显示",
      "admin.channelsCount": "模型通道（",
      "admin.noChannels": "暂无外部通道（默认走 DeepSeek 官方）",
      "admin.addChannel": "加入通道",
      "admin.phChannelName": "名称（英文小写，如 kimi）",
      "admin.phBaseUrl": "Base URL（OpenAI 兼容，含 /v1）",
      "common.phNote": "备注（可选）",
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
      "notify.kindFeishu": "feishu —— 飞书群机器人 Webhook",
      "notify.kindDingtalk": "dingtalk —— 钉钉群机器人（可加签）",
      "notify.kindWecom": "wecom —— 企业微信群机器人 Webhook",
      "notify.kindDiscord": "discord —— 频道 Webhook",
      "notify.kindSlack": "slack —— Slack Incoming Webhook",
      "notify.kindTeams": "teams —— Microsoft Teams 频道 Webhook",
      "notify.kindNtfy": "ntfy —— 手机推送（ntfy.sh）",
      "notify.phFeishu": "https://open.feishu.cn/open-apis/bot/v2/hook/…",
      "notify.phDingtalk": "webhook地址[|加签Secret]",
      "notify.phWecom": "https://qyapi.weixin.qq.com/cgi-bin/webhook/send?key=…",
      "notify.phDiscord": "https://discord.com/api/webhooks/…",
      "notify.phSlack": "https://hooks.slack.com/services/…",
      "notify.phTeams": "https://….webhook.office.com/webhookb2/…",
      "notify.phNtfy": "主题名（如 anywork-bai）[|服务器[|Token]]",
      "notify.kindZoom": "zoom —— Zoom 聊天 Incoming Webhook（付费版）",
      "notify.phZoom": "https://…/webhook/…（Zoom 客户端 → 聊天 → 应用 → Incoming Webhook）",
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
      "auto.title": "自动化：定时任务、触发规则与快捷动作",
      "auto.tab": "自动化",
      "auto.statActive": "进行中",
      "auto.statWeek": "本周执行",
      "auto.statFails": "近 7 天失败",
      "auto.statNext": "下次运行",
      "auto.fAll": "全部",
      "auto.fTimer": "定时任务",
      "auto.fRule": "触发规则",
      "auto.fPaused": "已暂停",
      "auto.secMine": "我的自动化",
      "auto.secQuick": "快捷动作 · 现在就干",
      "auto.secNew": "新建自动化",
      "auto.secLogs": "执行记录",
      "auto.runNow": "立即运行",
      "auto.rm": "删除",
      "auto.confirmDel": "删除这条自动化？",
      "auto.runStarted": "已开始执行，稍后见执行记录",
      "auto.ruleAdminHint": "团队规则只有管理员能改",
      "auto.byAgent": "让助理",
      "auto.next": "下次",
      "auto.last": "上次",
      "auto.runs": "已执行",
      "auto.runsUnit": " 次",
      "auto.today": "今天",
      "auto.tomorrow": "明天",
      "auto.empty": "还没有自动化——下面新建一个",
      "auto.defaultName": "定时任务",
      "auto.badTime": "请先选择时间",
      "auto.qBriefing": "立即生成今日简报",
      "auto.qBriefingSub": "汇总今天的会话要点，跑完推送",
      "auto.qProgress": "汇总任务进度",
      "auto.qProgressSub": "任务板进度自动成稿并推送",
      "auto.qRemind": "给全员发提醒",
      "auto.qRemindSub": "说一句话，全员收到",
      "auto.qRemindPh": "要发给全员的话…",
      "auto.qSend": "发送",
      "auto.tabTimer": "⏰ 定时",
      "auto.tabOne": "💬 一句话创建",
      "auto.kindNotify": "发一条通知",
      "auto.kindAgent": "让助理干活",
      "auto.formNamePh": "名称（如：每天早报）",
      "auto.formNotifyPh": "到点要发送的内容…",
      "auto.formPromptPh": "给助理的指令，如：汇总昨天各成员进展，5 条以内",
      "auto.everyDay": "每天",
      "auto.everyWeek": "每周",
      "auto.save": "保存并启用",
      "auto.saved": "已保存并启用",
      "auto.onePh": "用一句话描述，如：每天早上九点，把昨天进展汇总成 5 条发我",
      "auto.oneParse": "解析并创建",
      "auto.oneFail": "没识别出时间。请写成「每天 09:00」「每周一 9 点」这样",
      "auto.ruleNote": "触发规则为内建（上方卡片可启停）；更多规则陆续开放",
      "auto.logsEmpty": "还没有执行记录",
      "auto.footNote": "到点由工作台自动执行；「让助理干活」的结果会自动推送到通知通道。",
      "auto.pending": "待发送提醒（",
      "auto.emptyPending": "还没有待发送的提醒。",
      "auto.phTime2": "10:00 / +30m / 明天 09:00",
      "auto.phText": "提醒内容",
      "common.add": "添加",
      "auto.hintAdmin": "到点由通知桥推送微信。也可以直接对助理说：提醒我 明天 09:00 开会。",
      "auto.hintMember": "成员可见提醒列表；新增 / 删除请找管理员，或直接对助理说：提醒我 明天 09:00 开会。",
      "auto.recent": "最近已发送",
      "auto.panelTitle": "定时任务 · 触发规则 · 一键动作",
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
      "usg.tab": "用量",
      "usg.title": "工作台用量",
      "usg.sub": "本月消耗与预算",
      "usg.chipPfx": "本月 ",
      "usg.chipTip": "本月费用（点击查看）",
      "usg.details": "查看详情 →",
      "usg.recent": "最近请求",
      "usg.none": "暂无记录",
      "usg.signout": "退出登录",
      "sec.kb": "知识库",
      "sec.members": "成员管理",
      "sec.notify": "通知",
      "sec.ops": "运维",
      "sec.tasks": "任务板",
    };
    var LOC_EN = {
      "fv.back": "← Back to chat",
      "asst.groupTeam": "Team roles",
      "asst.defaultTag": "Default",
      "skl.platforms": "Messaging platforms",
      "skl.tools": "Dev tools",
      "skl.connect": "Connect",
      "skl.addMore": "Add route",
      "skl.test": "Test",
      "skl.connected": "Connected",
      "skl.notConnected": "Not connected",
      "skl.routesUnit": " route(s)",
      "skl.save": "Save",
      "skl.namePh": "Route name (lowercase, e.g. feishu-team)",
      "skl.needNameTarget": "Name and target are both required",
      "skl.routeSaved": "Saved — the route is live",
      "skl.adminOnly": "Only admins can configure routes — members can view status.",
      "skl.grpMeet": "Meetings",
      "skl.grpWork": "Work platforms",
      "skl.planTag": "Planned",
      "skl.reconfig": "Update",
      "skl.remove": "Remove",
      "skl.open": "Open",
      "skl.confirmRm": "Remove this connection?",
      "skl.connSaved": "Saved — hit Test to verify",
      "wxq.connect": "Connect WeChat",
      "wxq.reconnect": "Reconnect",
      "wxq.title": "Connect your WeChat",
      "wxq.hint": "After scanning, tap Confirm in WeChat — team notifications will reach you, and you can chat with your workbench assistant right in WeChat.",
      "wxq.waiting": "Waiting for scan…",
      "wxq.scaned": "Scanned — please tap Confirm in WeChat",
      "wxq.done": "Done — connected!",
      "wxq.expired": "QR code expired",
      "wxq.refresh": "Refresh QR code",
      "wxq.close": "Close",
      "skl.connNeedConfig": "Fill in the value first",
      "asst.groupBuiltin": "Built-in modes",
      "asst.builtinTag": "Built-in",
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
      "th.tab": "Team files",
      "th.sub": "Files + notes · visible to everyone",
      "th.filesTab": "📁 Files",
      "th.notesTab": "📝 Notes",
      "th.hintFiles": "Original files — sort into folders by project or client",
      "th.hintNotes": "Notes for conclusions & know-how — searchable, and the AI can cite them",
      "th.newFolder": "+ New folder",
      "th.folderNamePh": "Folder name, e.g. client-A or quotes-2026",
      "th.create": "Create",
      "th.upload": "⬆ Upload",
      "th.uploading": "Uploading: ",
      "th.uploadFail": "Upload failed: ",
      "th.dropTitle": "⬆ Drop files here to upload",
      "th.dropSub": "Goes into the current folder · ≤50MB per file",
      "th.root": "Home",
      "th.download": "Download",
      "th.openIt": "Open",
      "th.moveBtn": "Move to…",
      "th.del": "Delete",
      "th.cancel": "Cancel",
      "th.confirmDelFolder": "Delete folder “",
      "th.confirmDelFile": "Delete file “",
      "th.confirmDelTail": "”? This cannot be undone.",
      "th.mvTitle": "Move “",
      "th.mvTitle2": "” to:",
      "th.mvHere": "Move here",
      "th.noSubFolder": "(No subfolders — just use “Move here”)",
      "th.emptyTitleA": "① Create a folder and upload files",
      "th.emptyBodyA": "e.g. client-A or quotes-2026 — just drag & drop them in",
      "th.emptyTitleB": "② Write your first note",
      "th.emptyBodyB": "Any conclusion today? One line is enough",
      "th.searchPh": "Search notes, e.g. pricing…",
      "th.searchBtn": "Search",
      "th.saveNote": "+ New note",
      "th.noteTitlePh": "Title (first line if left empty)",
      "th.noteBodyPh": "Write anything… one line is fine",
      "th.saveBtn": "Save ✓",
      "th.noteSaved": "Note saved ✓",
      "th.noNotes": "No notes yet — click “+ New note”",
      "th.noNotesSub": "Conclusions, conventions, know-how — one line counts",
      "th.hitsPrefix": "Hits: ",
      "th.noHits": "No hits — try a shorter keyword",
      "th.read": "View",
      "th.hide": "Hide",
      "th.backList": "Back to note list",
      "th.folderWord": "Folder",
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
      "admin.upstreamSrc": " (source ",
      "admin.keyMissing": "Key not configured",
      "admin.keyPh": "sk-… (paste a new DeepSeek API key; saving restarts the gateway in ~5–10 s)",
      "admin.updateKey": "Update key",
      "admin.keyEnvLocked": "The current key comes from the service environment (DESK_REAL_KEY); change it there.",
      "team.title": "Team shared model key",
      "team.titleMember": "Team shared models (locked)",
      "team.desc": "All members route through the team gateway by default; the key stays on the server (invisible to members). Saving restarts the gateway (~5-10s).",
      "team.descMember": "Managed by the team admin - no key needed; just use the models below.",
      "team.models": "Available models: ",
      "team.noModels": "(no model list configured yet)",
      "team.hint": "The \"Models\" cards above are your personal API configuration; to use your own key, also set Base URL to https://api.deepseek.com.",
      "team.loading": "Loading team model configuration...",
      "team.locked": "Locked - managed by the admin",
      "admin.keyScopeNote": "Changing the key only affects the default upstream; route specific models to other upstreams/keys in “Model channels” below.",
      "admin.channelsDesc": "Route requests by model name to other OpenAI-compatible upstreams; unmatched models use the default upstream.",
      "admin.chProvider": "Provider",
      "admin.chProviderCustom": "Custom (fill manually)",
      "admin.chGetKey": "Get an API key from the provider ↗",
      "admin.chPickModels": "Pick models (checked = available to members)",
      "admin.chNoModelsHint": "(no preset models for this provider - add manually below)",
      "admin.chAddModelPh": "Add model names (comma-separated)",
      "admin.chAdd": "Add",
      "admin.chAdvanced": "Advanced (name / Base URL / prices / max output tokens / note)",
      "admin.chCapPh": "Max output tokens cap (e.g. 32768; empty = unset)",
      "admin.chPriceHint": "Prices (optional): empty = no costing (tokens still counted); CNY per million tokens",
      "admin.chInPh": "Input",
      "admin.chOutPh": "Output",
      "admin.chSaveTest": "Save & test",
      "admin.chTest": "Test",
      "admin.chTesting": " - testing...",
      "admin.chTestOk": "connected (",
      "admin.chTestOkS": "s)",
      "admin.chTestFail": "connection test failed: ",
      "admin.chNeedKey": "Enter the API key first",
      "admin.chNeedName": "Enter a channel name first",
      "admin.chNeedUrl": "Enter the Base URL first",
      "admin.chNeedModels": "Pick or add at least one model",
      "admin.chKeyPh": "API Key (sk-...)",
      "admin.chRestartNote": " · workspaces will auto-restart in ~10s to refresh the model list",
      "admin.membersCount": "Members (",
      "admin.newMember": "New member",
      "admin.phUsername": "Username (lowercase letters/digits, 2–32)",
      "admin.phPassword": "Initial password (min 6 chars)",
      "admin.phBudget": "Monthly budget CNY (leave empty = unlimited)",
      "admin.memberCreated": "Member created: ",
      "admin.createMember": "Create member",
      "admin.newKeyShown": "New member virtual key — ",
      "admin.newKeyTail": "'s workspace is auto-configured; no need to share (copy only for archival).",
      "admin.copied": "Copied to clipboard",
      "common.copyFail": "Copy failed — select and copy manually",
      "common.copy": "Copy",
      "common.keyDone": "Handed over — clear it",
      "admin.channelsCount": "Model channels (",
      "admin.noChannels": "No external channels yet (models go to DeepSeek official by default)",
      "admin.addChannel": "Add channel",
      "admin.phChannelName": "Name (lowercase, e.g. kimi)",
      "admin.phBaseUrl": "Base URL (OpenAI-compatible, include /v1)",
      "common.phNote": "Note (optional)",
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
      "notify.kindFeishu": "feishu — Feishu custom-bot webhook",
      "notify.kindDingtalk": "dingtalk — DingTalk robot (optional secret)",
      "notify.kindWecom": "wecom — WeCom group-robot webhook",
      "notify.kindDiscord": "discord — channel webhook",
      "notify.kindSlack": "slack — Slack incoming webhook",
      "notify.kindTeams": "teams — Microsoft Teams channel webhook",
      "notify.kindNtfy": "ntfy — phone push (ntfy.sh)",
      "notify.phFeishu": "https://open.feishu.cn/open-apis/bot/v2/hook/…",
      "notify.phDingtalk": "webhook URL[|secret]",
      "notify.phWecom": "https://qyapi.weixin.qq.com/cgi-bin/webhook/send?key=…",
      "notify.phDiscord": "https://discord.com/api/webhooks/…",
      "notify.phSlack": "https://hooks.slack.com/services/…",
      "notify.phTeams": "https://….webhook.office.com/webhookb2/…",
      "notify.phNtfy": "topic (e.g. anywork-bai) [|server[|token]]",
      "notify.kindZoom": "zoom — Zoom Team Chat incoming webhook (paid plans)",
      "notify.phZoom": "https://…/webhook/… (Zoom app → Chat → Apps → Incoming Webhook)",
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
      "auto.title": "Automation: tasks, rules & quick actions",
      "auto.tab": "Automation",
      "auto.statActive": "Active",
      "auto.statWeek": "Runs · 7d",
      "auto.statFails": "Failed · 7d",
      "auto.statNext": "Next run",
      "auto.fAll": "All",
      "auto.fTimer": "Scheduled",
      "auto.fRule": "Event rules",
      "auto.fPaused": "Paused",
      "auto.secMine": "My automations",
      "auto.secQuick": "Quick actions",
      "auto.secNew": "New automation",
      "auto.secLogs": "Run history",
      "auto.runNow": "Run now",
      "auto.rm": "Delete",
      "auto.confirmDel": "Delete this automation?",
      "auto.runStarted": "Started — see run history soon",
      "auto.ruleAdminHint": "Team rules are admin-only",
      "auto.byAgent": "Assistant",
      "auto.next": "Next",
      "auto.last": "Last",
      "auto.runs": "Runs",
      "auto.runsUnit": "",
      "auto.today": "Today",
      "auto.tomorrow": "Tomorrow",
      "auto.empty": "Nothing yet — create one below",
      "auto.defaultName": "Scheduled task",
      "auto.badTime": "Pick a time first",
      "auto.qBriefing": "Today's briefing now",
      "auto.qBriefingSub": "Summarize today's sessions, push when done",
      "auto.qProgress": "Task progress digest",
      "auto.qProgressSub": "Digest built and pushed",
      "auto.qRemind": "Remind everyone",
      "auto.qRemindSub": "One line to the whole team",
      "auto.qRemindPh": "Message for the team…",
      "auto.qSend": "Send",
      "auto.tabTimer": "⏰ Schedule",
      "auto.tabOne": "💬 One sentence",
      "auto.kindNotify": "Send a notification",
      "auto.kindAgent": "Ask an assistant",
      "auto.formNamePh": "Name (e.g. Daily briefing)",
      "auto.formNotifyPh": "Text to send at the scheduled time…",
      "auto.formPromptPh": "Instruction for the assistant…",
      "auto.everyDay": "Daily",
      "auto.everyWeek": "Weekly",
      "auto.save": "Save & enable",
      "auto.saved": "Saved & enabled",
      "auto.onePh": "One sentence, e.g. Every day at 9, summarize progress into 5 bullets",
      "auto.oneParse": "Parse & create",
      "auto.oneFail": "Couldn't detect a time — try \"daily 09:00\" or \"Mon 9\"",
      "auto.ruleNote": "Event rules are built-in (toggle above); more coming",
      "auto.logsEmpty": "No runs yet",
      "auto.footNote": "Runs on schedule; assistant results are pushed to your channels.",
      "auto.pending": "Pending reminders (",
      "auto.emptyPending": "No pending reminders.",
      "auto.phTime2": "10:00 / +30m / tomorrow 09:00",
      "auto.phText": "Reminder text",
      "common.add": "Add",
      "auto.hintAdmin": "Pushed through the notification bridge at the set time. You can also just tell an assistant: remind me tomorrow 09:00 meeting.",
      "auto.hintMember": "Members can view the reminder list; ask an admin to add / remove, or tell an assistant: remind me tomorrow 09:00 meeting.",
      "auto.recent": "Recently sent",
      "auto.panelTitle": "Scheduled tasks · event rules · quick actions",
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
      "usg.tab": "Usage",
      "usg.title": "Workbench usage",
      "usg.sub": "This month's spend and budget",
      "usg.chipPfx": "This month ",
      "usg.chipTip": "Spend this month (click to view)",
      "usg.details": "View details →",
      "usg.recent": "Recent requests",
      "usg.none": "No records yet",
      "usg.signout": "Sign out",
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
    /* —— 团队资料面板（TeamHub） —— */
.ddp .dropz { border:1.5px dashed var(--dsw-alias-border-l2, #ccd0d5); border-radius:12px; background:var(--dsw-alias-bg-base, #f7f8fa); text-align:center; padding:12px 10px; margin:8px 0 10px; cursor:pointer; }
.ddp .dropz .a { font-size:13px; font-weight:600; color:var(--dsw-alias-state-business-primary, #4f7cf7); }
.ddp .dropz .b { font-size:11px; opacity:.72; margin-top:3px; }
.ddp .bigcard { border:1.5px dashed var(--dsw-alias-border-l2, #ccd0d5); border-radius:12px; background:var(--dsw-alias-bg-base, #f7f8fa); padding:14px; margin:0 0 10px; cursor:pointer; }
.ddp .bigcard .bt { font-size:13.5px; font-weight:700; color:var(--dsw-alias-state-business-primary, #4f7cf7); }
.ddp .bigcard .bs { font-size:11.5px; opacity:.72; margin-top:4px; line-height:1.5; }
.ddp .bc { font-size:12px; opacity:.85; margin:2px 0 8px; }
.ddp .bc .lk { color:var(--dsw-alias-state-business-primary, #4f7cf7); cursor:pointer; }
.ddp .tbar { display:flex; align-items:center; gap:6px; margin-bottom:8px; }
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
/* ── 整页视图（FullView）：五个侧栏入口点开 = 整页界面，侧栏常驻、可切换 ── */
.ddb.on { background: rgba(79,124,247,.13); }
.ddb.on .ic { background: rgba(79,124,247,.16); }
.ddp.fv { left: var(--desk-fv-left, 12px); top:0; right:0; bottom:0; width:auto; max-width:none; max-height:none; border-radius:0; border:0; border-left:1px solid var(--dsw-alias-border-l2, #e8eaed); box-shadow:none; background:var(--dsw-alias-bg-base, #fff); }
.ddp.fv .hd { padding:17px 40px 15px; }
.ddp.fv .hd .ico { width:44px; height:44px; border-radius:13px; font-size:22px; }
.ddp.fv .hd .t1 { font-size:19px; }
.ddp.fv .hd .t2 { font-size:12.5px; margin-top:3px; }
.ddp.fv .hd .x { width:auto; height:34px; padding:0 15px; border:1px solid var(--dsw-alias-border-l2, #d4d7dc); border-radius:999px; font-size:12.5px; opacity:.92; white-space:nowrap; }
.ddp.fv .hd .x:hover { background:rgba(127,127,127,.10); opacity:1; }
.ddp.fv .tabs { width:min(1080px, calc(100% - 80px)); margin:16px auto 0; }
.ddp.fv .bd { flex:1; min-height:0; padding:20px 40px 96px; }
.ddp.fv .bd > * { max-width:1080px; margin-left:auto; margin-right:auto; }
.ddp.fv .it { padding:12px 10px; }
.ddb .ic svg, .ddp .hd .ico svg, .ddp .rc-ico svg, .ddp .it .ico2 svg { display:block; }
.ddp.fv .hd .ico svg { width:22px; height:22px; }
.ddb.on .ic { color:#4f7cf7; }
/* 助理页：团队角色卡片 */
.ddp .rolegrid { display:grid; grid-template-columns:repeat(auto-fill, minmax(240px, 1fr)); gap:10px; }
.ddp .rolecard { border:1px solid var(--dsw-alias-border-l2, #e8eaed); border-radius:12px; padding:12px 13px; background:var(--dsw-alias-bg-layer-2, #fff); }
.ddp .rc-top { display:flex; align-items:center; gap:8px; margin-bottom:6px; flex-wrap:wrap; }
.ddp .rc-ico { width:30px; height:30px; border-radius:9px; display:flex; align-items:center; justify-content:center; background:var(--dsw-alias-bg-base, #f2f3f5); flex:0 0 auto; }
.ddp .rc-name { font-weight:640; font-size:13.5px; }
.ddp .rc-d { font-size:12.5px; color:var(--dsw-alias-label-secondary, #5f6570); line-height:1.65; }
/* 连接器页：消息平台 */
.ddp .lb { font-size:12px; font-weight:640; color:var(--dsw-alias-label-secondary, #6b7280); margin:12px 0 8px; letter-spacing:.4px; }
.ddp .pgrid { display:grid; grid-template-columns:repeat(auto-fill, minmax(238px, 1fr)); gap:10px; }
.ddp .pcard { border:1px solid var(--dsw-alias-border-l2, #e4e6eb); border-radius:12px; padding:12px 13px; background:var(--dsw-alias-bg-layer-2, #fff); display:flex; flex-direction:column; }
.ddp .pcard.on { border-color:rgba(79,124,247,.42); }
.ddp .ptop { display:flex; align-items:center; gap:8px; margin-bottom:6px; flex-wrap:wrap; }
.ddp .ptile { width:30px; height:30px; border-radius:9px; display:flex; align-items:center; justify-content:center; flex:0 0 auto; }
.ddp .pname { font-weight:640; font-size:13.5px; }
.ddp .pd { font-size:12.5px; color:var(--dsw-alias-label-secondary, #5f6570); line-height:1.6; flex:1; }
.ddp .pform { display:flex; flex-direction:column; gap:6px; margin:8px 0 2px; }
.ddp .pfoot { display:flex; align-items:center; gap:8px; margin-top:9px; flex-wrap:wrap; }
.ddp .pst { font-size:12px; color:var(--dsw-alias-label-tertiary, #8a8f98); }
.ddp .pst.ok { color:#31a24c; }
.ddp .pbtns { margin-left:auto; display:flex; gap:6px; }
.ddp .bbtn { font-size:12px; border:1px solid var(--dsw-alias-border-l2, #d4d7dc); border-radius:8px; padding:4px 11px; background:transparent; color:inherit; cursor:pointer; font-family:inherit; }
.ddp .bbtn:hover { background:rgba(127,127,127,.10); }
.ddp .bbtn.pri { background:#4f7cf7; border-color:#4f7cf7; color:#fff; }
.ddp .bbtn.pri:hover { filter:brightness(1.08); }
.ddp .bbtn:disabled { opacity:.55; cursor:default; }
.ddp .msg { font-size:12.5px; margin:8px 0; padding:8px 10px; border-radius:9px; background:rgba(127,127,127,.09); }
.ddp .msg.ok { color:#31a24c; background:rgba(49,162,76,.10); }
.ddp .msg.err { color:#d9534f; background:rgba(217,83,79,.10); }
.ddp .ptag { font-size:11px; padding:1px 7px; border-radius:6px; background:rgba(127,127,127,.14); color:var(--dsw-alias-label-tertiary, #8a8f98); margin-left:auto; }
.ddp .pcard.plan { opacity:.68; }
.ddp .wxq-ov { position:fixed; inset:0; background:rgba(15,18,26,.45); display:flex; align-items:center; justify-content:center; z-index:60; }
.ddp .wxq-box { width:min(86vw,320px); background:var(--dsw-alias-bg-layer-2, #fff); border-radius:14px; padding:16px; box-shadow:0 12px 40px rgba(0,0,0,.22); display:flex; flex-direction:column; gap:8px; align-items:center; }
.ddp .wxq-hd { font-weight:600; font-size:14px; }
.ddp .wxq-sub { font-size:12px; color:var(--dsw-alias-text-3, #8a93a3); text-align:center; line-height:1.5; }
.ddp .wxq-qr { width:200px; height:200px; display:flex; align-items:center; justify-content:center; background:#fff; border-radius:10px; padding:6px; }
.ddp .wxq-qr svg { width:100%; height:100%; }
.ddp .wxq-msg { font-size:12.5px; text-align:center; }
.ddp .wxq-msg.err { color:#e05b5b; }
.ddp .wxq-msg.ok { color:#3ecf8e; font-weight:600; }
.ddp .pdl { font-size:12px; color:var(--dsw-alias-label-secondary, #5f6570); word-break:break-all; margin:4px 0 0; }
/* ── 「用量」顶栏轻提示（方案C）：平时很淡，点开小气泡；≥80% 变黄、≥100% 变红；手机端隐藏 ── */
.duc-wrap { position:relative; display:inline-flex; align-items:center; }
.duc { border:0; background:transparent; color:var(--dsw-alias-label-tertiary, #8a8f98); font-size:12px; cursor:pointer; padding:4px 9px; border-radius:8px; opacity:.72; transition:opacity .12s ease, background .12s ease; white-space:nowrap; }
.duc:hover { background:rgba(127,127,127,.12); opacity:1; }
.duc.warn { color:#b8860b; opacity:.95; }
.duc.bad { color:#d64545; opacity:1; }
.duc-pop { width:250px; background:var(--dsw-alias-bg-layer-2, #fff); border:1px solid var(--dsw-alias-border-l2, #d0d3d9); border-radius:12px; box-shadow:0 14px 34px rgba(16,24,40,.22); padding:12px 14px; z-index:9998; color:inherit; text-align:left; }
.duc-pop .big { font-size:19px; font-weight:700; }
.duc-pop .mut { font-size:11.5px; color:var(--dsw-alias-label-tertiary, #8a8f98); margin-top:2px; }
.duc-pop .bar { background:rgba(127,127,127,.18); border-radius:6px; height:7px; overflow:hidden; margin-top:7px; }
.duc-pop .bar i { display:block; height:100%; background:#4f7cf7; }
.duc-pop .go { margin-top:9px; color:var(--dsw-alias-state-business-primary, #4f7cf7); cursor:pointer; font-size:12.5px; }
/* 用量整页（方案A）内部小样式 */
.ddp .ug-big { font-size:26px; font-weight:700; }
.ddp .ug-mut { font-size:12.5px; color:var(--dsw-alias-label-tertiary, #8a8f98); margin-top:2px; }
.ddp .ug-bar { background:rgba(127,127,127,.18); border-radius:7px; height:9px; overflow:hidden; margin-top:6px; }
.ddp .ug-bar i { display:block; height:100%; background:#4f7cf7; }
.ddp .ug-row { display:flex; gap:12px; align-items:baseline; padding:5px 0; border-bottom:1px solid var(--dsw-alias-border-l2, #e8eaed); font-size:12.5px; }
@media (max-width: 820px) { .duc-wrap { display:none !important; } }
@media (max-width: 820px) {
  .ddp.fv { left:0; border-left:0; }
  .ddp.fv::before { display:none; }
  .ddp.fv .hd { padding:12px 16px 11px; }
  .ddp.fv .tabs { width:auto; margin:12px 0 0; }
  .ddp.fv .bd { padding:12px 16px calc(20px + env(safe-area-inset-bottom)); }
  .ddp.fv .hd .x { height:42px; padding:0 16px; border-radius:12px; font-size:14px; }
}
/* 侧栏底部动作区：壳默认为「横排不换行」，多个带文字入口会溢出被挤掉 —— 强制纵向堆叠成菜单 */
[class*="footerActions"] { flex-direction: column !important; align-items: stretch !important; gap: 2px !important; }
[class*="footerActions"] > div { width: 100%; }
/* 面板打开时临时移除侧边栏 backdrop-filter：它给 fixed 面板造成「包含块 + 层叠」双重陷阱（宽度被锁 + 被内容层盖住） */
body:has(.ddp) [class*="sidebarCol"] { backdrop-filter: none !important; -webkit-backdrop-filter: none !important; }
body.desk-panel-open [class*="sidebarCol"] { backdrop-filter: none !important; -webkit-backdrop-filter: none !important; }
/* 面板打开时释放侧边栏裁剪：dsh 侧边栏自带 overflow:hidden（+aqua 变换把 fixed 面板的包含块锁在侧边栏上），
   两者叠加会把 .ddp 面板裁成侧边栏宽度——右边框与右上角 ✕ 被切掉。打开期间临时放开。 */
body:has(.ddp) [class*="sidebarCol"] { overflow: visible !important; }
body.desk-panel-open [class*="sidebarCol"] { overflow: visible !important; }
/* 面板打开时同时压掉 aqua 的「光标追踪」matrix3d 变换：鼠标靠近/划过侧栏时倾斜角实时变化，
   fixed 面板的包含块被锁在侧栏上 → 面板跟着鼠标漂移/跳动。打开期间禁用（与上面两条同族）。 */
body:has(.ddp) [class*="sidebarCol"] { transform: none !important; }
body.desk-panel-open [class*="sidebarCol"] { transform: none !important; }

/* ── 移动端（≤820px）：四个侧栏面板改为「底部抽屉」形态（触控尺寸 ≥44px、字号 +1、安全区适配） ── */
@media (max-width: 820px) {
  .ddp { left:0; right:0; bottom:0; width:100%; max-width:none; max-height:86vh; border-radius:18px 18px 0 0; border-left:0; border-right:0; border-bottom:0; box-shadow:0 -14px 44px rgba(16,24,40,.28); }
  .ddp::before { content:""; display:block; width:40px; height:4px; border-radius:2px; background:rgba(127,127,127,.35); margin:8px auto 0; flex:0 0 auto; }
  .ddp .hd { padding:11px 16px 13px; }
  .ddp .hd .ico { width:38px; height:38px; border-radius:11px; font-size:19px; }
  .ddp .hd .t1 { font-size:16px; }
  .ddp .hd .t2 { font-size:12px; }
  .ddp .hd .x { width:42px; height:42px; border-radius:12px; font-size:17px; opacity:.85; }
  .ddp .bd { padding:6px 16px calc(18px + env(safe-area-inset-bottom)); -webkit-overflow-scrolling:touch; overscroll-behavior:contain; }
  .ddp .lb { font-size:12px; margin:14px 0 4px; }
  .ddp .it { padding:12px 10px; }
  .ddp .it .ico2 { width:30px; height:30px; border-radius:9px; font-size:15px; }
  .ddp .t { font-size:14.5px; }
  .ddp .d { font-size:13px; }
  .ddp .bd2 { font-size:13.5px; }
  .ddp .tabs .tb { padding:10px 8px; font-size:13.5px; }
  .ddp .inp { height:44px; font-size:15px; }
  .ddp .inp.ta { min-height:88px; }
  .ddp .btn { height:auto; min-height:44px; padding:0 18px; font-size:14.5px; }
  .ddp .btn.gh { min-height:44px; }
  .ddp .mini { min-height:36px; font-size:12.5px; padding:0 12px; border-radius:9px; }
  .ddp .ft { font-size:12.5px; }
  .ddp .msg, .ddp .empty { font-size:13px; }
  .ddp .code { font-size:12.5px; }
  /* 关闭操作强化：✕ 更醒目、整屏轻压暗（点空白处关闭，见注入脚本） */
  .ddp .hd { position:relative; z-index:2; }
  .ddp .hd .x { width:44px; height:44px; font-size:19px; opacity:1; background:rgba(127,127,127,.16); border-radius:12px; touch-action:manipulation; }
  .ddp .hd .x:active { background:rgba(127,127,127,.32); }
  .ddp::after { content:""; position:fixed; left:0; top:0; right:0; bottom:0; background:rgba(6,10,14,.34); pointer-events:none; z-index:-1; }
}

/* —— 自动化面板（v2：卡片列表/快捷动作/表单/记录） —— */
.ddp .astats { display:grid; grid-template-columns:repeat(4, 1fr); gap:8px; margin:10px 0 4px; }
.ddp .astat { border:1px solid var(--dsw-alias-border-l2, #e4e6eb); border-radius:11px; padding:9px 11px; background:var(--dsw-alias-bg-layer-2, #fff); min-width:0; }
.ddp .astat b { display:block; font-size:14.5px; font-weight:680; line-height:1.35; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
.ddp .astat span { font-size:11px; color:var(--dsw-alias-label-tertiary, #8a8f98); }
.ddp .achips { display:flex; gap:6px; flex-wrap:wrap; margin:8px 0 2px; }
.ddp .achip { border:1px solid var(--dsw-alias-border-l2, #d4d7dc); background:transparent; color:var(--dsw-alias-label-secondary, #5f6570); border-radius:999px; padding:4px 12px; font-size:12px; cursor:pointer; font-family:inherit; }
.ddp .achip.on { background:rgba(79,124,247,.13); border-color:rgba(79,124,247,.5); color:#4f7cf7; font-weight:600; }
.ddp .acard { display:flex; gap:10px; border:1px solid var(--dsw-alias-border-l2, #e4e6eb); border-radius:12px; padding:11px 12px; background:var(--dsw-alias-bg-layer-2, #fff); margin-top:8px; }
.ddp .acard.off { opacity:.62; }
.ddp .acard .atile { width:32px; height:32px; border-radius:9px; display:flex; align-items:center; justify-content:center; background:var(--dsw-alias-bg-base, #f2f3f5); color:#4f7cf7; flex:0 0 auto; }
.ddp .acard.rule .atile { color:#e8a33d; }
.ddp .acard .am { flex:1; min-width:0; }
.ddp .acard .an { font-weight:640; font-size:13.5px; }
.ddp .acard .ad { font-size:12.5px; color:var(--dsw-alias-label-secondary, #5f6570); margin-top:4px; line-height:1.6; }
.ddp .acard .ameta { font-size:11.5px; color:var(--dsw-alias-label-tertiary, #8a8f98); margin-top:6px; display:flex; gap:8px; flex-wrap:wrap; align-items:center; }
.ddp .acard .ameta .dot { margin-top:0; }
.ddp .acard .ar { display:flex; flex-direction:column; align-items:flex-end; gap:7px; flex:0 0 auto; }
.ddp .acard .abtns { display:flex; gap:5px; }
.ddp .achip2 { font-size:11px; border-radius:999px; padding:2px 8px; background:rgba(127,127,127,.10); color:var(--dsw-alias-label-secondary, #5f6570); }
.ddp .achip2.blue { background:rgba(79,124,247,.12); color:#4f7cf7; }
.ddp .achip2.amber { background:rgba(232,163,61,.16); color:#b57a12; }
.ddp .atg { width:40px; height:22px; border-radius:999px; border:1px solid var(--dsw-alias-border-l2, #d4d7dc); background:rgba(127,127,127,.14); position:relative; cursor:pointer; flex:0 0 auto; padding:0; transition:background .16s; }
.ddp .atg::after { content:""; position:absolute; top:2px; left:2px; width:16px; height:16px; border-radius:50%; background:#fff; box-shadow:0 1px 2px rgba(0,0,0,.25); transition:left .16s; }
.ddp .atg.on { background:#4f7cf7; border-color:#4f7cf7; }
.ddp .atg.on::after { left:20px; }
.ddp .aqs { display:grid; grid-template-columns:repeat(2, 1fr); gap:8px; margin-top:8px; }
.ddp .aq { display:flex; gap:9px; align-items:center; text-align:left; border:1px solid var(--dsw-alias-border-l2, #e4e6eb); border-radius:11px; background:var(--dsw-alias-bg-layer-2, #fff); padding:9px 11px; cursor:pointer; font-family:inherit; color:inherit; }
.ddp .aq:hover { border-color:rgba(79,124,247,.45); }
.ddp .aq .atile { width:30px; height:30px; border-radius:8px; background:var(--dsw-alias-bg-base, #f2f3f5); display:flex; align-items:center; justify-content:center; color:#4f7cf7; flex:0 0 auto; }
.ddp .aq .t { font-size:13px; font-weight:620; }
.ddp .aq .d2 { font-size:11.5px; color:var(--dsw-alias-label-tertiary, #8a8f98); margin-top:2px; }
.ddp .aform { border:1px solid var(--dsw-alias-border-l2, #e4e6eb); border-radius:12px; background:var(--dsw-alias-bg-layer-2, #fff); padding:12px 13px; margin-top:8px; }
.ddp .aform .row { margin-top:8px; }
.ddp .alogs { border:1px solid var(--dsw-alias-border-l2, #e4e6eb); border-radius:12px; background:var(--dsw-alias-bg-layer-2, #fff); padding:4px 12px; margin-top:8px; }
.ddp .alog { display:flex; align-items:center; gap:8px; padding:8px 0; border-bottom:1px solid var(--dsw-alias-border-l2, #eceef1); font-size:12.5px; flex-wrap:wrap; }
.ddp .alog:last-child { border-bottom:0; }
.ddp .alog .dot { margin-top:0; }
.ddp .alog .nm { font-weight:600; }
.ddp .alog .inf { color:var(--dsw-alias-label-secondary, #5f6570); }
.ddp .alog .tm { color:var(--dsw-alias-label-tertiary, #8a8f98); font-size:11.5px; margin-left:auto; }
.ddp select.inp { padding:0 6px; }
@media (max-width: 820px) {
  .ddp .astats { grid-template-columns:repeat(2, 1fr); }
  .ddp .aqs { grid-template-columns:1fr; }
  .ddp .acard { flex-wrap:wrap; }
  .ddp .acard .ar { flex-direction:row; width:100%; align-items:center; justify-content:space-between; }
  .ddp .atg { width:46px; height:26px; }
  .ddp .atg::after { width:20px; height:20px; }
  .ddp .atg.on::after { left:22px; }
}

/* —— 去掉品牌鲸鱼（侧栏品牌位/轨道休止位 + 新会话 Hero 标题旁）—— */
[class*="brandMark"] { display: none !important; }
[class*="railMark"] { display: none !important; }
[class*="fishHitbox"] { display: none !important; }
/* 轨道态原为「休止=鲸鱼、悬停=面板图标」；鲸鱼移除后面板图标改为常显 */
[class*="collapsed"] [class*="panelIcon"] { display: inline !important; }
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

    (function () {
      // 移动端：点面板外任意处 = 关闭（底部抽屉的标准手势；桌面端不启用，避免影响原有交互）
      try {
        document.addEventListener("click", function (ev) {
          try {
            if (!window.matchMedia || !window.matchMedia("(max-width:820px)").matches) return;
            var t = ev.target;
            if (!t || !t.closest) return;
            if (t.closest(".ddp") || t.closest(".ddb")) return;
            var all = document.querySelectorAll(".ddp"), vis = null, i, r;
            for (i = 0; i < all.length; i++) {
              r = all[i].getBoundingClientRect();
              if (r.width > 0 && r.height > 0) vis = all[i];
            }
            if (!vis) return;
            var x = vis.querySelector(".hd .x");
            if (x) { x.click(); ev.stopPropagation(); ev.preventDefault(); }
          } catch (e) { /* 忽略 */ }
        }, true);
      } catch (e) { /* 忽略 */ }
    })();

    (function () {
      // 兜底（不依赖 :has 的浏览器）：面板打开时给 body 挂 desk-panel-open——
      // 老内核里侧栏 backdrop-filter 会把 fixed 面板的包含块锁成窄条（面板被挤成竖条）
      try {
        var apply = function () {
          try {
            var has = document.querySelector(".ddp") !== null;
            if (has !== document.body.classList.contains("desk-panel-open")) {
              document.body.classList.toggle("desk-panel-open", has);
            }
          } catch (e) {}
        };
        var start = function () {
          try { new MutationObserver(apply).observe(document.body, { childList: true, subtree: true }); apply(); } catch (e) {}
        };
        if (document.body) start(); else document.addEventListener("DOMContentLoaded", start);
      } catch (e) {}
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

      function load(quiet) {
        if (!quiet) setData({ phase: "loading", members: [], channels: [], message: "" });
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
            h("div", null, tr("admin.newKeyShown") + keyInfo.username + tr("admin.newKeyTail")),
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
            h("option", { value: "whatsapp" }, tr("notify.kindWhatsapp")),
            h("option", { value: "feishu" }, tr("notify.kindFeishu")),
            h("option", { value: "dingtalk" }, tr("notify.kindDingtalk")),
            h("option", { value: "wecom" }, tr("notify.kindWecom")),
            h("option", { value: "discord" }, tr("notify.kindDiscord")),
            h("option", { value: "slack" }, tr("notify.kindSlack")),
            h("option", { value: "teams" }, tr("notify.kindTeams")),
            h("option", { value: "ntfy" }, tr("notify.kindNtfy")),
            h("option", { value: "zoom" }, tr("notify.kindZoom"))
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
                    : kind === "whatsapp"
                      ? tr("notify.phWhatsapp")
                      : kind === "feishu"
                        ? tr("notify.phFeishu")
                        : kind === "dingtalk"
                          ? tr("notify.phDingtalk")
                          : kind === "wecom"
                            ? tr("notify.phWecom")
                            : kind === "discord"
                              ? tr("notify.phDiscord")
                              : kind === "slack"
                                ? tr("notify.phSlack")
                                : kind === "teams"
                                  ? tr("notify.phTeams")
                                  : kind === "ntfy"
                                    ? tr("notify.phNtfy")
                                    : kind === "zoom"
                                      ? tr("notify.phZoom")
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
          var trow = testRes.results[k];
          trNodes.push(
            h(
              "div",
              { key: "tr" + k, style: { fontSize: 12, color: trow.ok ? undefined : "#c0392b" } },
              (trow.ok ? "✓ " : "✗ ") + trow.route + ": " + trow.info
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

    /* ═══ 整页视图（FullView）总线：五个侧栏入口共用（互斥打开 / 点外关闭 / Esc / 左对齐侧栏） ═══ */
    var FV_SEQ = 0;
    var _fvObs = null;
    var _fvObsEl = null;
    function fvMeasure() {
      var left = 0;
      try {
        if (!(window.matchMedia && window.matchMedia("(max-width: 820px)").matches)) {
          var sc = document.querySelector('[class*="sidebarCol"]');
          if (sc) {
            var r = sc.getBoundingClientRect();
            if (r && r.right > 40 && r.right < window.innerWidth * 0.6) left = Math.round(r.right);
          }
        }
      } catch (e) { /* 忽略 */ }
      try { document.documentElement.style.setProperty("--desk-fv-left", left + "px"); } catch (e) { /* 忽略 */ }
      try {
        var sc2 = document.querySelector('[class*="sidebarCol"]');
        if (sc2 && sc2 !== _fvObsEl && window.ResizeObserver) {
          if (_fvObs) _fvObs.disconnect();
          _fvObs = new ResizeObserver(function () { fvMeasure(); });
          _fvObsEl = sc2;
          _fvObs.observe(sc2);
        }
      } catch (e) { /* 忽略 */ }
    }
    function fvNotify(id) {
      try { window.dispatchEvent(new CustomEvent("desk-fv", { detail: { id: id } })); } catch (e) { /* 忽略 */ }
    }
    function useFvSync(open, setOpen) {
      var idRef = React.useRef(null);
      if (!idRef.current) idRef.current = "fv" + (++FV_SEQ);
      React.useEffect(function () {
        if (open) { fvMeasure(); fvNotify(idRef.current); }
      }, [open]);
      React.useEffect(function () {
        function onFv(e) {
          var who = e && e.detail ? e.detail.id : null;
          if (who !== idRef.current) setOpen(function (p) { return p ? false : p; });
        }
        window.addEventListener("desk-fv", onFv);
        return function () { window.removeEventListener("desk-fv", onFv); };
      }, []);
      return idRef.current;
    }
    (function () {
      try {
        window.addEventListener("resize", fvMeasure);
        document.addEventListener("keydown", function (e) {
          if (e.key === "Escape" && document.querySelector(".ddp.fv")) fvNotify(null);
        }, true);
        document.addEventListener("pointerdown", function (e) {
          try {
            if (!document.querySelector(".ddp.fv")) return;
            var t = e.target;
            if (t && t.closest && (t.closest(".ddp.fv") || t.closest(".ddb"))) return;
            fvNotify(null);
          } catch (err) { /* 忽略 */ }
        }, true);
        fvMeasure();
      } catch (e) { /* 忽略 */ }
    })();

    /* ═══ 「用量」方案A（侧栏整页）+ 方案C（会话顶栏轻提示）═══ */
    function UsagePanel(props) {
      var wide = !!(props && props.wide);
      var openPair = React.useState(false);
      var open = openPair[0];
      var setOpen = openPair[1];
      useFvSync(open, setOpen);
      var dataPair = React.useState({ phase: "loading", team: null });
      var data = dataPair[0];
      var setData = dataPair[1];

      function load() {
        fetch("/portal/api/usage", { headers: { accept: "application/json" } })
          .then(function (r) {
            if (!r.ok) throw new Error("HTTP " + r.status);
            return r.json();
          })
          .then(function (d) {
            setData({ phase: "ready", data: d, team: null });
            fetch("/portal/api/admin/overview", { headers: { accept: "application/json" } })
              .then(function (r2) { return r2.ok ? r2.json() : null; })
              .then(function (ov) {
                if (!ov || !ov.trend || !ov.trend.length) return;
                var total7 = 0;
                for (var i = 0; i < ov.trend.length; i++) total7 += ov.trend[i].s;
                setData(function (p2) {
                  return p2.phase === "ready" ? { phase: "ready", data: p2.data, team: { total7: total7 } } : p2;
                });
              })
              .catch(function () { /* 非管理员或不可用：隐藏团队块 */ });
          })
          .catch(function () {
            setData({ phase: "error", team: null });
          });
      }
      React.useEffect(function () {
        load();
      }, []);
      React.useEffect(function () {
        function onOpen(e) {
          try {
            if (e && e.detail && e.detail.id === "desk-usage") {
              setOpen(true);
              load();
            }
          } catch (x) { /* 忽略 */ }
        }
        window.addEventListener("desk-open", onOpen);
        return function () { window.removeEventListener("desk-open", onOpen); };
      }, []);

      function toggle() {
        var next = !open;
        setOpen(next);
        if (next) load();
      }

      var trigger = h(
        "button",
        { className: "ddb" + (wide ? "" : " rail") + (open ? " on" : ""), onClick: toggle, title: tr("usg.title") },
        h("span", { className: "ic" }, dicon("chart", 15)),
        wide ? h("span", { className: "lbl" }, tr("usg.tab")) : null
      );
      if (!open) return h("div", null, trigger);

      var kids = [];
      if (data.phase === "loading") kids.push(h("div", { key: "ld", className: "empty" }, tr("usage.loading")));
      if (data.phase === "error") kids.push(h("div", { key: "er", className: "empty" }, tr("usage.portalHint")));
      if (data.phase === "ready") {
        var d = data.data;
        var pct = d.budget != null ? Math.min(100, (d.month.cost / d.budget) * 100) : null;
        kids.push(h("div", { key: "m" },
          h("div", { className: "ug-big" }, fmt(d.month.cost)),
          h("div", { className: "ug-mut" }, tr("usage.monthPrefix") + d.month.events + tr("usage.mid") + d.month.miss + tr("usage.outMid") + d.month.out + " tokens")
        ));
        kids.push(h("div", { key: "t", className: "ug-mut" }, tr("usage.todayPrefix") + fmt(d.day.cost) + " · " + d.day.events + tr("usage.reqSuffix")));
        if (pct != null) {
          kids.push(h("div", { key: "b" },
            h("div", { className: "ug-mut" }, tr("usage.budgetPrefix") + d.budget + " · " + (d.month.cost >= d.budget ? tr("usage.overLimit") : tr("usage.remainingPrefix") + (d.budget - d.month.cost).toFixed(4))),
            h("div", { className: "ug-bar" }, h("i", { style: { width: pct.toFixed(1) + "%" } }))
          ));
        }
        kids.push(h("div", { key: "rlb", className: "lb" }, tr("usg.recent")));
        var rowsN = [];
        var rec = d.recent || [];
        for (var ri = 0; ri < rec.length; ri++) {
          rowsN.push(h("div", { key: "r" + ri, className: "ug-row" },
            h("span", { className: "ug-mut", style: { marginTop: 0 } }, rec[ri].time),
            h("span", null, rec[ri].model + (rec[ri].channel ? " @" + rec[ri].channel : "")),
            h("span", { style: { marginLeft: "auto" } }, fmt(rec[ri].cost))
          ));
        }
        kids.push(h("div", { key: "rows" }, rowsN.length ? rowsN : h("div", { className: "empty" }, tr("usg.none"))));
        if (data.team) kids.push(h("div", { key: "tm", className: "ft" }, tr("admin.teamUsage7d") + fmt(data.team.total7)));
        kids.push(h("div", { key: "ft", className: "ft" },
          h("a", { href: "/portal/me", target: "_blank", style: { color: "var(--dsw-alias-state-business-primary, #4f7cf7)" } }, tr("usage.openPortal")),
          " · ",
          h("form", { method: "post", action: "/logout", style: { display: "inline", margin: 0 } },
            h("button", { style: { border: 0, background: "none", color: "#c0392b", cursor: "pointer", fontSize: "inherit", padding: 0 } }, tr("usg.signout")))
        ));
      }

      return h("div", null,
        trigger,
        h("div", { key: "panel", className: "ddp fv" },
          h("div", { className: "hd" },
            h("span", { className: "ico" }, dicon("chart", 18)),
            h("div", null, h("div", { className: "t1" }, tr("usg.title")), h("div", { className: "t2" }, tr("usg.sub"))),
            h("button", { className: "x", onClick: toggle }, tr("fv.back"))
          ),
          h("div", { className: "bd" }, kids)
        )
      );
    }

    function UsageChip() {
      var stPair = React.useState({ phase: "loading" });
      var st = stPair[0];
      var setSt = stPair[1];
      var popPair = React.useState(null);
      var pop = popPair[0];
      var setPop = popPair[1];
      var wrapRef = React.useRef(null);

      function load() {
        fetch("/portal/api/usage", { headers: { accept: "application/json" } })
          .then(function (r) {
            if (!r.ok) throw new Error("HTTP " + r.status);
            return r.json();
          })
          .then(function (d) { setSt({ phase: "ready", data: d }); })
          .catch(function () { setSt({ phase: "error" }); });
      }
      React.useEffect(function () {
        load();
        var iv = setInterval(load, 180000);
        return function () { clearInterval(iv); };
      }, []);
      React.useEffect(function () {
        if (!pop) return;
        function onDoc(e) {
          try {
            if (wrapRef.current && e && e.target && wrapRef.current.contains(e.target)) return;
            setPop(null);
          } catch (x) { setPop(null); }
        }
        document.addEventListener("pointerdown", onDoc, true);
        return function () { document.removeEventListener("pointerdown", onDoc, true); };
      }, [pop]);

      if (st.phase !== "ready") return null;
      var d = st.data;
      var pct = d.budget != null ? Math.min(100, (d.month.cost / d.budget) * 100) : null;
      var cls = "duc" + (pct != null && pct >= 100 ? " bad" : pct != null && pct >= 80 ? " warn" : "");

      function togglePop() {
        if (pop) { setPop(null); return; }
        var pos = { top: 52, right: 12 };
        try {
          var r = wrapRef.current ? wrapRef.current.getBoundingClientRect() : null;
          if (r && r.bottom) pos = { top: Math.round(r.bottom + 8), right: Math.max(8, Math.round(window.innerWidth - r.right)) };
        } catch (x) { /* 忽略 */ }
        setPop(pos);
      }

      var popup = pop
        ? h("div", { className: "duc-pop", style: { position: "fixed", top: pop.top, right: pop.right } },
            h("div", { className: "big" }, fmt(d.month.cost)),
            h("div", { className: "mut" }, tr("usage.monthPrefix") + d.month.events + tr("usage.reqSuffix") + (pct != null ? " · " + tr("usage.budgetPrefix") + Math.round(pct) + "%" : "")),
            pct != null ? h("div", { className: "bar" }, h("i", { style: { width: pct.toFixed(1) + "%" } })) : null,
            h("div", { className: "mut" }, tr("usage.todayPrefix") + fmt(d.day.cost) + " · " + d.day.events + tr("usage.reqSuffix")),
            h("div", { className: "go", onClick: function () { setPop(null); try { window.dispatchEvent(new CustomEvent("desk-open", { detail: { id: "desk-usage" } })); } catch (x) { /* 忽略 */ } } }, tr("usg.details"))
          )
        : null;

      return h("span", { className: "duc-wrap", ref: wrapRef },
        h("button", { className: cls, onClick: togglePop, title: tr("usg.chipTip") }, tr("usg.chipPfx") + fmt(d.month.cost) + (pct != null ? " · " + Math.round(pct) + "%" : "")),
        popup
      );
    }

    /* ═══ 侧栏入口线性图标（统一 24×24 描边风格，stroke=currentColor） ═══ */
    var DESK_ICONS = {
      hub: ["M20 20a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.69-.9L9.6 3.9A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2Z"],
      announce: ["m3 11 18-5v12L3 14v-3z", "M11.6 16.8a3 3 0 1 1-5.8-1.6"],
      assist: ["rect|4,8,16,12,2", "M12 8V4H8", "M2 14h2", "M20 14h2", "M15 13v2", "M9 13v2"],
      skills: ["M12 22v-5", "M9 8V2", "M15 8V2", "M18 8v5a4 4 0 0 1-4 4h-4a4 4 0 0 1-4-4V8Z"],
      auto: ["circle|12,12,10", "M12 6v6l4 2"],
      search: ["circle|11,11,8", "m21 21-4.3-4.3"],
      pen: ["M12 20h9", "M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"],
      table: ["rect|3,3,18,18,2", "M3 9h18", "M9 3v18"],
      code: ["m16 18 6-6-6-6", "m8 6-6 6 6 6"],
      clipboard: ["rect|8,2,8,4,1", "M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2", "m9 14 2 2 4-4"],
      package: ["m7.5 4.27 9 5.15", "M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z", "m3.3 7 8.7 5 8.7-5", "M12 22V12"],
      terminal: ["m4 17 6-6-6-6", "M12 19h8"],
      braces: ["M8 3H7a2 2 0 0 0-2 2v5a2 2 0 0 1-2 2 2 2 0 0 1 2 2v5a2 2 0 0 0 2 2h1", "M16 3h1a2 2 0 0 1 2 2v5a2 2 0 0 0 2 2 2 2 0 0 0-2 2v5a2 2 0 0 1-2 2h-1"],
      sparkle: ["M12 3l1.9 5.8a2 2 0 0 0 1.3 1.3L21 12l-5.8 1.9a2 2 0 0 0-1.3 1.3L12 21l-1.9-5.8a2 2 0 0 0-1.3-1.3L3 12l5.8-1.9a2 2 0 0 0 1.3-1.3Z"],
      send: ["m22 2-7 20-4-9-9-4Z", "M22 2 11 13"],
      bubble: ["M7.9 20A9 9 0 1 0 4 16.1L2 22Z"],
      msq: ["M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"],
      bell: ["M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9", "M10.3 21a1.94 1.94 0 0 0 3.4 0"],
      pin: ["M12 17v5", "M9 10.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24V16a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.76V6h1a2 2 0 0 0 0-4H8a2 2 0 0 0 0 4h1z"],
      video: ["rect|2,7,20,11,2", "M22 9.5 17 13l5 3.5z"],
      music: ["M9 18V5l12-2v13", "circle|6,18,3", "circle|18,16,3"],
      doc: ["M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z", "M14 2v4a2 2 0 0 0 2 2h4"],
      hash: ["M4 9h16", "M4 15h16", "M10 3 8 21", "M16 3l-2 18"],
      gamepad: ["M6 12h4", "M8 10v4", "M15 11h.01", "M18 11h.01", "M17.32 5H6.68a4 4 0 0 0-3.978 3.59c-.006.052-.01.101-.017.152C2.604 9.416 2 14.456 2 16a3 3 0 0 0 3 3c1 0 1.5-.5 2-1l1.414-1.414A2 2 0 0 1 9.828 16h4.344a2 2 0 0 1 1.414.586L17 18c.5.5 1 1 2 1a3 3 0 0 0 3-3c0-1.545-.604-6.584-.685-7.258-.007-.05-.011-.1-.017-.151A4 4 0 0 0 17.32 5z"],
      grid: ["rect|3,3,7,7,1", "rect|14,3,7,7,1", "rect|3,14,7,7,1", "rect|14,14,7,7,1"],
      phone: ["M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"],
      link: ["M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71", "M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"],
      briefcase: ["M16 20V4a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16", "rect|2,6,20,14,2"],
      clock: ["circle|12,12,9", "M12 7v5l3 2"],
      zap: ["M13 2 4 14h6l-1 8 9-12h-6l1-8z"],
      play: ["M7 4.2 19 12 7 19.8Z"],
      trash: ["M4 7h16", "M9.5 7V5a1 1 0 0 1 1-1h3a1 1 0 0 1 1 1v2", "M6.5 7l1 13h9l1-13"],
      plus: ["M12 5v14", "M5 12h14"],
      chart: ["M3 3v18h18", "M7 14l4-4 3 3 5-6"],
    };
    function dicon(name, size) {
      var list = DESK_ICONS[name] || [];
      var kids = [];
      for (var i = 0; i < list.length; i++) {
        var d = list[i];
        if (d.indexOf("rect|") === 0) {
          var p = d.slice(5).split(",");
          kids.push(h("rect", { key: i, x: Number(p[0]), y: Number(p[1]), width: Number(p[2]), height: Number(p[3]), rx: Number(p[4] || 0) }));
        } else if (d.indexOf("circle|") === 0) {
          var c = d.slice(7).split(",");
          kids.push(h("circle", { key: i, cx: Number(c[0]), cy: Number(c[1]), r: Number(c[2]) }));
        } else {
          kids.push(h("path", { key: i, d: d }));
        }
      }
      return h("svg", { viewBox: "0 0 24 24", width: size, height: size, fill: "none", stroke: "currentColor", strokeWidth: 1.8, strokeLinecap: "round", strokeLinejoin: "round", "aria-hidden": "true" }, kids);
    }
    var ROLE_ICON = {
      "team-assistant": "assist", "research-assistant": "search", "doc-writer": "pen",
      "data-organizer": "table", "dev-partner": "code", "meeting-secretary": "clipboard",
      standard: "package", minimal: "terminal", ptc: "braces", cordis: "sparkle",
    };
    function roleIcon(id) { return ROLE_ICON[id] || "assist"; }
    var PLAT_META = {
      "wx-mine": { i: "bubble", c: "#07c160" },
      telegram: { i: "send", c: "#5cc8f7" },
      feishu: { i: "msq", c: "#7fa3ff" },
      dingtalk: { i: "pin", c: "#5db4ff" },
      wecom: { i: "briefcase", c: "#79aaff" },
      discord: { i: "gamepad", c: "#8b95ff" },
      slack: { i: "hash", c: "#d99fdb" },
      teams: { i: "grid", c: "#9b9dd8" },
      whatsapp: { i: "phone", c: "#5fe08f" },
      ntfy: { i: "bell", c: "#e8b44a" },
      webhook: { i: "link", c: "#aeb7c6" },
      "meeting-tencent": { i: "video", c: "#3a9bff" },
      zoom: { i: "video", c: "#6aa8ff" },
      github: { i: "code", c: "#aab4c0" },
      notion: { i: "msq", c: "#c8ccd4" },
    };

    function TeamHub(props) {
      var wide = !!(props && props.wide);
      var openPair = React.useState(false);
      var open = openPair[0];
      var setOpen = openPair[1];
      useFvSync(open, setOpen);
      var tabPair = React.useState("files");
      var tab = tabPair[0];
      var setTab = tabPair[1];

      var fPair = React.useState({ phase: "loading", path: "", entries: [], message: "", menuFor: "", pick: null, newFolder: false });
      var fs = fPair[0];
      var setFs = fPair[1];
      var fileRef = React.useRef(null);
      var nfRef = React.useRef(null);

      function fset(patch) {
        setFs(function (prev) { var n = {}; for (var k in prev) n[k] = prev[k]; for (var k2 in patch) n[k2] = patch[k2]; return n; });
      }
      function fload(path) {
        var p = String(path == null ? "" : path);
        fset({ phase: "loading", path: p, entries: [], message: "", menuFor: "", pick: null, newFolder: false });
        fetch("/portal/api/drive/list?path=" + encodeURIComponent(p), { headers: { accept: "application/json" } })
          .then(function (r) { if (!r.ok) throw new Error("HTTP " + r.status); return r.json(); })
          .then(function (d) { fset({ phase: "ready", path: d.path != null ? d.path : p, entries: d.entries || [], message: "" }); })
          .catch(function (e) { fset({ phase: "error", message: String((e && e.message) || e) }); });
      }
      function fpost(url, body, tk) {
        return fetch(url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) })
          .then(function (r) { return r.json().then(function (d) { return { s: r.status, d: d }; }); });
      }
      function fupload(files) {
        var f = files && files[0];
        if (!f) return;
        fset({ message: tr("th.uploading") + f.name + " …" });
        fetch("/portal/api/drive/upload?path=" + encodeURIComponent(fs.path) + "&name=" + encodeURIComponent(f.name), { method: "POST", body: f })
          .then(function (r) { if (!r.ok) throw new Error("HTTP " + r.status); return r.json(); })
          .then(function () { fload(fs.path); })
          .catch(function (e) { fset({ message: tr("th.uploadFail") + String((e && e.message) || e) }); });
      }
      function fmkdir() {
        var el = nfRef.current;
        var name = el ? String(el.value || "").trim() : "";
        if (!name) { if (el) el.focus(); return; }
        fpost("/portal/api/drive/mkdir", { path: fs.path, name: name }).then(function (res) {
          if (res.s !== 200) throw new Error((res.d && res.d.error) || "HTTP " + res.s);
          fload(fs.path);
        }).catch(function (e) { fset({ message: String((e && e.message) || e) }); });
      }
      function frm(path, isDir) {
        var label = isDir ? tr("th.confirmDelFolder") : tr("th.confirmDelFile");
        if (!window.confirm(label + path.split("/").pop() + tr("th.confirmDelTail"))) return;
        fpost("/portal/api/drive/rm", { path: path }).then(function (res) {
          if (res.s !== 200) throw new Error((res.d && res.d.error) || "HTTP " + res.s);
          fload(fs.path);
        }).catch(function (e) { fset({ message: String((e && e.message) || e) }); });
      }
      function fpick(name) {
        fset({ pick: { name: name, path: "", entries: [] }, menuFor: "" });
        fetch("/portal/api/drive/list?path=", { headers: { accept: "application/json" } })
          .then(function (r) { return r.json(); })
          .then(function (d) { fset({ pick: { name: name, path: d.path != null ? d.path : "", entries: d.entries || [] } }); })
          .catch(function () { });
      }
      function fpickGo(path) {
        fetch("/portal/api/drive/list?path=" + encodeURIComponent(path), { headers: { accept: "application/json" } })
          .then(function (r) { return r.json(); })
          .then(function (d) { fset({ pick: { name: fs.pick ? fs.pick.name : "", path: d.path != null ? d.path : path, entries: d.entries || [] } }); })
          .catch(function () { });
      }
      function fmove(to) {
        var name = fs.pick ? fs.pick.name : "";
        var from = fs.path ? fs.path + "/" + name : name;
        fpost("/portal/api/drive/mv", { from: from, to: to }).then(function (res) {
          if (res.s !== 200) throw new Error((res.d && res.d.error) || "HTTP " + res.s);
          fload(fs.path);
        }).catch(function (e) { fset({ message: String((e && e.message) || e) }); });
      }

      var nPair = React.useState({ phase: "loading", role: "member", notes: [], q: "", hits: [], message: "", expanded: "", content: "", composing: false });
      var ns = nPair[0];
      var setNs = nPair[1];
      var qRef = React.useRef(null);
      var ntRef = React.useRef(null);
      var nbRef = React.useRef(null);
      function nset(patch) {
        setNs(function (prev) { var n = {}; for (var k in prev) n[k] = prev[k]; for (var k2 in patch) n[k2] = patch[k2]; return n; });
      }
      function nload() {
        fetch("/portal/api/kb/list", { headers: { accept: "application/json" } })
          .then(function (r) { if (!r.ok) throw new Error("HTTP " + r.status); return r.json(); })
          .then(function (d) { nset({ phase: "ready", role: d.role || "member", notes: d.notes || [], message: "" }); })
          .catch(function (e) { nset({ phase: "error", message: String((e && e.message) || e) }); });
      }
      function nsearch() {
        var q = qRef.current ? String(qRef.current.value || "").trim() : "";
        if (!q) { nset({ q: "", hits: [] }); return; }
        fetch("/portal/api/kb/search?q=" + encodeURIComponent(q))
          .then(function (r) { if (!r.ok) throw new Error("HTTP " + r.status); return r.json(); })
          .then(function (d) { nset({ q: q, hits: d.hits || [], message: "" }); })
          .catch(function (e) { nset({ message: String((e && e.message) || e) }); });
      }
      function nopen(name) {
        if (ns.expanded === name) { nset({ expanded: "", content: "" }); return; }
        nset({ expanded: name, content: tr("common.loading") });
        fetch("/portal/api/kb/note?name=" + encodeURIComponent(name), { headers: { accept: "application/json" } })
          .then(function (r) { return r.json(); })
          .then(function (d) { nset({ expanded: name, content: d.ok ? d.content : (d.error || tr("common.loadFailed")) }); })
          .catch(function (e) { nset({ expanded: name, content: String((e && e.message) || e) }); });
      }
      function ndel(name) {
        if (!window.confirm(tr("kb.delNote") + name + "?")) return;
        fetch("/portal/api/kb/rm?lang=" + deskLang(), { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ name: name }) })
          .then(function (r) { return r.json().then(function (d) { return { s: r.status, d: d }; }); })
          .then(function (res) {
            if (res.s !== 200) throw new Error((res.d && res.d.error) || "HTTP " + res.s);
            nset({ expanded: "", content: "" });
            nload();
          })
          .catch(function (e) { nset({ message: String((e && e.message) || e) }); });
      }
      function nsave() {
        var title = ntRef.current ? String(ntRef.current.value || "").trim() : "";
        var body = nbRef.current ? String(nbRef.current.value || "").trim() : "";
        if (!body) { if (nbRef.current) nbRef.current.focus(); return; }
        if (!title) title = body.split("\n")[0].slice(0, 36);
        fetch("/portal/api/kb/save?lang=" + deskLang(), { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ title: title, tags: "", content: body }) })
          .then(function (r) { return r.json().then(function (d) { return { s: r.status, d: d }; }); })
          .then(function (res) {
            if (res.s !== 200) throw new Error((res.d && res.d.error) || "HTTP " + res.s);
            if (ntRef.current) ntRef.current.value = "";
            if (nbRef.current) nbRef.current.value = "";
            nset({ composing: false, message: tr("th.noteSaved"), q: "", hits: [] });
            nload();
          })
          .catch(function (e) { nset({ message: String((e && e.message) || e) }); });
      }
      React.useEffect(function () {
        if (open) { fload(""); nload(); }
      }, [open]);

      function toggle() {
        var next = !open;
        setOpen(next);
      }
      function hfileEmoji(name) {
        var ext = String(name).split(".").pop().toLowerCase();
        if (ext === "xlsx" || ext === "xls" || ext === "csv") return "📊";
        if (ext === "pdf") return "📕";
        if (ext === "png" || ext === "jpg" || ext === "jpeg" || ext === "gif" || ext === "webp") return "🖼";
        if (ext === "zip" || ext === "7z" || ext === "rar" || ext === "tar" || ext === "gz") return "🗜";
        return "📄";
      }

      var trigger = h("button", { className: "ddb" + (wide ? "" : " rail") + (open ? " on" : ""), onClick: toggle, title: tr("th.tab") },
        h("span", { className: "ic" }, dicon("hub", 15)),
        wide ? h("span", { className: "lbl" }, tr("th.tab")) : null
      );
      if (!open) return h("div", null, trigger);

      var body = [];
      if (tab === "files") {
        body.push(h("div", { key: "hint", className: "ft" }, tr("th.hintFiles")));
        var segs = String(fs.path || "").split("/").filter(function (x) { return x; });
        var bc = [h("span", { key: "r0", className: "lk", onClick: function () { fload(""); } }, "🏠 " + tr("th.root"))];
        var acc = "";
        for (var i = 0; i < segs.length; i++) {
          acc = acc ? acc + "/" + segs[i] : segs[i];
          bc.push(h("span", { key: "sp" + i, style: { opacity: .5 } }, " / "));
          (function (pp, nm) { bc.push(h("span", { key: "c" + pp, className: "lk", onClick: function () { fload(pp); } }, nm)); })(acc, segs[i]);
        }
        body.push(h("div", { key: "bc", className: "bc" }, bc));
        body.push(h("div", { key: "bar", className: "tbar" },
          h("button", { className: "btn gh", onClick: function () { fset({ newFolder: !fs.newFolder, menuFor: "", pick: null }); } }, tr("th.newFolder")),
          h("button", { className: "btn", onClick: function () { if (fileRef.current) fileRef.current.click(); } }, tr("th.upload")),
          h("input", { ref: fileRef, type: "file", style: { display: "none" }, onChange: function (e) { fupload(e.target.files); e.target.value = ""; } })
        ));
        if (fs.newFolder) {
          body.push(h("div", { key: "nf", className: "row" },
            h("input", { ref: nfRef, className: "inp", placeholder: tr("th.folderNamePh"), style: { flex: 1 }, onKeyDown: function (e) { if (e.key === "Enter") fmkdir(); } }),
            h("button", { className: "btn", onClick: fmkdir }, tr("th.create")),
            h("button", { className: "btn gh", onClick: function () { fset({ newFolder: false }); } }, tr("th.cancel"))
          ));
        }
        if (fs.message) body.push(h("div", { key: "msg", className: "msg" }, fs.message));
        if (fs.phase === "error") {
          body.push(h("div", { key: "er", className: "msg err" }, tr("drive.failOpen") + fs.message + tr("drive.portalHint2")));
        }
        if (fs.pick) {
          var pk = fs.pick;
          var psegs = String(pk.path || "").split("/").filter(function (x) { return x; });
          var pbc = [h("span", { key: "pr0", className: "lk", onClick: function () { fpickGo(""); } }, "🏠 " + tr("th.root"))];
          var pacc = "";
          for (var pi = 0; pi < psegs.length; pi++) {
            pacc = pacc ? pacc + "/" + psegs[pi] : psegs[pi];
            pbc.push(h("span", { key: "psp" + pi, style: { opacity: .5 } }, " / "));
            (function (pp2, nm2) { pbc.push(h("span", { key: "pc" + pp2, className: "lk", onClick: function () { fpickGo(pp2); } }, nm2)); })(pacc, psegs[pi]);
          }
          var pfolders = [];
          for (var pj = 0; pj < pk.entries.length; pj++) {
            if (!pk.entries[pj].dir) continue;
            (function (en2) {
              var np = pk.path ? pk.path + "/" + en2.name : en2.name;
              pfolders.push(h("div", { key: "pf" + en2.name, className: "it hv", onClick: function () { fpickGo(np); } },
                h("span", { className: "ico2" }, "📁"),
                h("div", { className: "gr" }, h("div", { className: "th" }, h("span", { className: "t" }, en2.name)))));
            })(pk.entries[pj]);
          }
          body.push(h("div", { key: "pick", className: "fm" },
            h("div", { className: "lb" }, tr("th.mvTitle") + pk.name + tr("th.mvTitle2")),
            h("div", { className: "bc" }, pbc),
            pfolders.length ? h("div", { className: "list" }, pfolders) : h("div", { className: "empty" }, tr("th.noSubFolder")),
            h("div", { className: "row" },
              h("button", { className: "btn", onClick: function () { fmove(pk.path); } }, tr("th.mvHere")),
              h("button", { className: "btn gh", onClick: function () { fset({ pick: null }); } }, tr("th.cancel"))
            )
          ));
        }
        var rows = [];
        var rootEmpty = fs.phase === "ready" && fs.path === "" && fs.entries.length === 0;
        for (var j = 0; j < fs.entries.length; j++) {
          (function (en) {
            var full = fs.path ? fs.path + "/" + en.name : en.name;
            var isOpenMenu = fs.menuFor === en.name;
            var meta = en.dir ? tr("th.folderWord") : fmtSize(en.size) + (en.mtime ? " · " + String(en.mtime).slice(0, 10) : "");
            var acts = [];
            if (en.dir) {
              acts.push(h("button", { key: "o", className: "mini", onClick: function () { fload(full); } }, tr("th.openIt")));
            } else {
              acts.push(h("a", { key: "d", className: "mini", style: { textDecoration: "none" }, href: "/portal/api/drive/download?path=" + encodeURIComponent(full) }, tr("th.download")));
            }
            acts.push(h("button", { key: "m", className: "mini", onClick: function () { fset({ menuFor: isOpenMenu ? "" : en.name }); } }, "⋯"));
            rows.push(h("div", { key: "it" + en.name, className: "it" },
              h("span", { className: "ico2" }, en.dir ? "📁" : hfileEmoji(en.name)),
              h("div", { className: "gr" },
                h("div", { className: "th" },
                  h("span", { className: "t", style: en.dir ? { cursor: "pointer" } : null, onClick: en.dir ? function () { fload(full); } : null }, en.name),
                  h("span", null, acts)
                ),
                h("div", { className: "d" }, meta),
                isOpenMenu ? h("div", { className: "row", style: { marginTop: 6 } },
                  en.dir ? null : h("button", { className: "mini", onClick: function () { fpick(en.name); } }, tr("th.moveBtn")),
                  h("button", { className: "mini", onClick: function () { frm(full, en.dir); } }, tr("th.del"))
                ) : null
              )));
          })(fs.entries[j]);
        }
        if (rootEmpty) {
          body.push(h("div", { key: "ea", className: "bigcard", onClick: function () { if (fileRef.current) fileRef.current.click(); } },
            h("div", { className: "bt" }, tr("th.emptyTitleA")), h("div", { className: "bs" }, tr("th.emptyBodyA"))));
          body.push(h("div", { key: "eb", className: "bigcard", onClick: function () { setTab("notes"); nset({ composing: true }); } },
            h("div", { className: "bt" }, tr("th.emptyTitleB")), h("div", { className: "bs" }, tr("th.emptyBodyB"))));
        }
        if (rows.length) body.push(h("div", { key: "rows", className: "list" }, rows));
      } else {
        body.push(h("div", { key: "hint", className: "ft" }, tr("th.hintNotes")));
        body.push(h("div", { key: "sb", className: "row" },
          h("input", { ref: qRef, className: "inp", placeholder: tr("th.searchPh"), style: { flex: 1 }, onKeyDown: function (e) { if (e.key === "Enter") nsearch(); } }),
          h("button", { className: "btn gh", onClick: nsearch }, tr("th.searchBtn"))
        ));
        body.push(h("div", { key: "nb", className: "row" },
          h("button", { className: "btn", onClick: function () { nset({ composing: !ns.composing }); } }, tr("th.saveNote"))
        ));
        if (ns.composing) {
          body.push(h("div", { key: "cf", className: "fm" },
            h("input", { ref: ntRef, className: "inp", placeholder: tr("th.noteTitlePh") }),
            h("textarea", { ref: nbRef, className: "inp ta", placeholder: tr("th.noteBodyPh") }),
            h("div", null,
              h("button", { className: "btn", onClick: nsave }, tr("th.saveBtn")),
              h("button", { className: "btn gh", onClick: function () { nset({ composing: false }); } }, tr("th.cancel"))
            )
          ));
        }
        if (ns.message) body.push(h("div", { key: "nm", className: "msg ok" }, ns.message));
        if (ns.q) {
          body.push(h("div", { key: "hc", className: "ft" }, tr("th.hitsPrefix") + ns.hits.length));
          var hitNodes = [];
          for (var hh = 0; hh < ns.hits.length; hh++) {
            hitNodes.push(h("div", { key: "h" + hh, className: "it" },
              h("span", { className: "ico2" }, "🔎"),
              h("div", { className: "gr" },
                h("div", { className: "d" }, ns.hits[hh].file + " : " + ns.hits[hh].line),
                h("div", { className: "bd2" }, ns.hits[hh].text)
              )));
          }
          body.push(h("div", { key: "hits", className: "list" }, hitNodes.length ? hitNodes : h("div", { className: "empty" }, tr("th.noHits"))));
          body.push(h("div", { key: "hb", className: "row" },
            h("button", { className: "btn gh", onClick: function () { if (qRef.current) qRef.current.value = ""; nset({ q: "", hits: [] }); } }, tr("th.backList"))
          ));
        } else {
          var noteNodes = [];
          for (var nn = 0; nn < ns.notes.length; nn++) {
            (function (note) {
              var isOpen = ns.expanded === note.name;
              var nacts = [h("button", { key: "v", className: "mini", onClick: function () { nopen(note.name); } }, isOpen ? tr("th.hide") : tr("th.read"))];
              if (ns.role === "admin") nacts.push(h("button", { key: "x", className: "mini", onClick: function () { ndel(note.name); } }, tr("th.del")));
              noteNodes.push(h("div", { key: "n" + note.name, className: "it" },
                h("span", { className: "ico2" }, "📝"),
                h("div", { className: "gr" },
                  h("div", { className: "th" }, h("span", { className: "t" }, note.title), h("span", null, nacts)),
                  h("div", { className: "d" }, String(note.mtime || "") + (note.author ? " · " + note.author : "")),
                  isOpen ? h("div", { className: "bd2", style: { whiteSpace: "pre-wrap" } }, ns.content) : null
                )));
            })(ns.notes[nn]);
          }
          body.push(h("div", { key: "notes", className: "list" },
            noteNodes.length ? noteNodes : h("div", { className: "bigcard", onClick: function () { nset({ composing: true }); } },
              h("div", { className: "bt" }, tr("th.noNotes")),
              h("div", { className: "bs" }, tr("th.noNotesSub")))));
        }
      }

      return h("div", null,
        trigger,
        h("div", { key: "panel", className: "ddp fv" },
          h("div", { className: "hd" },
            h("span", { className: "ico" }, dicon("hub", 18)),
            h("div", null, h("div", { className: "t1" }, tr("th.tab")), h("div", { className: "t2" }, tr("th.sub"))),
            h("button", { className: "x", onClick: toggle }, tr("fv.back"))
          ),
          h("div", { className: "tabs" },
            h("button", { className: "tb" + (tab === "files" ? " on" : ""), onClick: function () { setTab("files"); } }, tr("th.filesTab")),
            h("button", { className: "tb" + (tab === "notes" ? " on" : ""), onClick: function () { setTab("notes"); } }, tr("th.notesTab"))
          ),
          h("div", { className: "bd" }, body)
        )
      );
    }

    function AnnounceBoard(props) {
      var wide = !!(props && props.wide);
      var dataPair = React.useState({ phase: "loading", role: "member", announcements: [], feedback: [] });
      var data = dataPair[0];
      var setData = dataPair[1];
      var openPair = React.useState(false);
      var open = openPair[0];
      var setOpen = openPair[1];
      useFvSync(open, setOpen);
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
        { className: "ddb" + (wide ? "" : " rail") + (open ? " on" : ""), onClick: toggle, title: tr("ann.title") },
        h("span", { className: "ic" }, dicon("announce", 15)),
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
          { key: "panel", className: "ddp fv" },
          h(
            "div",
            { className: "hd" },
            h("span", { className: "ico" }, dicon("announce", 18)),
            h("div", null, h("div", { className: "t1" }, tr("ann.titleShort")), h("div", { className: "t2" }, tr("ann.footerLabel"))),
            h("button", { className: "x", onClick: toggle }, tr("fv.back"))
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
      useFvSync(open, setOpen);

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
        { className: "ddb" + (wide ? "" : " rail") + (open ? " on" : ""), onClick: toggle, title: tr("asst.title") },
        h("span", { className: "ic" }, dicon("assist", 15)),
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
          var team = [];
          var builtin = [];
          st.presets.forEach(function (p) { (p.trust === "system" ? builtin : team).push(p); });
          if (team.length) {
            kids.push(h("div", { key: "lb-t", className: "lb" }, tr("asst.groupTeam")));
            var cards = team.map(function (p) {
              return h("div", { key: "p" + p.id, className: "rolecard" },
                h("div", { className: "rc-top" },
                  h("span", { className: "rc-ico" }, dicon(roleIcon(p.id), 16)),
                  h("span", { className: "rc-name" }, p.name),
                  p.defaultHint ? h("span", { className: "bdg" }, tr("asst.defaultTag")) : null,
                  p.codex ? h("span", { className: "bdg" }, tr("asst.codex")) : null
                ),
                h("div", { className: "rc-d" }, p.description || p.id)
              );
            });
            kids.push(h("div", { key: "cards", className: "rolegrid" }, cards));
          }
          if (builtin.length) {
            kids.push(h("div", { key: "lb-b", className: "lb" }, tr("asst.groupBuiltin")));
            var brows = builtin.map(function (p) {
              return h("div", { key: "b" + p.id, className: "it" },
                h("span", { className: "ico2" }, dicon(roleIcon(p.id), 15)),
                h("div", { className: "gr" },
                  h("div", { className: "th" }, h("span", { className: "t" }, p.name), h("span", { className: "tag" }, tr("asst.builtinTag"))),
                  h("div", { className: "d" }, p.description || p.id)
                )
              );
            });
            kids.push(h("div", { key: "brows", className: "list" }, brows));
          }
        }
        kids.push(h("div", { key: "tip", className: "ft" }, tr("asst.note")));
      }
      return h(
        "div",
        null,
        trigger,
        h(
          "div",
          { key: "panel", className: "ddp fv" },
          h(
            "div",
            { className: "hd" },
            h("span", { className: "ico" }, dicon("assist", 18)),
            h("div", null, h("div", { className: "t1" }, tr("asst.team")), h("div", { className: "t2" }, tr("asst.panelTitle"))),
            h("button", { className: "x", onClick: toggle }, tr("fv.back"))
          ),
          h("div", { className: "bd" }, kids)
        )
      );
    }

    function SkillsConnPanel(props) {
      var wide = !!(props && props.wide);
      var sPair = React.useState({ phase: "loading", skills: [], items: [], platforms: [], role: "member" });
      var st = sPair[0];
      var setSt = sPair[1];
      var tPair = React.useState("skills");
      var tab = tPair[0];
      var setTab = tPair[1];
      var oPair = React.useState(false);
      var open = oPair[0];
      var setOpen = oPair[1];
      useFvSync(open, setOpen);
      var dPair = React.useState({ phase: "none", id: "", name: "", content: "" });
      var langTick = useLocaleSignal();
      var det = dPair[0];
      var setDet = dPair[1];
      var cPair = React.useState({ form: "", name: "", target: "", busy: false, msg: "", msgKind: "" });
      var cs = cPair[0];
      var setCs = cPair[1];
      var wPair = React.useState(null);
      var wxq = wPair[0];
      var setWxq = wPair[1];
      var wxTimer = React.useRef(null);
      function wxset(patch) {
        setWxq(function (prev) {
          var n = {};
          if (prev) { for (var k in prev) n[k] = prev[k]; }
          for (var k2 in patch) n[k2] = patch[k2];
          return n;
        });
      }
      function cset(patch) {
        setCs(function (prev) {
          var n = {};
          for (var k in prev) n[k] = prev[k];
          for (var k2 in patch) n[k2] = patch[k2];
          return n;
        });
      }
      function cAdd() {
        var name = String(cs.name || "").trim();
        var target = String(cs.target || "").trim();
        if (!name || !target) {
          cset({ msg: tr("skl.needNameTarget"), msgKind: "err" });
          return;
        }
        cset({ busy: true, msg: tr("common.processing"), msgKind: "" });
        fetch("/portal/api/admin/notify/route-add?lang=" + deskLang(), { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ name: name, kind: cs.form, target: target }) })
          .then(function (r) { return r.json().then(function (d) { return { s: r.status, d: d }; }); })
          .then(function (res) {
            if (res.s !== 200) throw new Error((res.d && res.d.error) || "HTTP " + res.s);
            cset({ busy: false, form: "", name: "", target: "", msg: tr("skl.routeSaved"), msgKind: "ok" });
            load();
          })
          .catch(function (e) { cset({ busy: false, msg: String((e && e.message) || e), msgKind: "err" }); });
      }
      function cTest(kind) {
        cset({ busy: true, msg: tr("common.processing"), msgKind: "" });
        fetch("/portal/api/admin/notify-test?lang=" + deskLang(), { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ kind: kind }) })
          .then(function (r) { return r.json(); })
          .then(function (d) {
            var rs = (d && d.results) || [];
            var line = rs.map(function (x) { return (x.route || "?") + " " + (x.ok ? "✓" : "✗ " + (x.info || "")); }).join("；").slice(0, 220);
            var allOk = rs.length > 0 && rs.every(function (x) { return x.ok; });
            cset({ busy: false, msg: line || tr("skl.noConn"), msgKind: allOk ? "ok" : "err" });
          })
          .catch(function (e) { cset({ busy: false, msg: String((e && e.message) || e), msgKind: "err" }); });
      }
      function cConnSave() {
        var target = String(cs.target || "").trim();
        if (!target) {
          cset({ msg: tr("skl.connNeedConfig"), msgKind: "err" });
          return;
        }
        cset({ busy: true, msg: tr("common.processing"), msgKind: "" });
        fetch("/portal/api/admin/conn/add?lang=" + deskLang(), { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ platform: cs.form, config: target }) })
          .then(function (r) { return r.json().then(function (d) { return { s: r.status, d: d }; }); })
          .then(function (res) {
            if (res.s !== 200) throw new Error((res.d && res.d.error) || "HTTP " + res.s);
            cset({ busy: false, form: "", name: "", target: "", msg: tr("skl.connSaved"), msgKind: "ok" });
            load();
          })
          .catch(function (e) { cset({ busy: false, msg: String((e && e.message) || e), msgKind: "err" }); });
      }
      function cConnTest(platform) {
        cset({ busy: true, msg: tr("common.processing"), msgKind: "" });
        fetch("/portal/api/admin/conn/test?lang=" + deskLang(), { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ platform: platform }) })
          .then(function (r) { return r.json(); })
          .then(function (d) {
            var ok = !!(d && d.ok && d.result && d.result.ok);
            var info = (d && d.result && d.result.info) || (d && d.error) || "?";
            cset({ busy: false, msg: info, msgKind: ok ? "ok" : "err" });
          })
          .catch(function (e) { cset({ busy: false, msg: String((e && e.message) || e), msgKind: "err" }); });
      }
      function cConnRm(platform) {
        if (!window.confirm(tr("skl.confirmRm"))) return;
        cset({ busy: true, msg: tr("common.processing"), msgKind: "" });
        fetch("/portal/api/admin/conn/rm?lang=" + deskLang(), { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ platform: platform }) })
          .then(function (r) { return r.json(); })
          .then(function () { cset({ busy: false, msg: "", msgKind: "" }); load(); })
          .catch(function (e) { cset({ busy: false, msg: String((e && e.message) || e), msgKind: "err" }); });
      }

      function stopWxPoll() { if (wxTimer.current) { clearInterval(wxTimer.current); wxTimer.current = null; } }
      function wxClose() { stopWxPoll(); setWxq(null); }
      function startWxPoll(id, tries) {
        stopWxPoll();
        wxTimer.current = setInterval(function () {
          fetch("/portal/api/wx/bind-status?id=" + encodeURIComponent(id), { headers: { accept: "application/json" } })
            .then(function (r) { return r.json(); })
            .then(function (d) {
              var st = d && d.status;
              if (st === "confirmed") {
                stopWxPoll();
                setWxq({ phase: "done" });
                load();
                setTimeout(function () { setWxq(null); }, 2000);
              } else if (st === "expired") {
                if (tries < 2) {
                  stopWxPoll();
                  setWxq({ phase: "loading" });
                  fetch("/portal/api/wx/bind-start", { method: "POST", headers: { "content-type": "application/json" }, body: "{}" })
                    .then(function (r) { return r.json(); })
                    .then(function (d2) {
                      if (!d2 || d2.error) { setWxq({ phase: "error", msg: (d2 && d2.error) || tr("common.failHint") }); return; }
                      setWxq({ phase: "wait", id: d2.id, svg: d2.svg || "", tries: tries + 1 });
                      startWxPoll(d2.id, tries + 1);
                    })
                    .catch(function (e) { setWxq({ phase: "error", msg: String((e && e.message) || e) }); });
                } else {
                  stopWxPoll();
                  setWxq({ phase: "expired" });
                }
              } else if (st === "scaned") {
                wxset({ phase: "scaned" });
              } else if (st === "error") {
                stopWxPoll();
                setWxq({ phase: "error", msg: (d && d.error) || tr("common.failHint") });
              }
            })
            .catch(function () {});
        }, 2500);
      }
      function openWxBind() {
        stopWxPoll();
        setWxq({ phase: "loading" });
        fetch("/portal/api/wx/bind-start", { method: "POST", headers: { "content-type": "application/json" }, body: "{}" })
          .then(function (r) { return r.json(); })
          .then(function (d) {
            if (!d || d.error) { setWxq({ phase: "error", msg: (d && d.error) || tr("common.failHint") }); return; }
            setWxq({ phase: "wait", id: d.id, svg: d.svg || "", tries: 0 });
            startWxPoll(d.id, 0);
          })
          .catch(function (e) { setWxq({ phase: "error", msg: String((e && e.message) || e) }); });
      }
      function wxqModal() {
        var q = wxq || {};
        var body;
        if (q.phase === "loading") body = h("div", { className: "wxq-msg" }, tr("common.loading"));
        else if (q.phase === "error") body = h("div", { className: "wxq-msg err" }, q.msg || tr("common.failHint"));
        else if (q.phase === "done") body = h("div", { className: "wxq-msg ok" }, tr("wxq.done"));
        else if (q.phase === "expired") body = h("div", { className: "wxq-msg" }, h("button", { className: "bbtn pri", onClick: openWxBind }, tr("wxq.refresh")));
        else
          body = h(
            "div",
            null,
            h("div", { className: "wxq-qr", dangerouslySetInnerHTML: { __html: q.svg || "" } }),
            h("div", { className: "wxq-msg" }, q.phase === "scaned" ? tr("wxq.scaned") : tr("wxq.waiting"))
          );
        return h(
          "div",
          { key: "wxq", className: "wxq-ov", onClick: function (e) { if (e.target === e.currentTarget) wxClose(); } },
          h(
            "div",
            { className: "wxq-box" },
            h("div", { className: "wxq-hd" }, tr("wxq.title")),
            h("div", { className: "wxq-sub" }, tr("wxq.hint")),
            body,
            h("button", { className: "bbtn", style: { marginTop: 2 }, onClick: wxClose }, tr("wxq.close"))
          )
        );
      }
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
            setSt({ phase: "ready", skills: (rs[0] && rs[0].skills) || [], items: (rs[1] && rs[1].items) || [], platforms: (rs[1] && rs[1].platforms) || [], role: (rs[1] && rs[1].role) || "member" });
          })
          .catch(function () {
            setSt({ phase: "error", skills: [], items: [], platforms: [], role: "member" });
          });
      }
      React.useEffect(function () {
        load();
      }, [langTick]);

      function toggle() {
        var next = !open;
        setOpen(next);
        if (!next) {
          setDet({ phase: "none", id: "", name: "", content: "" });
          wxClose();
        }
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
        { className: "ddb" + (wide ? "" : " rail") + (open ? " on" : ""), onClick: toggle, title: tr("skl.title") },
        h("span", { className: "ic" }, dicon("skills", 15)),
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
            tr("skl.connectors") + (st.phase === "ready" ? "(" + (st.platforms || []).length + ")" : "")
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
        var isAdmin = st.role === "admin";
        var plat = st.platforms || [];
        var formKey = function (p) { return p.mode === "notify" ? p.kind : p.id; };
        var cardOf = function (p) {
          var meta = PLAT_META[p.id] || { i: "link", c: "#aeb7c6" };
          var acts = [];
          var editing = isAdmin && p.mode !== "plan" && cs.form === formKey(p);
          var isWxMine = p.id === "wx-mine";
          if (isWxMine) {
            acts.push(h("button", { key: "a", className: "bbtn" + (p.connected ? "" : " pri"), onClick: openWxBind, disabled: cs.busy }, p.connected ? tr("wxq.reconnect") : tr("wxq.connect")));
          } else if (isAdmin && p.mode !== "plan") {
            if (editing) {
              acts.push(h("button", { key: "a", className: "bbtn pri", onClick: p.mode === "notify" ? cAdd : cConnSave, disabled: cs.busy }, tr("skl.save")));
              acts.push(h("button", { key: "c", className: "bbtn", onClick: function () { cset({ form: "", name: "", target: "", msg: "", msgKind: "" }); } }, tr("th.cancel")));
            } else {
              var lbl = p.mode === "conn" ? (p.connected ? tr("skl.reconfig") : tr("skl.connect")) : p.connected ? tr("skl.addMore") : tr("skl.connect");
              acts.push(h("button", { key: "a", className: "bbtn" + (p.connected ? "" : " pri"), onClick: function () { cset({ form: formKey(p), name: p.mode === "notify" ? p.id : "", target: "", msg: "", msgKind: "" }); } }, lbl));
            }
            if (p.connected && p.mode === "notify") acts.push(h("button", { key: "t", className: "bbtn", onClick: function () { cTest(p.kind); }, disabled: cs.busy }, tr("skl.test")));
            if (p.connected && p.mode === "conn") {
              acts.push(h("button", { key: "t", className: "bbtn", onClick: function () { cConnTest(p.id); }, disabled: cs.busy }, tr("skl.test")));
              if (p.openUrl) acts.push(h("button", { key: "o", className: "bbtn", onClick: function () { window.open(p.openUrl, "_blank"); } }, tr("skl.open")));
              acts.push(h("button", { key: "d", className: "bbtn", onClick: function () { cConnRm(p.id); }, disabled: cs.busy }, tr("skl.remove")));
            }
          }
          var stat;
          if (isWxMine) stat = p.connected ? tr("skl.connected") : tr("skl.notConnected");
          else if (p.mode === "plan") stat = tr("skl.planTag");
          else if (p.mode === "conn") stat = p.connected ? tr("skl.connected") : tr("skl.notConnected");
          else stat = isAdmin && p.connected && p.routes > 0 ? p.routesEnabled + tr("skl.routesUnit") + " · " + tr("skl.connected") : p.connected ? tr("skl.connected") : tr("skl.notConnected");
          return h(
            "div",
            { key: "pl" + p.id, className: "pcard" + (p.connected ? " on" : "") + (p.mode === "plan" ? " plan" : "") },
            h(
              "div",
              { className: "ptop" },
              h("span", { className: "ptile", style: { background: meta.c + "26", color: meta.c } }, dicon(meta.i, 17)),
              h("span", { className: "pname" }, p.name),
              p.mode === "plan" ? h("span", { className: "ptag" }, tr("skl.planTag")) : null
            ),
            h("div", { className: "pd" }, p.desc || ""),
            p.connected && p.display ? h("div", { className: "pdl" }, p.display) : null,
            editing
              ? h(
                  "div",
                  { className: "pform" },
                  p.mode === "notify" ? h("input", { className: "inp", placeholder: tr("skl.namePh"), value: cs.name, onChange: function (e) { cset({ name: e.target.value }); } }) : null,
                  h("input", { className: "inp", placeholder: p.hint || "", value: cs.target, onChange: function (e) { cset({ target: e.target.value }); } })
                )
              : null,
            h("div", { className: "pfoot" }, h("span", { className: "pst" + (p.connected ? " ok" : "") }, "● " + stat), h("span", { className: "pbtns" }, acts))
          );
        };
        var groups = [["msg", "skl.platforms"], ["meet", "skl.grpMeet"], ["work", "skl.grpWork"]];
        groups.forEach(function (g) {
          var list = plat.filter(function (p) { return p.group === g[0]; });
          if (!list.length) return;
          kids.push(h("div", { key: "lb-" + g[0], className: "lb" }, tr(g[1])));
          kids.push(h("div", { key: "grid-" + g[0], className: "pgrid" }, list.map(cardOf)));
        });
        if (cs.msg) kids.push(h("div", { key: "cmsg", className: "msg" + (cs.msgKind === "err" ? " err" : cs.msgKind === "ok" ? " ok" : "") }, cs.msg));
        if (!isAdmin) kids.push(h("div", { key: "crole", className: "ft" }, tr("skl.adminOnly")));

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
        kids.push(h("div", { key: "tools-lb", className: "lb" }, tr("skl.tools")));
        kids.push(h("div", { key: "crows", className: "list" }, crows.length ? crows : h("div", { className: "empty" }, tr("skl.noConn"))));
        kids.push(h("div", { key: "ctip", className: "ft" }, tr("skl.legend")));
      }
      if (wxq) kids.push(wxqModal());
      return h(
        "div",
        null,
        trigger,
        h(
          "div",
          { key: "panel", className: "ddp fv" },
          h(
            "div",
            { className: "hd" },
            h("span", { className: "ico" }, dicon("skills", 18)),
            h("div", null, h("div", { className: "t1" }, tr("skl.titleShort")), h("div", { className: "t2" }, tr("skl.panelTitle"))),
            h("button", { className: "x", onClick: toggle }, tr("fv.back"))
          ),
          h("div", { className: "bd" }, kids)
        )
      );
    }

    function AutomationPanel(props) {
      var wide = !!(props && props.wide);
      var aPair = React.useState({ phase: "loading", role: "member", items: [], logs: [], stats: { active: 0, weekRuns: 0, weekFails: 0 }, rules: [] });
      var st = aPair[0];
      var setSt = aPair[1];
      var oPair = React.useState(false);
      var open = oPair[0];
      var setOpen = oPair[1];
      useFvSync(open, setOpen);
      var mPair = React.useState({ kind: "", text: "" });
      var msg = mPair[0];
      var setMsg = mPair[1];
      var langTick = useLocaleSignal();
      var fPair = React.useState("all");
      var flt = fPair[0];
      var setFlt = fPair[1];
      var tabPair = React.useState("timer");
      var tab = tabPair[0];
      var setTab = tabPair[1];
      var fmPair = React.useState({ name: "", freq: "daily", time: "09:00", week: "1", kind: "notify", ntext: "", agent: "", one: "" });
      var fm = fmPair[0];
      var setFm = fmPair[1];
      var rqPair = React.useState({ open: false, text: "" });
      var rq = rqPair[0];
      var setRq = rqPair[1];

      function fs(patch) {
        setFm(function (prev) {
          var next = {};
          for (var k in prev) next[k] = prev[k];
          for (var k2 in patch) next[k2] = patch[k2];
          return next;
        });
      }

      function load() {
        fetch("/portal/api/auto", { headers: { accept: "application/json" } })
          .then(function (r) {
            if (!r.ok) throw new Error("HTTP " + r.status);
            return r.json();
          })
          .then(function (d) {
            setSt({
              phase: "ready",
              role: (d && d.role) || "member",
              items: (d && d.items) || [],
              logs: (d && d.logs) || [],
              stats: (d && d.stats) || { active: 0, weekRuns: 0, weekFails: 0 },
              rules: (d && d.rules) || [],
            });
          })
          .catch(function () {
            setSt({ phase: "error", role: "member", items: [], logs: [], stats: { active: 0, weekRuns: 0, weekFails: 0 }, rules: [] });
          });
      }
      React.useEffect(function () {
        if (open) load();
      }, [langTick, open]);
      React.useEffect(function () {
        if (!open) return undefined;
        var t = setInterval(load, 20000);
        return function () {
          clearInterval(t);
        };
      }, [open]);

      function toggle() {
        var next = !open;
        setOpen(next);
        if (next) load();
      }

      function act(path, body, okText, after) {
        setMsg({ kind: "info", text: tr("common.processing") });
        fetch(path, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) })
          .then(function (r) {
            return r.json().then(function (d) {
              return { status: r.status, d: d };
            });
          })
          .then(function (res) {
            var d = res.d || {};
            if (res.status !== 200 || d.error) {
              setMsg({ kind: "err", text: d.error || "HTTP " + res.status });
              return;
            }
            setMsg({ kind: "ok", text: okText || d.msg || "OK" });
            if (after) after();
            load();
          })
          .catch(function (e) {
            setMsg({ kind: "err", text: String((e && e.message) || e) });
          });
      }

      function p2(x) {
        return (x < 10 ? "0" : "") + x;
      }
      function wkName(d) {
        var zh = ["一", "二", "三", "四", "五", "六", "日"];
        var en = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
        if (deskLang() === "en") return en[(d - 1 + 7) % 7];
        return "周" + zh[(d - 1 + 7) % 7];
      }
      function fmtSched(sv) {
        sv = String(sv || "");
        var m = /^daily:(\d{2}):(\d{2})$/.exec(sv);
        if (m) return tr("auto.everyDay") + " " + m[1] + ":" + m[2];
        m = /^weekly:([1-7]):(\d{2}):(\d{2})$/.exec(sv);
        if (m) return tr("auto.everyWeek") + wkName(Number(m[1])) + " " + m[2] + ":" + m[3];
        return sv;
      }
      function fmtNext(sec) {
        if (!sec) return "—";
        var d = new Date(Number(sec) * 1000);
        if (isNaN(d.getTime())) return "—";
        var now = new Date();
        var hm = p2(d.getHours()) + ":" + p2(d.getMinutes());
        if (d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth() && d.getDate() === now.getDate()) return tr("auto.today") + " " + hm;
        if (d.getTime() - now.getTime() < 86400000) return tr("auto.tomorrow") + " " + hm;
        return p2(d.getMonth() + 1) + "-" + p2(d.getDate()) + " " + hm;
      }
      function fmtTs(ts) {
        var m = /^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})/.exec(String(ts || ""));
        if (!m) return String(ts || "");
        var d = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]), Number(m[4]), Number(m[5])));
        if (isNaN(d.getTime())) return String(ts || "");
        return p2(d.getMonth() + 1) + "-" + p2(d.getDate()) + " " + p2(d.getHours()) + ":" + p2(d.getMinutes());
      }
      function ruleLabel(it) {
        var r = (st.rules || []).filter(function (x) {
          return x.key === it.trigger;
        })[0];
        if (!r) return it.name;
        return deskLang() === "en" ? r.en || it.name : r.zh || it.name;
      }
      function actionOf(it) {
        try {
          return JSON.parse(it.action || "{}") || {};
        } catch (e) {
          return {};
        }
      }

      function parseOne() {
        var one = String(fm.one || "").trim();
        if (!one) return null;
        var CN = { 零: 0, 一: 1, 两: 2, 二: 2, 三: 3, 四: 4, 五: 5, 六: 6, 七: 7, 八: 8, 九: 9, 十: 10, 十一: 11, 十二: 12 };
        function num(x) {
          if (/^\d+$/.test(x)) return Number(x);
          return CN[x] != null ? CN[x] : NaN;
        }
        var week = null;
        var m = /每(?:周|星期)([一二三四五六日天])/.exec(one);
        if (m) week = ("一二三四五六日天".indexOf(m[1]) % 7) + 1;
        var hh = null;
        var mm = 0;
        m = /(\d{1,2})[:：](\d{2})/.exec(one);
        if (m) {
          hh = Number(m[1]);
          mm = Number(m[2]);
        } else {
          m = /([零一二两三四五六七八九十]{1,3}|\d{1,2})\s*[点时]/.exec(one);
          if (m) {
            hh = num(m[1]);
            var m2 = /[点时]\s*(半|\d{1,2}\s*分?)/.exec(one);
            if (m2) mm = m2[1] === "半" ? 30 : Number(String(m2[1]).replace(/\D/g, "") || 0);
          }
        }
        if (hh == null || isNaN(hh) || hh > 23) return null;
        if (/[下午晚]/.test(one) && hh < 12) hh += 12;
        if (mm > 59) mm = 0;
        if (!week && !/每[天日]/.test(one)) return null;
        var t = p2(hh) + ":" + p2(mm);
        return { schedule: week ? "weekly:" + week + ":" + t : "daily:" + t, name: one.slice(0, 20), prompt: one };
      }

      var nextAuto = null;
      st.items.forEach(function (it) {
        if (it.type === "timer" && it.enabled && it.next_run_at && (!nextAuto || it.next_run_at < nextAuto)) nextAuto = it.next_run_at;
      });

      var trigger = h(
        "button",
        { className: "ddb" + (wide ? "" : " rail") + (open ? " on" : ""), onClick: toggle, title: tr("auto.title") },
        h("span", { className: "ic" }, dicon("auto", 15)),
        wide ? h("span", { className: "lbl" }, tr("auto.tab")) : null
      );
      if (!open) return h("div", null, trigger);

      var kids = [];
      if (st.phase === "loading") kids.push(h("div", { key: "ld", className: "empty" }, tr("common.loading")));
      if (st.phase === "error") kids.push(h("div", { key: "er", className: "empty" }, tr("common.failHint")));
      if (st.phase === "ready") {
        var isAdmin = st.role === "admin";
        kids.push(
          h(
            "div",
            { key: "stats", className: "astats" },
            h("div", { key: "s1", className: "astat" }, h("b", null, String(st.stats.active || 0)), h("span", null, tr("auto.statActive"))),
            h("div", { key: "s2", className: "astat" }, h("b", null, String(st.stats.weekRuns || 0)), h("span", null, tr("auto.statWeek"))),
            h("div", { key: "s3", className: "astat" }, h("b", null, String(st.stats.weekFails || 0)), h("span", null, tr("auto.statFails"))),
            h("div", { key: "s4", className: "astat" }, h("b", null, fmtNext(nextAuto)), h("span", null, tr("auto.statNext")))
          )
        );
        var FILTERS = [["all", tr("auto.fAll")], ["timer", tr("auto.fTimer")], ["rule", tr("auto.fRule")], ["paused", tr("auto.fPaused")]];
        kids.push(
          h(
            "div",
            { key: "flt", className: "achips" },
            FILTERS.map(function (f2) {
              return h("button", { key: f2[0], className: "achip" + (flt === f2[0] ? " on" : ""), onClick: function () { setFlt(f2[0]); } }, f2[1]);
            })
          )
        );
        var shown = st.items.filter(function (it) {
          if (flt === "all") return true;
          if (flt === "paused") return !it.enabled;
          return it.type === flt;
        });
        var cards = shown.map(function (it) {
          var isRule = it.type === "rule";
          var a = actionOf(it);
          var rl = isRule ? ruleLabel(it) : "";
          var desc = isRule ? (rl === it.name ? "" : rl) : a.kind === "agent" ? tr("auto.byAgent") + "：" + (a.prompt || "") : a.text || "";
          var meta = [];
          if (it.type === "timer") {
            meta.push(h("span", { key: "m1", className: "achip2 blue" }, fmtSched(it.schedule)));
            meta.push(h("span", { key: "m2" }, tr("auto.next") + " " + fmtNext(it.next_run_at)));
            if (it.last_run_at) meta.push(h("span", { key: "m3" }, tr("auto.last") + " " + fmtTs(it.last_run_at)));
            meta.push(h("span", { key: "m4" }, tr("auto.runs") + " " + (it.runs || 0) + tr("auto.runsUnit")));
          } else {
            meta.push(h("span", { key: "m1", className: "achip2 amber" }, tr("auto.fRule")));
            if (!isAdmin) meta.push(h("span", { key: "m2" }, tr("auto.ruleAdminHint")));
          }
          var btns = [];
          if (it.type === "timer") {
            btns.push(h("button", { key: "run", className: "mini", onClick: function () { act("/portal/api/auto/run", { id: it.id }, tr("auto.runStarted")); } }, tr("auto.runNow")));
            btns.push(
              h(
                "button",
                {
                  key: "rm",
                  className: "mini",
                  onClick: function () {
                    if (!window.confirm(tr("auto.confirmDel"))) return;
                    act("/portal/api/auto/rm", { id: it.id }, tr("common.deleted"));
                  },
                },
                tr("auto.rm")
              )
            );
          }
          return h(
            "div",
            { key: "a" + it.id, className: "acard" + (it.enabled ? "" : " off") + (isRule ? " rule" : "") },
            h("span", { className: "atile" }, dicon(isRule ? "zap" : "clock", 16)),
            h("div", { className: "am" }, h("div", { className: "an" }, it.name), desc ? h("div", { className: "ad" }, desc) : null, h("div", { className: "ameta" }, meta)),
            h(
              "div",
              { className: "ar" },
              h("button", {
                className: "atg" + (it.enabled ? " on" : ""),
                title: it.enabled ? tr("auto.statActive") : tr("auto.fPaused"),
                onClick: function () {
                  act("/portal/api/auto/toggle", { id: it.id }, it.enabled ? tr("auto.fPaused") : tr("auto.statActive"));
                },
              }),
              btns.length ? h("span", { className: "abtns" }, btns) : null
            )
          );
        });
        kids.push(h("div", { key: "lb1", className: "lb" }, tr("auto.secMine")));
        kids.push(h("div", { key: "cards", className: "list" }, cards.length ? cards : h("div", { className: "empty" }, tr("auto.empty"))));

        kids.push(h("div", { key: "lb2", className: "lb" }, tr("auto.secQuick")));
        var qDefs = [["briefing", "doc", tr("auto.qBriefing"), tr("auto.qBriefingSub")], ["progress", "chart", tr("auto.qProgress"), tr("auto.qProgressSub")]];
        if (isAdmin) qDefs.push(["remind", "bell", tr("auto.qRemind"), tr("auto.qRemindSub")]);
        kids.push(
          h(
            "div",
            { key: "qs", className: "aqs" },
            qDefs.map(function (qd) {
              return h(
                "button",
                {
                  key: qd[0],
                  className: "aq",
                  onClick: function () {
                    if (qd[0] === "remind") {
                      setRq({ open: true, text: rq.text });
                      return;
                    }
                    act("/portal/api/auto/quick", { kind: qd[0] });
                  },
                },
                h("span", { className: "atile" }, dicon(qd[1], 16)),
                h("span", null, h("div", { className: "t" }, qd[2]), h("div", { className: "d2" }, qd[3]))
              );
            })
          )
        );
        if (rq.open) {
          kids.push(
            h(
              "div",
              { key: "rq", className: "row" },
              h("input", {
                className: "inp",
                style: { flex: "1 1 auto", width: "auto" },
                placeholder: tr("auto.qRemindPh"),
                value: rq.text,
                onChange: function (e) { setRq({ open: true, text: e.target.value }); },
              }),
              h("button", {
                className: "btn",
                onClick: function () {
                  if (!String(rq.text).trim()) { setMsg({ kind: "err", text: tr("common.required") }); return; }
                  act("/portal/api/auto/quick", { kind: "remind", text: rq.text }, null, function () { setRq({ open: false, text: "" }); });
                },
              }, tr("auto.qSend"))
            )
          );
        }

        kids.push(h("div", { key: "lb3", className: "lb" }, tr("auto.secNew")));
        var tabs2 = [["timer", tr("auto.tabTimer")], ["one", tr("auto.tabOne")]];
        kids.push(
          h(
            "div",
            { key: "tabs", className: "tabs" },
            tabs2.map(function (t2) {
              return h("button", { key: t2[0], className: "tb" + (tab === t2[0] ? " on" : ""), onClick: function () { setTab(t2[0]); } }, t2[1]);
            })
          )
        );
        if (tab === "timer") {
          var wsel = null;
          if (fm.freq === "weekly") {
            wsel = h(
              "select",
              { className: "inp", style: { width: 104, flex: "0 0 auto" }, value: fm.week, onChange: function (e) { fs({ week: e.target.value }); } },
              [1, 2, 3, 4, 5, 6, 7].map(function (d) {
                return h("option", { key: d, value: String(d) }, wkName(d));
              })
            );
          }
          kids.push(
            h(
              "div",
              { key: "form", className: "aform" },
              h("div", { className: "row" }, h("input", { className: "inp", style: { flex: "1 1 140px", width: "auto" }, placeholder: tr("auto.formNamePh"), value: fm.name, onChange: function (e) { fs({ name: e.target.value }); } })),
              h(
                "div",
                { className: "row" },
                h(
                  "select",
                  { className: "inp", style: { width: 96, flex: "0 0 auto" }, value: fm.freq, onChange: function (e) { fs({ freq: e.target.value }); } },
                  h("option", { value: "daily" }, tr("auto.everyDay")),
                  h("option", { value: "weekly" }, tr("auto.everyWeek"))
                ),
                wsel,
                h("input", { className: "inp", type: "time", style: { width: 112, flex: "0 0 auto" }, value: fm.time, onChange: function (e) { fs({ time: e.target.value }); } })
              ),
              h(
                "div",
                { className: "row" },
                h(
                  "select",
                  { className: "inp", style: { width: 150, flex: "0 0 auto" }, value: fm.kind, onChange: function (e) { fs({ kind: e.target.value }); } },
                  h("option", { value: "notify" }, tr("auto.kindNotify")),
                  h("option", { value: "agent" }, tr("auto.kindAgent"))
                )
              ),
              fm.kind === "notify"
                ? h("textarea", { className: "inp ta", placeholder: tr("auto.formNotifyPh"), value: fm.ntext, onChange: function (e) { fs({ ntext: e.target.value }); } })
                : h("textarea", { className: "inp ta", placeholder: tr("auto.formPromptPh"), value: fm.agent, onChange: function (e) { fs({ agent: e.target.value }); } }),
              h(
                "div",
                { className: "row" },
                h(
                  "button",
                  {
                    className: "btn",
                    onClick: function () {
                      if (!fm.time) { setMsg({ kind: "err", text: tr("auto.badTime") }); return; }
                      if (fm.kind === "notify" && !String(fm.ntext).trim()) { setMsg({ kind: "err", text: tr("common.required") }); return; }
                      if (fm.kind === "agent" && !String(fm.agent).trim()) { setMsg({ kind: "err", text: tr("common.required") }); return; }
                      var schedule = fm.freq === "weekly" ? "weekly:" + fm.week + ":" + fm.time : "daily:" + fm.time;
                      var action = fm.kind === "notify" ? { kind: "notify", text: fm.ntext } : { kind: "agent", prompt: fm.agent };
                      var name = String(fm.name || "").trim() || tr("auto.defaultName") + " " + fm.time;
                      act("/portal/api/auto/add", { name: name, schedule: schedule, action: action }, tr("auto.saved"), function () { fs({ name: "", ntext: "", agent: "" }); });
                    },
                  },
                  tr("auto.save")
                )
              )
            )
          );
        } else {
          var pv = parseOne();
          kids.push(
            h(
              "div",
              { key: "one", className: "aform" },
              h("textarea", { className: "inp ta", placeholder: tr("auto.onePh"), value: fm.one, onChange: function (e) { fs({ one: e.target.value }); } }),
              pv
                ? h(
                    "div",
                    { className: "achips" },
                    h("span", { key: "p1", className: "achip2 blue" }, "⏰ " + fmtSched(pv.schedule)),
                    h("span", { key: "p2", className: "achip2" }, "🤖 " + tr("auto.kindAgent"))
                  )
                : null,
              h(
                "div",
                { className: "row" },
                h(
                  "button",
                  {
                    className: "btn",
                    onClick: function () {
                      var pv2 = parseOne();
                      if (!pv2) { setMsg({ kind: "err", text: tr("auto.oneFail") }); return; }
                      act("/portal/api/auto/add", { name: pv2.name, schedule: pv2.schedule, action: { kind: "agent", prompt: pv2.prompt } }, tr("auto.saved"), function () { fs({ one: "" }); });
                    },
                  },
                  tr("auto.oneParse")
                )
              )
            )
          );
        }
        kids.push(h("div", { key: "rn", className: "d", style: { marginTop: 8, opacity: .8 } }, tr("auto.ruleNote")));

        kids.push(h("div", { key: "lb4", className: "lb" }, tr("auto.secLogs")));
        if (!st.logs.length) {
          kids.push(h("div", { key: "lg0", className: "empty" }, tr("auto.logsEmpty")));
        } else {
          kids.push(
            h(
              "div",
              { key: "logs", className: "alogs" },
              st.logs.map(function (lg) {
                return h(
                  "div",
                  { key: "lg" + lg.id, className: "alog" },
                  h("span", { className: lg.ok ? "dot ok" : "dot bad" }),
                  h("span", { className: "nm" }, lg.auto_name || ""),
                  h("span", { className: "inf" }, lg.info || ""),
                  h("span", { className: "tm" }, fmtTs(lg.ts))
                );
              })
            )
          );
        }
        kids.push(h("div", { key: "foot", className: "ft" }, tr("auto.footNote")));
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
          { key: "panel", className: "ddp fv" },
          h(
            "div",
            { className: "hd" },
            h("span", { className: "ico" }, dicon("auto", 18)),
            h("div", null, h("div", { className: "t1" }, tr("auto.tab")), h("div", { className: "t2" }, tr("auto.panelTitle"))),
            h("button", { className: "x", onClick: toggle }, tr("fv.back"))
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

    /** 「加入通道」傻瓜表单：选服务商 → 贴 Key → 勾模型 → 保存（高级可调 Base URL/价目表） */
    function ChannelAddForm(props) {
      var presets = props.presets || [];
      var fPair = React.useState({ prov: "", name: "", base: "", key: "", models: [], prices: {}, custom: "", note: "", cap: "" });
      var f = fPair[0];
      var setF = fPair[1];
      function up(patch) {
        setF(function (cur) { return Object.assign({}, cur, patch); });
      }
      function curPreset() {
        for (var i = 0; i < presets.length; i++) if (presets[i].id === f.prov) return presets[i];
        return null;
      }
      function pick(provId) {
        var p = null;
        for (var i = 0; i < presets.length; i++) if (presets[i].id === provId) p = presets[i];
        if (p) up({ prov: provId, name: p.id, base: p.baseUrl, cap: p.maxTokensCap ? String(p.maxTokensCap) : "" });
        else up({ prov: "" });
      }
      function toggleModel(m) {
        var has = f.models.indexOf(m) >= 0;
        up({ models: has ? f.models.filter(function (x) { return x !== m; }) : f.models.concat([m]) });
      }
      function addCustom() {
        var parts = String(f.custom || "").split(/[,\uFF0C]/).map(function (t) { return t.trim(); }).filter(Boolean);
        if (!parts.length) return;
        var next = f.models.slice();
        for (var i = 0; i < parts.length; i++) if (next.indexOf(parts[i]) < 0) next.push(parts[i]);
        up({ models: next, custom: "" });
      }
      function setPrice(m, k, v) {
        var pr = Object.assign({}, f.prices);
        pr[m] = Object.assign({ in: "", out: "" }, pr[m] || {});
        pr[m][k] = v;
        up({ prices: pr });
      }
      function submit() {
        if (!f.key.trim()) { props.onMsg({ kind: "err", text: tr("admin.chNeedKey") }); return; }
        if (!f.name.trim()) { props.onMsg({ kind: "err", text: tr("admin.chNeedName") }); return; }
        if (!f.base.trim()) { props.onMsg({ kind: "err", text: tr("admin.chNeedUrl") }); return; }
        if (!f.models.length) { props.onMsg({ kind: "err", text: tr("admin.chNeedModels") }); return; }
        var prices = null;
        for (var i = 0; i < f.models.length; i++) {
          var p = f.prices[f.models[i]];
          if (!p) continue;
          var inV = String(p.in == null ? "" : p.in).trim();
          var outV = String(p.out == null ? "" : p.out).trim();
          if (!inV && !outV) continue;
          prices = prices || {};
          prices[f.models[i]] = {};
          if (inV) prices[f.models[i]].in = Number(inV) || 0;
          if (outV) prices[f.models[i]].out = Number(outV) || 0;
        }
        var payload = { name: f.name.trim(), base_url: f.base.trim(), api_key: f.key.trim(), models: f.models.join(","), note: f.note.trim() };
        if (prices) payload.prices = prices;
        var capV = String(f.cap == null ? "" : f.cap).trim();
        var capN = Number(capV);
        if (capV && isFinite(capN) && capN > 0) payload.max_tokens_cap = Math.floor(capN);
        props.onMsg({ kind: "info", text: tr("common.processing") });
        fetch("/portal/api/admin/channel-create?lang=" + deskLang(), { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(payload) })
          .then(function (r) { return r.json().then(function (d) { return { status: r.status, d: d }; }); })
          .then(function (res) {
            if (res.status !== 200 || (res.d && res.d.error)) { props.onMsg({ kind: "err", text: (res.d && res.d.error) || ("HTTP " + res.status) }); return; }
            var name = payload.name;
            up({ key: "" });
            props.onRefresh();
            props.onMsg({ kind: "info", text: tr("admin.channelAdded") + name + tr("admin.chTesting") });
            fetch("/portal/api/admin/channel-test?lang=" + deskLang(), { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ name: name }) })
              .then(function (r2) { return r2.json().catch(function () { return {}; }); })
              .then(function (t) {
                if (t && t.ok) props.onMsg({ kind: "ok", text: name + " · " + tr("admin.chTestOk") + (t.ms / 1000).toFixed(1) + tr("admin.chTestOkS") + (t.model ? " · " + t.model : "") + tr("admin.chRestartNote") });
                else props.onMsg({ kind: "err", text: name + " · " + tr("admin.chTestFail") + ((t && t.error) || "?") + tr("admin.chRestartNote") });
              })
              .catch(function () {});
          })
          .catch(function (e) { props.onMsg({ kind: "err", text: String((e && e.message) || e) }); });
      }
      var kids = [];
      var opts = [h("option", { key: "custom", value: "" }, tr("admin.chProviderCustom"))];
      for (var pi = 0; pi < presets.length; pi++) opts.unshift(h("option", { key: "p" + presets[pi].id, value: presets[pi].id }, presets[pi].name));
      var cp = curPreset();
      kids.push(h("div", { key: "pv", style: { display: "flex", flexDirection: "column", gap: 6, marginTop: 6 } },
        h("span", { style: Object.assign({ fontSize: 12 }, muted) }, tr("admin.chProvider")),
        h("select", { value: f.prov, onChange: function (e) { pick(e.target.value); }, style: field }, opts),
        cp ? h("a", { href: cp.keyUrl, target: "_blank", rel: "noreferrer", style: { fontSize: 12 } }, tr("admin.chGetKey")) : null
      ));
      if (!cp) {
        kids.push(h("input", { key: "nm", value: f.name, onChange: function (e) { up({ name: e.target.value }); }, placeholder: tr("admin.phChannelName"), style: field }));
        kids.push(h("input", { key: "bu", value: f.base, onChange: function (e) { up({ base: e.target.value }); }, placeholder: tr("admin.phBaseUrl"), style: field }));
      }
      kids.push(h("input", { key: "ky", value: f.key, onChange: function (e) { up({ key: e.target.value }); }, placeholder: tr("admin.chKeyPh"), type: "password", style: field }));
      var allModels = [];
      if (cp) allModels = cp.models.slice();
      for (var mi = 0; mi < f.models.length; mi++) if (allModels.indexOf(f.models[mi]) < 0) allModels.push(f.models[mi]);
      var chipKids = [];
      for (var ci = 0; ci < allModels.length; ci++) {
        (function (mm) {
          chipKids.push(h("label", { key: "m" + mm, style: { display: "inline-flex", alignItems: "center", gap: 4, margin: "2px 12px 2px 0", fontSize: 12 } },
            h("input", { type: "checkbox", checked: f.models.indexOf(mm) >= 0, onChange: function () { toggleModel(mm); } }),
            mm));
        })(allModels[ci]);
      }
      kids.push(h("div", { key: "ml", style: { display: "flex", flexDirection: "column", gap: 6, marginTop: 2 } },
        h("span", { style: Object.assign({ fontSize: 12 }, muted) }, tr("admin.chPickModels")),
        h("div", { style: { display: "flex", flexWrap: "wrap" } }, chipKids.length ? chipKids : h("span", { style: Object.assign({ fontSize: 12 }, muted) }, tr("admin.chNoModelsHint"))),
        h("div", { style: { display: "flex", gap: 6 } },
          h("input", { value: f.custom, onChange: function (e) { up({ custom: e.target.value }); }, placeholder: tr("admin.chAddModelPh"), style: Object.assign({}, field, { flex: 1 }) }),
          h("button", { style: btnLight, onClick: addCustom }, tr("admin.chAdd"))
        )
      ));
      var priceRows = [];
      for (var prI = 0; prI < f.models.length; prI++) {
        (function (mm) {
          priceRows.push(h("div", { key: "pr" + mm, style: { display: "flex", alignItems: "center", gap: 6, fontSize: 12 } },
            h("span", { style: { minWidth: 150 } }, mm),
            h("input", { value: (f.prices[mm] || {}).in || "", onChange: function (e) { setPrice(mm, "in", e.target.value); }, placeholder: tr("admin.chInPh"), style: Object.assign({}, field, { width: 90 }) }),
            h("input", { value: (f.prices[mm] || {}).out || "", onChange: function (e) { setPrice(mm, "out", e.target.value); }, placeholder: tr("admin.chOutPh"), style: Object.assign({}, field, { width: 90 }) })
          ));
        })(f.models[prI]);
      }
      kids.push(h("details", { key: "adv" },
        h("summary", { style: { fontSize: 12, cursor: "pointer" } }, tr("admin.chAdvanced")),
        h("div", { style: { display: "flex", flexDirection: "column", gap: 6, marginTop: 6 } },
          h("input", { value: f.name, onChange: function (e) { up({ name: e.target.value }); }, placeholder: tr("admin.phChannelName"), style: field }),
          h("input", { value: f.base, onChange: function (e) { up({ base: e.target.value }); }, placeholder: tr("admin.phBaseUrl"), style: field }),
          priceRows.length ? h("div", { style: { display: "flex", flexDirection: "column", gap: 4 } },
            h("span", { style: Object.assign({ fontSize: 12 }, muted) }, tr("admin.chPriceHint")),
            priceRows
          ) : null,
          h("input", { value: f.cap, onChange: function (e) { up({ cap: e.target.value }); }, placeholder: tr("admin.chCapPh"), inputMode: "numeric", style: field }),
          h("input", { value: f.note, onChange: function (e) { up({ note: e.target.value }); }, placeholder: tr("common.phNote"), style: field })
        )
      ));
      kids.push(h("button", { key: "sv", style: btnDark, onClick: submit }, tr("admin.chSaveTest")));
      return h("div", { style: { display: "flex", flexDirection: "column", gap: 6, marginTop: 4 } }, kids);
    }

    /** 模型页扩展位（官方 settings.models.footer）：团队共用模型 Key —— 管理员可改 / 成员只读 */
    function TeamModelsFooter() {
      var langTick = useLocaleSignal();
      var st = React.useState({ phase: "loading", role: "member", upstream: "", keySet: false, keyMasked: "", source: "", writable: true, models: [] });
      var s = st[0];
      var setS = st[1];
      var keyRef = React.useRef(null);
      var msgSt = React.useState(null);
      var msg = msgSt[0];
      var setMsg = msgSt[1];
      var chPair = React.useState([]);
      var chs = chPair[0];
      var setChs = chPair[1];
      var presPair = React.useState([]);
      var presets = presPair[0];
      var setPresets = presPair[1];
      function load() {
        fetch("/portal/api/models-catalog?lang=" + deskLang(), { headers: { accept: "application/json" } })
          .then(function (r) { return r.ok ? r.json() : {}; })
          .catch(function () { return {}; })
          .then(function (cat) {
            return fetch("/portal/api/admin/upstream?lang=" + deskLang(), { headers: { accept: "application/json" } })
              .then(function (r) { return r.status === 403 ? { forbidden: true } : (r.ok ? r.json() : {}); })
              .catch(function () { return {}; })
              .then(function (up) {
                setS({
                  phase: "ready",
                  role: up.forbidden ? "member" : "admin",
                  upstream: (up && up.upstream) || (cat && cat.upstream) || "",
                  keySet: !!(up && up.keySet),
                  keyMasked: (up && up.keyMasked) || "",
                  source: (up && up.source) || "",
                  writable: !up || up.writable !== false,
                  models: (cat && cat.models) || [],
                });
                if (!(up && up.forbidden)) loadChannels();
              });
          });
      }
      function loadChannels() {
        fetch("/portal/api/admin/channels?lang=" + deskLang(), { headers: { accept: "application/json" } })
          .then(function (r) { return r.ok ? r.json() : {}; })
          .catch(function () { return {}; })
          .then(function (d) { setChs((d && d.channels) || []); });
        fetch("/portal/api/admin/channel-presets?lang=" + deskLang(), { headers: { accept: "application/json" } })
          .then(function (r) { return r.ok ? r.json() : {}; })
          .catch(function () { return {}; })
          .then(function (d) { setPresets((d && d.presets) || []); });
      }
      function chPost(path, body, okText, reloadAll) {
        setMsg({ kind: "info", text: tr("common.processing") });
        fetch(path + "?lang=" + deskLang(), { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) })
          .then(function (r) { return r.json().then(function (d) { return { status: r.status, d: d }; }); })
          .then(function (res) {
            if (res.status !== 200 || (res.d && res.d.error)) { setMsg({ kind: "err", text: (res.d && res.d.error) || ("HTTP " + res.status) }); return; }
            setMsg({ kind: "ok", text: okText });
            loadChannels();
            if (reloadAll) load();
          })
          .catch(function (e) { setMsg({ kind: "err", text: String((e && e.message) || e) }); });
      }
      function testChannel(name) {
        setMsg({ kind: "info", text: name + tr("admin.chTesting") });
        fetch("/portal/api/admin/channel-test?lang=" + deskLang(), { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ name: name }) })
          .then(function (r) { return r.json().catch(function () { return {}; }); })
          .then(function (t) {
            if (t && t.ok) setMsg({ kind: "ok", text: name + " · " + tr("admin.chTestOk") + (t.ms / 1000).toFixed(1) + tr("admin.chTestOkS") + (t.model ? " · " + t.model : "") });
            else setMsg({ kind: "err", text: name + " · " + tr("admin.chTestFail") + ((t && t.error) || "?") });
          })
          .catch(function (e) { setMsg({ kind: "err", text: String((e && e.message) || e) }); });
      }
      function toggleChannel(name, on) {
        chPost("/portal/api/admin/channel-toggle", { name: name }, tr("admin.channelToggled") + (on ? tr("common.disable") : tr("common.enable")) + ": " + name + tr("admin.chRestartNote"), true);
      }
      function delChannel(name) {
        if (!window.confirm(tr("admin.delChannel") + name + "?")) return;
        chPost("/portal/api/admin/channel-delete", { name: name }, tr("admin.channelDeleted") + name + tr("admin.chRestartNote"), true);
      }
      React.useEffect(function () { load(); }, [langTick]);
      function save() {
        var raw = keyRef.current ? keyRef.current.value.trim() : "";
        if (!raw) { setMsg({ kind: "err", text: tr("admin.pasteKey") }); return; }
        setMsg({ kind: "info", text: tr("common.saving") });
        fetch("/portal/api/admin/upstream-set?lang=" + deskLang(), { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ api_key: raw }) })
          .then(function (r) { return r.json().then(function (d) { return { status: r.status, d: d }; }); })
          .then(function (res) {
            if (res.status !== 200 || (res.d && res.d.error)) { setMsg({ kind: "err", text: (res.d && res.d.error) || ("HTTP " + res.status) }); return; }
            if (res.d && res.d.unchanged) { setMsg({ kind: "ok", text: tr("admin.sameKey") }); return; }
            if (keyRef.current) keyRef.current.value = "";
            setMsg({ kind: "ok", text: tr("admin.updatedOpen") + ((res.d && res.d.keyMasked) || "") + tr("admin.restartSuffix") });
            setTimeout(function () { load(); }, 12000);
          })
          .catch(function (e) { setMsg({ kind: "err", text: String((e && e.message) || e) }); });
      }
      function chips() {
        if (!s.models.length) return h("span", { style: Object.assign({ fontSize: 12 }, muted) }, tr("team.noModels"));
        return s.models.map(function (m, i) {
          return h("span", { key: "m" + i, style: { display: "inline-block", margin: "2px 4px 0 0", padding: "1px 8px", borderRadius: 999, border: "1px solid var(--dsw-alias-border-l2, rgba(127,127,127,.3))", fontSize: 12 } }, m.name);
        });
      }
      if (s.phase === "loading") return h("div", { style: Object.assign({ fontSize: 12, marginTop: 10 }, muted) }, tr("team.loading"));
      var kids = [];
      var isAdmin = s.role === "admin";
      var titleText = isAdmin ? tr("team.title") : tr("team.titleMember");
      var descText = isAdmin ? tr("team.desc") : tr("team.descMember");
      kids.push(h("div", { key: "t", style: { fontSize: 15, fontWeight: 700 } }, titleText));
      kids.push(h("div", { key: "d", style: Object.assign({ fontSize: 12, marginTop: 2 }, muted) }, descText));
      kids.push(
        h("div", { key: "u", style: { marginTop: 6 } },
          "\u{1F310} " + (s.upstream || "-"),
          isAdmin
            ? h("span", { style: Object.assign({ fontSize: 12, marginLeft: 8 }, muted) },
                s.keySet ? "Key " + s.keyMasked + tr("admin.upstreamSrc") + s.source + ")" : tr("admin.keyMissing"))
            : h("span", { style: Object.assign({ fontSize: 12, marginLeft: 8 }, muted) }, tr("team.locked"))
        )
      );
      if (isAdmin) {
        if (s.writable) {
          kids.push(
            h("div", { key: "e", style: { display: "flex", gap: 6, marginTop: 6, flexWrap: "wrap" } },
              h("input", { ref: keyRef, type: "password", placeholder: tr("admin.keyPh"), style: field }),
              h("button", { style: btnDark, onClick: save }, tr("admin.updateKey"))
            )
          );
        } else {
          kids.push(h("div", { key: "e", style: Object.assign({ fontSize: 12, marginTop: 6 }, muted) }, tr("admin.keyEnvLocked")));
        }
      }
      if (isAdmin) kids.push(h("div", { key: "sn", style: Object.assign({ fontSize: 12, marginTop: 6 }, muted) }, tr("admin.keyScopeNote")));
      if (isAdmin) {
        var chRows = [];
        for (var ci = 0; ci < chs.length; ci++) {
          (function (ch) {
            chRows.push(
              h(
                "div",
                { key: "c" + ch.name, style: rowBase },
                h(
                  "div",
                  { style: { display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 } },
                  h("span", null, ch.name + " ", h("span", { style: Object.assign({ fontSize: 12 }, muted) }, ch.enabled ? tr("common.enable") : tr("common.disable"))),
                  h(
                    "span",
                    { style: { display: "flex", gap: 6 } },
                    h("button", { style: btnSmall, onClick: function () { toggleChannel(ch.name, ch.enabled); } }, ch.enabled ? tr("common.disable") : tr("common.enable")),
                    h("button", { style: btnSmall, onClick: function () { testChannel(ch.name); } }, tr("admin.chTest")),
                    h("button", { style: btnDanger, onClick: function () { delChannel(ch.name); } }, tr("common.delete"))
                  )
                ),
                h("div", { style: Object.assign({ fontSize: 12 }, muted) }, ch.models.join(", ") + (ch.baseUrl ? " \u00b7 " + ch.baseUrl : "") + (ch.keyPrefix ? " \u00b7 key " + ch.keyPrefix : ""))
              )
            );
          })(chs[ci]);
        }
        kids.push(h("div", { key: "chT", style: { fontSize: 15, fontWeight: 700, marginTop: 12 } }, tr("admin.channelsCount") + chs.length + ")"));
        kids.push(h("div", { key: "chD", style: Object.assign({ fontSize: 12, marginTop: 2 }, muted) }, tr("admin.channelsDesc")));
        kids.push(h("div", { key: "chR", style: {} }, chRows.length ? chRows : h("div", { style: muted }, tr("admin.noChannels"))));
        kids.push(
          h(
            "div",
            { key: "chF", style: { marginTop: 4 } },
            h("div", { style: { fontWeight: 600 } }, tr("admin.addChannel")),
            h(ChannelAddForm, {
              presets: presets,
              onMsg: setMsg,
              onRefresh: function () { loadChannels(); load(); },
            })
          )
        );
      }
      kids.push(h("div", { key: "mo", style: { marginTop: 8, fontSize: 12 } }, tr("team.models"), chips()));
      kids.push(h("div", { key: "h", style: Object.assign({ fontSize: 12, marginTop: 8 }, muted) }, tr("team.hint")));
      if (msg) kids.push(h("div", { key: "ms", style: { fontSize: 12, marginTop: 6, color: msg.kind === "err" ? "var(--dsw-alias-label-error, #c0392b)" : "var(--dsw-alias-label-secondary, #65676b)" } }, msg.text));
      return h("div", { style: { display: "flex", flexDirection: "column", borderTop: "1px solid var(--dsw-alias-border-l2, rgba(127,127,127,.25))", marginTop: 14, paddingTop: 12 } }, kids);
    }

    var inject = ["slots", "locale"];

    function apply(ctx) {
      DESK_CTX = ctx;
      try {
        ctx.effect(function () { return ctx.locale.register(DESK_NS, { zh: LOC_ZH, en: LOC_EN }); });
        DESK_T = ctx.locale.bind(DESK_NS);
      } catch (e) { /* 无语言服务时退回中文 */ }

      // 模型页扩展位（官方 settings.models.footer）：团队共用模型 Key（管理员可改；成员只读）
      ctx.slots.inject("settings.models.footer", function () {
        return ctx.slots.register(
          { name: "settings.models.footer", id: "desk-team-models", order: 10 },
          TeamModelsFooter
        );
      });
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
            id: "desk-hub",
            order: 91,
            label: function () {
              return tr("th.tab");
            },
          },
          TeamHub
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
      ctx.slots.inject("sidebar.footer.action", function () {
        return ctx.slots.register(
          {
            name: "sidebar.footer.action",
            id: "desk-usage",
            order: 92,
            label: function () {
              return tr("usg.tab");
            },
          },
          UsagePanel
        );
      });
      ctx.slots.inject("conversation.session.header.utilities", function () {
        return ctx.slots.register(
          {
            name: "conversation.session.header.utilities",
            id: "desk-usage-chip",
            order: 60,
            label: function () {
              return tr("usg.chipTip");
            },
          },
          UsageChip
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
