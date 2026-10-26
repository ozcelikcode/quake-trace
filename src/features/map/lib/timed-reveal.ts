/**
 * Reveals items as the clock passes their times and hides them again when it moves back,
 * reporting only the items whose visibility changes. Items are kept sorted by time, so the
 * revealed ones are a prefix and each clock step costs as many calls as there are changes.
 */
export class TimedReveal {
  readonly #order: Uint32Array;
  readonly #times: Float64Array;
  #shown = 0;

  constructor(times: ArrayLike<number>) {
    const order = Uint32Array.from({ length: times.length }, (_, i) => i);
    order.sort((a, b) => (times[a] ?? 0) - (times[b] ?? 0));
    this.#order = order;
    this.#times = Float64Array.from(order, (i) => times[i] ?? Number.POSITIVE_INFINITY);
  }

  /** Calls `apply(index, shown)` for every item whose visibility changes at `timeS`. */
  update(timeS: number, apply: (index: number, shown: boolean) => void): void {
    const count = this.#order.length;
    while (this.#shown < count && (this.#times[this.#shown] ?? 0) <= timeS) {
      apply(this.#order[this.#shown] ?? 0, true);
      this.#shown++;
    }
    while (this.#shown > 0 && (this.#times[this.#shown - 1] ?? 0) > timeS) {
      this.#shown--;
      apply(this.#order[this.#shown] ?? 0, false);
    }
  }

  /** Forgets what was revealed, after the receiver lost its state (for example a style reload). */
  reset(): void {
    this.#shown = 0;
  }
}
