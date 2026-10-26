import { describe, expect, it } from 'vitest';

import { TimedReveal } from '@/features/map/lib/timed-reveal';

describe('timed reveal', () => {
  it('reports only the changes as the clock moves forward and back', () => {
    const reveal = new TimedReveal([5, 1, 3, Number.POSITIVE_INFINITY]);
    const changes: [number, boolean][] = [];
    const record = (index: number, shown: boolean) => changes.push([index, shown]);
    reveal.update(3, record);
    expect(changes).toEqual([
      [1, true],
      [2, true],
    ]);
    changes.length = 0;
    reveal.update(3.5, record);
    expect(changes).toEqual([]);
    reveal.update(10, record);
    expect(changes).toEqual([[0, true]]);
    changes.length = 0;
    reveal.update(2, record);
    expect(changes).toEqual([
      [0, false],
      [2, false],
    ]);
  });

  it('starts over after a reset', () => {
    const reveal = new TimedReveal([1]);
    const changes: number[] = [];
    reveal.update(2, (index) => changes.push(index));
    reveal.reset();
    reveal.update(2, (index) => changes.push(index));
    expect(changes).toEqual([0, 0]);
  });
});
