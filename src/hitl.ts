import {
  run,
  type Agent,
  type AgentInputItem,
  type RunResult,
  type RunState,
  type RunToolApprovalItem,
  type NonStreamRunOptions,
} from '@openai/agents';
import { createInterface } from 'node:readline/promises';
import { config } from './config';

async function confirm(question: string): Promise<boolean> {
  if (config.autoApprove) {
    console.log(`[auto-approve] ${question}`);
    return true;
  }
  const rl = createInterface({
    input: process.stdin,
    output: process.stdout,
  });
  const answer = await rl.question(`${question} (y/n): `);
  rl.close();
  const normalized = answer.trim().toLowerCase();
  return normalized === 'y' || normalized === 'yes';
}

function describeInterruption(interruption: RunToolApprovalItem): string {
  const rawItem = interruption.rawItem as { type?: string } & Record<string, unknown>;
  if (rawItem.type === 'computer_call') {
    const actions = Array.isArray(rawItem.actions) && rawItem.actions.length > 0
      ? (rawItem.actions as Array<{ type?: string }>)
      : rawItem.action
        ? [rawItem.action as { type?: string }]
        : [];
    if (actions.length > 1) {
      return `computer actions [${actions.map((a) => a?.type ?? 'unknown').join(', ')}]`;
    }
    const action = actions[0];
    if (action?.type === 'type') {
      const text = String((action as { text?: string }).text ?? '');
      return `computer "type" with text "${text.length > 120 ? `${text.slice(0, 117)}...` : text}"`;
    }
    if (action?.type === 'keypress') {
      const keys = (action as { keys?: string[] }).keys ?? [];
      return `computer "keypress" with keys [${keys.join(', ')}]`;
    }
    if (action?.type === 'click' || action?.type === 'double_click') {
      const { x, y } = action as { x?: number; y?: number };
      return `computer "${action.type}" at (${x}, ${y})`;
    }
    if (action?.type === 'scroll') {
      const { scroll_x, scroll_y } = action as { scroll_x?: number; scroll_y?: number };
      return `computer "scroll" by (${scroll_x}, ${scroll_y})`;
    }
    if (action?.type) return `computer "${action.type}"`;
    return 'computer action';
  }
  return interruption.name ?? 'tool action';
}

/**
 * Run an agent, resolving any tool-approval interruptions (human-in-the-loop)
 * before returning. `options` are threaded to every resumed run so things like
 * `sandbox: { session }` survive the approval round-trips.
 */
export async function runWithInterruptions<TAgent extends Agent<any, any>>(
  agent: TAgent,
  input: string | AgentInputItem[] | RunState<any, TAgent>,
  options?: NonStreamRunOptions<any, TAgent>,
): Promise<RunResult<any, TAgent>> {
  let result = await run(agent, input, options);
  while (result.interruptions?.length) {
    const state = result.state;
    for (const interruption of result.interruptions) {
      const description = describeInterruption(interruption);
      const approved = await confirm(
        `Agent ${interruption.agent.name} requested ${description}. Approve?`,
      );
      if (approved) {
        state.approve(interruption);
      } else {
        state.reject(interruption, {
          message: `Tool execution for "${interruption.name}" was dismissed by the user. You may ask to run it again if needed.`,
        });
      }
    }
    result = await run(agent, state, options);
  }
  return result;
}
