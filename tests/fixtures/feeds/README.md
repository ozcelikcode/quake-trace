# Recorded feed responses

Recorded once on 2026-10-26 with `curl` (see the command per file) and replayed by the tests; tests
never call live services.

| File | Source and request |
|---|---|
| `afad-events.json` | AFAD apiv2 `event/filter?start=2026-10-19T00:00:00&end=2026-10-27T00:00:00&minlat=39.8&maxlat=41.8&minlon=26&maxlon=31&orderby=timedesc` (browser user agent) |
| `emsc-events.json` | EMSC seismicportal `fdsnws/event/1/query?format=json&start=2026-10-19&minlat=39.8&maxlat=41.8&minlon=26&maxlon=31&limit=100` |
| `usgs-events.json` | USGS `fdsnws/event/1/query?format=geojson&starttime=1999-01-01&endtime=2026-01-01&minlatitude=39.8&maxlatitude=41.8&minlongitude=26&maxlongitude=31&minmagnitude=5.6&orderby=time` (the historical replay events) |
| `kandilli-lst0.html` | KOERI `scripts/lst0.asp` (Windows-1254 bytes, kept as received) |
| `ko-slvt-2025-04-23.mseed` | KOERI EIDA `fdsnws/dataselect/1/query?net=KO&sta=SLVT&cha=HN?&start=2025-04-23T09:49:05&end=2025-04-23T09:51:05` (miniSEED 2.4, Steim2) |
| `ko-slvt-2025-04-23.obspy.json` | Reference decode of the miniSEED file with ObsPy (`read` + `merge`, version in the file): sample counts, first and last samples, sums |
| `ko-slvt-station.xml` | KOERI EIDA `fdsnws/station/1/query?net=KO&sta=SLVT&cha=HN?&level=channel&starttime=2019-09-26&endtime=2025-04-24` |
