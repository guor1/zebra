import type { RunToolApprovalItem } from '@openai/agents';

/**
 * Render a human-readable description of an approval interruption so both the
 * CLI and the gateway can present the same text to the user.
 */
export function describeInterruption(interruption: RunToolApprovalItem): string {
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
