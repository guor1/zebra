import { Agent, computerTool, type Computer } from '@openai/agents';
import { config } from '../config';
import { PlaywrightComputer } from '../computer/playwrightComputer';

/**
 * The browser is created per request (disposed when the run ends) so
 * concurrent runs never share page state.
 */
export function createBrowserAgent() {
  return new Agent({
    name: 'Browser Operator',
    model: config.model,
    instructions:
      'You operate a web browser. Use the computer tool to open pages, click, type, scroll, and read the screen, then report what you found. Prefer taking a screenshot to understand the page before acting.',
    tools: [
      computerTool({
        computer: {
          // Cast is required: the published Computer type carries a
          // Record<string, never> index signature no class can satisfy.
          create: async () =>
            (new PlaywrightComputer({
              headless: config.browserHeadless,
            }).init() as unknown as Computer),
          dispose: async ({ computer }) =>
            (computer as unknown as PlaywrightComputer).dispose(),
        },
        needsApproval: async (_ctx, action) => {
          if (config.autoApprove) return false;
          const type = (action as { type?: string }).type;
          // Require human sign-off for state-changing actions.
          return ['click', 'type', 'keypress', 'double_click'].includes(
            type ?? '',
          );
        },
      }),
    ],
  });
}
