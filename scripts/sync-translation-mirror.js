#!/usr/bin/env node

const crypto = require('crypto');
const fs = require('fs/promises');
const path = require('path');

const ROOT_DIR = path.resolve(__dirname, '..');
const LANGUAGES = ['en', 'fr', 'nl'];
const REPOSITORY = 'PRAxISDEVELOPMENT/mypraxis_translation_keys';
const BRANCH = 'main';
const GENERATED_DIR = path.join(ROOT_DIR, 'i18n', 'artifacts', 'generated');
const RAW_BASE_URL = `https://raw.githubusercontent.com/${REPOSITORY}/${BRANCH}/i18n/artifacts/generated`;
const CDN_BASE_URL = `https://cdn.jsdelivr.net/gh/${REPOSITORY}@${BRANCH}/i18n/artifacts/generated`;
const PURGE_BASE_URL = `https://purge.jsdelivr.net/gh/${REPOSITORY}@${BRANCH}/i18n/artifacts/generated`;
const REQUEST_TIMEOUT_MS = 15_000;
const ORIGIN_ATTEMPTS = 12;
const CDN_ATTEMPTS = 12;
const RETRY_DELAY_MS = 5_000;

function sleep(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

function checksum(content) {
  return crypto.createHash('sha256').update(content).digest('hex');
}

function shortChecksum(content) {
  return checksum(content).slice(0, 12);
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

      if (checksum(content) === checksum(expectedContent)) {
        return content;
      }

      lastError = new Error(
        `${label} has checksum ${shortChecksum(content)} instead of ${shortChecksum(expectedContent)}`
      );
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

async function purge(url) {
  const response = await fetch(url, {
    headers: {
      accept: 'application/json'
    },
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS)
  });

  if (!response.ok) {
    throw new Error(`${url} returned HTTP ${response.status}`);
  }
}

async function syncLanguage(language) {
  const filename = `${language}.json`;
  const localPath = path.join(GENERATED_DIR, filename);
  const localContent = await fs.readFile(localPath);
  const rawUrl = `${RAW_BASE_URL}/${filename}`;
  const cdnUrl = `${CDN_BASE_URL}/${filename}`;
  const purgeUrl = `${PURGE_BASE_URL}/${filename}`;

  assertValidJson(localContent, localPath);
  console.log(`\n${filename}: local checksum ${shortChecksum(localContent)}`);

  // Never purge jsDelivr until GitHub Raw proves that the replacement object is
  // available. This preserves the last good CDN copy during an origin outage.
  await waitForMatchingContent(rawUrl, localContent, ORIGIN_ATTEMPTS, `GitHub Raw ${filename}`);
  console.log(`  GitHub Raw ${filename} is current.`);

  try {
    await waitForMatchingContent(cdnUrl, localContent, 1, `jsDelivr ${filename}`);
    console.log(`  jsDelivr ${filename} is already current.`);
    return;
  } catch (error) {
    console.log(`  jsDelivr ${filename} needs refresh: ${error.message}`);
  }

  await purge(purgeUrl);
  console.log(`  jsDelivr ${filename} purge requested.`);

  await waitForMatchingContent(cdnUrl, localContent, CDN_ATTEMPTS, `jsDelivr ${filename}`);
  console.log(`  jsDelivr ${filename} refreshed and verified.`);
}

async function main() {
  console.log('Verifying generated translation files against GitHub Raw and jsDelivr.');

  const results = await Promise.allSettled(LANGUAGES.map((language) => syncLanguage(language)));
  const failures = results
    .map((result, index) => ({ result, language: LANGUAGES[index] }))
    .filter(({ result }) => result.status === 'rejected');

  if (failures.length > 0) {
    for (const { language, result } of failures) {
      console.error(`\n${language}.json failed: ${result.reason.message}`);
    }

    throw new Error(`${failures.length} translation mirror check(s) failed.`);
  }

  console.log('\nTranslation CDN mirror is current.');
}

main().catch((error) => {
  console.error(`\nTranslation CDN mirror sync failed: ${error.message}`);
  process.exit(1);
});
