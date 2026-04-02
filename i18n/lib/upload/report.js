const path = require('path');
const { ROOT_DIR } = require('../shared/paths');

function createReportSkeleton(command, inputPath) {
  return {
    version: 1,
    command,
    createdAt: new Date().toISOString(),
    inputFile: path.relative(ROOT_DIR, path.resolve(inputPath)),
    summary: {
      totalEntries: 0,
      directUpdates: 0,
      appliedDirectUpdates: 0,
      proposals: 0,
      skipped: 0,
      errors: 0
    },
    directUpdates: [],
    proposals: [],
    skipped: [],
    errors: []
  };
}

module.exports = {
  createReportSkeleton
};
