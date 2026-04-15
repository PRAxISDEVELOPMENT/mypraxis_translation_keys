const path = require('path');
const { LOCALES } = require('../core/constants');
const { readApplicationConfig, readNamespaceConfig } = require('../core/config-loader');
const { ensureDirectory, readJsonFile, writeJsonFile } = require('../core/json-files');
const {
  DEFAULT_PENDING_PROPOSALS_DIR,
  DEFAULT_PROCESSED_PROPOSALS_DIR,
  DEFAULT_REPORTS_DIR,
  ROOT_DIR,
  SOURCE_PATH
} = require('../core/path-config');
const { runBuild } = require('../core/script-runner');
const { readSourceEntries, sortEntries, toOptionalTrimmedString } = require('../core/source-entries');
const { archiveFileWithUniqueName, listJsonFiles } = require('../core/upload-files');

function normalizeSubmittedEntry(proposal) {
  const submittedEntry = proposal && proposal.submittedEntry && typeof proposal.submittedEntry === 'object'
    ? proposal.submittedEntry
    : {};

  const normalized = {};

  for (const locale of LOCALES) {
    normalized[locale] = toOptionalTrimmedString(submittedEntry[locale]) ?? '';
  }

  const description = toOptionalTrimmedString(submittedEntry.description);
  const notes = toOptionalTrimmedString(submittedEntry.notes);

  if (description) {
    normalized.description = description;
  }

  if (notes) {
    normalized.notes = notes;
  }

  return normalized;
}

function getProposalFileBaseName(report, proposal) {
  const inputBaseName = path.basename(report.inputFile || 'proposal', '.json');
  return `${inputBaseName}.proposal-${String(proposal.index).padStart(2, '0')}`;
}

function getUniqueProposalObjectPath(outputDir, baseName) {
  let candidatePath = path.join(outputDir, `${baseName}.json`);
  let counter = 2;

  while (pathExists(candidatePath)) {
    candidatePath = path.join(outputDir, `${baseName}-${counter}.json`);
    counter += 1;
  }

  return candidatePath;
}

function pathExists(filePath) {
  try {
    require('fs').accessSync(filePath);
    return true;
  } catch (_error) {
    return false;
  }
}

function createProposalReviewObject(report, reportPath, proposal) {
  const proposalId = getProposalFileBaseName(report, proposal);

  return {
    version: 1,
    proposalId,
    status: 'pending-review',
    createdAt: new Date().toISOString(),
    source: {
      uploadFile: report.inputFile,
      reportFile: path.relative(ROOT_DIR, path.resolve(reportPath)),
      uploadEntryIndex: proposal.index
    },
    review: {
      required: true,
      suggestedKey: proposal.suggestedKey || proposal.proposedEntry.key,
      suggestedNamespace: proposal.suggestedNamespace || '',
      confidence: proposal.confidence || 'unknown',
      reason: proposal.reason || '',
      instructions:
        'Edit proposedEntry in this file when the key, applications, or locale text needs adjustment before merge.'
    },
    originalEntry: normalizeSubmittedEntry(proposal),
    proposedEntry: {
      ...proposal.proposedEntry
    }
  };
}

function queueProposalReviewObjects(options) {
  const inputPath = path.resolve(options.input);
  const outputDir = path.resolve(options.outputDir || DEFAULT_PENDING_PROPOSALS_DIR);
  const report = readJsonFile(inputPath);

  if (!report || !Array.isArray(report.proposals)) {
    throw new Error('Proposal report must contain a "proposals" array.');
  }

  ensureDirectory(outputDir);

  const queuedPaths = [];

  for (const proposal of report.proposals) {
    const reviewObject = createProposalReviewObject(report, inputPath, proposal);
    const targetPath = getUniqueProposalObjectPath(outputDir, reviewObject.proposalId);
    writeJsonFile(targetPath, reviewObject);
    queuedPaths.push(targetPath);
  }

  console.log('\nQueued Proposal Review Objects');
  console.log(`  Input report:   ${path.relative(ROOT_DIR, inputPath)}`);
  console.log(`  Output dir:     ${path.relative(ROOT_DIR, outputDir)}`);
  console.log(`  Proposal files: ${queuedPaths.length}`);

  return queuedPaths;
}

function normalizeRequiredKey(key, fileLabel) {
  const normalizedKey = toOptionalTrimmedString(key);

  if (!normalizedKey) {
    throw new Error(`Proposal object "${fileLabel}" must define a non-empty proposedEntry.key.`);
  }

  return normalizedKey;
}

function normalizeApplications(applications, applicationConfig, fileLabel) {
  if (!Array.isArray(applications) || applications.length === 0) {
    throw new Error(`Proposal object "${fileLabel}" must define a non-empty proposedEntry.applications array.`);
  }

  const normalized = applications.map((value) => {
    if (typeof value !== 'string' || value.trim() === '') {
      throw new Error(`Proposal object "${fileLabel}" contains an invalid application value.`);
    }

    return value.trim();
  });

  if (new Set(normalized).size !== normalized.length) {
    throw new Error(`Proposal object "${fileLabel}" contains duplicate applications.`);
  }

  const invalidApplications = normalized.filter((value) => !applicationConfig.applicationMap.has(value));

  if (invalidApplications.length > 0) {
    throw new Error(
      `Proposal object "${fileLabel}" uses invalid applications: ${invalidApplications.join(', ')}.`
    );
  }

  return normalized;
}

function normalizeLocaleValue(value, locale, fileLabel) {
  if (typeof value !== 'string') {
    throw new Error(`Proposal object "${fileLabel}" must define proposedEntry.${locale} as a string.`);
  }

  return value.trim();
}

function normalizeOptionalText(value, field, fileLabel) {
  if (value === undefined) {
    return undefined;
  }

  if (typeof value !== 'string') {
    throw new Error(`Proposal object "${fileLabel}" must define proposedEntry.${field} as a string when present.`);
  }

  const normalized = value.trim();
  return normalized === '' ? undefined : normalized;
}

function validateProposalNamespace(key, namespaceConfig, fileLabel) {
  const namespace = key.split('.')[0];

  if (!namespace || !namespaceConfig.namespaceMap.has(namespace)) {
    throw new Error(
      `Proposal object "${fileLabel}" uses key "${key}" with unknown namespace "${namespace}".`
    );
  }
}

function normalizeProposedEntry(proposedEntry, namespaceConfig, applicationConfig, fileLabel) {
  if (!proposedEntry || typeof proposedEntry !== 'object' || Array.isArray(proposedEntry)) {
    throw new Error(`Proposal object "${fileLabel}" must contain a proposedEntry object.`);
  }

  const normalizedEntry = {
    key: normalizeRequiredKey(proposedEntry.key, fileLabel),
    applications: normalizeApplications(proposedEntry.applications, applicationConfig, fileLabel)
  };

  validateProposalNamespace(normalizedEntry.key, namespaceConfig, fileLabel);

  for (const locale of LOCALES) {
    normalizedEntry[locale] = normalizeLocaleValue(proposedEntry[locale], locale, fileLabel);
  }

  const description = normalizeOptionalText(proposedEntry.description, 'description', fileLabel);
  const notes = normalizeOptionalText(proposedEntry.notes, 'notes', fileLabel);

  if (description) {
    normalizedEntry.description = description;
  }

  if (notes) {
    normalizedEntry.notes = notes;
  }

  if (proposedEntry.deprecated !== undefined) {
    if (typeof proposedEntry.deprecated !== 'boolean') {
      throw new Error(`Proposal object "${fileLabel}" must define proposedEntry.deprecated as a boolean when present.`);
    }

    normalizedEntry.deprecated = proposedEntry.deprecated;
  }

  return normalizedEntry;
}

function createAppliedProposalReport(appliedEntries) {
  return {
    version: 1,
    command: 'apply-pending-proposals',
    createdAt: new Date().toISOString(),
    summary: {
      proposalFiles: appliedEntries.length,
      appliedEntries: appliedEntries.length
    },
    applied: appliedEntries
  };
}

function createAppliedProposalReportPath(reportsDir) {
  const stamp = new Date().toISOString().replace(/[-:TZ.]/g, '').slice(0, 14);
  return path.join(reportsDir, `pending-proposals-${stamp}.applied.report.json`);
}

function applyPendingProposalFiles(options = {}) {
  const inputDir = path.resolve(options.inputDir || DEFAULT_PENDING_PROPOSALS_DIR);
  const processedDir = path.resolve(options.processedDir || DEFAULT_PROCESSED_PROPOSALS_DIR);
  const reportsDir = path.resolve(options.reportsDir || DEFAULT_REPORTS_DIR);
  const proposalFiles = listJsonFiles(inputDir);

  console.log('\nApply Pending Proposal Objects');
  console.log(`  Input dir:  ${path.relative(ROOT_DIR, inputDir)}`);
  console.log(`  Dry run:    ${options.dryRun ? 'yes' : 'no'}`);
  console.log(`  Files:      ${proposalFiles.length}`);

  if (proposalFiles.length === 0) {
    console.log('No pending proposal objects found.');
    return {
      appliedEntries: 0,
      proposalFiles: 0
    };
  }

  const entries = readSourceEntries();
  const namespaceConfig = readNamespaceConfig();
  const applicationConfig = readApplicationConfig();
  const usedKeys = new Set(entries.map((entry) => entry.key));
  const batchKeys = new Set();
  const normalizedEntries = [];

  for (const filePath of proposalFiles) {
    const fileLabel = path.relative(ROOT_DIR, filePath);
    const proposalObject = readJsonFile(filePath);
    const normalizedEntry = normalizeProposedEntry(
      proposalObject.proposedEntry,
      namespaceConfig,
      applicationConfig,
      fileLabel
    );

    if (usedKeys.has(normalizedEntry.key)) {
      throw new Error(
        `Proposal object "${fileLabel}" uses key "${normalizedEntry.key}" which already exists in i18n/source/translations.json.`
      );
    }

    if (batchKeys.has(normalizedEntry.key)) {
      throw new Error(
        `Multiple pending proposal objects define the same key "${normalizedEntry.key}".`
      );
    }

    batchKeys.add(normalizedEntry.key);
    normalizedEntries.push({
      filePath,
      fileLabel,
      proposalId:
        typeof proposalObject.proposalId === 'string' && proposalObject.proposalId.trim() !== ''
          ? proposalObject.proposalId.trim()
          : path.basename(filePath, '.json'),
      sourceUploadFile:
        proposalObject.source && typeof proposalObject.source.uploadFile === 'string'
          ? proposalObject.source.uploadFile
          : '',
      entry: normalizedEntry
    });
  }

  console.log(`  Valid objects: ${normalizedEntries.length}`);

  if (options.dryRun) {
    return {
      appliedEntries: normalizedEntries.length,
      proposalFiles: proposalFiles.length
    };
  }

  for (const normalizedEntry of normalizedEntries) {
    entries.push(normalizedEntry.entry);
  }

  sortEntries(entries);
  writeJsonFile(SOURCE_PATH, entries);

  ensureDirectory(processedDir);
  ensureDirectory(reportsDir);

  const appliedEntries = normalizedEntries.map((item) => ({
    proposalId: item.proposalId,
    proposalFile: item.fileLabel,
    sourceUploadFile: item.sourceUploadFile,
    key: item.entry.key,
    applications: item.entry.applications,
    nl: item.entry.nl,
    fr: item.entry.fr,
    en: item.entry.en
  }));

  for (const normalizedEntry of normalizedEntries) {
    archiveFileWithUniqueName(normalizedEntry.filePath, processedDir);
  }

  const reportPath = createAppliedProposalReportPath(reportsDir);
  writeJsonFile(reportPath, createAppliedProposalReport(appliedEntries));

  if (options.build) {
    runBuild();
  }

  console.log(`  Applied entries: ${appliedEntries.length}`);
  console.log(`  Source file:     ${path.relative(ROOT_DIR, SOURCE_PATH)}`);
  console.log(`  Apply report:    ${path.relative(ROOT_DIR, reportPath)}`);

  return {
    appliedEntries: appliedEntries.length,
    proposalFiles: proposalFiles.length,
    reportPath
  };
}

module.exports = {
  applyPendingProposalFiles,
  queueProposalReviewObjects
};
