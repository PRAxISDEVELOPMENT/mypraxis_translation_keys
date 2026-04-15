function parseProcessUploadArgs(argv) {
  const result = {
    _: [],
    build: true,
    applyDirect: false,
    dryRun: false
  };

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];

    if (!token.startsWith('--')) {
      result._.push(token);
      continue;
    }

    const flag = token.slice(2);
    const next = argv[index + 1];

    switch (flag) {
      case 'input':
        result.input = next;
        index += 1;
        break;
      case 'report':
        result.report = next;
        index += 1;
        break;
      case 'input-dir':
        result.inputDir = next;
        index += 1;
        break;
      case 'output-dir':
        result.outputDir = next;
        index += 1;
        break;
      case 'processed-dir':
        result.processedDir = next;
        index += 1;
        break;
      case 'reports-dir':
        result.reportsDir = next;
        index += 1;
        break;
      case 'apply-direct':
        result.applyDirect = true;
        break;
      case 'dry-run':
        result.dryRun = true;
        break;
      case 'no-build':
        result.build = false;
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

function printProcessUploadHelp() {
  console.log(`
Upload Processing Commands
  npm run uploads:prepare -- --input <file> [--report <file>] [--apply-direct]
    Classify editor uploads into direct existing-key updates and new-entry proposals.

  npm run uploads:apply-proposals -- --input <report-file>
    Apply proposal entries from a previously generated report into i18n/source/translations.json.

  node i18n/bin/process-upload.js queue-proposals --input <report-file> --output-dir i18n/proposals/pending
    Materialize reviewable proposal object files from a prepare report.

  node i18n/bin/process-upload.js apply-pending-proposals --input-dir i18n/proposals/pending
    Validate and apply reviewed proposal object files into i18n/source/translations.json.

Options
  --input <file>
    JSON payload exported by the editor flow.

  --report <file>
    Path where the processing report should be written.
    Default for "prepare": <input>.report.json

  --input-dir <dir>
    Directory containing pending proposal object files for apply-pending-proposals.

  --output-dir <dir>
    Directory where queue-proposals writes proposal object files.

  --processed-dir <dir>
    Directory where apply-pending-proposals archives applied proposal object files.

  --reports-dir <dir>
    Directory where apply-pending-proposals writes an apply report.

  --apply-direct
    When preparing, immediately merge safe updates for existing keys into i18n/source/translations.json.

  --dry-run
    Validate the command inputs without changing files.

  --no-build
    Skip running the translation generator after applying changes.

Upload Payload Shape
  {
    "entries": [
      {
        "key": "common.save",
        "nl": "Opslaan"
      },
      {
        "en": "Temporary call list",
        "nl": "Tijdelijke bellijst"
      }
    ]
  }
`);
}

module.exports = {
  parseProcessUploadArgs,
  printProcessUploadHelp
};
