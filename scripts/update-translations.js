#!/usr/bin/env node

const { spawnSync } = require('child_process');
const path = require('path');
const readline = require('readline');

const ROOT_DIR = path.resolve(__dirname, '..');
const POLL_INTERVAL = Number(process.env.POLL_INTERVAL || 5);
const MAX_WAIT_SECONDS = Number(process.env.MAX_WAIT_SECONDS || 300);
const WORKFLOW_FILE = process.env.WORKFLOW_FILE || 'buildTranslations.yml';
const BUILD_WORKFLOW_PATHS = [
  'i18n/source/translations.json',
  'i18n/config/',
  'i18n/bin/',
  'i18n/src/',
  'i18n/proposals/pending/',
  'package.json',
  'package-lock.json',
  'scripts/',
  'test/',
  '.github/workflows/buildTranslations.yml',
  '.github/workflows/processTranslationUploads.yml'
];

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: ROOT_DIR,
    encoding: 'utf8',
    stdio: options.captureOutput ? ['inherit', 'pipe', 'pipe'] : 'inherit'
  });

  if (options.allowFailure) {
    return result;
  }

  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }

  return result;
}

function capture(command, args, options = {}) {
  const result = run(command, args, {
    ...options,
    captureOutput: true
  });

  return (result.stdout || '').trim();
}

function commandExists(command) {
  const probe = process.platform === 'win32' ? 'where' : 'sh';
  const args = process.platform === 'win32' ? [command] : ['-c', 'command -v "$1"', 'sh', command];
  const result = spawnSync(probe, args, {
    cwd: ROOT_DIR,
    stdio: 'ignore'
  });

  return result.status === 0;
}

function sleep(seconds) {
  return new Promise((resolve) => setTimeout(resolve, seconds * 1000));
}

function touchesBuildWorkflowPaths(changedPaths) {
  return changedPaths.some((changedPath) =>
    BUILD_WORKFLOW_PATHS.some((workflowPath) =>
      workflowPath.endsWith('/')
        ? changedPath.startsWith(workflowPath)
        : changedPath === workflowPath
    )
  );
}

function commitTouchesBuildWorkflowPaths() {
  const changedPathsOutput = capture('git', ['diff-tree', '--no-commit-id', '--name-only', '-r', 'HEAD']);
  const changedPaths = changedPathsOutput ? changedPathsOutput.split(/\r?\n/).filter(Boolean) : [];

  return touchesBuildWorkflowPaths(changedPaths);
}

async function waitForGithubActions(targetSha) {
  if (!commandExists('gh')) {
    console.log('GitHub CLI not found. Skipping workflow wait.');
    return false;
  }

  const authStatus = run('gh', ['auth', 'status'], { allowFailure: true, captureOutput: true });
  if (authStatus.status !== 0) {
    console.log('GitHub CLI is not authenticated correctly. Skipping workflow wait.');
    return false;
  }

  let elapsed = 0;
  console.log('Waiting for GitHub Actions run to start...');

  while (elapsed < MAX_WAIT_SECONDS) {
    const runId = capture(
      'gh',
      [
        'run',
        'list',
        '--workflow',
        WORKFLOW_FILE,
        '--branch',
        'main',
        '--event',
        'push',
        '--limit',
        '20',
        '--json',
        'databaseId,headSha',
        '--jq',
        `.[] | select(.headSha == "${targetSha}") | .databaseId`
      ],
      { allowFailure: true }
    )
      .split(/\r?\n/)
      .find(Boolean);

    if (runId) {
      console.log(`Watching GitHub Actions run ${runId}...`);
      const watchResult = run('gh', ['run', 'watch', runId, '--exit-status'], { allowFailure: true });
      return watchResult.status === 0;
    }

    process.stdout.write(`\rWaiting for workflow registration... ${String(elapsed).padStart(3, '0')}s`);
    await sleep(POLL_INTERVAL);
    elapsed += POLL_INTERVAL;
  }

  process.stdout.write('\n');
  console.log(`No matching workflow run was found within ${MAX_WAIT_SECONDS}s.`);
  return false;
}

async function askQuestion(prompt) {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  return new Promise((resolve) => {
    rl.question(prompt, (answer) => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

async function confirmChanges(statusOutput) {
  console.log('\nThe following changes will be staged and committed:');
  console.log(statusOutput);
  const answer = (await askQuestion('\nContinue? [y/N] ')).toLowerCase();
  return answer === 'y' || answer === 'yes';
}

async function main() {
  const currentBranch = capture('git', ['rev-parse', '--abbrev-ref', 'HEAD']);

  if (!currentBranch || currentBranch === 'HEAD') {
    throw new Error('Cannot update from a detached HEAD. Check out a branch first.');
  }

  console.log('\n==> Step 1/5: Building translations locally');
  run(process.execPath, ['i18n/bin/build-translations.js']);

  const statusOutput = capture('git', ['status', '--short']);

  if (!statusOutput) {
    console.log('No changes to commit.');
    return;
  }

  if (!(await confirmChanges(statusOutput))) {
    console.log('Cancelled without staging, committing, or pushing.');
    return;
  }

  console.log('\n==> Step 2/5: Enter commit message');
  const message = await askQuestion('Commit message: ');

  if (!message) {
    console.log('No commit message filled in.');
    process.exit(1);
  }

  run('git', ['add', '--all']);

  const cachedDiff = run('git', ['diff', '--cached', '--quiet'], { allowFailure: true });
  if (cachedDiff.status === 0) {
    console.log('No changes to commit.');
    process.exit(0);
  }

  console.log('\n==> Step 3/5: Commit and push');
  run('git', ['commit', '-m', message]);
  run('git', ['push', 'origin', `HEAD:${currentBranch}`]);

  const pushedSha = capture('git', ['rev-parse', 'HEAD']);

  console.log('\n==> Step 4/5: Waiting for automation');
  const shouldWaitForWorkflow = currentBranch === 'main' && commitTouchesBuildWorkflowPaths();

  if (shouldWaitForWorkflow && (await waitForGithubActions(pushedSha))) {
    console.log('GitHub Actions completed successfully.');
  } else if (shouldWaitForWorkflow) {
    console.log('Continuing without confirmed workflow completion.');
  } else {
    console.log(`Skipping workflow wait because no matching build workflow is expected for "${currentBranch}".`);
  }

  console.log('\n==> Step 5/5: Pulling latest changes');
  if (!shouldWaitForWorkflow) {
    console.log('Skipping pull because no follow-up automation commit is expected.');
    console.log('Ready.');
    return;
  }

  const pullResult = run('git', ['pull', '--rebase', 'origin', currentBranch], { allowFailure: true });
  if (pullResult.status === 0) {
    console.log('Local branch synchronized.');
  } else {
    console.log('Pull failed after a successful push. The remote branch already contains your commit; you can retry sync later.');
  }

  console.log('Ready.');
}

if (require.main === module) {
  main().catch((error) => {
    console.error(error.message);
    process.exit(1);
  });
}

module.exports = {
  touchesBuildWorkflowPaths
};
