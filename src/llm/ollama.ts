import OpenAI from 'openai';
import { SYSTEM_PROMPT, buildUserPrompt, parseResponse, stripCodeFences } from './prompt.js';
import type { LLMContext, LLMResult } from './types.js';

export async function synthesizeWithOllama(
  baseUrl: string,
  model: string,
  ctx: LLMContext
): Promise<LLMResult> {
  const client = new OpenAI({
    apiKey: 'ollama',
    baseURL: `${baseUrl.replace(/\/$/, '')}/v1`,
  });

  const response = await client.chat.completions.create({
    model,
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: buildUserPrompt(ctx) },
    ],
    temperature: 0.3,
    max_tokens: 512,
  });

  return parseResponse(stripCodeFences(response.choices[0]?.message?.content ?? '{}'));
}
