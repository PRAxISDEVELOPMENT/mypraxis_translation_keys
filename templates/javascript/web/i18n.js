import i18n from 'i18next';
import Backend from 'i18next-http-backend';
import LanguageDetector from 'i18next-browser-languagedetector';
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

const fetchTranslation = async (url) => {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TRANSLATION_REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      cache: 'no-cache',
      signal: controller.signal
    });

    if (!response.ok) {
      throw new Error(`Translation request failed: ${response.status}`);
    }

    const data = await response.text();

    JSON.parse(data);

    return {
      status: response.status,
      data
    };
  } finally {
    clearTimeout(timeout);
  }
};

const loadTranslationsWithFallback = async (_options, url, _payload, callback) => {
  let lastError;

  try {
    const filename = getTranslationFilename(url);

    for (const source of TRANSLATION_SOURCES) {
      const translationUrl = `${source}/${filename}`;

      console.info(`[i18n] Trying translation source: ${translationUrl}`);

      try {
        const translation = await fetchTranslation(translationUrl);

        console.info(
          `[i18n] Loaded translations from: ${translationUrl} (HTTP ${translation.status})`
        );

        callback(null, translation);
        return;
      } catch (error) {
        console.warn(`[i18n] Translation source failed: ${translationUrl}`, error);
        lastError = error;
      }
    }
  } catch (error) {
    lastError = error;
  }

  callback(lastError || new Error('Translations could not be loaded'), null);
};

export const i18nReady = i18n
  .use(Backend)
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    fallbackLng: false,
    returnNull: false,
    saveMissing: false,
    load: 'languageOnly',
    preload: PRELOAD_LANGUAGES,
    parseMissingKeyHandler: (key) => `[missing key: ${key}]`,
    interpolation: {
      escapeValue: false
    },
    react: {
      bindI18n: 'languageChanged loaded'
    },
    detection: {
      order: ['navigator'],
      caches: []
    },
    backend: {
      reloadInterval: false,
      loadPath: `${TRANSLATION_CDN_BASE_URL}/{{lng}}.json`,
      request: loadTranslationsWithFallback
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

i18n.on('languageChanged', (language) => {
  const shortLang = language.split('-')[0];

  moment.locale(shortLang);

  if (typeof document !== 'undefined') {
    document.documentElement.lang = shortLang;
  }
});

export const reloadI18nResources = async (languages = []) => {
  await i18nReady;

  const activeLanguage = String(i18n.resolvedLanguage || i18n.language || 'nl')
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
