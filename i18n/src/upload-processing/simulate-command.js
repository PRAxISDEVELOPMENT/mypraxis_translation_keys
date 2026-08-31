const fs = require('fs');
const os = require('os');
const path = require('path');
const { LOCALES } = require('../core/constants');
const { readJsonFile, writeJsonFile } = require('../core/json-files');
const { runProcessUploadInboxCommand } = require('./inbox-command');

function toOptionalTrimmedString(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function parseSimulateUploadArgs(argv) {
  const result = {
    _: [],
    build: true,
    dryRun: true,
    source: 'simulate-upload'
  };

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];

    if (!token.startsWith('--')) {
      result._.push(token);
      continue;
    }

    const flag = token.slice(2);
    const next = argv[index + 1];
    const requireValue = () => {
      if (!next || next.startsWith('--')) {
        throw new Error(`Option "--${flag}" requires a value.`);
      }

      return next;
    };

    switch (flag) {
      case 'key':
        result.key = requireValue();
        index += 1;
        break;
      case 'nl':
      case 'fr':
      case 'en':
        result[flag] = requireValue();
        index += 1;
        break;
      case 'description':
        result.description = requireValue();
        index += 1;
        break;
      case 'notes':
        result.notes = requireValue();
        index += 1;
        break;
      case 'requested-namespace':
        result.requestedNamespace = requireValue();
        index += 1;
        break;
      case 'source':
        result.source = requireValue();
        index += 1;
        break;
      case 'apply':
        result.dryRun = false;
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

  result.command = result._[0] || '';

  if (result._.length > 1) {
    throw new Error(`Unexpected positional argument "${result._[1]}".`);
  }

  return result;
}

function printSimulateUploadHelp() {
  console.log(`
Upload Simulation Commands
  npm run uploads:simulate -- edit --key common.save --fr "Enregistrer depuis l'app"
    Simulate an existing-key update through the inbox flow.

  npm run uploads:simulate -- new --nl "Nieuwe knop" --fr "Nouveau bouton" --en "New button"
    Simulate a new translation proposal through the inbox flow.

Options
  --key <translation-key>
    Required for "edit". Must exist in i18n/source/translations.json.

  --nl <text>
  --fr <text>
  --en <text>
    Locale values to simulate. At least one locale is required.

  --description <text>
  --notes <text>
  --requested-namespace <name>
    Optional proposal metadata for "new".

  --apply
    Apply the change locally instead of running a dry run.

  --no-build
    Skip the final translation build when used together with --apply.

  --source <name>
    Optional source label stored in the simulated payload.
`);
}

function getLocaleValues(options, { includeEmpty = false } = {}) {
  const values = {};

  for (const locale of LOCALES) {
    if (typeof options[locale] !== 'string') {
      continue;
    }

    const value = toOptionalTrimmedString(options[locale]);

    if (includeEmpty || value) {
      values[locale] = value;
    }
  }

  return values;
}

function buildSimulatedEntry(options) {
  if (options.command === 'edit') {
    const localeValues = getLocaleValues(options, { includeEmpty: true });

    if (Object.keys(localeValues).length === 0) {
      throw new Error('Provide at least one locale value with --nl, --fr, or --en.');
    }

    const key = toOptionalTrimmedString(options.key);

    if (!key) {
      throw new Error('The "edit" command requires --key <translation-key>.');
    }

    if (options.description || options.notes || options.requestedNamespace) {
      throw new Error('The "edit" command only accepts --key and locale fields.');
    }

    return {
      key,
      ...localeValues
    };
  }

  if (options.command === 'new') {
    const localeValues = getLocaleValues(options);

    if (Object.keys(localeValues).length === 0) {
      throw new Error('Provide at least one non-empty locale value with --nl, --fr, or --en.');
    }

    if (options.key) {
      throw new Error('The "new" command must not include --key.');
    }

    const entry = {
      ...localeValues
    };

    const description = toOptionalTrimmedString(options.description);
    const notes = toOptionalTrimmedString(options.notes);
    const requestedNamespace = toOptionalTrimmedString(options.requestedNamespace);

    if (description) {
      entry.description = description;
    }

    if (notes) {
      entry.notes = notes;
    }

    if (requestedNamespace) {
      entry.requestedNamespace = requestedNamespace;
    }

    return entry;
  }

  throw new Error(`Unknown command "${options.command}". Use "edit" or "new".`);
}

function createSimulationPaths(command) {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'mypraxis-upload-sim-'));
  const incomingDir = path.join(tempRoot, 'incoming');
  const processedDir = path.join(tempRoot, 'processed');
  const reportsDir = path.join(tempRoot, 'reports');
  const proposalsDir = path.join(tempRoot, 'proposals', 'pending');
  const payloadPath = path.join(incomingDir, `${Date.now()}-${command}.json`);

  return {
    tempRoot,
    incomingDir,
    processedDir,
    reportsDir,
    proposalsDir,
    payloadPath
  };
}

function getModeForCommand(command) {
  if (command === 'edit') {
    return 'direct';
  }

  if (command === 'new') {
    return 'proposal';
  }

  throw new Error(`Unknown command "${command}". Use "edit" or "new".`);
}

function printSimulationSummary(options, paths, reportPath) {
  console.log('\nUpload Simulation');
  console.log(`  Command:      ${options.command}`);
  console.log(`  Mode:         ${getModeForCommand(options.command)}`);
  console.log(`  Action:       ${options.dryRun ? 'dry run' : 'apply locally'}`);
  console.log(`  Temp root:    ${paths.tempRoot}`);
  console.log(`  Payload file: ${paths.payloadPath}`);
  console.log(`  Report file:  ${reportPath}`);

  if (!fs.existsSync(reportPath)) {
    return;
  }

  const report = readJsonFile(reportPath);

  if (report.directUpdates.length > 0) {
    console.log(`  Direct key:   ${report.directUpdates[0].key}`);
  }

  if (report.proposals.length > 0) {
    console.log(`  Suggested key:${report.proposals[0].suggestedKey ? ` ${report.proposals[0].suggestedKey}` : ''}`);
  }

  if (!options.dryRun && options.command === 'new' && fs.existsSync(paths.proposalsDir)) {
    const proposalFiles = fs
      .readdirSync(paths.proposalsDir)
      .filter((fileName) => fileName.endsWith('.json'))
      .sort((left, right) => left.localeCompare(right));

    if (proposalFiles.length > 0) {
      console.log(`  Review file:  ${path.join(paths.proposalsDir, proposalFiles[0])}`);
    }
  }
}

function runSimulateUploadCommand(argv = process.argv.slice(2)) {
  const options = parseSimulateUploadArgs(argv);

  if (options.help || !options.command) {
    printSimulateUploadHelp();
    return;
  }

  const entry = buildSimulatedEntry(options);
  const paths = createSimulationPaths(options.command);
  const mode = getModeForCommand(options.command);
  const reportPath = path.join(
    paths.reportsDir,
    `${path.basename(paths.payloadPath, '.json')}.report.json`
  );

  writeJsonFile(paths.payloadPath, {
    version: 1,
    source: toOptionalTrimmedString(options.source) || 'simulate-upload',
    entries: [entry]
  });

  const inboxArgs = [
    '--mode',
    mode,
    '--uploads-dir',
    paths.incomingDir,
    '--reports-dir',
    paths.reportsDir,
    '--proposals-dir',
    paths.proposalsDir,
    '--processed-dir',
    paths.processedDir
  ];

  if (options.dryRun) {
    inboxArgs.push('--dry-run');
  }

  if (!options.build) {
    inboxArgs.push('--no-build');
  }

  runProcessUploadInboxCommand(inboxArgs);
  printSimulationSummary(options, paths, reportPath);
}

module.exports = {
  runSimulateUploadCommand
};
