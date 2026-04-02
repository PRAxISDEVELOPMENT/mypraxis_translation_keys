const path = require('path');

const I18N_DIR = path.join(__dirname, '..', '..');
const ROOT_DIR = path.join(I18N_DIR, '..');

module.exports = {
  ROOT_DIR,
  I18N_DIR,
  SOURCE_PATH: path.join(I18N_DIR, 'translations.json'),
  NAMESPACE_CONFIG_PATH: path.join(I18N_DIR, 'namespaces.json'),
  APPLICATION_CONFIG_PATH: path.join(I18N_DIR, 'applications.json'),
  OUTPUT_DIR: path.join(I18N_DIR, 'generated'),
  BUILD_SCRIPT_PATH: path.join(I18N_DIR, 'buildTranslations.js'),
  PROCESS_UPLOAD_SCRIPT_PATH: path.join(I18N_DIR, 'processUpload.js'),
  DEFAULT_UPLOADS_DIR: path.join(I18N_DIR, 'uploads', 'incoming'),
  DEFAULT_REPORTS_DIR: path.join(I18N_DIR, 'upload-reports'),
  DEFAULT_PROCESSED_DIR: path.join(I18N_DIR, 'uploads', 'processed')
};
