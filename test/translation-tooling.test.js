const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const test = require('node:test');

const ROOT_DIR = path.resolve(__dirname, '..');
const {
  readApplicationConfig,
  readNamespaceConfig
} = require('../i18n/src/core/config-loader');
const { readSourceEntries } = require('../i18n/src/core/source-entries');
const {
  APPLICATION_CONFIG_PATH,
  OUTPUT_DIR
} = require('../i18n/src/core/path-config');
const {
  checkArtifacts,
  generateArtifacts
} = require('../i18n/src/translation-build/artifact-files');
const { collectIssues } = require('../i18n/src/translation-build/issue-analysis');
const { parseArgs } = require('../i18n/src/translation-build/cli-options');
const {
  buildSuggestedKey,
  getDefaultProposalApplications
} = require('../i18n/src/upload-processing/key-suggestions');
const {
  parseProcessUploadInboxArgs
} = require('../i18n/src/upload-processing/inbox-cli-options');
const {
  parseProcessUploadArgs
} = require('../i18n/src/upload-processing/cli-options');
const {
  touchesBuildWorkflowPaths
} = require('../scripts/update-translations');

function readJson(relativePath) {
  return JSON.parse(fs.readFileSync(path.join(ROOT_DIR, relativePath), 'utf8'));
}

test('canonical translation source passes all validation rules', () => {
  const entries = readSourceEntries();
  const namespaceConfig = readNamespaceConfig();
  const applicationConfig = readApplicationConfig();
  const { errors, warnings } = collectIssues(entries, namespaceConfig, applicationConfig);

  assert.deepEqual(errors, []);
  assert.deepEqual(warnings, []);
});

test('committed generated artifacts match the canonical source', () => {
  const entries = readSourceEntries();
  const namespaceConfig = readNamespaceConfig();
  const applicationConfig = readApplicationConfig();
  const { errors, warnings } = collectIssues(entries, namespaceConfig, applicationConfig);
  const artifacts = generateArtifacts(
    entries,
    namespaceConfig,
    applicationConfig,
    warnings,
    errors,
    {
      sourceFile: 'i18n/source/translations.json',
      namespaceFile: 'i18n/config/namespaces.json',
      applicationFile: 'i18n/config/applications.json'
    }
  );

  assert.deepEqual(checkArtifacts(artifacts), []);
});

test('translation schema application enum stays aligned with applications.json', () => {
  const schema = readJson('i18n/config/translations.schema.json');
  const configuredApplications = readJson(
    path.relative(ROOT_DIR, APPLICATION_CONFIG_PATH)
  ).applications.map((application) => application.name);
  const schemaApplications = schema.items.properties.applications.items.enum;

  assert.deepEqual(new Set(schemaApplications), new Set(configuredApplications));
});

test('VS Code schemas point at the canonical source and upload inbox', () => {
  const settings = readJson('.vscode/settings.json');
  const mappings = new Map(
    settings['json.schemas'].map((schema) => [schema.url, schema.fileMatch])
  );

  assert.deepEqual(mappings.get('./i18n/config/translations.schema.json'), [
    '/i18n/source/translations.json'
  ]);
  assert.deepEqual(mappings.get('./i18n/config/upload.schema.json'), [
    '/i18n/uploads/incoming/*.json'
  ]);
});

test('proposal defaults and key suggestions preserve the existing public behavior', () => {
  const applicationConfig = readApplicationConfig();
  const namespaceConfig = readNamespaceConfig();
  const usedKeys = new Set(['common.auditTest']);
  const result = buildSuggestedKey(
    {
      en: 'Audit test',
      requestedNamespace: 'common'
    },
    usedKeys,
    namespaceConfig
  );

  assert.deepEqual(getDefaultProposalApplications(applicationConfig), ['mypraxis_web']);
  assert.equal(result.suggestedKey, 'common.auditTest2');
  assert.equal(result.namespaceSuggestion.confidence, 'requested');
});

test('upload inbox CLI rejects invalid modes and unknown options', () => {
  assert.throws(() => parseProcessUploadInboxArgs(['--mode', 'mixed']), /Mode must be/);
  assert.throws(() => parseProcessUploadInboxArgs(['--wat']), /Unknown option/);
  assert.throws(() => parseProcessUploadInboxArgs(['--uploads-dir']), /requires a value/);
  assert.throws(() => parseProcessUploadArgs(['prepare', '--input']), /requires a value/);
});

test('translation build CLI rejects typos and incompatible modes', () => {
  assert.throws(() => parseArgs(['--chek']), /Unknown option/);
  assert.throws(() => parseArgs(['--check', '--validate']), /Use only one/);
});

test('local update helper follows every build-workflow trigger path', () => {
  for (const changedPath of [
    'i18n/source/translations.json',
    'i18n/config/applications.json',
    'i18n/proposals/pending/batch.json',
    'package.json',
    'package-lock.json',
    'scripts/check-node-syntax.js',
    'test/translation-tooling.test.js'
  ]) {
    assert.equal(touchesBuildWorkflowPaths([changedPath]), true, changedPath);
  }

  assert.equal(touchesBuildWorkflowPaths(['README.md']), false);
});

test('strict validation does not rewrite generated artifacts', () => {
  const before = new Map(
    fs.readdirSync(OUTPUT_DIR)
      .filter((fileName) => fileName.endsWith('.json'))
      .map((fileName) => [fileName, fs.readFileSync(path.join(OUTPUT_DIR, fileName), 'utf8')])
  );
  const result = spawnSync(process.execPath, ['i18n/bin/build-translations.js', '--validate'], {
    cwd: ROOT_DIR,
    encoding: 'utf8'
  });

  assert.equal(result.status, 0, result.stderr || result.stdout);

  for (const [fileName, content] of before) {
    assert.equal(fs.readFileSync(path.join(OUTPUT_DIR, fileName), 'utf8'), content);
  }
});

test('direct-update and proposal upload simulations complete as dry runs', () => {
  const cases = [
    ['edit', '--key', 'common.save', '--fr', 'Audit test value'],
    [
      'new',
      '--nl',
      'Audit test',
      '--fr',
      'Test audit',
      '--en',
      'Audit test',
      '--requested-namespace',
      'common'
    ]
  ];

  for (const args of cases) {
    const result = spawnSync(process.execPath, ['i18n/bin/simulate-upload.js', ...args], {
      cwd: ROOT_DIR,
      encoding: 'utf8'
    });

    assert.equal(result.status, 0, result.stderr || result.stdout);
    assert.match(result.stdout, /Dry run:\s+yes/);
  }
});

test('all client templates use the same CDN fallback, logging, and refresh policy', () => {
  const templatePaths = [
    'templates/javascript/web/i18n.js',
    'templates/typescript/web/i18n.ts',
    'templates/javascript/expo/i18n.js',
    'templates/typescript/expo/i18n.ts'
  ];

  for (const templatePath of templatePaths) {
    const content = fs.readFileSync(path.join(ROOT_DIR, templatePath), 'utf8');

    assert.match(content, /praxis-translations\.development-3e6\.workers\.dev/);
    assert.match(content, /raw\.githubusercontent\.com/);
    assert.match(content, /cache: 'no-cache'/);
    assert.match(content, /Trying translation source/);
    assert.match(content, /Loaded translations from/);
    assert.match(content, /Translation source failed/);
    assert.doesNotMatch(content, /5 \* 60 \* 1000/);
  }

  for (const templatePath of templatePaths.filter((templatePath) => templatePath.includes('/web/'))) {
    const content = fs.readFileSync(path.join(ROOT_DIR, templatePath), 'utf8');
    assert.match(content, /reloadInterval: false/);
  }
});
