const fs = require('fs');
const path = require('path');
const { ensureDirectory } = require('./json-files');

function listJsonFiles(dirPath) {
  if (!fs.existsSync(dirPath)) {
    return [];
  }

  return fs
    .readdirSync(dirPath)
    .filter((fileName) => fileName.endsWith('.json'))
    .sort((left, right) => left.localeCompare(right))
    .map((fileName) => path.join(dirPath, fileName));
}

function archiveFileWithUniqueName(filePath, targetDir) {
  ensureDirectory(targetDir);

  const parsed = path.parse(filePath);
  let targetPath = path.join(targetDir, `${parsed.name}${parsed.ext}`);
  let counter = 2;

  while (fs.existsSync(targetPath)) {
    targetPath = path.join(targetDir, `${parsed.name}-${counter}${parsed.ext}`);
    counter += 1;
  }

  fs.renameSync(filePath, targetPath);
  return targetPath;
}

module.exports = {
  archiveFileWithUniqueName,
  listJsonFiles
};
