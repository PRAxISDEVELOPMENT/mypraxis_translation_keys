const path = require('path');
const { LOCALES } = require('../core/constants');
const { readApplicationConfig, readNamespaceConfig } = require('../core/config-loader');
const { hasOwn, readSourceEntries, sortEntries, toOptionalTrimmedString } = require('../core/source-entries');
const { readJsonFile, writeJsonFile } = require('../core/json-files');
const { ROOT_DIR, SOURCE_PATH } = require('../core/path-config');
const { runBuild } = require('../core/script-runner');
const { createReportSkeleton } = require('./report-factory');
const {
  buildSuggestedKey,
  ensureUniqueKey,
  getDefaultProposalApplications
} = require('./key-suggestions');
const { getUploadText } = require('./upload-text');

const DIRECT_UPDATE_ALLOWED_FIELDS = new Set(['key', ...LOCALES]);
const PROPOSAL_ALLOWED_FIELDS = new Set([...LOCALES, 'description', 'notes']);

function getUnexpectedFields(entry, allowedFields) {
  return Object.keys(entry).filter((field) => !allowedFields.has(field));
}

function buildDirectUpdate(uploadEntry, existingEntry, index) {
  const unexpectedFields = getUnexpectedFields(uploadEntry, DIRECT_UPDATE_ALLOWED_FIELDS);

  if (unexpectedFields.length > 0) {
    return {
      type: 'error',
      index,
      key: existingEntry.key,
      reason: `Direct updates may only contain key, nl, fr, and en. Unexpected fields: ${unexpectedFields.join(', ')}.`
    };
  }

  const changes = {};

  for (const locale of LOCALES) {
    const nextValue = toOptionalTrimmedString(uploadEntry[locale]);

    if (nextValue === null || nextValue === '') {
      continue;
    }

    if (nextValue !== existingEntry[locale]) {
      changes[locale] = nextValue;
    }
  }

  if (Object.keys(changes).length === 0) {
    return {
      type: 'skipped',
      index,
      key: existingEntry.key,
      reason: 'No locale changes were provided for the existing key.'
    };
  }

  return {
    type: 'directUpdate',
    index,
    key: existingEntry.key,
    namespace: existingEntry.key.split('.')[0],
    changes,
    current: Object.fromEntries(LOCALES.map((locale) => [locale, existingEntry[locale]])),
    next: Object.fromEntries(LOCALES.map((locale) => [locale, changes[locale] ?? existingEntry[locale]]))
  };
}

function buildProposal(uploadEntry, index, usedKeys, namespaceConfig, applicationConfig) {
  const text = getUploadText(uploadEntry);
  const unexpectedFields = getUnexpectedFields(uploadEntry, PROPOSAL_ALLOWED_FIELDS);

  if (!text) {
    return {
      type: 'skipped',
      index,
      reason: 'Proposal entry did not contain any locale text.'
    };
  }

  if (unexpectedFields.length > 0) {
    return {
      type: 'error',
      index,
      reason: `Proposal entries may only contain nl, fr, en, description, and notes. Unexpected fields: ${unexpectedFields.join(', ')}.`
    };
  }

  if (hasOwn(uploadEntry, 'key')) {
    return {
      type: 'error',
      index,
      reason: 'Proposal entries may not contain a key. Existing keys must be sent through the direct-update path.'
    };
  }

  const { namespaceSuggestion, suggestedKey } = buildSuggestedKey(uploadEntry, usedKeys, namespaceConfig);
  const proposedEntry = {
    key: suggestedKey,
    nl: toOptionalTrimmedString(uploadEntry.nl) ?? '',
    fr: toOptionalTrimmedString(uploadEntry.fr) ?? '',
    en: toOptionalTrimmedString(uploadEntry.en) ?? '',
    applications: getDefaultProposalApplications(applicationConfig)
  };

  if (typeof uploadEntry.description === 'string' && uploadEntry.description.trim() !== '') {
    proposedEntry.description = uploadEntry.description.trim();
  }

  if (typeof uploadEntry.notes === 'string' && uploadEntry.notes.trim() !== '') {
    proposedEntry.notes = uploadEntry.notes.trim();
  }

  return {
    type: 'proposal',
    index,
    suggestedKey,
    suggestedNamespace: namespaceSuggestion.namespace,
    confidence: namespaceSuggestion.confidence,
    reason: namespaceSuggestion.reason,
    proposedEntry,
    reviewRequired: true
  };
}

function applyDirectUpdates(entries, directUpdates) {
  const byKey = new Map(entries.map((entry) => [entry.key, entry]));

  for (const update of directUpdates) {
    const entry = byKey.get(update.key);

    if (!entry) {
      throw new Error(`Cannot apply direct update for missing key "${update.key}".`);
    }

    for (const [locale, value] of Object.entries(update.changes)) {
      entry[locale] = value;
    }
  }
}

function prepareUpload(options) {
  if (!options.input) {
    throw new Error('The prepare command requires --input <file>.');
  }

  const payload = readJsonFile(path.resolve(options.input));

  if (!payload || !Array.isArray(payload.entries)) {
    throw new Error('Upload payload must contain an "entries" array.');
  }

  const entries = readSourceEntries();
  const namespaceConfig = readNamespaceConfig();
  const applicationConfig = readApplicationConfig();
  const byKey = new Map(entries.map((entry) => [entry.key, entry]));
  const usedKeys = new Set(entries.map((entry) => entry.key));
  const report = createReportSkeleton('prepare', options.input);
  const directUpdates = [];

  report.summary.totalEntries = payload.entries.length;

  payload.entries.forEach((uploadEntry, uploadIndex) => {
    const index = uploadIndex + 1;

    if (!uploadEntry || typeof uploadEntry !== 'object' || Array.isArray(uploadEntry)) {
      report.errors.push({
        index,
        reason: 'Each uploaded entry must be an object.'
      });
      return;
    }

    const normalizedKey =
      typeof uploadEntry.key === 'string' && uploadEntry.key.trim() !== '' ? uploadEntry.key.trim() : '';

    if (hasOwn(uploadEntry, 'key') && !normalizedKey) {
      report.errors.push({
        index,
        reason: 'If a key is provided, it must be a non-empty string.'
      });
      return;
    }

    if (normalizedKey) {
      const existingEntry = byKey.get(normalizedKey);

      if (!existingEntry) {
        report.errors.push({
          index,
          key: normalizedKey,
          reason:
            'The uploaded key does not exist in i18n/source/translations.json and cannot be treated as a direct update.'
        });
        return;
      }

      const result = buildDirectUpdate(uploadEntry, existingEntry, index);

      if (result.type === 'error') {
        report.errors.push(result);
        return;
      }

      if (result.type === 'skipped') {
        report.skipped.push(result);
        return;
      }

      report.directUpdates.push(result);
      directUpdates.push(result);
      return;
    }

    const proposal = buildProposal(uploadEntry, index, usedKeys, namespaceConfig, applicationConfig);

    if (proposal.type === 'error') {
      report.errors.push(proposal);
      return;
    }

    if (proposal.type === 'skipped') {
      report.skipped.push(proposal);
      return;
    }

    report.proposals.push(proposal);
  });

  if (options.applyDirect && directUpdates.length > 0) {
    applyDirectUpdates(entries, directUpdates);
    sortEntries(entries);
    writeJsonFile(SOURCE_PATH, entries);

    if (options.build) {
      runBuild();
    }

    report.summary.appliedDirectUpdates = directUpdates.length;
  }

  report.summary.directUpdates = report.directUpdates.length;
  report.summary.proposals = report.proposals.length;
  report.summary.skipped = report.skipped.length;
  report.summary.errors = report.errors.length;

  const reportPath = path.resolve(options.report || `${options.input}.report.json`);
  writeJsonFile(reportPath, report);

  console.log('\nUpload Preparation Report');
  console.log(`  Input entries:          ${report.summary.totalEntries}`);
  console.log(`  Direct updates:         ${report.summary.directUpdates}`);
  console.log(`  Applied direct updates: ${report.summary.appliedDirectUpdates}`);
  console.log(`  New proposals:          ${report.summary.proposals}`);
  console.log(`  Skipped:                ${report.summary.skipped}`);
  console.log(`  Errors:                 ${report.summary.errors}`);
  console.log(`  Report:                 ${path.relative(ROOT_DIR, reportPath)}`);

  if (report.errors.length > 0) {
    process.exitCode = 1;
  }
}

function applyProposals(options) {
  if (!options.input) {
    throw new Error('The apply-proposals command requires --input <report-file>.');
  }

  const report = readJsonFile(path.resolve(options.input));

  if (!report || !Array.isArray(report.proposals)) {
    throw new Error('Proposal report must contain a "proposals" array.');
  }

  const entries = readSourceEntries();
  const namespaceConfig = readNamespaceConfig();
  const usedKeys = new Set(entries.map((entry) => entry.key));

  for (const proposal of report.proposals) {
    const namespace = proposal.suggestedNamespace;

    if (!namespaceConfig.namespaceMap.has(namespace)) {
      throw new Error(
        `Proposal "${proposal.suggestedKey}" uses namespace "${namespace}" which is not in i18n/config/namespaces.json.`
      );
    }
  }

  const acceptedEntries = [];

  for (const proposal of report.proposals) {
    const proposedEntry = {
      ...proposal.proposedEntry
    };

    if (usedKeys.has(proposedEntry.key)) {
      proposedEntry.key = ensureUniqueKey(proposedEntry.key, usedKeys);
    } else {
      usedKeys.add(proposedEntry.key);
    }

    acceptedEntries.push(proposedEntry);
    entries.push(proposedEntry);
  }

  sortEntries(entries);
  writeJsonFile(SOURCE_PATH, entries);

  if (options.build) {
    runBuild();
  }

  console.log('\nApplied Proposal Entries');
  console.log(`  Accepted proposals: ${acceptedEntries.length}`);
  console.log(`  Source file:        ${path.relative(ROOT_DIR, SOURCE_PATH)}`);
}

function runProcessUploadCommand(argv = process.argv.slice(2)) {
  const { parseProcessUploadArgs, printProcessUploadHelp } = require('./cli-options');
  const options = parseProcessUploadArgs(argv);
  const command = options._[0] || 'prepare';

  if (options.help) {
    printProcessUploadHelp();
    return;
  }

  if (command === 'prepare') {
    prepareUpload(options);
    return;
  }

  if (command === 'apply-proposals') {
    applyProposals(options);
    return;
  }

  throw new Error(`Unknown command "${command}".`);
}

module.exports = {
  applyProposals,
  prepareUpload,
  runProcessUploadCommand
};
