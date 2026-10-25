import { describe, expect, it } from 'vitest';

import { readSections, requireSection } from '@/data/binary-sections';
import { DataError } from '@/data/errors';

describe('binary sections', () => {
  const buffer = new ArrayBuffer(12);
  new Float32Array(buffer, 0, 2).set([1.5, -2]);
  new Uint8Array(buffer, 8, 4).set([1, 2, 3, 4]);

  it('views each section in place', () => {
    const views = readSections(buffer, [
      { name: 'a', type: 'float32', byteOffset: 0, length: 2 },
      { name: 'b', type: 'uint8', byteOffset: 8, length: 4 },
    ]);
    expect(Array.from(requireSection(views, 'a', Float32Array))).toEqual([1.5, -2]);
    expect(Array.from(requireSection(views, 'b', Uint8Array))).toEqual([1, 2, 3, 4]);
  });

  it('rejects misaligned and out-of-bounds sections', () => {
    expect(() =>
      readSections(buffer, [{ name: 'x', type: 'float32', byteOffset: 2, length: 1 }]),
    ).toThrow(DataError);
    expect(() =>
      readSections(buffer, [{ name: 'x', type: 'uint32', byteOffset: 8, length: 2 }]),
    ).toThrow(DataError);
  });

  it('rejects missing or mistyped sections', () => {
    const views = readSections(buffer, [{ name: 'b', type: 'uint8', byteOffset: 8, length: 4 }]);
    expect(() => requireSection(views, 'missing', Uint8Array)).toThrow(DataError);
    expect(() => requireSection(views, 'b', Float32Array)).toThrow(DataError);
  });
});
