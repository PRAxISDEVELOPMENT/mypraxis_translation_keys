#!/usr/bin/env node

const fs = require('fs/promises');
const path = require('path');

const ROOT_DIR = path.resolve(__dirname, '..');
const LANGUAGES = ['en', 'fr', 'nl'];
const REPOSITORY = 'PRAxISDEVELOPMENT/mypraxis_translation_keys';
const GENERATED_DIR = path.join(ROOT_DIR, 'i18n', 'artifacts', 'generated');
const RAW_BASE_URL = `https://raw.githubusercontent.com/${REPOSITORY}/main/i18n/artifacts/generated`;
const CDN_BASE_URL = String(
  process.env.TRANSLATION_CDN_BASE_URL ||
    'https://praxis-translations.development-3e6.workers.dev'
).replace(/\/+$/, '');
const REQUEST_TIMEOUT_MS = 15_000;
const AVAILABILITY_ATTEMPTS = 60;
const RETRY_DELAY_MS = 10_000;

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

async function readExpectedFiles() {
  return Promise.all(
    LANGUAGES.map(async (language) => {
      const filename = `${language}.json`;
      const content = await fs.readFile(path.join(GENERATED_DIR, filename));

      assertValidJson(content, filename);
      return { filename, content };
    })
  );
}

async function findMismatches(baseUrl, expectedFiles, label) {
  const results = await Promise.all(
    expectedFiles.map(async ({ filename, content: expectedContent }) => {
      try {
        const remoteContent = await fetchContent(`${baseUrl}/${filename}`);

        assertValidJson(remoteContent, `${label} ${filename}`);

        return remoteContent.equals(expectedContent)
          ? null
          : `${label} ${filename} does not exactly match the repository file`;
      } catch (error) {
        return `${label} ${filename}: ${error.message}`;
      }
    })
  );

  return results.filter(Boolean);
}

async function waitForMirror(baseUrl, expectedFiles, label) {
  let mismatches = [];

  for (let attempt = 1; attempt <= AVAILABILITY_ATTEMPTS; attempt += 1) {
    mismatches = await findMismatches(baseUrl, expectedFiles, label);

    if (mismatches.length === 0) {
      console.log(`${label} matches en.json, fr.json and nl.json exactly.`);
      return;
    }

    if (attempt < AVAILABILITY_ATTEMPTS) {
      console.log(
        `${label} is not current yet (attempt ${attempt}/${AVAILABILITY_ATTEMPTS}); retrying...`
      );
      await sleep(RETRY_DELAY_MS);
    }
  }

  throw new Error(mismatches.join('\n'));
}

async function main() {
  const expectedFiles = await readExpectedFiles();

  console.log('Verifying GitHub Raw and the Cloudflare Workers CDN.');
  console.log(`Cloudflare base URL: ${CDN_BASE_URL}`);

  await Promise.all([
    waitForMirror(RAW_BASE_URL, expectedFiles, 'GitHub Raw'),
    waitForMirror(CDN_BASE_URL, expectedFiles, 'Cloudflare Workers')
  ]);

  console.log('GitHub Raw and Cloudflare Workers contain the exact generated locale bytes.');
}

main().catch((error) => {
  console.error(`Translation CDN verification failed:\n${error.message}`);
  process.exit(1);
});
