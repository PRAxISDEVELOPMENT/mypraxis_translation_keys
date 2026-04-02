#!/usr/bin/env node

// Upload inbox entry point.
// The implementation lives under i18n/lib/upload for easier navigation.

const { runProcessUploadInboxCommand } = require('./lib/upload/inbox');

try {
  runProcessUploadInboxCommand();
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
