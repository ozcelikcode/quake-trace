/**
 * Seeded pseudo-random numbers, the only source of randomness in the engine, so a scenario and
 * its seed always reproduce the same result.
 *
 * - Uniform deviates: mulberry32 (Tommy Ettinger, 2017, public domain), a 32-bit generator with
 *   a period of 2^32, ample for per-station noise.
 * - Normal deviates: the Box–Muller transform (Box and Muller, 1958).
 * - Sub-streams: FNV-1a 32-bit hashing (Fowler, Noll and Vo) of a key mixed with the seed, so a
 *   station's stream does not depend on which other stations are simulated.
 */

export interface Random {
  /** Uniform deviate in [0, 1). */
  next(): number;
  /** Standard normal deviate. */
  normal(): number;
}

export function createRandom(seed: number): Random {
  let state = seed | 0;
  let spare: number | null = null;

  const next = () => {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };

  const normal = () => {
    if (spare !== null) {
      const value = spare;
      spare = null;
      return value;
    }
    // 1 − u keeps the logarithm finite: next() can return 0 but never 1.
    const radius = Math.sqrt(-2 * Math.log(1 - next()));
    const angle = 2 * Math.PI * next();
    spare = radius * Math.sin(angle);
    return radius * Math.cos(angle);
  };

  return { next, normal };
}

const FNV_OFFSET = 0x811c9dc5;
const FNV_PRIME = 0x01000193;

/** A seed for an independent sub-stream identified by `key`. */
export function deriveSeed(seed: number, key: string): number {
  let hash = (FNV_OFFSET ^ seed) >>> 0;
  for (let i = 0; i < key.length; i++) {
    hash ^= key.charCodeAt(i);
    hash = Math.imul(hash, FNV_PRIME) >>> 0;
  }
  return hash;
}
