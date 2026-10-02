import { DockerSandboxClient, UnixLocalSandboxClient } from '@openai/agents/sandbox/local';
import type { SandboxSessionLike } from '@openai/agents/sandbox';
import { config } from '../config';
import { buildSandboxManifest } from './manifest';

export type ZebraSandboxSession = SandboxSessionLike;

let sessionPromise: Promise<ZebraSandboxSession> | null = null;

/**
 * Create (once, lazily) and reuse the sandbox session across turns. Docker
 * containers are expensive, so keep the container alive for the whole process.
 */
export function getSandboxSession(): Promise<ZebraSandboxSession> {
  if (!sessionPromise) {
    sessionPromise = createSession();
  }
  return sessionPromise;
}

async function createSession(): Promise<ZebraSandboxSession> {
  const manifest = buildSandboxManifest();
  if (config.sandboxBackend === 'docker') {
    const client = new DockerSandboxClient({ image: config.dockerImage });
    return client.create(manifest);
  }
  const client = new UnixLocalSandboxClient();
  return client.create(manifest);
}

/** Close the session on shutdown, if it was ever created. */
export async function closeSandboxSession(): Promise<void> {
  if (!sessionPromise) return;
  const session = await sessionPromise;
  await session.close?.().catch(() => {});
}
