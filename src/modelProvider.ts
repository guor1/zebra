import {
  setDefaultModelProvider,
  setTracingDisabled,
  type ModelProvider,
} from '@openai/agents';
import {
  OpenAIProvider,
  OpenAIChatCompletionsModel,
} from '@openai/agents';
import OpenAI from 'openai';
import { config } from './config';

/**
 * Install the model provider for the whole process. Agents that don't pass an
 * explicit `model` fall back to this provider; the model name they use is
 * resolved against it.
 *
 * - 'openai'     → the official OpenAI API (Responses API by default).
 * - 'compatible' → an OpenAI-compatible endpoint (Ollama, vLLM, LM Studio, …)
 *                  via the Chat Completions API, which is the lowest common
 *                  denominator most self-hosted servers implement.
 */
export function installModelProvider(): void {
  if (config.modelBackend === 'compatible') {
    const client = new OpenAI({
      apiKey: config.modelApiKey,
      baseURL: config.modelBaseUrl,
    });
    setDefaultModelProvider(new CompatibleProvider(client));
    // The OpenAI tracing exporter would otherwise log "No API key provided"
    // on every export. Self-hosted endpoints don't write to OpenAI's backend.
    setTracingDisabled(true);
  } else {
    setDefaultModelProvider(
      new OpenAIProvider({ cacheResponsesWebSocketModels: false }),
    );
  }
}

class CompatibleProvider implements ModelProvider {
  constructor(private readonly client: OpenAI) {}

  async getModel(modelName?: string): Promise<OpenAIChatCompletionsModel> {
    return new OpenAIChatCompletionsModel(
      this.client,
      modelName || config.model,
    );
  }
}
