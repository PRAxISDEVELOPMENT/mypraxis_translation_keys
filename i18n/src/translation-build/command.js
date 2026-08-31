const path = require('path');
const { readApplicationConfig, readNamespaceConfig } = require('../core/config-loader');
const { readSourceEntries } = require('../core/source-entries');
const {
  APPLICATION_CONFIG_PATH,
  NAMESPACE_CONFIG_PATH,
  SOURCE_PATH
} = require('../core/path-config');
const { parseArgs } = require('./cli-options');
const { checkArtifacts, generateArtifacts, writeArtifacts } = require('./artifact-files');
const { collectIssues } = require('./issue-analysis');
const { printHelp, printNamespaceList } = require('./help-output');
const { printIssues, printLocalSummary, printReport } = require('./report-output');

function createFileSummary() {
  return {
    sourceFile: path.relative(process.cwd(), SOURCE_PATH),
    namespaceFile: path.relative(process.cwd(), NAMESPACE_CONFIG_PATH),
    applicationFile: path.relative(process.cwd(), APPLICATION_CONFIG_PATH)
  };
}

function runBuildTranslationsCommand(argv = process.argv.slice(2)) {
  const options = parseArgs(argv);
  const namespaceConfig = readNamespaceConfig();
  const applicationConfig = readApplicationConfig();
  const fileSummary = createFileSummary();

  if (options.help) {
    printHelp(namespaceConfig, applicationConfig);
    return;
  }

  if (options.listNamespaces) {
    printNamespaceList(namespaceConfig);
    return;
  }

  const entries = readSourceEntries();
  const { errors, warnings } = collectIssues(entries, namespaceConfig, applicationConfig);

  if (options.report) {
    printReport(entries, namespaceConfig, applicationConfig, warnings, errors, fileSummary);
    return;
  }

  if (process.env.GITHUB_ACTIONS !== 'true') {
    printLocalSummary(entries, namespaceConfig, errors, warnings, fileSummary);
  }

  printIssues('error', errors);
  printIssues('warning', warnings);

  if (errors.length > 0) {
    process.exitCode = 1;
    return;
  }

  if (options.validate && warnings.length > 0) {
    console.error(`Validation failed with ${warnings.length} warning(s).`);
    process.exitCode = 1;
    return;
  }

  if (options.validate) {
    console.log('Translation source validation passed.');
    return;
  }

  const artifacts = generateArtifacts(
    entries,
    namespaceConfig,
    applicationConfig,
    warnings,
    errors,
    fileSummary
  );

  if (options.check) {
    const mismatches = checkArtifacts(artifacts);

    if (mismatches.length > 0) {
      console.error('Generated files are out of sync:');

      for (const mismatch of mismatches) {
        console.error(`- ${mismatch}`);
      }

      process.exitCode = 1;
      return;
    }

    console.log('Generated files are in sync.');
    return;
  }

  writeArtifacts(artifacts);
  console.log('\nGenerated files updated.');
}

module.exports = {
  runBuildTranslationsCommand
};
