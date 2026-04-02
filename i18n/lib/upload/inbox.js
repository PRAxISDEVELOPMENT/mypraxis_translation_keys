const fs = require('fs');
const path = require('path');
const { ensureDirectory, readJsonFile } = require('../shared/json');
const {
  BUILD_SCRIPT_PATH,
  PROCESS_UPLOAD_SCRIPT_PATH,
  ROOT_DIR
} = require('../shared/paths');
const { runNodeScript } = require('../shared/scripts');

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

function archiveUpload(filePath, processedDir) {
  ensureDirectory(processedDir);
  const parsed = path.parse(filePath);
  let targetPath = path.join(processedDir, `${parsed.name}${parsed.ext}`);
  let counter = 2;

  while (fs.existsSync(targetPath)) {
    targetPath = path.join(processedDir, `${parsed.name}-${counter}${parsed.ext}`);
    counter += 1;
  }

  fs.renameSync(filePath, targetPath);
  return targetPath;
}

function processUploadFile(filePath, options) {
  ensureDirectory(options.reportsDir);
  const reportPath = path.join(options.reportsDir, `${path.basename(filePath, '.json')}.report.json`);

  runNodeScript(PROCESS_UPLOAD_SCRIPT_PATH, [
    'prepare',
    '--input',
    filePath,
    '--report',
    reportPath,
    '--no-build'
  ]);

  const report = readJsonFile(reportPath);
  const hasBlockingErrors = report.summary.errors > 0;
  const hasProposals = report.summary.proposals > 0;
  const hasDirectUpdates = report.summary.directUpdates > 0;

  if (options.mode === 'direct') {
    if (hasBlockingErrors || hasProposals) {
      throw new Error(
        `Upload "${path.basename(filePath)}" cannot be processed in direct mode because it contains proposals or errors.`
      );
    }

    if (options.dryRun) {
      return {
        filePath,
        reportPath,
        archivedPath: null,
        directUpdates: report.summary.directUpdates,
        proposals: 0
      };
    }

    if (hasDirectUpdates) {
      runNodeScript(PROCESS_UPLOAD_SCRIPT_PATH, [
        'prepare',
        '--input',
        filePath,
        '--report',
        reportPath,
        '--apply-direct',
        '--no-build'
      ]);
    }

    return {
      filePath,
      reportPath,
      archivedPath: archiveUpload(filePath, options.processedDir),
      directUpdates: report.summary.directUpdates,
      proposals: 0
    };
  }

  if (hasBlockingErrors) {
    throw new Error(
      `Upload "${path.basename(filePath)}" contains blocking errors and cannot be processed for proposals.`
    );
  }

  if (hasDirectUpdates) {
    throw new Error(
      `Upload "${path.basename(filePath)}" contains existing-key updates. Proposal mode only accepts new entries without keys.`
    );
  }

  if (options.dryRun) {
    return {
      filePath,
      reportPath,
      archivedPath: null,
      directUpdates: 0,
      proposals: report.summary.proposals
    };
  }

  if (hasProposals) {
    runNodeScript(PROCESS_UPLOAD_SCRIPT_PATH, ['apply-proposals', '--input', reportPath, '--no-build']);
  }

  return {
    filePath,
    reportPath,
    archivedPath: archiveUpload(filePath, options.processedDir),
    directUpdates: 0,
    proposals: report.summary.proposals
  };
}

function runProcessUploadInboxCommand(argv = process.argv.slice(2)) {
  const {
    parseProcessUploadInboxArgs,
    printProcessUploadInboxHelp
  } = require('./processUploadInboxArgs');
  const options = parseProcessUploadInboxArgs(argv);

  if (options.help) {
    printProcessUploadInboxHelp();
    return;
  }

  ensureDirectory(options.uploadsDir);
  ensureDirectory(options.reportsDir);
  ensureDirectory(options.processedDir);

  const uploadFiles = listUploadFiles(options.uploadsDir);

  console.log('\nUpload Inbox Processing');
  console.log(`  Mode:        ${options.mode}`);
  console.log(`  Uploads dir: ${path.relative(ROOT_DIR, options.uploadsDir)}`);
  console.log(`  Reports dir: ${path.relative(ROOT_DIR, options.reportsDir)}`);
  console.log(`  Dry run:     ${options.dryRun ? 'yes' : 'no'}`);
  console.log(`  Files:       ${uploadFiles.length}`);

  if (uploadFiles.length === 0) {
    console.log('No upload files found.');
    return;
  }

  let totalDirectUpdates = 0;
  let totalProposals = 0;

  for (const filePath of uploadFiles) {
    const result = processUploadFile(filePath, options);
    totalDirectUpdates += result.directUpdates;
    totalProposals += result.proposals;
  }

  if (options.build && !options.dryRun) {
    runNodeScript(BUILD_SCRIPT_PATH, []);
  }

  console.log('\nUpload Inbox Processed');
  console.log(`  Direct updates applied: ${totalDirectUpdates}`);
  console.log(`  Proposals applied:      ${totalProposals}`);
  console.log(`  Upload files archived:  ${options.dryRun ? 0 : uploadFiles.length}`);
}

module.exports = {
  runProcessUploadInboxCommand
};
