import { tool } from '@openai/agents';
import { z } from 'zod';

/**
 * Example function tools. Copy these to add your own: each entry is a typed
 * function the model can call, with a Zod schema for its arguments.
 *
 * These are registered on the Chat Assistant so conversational requests can
 * also take action. Tools work on both the `openai` and `compatible` model
 * backends (function tools map cleanly to Chat Completions).
 */

const getWeather = tool({
  name: 'get_weather',
  description: 'Get the current weather for a city.',
  parameters: z.object({
    city: z.string().describe('The city to get weather for.'),
  }),
  async execute({ city }: { city: string }) {
    return `The weather in ${city} is sunny, 22C.`;
  },
});

const getCurrentTime = tool({
  name: 'get_current_time',
  description: 'Get the current date and time in the host timezone.',
  parameters: z.object({}),
  async execute() {
    return new Date().toString();
  },
});

export function buildChatTools() {
  return [getWeather, getCurrentTime];
}
