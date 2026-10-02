# Zebra 🦓

A local autonomous agent gateway built on the [OpenAI Agents SDK](https://github.com/openai/openai-agents-js). Zebra can chat, operate a web browser, and write/run scripts inside an isolated Docker sandbox, all through a single CLI entry point that routes each request to the right specialist.

See [PLANS.md](PLANS.md) for the architecture, the explicit non-goals, and the M1–M4 roadmap.

## What it does today (M1)

One router agent (`handoff`) dispatches to three specialists:

| Specialist | Backs on | Does |
| --- | --- | --- |
| Chat Assistant | pure LLM | ordinary conversation and questions |
| Browser Operator | `computerTool` + Playwright | views pages, clicks, types, extracts info |
| Sandbox Engineer | `SandboxAgent` + Docker | writes and runs code/scripts in an isolated container |

Dangerous browser actions (click / type / keypress) pause for human approval.

## Prerequisites

- Node.js 22.18+ (or 24 / 26)
- pnpm
- `OPENAI_API_KEY` in the environment
- Docker CLI + daemon, **or** `ZEBRA_SANDBOX_BACKEND=unix-local` to fall back to local execution (trusted dev only)

## Run

```bash
cd zebra
pnpm install
pnpm exec playwright install chromium   # one-time browser download
export OPENAI_API_KEY=sk-...
pnpm start
```

In the REPL:

- type a message and press enter
- `exit()` — quit
- `/reset` — clear history and return to the router

## Configuration (environment variables)

| Variable | Default | Meaning |
| --- | --- | --- |
| `ZEBRA_MODEL` | `gpt-5.4-mini` | Model name (must be available to your API key) |
| `ZEBRA_SANDBOX_BACKEND` | `docker` | `docker` or `unix-local` |
| `ZEBRA_DOCKER_IMAGE` | `node:22-bookworm-slim` | Image for the Docker sandbox |
| `ZEBRA_BROWSER_HEADLESS` | `1` | `0` to show the browser window |
| `ZEBRA_AUTO_APPROVE` | `0` | `1` to auto-approve browser actions |
| `ZEBRA_MAX_TURNS` | `12` | Max model turns per request |

## Layout

```
src/
  index.ts                     CLI loop + router dispatch + interruption resolution
  config.ts                    all knobs, env-driven
  hitl.ts                      approval prompt + interruption description
  agents/                      router, chat, browser, sandbox agents
  computer/playwrightComputer.ts  Computer interface backed by Playwright
  sandbox/                     manifest + session lifecycle
```
