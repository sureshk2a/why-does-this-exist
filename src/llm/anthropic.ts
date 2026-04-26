import Anthropic from '@anthropic-ai/sdk';
import { SYSTEM_PROMPT, buildUserPrompt, parseResponse, stripCodeFences } from './prompt.js';
import type { LLMContext, LLMResult } from './types.js';

export async function synthesizeWithAnthropic(
  apiKey: string,
  ctx: LLMContext
): Promise<LLMResult> {
  const client = new Anthropic({ apiKey });

  const message = await client.messages.create({
    model: 'claude-3-5-sonnet-20241022',
    max_tokens: 512,
    system: SYSTEM_PROMPT,
    messages: [{ role: 'user', content: buildUserPrompt(ctx) }],
  });

  const raw = message.content[0]?.type === 'text' ? message.content[0].text : '{}';
  return parseResponse(stripCodeFences(raw));
}
