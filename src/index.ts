import { user, type AgentInputItem } from '@openai/agents';
import { createInterface } from 'node:readline/promises';
import { config, requireOpenAIKey } from './config';
import { createRouter } from './agents/router';
import { runWithInterruptions } from './hitl';
import { closeSandboxSession, getSandboxSession } from './sandbox/session';

async function ask(prompt: string): Promise<string> {
  const rl = createInterface({
    input: process.stdin,
    output: process.stdout,
  });
  const message = await rl.question(prompt);
  rl.close();
  return message;
}

async function main() {
  requireOpenAIKey();

  // Reuse one sandbox session (Docker container) across all turns.
  const sandboxSession = await getSandboxSession();

  const router = createRouter();
  let latestAgent = router;
  let history: AgentInputItem[] = [];

  console.log('Zebra is ready. Type a message, /reset to start over, or exit() to quit.\n');

  try {
    while (true) {
      const message = await ask('> ');
      if (message === 'exit()') break;
      if (message === '/reset') {
        history = [];
        latestAgent = router;
        console.log('[reset] history cleared, back at router.');
        continue;
      }

      history.push(user(message));
      const result = await runWithInterruptions(latestAgent, history, {
        maxTurns: config.maxTurns,
        sandbox: { session: sandboxSession },
      });

      latestAgent = result.lastAgent ?? latestAgent;
      history = result.history;

      const speaker = result.lastAgent?.name ?? 'router';
      const output = String(result.finalOutput ?? '(no output)');
      console.log(`[${speaker}] ${output}`);
      console.log('');
    }
  } finally {
    await closeSandboxSession();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
