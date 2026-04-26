import { fetchGitHubIssue } from './github.js';
import { fetchJiraTicket } from './jira.js';
import { fetchLinearTicket } from './linear.js';
import type { TicketInfo, TicketConfig } from './types.js';

export { fetchGitHubIssue, fetchJiraTicket, fetchLinearTicket };
export type { TicketInfo, TicketConfig };
/**
 * Given a ticket ID string, determine its source and fetch details.
 * Handles: #123 (GitHub), PROJ-123 (Jira / Linear)
 */
export async function fetchTicket(
  ticketId: string,
  config: TicketConfig
): Promise<TicketInfo | null> {
  if (/^#(\d+)$/.test(ticketId)) {
    const num = parseInt(ticketId.slice(1), 10);
    if (config.githubToken && config.githubOwner && config.githubRepo) {
      return fetchGitHubIssue(config.githubToken, config.githubOwner, config.githubRepo, num);
    }
  }

  if (/^[A-Z][A-Z0-9]+-\d+$/.test(ticketId)) {
    if (config.jiraBaseUrl && config.jiraEmail && config.jiraApiToken) {
      const result = await fetchJiraTicket(
        config.jiraBaseUrl,
        config.jiraEmail,
        config.jiraApiToken,
        ticketId
      );
      if (result) { return result; }
    }

    if (config.linearApiKey) {
      return fetchLinearTicket(config.linearApiKey, ticketId);
    }
  }

  return null;
}
