# quakeTrace — Engineering Rules

quakeTrace is a real-time seismology and disaster-response command screen that runs entirely in the browser: ground-shaking simulation and live earthquakes worldwide, population exposure for Türkiye, and the full impact chain (damage, cell network, routing, tsunami) for the Marmara region. It is a user interface first: every engineering decision serves what the operator sees, reads and controls.

These rules apply to every contributor, human or AI agent, whatever tools it has. Assistant-specific tool notes live in that assistant's own file (for example `CLAUDE.md`); nothing in this file depends on them.

## Start of every task

1. Read every file in `memory-bank/` (core files first, then `workingPrinciples.md`, `designSystem.md`, `testingStrategy.md`, `dataSources.md`, `simulationModels.md`). Not optional.
2. Check `activeContext.md` for the current focus, `progress.md` for the current status and `roadmap.md` for the open tasks before touching code.
3. Before using any library API, read its current documentation (official docs, changelog or the installed package's types). Do not code from memory against fast-moving libraries.
4. Check the git branch (`git status`). Other tooling on the developer's machine has switched branches between commands before.

## Picking up a task

1. Take the first unchecked task of the lowest open phase in `memory-bank/roadmap.md`, unless the user names another.
2. Work on a branch `feat/phase-NN-<topic>` created from `main`.
3. Implement it within the rules below; keep the change to that task.
4. Run the definition of done. Report failures as they are; never mark a task done on assumption.
5. In the same commit: tick the task in `roadmap.md`, update `activeContext.md` and `progress.md`.
6. Commit with Conventional Commits in English (`feat(map): …`, `fix(engine): …`, `docs: …`). Push or merge only when the user asks.

## Commands

| Purpose                                                              | Command (from the repository root unless noted)                                                     |
| -------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| Install                                                              | `npm install`                                                                                       |
| Dev server (scenario mode works offline)                             | `npm run dev`                                                                                       |
| Type check                                                           | `npm run typecheck`                                                                                 |
| Lint / format check                                                  | `npm run lint` / `npm run format:check`                                                             |
| Unit + integration tests (Vitest, `tests/unit`, `tests/integration`) | `npm run test`                                                                                      |
| End-to-end tests (Playwright, `tests/e2e`)                           | `npm run test:e2e`                                                                                  |
| Production build                                                     | `npm run build`                                                                                     |
| Deploy (Cloudflare Workers, needs the owner's login)                 | `npm run deploy`                                                                                    |
| Smoke test of the deployed app                                       | `gh workflow run smoke.yml`                                                                         |
| Data pipeline (from `pipeline/`, Python via uv)                      | `uv run quaketrace-pipeline list`, `uv run quaketrace-pipeline build <dataset>`                     |
| Pipeline tests and checks (from `pipeline/`)                         | `uv run pytest`, `uv run ruff check . ../tests/pipeline`, `uv run pyright -p ../pyrightconfig.json` |

## Reporting to the user

- The user writes in Turkish; answer in Turkish. Code, comments, commits and documentation stay in English.
- Be brief and factual. End every progress report with a "Faz durumu" table that matches `progress.md` and `roadmap.md`.
- The user delegates technical choices: pick the recommended option and say why in one line. Ask only when a decision changes product scope.

## Non-negotiables

- **Language:** English for identifiers, file names, comments, commit messages and documentation. User-facing text lives only in `src/i18n/locales/{tr,en}.json`; both locales are updated in the same change. No hard-coded UI strings.
- **Structure:** follow the layout in `memory-bank/systemPatterns.md`. Tests live only under `tests/`, never next to source. New top-level folders require a recorded decision in `systemPatterns.md`.
- **Boundaries:** `src/engine/` is pure TypeScript with no React, DOM or network access. Features talk to each other only through their `index.ts`. Lint rules enforce this; never disable them to get around a boundary.
- **Types:** TypeScript strict with `noUncheckedIndexedAccess` and `exactOptionalPropertyTypes`. No `any`, no non-null assertions to silence the compiler. Validate every external input (feeds, files, URL state) with a schema at the boundary.
- **Science:** every formula, coefficient table and model cites its source (author, year, equation or table) in a doc comment. Internal units are SI unless the identifier carries a unit suffix (`depthKm`, `pgaG`). Simulations are deterministic for a given scenario and seed.
- **Design:** follow `memory-bank/designSystem.md`. Use tokens only; no raw colors, sizes or ad-hoc fonts in components. Minimal does not mean empty: data carries the visual richness, chrome stays quiet.
- **Dependencies:** latest stable, actively maintained, typed, ESM, license-compatible, and justified in `techContext.md` when added. Exact versions in `package.json`. Prefer platform APIs over a dependency.
- **No dead code:** do not keep unused, duplicate, commented-out or speculative implementations. Git keeps history.
- **Free and installable:** no paid services, no Docker, no server to operate. `npm install && npm run dev` must always work offline-first for scenario mode.
- **Honesty in the product:** simulated output is always labeled as simulation; real data is always labeled with its source. The app never presents itself as an official warning system.

## Definition of done

A change is done only when all of these pass and the result is reported faithfully:

1. `npm run typecheck`, `npm run lint`, `npm run test` (unit + integration) and `npm run build`.
2. `npm run test:e2e` when a user flow, layout or interaction changed.
3. Visual check of affected screens at desktop (1440×900) and mobile (390×844), in both locales and both themes when styling changed.
4. Engine changes: tests against reference values or analytic solutions, with sources cited in the test.
5. `memory-bank/activeContext.md`, `progress.md` and `roadmap.md` updated; other memory bank files updated when patterns, decisions or dependencies changed.

# Memory Bank

Agents have no memory between sessions, and several different agents work on this project. The Memory Bank is the only shared, reliable context: read all of it at the start of every task and keep it precise. Write it for a reader who has never seen the project.

## Structure

```
projectbrief.md ──┬──> productContext.md ──┐
                  ├──> systemPatterns.md ──┼──> activeContext.md ──> progress.md
                  └──> techContext.md ─────┘
```

Core files (required):

1. `projectbrief.md` — foundation and source of truth for scope, core requirements and goals.
2. `productContext.md` — why the project exists, problems it solves, how it should work, user experience goals.
3. `activeContext.md` — current focus, recent changes, next steps, active decisions, learnings.
4. `systemPatterns.md` — architecture, key technical decisions, patterns, component relationships, critical paths, folder layout.
5. `techContext.md` — technologies, development setup, constraints, dependencies, tool usage.
6. `progress.md` — what works, what is left, current status, known issues, evolution of decisions.

Additional context files in this project:

- `workingPrinciples.md` — how work is carried out: discipline, review, verification.
- `designSystem.md` — design spirit, tokens, typography, color, motion, layout, components, data visualization.
- `testingStrategy.md` — test layout, tooling, levels, fixtures, coverage, scientific validation.
- `dataSources.md` — every dataset and feed, its license, attribution and refresh procedure.
- `simulationModels.md` — scientific approach per engine module, timeline, map layers, presets.
- `roadmap.md` — open phases and tasks with acceptance criteria; the task list to pick up from.

Create further files or folders inside `memory-bank/` when a feature, integration or procedure needs its own document.

## Workflows

- **Plan:** read the Memory Bank → check that it is complete → if not, write the plan and fill the gaps → otherwise verify context, develop the strategy and present the approach.
- **Act:** check the Memory Bank → update documentation if the task changes it → execute → document the changes.

## Updates

Update the Memory Bank when discovering new project patterns, after significant changes, when context needs clarification, and whenever the user says **update memory bank**. On that command, review every file even if some need no change, with particular attention to `activeContext.md` and `progress.md`.
