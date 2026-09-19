# 试用验收记录（P4-21）

> 验收日期：2026-09-19 · 方式：真实生产路径（门户登录 → 反代 → 本人实例 → 网关 → DeepSeek）· 验收账号：bob（成员）、alice（成员）

## 清单与结果

| # | 步骤 | 期望 | 实测 |
|---|---|---|---|
| 1 | 门户登录（POST /login） | 302 建立会话 | ✅ 302 |
| 2 | 身份确认（/portal/me） | 200 | ✅ 200 |
| 3 | 进入工作台（经门户根路径反代） | 200（本人实例页面） | ✅ 200 |
| 4 | 建会话（RPC `session.create`，cwd=本人 workspace） | 返回 sessionId | ✅ `session-7dd75e24-8614-42cd-ac15-3f93dc3b458f` |
| 5 | 发消息（RPC `session.prompt`，经门户） | `accepted:true` | ✅ `accepted:true` |
| 6 | 记账（`/portal/api/usage`） | 事件增加、费用入账 | ✅ 2 条：¥0.007819（主请求）+ ¥0.000141（标题请求）= **¥0.00796** |
| 7 | 网关日志 | usage=found | ✅ `[gw] user=bob model=deepseek-v4-flash channel=default stream usage=found` ×2 |
| 8 | alice 快速确认（登录 / 身份 / 工作台） | 全 200 | ✅ 全部 200 |

## 复现命令（核心段）

```sh
# bob 为例；替换 username/password 即可
curl -s -c /tmp/acc.cj -X POST -d "username=bob&password=<密码>" http://127.0.0.1:8080/login
curl -s -b /tmp/acc.cj -o /dev/null -w "%{http_code}\n" http://127.0.0.1:8080/portal/me   # 200
SID=$(curl -s -b /tmp/acc.cj -X POST http://127.0.0.1:8080/api/session.create -H "content-type: application/json" \
  -d '{"type":"client-request","rpcId":"acc-1","method":"session.create","payload":{"cwd":"/home/yangc/desk-test/u2/workspace"}}' \
  | grep -oP '"sessionId":"\K[^"]+' | head -1)
curl -s -b /tmp/acc.cj -X POST http://127.0.0.1:8080/api/session.prompt -H "content-type: application/json" \
  -d "{\"type\":\"client-request\",\"rpcId\":\"acc-2\",\"method\":\"session.prompt\",\"payload\":{\"sessionId\":\"$SID\",\"mode\":\"queue\",\"content\":[{\"type\":\"text\",\"text\":\"验收测试：请只回复四个字——工作台正常\"}]}}"
curl -s -b /tmp/acc.cj http://127.0.0.1:8080/portal/api/usage
```

## 备注

- **手机端 UI 最终确认**仍待本人在同 Wi-Fi 手机上打开 `http://192.168.0.171:8080` 验证（P0-4 的 🟡）。
- 金额为本地价目表估值（非厂商账单）；口径以网关记账为准。
- 验收同时覆盖：反代路径、信任围栏（经门户的 Host 为门户 authority）、网关计费、账本接口、会话创建。
