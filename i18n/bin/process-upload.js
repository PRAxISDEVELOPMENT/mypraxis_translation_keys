#!/usr/bin/env node

// Upload processing entry point.
// The implementation lives under i18n/src/upload-processing.

const { runProcessUploadCommand } = require('../src/upload-processing/command');

try {
  runProcessUploadCommand();
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
