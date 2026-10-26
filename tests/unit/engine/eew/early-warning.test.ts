import { describe, expect, it } from 'vitest';

import { grownMagnitude, pdFromMagnitude, pdMagnitude } from '@/engine/eew/early-warning';
import type { Rupture } from '@/engine/rupture/finite-fault';
import { magnitudeFromRuptureArea } from '@/engine/rupture/scaling';

describe('Pd magnitude (Wu and Zhao, 2006)', () => {
  it('follows log Pd = −3.463 + 0.729·M − 1.374·log R', () => {
    // M 6 at 10 km: 10^(−3.463 + 4.374 − 1.374) = 10^−0.463 cm.
    expect(pdFromMagnitude(6, 10)).toBeCloseTo(10 ** -0.463, 10);
  });

  it('inverts exactly', () => {
    expect(pdMagnitude(pdFromMagnitude(6.4, 37), 37)).toBeCloseTo(6.4, 10);
  });
});

describe('rupture grown during the Pd window', () => {
  const rupture = {
    mw: 7.4,
    areaKm2: 2200,
    widthKm: 18,
    ruptureVelocityKmS: 2.7,
  } as Rupture;
  const strikeSlip = 180;

  it('is a disc while narrower than the fault, then a band across its width', () => {
    // 1 s: r = 2.7 km, disc of π·2.7² km².
    expect(grownMagnitude(rupture, strikeSlip, 1)).toBeCloseTo(
      magnitudeFromRuptureArea(Math.PI * 2.7 ** 2, strikeSlip),
      10,
    );
    // 5 s: r = 13.5 km > half the width, band of 18 × 27 km².
    expect(grownMagnitude(rupture, strikeSlip, 5)).toBeCloseTo(
      magnitudeFromRuptureArea(18 * 27, strikeSlip),
      10,
    );
  });

  it('never exceeds the full rupture', () => {
    expect(grownMagnitude(rupture, strikeSlip, 100)).toBe(7.4);
    expect(grownMagnitude({ ...rupture, mw: 5 }, strikeSlip, 3)).toBeLessThanOrEqual(5);
  });
});
