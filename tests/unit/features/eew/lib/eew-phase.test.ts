import { describe, expect, it } from 'vitest';

import { eewPhase } from '@/features/eew/lib/eew-phase';
import type { EarlyWarning } from '@/types/simulation';

const warning = { firstTriggerS: 3, alertS: 8 } as EarlyWarning;

describe('early-warning phase', () => {
  it('detects at the first trigger and alerts at the alert time', () => {
    expect(eewPhase(warning, 2)).toBe('idle');
    expect(eewPhase(warning, 5)).toBe('detected');
    expect(eewPhase(warning, 8)).toBe('alert');
    expect(eewPhase(null, 8)).toBe('idle');
  });

  it('ends the alert with the shaking when its end is given', () => {
    expect(eewPhase(warning, 90, 100)).toBe('alert');
    expect(eewPhase(warning, 3600, 100)).toBe('idle');
    expect(eewPhase(warning, 3600)).toBe('alert');
  });
});
