function printHelp(namespaceConfig, applicationConfig) {
  const activeNamespaces = namespaceConfig.namespaces
    .filter((namespaceDefinition) => namespaceDefinition.status === 'active')
    .map((namespaceDefinition) => namespaceDefinition.name);
  const namespaceChoices = namespaceConfig.namespaces
    .filter((namespaceDefinition) => namespaceDefinition.status === 'active')
    .map(
      (namespaceDefinition) =>
        `  ${namespaceDefinition.name}\n    ${namespaceDefinition.description || 'No description provided.'}`
    )
    .join('\n\n');

  const restrictedNamespaces = namespaceConfig.namespaces
    .filter((namespaceDefinition) => namespaceDefinition.status !== 'active')
    .map((namespaceDefinition) => `${namespaceDefinition.name} (${namespaceDefinition.status})`);

  const activeApplications = applicationConfig.applications
    .filter((applicationDefinition) => applicationDefinition.status === 'active')
    .map((applicationDefinition) => applicationDefinition.name);

  console.log(`
Translation Commands
  npm run translations:build
    Validate the source and rewrite all generated files.

  npm run translations:check
    Verify that generated files are already in sync.

  npm run translations:validate
    Fail if warnings or errors exist.

  npm run translations:report
    Print a health summary with namespace counts, duplicates, and missing locales.

  npm run translations:list-namespaces
    List all configured namespaces with their status.

  npm run update
    Build locally, commit, push, optionally wait for GitHub Actions, then pull.

Source Files
  i18n/source/translations.json
    Main translation source file. This is what you edit most of the time.

  i18n/config/namespaces.json
    Central namespace list. Add a namespace here before using a new namespace prefix.

  i18n/config/applications.json
    Central application list. Add or rename application identifiers here before using them in entries.

Key Format
  Use dot notation:
    common.save
    info.helpText
    error.apiErrors

Namespace Guide
  Active:
    ${activeNamespaces.join(', ')}
  Restricted:
    ${restrictedNamespaces.length > 0 ? restrictedNamespaces.join(', ') : 'none'}

Choosing The Right Namespace
${namespaceChoices}

Applications
  Allowed values:
    ${activeApplications.join(', ')}
  Every translation entry must define an applications array.

Quick Rules
  - Do not edit files in i18n/artifacts/generated manually.
  - Keep keys unique.
  - Prefer common.* for shared UI labels.
  - Keep applications accurate per key.
  - Add description or notes when a translation is ambiguous.
`);
}

function printNamespaceList(namespaceConfig) {
  console.log('\nNamespaces');

  for (const namespaceDefinition of namespaceConfig.namespaces) {
    console.log(`  - ${namespaceDefinition.name} [${namespaceDefinition.status}]`);
    console.log(`    ${namespaceDefinition.label}: ${namespaceDefinition.description}`);
  }
}

module.exports = {
  printHelp,
  printNamespaceList
};
