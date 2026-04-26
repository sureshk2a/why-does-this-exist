import OpenAI from 'openai';
import { SYSTEM_PROMPT, buildUserPrompt, parseResponse } from './prompt.js';
import type { LLMContext, LLMResult } from './types.js';

export async function synthesizeWithOpenAI(
  apiKey: string,
  ctx: LLMContext
): Promise<LLMResult> {
  const client = new OpenAI({ apiKey });

  const response = await client.chat.completions.create({
    model: 'gpt-4o',
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: buildUserPrompt(ctx) },
    ],
    response_format: { type: 'json_object' },
    temperature: 0.3,
    max_tokens: 512,
  });

  return parseResponse(response.choices[0]?.message?.content ?? '{}');
}
