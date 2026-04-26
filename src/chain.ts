import * as vscode from 'vscode';
import simpleGit from 'simple-git';
import * as path from 'path';
import { blameFile, BlameResult } from './git/index.js';
import { findPullRequestForCommit, parseGitHubRemote, PullRequestInfo } from './github/index.js';
import { fetchTicket, TicketInfo } from './tickets/index.js';
import { synthesizeWithOpenAI, synthesizeWithAnthropic, synthesizeWithOllama, synthesizeWithWatsonX, LLMResult } from './llm/index.js';

export interface ChainInput {
  filePath: string;
  lineNumber: number;
  lineText: string;
  config: vscode.WorkspaceConfiguration;
  onProgress: (msg: string) => void;
}

export interface ChainResult {
  blame: BlameResult;
  pr: PullRequestInfo | null;
  tickets: TicketInfo[];
  llm: LLMResult;
}

/**
 * Main pipeline: git blame → PR lookup → ticket fetch → LLM synthesis
 */
export async function runChain(input: ChainInput): Promise<ChainResult> {
  const { filePath, lineNumber, lineText, config, onProgress } = input;

  // ── Step 1: Git blame ────────────────────────────────────────────────────
  onProgress('Running git blame...');
  const blame = await blameFile(filePath, lineNumber);

  // ── Step 2: Resolve GitHub remote ────────────────────────────────────────
  const { owner, repo } = await resolveGitHubRemote(blame.repoRoot);
  const githubToken = config.get<string>('githubToken') ?? '';

  // ── Step 3: Find PR for commit ────────────────────────────────────────────
  onProgress('Looking up pull request...');
  let pr: PullRequestInfo | null = null;
  if (githubToken && owner && repo) {
    pr = await findPullRequestForCommit(githubToken, owner, repo, blame.commitSha);
  }

  // ── Step 4: Fetch linked tickets ──────────────────────────────────────────
  onProgress('Fetching linked tickets...');
  const tickets: TicketInfo[] = [];

  if (pr && pr.linkedTicketIds.length > 0) {
    const ticketConfig = {
      githubToken,
      githubOwner: owner,
      githubRepo: repo,
      jiraBaseUrl: config.get<string>('jiraBaseUrl'),
      jiraEmail: config.get<string>('jiraEmail'),
      jiraApiToken: config.get<string>('jiraApiToken'),
      linearApiKey: config.get<string>('linearApiKey'),
    };

    const ticketResults = await Promise.allSettled(
      pr.linkedTicketIds.map((id) => fetchTicket(id, ticketConfig))
    );

    for (const result of ticketResults) {
      if (result.status === 'fulfilled' && result.value) {
        tickets.push(result.value);
      }
    }
  }

  // ── Step 5: LLM synthesis ─────────────────────────────────────────────────
  onProgress('Synthesizing explanation with AI...');
  const llmContext = {
    lineText,
    lineNumber,
    filePath: path.basename(filePath),
    blame,
    pr,
    tickets,
  };

  const provider = config.get<string>('llmProvider') ?? 'openai';
  let llm: LLMResult;

  if (provider === 'anthropic') {
    const anthropicKey = config.get<string>('anthropicApiKey') ?? '';
    if (!anthropicKey) {
      throw new Error('Anthropic API key not configured. Set whyDoesThisExist.anthropicApiKey in settings.');
    }
    llm = await synthesizeWithAnthropic(anthropicKey, llmContext);
  } else if (provider === 'ollama') {
    const baseUrl = config.get<string>('ollamaBaseUrl') ?? 'http://localhost:11434';
    const model = config.get<string>('ollamaModel') ?? 'llama3';
    llm = await synthesizeWithOllama(baseUrl, model, llmContext);
  } else if (provider === 'watsonx') {
    const watsonxKey = config.get<string>('watsonxApiKey') ?? '';
    const projectId = config.get<string>('watsonxProjectId') ?? '';
    const region = config.get<string>('watsonxRegion') ?? 'us-south';
    const model = config.get<string>('watsonxModel') ?? 'ibm/granite-13b-chat-v2';
    if (!watsonxKey) {
      throw new Error('IBM Cloud API key not configured. Set whyDoesThisExist.watsonxApiKey in settings.');
    }
    if (!projectId) {
      throw new Error('watsonx.ai project ID not configured. Set whyDoesThisExist.watsonxProjectId in settings.');
    }
    llm = await synthesizeWithWatsonX(watsonxKey, projectId, region, model, llmContext);
  } else {
    const openaiKey = config.get<string>('openaiApiKey') ?? '';
    if (!openaiKey) {
      throw new Error('OpenAI API key not configured. Set whyDoesThisExist.openaiApiKey in settings.');
    }
    llm = await synthesizeWithOpenAI(openaiKey, llmContext);
  }

  return { blame, pr, tickets, llm };
}

async function resolveGitHubRemote(
  repoRoot: string
): Promise<{ owner: string; repo: string }> {
  try {
    const git = simpleGit(repoRoot);
    const remotes = await git.getRemotes(true);
    const origin = remotes.find((r) => r.name === 'origin') ?? remotes[0];
    if (!origin) { return { owner: '', repo: '' }; }

    const fetchUrl = origin.refs?.fetch ?? '';
    const parsed = parseGitHubRemote(fetchUrl);
    return parsed ?? { owner: '', repo: '' };
  } catch {
    return { owner: '', repo: '' };
  }
}
