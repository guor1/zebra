# Zebra — 基于 OpenAI Agents SDK 的本地智能体网关

一个跑在你机器上的自主智能体系统：能聊天、能操作浏览器、能在 Docker 沙箱里写脚本跑任务。用 OpenAI Agents SDK 提供 agent 运行时，自己只盖分发层（Gateway + 渠道 + UX）。

## 1. 目标与非目标

**目标**

- CLI 入口，一个 router agent 通过 `handoff` 调度三个专职 agent：聊天 / 浏览器 / 沙箱。
- 沙箱执行默认走 Docker（`SandboxAgent` + `DockerSandboxClient`），可信网关 / 不可信执行。
- 浏览器操作走 `computerTool` + Playwright，危险动作需人工审批（human-in-the-loop）。

**非目标（明确取舍）**

| 砍掉 / 推迟 | 理由 |
| --- | --- |
| 语音 / realtime | 暂不做（SDK 有 `agents-realtime`，后续可补）|
| 移动端 / 桌面伴随 app、设备节点 | OpenClaw 最重、复利最低的部分 |
| 20+ 消息渠道 | 先只做 1 个入口（CLI），渠道是"多但薄"的工作，后期按需加 |
| 插件市场 / 正式 plugin SDK | 用 monorepo 模块化替代，留扩展点即可 |
| cron、多用户 / 团队认证、模型 failover | M4+ 再说 |

## 2. 架构（分层，解耦是核心）

```
apps/cli                 # M1：单机 CLI 入口（tsx 直跑）
packages/
  runtime/               # 【内核】纯 SDK 用法：agent 定义、工具、skill、策略
  gateway/               # 【自建】长驻守护进程 + WebSocket 控制面 + 会话队列 + 事件总线
  channels/              # 【自建】渠道适配器：统一 Channel 接口
  web/                   # 控制 UI + WebChat（M2+）
```

**关键抽象**：`Channel` 接口（`onMessage / sendMessage / pairing`）。让 runtime 完全不知道消息来自哪里 —— 这是 OpenClaw 架构里最值得抄的一点。M1 还没到这一步，先按单包组织，M2 再拆 monorepo。

## 3. M1 交付物

单机 CLI，一个 router agent 通过 `handoff` 调度三个专职 agent：

```
cli 输入
  └─► RouterAgent ──handoff──► ChatAgent          (纯 LLM)
                  ├─────────► BrowserAgent       (computerTool + Playwright)
                  └─────────► SandboxAgent       (DockerSandboxClient)
```

**文件树（M1 单包）：**

```
zebra/
├── package.json                 # deps: @openai/agents@0.18.0, playwright
├── tsconfig.json
├── .gitignore
├── README.md
├── PLANS.md
└── src/
    ├── index.ts                 # CLI 主循环（多轮 + handoff 续跑 + HITL）
    ├── config.ts                # 模型名、镜像、审批开关，全部走 env
    ├── hitl.ts                  # interruptions → approve/reject 循环
    ├── agents/
    │   ├── router.ts            # handoffs: [chat, browser, sandbox]
    │   ├── chat.ts
    │   ├── browser.ts           # computerTool + needsApproval
    │   └── sandbox.ts           # SandboxAgent + Capabilities.default()
    ├── computer/
    │   └── playwrightComputer.ts # Computer 接口实现（抄 examples/tools/computer-use.ts）
    └── sandbox/
        ├── manifest.ts          # 沙箱工作区初始文件
        └── session.ts           # Docker/Unix-local 沙箱 session 生命周期
```

## 4. 关键技术决策

1. **执行隔离**：默认 Docker 沙箱。exec 不进宿主机；`ZEBRA_SANDBOX_BACKEND=unix-local` 可退到本地（仅可信开发用）。
2. **浏览器**：`computerTool` + 自实现 Playwright `Computer`，`needsApproval` 拦截 click/type/keypress。
3. **模型**：默认 OpenAI（`ZEBRA_MODEL`，默认 `gpt-5.4-mini`）。后续用 `ModelProvider` 接口 + `agents-extensions` 的 AI SDK 适配器接 Anthropic/本地，不自己写 provider。
4. **会话**：M1 用内存 `AgentInputItem[]` 历史（仿 `examples/basic/chat.ts`）；M2 换 `Session` + SQLite 持久化。
5. **技术栈**：Node 22.18+ / 24 / 26 + TypeScript + pnpm + `tsx` 直跑；依赖锁定 `@openai/agents@0.18.0`。

## 5. 风险与对策

- **模型名硬编码坑**：SDK 示例写 `gpt-5.4`，实际以你的 key 为准 → 全部走 `config.ts` 的 env（`ZEBRA_MODEL`）。
- **沙箱不是完美边界**（SDK 自己 README 也承认）：对不可信输入仍要 `maxTurns` + 审批。
- **HITL 恢复 + 沙箱组合是 M1 最大集成风险**：`run(agent, state)` 恢复时需重新传入 `sandbox: { session }`；每次 run 都带 `sandbox` 选项，session 在进程内复用。
- **Playwright 是重依赖**：首次 `pnpm install` 后需 `pnpm exec playwright install chromium`。

## 6. 路线图

- **M1（本次）**：CLI + 三 agent + handoff + Docker 沙箱 + 浏览器 + HITL
- **M2**：拆出 Gateway 守护进程 + WebSocket 控制面 + WebChat
- **M3**：Telegram 渠道（验证 Channel 抽象）+ 审批策略 + SQLite 会话持久化
- **M4+**：cron、第二渠道、多用户

## 7. 运行

```bash
cd zebra
pnpm install
pnpm exec playwright install chromium
export OPENAI_API_KEY=sk-...
pnpm start
```

对话中 `exit()` 退出，`/reset` 回到 router 并清空历史。
