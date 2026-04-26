export interface TicketInfo {
  id: string;
  title: string;
  description: string;
  url: string;
  source: 'github' | 'jira' | 'linear';
}

export interface TicketConfig {
  githubToken?: string;
  githubOwner?: string;
  githubRepo?: string;
  jiraBaseUrl?: string;
  jiraEmail?: string;
  jiraApiToken?: string;
  linearApiKey?: string;
}
