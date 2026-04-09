const { buildRegistry, buildSummary } = require('./issue-analysis');

function formatIssue(issue) {
  if (issue.entries && issue.entries.length > 0) {
    return `${issue.message} [${issue.entries.join(', ')}]`;
  }

  return issue.message;
}

function logIssue(level, issue) {
  const prefix = level === 'error' ? 'ERROR' : 'WARNING';

  if (process.env.GITHUB_ACTIONS === 'true') {
    const annotationLevel = level === 'error' ? 'error' : 'warning';
    console.log(`::${annotationLevel} title=Translation ${prefix.toLowerCase()}::${formatIssue(issue)}`);
    return;
  }

  const logger = level === 'error' ? console.error : console.warn;
  logger(`${prefix}: ${formatIssue(issue)}`);
}

function printCompactList(items, formatter) {
  const maxItems = 8;
  const visibleItems = items.slice(0, maxItems);

  for (const item of visibleItems) {
    console.log(`    - ${formatter(item)}`);
  }

  if (items.length > maxItems) {
    console.log(`    - +${items.length - maxItems} more`);
  }
}

function printLocalIssueSummary(level, issues) {
  if (issues.length === 0) {
    return;
  }

  const title = level === 'error' ? 'Errors' : 'Warnings';
  const groupedIssues = new Map();

  for (const issue of issues) {
    const groupKey = issue.category || 'general';

    if (!groupedIssues.has(groupKey)) {
      groupedIssues.set(groupKey, {
        label: issue.categoryLabel || 'General',
        issues: []
      });
    }

    groupedIssues.get(groupKey).issues.push(issue);
  }

  console.log(`\n${title}:`);

  for (const [, group] of groupedIssues.entries()) {
    console.log(`  ${group.label} (${group.issues.length})`);

    if (group.issues[0]?.category === 'missing-locale') {
      const localesByKey = new Map();

      for (const issue of group.issues) {
        if (!localesByKey.has(issue.key)) {
          localesByKey.set(issue.key, []);
        }

        localesByKey.get(issue.key).push(issue.locale);
      }

      const items = Array.from(localesByKey.entries()).map(([key, locales]) => ({
        key,
        locales: locales.sort()
      }));

      printCompactList(items, (item) => `${item.key}: ${item.locales.join(', ')}`);
      continue;
    }

    if (
      group.issues[0]?.category === 'duplicate-key-same' ||
      group.issues[0]?.category === 'duplicate-key-different' ||
      group.issues[0]?.category === 'restricted-namespace'
    ) {
      printCompactList(group.issues, (issue) => issue.key || issue.namespace);
      continue;
    }

    if (
      group.issues[0]?.category === 'invalid-key' ||
      group.issues[0]?.category === 'key-whitespace' ||
      group.issues[0]?.category === 'unknown-namespace'
    ) {
      printCompactList(group.issues, (issue) => issue.key || formatIssue(issue));
      continue;
    }

    if (group.issues[0]?.category === 'invalid-entry') {
      printCompactList(group.issues, (issue) => (issue.entries || []).join(', '));
      continue;
    }

    printCompactList(group.issues, (issue) => formatIssue(issue));
  }
}

function printIssues(level, issues) {
  if (process.env.GITHUB_ACTIONS === 'true') {
    for (const issue of issues) {
      logIssue(level, issue);
    }

    return;
  }

  printLocalIssueSummary(level, issues);
}

function printLocalSummary(entries, namespaceConfig, errors, warnings, fileSummary) {
  console.log('\nTranslation Build');
  console.log(`  Source:      ${fileSummary.sourceFile}`);
  console.log(`  Namespaces:  ${namespaceConfig.namespaces.length}`);
  console.log(`  Entries:     ${entries.length}`);
  console.log(`  Errors:      ${errors.length}`);
  console.log(`  Warnings:    ${warnings.length}`);
}

function printReport(entries, namespaceConfig, applicationConfig, warnings, errors, fileSummary) {
  const registry = buildRegistry(entries, namespaceConfig);
  const summary = buildSummary(
    entries,
    registry,
    namespaceConfig,
    applicationConfig,
    warnings,
    errors,
    fileSummary
  );

  console.log('\nTranslation Report');
  console.log(`  Source entries:       ${summary.totals.sourceEntries}`);
  console.log(`  Unique keys:          ${summary.totals.uniqueKeys}`);
  console.log(`  Namespaces:           ${summary.totals.namespaces}`);
  console.log(`  Duplicate keys:       ${summary.totals.duplicateKeys}`);
  console.log(`  Missing locale keys:  ${summary.totals.keysWithMissingLocales}`);
  console.log(`  Warnings:             ${summary.totals.warnings}`);
  console.log(`  Errors:               ${summary.totals.errors}`);

  console.log('\nNamespace Counts');

  for (const namespaceDefinition of namespaceConfig.namespaces) {
    console.log(`  - ${namespaceDefinition.name}: ${summary.namespaces[namespaceDefinition.name] || 0}`);
  }

  console.log('\nApplication Counts');

  for (const application of summary.applications) {
    console.log(`  - ${application}: ${summary.applicationCounts[application] || 0}`);
  }
}

module.exports = {
  printIssues,
  printLocalSummary,
  printReport
};
