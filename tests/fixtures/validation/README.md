# Ground-motion validation data

`observed-pga.json` was recorded once on 2026-10-26 from the KOERI EIDA node
(`eida-service.koeri.boun.edu.tr/fdsnws`) for the 2019 Silivri (USGS us70005lkl) and 2025
Marmara Ereğlisi (USGS us7000pufs) earthquakes, and is replayed by
`tests/integration/engine/ground-motion-validation.test.ts`.

Procedure, per event:

1. `station/1/query?net=KO&cha=HN?&level=station&minlat=39.8&maxlat=41.8&minlon=26&maxlon=31`
   for the stations operating at the origin time.
2. `dataselect/1/query` from 10 s before to 120 s after the origin, and `station/1/query` at
   `level=channel` for the sensitivities, in batches of eight stations.
3. Decoded with `src/lib/formats/miniseed.ts`, converted to cm/s² with
   `toAcceleration` (`src/data/feeds/waveforms.ts`: pre-event mean removed, divided by the flat
   sensitivity); channels covering less than 60 s after the origin were dropped.
4. Peak absolute acceleration per component; `pgaCmS2` is the geometric mean of the two
   horizontal peaks, the component definition of ASB14.

Stations with no data or without both horizontals are absent (2019: 12 of 31; 2025: 43 of 47).
KO.KUMB has a dead vertical channel (2025); only horizontals are used.
