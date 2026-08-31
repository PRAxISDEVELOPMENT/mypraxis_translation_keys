import i18n from 'i18next';
import Backend from 'i18next-http-backend';
import LanguageDetector from 'i18next-browser-languagedetector';
import { initReactI18next } from 'react-i18next';
import moment from 'moment';
import 'moment/locale/fr';
import 'moment/locale/nl';

const PRELOAD_LANGUAGES = ['en', 'nl', 'fr'] as const;
const TRANSLATION_REQUEST_TIMEOUT_MS = 5000;

const TRANSLATION_CDN_BASE_URL =
  'https://praxis-translations.development-3e6.workers.dev';

const GITHUB_RAW_BASE_URL =
  'https://raw.githubusercontent.com/PRAxISDEVELOPMENT/mypraxis_translation_keys/main/i18n/artifacts/generated';

const TRANSLATION_SOURCES: readonly string[] = [
  TRANSLATION_CDN_BASE_URL,
  GITHUB_RAW_BASE_URL
];

type TranslationResponse = {
  status: number;
  data: string;
};

type TranslationRequestCallback = (
  error: Error | null,
  response: TranslationResponse | null
) => void;

const getTranslationFilename = (url: string): string => {
  const filename = new URL(url).pathname.split('/').pop();

  if (!PRELOAD_LANGUAGES.some((language) => filename === `${language}.json`)) {
    throw new Error(`Unexpected translation filename: ${filename || 'missing'}`);
  }

  return filename;
};

const fetchTranslation = async (url: string): Promise<TranslationResponse> => {
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

const loadTranslationsWithFallback = async (
  _options: unknown,
  url: string,
  _payload: unknown,
  callback: TranslationRequestCallback
): Promise<void> => {
  let lastError: Error | undefined;

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
        lastError = error instanceof Error ? error : new Error(String(error));
      }
    }
  } catch (error) {
    lastError = error instanceof Error ? error : new Error(String(error));
  }

  callback(lastError || new Error('Translations could not be loaded'), null);
};

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

i18n.on('languageChanged', (language: string) => {
  const shortLang = language.split('-')[0];

  moment.locale(shortLang);

  if (typeof document !== 'undefined') {
    document.documentElement.lang = shortLang;
  }
});

export const reloadI18nResources = async (languages: readonly string[] = []): Promise<void> => {
  await i18nReady;

  const activeLanguage = String(i18n.resolvedLanguage || i18n.language || 'nl')
    .split('-')[0]
    .trim();
  const normalizedLanguages = Array.from(
    new Set(
      (languages.length ? languages : [activeLanguage])
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
