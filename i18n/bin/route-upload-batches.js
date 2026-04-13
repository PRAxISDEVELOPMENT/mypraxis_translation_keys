#!/usr/bin/env node

// Upload routing entry point.
// The implementation lives under i18n/src/upload-processing.

const { runRouteUploadBatchesCommand } = require('../src/upload-processing/router-command');

try {
  runRouteUploadBatchesCommand();
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
