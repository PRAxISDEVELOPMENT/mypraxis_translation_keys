import * as Localization from 'expo-localization';
import i18n from 'i18next';
import FetchBackend from 'i18next-fetch-backend';
import { initReactI18next } from 'react-i18next';
import moment from 'moment';
import 'moment/locale/fr';
import 'moment/locale/nl';

const PRELOAD_LANGUAGES = ['en', 'nl', 'fr'] as const;

export const i18nReady: Promise<void> = i18n
  .use(FetchBackend)
  .use(initReactI18next)
  .init({
    fallbackLng: false,
    returnNull: false,
    saveMissing: false,
    lng: Localization.getLocales()[0]?.languageCode || 'en',
    load: 'languageOnly',
    preload: [...PRELOAD_LANGUAGES],
    parseMissingKeyHandler: (key: string) => `(missing key) ${key}`,
    interpolation: {
      escapeValue: false
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
  });

i18n.on('languageChanged', (language: string) => {
  moment.locale(language.split('-')[0]);
});

export default i18n;
