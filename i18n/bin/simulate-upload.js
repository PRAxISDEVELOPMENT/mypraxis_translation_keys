#!/usr/bin/env node

// Upload simulation entry point.
// The implementation lives under i18n/src/upload-processing.

const { runSimulateUploadCommand } = require('../src/upload-processing/simulate-command');

try {
  runSimulateUploadCommand();
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
