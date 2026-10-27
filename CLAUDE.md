@AGENTS.md

# Claude Code specifics

Tool notes for Claude Code only. Other agents follow `AGENTS.md` and the Memory Bank, which do not depend on anything below.

- **Library docs:** use the Context7 MCP (`resolve-library-id` → `query-docs`) before writing code against any library API.
- **Visual verification:** Playwright screenshots via a script (the Playwright MCP expects Google Chrome, which is not installed on this machine). Automated tests run through `@playwright/test` under `tests/e2e/`.
- **MemPalace:** this project's wing is `quake_trace`. Search it before answering questions about past decisions; write a diary entry at the end of each significant session. The Memory Bank stays the source of truth; MemPalace is recall, not specification.
- **Large outputs:** route logs, test reports and data inspection through context-mode (`ctx_execute`, `ctx_batch_execute`) instead of dumping them into the conversation. Its hook blocks shell commands that contain URLs; put one-off download snippets in a scratchpad script.
- **Shell:** RTK rewrites shell output transparently; run commands normally.
- **UI work:** load the `frontend-design` skill before designing new screens or components, then apply `memory-bank/designSystem.md`.
