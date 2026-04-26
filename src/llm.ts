import OpenAI from 'openai';
import Anthropic from '@anthropic-ai/sdk';
import { BlameResult } from './git';
import { PullRequestInfo } from './github';
import { TicketInfo } from './tickets';

export interface LLMContext {
  lineText: string;
  lineNumber: number;
  filePath: string;
  blame: BlameResult;
  pr: PullRequestInfo | null;
  tickets: TicketInfo[];
}

export interface LLMResult {
  explanation: string;
  summary: string;
  confidence: 'high' | 'medium' | 'low';
}

const SYSTEM_PROMPT = `You are a code archaeology assistant. Given metadata about a specific line of code — including the git blame, pull request description, and linked ticket context — explain WHY this code exists in plain, concise English.

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

function buildUserPrompt(ctx: LLMContext): string {
  const parts: string[] = [];

  parts.push(`FILE: ${ctx.filePath}`);
  parts.push(`LINE ${ctx.lineNumber}: \`${ctx.lineText}\``);
  parts.push('');
  parts.push(`COMMIT: ${ctx.blame.shortSha} by ${ctx.blame.author} on ${ctx.blame.date}`);
  parts.push(`COMMIT MESSAGE: ${ctx.blame.commitMessage}`);

  if (ctx.pr) {
    parts.push('');
    parts.push(`PULL REQUEST #${ctx.pr.number}: ${ctx.pr.title}`);
    parts.push(`PR AUTHOR: ${ctx.pr.author}`);
    if (ctx.pr.mergedAt) {
      parts.push(`MERGED: ${ctx.pr.mergedAt.split('T')[0]}`);
    }
    if (ctx.pr.body.trim()) {
      const truncatedBody = ctx.pr.body.substring(0, 1500);
      parts.push(`PR DESCRIPTION:\n${truncatedBody}`);
    }
  }

  if (ctx.tickets.length > 0) {
    for (const ticket of ctx.tickets) {
      parts.push('');
      parts.push(`TICKET [${ticket.source.toUpperCase()}] ${ticket.id}: ${ticket.title}`);
      if (ticket.description.trim()) {
        const truncatedDesc = ticket.description.substring(0, 1000);
        parts.push(`TICKET DESCRIPTION:\n${truncatedDesc}`);
      }
    }
  }

  return parts.join('\n');
}

export async function synthesizeWithOpenAI(
  apiKey: string,
  ctx: LLMContext
): Promise<LLMResult> {
  const client = new OpenAI({ apiKey });
  const userPrompt = buildUserPrompt(ctx);

  const response = await client.chat.completions.create({
    model: 'gpt-4o',
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: userPrompt },
    ],
    response_format: { type: 'json_object' },
    temperature: 0.3,
    max_tokens: 512,
  });

  const content = response.choices[0]?.message?.content ?? '{}';
  return parseResponse(content);
}

export async function synthesizeWithAnthropic(
  apiKey: string,
  ctx: LLMContext
): Promise<LLMResult> {
  const client = new Anthropic({ apiKey });
  const userPrompt = buildUserPrompt(ctx);

  const message = await client.messages.create({
    model: 'claude-3-5-sonnet-20241022',
    max_tokens: 512,
    system: SYSTEM_PROMPT,
    messages: [{ role: 'user', content: userPrompt }],
  });

  const content = message.content[0]?.type === 'text' ? message.content[0].text : '{}';

  // Claude may wrap JSON in markdown code fences — strip them
  const stripped = content.replace(/```(?:json)?\n?/g, '').trim();
  return parseResponse(stripped);
}

export async function synthesizeWithOllama(
  baseUrl: string,
  model: string,
  ctx: LLMContext
): Promise<LLMResult> {
  const client = new OpenAI({
    apiKey: 'ollama', // Ollama doesn't require a real key
    baseURL: `${baseUrl.replace(/\/$/, '')}/v1`,
  });
  const userPrompt = buildUserPrompt(ctx);

  const response = await client.chat.completions.create({
    model,
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: userPrompt },
    ],
    temperature: 0.3,
    max_tokens: 512,
  });

  const content = response.choices[0]?.message?.content ?? '{}';
  const stripped = content.replace(/```(?:json)?\n?/g, '').trim();
  return parseResponse(stripped);
}

export async function synthesizeWithWatsonX(
  apiKey: string,
  projectId: string,
  region: string,
  model: string,
  ctx: LLMContext
): Promise<LLMResult> {
  // Step 1: Exchange IBM API key for IAM bearer token
  const iamResponse = await fetch('https://iam.cloud.ibm.com/identity/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `grant_type=urn%3Aibm%3Aparams%3Aoauth%3Agrant-type%3Aapikey&apikey=${encodeURIComponent(apiKey)}`,
  });

  if (!iamResponse.ok) {
    throw new Error(`IBM IAM token request failed: ${iamResponse.status} ${iamResponse.statusText}`);
  }

  const iamData = await iamResponse.json() as { access_token: string };
  const bearerToken = iamData.access_token;

  // Step 2: Call watsonx.ai text/chat endpoint
  const url = `https://${region}.ml.cloud.ibm.com/ml/v1/text/chat?version=2024-05-31`;
  const userPrompt = buildUserPrompt(ctx);

  const wxResponse = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${bearerToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model_id: model,
      project_id: projectId,
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: userPrompt },
      ],
      parameters: {
        max_new_tokens: 512,
        temperature: 0.3,
      },
    }),
  });

  if (!wxResponse.ok) {
    const errText = await wxResponse.text();
    throw new Error(`watsonx.ai request failed: ${wxResponse.status} ${errText}`);
  }

  const wxData = await wxResponse.json() as {
    choices: Array<{ message: { content: string } }>;
  };

  const content = wxData.choices?.[0]?.message?.content ?? '{}';
  const stripped = content.replace(/```(?:json)?\n?/g, '').trim();
  return parseResponse(stripped);
}

function parseResponse(raw: string): LLMResult {
  try {
    const parsed = JSON.parse(raw) as Partial<LLMResult>;
    return {
      explanation: parsed.explanation ?? 'No explanation available.',
      summary: parsed.summary ?? '',
      confidence: parsed.confidence ?? 'low',
    };
  } catch {
    // If JSON parse fails, return the raw text as explanation
    return {
      explanation: raw,
      summary: '',
      confidence: 'low',
    };
  }
}
