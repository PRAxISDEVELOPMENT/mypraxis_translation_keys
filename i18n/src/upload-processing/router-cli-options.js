const os = require('os');
const path = require('path');
const { DEFAULT_UPLOADS_DIR } = require('../core/path-config');

const DEFAULT_ROUTING_ROOT = path.join(os.tmpdir(), 'mypraxis-translation-routing');

function parseRouteUploadBatchesArgs(argv) {
  const result = {
    inputDir: DEFAULT_UPLOADS_DIR,
    directDir: path.join(DEFAULT_ROUTING_ROOT, 'direct'),
    proposalDir: path.join(DEFAULT_ROUTING_ROOT, 'proposal'),
    reportsDir: path.join(DEFAULT_ROUTING_ROOT, 'reports')
  };

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];

    if (!token.startsWith('--')) {
      continue;
    }

    const flag = token.slice(2);
    const next = argv[index + 1];

    switch (flag) {
      case 'input-dir':
        result.inputDir = path.resolve(next);
        index += 1;
        break;
      case 'direct-dir':
        result.directDir = path.resolve(next);
        index += 1;
        break;
      case 'proposal-dir':
        result.proposalDir = path.resolve(next);
        index += 1;
        break;
      case 'reports-dir':
        result.reportsDir = path.resolve(next);
        index += 1;
        break;
      case 'help':
      case 'h':
        result.help = true;
        break;
      default:
        throw new Error(`Unknown option "--${flag}".`);
    }
  }

  return result;
}

function printRouteUploadBatchesHelp() {
  console.log(`
Upload Routing Commands
  npm run uploads:route
    Classify incoming upload payloads into direct-update batches and proposal batches.

Options
  --input-dir <path>
    Directory containing incoming upload payloads.

  --direct-dir <path>
    Directory where direct-only payloads are written.

  --proposal-dir <path>
    Directory where proposal-only payloads are written.

  --reports-dir <path>
    Directory where temporary prepare reports are written.
`);
}

module.exports = {
  parseRouteUploadBatchesArgs,
  printRouteUploadBatchesHelp
};
