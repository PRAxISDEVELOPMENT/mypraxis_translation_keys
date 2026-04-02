const { readJsonFile } = require('./json');
const { SOURCE_PATH } = require('./paths');

function readSourceEntries() {
  const parsed = readJsonFile(SOURCE_PATH);

  if (!Array.isArray(parsed)) {
    throw new Error('translations.json must contain an array of translation entries.');
  }

  return parsed;
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

function hasOwn(entry, field) {
  return Object.prototype.hasOwnProperty.call(entry, field);
}

module.exports = {
  hasOwn,
  readSourceEntries,
  sortEntries,
  toOptionalTrimmedString
};
