# Why Was This Written? — VS Code Extension

Traces any line of code back through **git blame → PR → ticket → LLM** to explain *why* it was written, not just what it does.

## Install

Search **"Why Was This Written"** in the VS Code Extensions panel (`Ctrl+Shift+X`), or install from the [Marketplace](https://marketplace.visualstudio.com/items?itemName=sureshk2a.why-was-this-written).

## Usage

1. Open any file in a git-tracked project
2. Click on the line you want to understand
3. Right-click → **Why Was This Written?**

A side panel will show:
- An AI-generated explanation of *why* the code was introduced
- The commit that introduced it
- The pull request that merged it
- Any linked Jira / Linear / GitHub issue tickets

## Configuration

Open VS Code settings (`Ctrl+,`) and search **"Why Was This Written"**:

| Setting | Description |
|---|---|
| `githubToken` | GitHub PAT with `repo` scope — needed to look up pull requests |
| `llmProvider` | `openai` (default), `anthropic`, `ollama`, or `watsonx` |
| `openaiApiKey` | OpenAI API key (for GPT-4o) |
| `anthropicApiKey` | Anthropic API key (for Claude 3.5 Sonnet) |
| `ollamaBaseUrl` | Ollama server URL (default: `http://localhost:11434`) |
| `ollamaModel` | Ollama model name (default: `llama3`) |
| `watsonxApiKey` | IBM Cloud API key |
| `watsonxProjectId` | watsonx.ai project ID |
| `watsonxRegion` | watsonx.ai region (default: `us-south`) |
| `watsonxModel` | watsonx.ai model ID (default: `ibm/granite-13b-chat-v2`) |
| `jiraBaseUrl` | e.g. `https://yourorg.atlassian.net` |
| `jiraEmail` | Jira account email |
| `jiraApiToken` | Jira API token (from [id.atlassian.com](https://id.atlassian.com/manage-profile/security/api-tokens)) |
| `linearApiKey` | Linear API key |

The only required setting is `githubToken` + one LLM API key. Jira/Linear are optional — the extension works without them and will show commit + PR context only.

## How it works

```
git blame → commit SHA
         → GitHub API → PR title + description + linked ticket IDs
                          → Jira / Linear / GitHub Issues (optional)
→ LLM (GPT-4o / Claude / Ollama / watsonx) → plain-English explanation
→ VS Code side panel
```

Ticket IDs are detected automatically from PR descriptions — e.g. `Fixes KAN-42`, `Closes #123`.

## Source

[github.com/sureshk2a/why-does-this-exist](https://github.com/sureshk2a/why-does-this-exist)

