import { describe, expect, it } from 'vitest';

import en from '@/i18n/locales/en.json';
import tr from '@/i18n/locales/tr.json';

type Catalog = Record<string, unknown>;

function flatten(catalog: Catalog, prefix = ''): Map<string, unknown> {
  const entries = new Map<string, unknown>();
  for (const [key, value] of Object.entries(catalog)) {
    const path = prefix ? `${prefix}.${key}` : key;
    if (value !== null && typeof value === 'object') {
      for (const [nested, nestedValue] of flatten(value as Catalog, path)) {
        entries.set(nested, nestedValue);
      }
    } else {
      entries.set(path, value);
    }
  }
  return entries;
}

describe('locale catalogs', () => {
  const trEntries = flatten(tr);
  const enEntries = flatten(en);

  it('define the same keys in Turkish and English', () => {
    expect([...enEntries.keys()].sort()).toEqual([...trEntries.keys()].sort());
  });

  it.each([
    ['tr', trEntries],
    ['en', enEntries],
  ])('contain only non-empty strings (%s)', (_language, entries) => {
    for (const [key, value] of entries) {
      expect(typeof value, key).toBe('string');
      expect((value as string).trim(), key).not.toBe('');
    }
  });
});
