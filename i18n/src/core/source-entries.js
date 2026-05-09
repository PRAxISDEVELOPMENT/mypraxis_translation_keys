const { readJsonFile } = require('./json-files');
const { SOURCE_PATH } = require('./path-config');
const {
  DEFAULT_TRANSLATION_STATUS,
  LOCALES,
  TRANSLATION_STATUSES
} = require('./constants');

function readSourceEntries() {
  const parsed = readJsonFile(SOURCE_PATH);

  if (!Array.isArray(parsed)) {
    throw new Error('translations.json must contain an array of translation entries.');
  }

  return parsed;
}

function sanitizeSourceEntry(entry) {
  const sanitized = {
    key: entry.key,
    nl: typeof entry.nl === 'string' ? entry.nl : '',
    fr: typeof entry.fr === 'string' ? entry.fr : '',
    en: typeof entry.en === 'string' ? entry.en : '',
    applications: Array.isArray(entry.applications) ? entry.applications : []
  };

  const status = sanitizeStatusMap(entry.status);

  if (status) {
    sanitized.status = status;
  }

  return sanitized;
}

function sanitizeSourceEntries(entries) {
  return entries.map((entry) => sanitizeSourceEntry(entry));
}

function sortEntries(entries) {
  entries.sort((left, right) => {
    const keyCompare = String(left.key).localeCompare(String(right.key));

    if (keyCompare !== 0) {
      return keyCompare;
    }

    return String(left.en || '').localeCompare(String(right.en || ''));
  });
}

function toOptionalTrimmedString(value) {
  if (typeof value !== 'string') {
    return null;
  }

  return value.trim();
}

function normalizeStatusValue(value) {
  if (typeof value !== 'string') {
    return null;
  }

  const normalized = value.trim();
  return TRANSLATION_STATUSES.includes(normalized) ? normalized : null;
}

function getLocaleStatus(entry, locale) {
  if (!entry || !entry.status || typeof entry.status !== 'object' || Array.isArray(entry.status)) {
    return DEFAULT_TRANSLATION_STATUS;
  }

  return normalizeStatusValue(entry.status[locale]) || DEFAULT_TRANSLATION_STATUS;
}

function sanitizeStatusMap(status) {
  if (!status || typeof status !== 'object' || Array.isArray(status)) {
    return undefined;
  }

  const result = {};

  for (const locale of LOCALES) {
    const normalized = normalizeStatusValue(status[locale]);

    if (normalized && normalized !== DEFAULT_TRANSLATION_STATUS) {
      result[locale] = normalized;
    }
  }

  return Object.keys(result).length > 0 ? result : undefined;
}

function hasOwn(entry, field) {
  return Object.prototype.hasOwnProperty.call(entry, field);
}

module.exports = {
  hasOwn,
  getLocaleStatus,
  normalizeStatusValue,
  readSourceEntries,
  sanitizeSourceEntries,
  sanitizeStatusMap,
  sortEntries,
  toOptionalTrimmedString
};
