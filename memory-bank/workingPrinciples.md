# Working Principles

How work is carried out on quakeTrace. The bar is a disciplined senior engineer working on a product others will judge.

## Before writing code

- Read the Memory Bank. Know the current phase and its acceptance criteria.
- Understand the problem and the existing code before changing it. Reuse what exists; do not add a second way of doing the same thing.
- Check current library documentation before using an API. Prefer the approach the library recommends today over a pattern remembered from older versions.
- For anything non-trivial, write a short plan: what changes, where, how it will be verified.

## While writing code

- Small, focused changes. One concern per change.
- Code reads like the surrounding code: same naming, structure and comment density.
- Comments explain why, not what. Scientific code cites its sources.
- Name things for what they are in the domain (`arrivalTimeS`, `ruptureFront`, `stationTrigger`), with units in the name when not SI.
- Handle errors explicitly. No silent catches. Errors shown to users go through i18n.
- No speculative abstractions, no "for later" code, no commented-out blocks, no TODOs without a matching entry in `progress.md`.
- Performance is a feature: avoid allocation in hot loops, keep grids in typed arrays, measure before optimizing and after.

## Quality gates

- Strict types, lint clean, tests green, build passing before a change is called done (see Definition of done in `AGENTS.md`).
- UI changes are looked at, not assumed: screenshots at desktop and phone sizes, both locales, both themes when styling changed.
- Engine changes are tested against references or analytic solutions.
- Report results faithfully. If something fails or was skipped, say so with the output.

## Version control

- Conventional Commits (`feat:`, `fix:`, `refactor:`, `test:`, `docs:`, `chore:`), imperative mood, scoped when useful (`feat(engine): add ASB14 GMPE`).
- One logical change per commit. Work happens on a branch per phase or feature; `main` stays deployable.
- Never commit secrets, raw downloaded datasets or build output.

## Dependencies and data

- New dependency: justify it in `techContext.md` first.
- New dataset or feed: record source, license and attribution in `dataSources.md` first.

## Communication

- The user communicates in Turkish; respond in Turkish. Code and documentation stay in English.
- Ask only when a decision is genuinely the user's. Otherwise choose the sound default, state it and proceed.
- Record decisions in `systemPatterns.md` (decision log) and current state in `activeContext.md`.
