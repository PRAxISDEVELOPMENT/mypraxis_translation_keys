#!/usr/bin/env node

// Core translation validator and generator entry point.
// The implementation lives under i18n/lib/build for easier navigation.

const { runBuildTranslationsCommand } = require('./lib/build');

try {
  runBuildTranslationsCommand();
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
