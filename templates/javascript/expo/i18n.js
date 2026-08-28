import * as Localization from 'expo-localization';
import i18n from 'i18next';
import FetchBackend from 'i18next-fetch-backend';
import { initReactI18next } from 'react-i18next';
import moment from 'moment';
import 'moment/locale/fr';
import 'moment/locale/nl';

const PRELOAD_LANGUAGES = ['en', 'nl', 'fr'];
const TRANSLATION_REQUEST_TIMEOUT_MS = 5000;
const TRANSLATION_SOURCES = [
  'https://cdn.jsdelivr.net/gh/PRAxISDEVELOPMENT/mypraxis_translation_keys@main/i18n/artifacts/generated',
  'https://raw.githubusercontent.com/PRAxISDEVELOPMENT/mypraxis_translation_keys/main/i18n/artifacts/generated'
];
let translationVersion = Date.now();

const fetchTranslationWithFallback = async (url, options = {}) => {
  let lastError;

  for (const source of TRANSLATION_SOURCES) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), TRANSLATION_REQUEST_TIMEOUT_MS);

    try {
      const requestUrl = new URL(url.replace(TRANSLATION_SOURCES[0], source));
      requestUrl.searchParams.set('v', translationVersion);

      const response = await fetch(requestUrl, {
        ...options,
        cache: 'no-store',
        signal: controller.signal
      });

      if (!response.ok) {
        throw new Error(`Translation request failed: ${response.status}`);
      }

      JSON.parse(await response.clone().text());

      return response;
    } catch (error) {
      lastError = error;
    } finally {
      clearTimeout(timeout);
    }
  }

  throw lastError || new Error('Translations could not be loaded');
};

export const i18nReady = i18n
  .use(FetchBackend)
  .use(initReactI18next)
  .init({
    fallbackLng: false,
    returnNull: false,
    saveMissing: false,
    lng: Localization.getLocales()[0]?.languageCode || 'en',
    load: 'languageOnly',
    preload: PRELOAD_LANGUAGES,
    parseMissingKeyHandler: (key) => `[missing key: ${key}]`,
    interpolation: {
      escapeValue: false
    },
    react: {
      bindI18n: 'languageChanged loaded'
    },
    backend: {
      loadPath: `${TRANSLATION_SOURCES[0]}/{{lng}}.json`,
      fetch: fetchTranslationWithFallback
    }
  })
  .then(() => {
    const shortLang = i18n.language.split('-')[0];

    if (i18n.language !== shortLang) {
      i18n.changeLanguage(shortLang);
    }

    moment.locale(shortLang);
  });

i18n.on('languageChanged', (language) => {
  moment.locale(language.split('-')[0]);
});

export const reloadI18nResources = async (languages = []) => {
  await i18nReady;

  const activeLanguage = String(i18n.resolvedLanguage || i18n.language || 'en')
    .split('-')[0]
    .trim();
  const normalizedLanguages = Array.from(
    new Set(
      (Array.isArray(languages) && languages.length ? languages : [activeLanguage])
        .map((language) =>
          String(language || '')
            .split('-')[0]
            .trim()
        )
        .filter(Boolean)
    )
  );

  translationVersion = Date.now();
  await i18n.reloadResources(normalizedLanguages);

  if (activeLanguage) {
    i18n.emit('languageChanged', activeLanguage);
  }
};

export default i18n;
