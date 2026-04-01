// Core translation validator and generator.
// Reads translations.json + namespaces.json, blocks invalid data,
// and writes the generated runtime/tooling files under i18n/generated.

const fs = require('fs');
const path = require('path');

const SOURCE_PATH = path.join(__dirname, 'translations.json');
const NAMESPACE_CONFIG_PATH = path.join(__dirname, 'namespaces.json');
const OUTPUT_DIR = path.join(__dirname, 'generated');
const LOCALES = ['nl', 'fr', 'en'];
const KEY_SEGMENT_PATTERN = /^[A-Za-z0-9]+$/;

function parseArgs(argv) {
    return {
        check: argv.includes('--check'),
        validate: argv.includes('--validate'),
        help: argv.includes('--help') || argv.includes('-h'),
        report: argv.includes('--report'),
        listNamespaces: argv.includes('--list-namespaces')
    };
}

function readJsonFile(filePath) {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function readSourceEntries() {
    const parsed = readJsonFile(SOURCE_PATH);

    if (!Array.isArray(parsed)) {
        throw new Error('translations.json must contain an array of translation entries.');
    }

    return parsed;
}

function readNamespaceConfig() {
    const parsed = readJsonFile(NAMESPACE_CONFIG_PATH);

    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
        throw new Error('namespaces.json must contain an object.');
    }

    if (!Array.isArray(parsed.namespaces) || parsed.namespaces.length === 0) {
        throw new Error('namespaces.json must contain a non-empty "namespaces" array.');
    }

    const namespaceMap = new Map();

    for (const namespaceDefinition of parsed.namespaces) {
        if (!namespaceDefinition || typeof namespaceDefinition !== 'object' || Array.isArray(namespaceDefinition)) {
            throw new Error('Each namespace definition must be an object.');
        }

        if (typeof namespaceDefinition.name !== 'string' || namespaceDefinition.name.trim() === '') {
            throw new Error('Each namespace definition must contain a non-empty "name" string.');
        }

        const normalizedName = namespaceDefinition.name.trim();

        if (namespaceMap.has(normalizedName)) {
            throw new Error(`Duplicate namespace definition found for "${normalizedName}".`);
        }

        namespaceMap.set(normalizedName, {
            name: normalizedName,
            label: typeof namespaceDefinition.label === 'string' && namespaceDefinition.label.trim() !== ''
                ? namespaceDefinition.label.trim()
                : normalizedName,
            description:
                typeof namespaceDefinition.description === 'string' ? namespaceDefinition.description : '',
            status:
                typeof namespaceDefinition.status === 'string' && namespaceDefinition.status.trim() !== ''
                    ? namespaceDefinition.status.trim()
                    : 'active'
        });
    }

    const defaultNamespace =
        typeof parsed.defaultNamespace === 'string' && parsed.defaultNamespace.trim() !== ''
            ? parsed.defaultNamespace.trim()
            : parsed.namespaces[0].name;

    if (!namespaceMap.has(defaultNamespace)) {
        throw new Error(`defaultNamespace "${defaultNamespace}" does not exist in namespaces.json.`);
    }

    return {
        version: parsed.version ?? 1,
        defaultNamespace,
        namespaceMap,
        namespaces: Array.from(namespaceMap.values()).sort((left, right) => left.name.localeCompare(right.name))
    };
}

function printHelp(namespaceConfig) {
    const activeNamespaces = namespaceConfig.namespaces
        .filter((namespaceDefinition) => namespaceDefinition.status === 'active')
        .map((namespaceDefinition) => namespaceDefinition.name);

    const restrictedNamespaces = namespaceConfig.namespaces
        .filter((namespaceDefinition) => namespaceDefinition.status !== 'active')
        .map((namespaceDefinition) => `${namespaceDefinition.name} (${namespaceDefinition.status})`);

    console.log(`
Translation Commands
  npm run build:translations
    Validate the source and rewrite all generated files.

  npm run check:translations
    Verify that generated files are already in sync.

  npm run validate:translations
    Fail if warnings or errors exist.

  npm run report:translations
    Print a health summary with namespace counts, duplicates, and missing locales.

  npm run namespaces:translations
    List all configured namespaces with their status.

  npm run update
    Build locally, commit, push, optionally wait for GitHub Actions, then pull.

Source Files
  i18n/translations.json
    Main translation source file. This is what you edit most of the time.

  i18n/namespaces.json
    Central namespace list. Add a namespace here before using a new namespace prefix.

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
  common
    Reusable labels, buttons, field names, generic UI text.

  info
    Helper copy, instructions, onboarding, descriptions.

  error
    Error labels, failure messages, error detail headings.

  success
    Success messages and completed-state confirmations.

  authentication
    Login, auth metadata, identity-related labels.

  applicationNames
    Product names or application names.

  metadata
    Page titles and meta descriptions.

Quick Rules
  - Do not edit files in i18n/generated manually.
  - Keep keys unique.
  - Prefer common.* for shared UI labels.
  - Add description or notes when a translation is ambiguous.
  - Remove test.* keys before production use.
`);
}

function printNamespaceList(namespaceConfig) {
    console.log('\nNamespaces');

    for (const namespaceDefinition of namespaceConfig.namespaces) {
        console.log(`  - ${namespaceDefinition.name} [${namespaceDefinition.status}]`);
        console.log(`    ${namespaceDefinition.label}: ${namespaceDefinition.description}`);
    }
}

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

function formatEntryLabel(index, key) {
    return `entry ${index + 1}${key ? ` (${key})` : ''}`;
}

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
    const MAX_ITEMS = 8;
    const visibleItems = items.slice(0, MAX_ITEMS);

    for (const item of visibleItems) {
        console.log(`    - ${formatter(item)}`);
    }

    if (items.length > MAX_ITEMS) {
        console.log(`    - +${items.length - MAX_ITEMS} more`);
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

function getResolvedValue(entry, locale) {
    if (typeof entry[locale] === 'string' && entry[locale].trim() !== '') {
        return entry[locale];
    }

    if (typeof entry.en === 'string' && entry.en.trim() !== '') {
        return entry.en;
    }

    return '';
}

function collectIssues(entries, namespaceConfig) {
    const errors = [];
    const warnings = [];
    const keyUsage = new Map();
    const knownNamespaces = namespaceConfig.namespaces.map((namespaceDefinition) => namespaceDefinition.name).join(', ');

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
                namespaceStatus: namespaceConfig.namespaceMap.get(namespace)?.status ?? 'unknown',
                sourceEntries: [],
                duplicateCount: 0,
                duplicateValuesDiffer: false,
                missingLocales: [],
                resolved: {}
            });
        }

        const record = registryByKey.get(normalizedKey);
        const serializedEntry = JSON.stringify({
            nl: entry.nl,
            fr: entry.fr,
            en: entry.en
        });

        record.sourceEntries.push(index + 1);
        record.duplicateCount += 1;
        record.lastSerializedValue = serializedEntry;
        record.resolved = Object.fromEntries(
            LOCALES.map((locale) => [locale, getResolvedValue(entry, locale)])
        );

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

        delete record.lastSerializedValue;
        record.missingLocales.sort();
    }

    return Array.from(registryByKey.values()).sort((left, right) => left.key.localeCompare(right.key));
}

function buildSummary(entries, registry, namespaceConfig, warnings, errors) {
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

    return {
        sourceFile: path.relative(process.cwd(), SOURCE_PATH),
        namespaceFile: path.relative(process.cwd(), NAMESPACE_CONFIG_PATH),
        locales: LOCALES,
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
        warningCounts,
        errorCounts
    };
}

function generateArtifacts(entries, namespaceConfig, warnings = [], errors = []) {
    const artifacts = new Map();
    const registry = buildRegistry(entries, namespaceConfig);
    const summary = buildSummary(entries, registry, namespaceConfig, warnings, errors);

    for (const locale of LOCALES) {
        const localeTree = buildLocaleTree(entries, locale);
        artifacts.set(`${locale}.json`, JSON.stringify(localeTree, null, 2) + '\n');
    }

    const namespaceSummaries = namespaceConfig.namespaces.map((namespaceDefinition) => ({
        ...namespaceDefinition,
        keyCount: registry.filter((record) => record.namespace === namespaceDefinition.name).length
    }));

    artifacts.set(
        'keys.json',
        JSON.stringify(registry.map((record) => record.key), null, 2) + '\n'
    );

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
        'registry.json',
        JSON.stringify(
            {
                locales: LOCALES,
                summary: {
                    totalEntries: entries.length,
                    uniqueKeys: registry.length,
                    namespaces: namespaceSummaries.length,
                    duplicateKeys: registry.filter((record) => record.duplicateCount > 1).length,
                    keysWithMissingLocales: registry.filter((record) => record.missingLocales.length > 0).length
                },
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
    if (!fs.existsSync(OUTPUT_DIR)) {
        fs.mkdirSync(OUTPUT_DIR, { recursive: true });
    }

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

function printLocalSummary(entries, namespaceConfig, errors, warnings) {
    console.log('\nTranslation Build');
    console.log(`  Source:      ${path.relative(process.cwd(), SOURCE_PATH)}`);
    console.log(`  Namespaces:  ${namespaceConfig.namespaces.length}`);
    console.log(`  Entries:     ${entries.length}`);
    console.log(`  Errors:      ${errors.length}`);
    console.log(`  Warnings:    ${warnings.length}`);
}

function printReport(entries, namespaceConfig, warnings, errors) {
    const registry = buildRegistry(entries, namespaceConfig);
    const summary = buildSummary(entries, registry, namespaceConfig, warnings, errors);

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
}

function main() {
    const options = parseArgs(process.argv.slice(2));
    const namespaceConfig = readNamespaceConfig();
    
    if (options.help) {
        printHelp(namespaceConfig);
        return;
    }

    if (options.listNamespaces) {
        printNamespaceList(namespaceConfig);
        return;
    }

    const entries = readSourceEntries();
    const { errors, warnings } = collectIssues(entries, namespaceConfig);

    if (options.report) {
        printReport(entries, namespaceConfig, warnings, errors);
        return;
    }

    if (process.env.GITHUB_ACTIONS !== 'true') {
        printLocalSummary(entries, namespaceConfig, errors, warnings);
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

    const artifacts = generateArtifacts(entries, namespaceConfig, warnings, errors);

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

try {
    main();
} catch (error) {
    console.error(error.message);
    process.exitCode = 1;
}
