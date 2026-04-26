import { TicketInfo } from './types.js';

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
      fields: { summary: string; description: unknown };
    };

    return {
      id: ticketId,
      title: data.fields.summary ?? '',
      description: extractJiraDescription(data.fields.description),
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
