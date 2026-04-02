const { execFileSync } = require('child_process');
const { ROOT_DIR, BUILD_SCRIPT_PATH } = require('./paths');

function runNodeScript(scriptPath, args) {
  execFileSync(process.execPath, [scriptPath, ...args], {
    cwd: ROOT_DIR,
    stdio: 'inherit'
  });
}

function runBuild() {
  runNodeScript(BUILD_SCRIPT_PATH, []);
}

module.exports = {
  runBuild,
  runNodeScript
};
