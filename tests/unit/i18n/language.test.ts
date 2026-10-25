// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';

import { defaultLanguage, isLanguage, toLanguage } from '@/i18n';

describe('language resolution', () => {
  it('accepts only supported languages', () => {
    expect(isLanguage('tr')).toBe(true);
    expect(isLanguage('en')).toBe(true);
    expect(isLanguage('de')).toBe(false);
  });

  it('reduces regional tags to the base language', () => {
    expect(toLanguage('en-US')).toBe('en');
    expect(toLanguage('tr-TR')).toBe('tr');
  });

  it('falls back to the default language', () => {
    expect(toLanguage('de-DE')).toBe(defaultLanguage);
    expect(toLanguage(undefined)).toBe(defaultLanguage);
  });
});
