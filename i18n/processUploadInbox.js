#!/usr/bin/env node

// Batch processor for upload files already committed into the repo.
// main = direct updates for existing keys.
// translation-proposals/* = new entries that stay reviewable in a PR.

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const ROOT_DIR = path.join(__dirname, '..');
const PROCESS_UPLOAD_SCRIPT = path.join(__dirname, 'processUpload.js');
const BUILD_SCRIPT = path.join(__dirname, 'buildTranslations.js');
const DEFAULT_UPLOADS_DIR = path.join(__dirname, 'uploads', 'incoming');
const DEFAULT_REPORTS_DIR = path.join(__dirname, 'upload-reports');
const DEFAULT_PROCESSED_DIR = path.join(__dirname, 'uploads', 'processed');

function parseArgs(argv) {
    const result = {
        mode: 'direct',
        uploadsDir: DEFAULT_UPLOADS_DIR,
        reportsDir: DEFAULT_REPORTS_DIR,
        processedDir: DEFAULT_PROCESSED_DIR,
        build: true,
        dryRun: false
    };

    for (let index = 0; index < argv.length; index += 1) {
        const token = argv[index];

        if (!token.startsWith('--')) {
            continue;
        }

        const flag = token.slice(2);
        const next = argv[index + 1];

        switch (flag) {
            case 'mode':
                result.mode = next;
                index += 1;
                break;
            case 'uploads-dir':
                result.uploadsDir = path.resolve(next);
                index += 1;
                break;
            case 'reports-dir':
                result.reportsDir = path.resolve(next);
                index += 1;
                break;
            case 'processed-dir':
                result.processedDir = path.resolve(next);
                index += 1;
                break;
            case 'no-build':
                result.build = false;
                break;
            case 'dry-run':
                result.dryRun = true;
                break;
            case 'help':
            case 'h':
                result.help = true;
                break;
            default:
                throw new Error(`Unknown option "--${flag}".`);
        }
    }

    if (!['direct', 'proposal'].includes(result.mode)) {
        throw new Error('Mode must be "direct" or "proposal".');
    }

    return result;
}

function printHelp() {
    console.log(`
Upload Inbox Commands
  node i18n/processUploadInbox.js --mode direct
    Process incoming uploads intended for direct updates on main.

  node i18n/processUploadInbox.js --mode proposal
    Process incoming uploads intended for proposal branches and PR review.

Options
  --uploads-dir <path>
    Directory containing incoming upload payloads.

  --reports-dir <path>
    Directory where processing reports are written.

  --processed-dir <path>
    Directory where processed upload payloads are archived.

  --dry-run
    Preview the inbox result without editing translations.json or archiving uploads.

  --no-build
    Skip the final translation build after applying changes.
`);
}

function ensureDirectory(dirPath) {
    fs.mkdirSync(dirPath, { recursive: true });
}

function runNodeScript(scriptPath, args) {
    execFileSync(process.execPath, [scriptPath, ...args], {
        cwd: ROOT_DIR,
        stdio: 'inherit'
    });
}

function readJsonFile(filePath) {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function listUploadFiles(dirPath) {
    if (!fs.existsSync(dirPath)) {
        return [];
    }

    return fs.readdirSync(dirPath)
        .filter((fileName) => fileName.endsWith('.json'))
        .sort((left, right) => left.localeCompare(right))
        .map((fileName) => path.join(dirPath, fileName));
}

function archiveUpload(filePath, processedDir) {
    ensureDirectory(processedDir);
    const parsed = path.parse(filePath);
    let targetPath = path.join(processedDir, `${parsed.name}${parsed.ext}`);
    let counter = 2;

    while (fs.existsSync(targetPath)) {
        targetPath = path.join(processedDir, `${parsed.name}-${counter}${parsed.ext}`);
        counter += 1;
    }

    fs.renameSync(filePath, targetPath);
    return targetPath;
}

function processUploadFile(filePath, options) {
    ensureDirectory(options.reportsDir);
    const reportPath = path.join(
        options.reportsDir,
        `${path.basename(filePath, '.json')}.report.json`
    );

    runNodeScript(PROCESS_UPLOAD_SCRIPT, [
        'prepare',
        '--input',
        filePath,
        '--report',
        reportPath,
        '--no-build'
    ]);

    const report = readJsonFile(reportPath);
    const hasBlockingErrors = report.summary.errors > 0;
    const hasProposals = report.summary.proposals > 0;
    const hasDirectUpdates = report.summary.directUpdates > 0;

    if (options.mode === 'direct') {
        if (hasBlockingErrors || hasProposals) {
            throw new Error(
                `Upload "${path.basename(filePath)}" cannot be processed in direct mode because it contains proposals or errors.`
            );
        }

        if (options.dryRun) {
            return {
                filePath,
                reportPath,
                archivedPath: null,
                directUpdates: report.summary.directUpdates,
                proposals: 0
            };
        }

        if (hasDirectUpdates) {
            runNodeScript(PROCESS_UPLOAD_SCRIPT, [
                'prepare',
                '--input',
                filePath,
                '--report',
                reportPath,
                '--apply-direct',
                '--no-build'
            ]);
        }

        const archivedPath = archiveUpload(filePath, options.processedDir);

        return {
            filePath,
            reportPath,
            archivedPath,
            directUpdates: report.summary.directUpdates,
            proposals: 0
        };
    }

    if (hasBlockingErrors) {
        throw new Error(
            `Upload "${path.basename(filePath)}" contains blocking errors and cannot be processed for proposals.`
        );
    }

    if (hasDirectUpdates) {
        throw new Error(
            `Upload "${path.basename(filePath)}" contains existing-key updates. Proposal mode only accepts new entries without keys.`
        );
    }

    if (options.dryRun) {
        return {
            filePath,
            reportPath,
            archivedPath: null,
            directUpdates: 0,
            proposals: report.summary.proposals
        };
    }

    if (hasProposals) {
        runNodeScript(PROCESS_UPLOAD_SCRIPT, [
            'apply-proposals',
            '--input',
            reportPath,
            '--no-build'
        ]);
    }

    const archivedPath = archiveUpload(filePath, options.processedDir);

    return {
        filePath,
        reportPath,
        archivedPath,
        directUpdates: 0,
        proposals: report.summary.proposals
    };
}

function main() {
    const options = parseArgs(process.argv.slice(2));

    if (options.help) {
        printHelp();
        return;
    }

    ensureDirectory(options.uploadsDir);
    ensureDirectory(options.reportsDir);
    ensureDirectory(options.processedDir);

    const uploadFiles = listUploadFiles(options.uploadsDir);

    console.log('\nUpload Inbox Processing');
    console.log(`  Mode:        ${options.mode}`);
    console.log(`  Uploads dir: ${path.relative(ROOT_DIR, options.uploadsDir)}`);
    console.log(`  Reports dir: ${path.relative(ROOT_DIR, options.reportsDir)}`);
    console.log(`  Dry run:     ${options.dryRun ? 'yes' : 'no'}`);
    console.log(`  Files:       ${uploadFiles.length}`);

    if (uploadFiles.length === 0) {
        console.log('No upload files found.');
        return;
    }

    let totalDirectUpdates = 0;
    let totalProposals = 0;

    for (const filePath of uploadFiles) {
        const result = processUploadFile(filePath, options);
        totalDirectUpdates += result.directUpdates;
        totalProposals += result.proposals;
    }

    if (options.build && !options.dryRun) {
        runNodeScript(BUILD_SCRIPT, []);
    }

    console.log('\nUpload Inbox Processed');
    console.log(`  Direct updates applied: ${totalDirectUpdates}`);
    console.log(`  Proposals applied:      ${totalProposals}`);
    console.log(`  Upload files archived:  ${options.dryRun ? 0 : uploadFiles.length}`);
}

try {
    main();
} catch (error) {
    console.error(error.message);
    process.exitCode = 1;
}
