import { TicketInfo } from './types.js';

const LINEAR_GQL_ENDPOINT = 'https://api.linear.app/graphql';

const ISSUE_QUERY = `
  query Issue($id: String!) {
    issue(id: $id) {
      id
      title
      description
      url
    }
  }
`;

export async function fetchLinearTicket(
  apiKey: string,
  ticketId: string
): Promise<TicketInfo | null> {
  try {
    const response = await fetch(LINEAR_GQL_ENDPOINT, {
      method: 'POST',
      headers: {
        Authorization: apiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ query: ISSUE_QUERY, variables: { id: ticketId } }),
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
