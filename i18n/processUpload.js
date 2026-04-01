#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const ROOT_DIR = path.join(__dirname, '..');
const SOURCE_PATH = path.join(__dirname, 'translations.json');
const NAMESPACE_CONFIG_PATH = path.join(__dirname, 'namespaces.json');
const BUILD_SCRIPT_PATH = path.join(__dirname, 'buildTranslations.js');
const LOCALES = ['nl', 'fr', 'en'];

const DOMAIN_NAMESPACE_KEYWORDS = [
    { name: 'billing', label: 'Billing', keywords: ['billing', 'invoice', 'price', 'payment', 'facturation'] },
    { name: 'calls', label: 'Calls', keywords: ['call', 'operator', 'bellijst', 'call list', 'temporary call list'] },
    { name: 'contacts', label: 'Contacts', keywords: ['contact', 'phone', 'telephone', 'email contact'] },
    { name: 'contracts', label: 'Contracts', keywords: ['contract', 'signature', 'layout', 'attachment'] },
    { name: 'customers', label: 'Customers', keywords: ['customer', 'client', 'installation'] },
    { name: 'documents', label: 'Documents', keywords: ['document', 'file', 'attachment', 'template', 'download'] },
    { name: 'notifications', label: 'Notifications', keywords: ['notification', 'alarm', 'event', 'alert'] },
    { name: 'reports', label: 'Reports', keywords: ['report', 'pdf', 'excel', 'export'] }
];

function parseArgs(argv) {
    const result = {
        _: [],
        build: true,
        applyDirect: false,
        allowNamespaceProposals: false
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
            case 'allow-namespace-proposals':
                result.allowNamespaceProposals = true;
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

function printHelp() {
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

  --allow-namespace-proposals
    Allow the report to suggest a brand-new namespace for review when a strong domain match is found.

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

function readJsonFile(filePath) {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function writeJsonFile(filePath, value) {
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, JSON.stringify(value, null, 2) + '\n', 'utf8');
}

function readSourceEntries() {
    const entries = readJsonFile(SOURCE_PATH);

    if (!Array.isArray(entries)) {
        throw new Error('translations.json must contain an array.');
    }

    return entries;
}

function readNamespaceConfig() {
    const config = readJsonFile(NAMESPACE_CONFIG_PATH);

    if (!config || typeof config !== 'object' || !Array.isArray(config.namespaces)) {
        throw new Error('namespaces.json must contain a "namespaces" array.');
    }

    const namespaceMap = new Map();

    for (const namespaceDefinition of config.namespaces) {
        namespaceMap.set(namespaceDefinition.name, namespaceDefinition);
    }

    return {
        ...config,
        namespaceMap
    };
}

function sortEntries(entries) {
    entries.sort((left, right) => {
        const keyCompare = String(left.key).localeCompare(String(right.key));

        if (keyCompare !== 0) {
            return keyCompare;
        }

        return String(left.en || '').localeCompare(String(right.en || ''));
    });
}

function runBuild() {
    execFileSync(process.execPath, [BUILD_SCRIPT_PATH], {
        cwd: ROOT_DIR,
        stdio: 'inherit'
    });
}

function toOptionalTrimmedString(value) {
    if (typeof value !== 'string') {
        return null;
    }

    return value.trim();
}

function getUploadText(entry) {
    for (const locale of ['en', 'nl', 'fr']) {
        const value = toOptionalTrimmedString(entry[locale]);

        if (value) {
            return value;
        }
    }

    return '';
}

function normalizeWords(input) {
    return input
        .replace(/\{\{\s*[^}]+\s*\}\}/g, ' ')
        .replace(/e-mail/gi, ' email ')
        .replace(/2FA/gi, ' two factor authentication ')
        .replace(/back[ -]?up/gi, ' backup ')
        .replace(/[“”‘’]/g, ' ')
        .replace(/&/g, ' and ')
        .replace(/\//g, ' ')
        .replace(/[^A-Za-z0-9]+/g, ' ')
        .trim();
}

function toCamelCase(input) {
    const words = normalizeWords(input).split(/\s+/).filter(Boolean);

    return words
        .map((word, index) => {
            const lower = word.toLowerCase();
            const mapped = ['api', 'url', 'pdf', 'csv', 'sms', 'fcm', 'ip', 'wan'].includes(lower)
                ? lower.toUpperCase()
                : lower;

            if (index === 0) {
                return mapped.charAt(0).toLowerCase() + mapped.slice(1);
            }

            return mapped.charAt(0).toUpperCase() + mapped.slice(1);
        })
        .join('');
}

function buildLeafKey(text) {
    const trimmed = text.trim().replace(/[.]+$/, '');
    const replacements = [
        [/^You are about to\s+/i, 'aboutTo '],
        [/^Please\s+/i, 'please '],
        [/^To disable\s+/i, 'disable '],
        [/^To enable\s+/i, 'enable '],
        [/^I hereby confirm that I agree to\s+/i, 'confirm '],
        [/^As soon as\s+/i, 'once ']
    ];

    let candidate = trimmed;

    for (const [pattern, replacement] of replacements) {
        if (pattern.test(candidate)) {
            candidate = candidate.replace(pattern, replacement);
            break;
        }
    }

    const key = toCamelCase(candidate);

    if (key.length <= 72) {
        return key;
    }

    const shortened = normalizeWords(candidate).split(/\s+/).filter(Boolean).slice(0, 8).join(' ');
    return toCamelCase(shortened);
}

function ensureUniqueKey(baseKey, usedKeys) {
    if (!usedKeys.has(baseKey)) {
        usedKeys.add(baseKey);
        return baseKey;
    }

    let counter = 2;

    while (true) {
        const candidate = `${baseKey}${counter}`;

        if (!usedKeys.has(candidate)) {
            usedKeys.add(candidate);
            return candidate;
        }

        counter += 1;
    }
}

function suggestNamespace(entry, namespaceConfig, options = {}) {
    const text = getUploadText(entry);
    const lower = text.toLowerCase();

    if (!text) {
        return {
            namespace: namespaceConfig.defaultNamespace || 'common',
            confidence: 'low',
            reason: 'No text was provided, so the default namespace was used.',
            namespaceProposal: null
        };
    }

    const directMatches = [
        {
            namespace: 'authentication',
            confidence: 'high',
            reason: 'Detected authentication terminology.',
            pattern: /auth|password|login|logout|verify|verification|firebase|token|credential|multifactor|two factor|captcha|email address/
        },
        {
            namespace: 'error',
            confidence: 'high',
            reason: 'Detected failure or validation language.',
            pattern: /cannot|invalid|failed|missing|required|not found|expired|restricted|unable|must be/
        },
        {
            namespace: 'success',
            confidence: 'high',
            reason: 'Detected completed-state language.',
            pattern: /\b(added|deleted|changed|updated|saved|imported|registered|completed|refreshed)\b/
        },
        {
            namespace: 'info',
            confidence: 'medium',
            reason: 'Detected explanatory or helper copy.',
            pattern: /^please |^to disable |^to enable |^as soon as |^you are about to |check the box|this means/
        },
        {
            namespace: 'applicationNames',
            confidence: 'medium',
            reason: 'Detected a product or application name.',
            pattern: /^(mypraxis|praxis)\b/
        }
    ];

    for (const match of directMatches) {
        if (match.pattern.test(lower)) {
            return {
                namespace: match.namespace,
                confidence: match.confidence,
                reason: match.reason,
                namespaceProposal: null
            };
        }
    }

    if (options.allowNamespaceProposals) {
        for (const candidate of DOMAIN_NAMESPACE_KEYWORDS) {
            const hit = candidate.keywords.some((keyword) => lower.includes(keyword));

            if (!hit) {
                continue;
            }

            if (namespaceConfig.namespaceMap.has(candidate.name)) {
                return {
                    namespace: candidate.name,
                    confidence: 'medium',
                    reason: `Detected strong domain match for "${candidate.name}".`,
                    namespaceProposal: null
                };
            }

            return {
                namespace: namespaceConfig.defaultNamespace || 'common',
                confidence: 'low',
                reason: `Detected a likely new domain namespace "${candidate.name}", but it does not yet exist.`,
                namespaceProposal: {
                    name: candidate.name,
                    label: candidate.label,
                    description: `Suggested automatically from uploaded translation content related to ${candidate.name}.`
                }
            };
        }
    }

    return {
        namespace: 'common',
        confidence: text.length > 60 ? 'medium' : 'low',
        reason: 'No stronger namespace signal was detected, so common was used.',
        namespaceProposal: null
    };
}

function createReportSkeleton(command, inputPath) {
    return {
        version: 1,
        command,
        createdAt: new Date().toISOString(),
        inputFile: path.relative(ROOT_DIR, path.resolve(inputPath)),
        summary: {
            totalEntries: 0,
            directUpdates: 0,
            appliedDirectUpdates: 0,
            proposals: 0,
            skipped: 0,
            errors: 0,
            namespaceProposals: 0
        },
        directUpdates: [],
        proposals: [],
        skipped: [],
        errors: [],
        namespaceProposals: []
    };
}

function buildDirectUpdate(uploadEntry, existingEntry, index) {
    const changes = {};

    for (const locale of LOCALES) {
        const nextValue = toOptionalTrimmedString(uploadEntry[locale]);

        if (nextValue === null || nextValue === '') {
            continue;
        }

        if (nextValue !== existingEntry[locale]) {
            changes[locale] = nextValue;
        }
    }

    if (Object.keys(changes).length === 0) {
        return {
            type: 'skipped',
            index,
            key: existingEntry.key,
            reason: 'No locale changes were provided for the existing key.'
        };
    }

    return {
        type: 'directUpdate',
        index,
        key: existingEntry.key,
        namespace: existingEntry.key.split('.')[0],
        changes,
        current: Object.fromEntries(LOCALES.map((locale) => [locale, existingEntry[locale]])),
        next: Object.fromEntries(
            LOCALES.map((locale) => [locale, changes[locale] ?? existingEntry[locale]])
        )
    };
}

function buildProposal(uploadEntry, index, usedKeys, namespaceConfig, options) {
    const text = getUploadText(uploadEntry);

    if (!text) {
        return {
            type: 'skipped',
            index,
            reason: 'Proposal entry did not contain any locale text.'
        };
    }

    const namespaceSuggestion = suggestNamespace(uploadEntry, namespaceConfig, options);
    const baseKey = `${namespaceSuggestion.namespace}.${buildLeafKey(text) || 'newTranslation'}`;
    const suggestedKey = ensureUniqueKey(baseKey, usedKeys);
    const proposedEntry = {
        key: suggestedKey,
        nl: toOptionalTrimmedString(uploadEntry.nl) ?? '',
        fr: toOptionalTrimmedString(uploadEntry.fr) ?? '',
        en: toOptionalTrimmedString(uploadEntry.en) ?? ''
    };

    if (typeof uploadEntry.description === 'string' && uploadEntry.description.trim() !== '') {
        proposedEntry.description = uploadEntry.description.trim();
    }

    if (typeof uploadEntry.notes === 'string' && uploadEntry.notes.trim() !== '') {
        proposedEntry.notes = uploadEntry.notes.trim();
    }

    return {
        type: 'proposal',
        index,
        suggestedKey,
        suggestedNamespace: namespaceSuggestion.namespace,
        confidence: namespaceSuggestion.confidence,
        reason: namespaceSuggestion.reason,
        namespaceProposal: namespaceSuggestion.namespaceProposal,
        proposedEntry,
        reviewRequired: true
    };
}

function applyDirectUpdates(entries, directUpdates) {
    const byKey = new Map(entries.map((entry) => [entry.key, entry]));

    for (const update of directUpdates) {
        const entry = byKey.get(update.key);

        if (!entry) {
            throw new Error(`Cannot apply direct update for missing key "${update.key}".`);
        }

        for (const [locale, value] of Object.entries(update.changes)) {
            entry[locale] = value;
        }
    }
}

function prepareUpload(options) {
    if (!options.input) {
        throw new Error('The prepare command requires --input <file>.');
    }

    const payload = readJsonFile(path.resolve(options.input));

    if (!payload || !Array.isArray(payload.entries)) {
        throw new Error('Upload payload must contain an "entries" array.');
    }

    const entries = readSourceEntries();
    const namespaceConfig = readNamespaceConfig();
    const byKey = new Map(entries.map((entry) => [entry.key, entry]));
    const usedKeys = new Set(entries.map((entry) => entry.key));
    const report = createReportSkeleton('prepare', options.input);
    const directUpdates = [];

    report.summary.totalEntries = payload.entries.length;

    payload.entries.forEach((uploadEntry, uploadIndex) => {
        const index = uploadIndex + 1;
        const normalizedKey = typeof uploadEntry.key === 'string' && uploadEntry.key.trim() !== ''
            ? uploadEntry.key.trim()
            : '';

        if (normalizedKey) {
            const existingEntry = byKey.get(normalizedKey);

            if (!existingEntry) {
                report.errors.push({
                    index,
                    key: normalizedKey,
                    reason: 'The uploaded key does not exist in translations.json and cannot be treated as a direct update.'
                });
                return;
            }

            const result = buildDirectUpdate(uploadEntry, existingEntry, index);

            if (result.type === 'skipped') {
                report.skipped.push(result);
                return;
            }

            report.directUpdates.push(result);
            directUpdates.push(result);
            return;
        }

        const proposal = buildProposal(uploadEntry, index, usedKeys, namespaceConfig, {
            allowNamespaceProposals: options.allowNamespaceProposals
        });

        if (proposal.type === 'skipped') {
            report.skipped.push(proposal);
            return;
        }

        if (proposal.namespaceProposal) {
            report.namespaceProposals.push({
                index,
                suggestedNamespace: proposal.namespaceProposal
            });
        }

        report.proposals.push(proposal);
    });

    if (options.applyDirect && directUpdates.length > 0) {
        applyDirectUpdates(entries, directUpdates);
        sortEntries(entries);
        writeJsonFile(SOURCE_PATH, entries);

        if (options.build) {
            runBuild();
        }

        report.summary.appliedDirectUpdates = directUpdates.length;
    }

    report.summary.directUpdates = report.directUpdates.length;
    report.summary.proposals = report.proposals.length;
    report.summary.skipped = report.skipped.length;
    report.summary.errors = report.errors.length;
    report.summary.namespaceProposals = report.namespaceProposals.length;

    const reportPath = path.resolve(
        options.report || `${options.input}.report.json`
    );
    writeJsonFile(reportPath, report);

    console.log('\nUpload Preparation Report');
    console.log(`  Input entries:          ${report.summary.totalEntries}`);
    console.log(`  Direct updates:         ${report.summary.directUpdates}`);
    console.log(`  Applied direct updates: ${report.summary.appliedDirectUpdates}`);
    console.log(`  New proposals:          ${report.summary.proposals}`);
    console.log(`  Namespace proposals:    ${report.summary.namespaceProposals}`);
    console.log(`  Skipped:                ${report.summary.skipped}`);
    console.log(`  Errors:                 ${report.summary.errors}`);
    console.log(`  Report:                 ${path.relative(ROOT_DIR, reportPath)}`);

    if (report.errors.length > 0) {
        process.exitCode = 1;
    }
}

function applyProposals(options) {
    if (!options.input) {
        throw new Error('The apply-proposals command requires --input <report-file>.');
    }

    const report = readJsonFile(path.resolve(options.input));

    if (!report || !Array.isArray(report.proposals)) {
        throw new Error('Proposal report must contain a "proposals" array.');
    }

    const entries = readSourceEntries();
    const namespaceConfig = readNamespaceConfig();
    const usedKeys = new Set(entries.map((entry) => entry.key));

    for (const proposal of report.proposals) {
        const namespace = proposal.suggestedNamespace;

        if (!namespaceConfig.namespaceMap.has(namespace)) {
            throw new Error(
                `Proposal "${proposal.suggestedKey}" uses namespace "${namespace}" which is not in i18n/namespaces.json.`
            );
        }
    }

    const acceptedEntries = [];

    for (const proposal of report.proposals) {
        const proposedEntry = {
            ...proposal.proposedEntry
        };

        if (usedKeys.has(proposedEntry.key)) {
            proposedEntry.key = ensureUniqueKey(proposedEntry.key, usedKeys);
        } else {
            usedKeys.add(proposedEntry.key);
        }

        acceptedEntries.push(proposedEntry);
        entries.push(proposedEntry);
    }

    sortEntries(entries);
    writeJsonFile(SOURCE_PATH, entries);

    if (options.build) {
        runBuild();
    }

    console.log('\nApplied Proposal Entries');
    console.log(`  Accepted proposals: ${acceptedEntries.length}`);
    console.log(`  Source file:        ${path.relative(ROOT_DIR, SOURCE_PATH)}`);
  }

function main() {
    const options = parseArgs(process.argv.slice(2));
    const command = options._[0] || 'prepare';

    if (options.help) {
        printHelp();
        return;
    }

    if (command === 'prepare') {
        prepareUpload(options);
        return;
    }

    if (command === 'apply-proposals') {
        applyProposals(options);
        return;
    }

    throw new Error(`Unknown command "${command}".`);
}

try {
    main();
} catch (error) {
    console.error(error.message);
    process.exitCode = 1;
}
