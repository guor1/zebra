import { Agent } from '@openai/agents';
import { config } from '../config';
import { chatAgent } from './chat';
import { createBrowserAgent } from './browser';
import { sandboxAgent } from './sandbox';

/**
 * The router dispatches each request to the right specialist via handoffs.
 * The browser agent is created per router instance because it holds a
 * per-request computer provider.
 */
export function createRouter() {
  const browserAgent = createBrowserAgent();
  return new Agent({
    name: 'Router',
    model: config.model,
    instructions: [
      'You are the Zebra dispatcher. Classify each request and route it:',
      '- Ordinary conversation and knowledge questions: answer yourself or hand off to the Chat Assistant.',
      '- Anything that requires viewing or interacting with a web page: hand off to the Browser Operator.',
      '- Anything that requires writing, running, or debugging code or scripts, or working with files: hand off to the Sandbox Engineer.',
      'Do not attempt browser, code, or file operations yourself; always hand off.',
    ].join(' '),
    handoffs: [chatAgent, browserAgent, sandboxAgent],
  });
}
