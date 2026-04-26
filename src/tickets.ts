import { Octokit } from '@octokit/rest';

export interface TicketInfo {
  id: string;
  title: string;
  description: string;
  url: string;
  source: 'github' | 'jira' | 'linear';
}

// ─── GitHub Issues ────────────────────────────────────────────────────────────

export async function fetchGitHubIssue(
  token: string,
  owner: string,
  repo: string,
  issueNumber: number
): Promise<TicketInfo | null> {
  try {
    const octokit = new Octokit({ auth: token });
    const { data } = await octokit.issues.get({ owner, repo, issue_number: issueNumber });
    return {
      id: `#${data.number}`,
      title: data.title,
      description: data.body ?? '',
      url: data.html_url,
      source: 'github',
    };
  } catch {
    return null;
  }
}

// ─── Jira ─────────────────────────────────────────────────────────────────────

export async function fetchJiraTicket(
  baseUrl: string,
  email: string,
  apiToken: string,
  ticketId: string
): Promise<TicketInfo | null> {
  try {
    const credentials = Buffer.from(`${email}:${apiToken}`).toString('base64');
    const url = `${baseUrl.replace(/\/$/, '')}/rest/api/3/issue/${ticketId}`;

    const response = await fetch(url, {
      headers: {
        Authorization: `Basic ${credentials}`,
        Accept: 'application/json',
      },
    });

    if (!response.ok) { return null; }

    const data = await response.json() as {
      fields: { summary: string; description: { content?: unknown } | string | null };
    };

    const description = extractJiraDescription(data.fields.description);

    return {
      id: ticketId,
      title: data.fields.summary ?? '',
      description,
      url: `${baseUrl.replace(/\/$/, '')}/browse/${ticketId}`,
      source: 'jira',
    };
  } catch {
    return null;
  }
}

function extractJiraDescription(desc: unknown): string {
  if (!desc) { return ''; }
  if (typeof desc === 'string') { return desc; }
  // Jira Atlassian Document Format — extract plain text from content nodes
  try {
    return extractAdfText(desc as Record<string, unknown>);
  } catch {
    return '';
  }
}

function extractAdfText(node: Record<string, unknown>): string {
  if (node['type'] === 'text') { return (node['text'] as string) ?? ''; }
  const content = node['content'];
  if (Array.isArray(content)) {
    return (content as Record<string, unknown>[]).map(extractAdfText).join(' ');
  }
  return '';
}

// ─── Linear ───────────────────────────────────────────────────────────────────

export async function fetchLinearTicket(
  apiKey: string,
  ticketId: string
): Promise<TicketInfo | null> {
  try {
    const query = `
      query Issue($id: String!) {
        issue(id: $id) {
          id
          title
          description
          url
        }
      }
    `;

    const response = await fetch('https://api.linear.app/graphql', {
      method: 'POST',
      headers: {
        Authorization: apiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ query, variables: { id: ticketId } }),
    });

    if (!response.ok) { return null; }

    const result = await response.json() as {
      data?: { issue?: { id: string; title: string; description: string; url: string } };
    };
    const issue = result.data?.issue;
    if (!issue) { return null; }

    return {
      id: ticketId,
      title: issue.title,
      description: issue.description ?? '',
      url: issue.url,
      source: 'linear',
    };
  } catch {
    return null;
  }
}

// ─── Dispatcher ───────────────────────────────────────────────────────────────

export interface TicketConfig {
  githubToken?: string;
  githubOwner?: string;
  githubRepo?: string;
  jiraBaseUrl?: string;
  jiraEmail?: string;
  jiraApiToken?: string;
  linearApiKey?: string;
}

/**
 * Given a ticket ID string, determine its source and fetch details.
 * Handles: #123 (GitHub), PROJ-123 (Jira), linear IDs
 */
export async function fetchTicket(
  ticketId: string,
  config: TicketConfig
): Promise<TicketInfo | null> {
  // GitHub issue: #123
  if (/^#(\d+)$/.test(ticketId)) {
    const num = parseInt(ticketId.slice(1), 10);
    if (config.githubToken && config.githubOwner && config.githubRepo) {
      return fetchGitHubIssue(config.githubToken, config.githubOwner, config.githubRepo, num);
    }
  }

  // Jira: PROJ-123
  if (/^[A-Z][A-Z0-9]+-\d+$/.test(ticketId)) {
    if (config.jiraBaseUrl && config.jiraEmail && config.jiraApiToken) {
      const jiraResult = await fetchJiraTicket(
        config.jiraBaseUrl,
        config.jiraEmail,
        config.jiraApiToken,
        ticketId
      );
      if (jiraResult) { return jiraResult; }
    }

    // Also try Linear with same ID pattern
    if (config.linearApiKey) {
      return fetchLinearTicket(config.linearApiKey, ticketId);
    }
  }

  return null;
}
