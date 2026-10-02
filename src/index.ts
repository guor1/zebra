import { createInterface } from 'node:readline/promises';
import { config, requireOpenAIKey } from './config';
import { installModelProvider } from './modelProvider';
import { startGateway } from './gateway/server';
import { Session } from './runtime/session';
import { getSandboxSession, closeSandboxSession } from './sandbox/session';

const MODE = process.argv[2] ?? 'cli';

installModelProvider();

async function ask(prompt: string): Promise<string> {
  const rl = createInterface({
    input: process.stdin,
    output: process.stdout,
  });
  const message = await rl.question(prompt);
  rl.close();
  return message;
}

async function runCli() {
  if (config.modelBackend === 'openai') {
    requireOpenAIKey();
  }

  // Reuse one sandbox session (Docker container) across all turns.
  const sandboxSession = await getSandboxSession();
  const session = new Session('cli', sandboxSession);

  console.log('Zebra is ready. Type a message, /reset to start over, or exit() to quit.\n');

  try {
    while (true) {
      const message = await ask('> ');
      if (message === 'exit()') break;
      if (message === '/reset') {
        await session.reset();
        console.log('[reset] history cleared, back at router.');
        continue;
      }

      const { speaker, output } = await session.handleMessage(message, async ({ description }) => {
        if (config.autoApprove) {
          console.log(`[auto-approve] ${description}`);
          return true;
        }
        const answer = await ask(`Approve ${description}? (y/n): `);
        return answer.trim().toLowerCase() === 'y' || answer.trim().toLowerCase() === 'yes';
      });

      console.log(`[${speaker}] ${output}`);
      console.log('');
    }
  } finally {
    await closeSandboxSession();
  }
}

function runGateway() {
  const { close } = startGateway();
  console.log(`Zebra gateway listening on http://127.0.0.1:${config.gatewayPort}`);
  const shutdown = async () => {
    await close();
    process.exit(0);
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

if (MODE === 'gateway') {
  runGateway();
} else {
  runCli().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}
