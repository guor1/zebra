/**
 * All runtime knobs, driven by environment variables so nothing is hardcoded.
 * Model names in the SDK examples (e.g. `gpt-5.4`) may not match your API key.
 */
export const config = {
  /** Model name. Must be available to your OPENAI_API_KEY. */
  model: process.env.ZEBRA_MODEL ?? 'gpt-5.4-mini',

  /** Sandbox execution backend: 'docker' (default) or 'unix-local' (trusted dev only). */
  sandboxBackend: (process.env.ZEBRA_SANDBOX_BACKEND ?? 'docker') as
    | 'docker'
    | 'unix-local',

  /** Docker image used by the sandbox when backend is 'docker'. */
  dockerImage:
    process.env.ZEBRA_DOCKER_IMAGE ?? 'node:22-bookworm-slim',

  /** Show the browser window instead of headless. */
  browserHeadless: process.env.ZEBRA_BROWSER_HEADLESS !== '0',

  /** Auto-approve browser click/type/keypress (dangerous; dev only). */
  autoApprove: process.env.ZEBRA_AUTO_APPROVE === '1',

  /** Max model turns per request. */
  maxTurns: Number(process.env.ZEBRA_MAX_TURNS ?? 12),
} as const;

export function requireOpenAIKey(): string {
  const key = process.env.OPENAI_API_KEY;
  if (!key) {
    throw new Error('OPENAI_API_KEY must be set before running zebra.');
  }
  return key;
}
