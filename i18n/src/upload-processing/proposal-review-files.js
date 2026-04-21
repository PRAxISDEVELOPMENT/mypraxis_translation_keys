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
const {
  readSourceEntries,
  sanitizeSourceEntries,
  sortEntries,
  toOptionalTrimmedString
} = require('../core/source-entries');
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
  const requestedNamespace = toOptionalTrimmedString(submittedEntry.requestedNamespace);

  if (description) {
    normalized.description = description;
  }

  if (notes) {
    normalized.notes = notes;
  }

  if (requestedNamespace) {
    normalized.requestedNamespace = requestedNamespace;
  }

  return normalized;
}

function getProposalFileBaseName(report, proposal) {
  const inputBaseName = path.basename(report.inputFile || 'proposal', '.json');
  return `${inputBaseName}.proposal-${String(proposal.index).padStart(2, '0')}`;
}

function getProposalBatchBaseName(report) {
  const inputBaseName = path.basename(report.inputFile || 'proposal', '.json');
  return `${inputBaseName}.proposals`;
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

function createProposalReviewEntry(report, proposal) {
  const proposalId = getProposalFileBaseName(report, proposal);

  return {
    proposalId,
    source: {
      uploadEntryIndex: proposal.index
    },
    review: {
      requestedNamespace:
        proposal.submittedEntry && typeof proposal.submittedEntry.requestedNamespace === 'string'
          ? proposal.submittedEntry.requestedNamespace
          : '',
      suggestedKey: proposal.suggestedKey || proposal.proposedEntry.key,
      suggestedNamespace: proposal.suggestedNamespace || '',
      confidence: proposal.confidence || 'unknown',
      reason: proposal.reason || '',
    },
    originalEntry: normalizeSubmittedEntry(proposal),
    proposedEntry: {
      ...proposal.proposedEntry
    }
  };
}

function createProposalReviewObject(report, reportPath) {
  return {
    version: 2,
    proposalBatchId: getProposalBatchBaseName(report),
    status: 'pending-review',
    createdAt: new Date().toISOString(),
    source: {
      uploadFile: report.inputFile,
      reportFile: path.relative(ROOT_DIR, path.resolve(reportPath)),
      proposalCount: Array.isArray(report.proposals) ? report.proposals.length : 0
    },
    review: {
      required: true,
      instructions:
        'Edit the proposedEntry block for each proposal in this file when the key, applications, or locale text needs adjustment before merge.'
    },
    proposals: Array.isArray(report.proposals)
      ? report.proposals.map((proposal) => createProposalReviewEntry(report, proposal))
      : []
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

  if (report.proposals.length > 0) {
    const reviewObject = createProposalReviewObject(report, inputPath);
    const targetPath = getUniqueProposalObjectPath(outputDir, reviewObject.proposalBatchId);
    writeJsonFile(targetPath, reviewObject);
    queuedPaths.push(targetPath);
  }

  console.log('\nQueued Proposal Review Files');
  console.log(`  Input report:   ${path.relative(ROOT_DIR, inputPath)}`);
  console.log(`  Output dir:     ${path.relative(ROOT_DIR, outputDir)}`);
  console.log(`  Proposal files: ${queuedPaths.length}`);
  console.log(`  Proposals:      ${report.proposals.length}`);

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

function createAppliedProposalReport(appliedEntries, proposalFileCount) {
  return {
    version: 1,
    command: 'apply-pending-proposals',
    createdAt: new Date().toISOString(),
    summary: {
      proposalFiles: proposalFileCount,
      appliedEntries: appliedEntries.length
    },
    applied: appliedEntries
  };
}

function createAppliedProposalReportPath(reportsDir) {
  const stamp = new Date().toISOString().replace(/[-:TZ.]/g, '').slice(0, 14);
  return path.join(reportsDir, `pending-proposals-${stamp}.applied.report.json`);
}

function getProposalItemsFromFile(proposalObject, filePath) {
  const fileLabel = path.relative(ROOT_DIR, filePath);
  const sourceUploadFile =
    proposalObject &&
    proposalObject.source &&
    typeof proposalObject.source.uploadFile === 'string'
      ? proposalObject.source.uploadFile
      : '';

  if (Array.isArray(proposalObject?.proposals)) {
    return proposalObject.proposals.map((proposal, index) => ({
      proposalId:
        typeof proposal?.proposalId === 'string' && proposal.proposalId.trim() !== ''
          ? proposal.proposalId.trim()
          : `${path.basename(filePath, '.json')}-${index + 1}`,
      sourceUploadFile,
      proposedEntry: proposal?.proposedEntry,
      itemLabel: `${fileLabel}#${index + 1}`
    }));
  }

  if (proposalObject?.proposedEntry && typeof proposalObject.proposedEntry === 'object') {
    return [
      {
        proposalId:
          typeof proposalObject.proposalId === 'string' && proposalObject.proposalId.trim() !== ''
            ? proposalObject.proposalId.trim()
            : path.basename(filePath, '.json'),
        sourceUploadFile,
        proposedEntry: proposalObject.proposedEntry,
        itemLabel: fileLabel
      }
    ];
  }

  throw new Error(
    `Proposal object "${fileLabel}" must contain a proposals array or a proposedEntry object.`
  );
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
    console.log('No pending proposal files found.');
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
    const proposalObject = readJsonFile(filePath);
    const fileItems = getProposalItemsFromFile(proposalObject, filePath);

    for (const item of fileItems) {
      const normalizedEntry = normalizeProposedEntry(
        item.proposedEntry,
        namespaceConfig,
        applicationConfig,
        item.itemLabel
      );

      if (usedKeys.has(normalizedEntry.key)) {
        throw new Error(
          `Proposal object "${item.itemLabel}" uses key "${normalizedEntry.key}" which already exists in i18n/source/translations.json.`
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
        fileLabel: path.relative(ROOT_DIR, filePath),
        proposalId: item.proposalId,
        sourceUploadFile: item.sourceUploadFile,
        entry: normalizedEntry
      });
    }
  }

  console.log(`  Valid proposals: ${normalizedEntries.length}`);

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
  writeJsonFile(SOURCE_PATH, sanitizeSourceEntries(entries));

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

  for (const filePath of proposalFiles) {
    archiveFileWithUniqueName(filePath, processedDir);
  }

  const reportPath = createAppliedProposalReportPath(reportsDir);
  writeJsonFile(reportPath, createAppliedProposalReport(appliedEntries, proposalFiles.length));

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
