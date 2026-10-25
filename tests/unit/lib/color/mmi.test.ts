import { describe, expect, it } from 'vitest';

import { mmiColor, mmiCss, mmiRoman } from '@/lib/color/mmi';

describe('MMI colors', () => {
  it('hits the ShakeMap anchors at integer intensities', () => {
    expect(mmiColor(1)).toEqual([255, 255, 255]);
    expect(mmiColor(6)).toEqual([255, 255, 0]);
    expect(mmiColor(10)).toEqual([200, 0, 0]);
  });

  it('interpolates between anchors and clamps outside I–X', () => {
    expect(mmiColor(6.5)).toEqual([255, 228, 0]);
    expect(mmiColor(0)).toEqual(mmiColor(1));
    expect(mmiColor(12)).toEqual(mmiColor(10));
    expect(mmiCss(8)).toBe('rgb(255 145 0)');
  });

  it('names intensities with Roman numerals', () => {
    expect(mmiRoman(1.2)).toBe('I');
    expect(mmiRoman(7.6)).toBe('VIII');
    expect(mmiRoman(11)).toBe('X');
  });
});
