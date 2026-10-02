import { SandboxAgent, Capabilities } from '@openai/agents/sandbox';
import { config } from '../config';
import { buildSandboxManifest } from '../sandbox/manifest';

const manifest = buildSandboxManifest();

/**
 * Writes and runs code/scripts inside an isolated sandbox. Capabilities.default()
 * provides filesystem + shell + compaction, which exposes exec_command and
 * apply_patch tools to the model.
 */
export const sandboxAgent = new SandboxAgent({
  name: 'Sandbox Engineer',
  model: config.model,
  instructions: [
    'You are an autonomous engineer that writes and runs code inside an isolated sandbox.',
    'Inspect files before editing. Make the smallest correct change.',
    'Prefer apply_patch for file edits. Run the relevant tests or commands to verify, then summarize the change and any risks.',
    'The shell starts in the workspace root; use relative paths.',
  ].join(' '),
  defaultManifest: manifest,
  capabilities: Capabilities.default(),
});
