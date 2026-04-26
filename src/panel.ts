import * as vscode from 'vscode';
import { ChainResult } from './chain';

export class ResultPanel {
  private static currentPanel: ResultPanel | undefined;
  private readonly _panel: vscode.WebviewPanel;

  private constructor(panel: vscode.WebviewPanel) {
    this._panel = panel;
    this._panel.onDidDispose(() => {
      ResultPanel.currentPanel = undefined;
    });
  }

  static show(
    extensionUri: vscode.Uri,
    result: ChainResult,
    lineText: string,
    lineNumber: number,
    fileName: string
  ): void {
    if (ResultPanel.currentPanel) {
      ResultPanel.currentPanel._panel.reveal(vscode.ViewColumn.Beside);
      ResultPanel.currentPanel._update(result, lineText, lineNumber, fileName);
      return;
    }

    const panel = vscode.window.createWebviewPanel(
      'whyDoesThisExist',
      'Why Does This Exist?',
      vscode.ViewColumn.Beside,
      { enableScripts: false, retainContextWhenHidden: true }
    );

    ResultPanel.currentPanel = new ResultPanel(panel);
    ResultPanel.currentPanel._update(result, lineText, lineNumber, fileName);
  }

  private _update(
    result: ChainResult,
    lineText: string,
    lineNumber: number,
    fileName: string
  ): void {
    this._panel.webview.html = buildHtml(result, lineText, lineNumber, fileName);
  }
}

function confidenceBadge(level: 'high' | 'medium' | 'low'): string {
  const colors: Record<string, string> = {
    high: '#27AE60',
    medium: '#F39C12',
    low: '#E74C3C',
  };
  const bg = colors[level] ?? '#555';
  return `<span style="background:${bg};color:#fff;padding:2px 8px;border-radius:4px;font-size:11px;text-transform:uppercase;font-weight:600;">${level} confidence</span>`;
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function buildHtml(
  result: ChainResult,
  lineText: string,
  lineNumber: number,
  fileName: string
): string {
  const { blame, pr, tickets, llm } = result;

  const ticketsHtml = tickets.length > 0
    ? tickets.map((t) => `
        <div class="card ticket">
          <div class="card-header">
            <span class="source-badge ${t.source}">${t.source.toUpperCase()}</span>
            <a href="${escapeHtml(t.url)}">${escapeHtml(t.id)}: ${escapeHtml(t.title)}</a>
          </div>
          ${t.description ? `<p class="desc">${escapeHtml(t.description.substring(0, 400))}${t.description.length > 400 ? '\u2026' : ''}</p>` : ''}
        </div>`).join('')
    : '<p class="muted">No linked tickets found.</p>';

  const prHtml = pr
    ? `<div class="card">
        <div class="card-header">
          <span class="pr-num">PR #${pr.number}</span>
          <a href="${escapeHtml(pr.url)}">${escapeHtml(pr.title)}</a>
        </div>
        <div class="meta">by <strong>${escapeHtml(pr.author)}</strong>${pr.mergedAt ? ` &middot; merged ${pr.mergedAt.split('T')[0]}` : ''}</div>
      </div>`
    : '<p class="muted">No pull request found for this commit.</p>';

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline';">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Why Does This Exist?</title>
<style>
  body { font-family: var(--vscode-font-family); font-size: 13px; color: var(--vscode-foreground); background: var(--vscode-editor-background); padding: 20px; margin: 0; }
  h1 { font-size: 16px; margin: 0 0 4px; }
  h2 { font-size: 13px; font-weight: 600; margin: 20px 0 8px; text-transform: uppercase; letter-spacing: 0.5px; opacity: 0.7; }
  code { font-family: var(--vscode-editor-font-family); background: var(--vscode-textBlockQuote-background); padding: 2px 6px; border-radius: 3px; font-size: 12px; }
  .explanation { font-size: 14px; line-height: 1.7; background: var(--vscode-textBlockQuote-background); border-left: 3px solid var(--vscode-focusBorder); padding: 12px 16px; border-radius: 0 4px 4px 0; margin: 12px 0; }
  .summary { font-size: 15px; font-weight: 600; margin-bottom: 8px; }
  .card { background: var(--vscode-editorWidget-background); border: 1px solid var(--vscode-widget-border); border-radius: 6px; padding: 12px; margin: 8px 0; }
  .card-header { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
  .card-header a { color: var(--vscode-textLink-foreground); text-decoration: none; }
  .card-header a:hover { text-decoration: underline; }
  .meta { font-size: 11px; opacity: 0.7; margin-top: 4px; }
  .desc { font-size: 12px; opacity: 0.8; margin: 8px 0 0; }
  .muted { opacity: 0.5; font-style: italic; font-size: 12px; }
  .pr-num { font-weight: 700; color: var(--vscode-charts-purple); }
  .source-badge { padding: 1px 6px; border-radius: 3px; font-size: 10px; font-weight: 700; color: #fff; }
  .source-badge.github { background: #24292e; }
  .source-badge.jira { background: #0052CC; }
  .source-badge.linear { background: #5E6AD2; }
  .blame-row { display: flex; gap: 16px; flex-wrap: wrap; font-size: 12px; opacity: 0.8; }
  .blame-row span::before { content: attr(data-label) ': '; font-weight: 600; opacity: 0.7; }
  .divider { border: none; border-top: 1px solid var(--vscode-widget-border); margin: 20px 0; }
</style>
</head>
<body>
<h1>Why Does This Exist?</h1>
<p class="meta"><code>${escapeHtml(fileName)}</code> &middot; line ${lineNumber}</p>
<code>${escapeHtml(lineText.substring(0, 120))}</code>

<div class="explanation">
  ${llm.summary ? `<div class="summary">${escapeHtml(llm.summary)}</div>` : ''}
  ${escapeHtml(llm.explanation)}
</div>
<div>${confidenceBadge(llm.confidence)}</div>

<hr class="divider">

<h2>Commit</h2>
<div class="card">
  <div class="blame-row">
    <span data-label="SHA">${escapeHtml(blame.shortSha)}</span>
    <span data-label="Author">${escapeHtml(blame.author)}</span>
    <span data-label="Date">${escapeHtml(blame.date)}</span>
  </div>
  <p style="margin:8px 0 0;font-style:italic;">"${escapeHtml(blame.commitMessage)}"</p>
</div>

<h2>Pull Request</h2>
${prHtml}

<h2>Linked Tickets</h2>
${ticketsHtml}

</body>
</html>`;
}
