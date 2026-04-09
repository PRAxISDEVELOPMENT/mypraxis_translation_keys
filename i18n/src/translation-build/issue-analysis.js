const { KEY_SEGMENT_PATTERN, LOCALES } = require('../core/constants');

function formatEntryLabel(index, key) {
  return `entry ${index + 1}${key ? ` (${key})` : ''}`;
}

function getResolvedValue(entry, locale) {
  if (typeof entry[locale] === 'string' && entry[locale].trim() !== '') {
    return entry[locale];
  }

  if (typeof entry.en === 'string' && entry.en.trim() !== '') {
    return entry.en;
  }

  return '';
}

function collectIssues(entries, namespaceConfig, applicationConfig) {
  const errors = [];
  const warnings = [];
  const keyUsage = new Map();
  const knownNamespaces = namespaceConfig.namespaces
    .map((namespaceDefinition) => namespaceDefinition.name)
    .join(', ');
  const knownApplications = applicationConfig.applications.map((applicationDefinition) => applicationDefinition.name);

  for (const [index, entry] of entries.entries()) {
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) {
      errors.push({
        category: 'invalid-entry',
        categoryLabel: 'Invalid entries',
        message: 'Each translation entry must be an object.',
        entries: [formatEntryLabel(index)]
      });
      continue;
    }

    if (typeof entry.key !== 'string' || entry.key.trim() === '') {
      errors.push({
        category: 'invalid-key',
        categoryLabel: 'Invalid keys',
        key: '(missing key)',
        message: 'Each translation entry must contain a non-empty string key.',
        entries: [formatEntryLabel(index)]
      });
      continue;
    }

    if (entry.key !== entry.key.trim()) {
      warnings.push({
        category: 'key-whitespace',
        categoryLabel: 'Key formatting',
        key: entry.key,
        message: `Key "${entry.key}" contains leading or trailing whitespace.`,
        entries: [formatEntryLabel(index, entry.key)]
      });
    }

    const normalizedKey = entry.key.trim();
    const segments = normalizedKey.split('.');
    const namespace = segments[0];

    if (normalizedKey.includes('..') || normalizedKey.startsWith('.') || normalizedKey.endsWith('.')) {
      errors.push({
        category: 'invalid-key',
        categoryLabel: 'Invalid keys',
        key: normalizedKey,
        message: `Key "${normalizedKey}" has invalid dot notation.`,
        entries: [formatEntryLabel(index, normalizedKey)]
      });
    }

    if (segments.length < 2) {
      errors.push({
        category: 'invalid-key',
        categoryLabel: 'Invalid keys',
        key: normalizedKey,
        message: `Key "${normalizedKey}" must contain a namespace and a leaf segment.`,
        entries: [formatEntryLabel(index, normalizedKey)]
      });
    }

    if (segments.some((segment) => segment && !KEY_SEGMENT_PATTERN.test(segment))) {
      warnings.push({
        category: 'invalid-key',
        categoryLabel: 'Invalid keys',
        key: normalizedKey,
        message: `Key "${normalizedKey}" contains non-alphanumeric segments.`,
        entries: [formatEntryLabel(index, normalizedKey)]
      });
    }

    if (!namespaceConfig.namespaceMap.has(namespace)) {
      errors.push({
        category: 'unknown-namespace',
        categoryLabel: 'Unknown namespaces',
        key: normalizedKey,
        namespace,
        message: `Key "${normalizedKey}" uses unknown namespace "${namespace}". Allowed namespaces: ${knownNamespaces}.`,
        entries: [formatEntryLabel(index, normalizedKey)]
      });
    } else {
      const namespaceDefinition = namespaceConfig.namespaceMap.get(namespace);

      if (namespaceDefinition.status !== 'active') {
        warnings.push({
          category: 'restricted-namespace',
          categoryLabel: 'Restricted namespaces',
          key: normalizedKey,
          namespace,
          message: `Key "${normalizedKey}" uses namespace "${namespace}" with status "${namespaceDefinition.status}". Use this only for temporary or intentional cases.`,
          entries: [formatEntryLabel(index, normalizedKey)]
        });
      }
    }

    if (!keyUsage.has(normalizedKey)) {
      keyUsage.set(normalizedKey, []);
    }

    keyUsage.get(normalizedKey).push(index);

    if (!Array.isArray(entry.applications) || entry.applications.length === 0) {
      errors.push({
        category: 'missing-applications',
        categoryLabel: 'Missing applications',
        key: normalizedKey,
        message: `Key "${normalizedKey}" must define a non-empty applications array.`,
        entries: [formatEntryLabel(index, normalizedKey)]
      });
    } else {
      const invalidApplications = entry.applications.filter(
        (application) =>
          typeof application !== 'string' ||
          application.trim() === '' ||
          !applicationConfig.applicationMap.has(application.trim())
      );

      if (invalidApplications.length > 0) {
        errors.push({
          category: 'invalid-applications',
          categoryLabel: 'Invalid applications',
          key: normalizedKey,
          message: `Key "${normalizedKey}" uses invalid applications: ${invalidApplications.join(', ')}. Allowed values: ${knownApplications.join(', ')}.`,
          entries: [formatEntryLabel(index, normalizedKey)]
        });
      }

      const normalizedApplications = entry.applications
        .filter((application) => typeof application === 'string' && application.trim() !== '')
        .map((application) => application.trim());

      if (new Set(normalizedApplications).size !== normalizedApplications.length) {
        warnings.push({
          category: 'duplicate-applications',
          categoryLabel: 'Duplicate applications',
          key: normalizedKey,
          message: `Key "${normalizedKey}" contains duplicate applications.`,
          entries: [formatEntryLabel(index, normalizedKey)]
        });
      }
    }

    for (const locale of LOCALES) {
      const value = entry[locale];

      if (typeof value === 'string' && value.trim() !== '') {
        continue;
      }

      warnings.push({
        category: 'missing-locale',
        categoryLabel: 'Missing locale values',
        key: normalizedKey,
        locale,
        message: `Missing ${locale} translation. The build will fall back to English when possible.`,
        entries: [formatEntryLabel(index, normalizedKey)]
      });
    }
  }

  for (const [key, indexes] of keyUsage.entries()) {
    if (indexes.length < 2) {
      continue;
    }

    const serializedValues = new Set(indexes.map((index) => JSON.stringify(entries[index])));

    errors.push({
      category: serializedValues.size === 1 ? 'duplicate-key-same' : 'duplicate-key-different',
      categoryLabel:
        serializedValues.size === 1
          ? 'Duplicate keys with the same values'
          : 'Duplicate keys with different values',
      key,
      message:
        serializedValues.size === 1
          ? `Duplicate key "${key}" is defined multiple times with the same values.`
          : `Duplicate key "${key}" is defined multiple times with different values.`,
      entries: indexes.map((index) => formatEntryLabel(index, key))
    });
  }

  return { errors, warnings };
}

function buildRegistry(entries, namespaceConfig) {
  const registryByKey = new Map();

  for (const [index, entry] of entries.entries()) {
    if (!entry || typeof entry !== 'object' || typeof entry.key !== 'string' || entry.key.trim() === '') {
      continue;
    }

    const normalizedKey = entry.key.trim();
    const segments = normalizedKey.split('.');
    const namespace = segments[0];
    const leaf = segments[segments.length - 1];

    if (!registryByKey.has(normalizedKey)) {
      registryByKey.set(normalizedKey, {
        key: normalizedKey,
        namespace,
        leaf,
        segments,
        applications: [],
        namespaceStatus: namespaceConfig.namespaceMap.get(namespace)?.status ?? 'unknown',
        sourceEntries: [],
        duplicateCount: 0,
        duplicateValuesDiffer: false,
        missingLocales: [],
        resolved: {}
      });
    }

    const record = registryByKey.get(normalizedKey);

    record.sourceEntries.push(index + 1);
    record.duplicateCount += 1;
    record.resolved = Object.fromEntries(
      LOCALES.map((locale) => [locale, getResolvedValue(entry, locale)])
    );
    record.applications = Array.from(
      new Set([
        ...record.applications,
        ...(
          Array.isArray(entry.applications)
            ? entry.applications
                .filter((application) => typeof application === 'string' && application.trim() !== '')
                .map((application) => application.trim())
            : []
        )
      ])
    ).sort();

    for (const locale of LOCALES) {
      if (typeof entry[locale] !== 'string' || entry[locale].trim() === '') {
        if (!record.missingLocales.includes(locale)) {
          record.missingLocales.push(locale);
        }
      }
    }
  }

  for (const record of registryByKey.values()) {
    record.duplicateValuesDiffer =
      record.duplicateCount > 1 &&
      new Set(
        record.sourceEntries.map((entryNumber) =>
          JSON.stringify({
            nl: entries[entryNumber - 1]?.nl,
            fr: entries[entryNumber - 1]?.fr,
            en: entries[entryNumber - 1]?.en
          })
        )
      ).size > 1;

    record.missingLocales.sort();
  }

  return Array.from(registryByKey.values()).sort((left, right) => left.key.localeCompare(right.key));
}

function buildSummary(entries, registry, namespaceConfig, applicationConfig, warnings, errors, fileSummary) {
  const namespaceCounts = Object.fromEntries(
    namespaceConfig.namespaces.map((namespaceDefinition) => [
      namespaceDefinition.name,
      registry.filter((record) => record.namespace === namespaceDefinition.name).length
    ])
  );

  const warningCounts = warnings.reduce((result, warning) => {
    const key = warning.categoryLabel || warning.category || 'General';
    result[key] = (result[key] || 0) + 1;
    return result;
  }, {});

  const errorCounts = errors.reduce((result, error) => {
    const key = error.categoryLabel || error.category || 'General';
    result[key] = (result[key] || 0) + 1;
    return result;
  }, {});

  const applicationCounts = Object.fromEntries(
    applicationConfig.applications.map((applicationDefinition) => [
      applicationDefinition.name,
      registry.filter((record) => record.applications.includes(applicationDefinition.name)).length
    ])
  );

  return {
    sourceFile: fileSummary.sourceFile,
    namespaceFile: fileSummary.namespaceFile,
    applicationFile: fileSummary.applicationFile,
    locales: LOCALES,
    applications: applicationConfig.applications.map((applicationDefinition) => applicationDefinition.name),
    totals: {
      sourceEntries: entries.length,
      uniqueKeys: registry.length,
      namespaces: namespaceConfig.namespaces.length,
      warnings: warnings.length,
      errors: errors.length,
      duplicateKeys: registry.filter((record) => record.duplicateCount > 1).length,
      keysWithMissingLocales: registry.filter((record) => record.missingLocales.length > 0).length
    },
    namespaces: namespaceCounts,
    applicationCounts,
    warningCounts,
    errorCounts
  };
}

module.exports = {
  buildRegistry,
  buildSummary,
  collectIssues,
  getResolvedValue
};
