/**
 * Marching squares for a single level on a regular grid of samples.
 *
 * Samples sit at cell centres: sample (col, row) is at grid coordinate (col + 0.5, row + 0.5).
 * Output segments are flat [x0, y0, x1, y1, ...] in grid coordinates (columns, rows). Squares
 * with a NaN corner are skipped. Saddles are resolved with the average of the four corners.
 */
export function isolineSegments(
  values: ArrayLike<number>,
  nx: number,
  ny: number,
  level: number,
): Float32Array {
  const out: number[] = [];

  const crossing = (a: number, b: number) => (level - a) / (b - a);

  for (let row = 0; row < ny - 1; row++) {
    for (let col = 0; col < nx - 1; col++) {
      const i = row * nx + col;
      const tl = values[i] ?? Number.NaN;
      const tr = values[i + 1] ?? Number.NaN;
      const br = values[i + nx + 1] ?? Number.NaN;
      const bl = values[i + nx] ?? Number.NaN;
      if (Number.isNaN(tl + tr + br + bl)) continue;

      const code =
        (tl >= level ? 8 : 0) |
        (tr >= level ? 4 : 0) |
        (br >= level ? 2 : 0) |
        (bl >= level ? 1 : 0);
      if (code === 0 || code === 15) continue;

      const x = col + 0.5;
      const y = row + 0.5;
      // Edge crossing points: top, right, bottom, left.
      const top = (): [number, number] => [x + crossing(tl, tr), y];
      const right = (): [number, number] => [x + 1, y + crossing(tr, br)];
      const bottom = (): [number, number] => [x + crossing(bl, br), y + 1];
      const left = (): [number, number] => [x, y + crossing(tl, bl)];
      const push = (p: [number, number], q: [number, number]) => {
        out.push(p[0], p[1], q[0], q[1]);
      };

      switch (code) {
        case 1:
        case 14:
          push(left(), bottom());
          break;
        case 2:
        case 13:
          push(bottom(), right());
          break;
        case 3:
        case 12:
          push(left(), right());
          break;
        case 4:
        case 11:
          push(top(), right());
          break;
        case 6:
        case 9:
          push(top(), bottom());
          break;
        case 7:
        case 8:
          push(left(), top());
          break;
        case 5:
        case 10: {
          const centreAbove = (tl + tr + br + bl) / 4 >= level;
          // Code 5: top-right and bottom-left above; code 10: top-left and bottom-right above.
          if ((code === 5) === centreAbove) {
            push(left(), top());
            push(bottom(), right());
          } else {
            push(left(), bottom());
            push(top(), right());
          }
          break;
        }
      }
    }
  }
  return Float32Array.from(out);
}
