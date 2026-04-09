#!/usr/bin/env node

// Translation build command entry point.
// The implementation lives under i18n/src/translation-build.

const { runBuildTranslationsCommand } = require('../src/translation-build/command');

try {
  runBuildTranslationsCommand();
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
