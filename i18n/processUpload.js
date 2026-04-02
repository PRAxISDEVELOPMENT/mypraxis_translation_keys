#!/usr/bin/env node

// Upload processing entry point.
// The implementation lives under i18n/lib/upload for easier navigation.

const { runProcessUploadCommand } = require('./lib/upload/process');

try {
  runProcessUploadCommand();
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
