const fs = require('fs');
const path = require('path');
const { LOCALES } = require('../core/constants');
const { OUTPUT_DIR } = require('../core/path-config');
const { ensureDirectory } = require('../core/json-files');
const { buildRegistry, buildSummary, getResolvedValue } = require('./issue-analysis');

function sortObjectDeep(value) {
  if (Array.isArray(value)) {
    return value.map(sortObjectDeep);
  }

  if (!value || typeof value !== 'object') {
    return value;
  }

  const sorted = {};

  for (const key of Object.keys(value).sort((left, right) => left.localeCompare(right))) {
    sorted[key] = sortObjectDeep(value[key]);
  }

  return sorted;
}

function setNestedValue(target, dottedKey, value) {
  const parts = dottedKey.split('.');
  let current = target;

  for (let index = 0; index < parts.length; index += 1) {
    const part = parts[index];
    const isLeaf = index === parts.length - 1;
    const currentValue = current[part];

    if (isLeaf) {
      if (
        currentValue !== undefined &&
        typeof currentValue === 'object' &&
        currentValue !== null &&
        !Array.isArray(currentValue)
      ) {
        throw new Error(
          `Key conflict for "${dottedKey}". A nested object already exists at "${parts
            .slice(0, index + 1)
            .join('.')}".`
        );
      }

      current[part] = value;
      return;
    }

    if (currentValue === undefined) {
      current[part] = {};
      current = current[part];
      continue;
    }

    if (typeof currentValue !== 'object' || currentValue === null || Array.isArray(currentValue)) {
      throw new Error(
        `Key conflict for "${dottedKey}". A scalar value already exists at "${parts
          .slice(0, index + 1)
          .join('.')}".`
      );
    }

    current = currentValue;
  }
}

function buildLocaleTree(entries, locale) {
  const result = {};

  for (const entry of entries) {
    if (!entry || typeof entry !== 'object' || typeof entry.key !== 'string' || entry.key.trim() === '') {
      continue;
    }

    setNestedValue(result, entry.key.trim(), getResolvedValue(entry, locale));
  }

  return sortObjectDeep(result);
}

function generateArtifacts(entries, namespaceConfig, applicationConfig, warnings, errors, fileSummary) {
  const artifacts = new Map();
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

  for (const locale of LOCALES) {
    artifacts.set(`${locale}.json`, JSON.stringify(buildLocaleTree(entries, locale), null, 2) + '\n');
  }

  const namespaceSummaries = namespaceConfig.namespaces.map((namespaceDefinition) => ({
    ...namespaceDefinition,
    keyCount: registry.filter((record) => record.namespace === namespaceDefinition.name).length
  }));

  artifacts.set('keys.json', JSON.stringify(registry.map((record) => record.key), null, 2) + '\n');
  artifacts.set(
    'namespaces.json',
    JSON.stringify(
      {
        version: namespaceConfig.version,
        defaultNamespace: namespaceConfig.defaultNamespace,
        namespaces: namespaceSummaries
      },
      null,
      2
    ) + '\n'
  );
  artifacts.set(
    'applications.json',
    JSON.stringify(
      {
        version: applicationConfig.version,
        applications: applicationConfig.applications
      },
      null,
      2
    ) + '\n'
  );
  artifacts.set(
    'registry.json',
    JSON.stringify(
      {
        locales: LOCALES,
        summary: {
          totalEntries: entries.length,
          uniqueKeys: registry.length,
          namespaces: namespaceSummaries.length,
          applications: applicationConfig.applications.length,
          duplicateKeys: registry.filter((record) => record.duplicateCount > 1).length,
          keysWithMissingLocales: registry.filter((record) => record.missingLocales.length > 0).length
        },
        applications: applicationConfig.applications,
        keys: registry,
        namespaces: namespaceSummaries
      },
      null,
      2
    ) + '\n'
  );
  artifacts.set('summary.json', JSON.stringify(summary, null, 2) + '\n');

  return artifacts;
}

function writeArtifacts(artifacts) {
  ensureDirectory(OUTPUT_DIR);

  for (const [fileName, content] of artifacts.entries()) {
    fs.writeFileSync(path.join(OUTPUT_DIR, fileName), content, 'utf8');
  }
}

function checkArtifacts(artifacts) {
  const mismatches = [];

  for (const [fileName, content] of artifacts.entries()) {
    const outputPath = path.join(OUTPUT_DIR, fileName);
    const currentContent = fs.existsSync(outputPath) ? fs.readFileSync(outputPath, 'utf8') : null;

    if (currentContent !== content) {
      mismatches.push(path.relative(process.cwd(), outputPath));
    }
  }

  return mismatches;
}

module.exports = {
  checkArtifacts,
  generateArtifacts,
  writeArtifacts
};
