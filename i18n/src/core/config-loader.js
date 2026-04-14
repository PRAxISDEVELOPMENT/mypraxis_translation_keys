const { readJsonFile } = require('./json-files');
const {
  APPLICATION_CONFIG_PATH,
  NAMESPACE_CONFIG_PATH
} = require('./path-config');

function readConfigObject(filePath, label) {
  const parsed = readJsonFile(filePath);

  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error(`${label} must contain an object.`);
  }

  return parsed;
}

function normalizeDefinitionCollection(definitions, collectionLabel, definitionLabel) {
  if (!Array.isArray(definitions) || definitions.length === 0) {
    throw new Error(collectionLabel);
  }

  const definitionMap = new Map();

  for (const definition of definitions) {
    if (!definition || typeof definition !== 'object' || Array.isArray(definition)) {
      throw new Error(`Each ${definitionLabel} definition must be an object.`);
    }

    if (typeof definition.name !== 'string' || definition.name.trim() === '') {
      throw new Error(`Each ${definitionLabel} definition must contain a non-empty "name" string.`);
    }

    const normalizedName = definition.name.trim();

    if (definitionMap.has(normalizedName)) {
      throw new Error(`Duplicate ${definitionLabel} definition found for "${normalizedName}".`);
    }

    definitionMap.set(normalizedName, {
      name: normalizedName,
      label:
        typeof definition.label === 'string' && definition.label.trim() !== ''
          ? definition.label.trim()
          : normalizedName,
      description: typeof definition.description === 'string' ? definition.description : '',
      status:
        typeof definition.status === 'string' && definition.status.trim() !== ''
          ? definition.status.trim()
          : 'active'
    });
  }

  return definitionMap;
}

function readNamespaceConfig() {
  const parsed = readConfigObject(NAMESPACE_CONFIG_PATH, 'namespaces.json');
  const namespaceMap = normalizeDefinitionCollection(
    parsed.namespaces,
    'namespaces.json must contain a non-empty "namespaces" array.',
    'namespace'
  );

  const defaultNamespace =
    typeof parsed.defaultNamespace === 'string' && parsed.defaultNamespace.trim() !== ''
      ? parsed.defaultNamespace.trim()
      : parsed.namespaces[0].name;

  if (!namespaceMap.has(defaultNamespace)) {
    throw new Error(`defaultNamespace "${defaultNamespace}" does not exist in namespaces.json.`);
  }

  return {
    version: parsed.version ?? 1,
    defaultNamespace,
    namespaceMap,
    namespaces: Array.from(namespaceMap.values()).sort((left, right) => left.name.localeCompare(right.name))
  };
}

function readApplicationConfig() {
  const parsed = readConfigObject(APPLICATION_CONFIG_PATH, 'applications.json');
  const applicationMap = normalizeDefinitionCollection(
    parsed.applications,
    'applications.json must contain a non-empty "applications" array.',
    'application'
  );

  return {
    version: parsed.version ?? 1,
    applicationMap,
    applications: Array.from(applicationMap.values()).sort((left, right) => left.name.localeCompare(right.name))
  };
}

module.exports = {
  readNamespaceConfig,
  readApplicationConfig
};
