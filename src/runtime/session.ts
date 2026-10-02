import { user, type Agent, type AgentInputItem } from '@openai/agents';
import type { SandboxSessionLike } from '@openai/agents/sandbox';
import { config } from '../config';
import { createRouter } from '../agents/router';
import { runWithApprovals, type ApprovalDecision } from './runWithApprovals';

export interface TurnResult {
  speaker: string;
  output: string;
}

/**
 * One conversation. Owns the router handoff chain and the message history, and
 * serializes turns so a single connection can never mutate shared state from
 * two in-flight messages.
 */
export class Session {
  readonly id: string;
  private readonly router: Agent<any, any>;
  private latestAgent: Agent<any, any>;
  private history: AgentInputItem[] = [];
  private queue: Promise<unknown> = Promise.resolve();

  constructor(
    id: string,
    private readonly sandboxSession: SandboxSessionLike,
  ) {
    this.id = id;
    this.router = createRouter();
    this.latestAgent = this.router;
  }

  reset(): Promise<void> {
    return this.enqueue(async () => {
      this.history = [];
      this.latestAgent = this.router;
    });
  }

  handleMessage(text: string, decide: ApprovalDecision): Promise<TurnResult> {
    return this.enqueue(() => this.runTurn(text, decide));
  }

  private enqueue<T>(task: () => Promise<T>): Promise<T> {
    const run = this.queue.then(task);
    // Keep the chain alive after a rejected turn.
    this.queue = run.catch(() => {});
    return run;
  }

  private async runTurn(
    text: string,
    decide: ApprovalDecision,
  ): Promise<TurnResult> {
    this.history.push(user(text));
    const result = await runWithApprovals(
      this.latestAgent,
      this.history,
      {
        maxTurns: config.maxTurns,
        sandbox: { session: this.sandboxSession },
      },
      decide,
    );
    this.latestAgent = result.lastAgent ?? this.latestAgent;
    this.history = result.history;
    const speaker = result.lastAgent?.name ?? 'router';
    const output = String(result.finalOutput ?? '(no output)');
    return { speaker, output };
  }
}
