# Design System

## Spirit: instrument-grade minimalism

quakeTrace should feel like a precision instrument: quiet chrome, loud data. Minimal means every element earns its place, not that the screen is empty. Richness comes from the data itself (contours, graticules, tick marks, labeled scales, waveforms) and from careful micro-typography, never from decoration.

Principles:

1. **Data is the hero.** Panels, borders and controls recede; the map, wavefronts and records carry the color and motion.
2. **Hierarchy over decoration.** Size, weight, position and contrast order the screen. No gradients, glass, glow on chrome, or drop shadows for style.
3. **Dense but calm.** Command screens show a lot at once. Use alignment, consistent rhythm and restrained color so density never becomes noise.
4. **Color means something.** Neutral by default. Color is reserved for state (alert, warning, normal), physical quantities (intensity scales, P/S waves) and the single interactive accent.
5. **Motion tells time.** Animation follows the simulation clock. Interface transitions are short and functional.
6. **Never bare.** Empty and loading states show structure (skeleton panels, scale axes, a faint graticule), not blank space.

## Themes

Dark is the default (command-screen context). Light is fully supported for daylight use, print and reports. Both come from the same tokens; components never branch on theme.

## Color tokens

Defined in `src/styles/tokens.css` as OKLCH custom properties (light base, dark override on `:root[data-theme='dark']`) and mapped into Tailwind v4 in `src/styles/index.css`. Tailwind's default palette, fonts, type scale, radii and shadows are reset, so only these names exist in class names:

| CSS token | Tailwind name | Example |
|---|---|---|
| `--surface-0` … `--surface-3` | `surface-0` … `surface-3` | `bg-surface-1` |
| `--border-subtle` / `--border-strong` | `line` / `line-strong` | `border-line` |
| `--text-primary` / `--text-secondary` / `--text-muted` | `fg` / `fg-secondary` / `fg-muted` | `text-fg-muted` |
| `--signal` / `--signal-contrast` | `signal` / `signal-contrast` | `bg-signal text-signal-contrast` |
| `--state-critical` / `-warning` / `-ok` / `-info` | `critical` / `warning` / `ok` / `info` | `text-critical` |
| `--elevation-float` | `shadow-float` | |
| type scale | `text-micro`, `text-caption`, `text-body`, `text-title`, `text-readout`, `text-hero` | |
| radii | `rounded-control` (4 px), `rounded-panel` (6 px) | |
| layout widths | `w-panel-left` (320), `w-panel-right` (380), `w-drawer` | |
| `--wave-p` / `--wave-s` | `wave-p` / `wave-s` | `bg-wave-p` (legend keys; same RGB as the deck.gl curtains) |

Custom utilities: `num` (mono, tabular figures), `label-micro`, `graticule` (faint dot grid behind empty areas), `ruler` (tick texture for scales).

WebGL paint colors (hillshade, later data layers) cannot read CSS variables; they are defined as constants next to the layer code and tuned against these tokens.

Surfaces (cool neutral, slight blue tint):

| Token | Role |
|---|---|
| `--surface-0` | App background behind the map |
| `--surface-1` | Panels |
| `--surface-2` | Raised elements inside panels (cards, inputs) |
| `--surface-3` | Hover and selected rows |
| `--border-subtle` / `--border-strong` | 1 px hairlines; strong for focus-adjacent separation |
| `--text-primary` / `--text-secondary` / `--text-muted` | Three text levels only |

Accent and states:

| Token | Role |
|---|---|
| `--signal` | Single interactive accent (controls, focus ring, selection) |
| `--state-critical` | Alarm, collapse, outage |
| `--state-warning` | Elevated, congested, degraded |
| `--state-ok` | Normal, operational |
| `--state-info` | Neutral notices, live-data source badges |

Physical quantities:

| Token | Role |
|---|---|
| `--wave-p` | P wave (cool cyan-blue) |
| `--wave-s` | S wave (amber to red) |
| `--mmi-1` … `--mmi-10` | USGS ShakeMap intensity scale, kept close to the standard for recognizability |
| `--tsunami-pos` / `--tsunami-neg` | Diverging sea-surface scale |
| `--load-0` … `--load-4` | Sequential scale for cell tower and corridor load |

Rules: every pair used for text meets WCAG 2.2 AA (4.5:1 body, 3:1 large text and UI). Data palettes are checked for color-vision deficiency; state is never carried by color alone (icon, label or pattern accompanies it).

## Typography

- **IBM Plex Sans** for UI, **IBM Plex Mono** for numbers, coordinates, timestamps and codes. Self-hosted through `@fontsource`; full Turkish glyph coverage.
- Tabular numerals everywhere values change over time.
- Scale (px): 11 (micro labels, axis ticks) · 12 (secondary) · 13 (body, dense UI) · 15 (panel titles) · 20 (key readouts) · 28 (hero clock and magnitude).
- Weights: 400 and 500 for most text, 600 for titles and critical readouts. No 300 on dark backgrounds.
- Micro labels: uppercase, +0.04em tracking, `--text-muted`.
- Units always shown, set in the secondary color after the value: `0.42 g`, `S − 12 s`, `38 km`.
- Numbers and dates are formatted through `Intl` with the active locale (`1.234,5` in Turkish, `1,234.5` in English).

## Space, shape and depth

- 4 px base grid. Common steps: 4, 8, 12, 16, 24, 32.
- Radius: 4 px controls, 6 px cards and panels, full for pills and status dots. No large rounded cards.
- Depth through surface lightness and hairline borders, not shadows. A single subtle shadow is allowed for floating elements over the map (popovers, mobile sheet).
- Icons: lucide, 16 px in dense UI and 20 px in primary controls, 1.5 px stroke. No emoji in the interface.

## Layout

- **Desktop (≥1280 px):** status bar on top (simulation clock T+, magnitude, alert state, mode, language, theme) · left panel 320 px (mode, scenario, layers) · map · right panel 380 px (telemetry) · timeline across the bottom.
- **Tablet (768–1279 px):** side panels become drawers over the map; status bar and timeline stay.
- **Phone (<768 px):** full-screen map, compact status bar, compact timeline, draggable bottom sheet with tabs (Scenario, Telemetry, Impact, Events). All functions remain available.
- Panels scroll internally; the page itself never scrolls on desktop.
- The "SIMULATION" watermark sits fixed in a map corner whenever simulated data is on screen.

## Motion

- Simulation-driven motion (wavefronts, traces, counters) follows the playback clock exactly.
- Interface transitions: 120–200 ms, ease-out; drawers and sheet up to 240 ms.
- Alert state change: one short emphasis (scale and color), no endless pulsing on chrome. Map markers may pulse while a station is triggered.
- `prefers-reduced-motion`: no pulsing or easing; state changes apply instantly; playback still works.

## Components

- Built on Radix primitives following shadcn/ui patterns, written into `src/components/ui/` with the token vocabulary above (no shadcn color names). When adopting another shadcn component, copy it and translate its classes to these tokens.
- Built (phase 0): `Button` (primary, secondary, ghost; sm, md, icon), `ToggleGroup` (segmented control), `Tooltip`, `Tabs`, `Panel` (header, title, body), `EmptyState`, `Sheet` (modal side drawer, Radix Dialog), `BottomSheet` (non-modal phone region with snap heights, drag, click and arrow-key control).
- Built (phase 2): `Slider` (accessible name on the thumb); feature-level: timeline bar (play/pause, slider over a ruler, speed segmented control), preset cards, scenario summary readouts (definition grid), district arrival table with MMI swatches, map legend (continuous MMI scale with Roman numerals, wave keys), simulation watermark.
- Built (phase 3): telemetry focus view (station heading, synthetic badge, readout grid, Z/N/E traces with P trigger and S arrival ticks, playhead, time axis with the unit at the right edge, legend with scale), record-section station row (trigger dot in `wave-p` plus screen-reader state, id and distance, vertical trace, peak so far), map trigger flash and focus ring.
- Built (phase 4): status-bar alert chip (warning text when detected, critical fill with one short emphasis on alert, magnitude only on phones, live region), EEW summary readouts, district warning column (countdown `S − 12 s`, lead time `+2,2 s`, blind zone in `critical` text), timeline event ticks, map legend entries for blind zone and estimated epicentre. Phone status bar keeps the brand mark only.
- To build: timeline scale presets, layer toggle row, event log row, toast for alerts, popover, dialog.
- MMI colours come from `src/lib/color/mmi.ts` (ShakeMap scale); the same module feeds the raster, legend and swatches.
- Touch targets grow on coarse pointers (`pointer-coarse:` variants) to at least 44 px.
- Every interactive component has visible focus, hover, active, disabled and loading states.

## Data visualization

- Waveforms: thin 1 px traces on a faint grid, P and S picks marked with `--wave-p` / `--wave-s` ticks, amplitude axis with units, shared time axis synced to the playback clock.
- Map: basemap desaturated so data layers dominate. Labels stay readable above data layers.
- Legends always visible for active quantitative layers, with units and the source model named.
- Uncertainty is shown when the model provides it (ranges, not just medians).

## Writing

- Short, operational, specific. Verbs for actions, nouns for states.
- Turkish first; English equal. Both catalogs change together.
- No exclamation marks, no alarmist wording. Simulated content is always labeled.

## Accessibility

- Full keyboard operation; logical focus order; shortcuts listed in a help dialog (Space play/pause, ←/→ step, Shift+←/→ jump, L layers, ? help).
- Alerts announced through an `aria-live` region.
- Hit targets at least 24 px desktop and 44 px on touch.
