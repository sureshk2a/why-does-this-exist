import simpleGit, { SimpleGit } from 'simple-git';
import * as path from 'path';

export interface BlameResult {
  commitSha: string;
  shortSha: string;
  author: string;
  authorEmail: string;
  date: string;
  commitMessage: string;
  repoRoot: string;
  relativeFilePath: string;
}

/**
 * Runs git blame on the given line and returns commit metadata.
 * Falls back to walking history when the blamed commit is a trivial change
 * (e.g. formatting-only commit with a short message).
 */
export async function blameFile(
  filePath: string,
  lineNumber: number
): Promise<BlameResult> {
  const repoRoot = await getRepoRoot(filePath);
  const git: SimpleGit = simpleGit(repoRoot);
  const relativeFilePath = path.relative(repoRoot, filePath).replace(/\\/g, '/');

  // --porcelain gives machine-readable output
  const blameOutput = await git.raw([
    'blame',
    `--porcelain`,
    `-L`,
    `${lineNumber},${lineNumber}`,
    relativeFilePath,
  ]);

  const blamed = parsePorcelainBlame(blameOutput);

  if (!blamed) {
    throw new Error(`Could not extract blame info for line ${lineNumber}`);
  }

  // If the blamed commit looks like a trivial change, walk back to find a more
  // meaningful commit (heuristic: very short commit message or "format"/"lint" keyword)
  if (isTrivialCommit(blamed.commitMessage)) {
    const meaningful = await findMeaningfulCommit(git, relativeFilePath, blamed.commitSha);
    if (meaningful) {
      return { ...meaningful, repoRoot, relativeFilePath };
    }
  }

  return { ...blamed, repoRoot, relativeFilePath };
}

async function getRepoRoot(filePath: string): Promise<string> {
  const dir = path.dirname(filePath);
  const git: SimpleGit = simpleGit(dir);
  const root = await git.revparse(['--show-toplevel']);
  return root.trim();
}

function parsePorcelainBlame(output: string): Omit<BlameResult, 'repoRoot' | 'relativeFilePath'> | null {
  const lines = output.split('\n');
  if (lines.length < 1) { return null; }

  // First line: <SHA> <orig-line> <final-line> [<num-lines>]
  const shaLine = lines[0].split(' ');
  const commitSha = shaLine[0];
  if (!commitSha || commitSha.length < 7) { return null; }

  const shortSha = commitSha.substring(0, 7);
  let author = '';
  let authorEmail = '';
  let date = '';
  let commitMessage = '';

  for (const line of lines.slice(1)) {
    if (line.startsWith('author ')) { author = line.slice(7); }
    else if (line.startsWith('author-mail ')) { authorEmail = line.slice(12).replace(/[<>]/g, ''); }
    else if (line.startsWith('author-time ')) {
      const timestamp = parseInt(line.slice(12), 10);
      date = new Date(timestamp * 1000).toISOString().split('T')[0];
    }
    else if (line.startsWith('summary ')) { commitMessage = line.slice(8); }
  }

  return { commitSha, shortSha, author, authorEmail, date, commitMessage };
}

function isTrivialCommit(message: string): boolean {
  const trivialPatterns = [
    /^format/i, /^lint/i, /^prettier/i, /^eslint/i,
    /^fix typo/i, /^whitespace/i, /^wip$/i, /^cleanup/i,
    /^refactor/i, /^style/i,
  ];
  return message.trim().length < 8 || trivialPatterns.some((p) => p.test(message));
}

async function findMeaningfulCommit(
  git: SimpleGit,
  relativeFilePath: string,
  afterSha: string
): Promise<Omit<BlameResult, 'repoRoot' | 'relativeFilePath'> | null> {
  // Walk the log for this file, skip trivial commits
  const log = await git.log({ file: relativeFilePath, maxCount: 20 });

  // Find the position of the blamed commit in the log
  const idx = log.all.findIndex((c) => c.hash.startsWith(afterSha));
  const candidates = idx >= 0 ? log.all.slice(idx + 1) : log.all;

  for (const commit of candidates) {
    if (!isTrivialCommit(commit.message)) {
      return {
        commitSha: commit.hash,
        shortSha: commit.hash.substring(0, 7),
        author: commit.author_name,
        authorEmail: commit.author_email,
        date: commit.date.split('T')[0],
        commitMessage: commit.message,
      };
    }
  }
  return null;
}
