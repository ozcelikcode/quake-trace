# Product Context

## Why it exists

A major Marmara earthquake is expected within decades. What happens in the first seconds, minutes and hours is hard to picture: how fast shaking reaches each district, how much warning an early warning system could give, which roads and towers fail, where help should flow. quakeTrace makes that sequence visible and explorable, and shows real seismic activity around it.

## Who it is for

- **Primary:** people evaluating the work (portfolio): engineers, scientists, emergency-management professionals.
- **Secondary:** curious public and students learning how earthquakes propagate and how response is planned.

## How it should work

1. The app opens on a calm overview of the Marmara region with live earthquakes from official feeds.
2. The user picks a preset (expected Marmara scenarios, historical events) or builds one in the editor: fault segments, magnitude, hypocenter, depth, time of day.
3. The engine computes the full scenario in a few seconds. Playback starts at the origin time.
4. Wavefronts expand across the map; stations trigger and their records stream in the telemetry panel; the early warning alert fires; districts count down to S-wave arrival.
5. The timeline can be scrubbed at any speed across three scales: shaking (seconds), tsunami (minutes), response (hours to days).
6. Impact layers fill in: intensity, damage, infrastructure status, cell tower load, emergency corridors, tsunami, aftershocks.
7. The event log records every milestone. The scenario can be shared by URL and exported as a report.

## Modes

- **Live:** real earthquakes from AFAD, Kandilli, EMSC and USGS; near-real-time waveforms where available. Any event can seed a scenario.
- **Scenario:** synthetic, deterministic simulation.
- **Replay:** historical events with real records where they exist, synthetic elsewhere, each labeled.

## Experience goals

- **Calm under pressure:** a command screen that stays legible while a lot is happening. Hierarchy over decoration.
- **Time is the backbone:** everything on screen answers "what is true at this second".
- **Trust:** sources, units and uncertainty are visible; simulation is always marked as simulation.
- **Works everywhere:** full functionality on a phone, adapted rather than removed.
- **Bilingual:** Turkish first, English equal.
