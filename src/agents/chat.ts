import { Agent } from '@openai/agents';
import { config } from '../config';

/** Ordinary conversation: a pure-LLM specialist with no tools. */
export const chatAgent = new Agent({
  name: 'Chat Assistant',
  model: config.model,
  instructions:
    'You are a friendly general assistant. Answer conversation and knowledge questions concisely. If the request needs a web browser, the execution of code or scripts, or local files, do not attempt it yourself — hand off to the specialist that owns it.',
});
