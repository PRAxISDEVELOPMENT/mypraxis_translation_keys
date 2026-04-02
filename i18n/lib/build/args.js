function parseArgs(argv) {
  return {
    check: argv.includes('--check'),
    validate: argv.includes('--validate'),
    help: argv.includes('--help') || argv.includes('-h'),
    report: argv.includes('--report'),
    listNamespaces: argv.includes('--list-namespaces')
  };
}

module.exports = {
  parseArgs
};
