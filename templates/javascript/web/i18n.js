import i18n from 'i18next';
import Backend from 'i18next-http-backend';
import LanguageDetector from 'i18next-browser-languagedetector';
import { initReactI18next } from 'react-i18next';
import moment from 'moment';
import 'moment/locale/fr';
import 'moment/locale/nl';

const PRELOAD_LANGUAGES = ['en', 'nl', 'fr'];
const TRANSLATION_REQUEST_TIMEOUT_MS = 5000;
const TRANSLATION_RELOAD_INTERVAL_MS = 5 * 60 * 1000;
const TRANSLATION_SOURCES = [
  'https://cdn.jsdelivr.net/gh/PRAxISDEVELOPMENT/mypraxis_translation_keys@main/i18n/artifacts/generated',
  'https://raw.githubusercontent.com/PRAxISDEVELOPMENT/mypraxis_translation_keys/main/i18n/artifacts/generated'
];

const fetchTranslation = async (url, version) => {
  const requestUrl = new URL(url);

  if (version) {
    requestUrl.searchParams.set('v', version);
  }

  const response = await fetch(requestUrl, {
    cache: 'no-store',
    signal: AbortSignal.timeout(TRANSLATION_REQUEST_TIMEOUT_MS)
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
};

const loadTranslationsWithFallback = async (options, url, _payload, callback) => {
  const version = options?.queryStringParams?.v;
  let lastError;

  for (const source of TRANSLATION_SOURCES) {
    try {
      const sourceUrl = url.replace(TRANSLATION_SOURCES[0], source);
      const translation = await fetchTranslation(sourceUrl, version);

      callback(null, translation);
      return;
    } catch (error) {
      lastError = error;
    }
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
      reloadInterval: TRANSLATION_RELOAD_INTERVAL_MS,
      queryStringParams: { v: Date.now() },
      loadPath: `${TRANSLATION_SOURCES[0]}/{{lng}}.json`,
      request: loadTranslationsWithFallback
    }
  })
  .then(() => {
    const shortLang = i18n.language.split('-')[0];

    if (i18n.language !== shortLang) {
      i18n.changeLanguage(shortLang);
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

  const backendOptions = i18n.services?.backendConnector?.backend?.options;
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

  if (backendOptions) {
    backendOptions.queryStringParams = {
      ...(backendOptions.queryStringParams || {}),
      v: Date.now()
    };
  }

  await i18n.reloadResources(normalizedLanguages);

  if (activeLanguage) {
    i18n.emit('languageChanged', activeLanguage);
  }
};

export default i18n;
