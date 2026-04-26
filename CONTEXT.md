# Project Context — "Why Does This Exist?"

## Origin

This project was created during a hackathon brainstorming session (April 2026).
The goal was to find a developer productivity tool that **does not exist in the market** and addresses a real gap.

After evaluating several ideas, this one was selected as the most hackathon-viable:
- Strong "wow" demo moment
- Buildable in 24–48 hours
- Solves a universally relatable developer pain point

---

## The Problem It Solves

Every codebase accumulates code whose *purpose* is forgotten. A developer opens a mysterious function and asks:
- Why was this written this way?
- What business requirement drove this?
- Is this safe to delete?

Today they manually dig through `git log` → find a PR → hunt for a Jira/Linear ticket → read the thread.
That's 20–40 minutes of archaeology per question.

**No existing tool does the full chain:**
- `git log -S` → shows commits, no PR/ticket context
- GitHub Copilot → explains *what* code does, not *why* it was written
- GitLens → shows blame inline, raw data only, no synthesis

---

## What It Does

Given a **file + line number**, it automatically chains:

```
git blame → commit SHA → GitHub PR → linked ticket (Jira/Linear/GitHub Issues) → LLM → plain-English explanation
```

Output: a structured explanation of *why the code exists*, who wrote it, and what business context drove it — displayed in a VS Code side panel.

---

## Tech Stack

| Layer | Package |
|---|---|
| Editor integration | VS Code Extension API (`@types/vscode`) |
| Git analysis | `simple-git` |
| GitHub API | `@octokit/rest` |
| Jira API | Jira REST API v3 (native `fetch`) |
| Linear API | Linear GraphQL API (native `fetch`) |
| LLM — OpenAI | `openai` (GPT-4o, json_object mode) |
| LLM — Anthropic | `@anthropic-ai/sdk` (Claude 3.5 Sonnet) |
| LLM — Ollama | `openai` SDK (OpenAI-compatible endpoint) |
| LLM — watsonx | IBM Cloud IAM + watsonx.ai REST API |
| Language | TypeScript 5.3, compiled to Node16 modules |
