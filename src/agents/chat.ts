import { Agent } from '@openai/agents';
import { config } from '../config';
import { buildChatTools } from './tools';

/** Ordinary conversation with a couple of example function tools. */
export const chatAgent = new Agent({
  name: 'Chat Assistant',
  model: config.model,
  instructions:
    'You are a friendly general assistant. Use your tools (get_weather, get_current_time) when they fit the request, otherwise answer conversation and knowledge questions concisely. If the request needs a web browser, the execution of code or scripts, or local files, do not attempt it yourself — hand off to the specialist that owns it.',
  tools: buildChatTools(),
});
