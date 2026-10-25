/**
 * A regular lon/lat grid, north-up: row 0 lies at `north`, columns run east from `west`.
 * Cell (col, row) covers [west + col·dLon, west + (col+1)·dLon] × [north − (row+1)·dLat, north − row·dLat].
 */
export interface GridSpec {
  west: number;
  north: number;
  dLon: number;
  dLat: number;
  nx: number;
  ny: number;
}
