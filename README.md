# DSH-ANYWORK

[English](README.md) | [中文](README.zh.md)

**A self-hosted team workbench built around [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness).**

Each member signs in with their own account and works in their own isolated workspace. The model API key stays on the server, and usage is metered per person — so a team can share one agent setup without sharing keys, files, or bills.

> **Status: building in public, early stage.** The first milestone is the foundation: login, per-member workspaces, and a central model gateway with per-person metering. Full roadmap and 22-task plan in [`docs/PLAN.md`](docs/PLAN.md); daily progress lands in [`docs/devlog/`](docs/devlog/).

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
| P0 | Feasibility checks: multi-instance, launch flags, gateway interception, LAN access | ⬜ |
| P1 | Model gateway + per-person metering | ⬜ |
| P2 | Accounts, login, portal | ⬜ |
| P3 | Per-member workspaces (instance management, autostart) | ⬜ |
| P4 | Delivery: install, backup, acceptance | ⬜ |

Each task has a concrete acceptance check; the full list is in [`docs/PLAN.md`](docs/PLAN.md).

## Development

Nothing to run yet — implementation starts at P0. Follow [`docs/devlog/`](docs/devlog/) for day-by-day progress.

## License

[MIT](LICENSE). This is a third-party project and is not affiliated with DeepSeek.
