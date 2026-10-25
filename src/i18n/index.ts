import i18next from 'i18next';
import LanguageDetector from 'i18next-browser-languagedetector';
import { initReactI18next } from 'react-i18next';

import en from './locales/en.json';
import tr from './locales/tr.json';

export const supportedLanguages = ['tr', 'en'] as const;
export type Language = (typeof supportedLanguages)[number];

export const defaultLanguage: Language = 'tr';

export const resources = {
  tr: { translation: tr },
  en: { translation: en },
} as const;

export function isLanguage(value: string): value is Language {
  return (supportedLanguages as readonly string[]).includes(value);
}

/** Resolves i18next's active language (possibly regional, e.g. `en-US`) to a supported one. */
export function toLanguage(value: string | undefined): Language {
  const base = value?.split('-')[0] ?? '';
  return isLanguage(base) ? base : defaultLanguage;
}

void i18next
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources,
    fallbackLng: defaultLanguage,
    supportedLngs: supportedLanguages,
    load: 'languageOnly',
    initAsync: false,
    interpolation: { escapeValue: false },
    detection: {
      order: ['localStorage', 'navigator'],
      caches: ['localStorage'],
      lookupLocalStorage: 'quaketrace-language',
    },
  });

const syncDocumentLanguage = (language: string) => {
  document.documentElement.lang = toLanguage(language);
};

syncDocumentLanguage(i18next.language);
i18next.on('languageChanged', syncDocumentLanguage);
