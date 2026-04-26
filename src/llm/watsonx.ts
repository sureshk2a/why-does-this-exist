import { SYSTEM_PROMPT, buildUserPrompt, parseResponse, stripCodeFences } from './prompt.js';
import type { LLMContext, LLMResult } from './types.js';

const IAM_TOKEN_URL = 'https://iam.cloud.ibm.com/identity/token';

async function getIamToken(apiKey: string): Promise<string> {
  const response = await fetch(IAM_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `grant_type=urn%3Aibm%3Aparams%3Aoauth%3Agrant-type%3Aapikey&apikey=${encodeURIComponent(apiKey)}`,
  });

  if (!response.ok) {
    throw new Error(`IBM IAM token request failed: ${response.status} ${response.statusText}`);
  }

  return ((await response.json()) as { access_token: string }).access_token;
}

export async function synthesizeWithWatsonX(
  apiKey: string,
  projectId: string,
  region: string,
  model: string,
  ctx: LLMContext
): Promise<LLMResult> {
  const bearerToken = await getIamToken(apiKey);
  const url = `https://${region}.ml.cloud.ibm.com/ml/v1/text/chat?version=2024-05-31`;

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${bearerToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model_id: model,
      project_id: projectId,
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: buildUserPrompt(ctx) },
      ],
      parameters: { max_new_tokens: 512, temperature: 0.3 },
    }),
  });

  if (!response.ok) {
    throw new Error(`watsonx.ai request failed: ${response.status} ${await response.text()}`);
  }

  const data = await response.json() as {
    choices: Array<{ message: { content: string } }>;
  };

  return parseResponse(stripCodeFences(data.choices?.[0]?.message?.content ?? '{}'));
}
