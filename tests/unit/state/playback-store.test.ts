import { beforeEach, describe, expect, it } from 'vitest';

import { isPlaybackSpeed, usePlaybackStore } from '@/state/playback-store';

const store = () => usePlaybackStore.getState();

describe('playback clock', () => {
  beforeEach(() => {
    usePlaybackStore.setState({ timeS: 0, durationS: 0, playing: false, speed: 1 });
  });

  it('starts playing from the origin when a scenario loads', () => {
    store().seek(10);
    store().load(120);
    expect(store()).toMatchObject({ timeS: 0, durationS: 120, playing: true });
  });

  it('advances by wall time times speed and stops at the end', () => {
    store().load(10);
    store().setSpeed(2);
    store().advance(1.5);
    expect(store().timeS).toBe(3);
    store().advance(10);
    expect(store()).toMatchObject({ timeS: 10, playing: false });
  });

  it('does not advance while paused', () => {
    store().load(10);
    store().pause();
    store().advance(5);
    expect(store().timeS).toBe(0);
  });

  it('clamps seeking to the scenario', () => {
    store().load(30);
    store().seek(-5);
    expect(store().timeS).toBe(0);
    store().seek(99);
    expect(store().timeS).toBe(30);
  });

  it('restarts from the origin when playing at the end', () => {
    store().load(10);
    store().seek(10);
    store().pause();
    store().toggle();
    expect(store()).toMatchObject({ timeS: 0, playing: true });
  });

  it('cannot play without a scenario', () => {
    store().play();
    expect(store().playing).toBe(false);
  });

  it('accepts only the offered speeds', () => {
    expect(isPlaybackSpeed(5)).toBe(true);
    expect(isPlaybackSpeed(3)).toBe(false);
  });
});
