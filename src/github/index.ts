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
  const match = remoteUrl.match(/github\.com[/:]([^/]+)\/([^/.]+)(\.git)?/);
  if (match) {
    return { owner: match[1], repo: match[2] };
  }
  return null;
}

/**
 * Extracts ticket IDs from PR body text.
 * Handles: Fixes #123, Closes #456, JIRA-789, LINEAR-101, ABC-202
 */
export function extractTicketIds(text: string): string[] {
  const ids = new Set<string>();
  let m: RegExpExecArray | null;

  const githubKeyword = /(?:closes?|fixes?|resolves?)\s+#(\d+)/gi;
  while ((m = githubKeyword.exec(text)) !== null) { ids.add(`#${m[1]}`); }

  const bareGithub = /#(\d{1,6})\b/g;
  while ((m = bareGithub.exec(text)) !== null) { ids.add(`#${m[1]}`); }

  const jiraPattern = /\b([A-Z][A-Z0-9]+-\d+)\b/g;
  while ((m = jiraPattern.exec(text)) !== null) { ids.add(m[1]); }

  return [...ids];
}

/**
 * Finds the pull request that introduced a commit.
 * Primary: GitHub's commits/:sha/pulls endpoint.
 * Fallback: search PRs by short SHA (handles squash merges).
 */
export async function findPullRequestForCommit(
  token: string,
  owner: string,
  repo: string,
  commitSha: string
): Promise<PullRequestInfo | null> {
  const octokit = new Octokit({ auth: token });

  try {
    const { data } = await octokit.repos.listPullRequestsAssociatedWithCommit({
      owner,
      repo,
      commit_sha: commitSha,
    });
    if (data.length > 0) {
      return buildPrInfo(data[0]);
    }
  } catch {
    // fall through to search fallback
  }

  return searchPrByCommitSha(octokit, owner, repo, commitSha);
}

async function searchPrByCommitSha(
  octokit: Octokit,
  owner: string,
  repo: string,
  commitSha: string
): Promise<PullRequestInfo | null> {
  try {
    const { data } = await octokit.search.issuesAndPullRequests({
      q: `repo:${owner}/${repo} is:pr is:merged ${commitSha.substring(0, 7)}`,
      per_page: 1,
    });
    if (data.items.length === 0) { return null; }

    const { data: pr } = await octokit.pulls.get({
      owner,
      repo,
      pull_number: data.items[0].number,
    });
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
