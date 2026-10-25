# Active Context

## Current focus

Phase 0 is complete locally on branch `feat/phase-0-skeleton`. Nothing is committed yet; committing waits for the user's request. Next is phase 1, the data pipeline.

## Recent changes (2026-10-25)

- Requirements clarified with the user in three rounds; architecture changed to browser-only plus edge proxy after the "free, no Docker" requirement.
- Rules and Memory Bank created (`AGENTS.md`, `CLAUDE.md`, `memory-bank/*`). The user's original `memory-bank.md` stays at the repository root by their choice; its protocol is mirrored in `AGENTS.md`.
- Tooling checked: RTK, MemPalace (wing `quake_trace` mined), context-mode, Context7 work; pyright installed globally; Playwright MCP left unfixed by the user's choice.
- Phase 0 spike recorded in `dataSources.md`. AFAD needs a browser user agent and has no CORS. Kandilli is windows-1254 with no CORS. KOERI FDSN is HTTP-only, with 77 KO stations and a 3–10 min latency.
- Phase 0 built: shell, tokens, i18n, map with terrain, Worker proxy, tests, CI (see `progress.md`).

## Next steps

1. User: review phase 0; on request, commit and open a PR from `feat/phase-0-skeleton`.
2. User (optional): create a free Cloudflare account and deploy (`npx wrangler login`, `npm run deploy`).
3. Phase 1: scaffold `pipeline/` (uv project, Python 3.13), verify each dataset's availability and license, produce `public/data/` with `manifest.json`, add zod schemas and typed loaders in `src/data/`.

## Active decisions and considerations

- Dark theme is the default; light theme is supported through tokens.
- Documentation and code in English; user-facing text in TR and EN catalogs; conversation with the user in Turkish.
- Fonts: IBM Plex Sans (variable) and IBM Plex Mono (latin + latin-ext only).
- Source file names kebab-case; Memory Bank files keep camelCase.
- The design token vocabulary is our own (`surface-*`, `line`, `fg`, `signal`, states). shadcn components are translated to it when adopted.
- Panel content is registered once in `src/app/panels.ts`; layouts only arrange it.

## Learnings and preferences

- The user wants disciplined, senior-level work: strict structure, current high-quality libraries, professional minimal design that is not barren.
- The user requires everything to be free and runnable as-is; no Docker or paid services.
- Tests must live in a separate folder; every folder must follow a clear order.
- The Memory Bank is the user's top priority for project continuity.
- Library checks pay off: typescript-eslint did not support TS 7, jsx-a11y did not support ESLint 10, react-refresh 0.5 exports a named `reactRefresh`, vaul ignores `modal={false}`, and MapLibre's container CSS overrides `position: absolute`.
