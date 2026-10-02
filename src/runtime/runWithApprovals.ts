import {
  run,
  type Agent,
  type AgentInputItem,
  type NonStreamRunOptions,
  type RunResult,
  type RunState,
  type RunToolApprovalItem,
} from '@openai/agents';
import { describeInterruption } from './interruptions';

/** Resolves an approval interruption: return true to approve, false to reject. */
export type ApprovalDecision = (args: {
  description: string;
  interruption: RunToolApprovalItem;
}) => Promise<boolean>;

/**
 * Run an agent, resolving every tool-approval interruption (human-in-the-loop)
 * through the injected `decide` callback before returning.
 *
 * The decision source is deliberately injected: the CLI reads stdin, the
 * gateway bridges a WebSocket round-trip. `options` are threaded to every
 * resumed run so `sandbox: { session }` survives approval round-trips.
 */
export async function runWithApprovals<TAgent extends Agent<any, any>>(
  agent: TAgent,
  input: string | AgentInputItem[] | RunState<any, TAgent>,
  options: NonStreamRunOptions<any, TAgent> | undefined,
  decide: ApprovalDecision,
): Promise<RunResult<any, TAgent>> {
  let result = await run(agent, input, options);
  while (result.interruptions?.length) {
    const state = result.state;
    for (const interruption of result.interruptions) {
      const description = describeInterruption(interruption);
      const approved = await decide({ description, interruption });
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
