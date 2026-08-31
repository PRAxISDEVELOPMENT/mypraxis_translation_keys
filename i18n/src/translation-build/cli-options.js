function parseArgs(argv) {
  const supportedOptions = new Set([
    '--check',
    '--validate',
    '--help',
    '-h',
    '--report',
    '--list-namespaces'
  ]);
  const unknownOptions = argv.filter((option) => !supportedOptions.has(option));

  if (unknownOptions.length > 0) {
    throw new Error(`Unknown option(s): ${unknownOptions.join(', ')}.`);
  }

  const result = {
    check: argv.includes('--check'),
    validate: argv.includes('--validate'),
    help: argv.includes('--help') || argv.includes('-h'),
    report: argv.includes('--report'),
    listNamespaces: argv.includes('--list-namespaces')
  };

  const selectedModes = [result.check, result.validate, result.report, result.listNamespaces]
    .filter(Boolean).length;

  if (selectedModes > 1) {
    throw new Error('Use only one of --check, --validate, --report, or --list-namespaces.');
  }

  return result;
}

module.exports = {
  parseArgs
};
