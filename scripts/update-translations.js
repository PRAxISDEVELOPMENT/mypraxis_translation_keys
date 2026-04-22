#!/usr/bin/env node

const { spawnSync } = require('child_process');
const path = require('path');
const readline = require('readline');

const ROOT_DIR = path.resolve(__dirname, '..');
const POLL_INTERVAL = Number(process.env.POLL_INTERVAL || 5);
const MAX_WAIT_SECONDS = Number(process.env.MAX_WAIT_SECONDS || 300);
const WORKFLOW_FILE = process.env.WORKFLOW_FILE || 'buildTranslations.yml';

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
  const probe = process.platform === 'win32' ? 'where' : 'command';
  const args = process.platform === 'win32' ? [command] : ['-v', command];
  const result = spawnSync(probe, args, {
    cwd: ROOT_DIR,
    stdio: 'ignore',
    shell: process.platform !== 'win32'
  });

  return result.status === 0;
}

function sleep(seconds) {
  const end = Date.now() + seconds * 1000;

  while (Date.now() < end) {
    // Busy wait is acceptable here because this helper is short-lived and interactive.
  }
}

function commitTouchesBuildWorkflowPaths() {
  const changedPathsOutput = capture('git', ['diff-tree', '--no-commit-id', '--name-only', '-r', 'HEAD']);
  const changedPaths = changedPathsOutput ? changedPathsOutput.split(/\r?\n/).filter(Boolean) : [];

  return changedPaths.some((changedPath) => {
    return (
      changedPath === 'i18n/source/translations.json' ||
      changedPath.startsWith('i18n/config/') ||
      changedPath.startsWith('i18n/bin/') ||
      changedPath.startsWith('i18n/src/') ||
      changedPath === '.github/workflows/buildTranslations.yml' ||
      changedPath === '.github/workflows/processTranslationUploads.yml'
    );
  });
}

function waitForGithubActions(targetSha) {
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
    sleep(POLL_INTERVAL);
    elapsed += POLL_INTERVAL;
  }

  process.stdout.write('\n');
  console.log(`No matching workflow run was found within ${MAX_WAIT_SECONDS}s.`);
  return false;
}

async function readCommitMessage() {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  return new Promise((resolve) => {
    rl.question('Commit message: ', (answer) => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

async function main() {
  const currentBranch = capture('git', ['rev-parse', '--abbrev-ref', 'HEAD']);

  console.log('\n==> Step 1/5: Building translations locally');
  run(process.execPath, ['i18n/bin/build-translations.js']);

  console.log('\n==> Step 2/5: Enter commit message');
  const message = await readCommitMessage();

  if (!message) {
    console.log('No commit message filled in.');
    process.exit(1);
  }

  run('git', ['add', '.']);

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

  if (shouldWaitForWorkflow && waitForGithubActions(pushedSha)) {
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

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
