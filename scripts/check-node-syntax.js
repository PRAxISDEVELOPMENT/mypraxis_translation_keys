#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const ROOT_DIR = path.resolve(__dirname, '..');
const TARGET_DIRS = ['i18n/bin', 'i18n/src', 'scripts', 'templates/javascript'];

function collectJsFiles(dirPath) {
  const entries = fs.readdirSync(dirPath, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const fullPath = path.join(dirPath, entry.name);

    if (entry.isDirectory()) {
      files.push(...collectJsFiles(fullPath));
      continue;
    }

    if (entry.isFile() && entry.name.endsWith('.js')) {
      files.push(fullPath);
    }
  }

  return files;
}

const files = TARGET_DIRS
  .flatMap((relativeDir) => collectJsFiles(path.join(ROOT_DIR, relativeDir)))
  .sort((left, right) => left.localeCompare(right));

for (const filePath of files) {
  const result = spawnSync(process.execPath, ['--check', filePath], {
    cwd: ROOT_DIR,
    stdio: 'inherit'
  });

  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}
