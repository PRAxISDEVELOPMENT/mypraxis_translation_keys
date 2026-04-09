#!/usr/bin/env node

// Upload inbox entry point.
// The implementation lives under i18n/src/upload-processing.

const { runProcessUploadInboxCommand } = require('../src/upload-processing/inbox-command');

try {
  runProcessUploadInboxCommand();
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
