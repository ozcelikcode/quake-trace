import { beforeEach, describe, expect, it, vi } from 'vitest';

import { useTsunamiStore } from '@/state/tsunami-store';

describe('tsunami store', () => {
  beforeEach(() => {
    useTsunamiStore.setState({
      status: 'idle',
      token: 0,
      result: null,
      pending: null,
      openWhenReady: false,
    });
  });

  it('starts a scheduled run once, on request', () => {
    const run = vi.fn();
    useTsunamiStore.getState().schedule(run);
    expect(useTsunamiStore.getState().status).toBe('pending');
    expect(run).not.toHaveBeenCalled();

    useTsunamiStore.getState().request();
    useTsunamiStore.getState().request();
    expect(run).toHaveBeenCalledTimes(1);
  });

  it('replaces an older schedule and remembers a request to open the scale', () => {
    const older = vi.fn();
    const newer = vi.fn();
    useTsunamiStore.getState().schedule(older);
    useTsunamiStore.getState().schedule(newer);
    useTsunamiStore.getState().request({ openScale: true });
    expect(older).not.toHaveBeenCalled();
    expect(newer).toHaveBeenCalledTimes(1);
    expect(useTsunamiStore.getState().openWhenReady).toBe(true);
  });

  it('drops a result from a run that a newer schedule replaced', () => {
    const token = useTsunamiStore.getState().start();
    useTsunamiStore.getState().schedule(vi.fn());
    expect(useTsunamiStore.getState().succeed(token, {} as never)).toBe(false);
    expect(useTsunamiStore.getState().status).toBe('pending');
  });
});
