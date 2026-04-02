const { toOptionalTrimmedString } = require('../shared/entries');

function getUploadText(entry) {
  for (const locale of ['en', 'nl', 'fr']) {
    const value = toOptionalTrimmedString(entry[locale]);

    if (value) {
      return value;
    }
  }

  return '';
}

function getSuggestionContext(entry) {
  return [
    getUploadText(entry),
    toOptionalTrimmedString(entry.description),
    toOptionalTrimmedString(entry.notes)
  ]
    .filter(Boolean)
    .join(' ');
}

function normalizeWords(input) {
  return input
    .replace(/\{\{\s*[^}]+\s*\}\}/g, ' ')
    .replace(/e-mail/gi, ' email ')
    .replace(/2FA/gi, ' two factor authentication ')
    .replace(/back[ -]?up/gi, ' backup ')
    .replace(/[“”‘’]/g, ' ')
    .replace(/&/g, ' and ')
    .replace(/\//g, ' ')
    .replace(/[^A-Za-z0-9]+/g, ' ')
    .trim();
}

function toCamelCase(input) {
  const words = normalizeWords(input).split(/\s+/).filter(Boolean);

  return words
    .map((word, index) => {
      const lower = word.toLowerCase();
      const mapped = ['api', 'url', 'pdf', 'csv', 'sms', 'fcm', 'ip', 'wan'].includes(lower)
        ? lower.toUpperCase()
        : lower;

      if (index === 0) {
        return mapped.charAt(0).toLowerCase() + mapped.slice(1);
      }

      return mapped.charAt(0).toUpperCase() + mapped.slice(1);
    })
    .join('');
}

function buildLeafKey(text) {
  const trimmed = text.trim().replace(/[.]+$/, '');
  const replacements = [
    [/^You are about to\s+/i, 'aboutTo '],
    [/^Please\s+/i, 'please '],
    [/^To disable\s+/i, 'disable '],
    [/^To enable\s+/i, 'enable '],
    [/^I hereby confirm that I agree to\s+/i, 'confirm '],
    [/^As soon as\s+/i, 'once ']
  ];

  let candidate = trimmed;

  for (const [pattern, replacement] of replacements) {
    if (pattern.test(candidate)) {
      candidate = candidate.replace(pattern, replacement);
      break;
    }
  }

  const key = toCamelCase(candidate);

  if (key.length <= 72) {
    return key;
  }

  const shortened = normalizeWords(candidate).split(/\s+/).filter(Boolean).slice(0, 8).join(' ');
  return toCamelCase(shortened);
}

module.exports = {
  buildLeafKey,
  getSuggestionContext,
  getUploadText,
  normalizeWords,
  toCamelCase
};
