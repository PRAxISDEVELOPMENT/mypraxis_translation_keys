#!/usr/bin/env node

const fs = require('fs/promises');
const path = require('path');

const ROOT_DIR = path.resolve(__dirname, '..');
const GENERATED_DIR = path.join(ROOT_DIR, 'i18n', 'artifacts', 'generated');
const OUTPUT_DIR = path.join(ROOT_DIR, '.cloudflare-pages');
const LOCALE_FILES = ['en.json', 'fr.json', 'nl.json'];
const HEADERS = `/*.json
  Access-Control-Allow-Origin: *
  Cache-Control: public, max-age=0, must-revalidate
  Content-Type: application/json; charset=utf-8
  X-Content-Type-Options: nosniff
`;

async function main() {
  await fs.rm(OUTPUT_DIR, { recursive: true, force: true });
  await fs.mkdir(OUTPUT_DIR, { recursive: true });

  for (const filename of LOCALE_FILES) {
    const sourcePath = path.join(GENERATED_DIR, filename);
    const destinationPath = path.join(OUTPUT_DIR, filename);
    const content = await fs.readFile(sourcePath);

    JSON.parse(content.toString('utf8'));
    await fs.writeFile(destinationPath, content);
    console.log(`Prepared ${filename} for Cloudflare Pages.`);
  }

  await fs.writeFile(path.join(OUTPUT_DIR, '_headers'), HEADERS, 'utf8');
  console.log(`Cloudflare Pages output is ready in ${path.relative(ROOT_DIR, OUTPUT_DIR)}.`);
}

main().catch((error) => {
  console.error(`Could not prepare Cloudflare Pages output: ${error.message}`);
  process.exit(1);
});
