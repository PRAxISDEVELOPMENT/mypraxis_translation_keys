const fs = require('fs');
const path = require('path');
const { ensureDirectory, readJsonFile, writeJsonFile } = require('../core/json-files');
const { ROOT_DIR } = require('../core/path-config');
const { prepareUpload } = require('./command');

function listUploadFiles(dirPath) {
  if (!fs.existsSync(dirPath)) {
    return [];
  }

  return fs
    .readdirSync(dirPath)
    .filter((fileName) => fileName.endsWith('.json'))
    .sort((left, right) => left.localeCompare(right))
    .map((fileName) => path.join(dirPath, fileName));
}

function buildSubsetPayload(payload, allowedIndexes) {
  return {
    ...payload,
    entries: payload.entries.filter((_, index) => allowedIndexes.has(index + 1))
  };
}

function writeSubsetPayload(filePath, outputDir, suffix, payload) {
  const parsed = path.parse(filePath);
  const targetFileName = suffix ? `${parsed.name}.${suffix}${parsed.ext}` : `${parsed.name}${parsed.ext}`;
  const targetPath = path.join(outputDir, targetFileName);
  writeJsonFile(targetPath, payload);
  return targetPath;
}

function routeUploadFile(filePath, options) {
  const parsed = path.parse(filePath);
  const payload = readJsonFile(filePath);
  const reportPath = path.join(options.reportsDir, `${parsed.name}.report.json`);

  prepareUpload({
    input: filePath,
    report: reportPath,
    applyDirect: false,
    build: false
  });

  const report = readJsonFile(reportPath);

  if (report.summary.errors > 0) {
    throw new Error(`Upload "${parsed.base}" contains blocking errors and cannot be routed automatically.`);
  }

  const directIndexes = new Set(report.directUpdates.map((item) => item.index));
  const proposalIndexes = new Set(report.proposals.map((item) => item.index));
  const hasDirectUpdates = directIndexes.size > 0;
  const hasProposals = proposalIndexes.size > 0;

  if (!hasDirectUpdates && !hasProposals) {
    return {
      filePath,
      reportPath,
      directPath: null,
      proposalPath: null,
      directEntries: 0,
      proposalEntries: 0,
      skippedEntries: report.summary.skipped,
      mixed: false
    };
  }

  const mixed = hasDirectUpdates && hasProposals;
  const directPayload = hasDirectUpdates ? buildSubsetPayload(payload, directIndexes) : null;
  const proposalPayload = hasProposals ? buildSubsetPayload(payload, proposalIndexes) : null;

  const directPath = directPayload
    ? writeSubsetPayload(filePath, options.directDir, mixed ? 'direct' : '', directPayload)
    : null;
  const proposalPath = proposalPayload
    ? writeSubsetPayload(filePath, options.proposalDir, mixed ? 'proposal' : '', proposalPayload)
    : null;

  return {
    filePath,
    reportPath,
    directPath,
    proposalPath,
    directEntries: directIndexes.size,
    proposalEntries: proposalIndexes.size,
    skippedEntries: report.summary.skipped,
    mixed
  };
}

function runRouteUploadBatchesCommand(argv = process.argv.slice(2)) {
  const {
    parseRouteUploadBatchesArgs,
    printRouteUploadBatchesHelp
  } = require('./router-cli-options');
  const options = parseRouteUploadBatchesArgs(argv);

  if (options.help) {
    printRouteUploadBatchesHelp();
    return;
  }

  ensureDirectory(options.directDir);
  ensureDirectory(options.proposalDir);
  ensureDirectory(options.reportsDir);

  const uploadFiles = listUploadFiles(options.inputDir);

  console.log('\nUpload Routing');
  console.log(`  Input dir:    ${path.relative(ROOT_DIR, options.inputDir)}`);
  console.log(`  Direct dir:   ${path.relative(ROOT_DIR, options.directDir)}`);
  console.log(`  Proposal dir: ${path.relative(ROOT_DIR, options.proposalDir)}`);
  console.log(`  Reports dir:  ${path.relative(ROOT_DIR, options.reportsDir)}`);
  console.log(`  Files:        ${uploadFiles.length}`);

  if (uploadFiles.length === 0) {
    console.log('No upload files found.');
    return;
  }

  let directFiles = 0;
  let proposalFiles = 0;
  let directEntries = 0;
  let proposalEntries = 0;
  let mixedFiles = 0;

  for (const filePath of uploadFiles) {
    const result = routeUploadFile(filePath, options);

    if (result.directPath) {
      directFiles += 1;
      directEntries += result.directEntries;
    }

    if (result.proposalPath) {
      proposalFiles += 1;
      proposalEntries += result.proposalEntries;
    }

    if (result.mixed) {
      mixedFiles += 1;
    }
  }

  console.log('\nUpload Routing Complete');
  console.log(`  Direct files:      ${directFiles}`);
  console.log(`  Proposal files:    ${proposalFiles}`);
  console.log(`  Mixed files split: ${mixedFiles}`);
  console.log(`  Direct entries:    ${directEntries}`);
  console.log(`  Proposal entries:  ${proposalEntries}`);
}

module.exports = {
  runRouteUploadBatchesCommand
};
