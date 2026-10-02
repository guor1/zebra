import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

/** Project root, resolved from this file's location (src/ → repo root). */
const PROJECT_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

/**
 * Load configuration from `.env` files, following the dotenv convention:
 * values already present in the real environment win over `.env`.
 *
 * Precedence (highest first):
 *   1. process env (exported / shell / systemd)
 *   2. .env.local  (machine-specific overrides)
 *   3. .env
 *
 * Uses Node's built-in `process.loadEnvFile`, which refuses to override
 * variables that are already set, so no values are silently clobbered.
 */
export function loadEnvFiles(): void {
  for (const name of ['.env', '.env.local']) {
    const path = resolve(PROJECT_ROOT, name);
    if (existsSync(path)) {
      process.loadEnvFile(path);
    }
  }
}
