const path = require('path');
const {
  DEFAULT_PENDING_PROPOSALS_DIR,
  DEFAULT_PROCESSED_DIR,
  DEFAULT_REPORTS_DIR,
  DEFAULT_UPLOADS_DIR
} = require('../core/path-config');

function parseProcessUploadInboxArgs(argv) {
  const result = {
    mode: 'direct',
    uploadsDir: DEFAULT_UPLOADS_DIR,
    reportsDir: DEFAULT_REPORTS_DIR,
    processedDir: DEFAULT_PROCESSED_DIR,
    proposalsDir: DEFAULT_PENDING_PROPOSALS_DIR,
    build: true,
    dryRun: false
  };

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];

    if (!token.startsWith('--')) {
      continue;
    }

    const flag = token.slice(2);
    const next = argv[index + 1];

    switch (flag) {
      case 'mode':
        result.mode = next;
        index += 1;
        break;
      case 'uploads-dir':
        result.uploadsDir = path.resolve(next);
        index += 1;
        break;
      case 'reports-dir':
        result.reportsDir = path.resolve(next);
        index += 1;
        break;
      case 'processed-dir':
        result.processedDir = path.resolve(next);
        index += 1;
        break;
      case 'proposals-dir':
        result.proposalsDir = path.resolve(next);
        index += 1;
        break;
      case 'no-build':
        result.build = false;
        break;
      case 'dry-run':
        result.dryRun = true;
        break;
      case 'help':
      case 'h':
        result.help = true;
        break;
      default:
        throw new Error(`Unknown option "--${flag}".`);
    }
  }

  if (!['direct', 'proposal'].includes(result.mode)) {
    throw new Error('Mode must be "direct" or "proposal".');
  }

  return result;
}

function printProcessUploadInboxHelp() {
  console.log(`
Upload Inbox Commands
  npm run uploads:process-inbox -- --mode direct
    Process incoming uploads intended for direct updates on main.

  npm run uploads:process-inbox -- --mode proposal
    Process incoming uploads intended for proposal branches and PR review.

Options
  --uploads-dir <path>
    Directory containing incoming upload payloads.

  --reports-dir <path>
    Directory where processing reports are written.

  --processed-dir <path>
    Directory where processed upload payloads are archived.

  --proposals-dir <path>
    Directory where proposal-mode processing writes reviewable proposal object files.

  --dry-run
    Preview the inbox result without editing i18n/source/translations.json or archiving uploads.

  --no-build
    Skip the final translation build after applying changes.
`);
}

module.exports = {
  parseProcessUploadInboxArgs,
  printProcessUploadInboxHelp
};
