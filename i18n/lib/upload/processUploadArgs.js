function parseProcessUploadArgs(argv) {
  const result = {
    _: [],
    build: true,
    applyDirect: false
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
      case 'apply-direct':
        result.applyDirect = true;
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
  npm run prepare:upload -- --input <file> [--report <file>] [--apply-direct]
    Classify editor uploads into direct existing-key updates and new-entry proposals.

  npm run apply:proposals -- --input <report-file>
    Apply proposal entries from a previously generated report into translations.json.

Options
  --input <file>
    JSON payload exported by the editor flow.

  --report <file>
    Path where the processing report should be written.
    Default for "prepare": <input>.report.json

  --apply-direct
    When preparing, immediately merge safe updates for existing keys into translations.json.

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
