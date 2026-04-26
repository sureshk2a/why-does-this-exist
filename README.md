# Why Does This Exist? — VS Code Extension

Traces any line of code back through **git blame → PR → ticket → LLM** to explain *why* it was written, not just what it does.

## Quick Start

```bash
npm install
npm run compile
```

Press `F5` in VS Code to launch the Extension Development Host, then right-click any line → **Why Does This Exist?**

## Configuration

Set in VS Code settings (`Ctrl+,`, search "Why Does This Exist"):

| Setting | Description |
|---|---|
| `githubToken` | GitHub PAT with `repo` scope |
| `openaiApiKey` | OpenAI API key |
| `llmProvider` | `openai` (default), `anthropic`, `ollama`, or `watsonx` |
| `anthropicApiKey` | Anthropic API key (if using Claude) |
| `ollamaBaseUrl` | Ollama server URL (default: `http://localhost:11434`) |
| `ollamaModel` | Ollama model name (default: `llama3`) |
| `watsonxApiKey` | IBM Cloud API key |
| `watsonxProjectId` | watsonx.ai project ID |
| `watsonxRegion` | watsonx.ai region (default: `us-south`) |
| `watsonxModel` | watsonx.ai model ID (default: `ibm/granite-13b-chat-v2`) |
| `jiraBaseUrl` | e.g. `https://yourorg.atlassian.net` |
| `jiraEmail` | Jira account email |
| `jiraApiToken` | Jira API token |
| `linearApiKey` | Linear API key |

## Project Structure

```
src/
├── extension.ts   # VS Code entry point, command registration
├── chain.ts       # Pipeline orchestrator
├── git.ts         # git blame + trivial-commit fallback
├── github.ts      # PR lookup via GitHub API
├── tickets.ts     # Jira / Linear / GitHub Issues fetcher
├── llm.ts         # OpenAI / Anthropic / Ollama / watsonx synthesis
└── panel.ts       # Webview result panel
architecture.mermaid  # Full architecture diagram
```

## Architecture

See [architecture.mermaid](./architecture.mermaid) for the full flowchart.

Pipeline:
```
git blame → commit SHA
         → GitHub API → PR title + description
                      → linked ticket IDs
                        → Jira / Linear / GitHub Issues → ticket context
→ LLM (GPT-4o / Claude / Ollama / watsonx) → plain-English explanation
→ VS Code Webview Panel
```
