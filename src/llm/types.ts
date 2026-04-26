import type { BlameResult } from '../git/index.js';
import type { PullRequestInfo } from '../github/index.js';
import type { TicketInfo } from '../tickets/index.js';

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

export type LLMProvider = 'openai' | 'anthropic' | 'ollama' | 'watsonx';
