import { Octokit } from '@octokit/rest';
import type { TicketInfo } from './types.js';

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
