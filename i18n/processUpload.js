#!/usr/bin/env node

// Upload classifier for editor-submitted changes.
// Existing keys become direct locale updates.
// Entries without a key become proposals with a suggested namespace and key.

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const ROOT_DIR = path.join(__dirname, '..');
const SOURCE_PATH = path.join(__dirname, 'translations.json');
const NAMESPACE_CONFIG_PATH = path.join(__dirname, 'namespaces.json');
const BUILD_SCRIPT_PATH = path.join(__dirname, 'buildTranslations.js');
const LOCALES = ['nl', 'fr', 'en'];
const DIRECT_UPDATE_ALLOWED_FIELDS = new Set(['key', ...LOCALES]);
const PROPOSAL_ALLOWED_FIELDS = new Set([...LOCALES, 'description', 'notes']);

function parseArgs(argv) {
    const result = {
        _: [],
        build: true,
        applyDirect: false
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

function getUnexpectedFields(entry, allowedFields) {
    return Object.keys(entry).filter((field) => !allowedFields.has(field));
}

function hasOwn(entry, field) {
    return Object.prototype.hasOwnProperty.call(entry, field);
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

function getSuggestionContext(entry) {
    return [
        getUploadText(entry),
        toOptionalTrimmedString(entry.description),
        toOptionalTrimmedString(entry.notes)
    ]
        .filter(Boolean)
        .join(' ');
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

function hasNamespace(namespaceConfig, namespace) {
    return namespaceConfig.namespaceMap.has(namespace);
}

// Namespace suggestions are intentionally limited to namespaces that already exist.
function suggestNamespace(entry, namespaceConfig) {
    const text = getUploadText(entry);
    const context = getSuggestionContext(entry);
    const lower = context.toLowerCase();
    const defaultNamespace = hasNamespace(namespaceConfig, namespaceConfig.defaultNamespace)
        ? namespaceConfig.defaultNamespace
        : 'common';

    if (!text) {
        return {
            namespace: defaultNamespace,
            confidence: 'low',
            reason: 'No text was provided, so the default namespace was used.'
        };
    }

    const directMatches = [
        [
            'metadata',
            'high',
            'Detected page metadata wording.',
            /(page title|meta description|browser title|seo title|seo description|\bmetadata\b)/
        ],
        [
            'applicationNames',
            'high',
            'Detected a product or application name.',
            /^(mypraxis|praxis|postman|postgres|innovaphone)\b/
        ],
        [
            'authentication',
            'high',
            'Detected authentication terminology.',
            /(auth|password|login|logout|sign in|sign out|verify|verification|firebase|token|credential|multifactor|two factor|captcha|bearer|authenticator|email verification|authorization)/
        ],
        [
            'error',
            'high',
            'Detected failure or validation language.',
            /(\berror\b|cannot|invalid|failed|failure|missing|required|not found|expired|restricted|unable|forbidden|not authorized|must be|already exists)/
        ],
        [
            'success',
            'high',
            'Detected completed-state language.',
            /(\bsuccess\b|successfully|\badded\b|\bdeleted\b|\bchanged\b|\bupdated\b|\bsaved\b|\bimported\b|\bregistered\b|\bcompleted\b|\brefreshed\b|\bcreated\b|\bcopied\b|\bsent\b)/
        ],
        [
            'info',
            'medium',
            'Detected explanatory or helper copy.',
            /(^please |^to disable |^to enable |^as soon as |^you are about to |check the box|this means|you can|used to|intended for|before continuing|after successful|by pressing this button)/
        ]
    ];

    for (const [namespace, confidence, reason, pattern] of directMatches) {
        if (hasNamespace(namespaceConfig, namespace) && pattern.test(lower)) {
            return {
                namespace,
                confidence,
                reason
            };
        }
    }

    if (hasNamespace(namespaceConfig, 'info') && text.length > 90) {
        return {
            namespace: 'info',
            confidence: 'medium',
            reason: 'Longer explanatory copy usually belongs in the info namespace.'
        };
    }

    return {
        namespace: hasNamespace(namespaceConfig, 'common') ? 'common' : defaultNamespace,
        confidence: text.length > 60 ? 'medium' : 'low',
        reason: 'No stronger namespace signal was detected, so common was used.'
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
            errors: 0
        },
        directUpdates: [],
        proposals: [],
        skipped: [],
        errors: []
    };
}

function buildDirectUpdate(uploadEntry, existingEntry, index) {
    const unexpectedFields = getUnexpectedFields(uploadEntry, DIRECT_UPDATE_ALLOWED_FIELDS);

    if (unexpectedFields.length > 0) {
        return {
            type: 'error',
            index,
            key: existingEntry.key,
            reason: `Direct updates may only contain key, nl, fr, and en. Unexpected fields: ${unexpectedFields.join(', ')}.`
        };
    }

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

function buildProposal(uploadEntry, index, usedKeys, namespaceConfig) {
    const text = getUploadText(uploadEntry);
    const unexpectedFields = getUnexpectedFields(uploadEntry, PROPOSAL_ALLOWED_FIELDS);

    if (!text) {
        return {
            type: 'skipped',
            index,
            reason: 'Proposal entry did not contain any locale text.'
        };
    }

    if (unexpectedFields.length > 0) {
        return {
            type: 'error',
            index,
            reason: `Proposal entries may only contain nl, fr, en, description, and notes. Unexpected fields: ${unexpectedFields.join(', ')}.`
        };
    }

    if (hasOwn(uploadEntry, 'key')) {
        return {
            type: 'error',
            index,
            reason: 'Proposal entries may not contain a key. Existing keys must be sent through the direct-update path.'
        };
    }

    const namespaceSuggestion = suggestNamespace(uploadEntry, namespaceConfig);
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

        if (!uploadEntry || typeof uploadEntry !== 'object' || Array.isArray(uploadEntry)) {
            report.errors.push({
                index,
                reason: 'Each uploaded entry must be an object.'
            });
            return;
        }

        const normalizedKey = typeof uploadEntry.key === 'string' && uploadEntry.key.trim() !== ''
            ? uploadEntry.key.trim()
            : '';

        if (hasOwn(uploadEntry, 'key') && !normalizedKey) {
            report.errors.push({
                index,
                reason: 'If a key is provided, it must be a non-empty string.'
            });
            return;
        }

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

            if (result.type === 'error') {
                report.errors.push(result);
                return;
            }

            if (result.type === 'skipped') {
                report.skipped.push(result);
                return;
            }

            report.directUpdates.push(result);
            directUpdates.push(result);
            return;
        }

        const proposal = buildProposal(uploadEntry, index, usedKeys, namespaceConfig);

        if (proposal.type === 'error') {
            report.errors.push(proposal);
            return;
        }

        if (proposal.type === 'skipped') {
            report.skipped.push(proposal);
            return;
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

    const reportPath = path.resolve(
        options.report || `${options.input}.report.json`
    );
    writeJsonFile(reportPath, report);

    console.log('\nUpload Preparation Report');
    console.log(`  Input entries:          ${report.summary.totalEntries}`);
    console.log(`  Direct updates:         ${report.summary.directUpdates}`);
    console.log(`  Applied direct updates: ${report.summary.appliedDirectUpdates}`);
    console.log(`  New proposals:          ${report.summary.proposals}`);
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
