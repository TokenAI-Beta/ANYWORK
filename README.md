# DSH-ANYWORK

[English](README.md) | [中文](README.zh.md)

**A self-hosted team workbench built around [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness).**

Each member signs in with their own account and works in their own isolated workspace. The model API key stays on the server, and usage is metered per person — so a team can share one agent setup without sharing keys, files, or bills.

> **Status: building in public, early stage.** P0 (feasibility) and P1 (model gateway + per-person metering) are done and verified end-to-end against the real API. P2 is in progress — login and the usage portal are live; the instance login-gate/proxy is next. Full roadmap and 22-task plan in [`docs/PLAN.md`](docs/PLAN.md); verified findings in [`docs/BASELINE.md`](docs/BASELINE.md); daily progress in [`docs/devlog/`](docs/devlog/).

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
| P2 | Accounts, login, portal | 🟡 login & portal live; instance proxy next |
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

# 3. CLI: users, passwords, budgets, usage
node src/cli.ts user add alice             # prints her virtual key once
node src/cli.ts user passwd alice <password>   # portal login password
node src/cli.ts user budget alice 50       # monthly budget in CNY (or: off)
node src/cli.ts usage alice --month
```

Open the portal at `http://<machine>:8080` — each member signs in and sees their own usage; admins manage members at `/portal/admin`. Point any dsh instance at the gateway with the member's virtual key:

```sh
DEEPSEEK_BASE_URL=http://127.0.0.1:8100 DEEPSEEK_API_KEY=sk-desk-… dsh web --port 3301
```

## License

[MIT](LICENSE). This is a third-party project and is not affiliated with DeepSeek.
