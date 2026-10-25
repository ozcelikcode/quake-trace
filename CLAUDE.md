@AGENTS.md

# Claude Code specifics

- **Library docs:** use the Context7 MCP (`resolve-library-id` → `query-docs`) before writing code against any library API.
- **Visual verification:** use the Playwright MCP to open the dev server, take screenshots at desktop and mobile sizes and read console errors. Automated tests still run through `@playwright/test` under `tests/e2e/`.
- **MemPalace:** this project's wing is `quake_trace`. Search it before answering questions about past decisions; write a diary entry at the end of each significant session. The Memory Bank stays the source of truth; MemPalace is recall, not specification.
- **Large outputs:** route logs, test reports and data inspection through context-mode (`ctx_execute`, `ctx_batch_execute`) instead of dumping them into the conversation.
- **Shell:** RTK rewrites shell output transparently; run commands normally.
- **UI work:** load the `frontend-design` skill before designing new screens or components, then apply `memory-bank/designSystem.md`.
