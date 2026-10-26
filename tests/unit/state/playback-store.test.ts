import { beforeEach, describe, expect, it } from 'vitest';

import { isPlaybackSpeed, usePlaybackStore } from '@/state/playback-store';

const store = () => usePlaybackStore.getState();

describe('playback clock', () => {
  beforeEach(() => {
    usePlaybackStore.setState({
      timeS: 0,
      durationS: 0,
      scale: 'shaking',
      extents: { shaking: 0, tsunami: 0, response: 0 },
      playing: false,
      speed: 1,
    });
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

  it('accepts only the offered speeds of each scale', () => {
    expect(isPlaybackSpeed(5)).toBe(true);
    expect(isPlaybackSpeed(3)).toBe(false);
    expect(isPlaybackSpeed(60, 'tsunami')).toBe(true);
    expect(isPlaybackSpeed(0.5, 'tsunami')).toBe(false);
  });

  it('switches to the tsunami scale only once it is available', () => {
    store().load(100);
    store().seek(50);
    store().setScale('tsunami');
    expect(store().scale).toBe('shaking');
    store().setExtent('tsunami', 3600);
    store().setScale('tsunami');
    expect(store()).toMatchObject({ scale: 'tsunami', durationS: 3600, timeS: 50, speed: 30 });
    store().seek(2000);
    store().setScale('shaking');
    expect(store()).toMatchObject({ scale: 'shaking', durationS: 100, timeS: 100, speed: 1 });
  });

  it('falls back to the shaking when the active scale is withdrawn, and resets on load', () => {
    store().load(100);
    store().setExtent('tsunami', 3600);
    store().setScale('tsunami');
    store().setExtent('tsunami', 0);
    expect(store()).toMatchObject({ scale: 'shaking', durationS: 100 });
    store().setExtent('tsunami', 3600);
    store().load(80);
    expect(store().extents).toEqual({ shaking: 80, tsunami: 0, response: 0 });
    store().load(80, 259_200);
    store().setScale('response');
    expect(store()).toMatchObject({ scale: 'response', durationS: 259_200, speed: 3600 });
  });

  it('reveals a moment on the shortest scale that contains it, paused', () => {
    store().load(100, 259_200);
    store().setExtent('tsunami', 3600);
    store().reveal(40);
    expect(store()).toMatchObject({ scale: 'shaking', timeS: 40, playing: false });
    store().reveal(600);
    expect(store()).toMatchObject({ scale: 'tsunami', durationS: 3600, timeS: 600, speed: 30 });
    store().reveal(30_000);
    expect(store()).toMatchObject({ scale: 'response', timeS: 30_000, speed: 3600 });
    // Beyond every scale: nothing changes.
    store().reveal(1e9);
    expect(store()).toMatchObject({ scale: 'response', timeS: 30_000 });
  });
});
