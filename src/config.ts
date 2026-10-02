/**
 * All runtime knobs, driven by environment variables so nothing is hardcoded.
 * Model names in the SDK examples (e.g. `gpt-5.4`) may not match your API key.
 */
import { loadEnvFiles } from './env';

// Must run before the config object below reads process.env.
loadEnvFiles();

export type ModelBackend =
  | 'openai'
  | 'compatible';

export const config = {
  /** Model name to request from the provider. */
  model: process.env.ZEBRA_MODEL ?? 'gpt-5.4-mini',

  /**
   * Which backend serves the model:
   * - 'openai': the official OpenAI API (default).
   * - 'compatible': an OpenAI-compatible endpoint (Ollama, vLLM, LM Studio, ...).
   */
  modelBackend: (process.env.ZEBRA_MODEL_BACKEND ?? 'openai') as ModelBackend,

  /** Base URL for the 'compatible' backend. Ignored for 'openai'. */
  modelBaseUrl: process.env.ZEBRA_MODEL_BASE_URL ?? 'http://127.0.0.1:11434/v1',

  /** API key for the 'compatible' backend. Ignored for 'openai'. */
  modelApiKey: process.env.ZEBRA_MODEL_API_KEY ?? 'zebra',

  /** Sandbox execution backend: 'docker' (default) or 'unix-local' (trusted dev only). */
  sandboxBackend: (process.env.ZEBRA_SANDBOX_BACKEND ?? 'docker') as
    | 'docker'
    | 'unix-local',

  /** Docker image used by the sandbox when backend is 'docker'. */
  dockerImage: process.env.ZEBRA_DOCKER_IMAGE ?? 'node:22-bookworm-slim',

  /** Show the browser window instead of headless. */
  browserHeadless: process.env.ZEBRA_BROWSER_HEADLESS !== '0',

  /** Auto-approve browser click/type/keypress (dangerous; dev only). */
  autoApprove: process.env.ZEBRA_AUTO_APPROVE === '1',

  /** Max model turns per request. */
  maxTurns: Number(process.env.ZEBRA_MAX_TURNS ?? 12),

  /** Gateway HTTP + WebSocket listen port. */
  gatewayPort: Number(process.env.ZEBRA_GATEWAY_PORT ?? 3000),
} as const;

export function requireOpenAIKey(): string {
  const key = process.env.OPENAI_API_KEY;
  if (!key) {
    throw new Error('OPENAI_API_KEY must be set before running zebra.');
  }
  return key;
}
