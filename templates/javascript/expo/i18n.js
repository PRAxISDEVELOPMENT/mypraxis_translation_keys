import * as Localization from 'expo-localization';
import i18n from 'i18next';
import FetchBackend from 'i18next-fetch-backend';
import { initReactI18next } from 'react-i18next';
import moment from 'moment';
import 'moment/locale/fr';
import 'moment/locale/nl';

const PRELOAD_LANGUAGES = ['en', 'nl', 'fr'];
const TRANSLATION_REQUEST_TIMEOUT_MS = 5000;
const TRANSLATION_CDN_BASE_URL =
  'https://praxis-translations.development-3e6.workers.dev';
const GITHUB_RAW_BASE_URL =
  'https://raw.githubusercontent.com/PRAxISDEVELOPMENT/mypraxis_translation_keys/main/i18n/artifacts/generated';
const TRANSLATION_SOURCES = [
  TRANSLATION_CDN_BASE_URL,
  GITHUB_RAW_BASE_URL
];

const getTranslationFilename = (url) => {
  const filename = new URL(url).pathname.split('/').pop();

  if (!PRELOAD_LANGUAGES.some((language) => filename === `${language}.json`)) {
    throw new Error(`Unexpected translation filename: ${filename || 'missing'}`);
  }

  return filename;
};

const fetchTranslationWithFallback = async (url, options = {}) => {
  const filename = getTranslationFilename(url);
  let lastError;

  for (const source of TRANSLATION_SOURCES) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), TRANSLATION_REQUEST_TIMEOUT_MS);

    try {
      const response = await fetch(`${source}/${filename}`, {
        ...options,
        cache: 'no-cache',
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
      loadPath: `${TRANSLATION_CDN_BASE_URL}/{{lng}}.json`,
      fetch: fetchTranslationWithFallback
    }
  })
  .then(async () => {
    const shortLang = i18n.language.split('-')[0];

    if (i18n.language !== shortLang) {
      await i18n.changeLanguage(shortLang);
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

  await i18n.reloadResources(normalizedLanguages);

  if (activeLanguage) {
    i18n.emit('languageChanged', activeLanguage);
  }
};

export default i18n;
