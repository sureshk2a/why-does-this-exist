import type { LLMContext } from './types.js';

export const SYSTEM_PROMPT = `You are a code archaeology assistant. Given metadata about a specific line of code — including the git blame, pull request description, and linked ticket context — explain WHY this code exists in plain, concise English.

Focus on:
1. The business or technical reason the code was written
2. Any notable decisions or trade-offs mentioned
3. The problem it was solving at the time

Do NOT describe what the code does technically. Explain why it was introduced.
Respond with JSON matching this schema:
{
  "summary": "One sentence summary (max 20 words)",
  "explanation": "2-5 sentences explaining the business/technical reason",
  "confidence": "high | medium | low"
}

Confidence levels:
- high: ticket + PR context available
- medium: PR context only, no ticket
- low: only commit message available`;

export function buildUserPrompt(ctx: LLMContext): string {
  const parts: string[] = [
    `FILE: ${ctx.filePath}`,
    `LINE ${ctx.lineNumber}: \`${ctx.lineText}\``,
    '',
    `COMMIT: ${ctx.blame.shortSha} by ${ctx.blame.author} on ${ctx.blame.date}`,
    `COMMIT MESSAGE: ${ctx.blame.commitMessage}`,
  ];

  if (ctx.pr) {
    parts.push('', `PULL REQUEST #${ctx.pr.number}: ${ctx.pr.title}`, `PR AUTHOR: ${ctx.pr.author}`);
    if (ctx.pr.mergedAt) { parts.push(`MERGED: ${ctx.pr.mergedAt.split('T')[0]}`); }
    if (ctx.pr.body.trim()) {
      parts.push(`PR DESCRIPTION:\n${ctx.pr.body.substring(0, 1500)}`);
    }
  }

  for (const ticket of ctx.tickets) {
    parts.push('', `TICKET [${ticket.source.toUpperCase()}] ${ticket.id}: ${ticket.title}`);
    if (ticket.description.trim()) {
      parts.push(`TICKET DESCRIPTION:\n${ticket.description.substring(0, 1000)}`);
    }
  }

  return parts.join('\n');
}

export function parseResponse(raw: string): import('./types.js').LLMResult {
  try {
    const parsed = JSON.parse(raw) as Partial<import('./types.js').LLMResult>;
    return {
      explanation: parsed.explanation ?? 'No explanation available.',
      summary: parsed.summary ?? '',
      confidence: parsed.confidence ?? 'low',
    };
  } catch {
    return { explanation: raw, summary: '', confidence: 'low' };
  }
}

export function stripCodeFences(text: string): string {
  return text.replace(/```(?:json)?\n?/g, '').trim();
}
