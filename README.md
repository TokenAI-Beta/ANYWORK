# DSH-ANYWORK

[English](README.md) | [中文](README.zh.md)

**A self-hosted team workbench built around [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness).**

Each member signs in with their own account and works in their own isolated workspace. The model API key stays on the server, and usage is metered per person — so a team can share one agent setup without sharing keys, files, or bills.

> **Status: building in public, early stage.** P0 (feasibility), P1 (model gateway + per-person metering) and P2 (accounts, login, portal, per-member instance proxy) are done and verified on the LAN. P3 (instance management & autostart) is next. Roadmap and 22-task plan in [`docs/PLAN.md`](docs/PLAN.md); verified findings in [`docs/BASELINE.md`](docs/BASELINE.md); daily progress in [`docs/devlog/`](docs/devlog/).

## What this is

- **Engine**: the official [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) (`dsh`, MIT) — agent capabilities, tools, and the sandbox are reused as-is. This project does not modify dsh's source.
- **Shell (this repo)**: accounts and login, one isolated dsh instance and workspace per member, a model gateway that never exposes the real API key (per-person accounting and budget limits), and a portal to tie it together.
- In one line: **dsh does the work; DSH-ANYWORK decides who gets to use it, where, and at what cost.**

## Architecture (target)

```text
Member browser → Portal (login gate + reverse proxy)
                 ├─ /portal/*   portal pages (my usage / admin)
                 └─ all other paths → that member's dsh instance (HTTP + WS passthrough)
                        │
        dsh instance pool (one per member: own home / workspace / port)
                        │  DEEPSEEK_BASE_URL → gateway
                Model gateway (holds the real key, meters per person, enforces budgets)
                        │
                api.deepseek.com
```

## Roadmap

| Phase | Scope | Status |
|---|---|---|
| P0 | Feasibility checks: multi-instance, launch flags, gateway interception, LAN access | 🟡 phone check pending |
| P1 | Model gateway + per-person metering | ✅ verified end-to-end |
| P2 | Accounts, login, portal | ✅ login, portal & instance proxy live |
| P3 | Per-member workspaces (instance management, autostart) | ⬜ |
| P4 | Delivery: install, backup, acceptance | ⬜ |

Each task has a concrete acceptance check; the full list is in [`docs/PLAN.md`](docs/PLAN.md).

## Development

Requirements: **Node 24+** — and nothing else. The service is dependency-free (`node:http`, `node:sqlite`, built-in `fetch`), and TypeScript sources run directly via Node's type stripping.

```sh
# 1. Real upstream key (stays on the server)
mkdir -p ~/.desk
echo 'DEEPSEEK_API_KEY=sk-…' > ~/.desk/keys.env
chmod 600 ~/.desk/keys.env

# 2. Portal + model gateway (one process; portal :8080, gateway :8100 on loopback)
node src/server.ts

# 3. CLI: users, passwords, budgets, instance ports, usage
node src/cli.ts user add alice             # prints her virtual key once
node src/cli.ts user passwd alice <password>   # portal login password
node src/cli.ts user budget alice 50       # monthly budget in CNY (or: off)
node src/cli.ts user agent alice 3301      # bind her dsh instance port
node src/cli.ts usage alice --month
```

Open the portal at `http://<machine>:8080` — each member signs in, sees their own usage, and lands in their own dsh instance. Admins manage members at `/portal/admin`.

Start a member's dsh instance with the helper (reads `~/.desk/agents/<user>.key`, adds `--trusted-host` for the portal authority automatically):

```sh
DESK_PORTAL_AUTHORITY=<portal host:port> scripts/start-agent.sh alice 3301 ~/desk-test/u1
```

### Workbench settings page (dsh client plugin)

`plugin/desk-panel/` is a small **dsh client plugin** that adds a **工作台用量** (my usage) page to the dsh Settings dialog, built on dsh's official client-plugin API (`settings.section` slot + `dsh plugin`) — **no dsh source changes, no build step, no npm dependencies**. Mount it per instance:

```sh
DSH_HOME=<instance home> node <dsh checkout>/apps/cli/lib/bin.js plugin --profile web add \
  file:<this repo>/plugin/desk-panel
```

Data comes from the portal's `/portal/api/usage` — open the workbench through the portal to see it.

## License

[MIT](LICENSE). This is a third-party project and is not affiliated with DeepSeek.
