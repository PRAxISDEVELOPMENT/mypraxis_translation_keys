#!/usr/bin/env node

const { execFileSync } = require('child_process');
const fs = require('fs/promises');
const path = require('path');

const ROOT_DIR = path.resolve(__dirname, '..');
const LANGUAGES = ['en', 'fr', 'nl'];
const REPOSITORY = 'PRAxISDEVELOPMENT/mypraxis_translation_keys';
const GENERATED_DIR = path.join(ROOT_DIR, 'i18n', 'artifacts', 'generated');
const COMMIT = resolveCommit();
const RAW_BASE_URL = `https://raw.githubusercontent.com/${REPOSITORY}/${COMMIT}/i18n/artifacts/generated`;
const CDN_BASE_URL = `https://cdn.jsdelivr.net/gh/${REPOSITORY}@${COMMIT}/i18n/artifacts/generated`;
const REQUEST_TIMEOUT_MS = 15_000;
const AVAILABILITY_ATTEMPTS = 12;
const RETRY_DELAY_MS = 5_000;

function resolveCommit() {
  const commit =
    process.env.GITHUB_SHA ||
    execFileSync('git', ['rev-parse', 'HEAD'], {
      cwd: ROOT_DIR,
      encoding: 'utf8'
    }).trim();

  if (!/^[a-f0-9]{40}$/i.test(commit)) {
    throw new Error(`Expected a full Git commit SHA, received "${commit}".`);
  }

  return commit.toLowerCase();
}

function sleep(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

function assertValidJson(content, label) {
  try {
    JSON.parse(content.toString('utf8'));
  } catch (error) {
    throw new Error(`${label} is not valid JSON: ${error.message}`);
  }
}

async function fetchContent(url) {
  const response = await fetch(url, {
    headers: {
      accept: 'application/json',
      'cache-control': 'no-cache'
    },
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS)
  });

  if (!response.ok) {
    throw new Error(`${url} returned HTTP ${response.status}`);
  }

  return Buffer.from(await response.arrayBuffer());
}

async function waitForMatchingContent(url, expectedContent, attempts, label) {
  let lastError;

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      const content = await fetchContent(url);
      assertValidJson(content, label);

      if (content.equals(expectedContent)) {
        return content;
      }

      lastError = new Error(`${label} does not exactly match the repository file.`);
    } catch (error) {
      lastError = error;
    }

    if (attempt < attempts) {
      console.log(`  ${label} not current yet (attempt ${attempt}/${attempts}); retrying...`);
      await sleep(RETRY_DELAY_MS);
    }
  }

  throw lastError;
}

async function syncLanguage(language) {
  const filename = `${language}.json`;
  const localPath = path.join(GENERATED_DIR, filename);
  const localContent = await fs.readFile(localPath);
  const rawUrl = `${RAW_BASE_URL}/${filename}`;
  const cdnUrl = `${CDN_BASE_URL}/${filename}`;

  assertValidJson(localContent, localPath);
  console.log(`\n${filename}: checking exact file contents.`);

  await waitForMatchingContent(
    rawUrl,
    localContent,
    AVAILABILITY_ATTEMPTS,
    `GitHub Raw ${filename}`
  );
  console.log(`  GitHub Raw ${filename} matches commit ${COMMIT.slice(0, 12)}.`);

  await waitForMatchingContent(
    cdnUrl,
    localContent,
    AVAILABILITY_ATTEMPTS,
    `jsDelivr ${filename}`
  );
  console.log(`  jsDelivr ${filename} matches the same immutable commit.`);
}

async function main() {
  console.log(`Verifying immutable translation files for commit ${COMMIT}.`);

  const failures = [];

  for (const language of LANGUAGES) {
    try {
      await syncLanguage(language);
    } catch (error) {
      failures.push({ language, error });
    }
  }

  if (failures.length > 0) {
    for (const { language, error } of failures) {
      console.error(`\n${language}.json failed: ${error.message}`);
    }

    throw new Error(`${failures.length} immutable translation check(s) failed.`);
  }

  console.log('\nGitHub Raw and jsDelivr match the immutable commit exactly.');
}

main().catch((error) => {
  console.error(`\nImmutable translation verification failed: ${error.message}`);
  process.exit(1);
});
