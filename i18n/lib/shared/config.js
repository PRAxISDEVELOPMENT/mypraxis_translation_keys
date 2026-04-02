const { readJsonFile } = require('./json');
const {
  APPLICATION_CONFIG_PATH,
  NAMESPACE_CONFIG_PATH
} = require('./paths');

function readNamespaceConfig() {
  const parsed = readJsonFile(NAMESPACE_CONFIG_PATH);

  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error('namespaces.json must contain an object.');
  }

  if (!Array.isArray(parsed.namespaces) || parsed.namespaces.length === 0) {
    throw new Error('namespaces.json must contain a non-empty "namespaces" array.');
  }

  const namespaceMap = new Map();

  for (const namespaceDefinition of parsed.namespaces) {
    if (!namespaceDefinition || typeof namespaceDefinition !== 'object' || Array.isArray(namespaceDefinition)) {
      throw new Error('Each namespace definition must be an object.');
    }

    if (typeof namespaceDefinition.name !== 'string' || namespaceDefinition.name.trim() === '') {
      throw new Error('Each namespace definition must contain a non-empty "name" string.');
    }

    const normalizedName = namespaceDefinition.name.trim();

    if (namespaceMap.has(normalizedName)) {
      throw new Error(`Duplicate namespace definition found for "${normalizedName}".`);
    }

    namespaceMap.set(normalizedName, {
      name: normalizedName,
      label:
        typeof namespaceDefinition.label === 'string' && namespaceDefinition.label.trim() !== ''
          ? namespaceDefinition.label.trim()
          : normalizedName,
      description:
        typeof namespaceDefinition.description === 'string' ? namespaceDefinition.description : '',
      status:
        typeof namespaceDefinition.status === 'string' && namespaceDefinition.status.trim() !== ''
          ? namespaceDefinition.status.trim()
          : 'active'
    });
  }

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
  const parsed = readJsonFile(APPLICATION_CONFIG_PATH);

  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error('applications.json must contain an object.');
  }

  if (!Array.isArray(parsed.applications) || parsed.applications.length === 0) {
    throw new Error('applications.json must contain a non-empty "applications" array.');
  }

  const applicationMap = new Map();

  for (const applicationDefinition of parsed.applications) {
    if (!applicationDefinition || typeof applicationDefinition !== 'object' || Array.isArray(applicationDefinition)) {
      throw new Error('Each application definition must be an object.');
    }

    if (typeof applicationDefinition.name !== 'string' || applicationDefinition.name.trim() === '') {
      throw new Error('Each application definition must contain a non-empty "name" string.');
    }

    const normalizedName = applicationDefinition.name.trim();

    if (applicationMap.has(normalizedName)) {
      throw new Error(`Duplicate application definition found for "${normalizedName}".`);
    }

    applicationMap.set(normalizedName, {
      name: normalizedName,
      label:
        typeof applicationDefinition.label === 'string' && applicationDefinition.label.trim() !== ''
          ? applicationDefinition.label.trim()
          : normalizedName,
      description:
        typeof applicationDefinition.description === 'string' ? applicationDefinition.description : '',
      status:
        typeof applicationDefinition.status === 'string' && applicationDefinition.status.trim() !== ''
          ? applicationDefinition.status.trim()
          : 'active'
    });
  }

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
