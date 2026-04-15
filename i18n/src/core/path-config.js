const path = require('path');

const I18N_DIR = path.join(__dirname, '..', '..');
const ROOT_DIR = path.join(I18N_DIR, '..');
const BIN_DIR = path.join(I18N_DIR, 'bin');
const CONFIG_DIR = path.join(I18N_DIR, 'config');
const SOURCE_DIR = path.join(I18N_DIR, 'source');
const ARTIFACTS_DIR = path.join(I18N_DIR, 'artifacts');
const PROPOSALS_DIR = path.join(I18N_DIR, 'proposals');

module.exports = {
  ROOT_DIR,
  I18N_DIR,
  BIN_DIR,
  CONFIG_DIR,
  SOURCE_DIR,
  ARTIFACTS_DIR,
  PROPOSALS_DIR,
  SOURCE_PATH: path.join(SOURCE_DIR, 'translations.json'),
  NAMESPACE_CONFIG_PATH: path.join(CONFIG_DIR, 'namespaces.json'),
  APPLICATION_CONFIG_PATH: path.join(CONFIG_DIR, 'applications.json'),
  OUTPUT_DIR: path.join(ARTIFACTS_DIR, 'generated'),
  BUILD_SCRIPT_PATH: path.join(BIN_DIR, 'build-translations.js'),
  PROCESS_UPLOAD_SCRIPT_PATH: path.join(BIN_DIR, 'process-upload.js'),
  DEFAULT_UPLOADS_DIR: path.join(I18N_DIR, 'uploads', 'incoming'),
  DEFAULT_REPORTS_DIR: path.join(ARTIFACTS_DIR, 'reports'),
  DEFAULT_PROCESSED_DIR: path.join(I18N_DIR, 'uploads', 'processed'),
  DEFAULT_PENDING_PROPOSALS_DIR: path.join(PROPOSALS_DIR, 'pending'),
  DEFAULT_PROCESSED_PROPOSALS_DIR: path.join(PROPOSALS_DIR, 'processed')
};
