import { Octokit } from '@octokit/rest';

export interface PullRequestInfo {
  number: number;
  title: string;
  body: string;
  url: string;
  author: string;
  mergedAt: string | null;
  linkedTicketIds: string[];
}

/**
 * Extracts owner and repo from a GitHub remote URL.
 * Supports both HTTPS and SSH formats.
 */
export function parseGitHubRemote(remoteUrl: string): { owner: string; repo: string } | null {
  // HTTPS: https://github.com/owner/repo.git
  const httpsMatch = remoteUrl.match(/github\.com[/:]([^/]+)\/([^/.]+)(\.git)?/);
  if (httpsMatch) {
    return { owner: httpsMatch[1], repo: httpsMatch[2] };
  }
  return null;
}

/**
 * Finds the pull request that introduced a commit.
 * Primary: GitHub's commits/:sha/pulls endpoint.
 * Fallback: search PRs by commit SHA in title/body.
 */
export async function findPullRequestForCommit(
  token: string,
  owner: string,
  repo: string,
  commitSha: string
): Promise<PullRequestInfo | null> {
  const octokit = new Octokit({ auth: token });

  try {
    // Primary path: list PRs associated with commit
    const { data } = await octokit.repos.listPullRequestsAssociatedWithCommit({
      owner,
      repo,
      commit_sha: commitSha,
    });

    if (data.length > 0) {
      const pr = data[0];
      return buildPrInfo(pr);
    }
  } catch {
    // Fall through to search fallback
  }

  // Fallback: search merged PRs that mention the short SHA
  return searchPrByCommitSha(octokit, owner, repo, commitSha);
}

async function searchPrByCommitSha(
  octokit: Octokit,
  owner: string,
  repo: string,
  commitSha: string
): Promise<PullRequestInfo | null> {
  const shortSha = commitSha.substring(0, 7);
  try {
    const { data } = await octokit.search.issuesAndPullRequests({
      q: `repo:${owner}/${repo} is:pr is:merged ${shortSha}`,
      per_page: 1,
    });

    if (data.items.length === 0) { return null; }

    const prNumber = data.items[0].number;
    const { data: pr } = await octokit.pulls.get({ owner, repo, pull_number: prNumber });
    return buildPrInfo(pr);
  } catch {
    return null;
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function buildPrInfo(pr: any): PullRequestInfo {
  const body: string = pr.body ?? '';
  return {
    number: pr.number,
    title: pr.title ?? '',
    body,
    url: pr.html_url ?? '',
    author: pr.user?.login ?? 'unknown',
    mergedAt: pr.merged_at ?? null,
    linkedTicketIds: extractTicketIds(body),
  };
}

/**
 * Extracts ticket IDs from PR body text.
 * Handles: Fixes #123, Closes #456, JIRA-789, LINEAR-101, ABC-202
 */
export function extractTicketIds(text: string): string[] {
  const ids = new Set<string>();

  // GitHub Issues: #123, Fixes #123, Closes #456, Resolves #789
  const githubPattern = /(?:closes?|fixes?|resolves?)\s+#(\d+)/gi;
  let m: RegExpExecArray | null;
  while ((m = githubPattern.exec(text)) !== null) {
    ids.add(`#${m[1]}`);
  }

  // Bare #number references
  const bareGithub = /#(\d{1,6})\b/g;
  while ((m = bareGithub.exec(text)) !== null) {
    ids.add(`#${m[1]}`);
  }

  // Jira-style: PROJ-123, ABC-456
  const jiraPattern = /\b([A-Z][A-Z0-9]+-\d+)\b/g;
  while ((m = jiraPattern.exec(text)) !== null) {
    ids.add(m[1]);
  }

  return [...ids];
}
