import { describe, expect, it } from 'vitest';

import { formatClock, formatNumber } from '@/lib/format';

describe('formatting', () => {
  it('formats the simulation clock', () => {
    expect(formatClock(0)).toBe('00:00.0');
    expect(formatClock(12.34)).toBe('00:12.3');
    expect(formatClock(65.06)).toBe('01:05.1');
    expect(formatClock(-3)).toBe('00:00.0');
  });

  it('formats numbers per locale', () => {
    expect(formatNumber(1234.56, 'tr', 1)).toBe('1.234,6');
    expect(formatNumber(1234.56, 'en', 1)).toBe('1,234.6');
  });
});
