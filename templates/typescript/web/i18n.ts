import i18n from 'i18next';
import Backend from 'i18next-http-backend';
import LanguageDetector from 'i18next-browser-languagedetector';
import { initReactI18next } from 'react-i18next';
import moment from 'moment';
import 'moment/locale/fr';
import 'moment/locale/nl';

const PRELOAD_LANGUAGES = ['en', 'nl', 'fr'] as const;

export const i18nReady: Promise<void> = i18n
  .use(Backend)
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    fallbackLng: false,
    returnNull: false,
    saveMissing: false,
    load: 'languageOnly',
    preload: [...PRELOAD_LANGUAGES],
    parseMissingKeyHandler: (key: string) => `[missing key: ${key}]`,
    interpolation: {
      escapeValue: false
    },
    detection: {
      order: ['navigator'],
      caches: []
    },
    backend: {
      queryStringParams: { v: Date.now() },
      loadPath:
        'https://raw.githubusercontent.com/PRAxISDEVELOPMENT/mypraxis_translation_keys/main/i18n/artifacts/generated/{{lng}}.json'
    }
  })
  .then(async () => {
    const shortLang = i18n.language.split('-')[0];

    if (i18n.language !== shortLang) {
      await i18n.changeLanguage(shortLang);
    }

    moment.locale(shortLang);

    if (typeof document !== 'undefined') {
      document.documentElement.lang = shortLang;
    }
  });

i18n.on('languageChanged', (language: string) => {
  const shortLang = language.split('-')[0];

  moment.locale(shortLang);

  if (typeof document !== 'undefined') {
    document.documentElement.lang = shortLang;
  }
});

export default i18n;
