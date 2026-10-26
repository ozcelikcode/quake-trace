import { describe, expect, it } from 'vitest';

import { formatClock, formatCompact, formatNumber, formatPercent } from '@/lib/format';

describe('formatting', () => {
  it('formats the simulation clock', () => {
    expect(formatClock(0)).toBe('00:00.0');
    expect(formatClock(12.34)).toBe('00:12.3');
    expect(formatClock(65.06)).toBe('01:05.1');
    expect(formatClock(-3)).toBe('00:00.0');
    expect(formatClock(59.96)).toBe('01:00.0');
    expect(formatClock(3599.96)).toBe('60:00.0');
    expect(formatClock(3600)).toBe('1:00:00');
    expect(formatClock(259_199.9)).toBe('71:59:59');
  });

  it('formats numbers per locale', () => {
    expect(formatNumber(1234.56, 'tr', 1)).toBe('1.234,6');
    expect(formatNumber(1234.56, 'en', 1)).toBe('1,234.6');
  });
});

describe('formatCompact', () => {
  it('shortens scale ticks per locale', () => {
    expect(formatCompact(10_000, 'en')).toBe('10K');
    expect(formatCompact(10_000, 'tr')).toBe('10\u00a0B');
    expect(formatCompact(100, 'tr')).toBe('100');
  });
});

describe('formatPercent', () => {
  it('places the sign by locale', () => {
    expect(formatPercent(0.04, 'tr', 1)).toBe('%4,0');
    expect(formatPercent(0.98, 'en')).toBe('98%');
  });
});
