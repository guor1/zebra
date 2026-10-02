import { Manifest } from '@openai/agents/sandbox';

/**
 * Starter workspace for the sandbox engineer. The agent inspects and modifies
 * these files using the shell / apply_patch tools. Swap `file` entries for
 * `local_dir` (type + `src`) to grant access to a host directory instead.
 */
export function buildSandboxManifest(): Manifest {
  return new Manifest({
    entries: {
      'README.md': {
        type: 'file',
        content: `# Sandbox workspace

This is the Zebra sandbox engineer's isolated workspace.
The agent reads, edits, and runs code here.
`,
      },
      'task.md': {
        type: 'file',
        content: `# Current task

The agent fills this in from the user's request before starting work.
`,
      },
    },
  });
}
