/**
 * In-place iterative radix-2 fast Fourier transform (Cooley and Tukey, 1965) on separate real
 * and imaginary arrays. Forward: X_k = Σ_n x_n·e^(−2πikn/N); inverse includes the 1/N factor, so
 * `ifft(fft(x))` returns `x`. Lengths must be powers of two.
 */

const twiddles = new Map<number, { cos: Float64Array; sin: Float64Array }>();

function twiddleTable(n: number): { cos: Float64Array; sin: Float64Array } {
  let table = twiddles.get(n);
  if (!table) {
    const half = n / 2;
    table = { cos: new Float64Array(half), sin: new Float64Array(half) };
    for (let k = 0; k < half; k++) {
      table.cos[k] = Math.cos((2 * Math.PI * k) / n);
      table.sin[k] = Math.sin((2 * Math.PI * k) / n);
    }
    twiddles.set(n, table);
  }
  return table;
}

export function isPowerOfTwo(n: number): boolean {
  return Number.isInteger(n) && n > 0 && (n & (n - 1)) === 0;
}

export function nextPowerOfTwo(n: number): number {
  let size = 1;
  while (size < n) size *= 2;
  return size;
}

function transform(re: Float64Array, im: Float64Array, sign: 1 | -1): void {
  const n = re.length;
  if (im.length !== n) throw new RangeError('real and imaginary parts differ in length');
  if (!isPowerOfTwo(n)) throw new RangeError(`FFT length ${String(n)} is not a power of two`);

  // Bit-reversal permutation.
  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j ^= bit;
    if (i < j) {
      const r = re[i] ?? 0;
      re[i] = re[j] ?? 0;
      re[j] = r;
      const m = im[i] ?? 0;
      im[i] = im[j] ?? 0;
      im[j] = m;
    }
  }

  const table = twiddleTable(n);
  for (let size = 2; size <= n; size *= 2) {
    const half = size / 2;
    const step = n / size;
    for (let start = 0; start < n; start += size) {
      for (let k = 0; k < half; k++) {
        const wr = table.cos[k * step] ?? 1;
        const wi = sign * (table.sin[k * step] ?? 0);
        const a = start + k;
        const b = a + half;
        const br = re[b] ?? 0;
        const bi = im[b] ?? 0;
        const tr = wr * br - wi * bi;
        const ti = wr * bi + wi * br;
        const ar = re[a] ?? 0;
        const ai = im[a] ?? 0;
        re[a] = ar + tr;
        im[a] = ai + ti;
        re[b] = ar - tr;
        im[b] = ai - ti;
      }
    }
  }
}

export function fft(re: Float64Array, im: Float64Array): void {
  transform(re, im, -1);
}

export function ifft(re: Float64Array, im: Float64Array): void {
  transform(re, im, 1);
  const scale = 1 / re.length;
  for (let i = 0; i < re.length; i++) {
    re[i] = (re[i] ?? 0) * scale;
    im[i] = (im[i] ?? 0) * scale;
  }
}
