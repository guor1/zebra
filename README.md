# Zebra 🦓

A local autonomous agent gateway built on the [OpenAI Agents SDK](https://github.com/openai/openai-agents-js). Zebra can chat, operate a web browser, and write/run scripts inside an isolated Docker sandbox, all through a single CLI entry point that routes each request to the right specialist.

See [PLANS.md](PLANS.md) for the architecture, the explicit non-goals, and the M1–M4 roadmap.

## What it does today (M1 + M2)

One router agent (`handoff`) dispatches to three specialists:

| Specialist | Backs on | Does |
| --- | --- | --- |
| Chat Assistant | pure LLM | ordinary conversation and questions |
| Browser Operator | `computerTool` + Playwright | views pages, clicks, types, extracts info |
| Sandbox Engineer | `SandboxAgent` + Docker | writes and runs code/scripts in an isolated container |

Dangerous browser actions (click / type / keypress) pause for human approval.

Two entry points share one runtime:

- **CLI** (`pnpm start`) — terminal REPL.
- **Gateway** (`pnpm start:gateway`) — a long-lived HTTP + WebSocket server serving a browser WebChat at `http://127.0.0.1:3000`. Approvals bridge back to the browser as a confirm dialog.

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
pnpm start          # CLI
pnpm start:gateway  # WebChat at http://127.0.0.1:3000
```

### Self-hosted / OpenAI-compatible models

Set `ZEBRA_MODEL_BACKEND=compatible` and point at any OpenAI-compatible server
(Ollama, vLLM, LM Studio, llama.cpp, …). Zebra then speaks Chat Completions and
skips the OpenAI tracing exporter, so no `OPENAI_API_KEY` is needed.

```bash
export ZEBRA_MODEL_BACKEND=compatible
export ZEBRA_MODEL_BASE_URL=http://127.0.0.1:11434/v1   # e.g. Ollama
export ZEBRA_MODEL=qwen2.5-coder                          # any model the server exposes
pnpm start
```

**Known limitation:** in `compatible` mode the sandbox exposes a reduced
toolset. `apply_patch` is replaced by a function-tool fallback with the same
name, and `view_image` returns data URLs instead of image parts; the Chat
Completions wire format only carries plain function tools and string outputs.
Everything else (chat, handoffs, `exec_command`) works unchanged.

In the CLI REPL:

- type a message and press enter
- `exit()` — quit
- `/reset` — clear history and return to the router

## Configuration (environment variables)

| Variable | Default | Meaning |
| --- | --- | --- |
| `ZEBRA_MODEL` | `gpt-5.4-mini` | Model name to request |
| `ZEBRA_MODEL_BACKEND` | `openai` | `openai` or `compatible` |
| `ZEBRA_MODEL_BASE_URL` | `http://127.0.0.1:11434/v1` | Base URL for the `compatible` backend |
| `ZEBRA_MODEL_API_KEY` | `zebra` | API key for the `compatible` backend |
| `ZEBRA_SANDBOX_BACKEND` | `docker` | `docker` or `unix-local` |
| `ZEBRA_DOCKER_IMAGE` | `node:22-bookworm-slim` | Image for the Docker sandbox |
| `ZEBRA_BROWSER_HEADLESS` | `1` | `0` to show the browser window |
| `ZEBRA_AUTO_APPROVE` | `0` | `1` to auto-approve browser actions |
| `ZEBRA_MAX_TURNS` | `12` | Max model turns per request |
| `ZEBRA_GATEWAY_PORT` | `3000` | Gateway HTTP + WebSocket port |

## Layout

```
src/
  index.ts                     entry: CLI REPL or gateway mode
  config.ts                    all knobs, env-driven
  modelProvider.ts             installs OpenAI or OpenAI-compatible provider
  runtime/
    session.ts                 per-connection conversation (history + handoff chain + turn queue)
    runWithApprovals.ts        run() wrapper that resolves HITL approvals via a callback
    interruptions.ts           human-readable approval descriptions
  agents/                      router, chat, browser, sandbox agents
  computer/playwrightComputer.ts  Computer interface backed by Playwright
  sandbox/                     manifest + session lifecycle
  gateway/server.ts            HTTP + WebSocket gateway, WS protocol, approval bridging
web/index.html                 zero-build WebChat client
```

## Gateway protocol (newline-delimited JSON over `/ws`)

| Client → Server | Server → Client |
| --- | --- |
| `{type:"message", id, text}` | `{type:"response", id, speaker, output}` |
| `{type:"approval", id, approved}` | `{type:"approval_required", id, description, tool}` |
| `{type:"reset"}` | `{type:"reset_done"}` |
| | `{type:"error", error}` |

One WebSocket connection = one conversation session. Turns are serialized per
connection, so a connection never runs two model requests at once.
