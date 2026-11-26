/**
 * Deterministic Mulberry32 PRNG mutating state.rngState in-place.
 * Zero Math.random usage — bit-for-bit reproducible across runs and platforms.
 */

export interface RngCarrier {
  rngState: number;
}

export function nextUint32(state: RngCarrier): number {
  const s = (state.rngState + 0x6d2b79f5) >>> 0;
  state.rngState = s;
  let t = Math.imul(s ^ (s >>> 15), 1 | s);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return (t ^ (t >>> 14)) >>> 0;
}

/** Returns a deterministic float in [0, 1). */
export function nextFloat(state: RngCarrier): number {
  return nextUint32(state) / 4294967296;
}

/** Returns a deterministic integer in [min, maxExclusive). */
export function nextInt(state: RngCarrier, min: number, maxExclusive: number): number {
  if (maxExclusive <= min) {
    return min;
  }
  return min + (nextUint32(state) % (maxExclusive - min));
}

/** Returns a deterministic float in [min, max). */
export function nextRange(state: RngCarrier, min: number, max: number): number {
  return min + nextFloat(state) * (max - min);
}
