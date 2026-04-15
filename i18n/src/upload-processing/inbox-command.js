const path = require('path');
const { ensureDirectory, readJsonFile } = require('../core/json-files');
const {
  BUILD_SCRIPT_PATH,
  PROCESS_UPLOAD_SCRIPT_PATH,
  ROOT_DIR
} = require('../core/path-config');
const { runNodeScript } = require('../core/script-runner');
const { archiveFileWithUniqueName, listJsonFiles } = require('../core/upload-files');

function processUploadFile(filePath, options) {
  ensureDirectory(options.reportsDir);
  ensureDirectory(options.proposalsDir);
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
      archivedPath: archiveFileWithUniqueName(filePath, options.processedDir),
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
      proposals: report.summary.proposals,
      queuedProposalObjects: report.summary.proposals
    };
  }

  if (hasProposals) {
    runNodeScript(PROCESS_UPLOAD_SCRIPT_PATH, [
      'queue-proposals',
      '--input',
      reportPath,
      '--output-dir',
      options.proposalsDir
    ]);
  }

  return {
    filePath,
    reportPath,
    archivedPath: archiveFileWithUniqueName(filePath, options.processedDir),
    directUpdates: 0,
    proposals: report.summary.proposals,
    queuedProposalObjects: report.summary.proposals
  };
}

function runProcessUploadInboxCommand(argv = process.argv.slice(2)) {
  const {
    parseProcessUploadInboxArgs,
    printProcessUploadInboxHelp
  } = require('./inbox-cli-options');
  const options = parseProcessUploadInboxArgs(argv);

  if (options.help) {
    printProcessUploadInboxHelp();
    return;
  }

  ensureDirectory(options.uploadsDir);
  ensureDirectory(options.reportsDir);
  ensureDirectory(options.processedDir);
  ensureDirectory(options.proposalsDir);

  const uploadFiles = listJsonFiles(options.uploadsDir);

  console.log('\nUpload Inbox Processing');
  console.log(`  Mode:        ${options.mode}`);
  console.log(`  Uploads dir: ${path.relative(ROOT_DIR, options.uploadsDir)}`);
  console.log(`  Reports dir: ${path.relative(ROOT_DIR, options.reportsDir)}`);
  console.log(`  Proposals:   ${path.relative(ROOT_DIR, options.proposalsDir)}`);
  console.log(`  Dry run:     ${options.dryRun ? 'yes' : 'no'}`);
  console.log(`  Files:       ${uploadFiles.length}`);

  if (uploadFiles.length === 0) {
    console.log('No upload files found.');
    return;
  }

  let totalDirectUpdates = 0;
  let totalProposals = 0;
  let totalQueuedProposalObjects = 0;

  for (const filePath of uploadFiles) {
    const result = processUploadFile(filePath, options);
    totalDirectUpdates += result.directUpdates;
    totalProposals += result.proposals;
    totalQueuedProposalObjects += result.queuedProposalObjects ?? 0;
  }

  if (options.build && !options.dryRun && options.mode === 'direct') {
    runNodeScript(BUILD_SCRIPT_PATH, []);
  }

  const resultLabel = options.dryRun ? 'Upload Inbox Dry Run Complete' : 'Upload Inbox Processed';
  const directLabel = options.dryRun ? 'Direct updates detected' : 'Direct updates applied';
  const proposalLabel = options.dryRun
    ? 'Proposals detected'
    : options.mode === 'proposal'
      ? 'Proposal objects queued'
      : 'Proposals processed';

  console.log(`\n${resultLabel}`);
  console.log(`  ${directLabel}: ${totalDirectUpdates}`);
  console.log(`  ${proposalLabel}:      ${options.mode === 'proposal' ? totalQueuedProposalObjects : totalProposals}`);
  console.log(`  Upload files archived:  ${options.dryRun ? 0 : uploadFiles.length}`);
}

module.exports = {
  runProcessUploadInboxCommand
};
