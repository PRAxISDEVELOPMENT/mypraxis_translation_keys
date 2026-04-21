const { buildLeafKey, getSuggestionContext, getUploadText } = require('./upload-text');

function ensureUniqueKey(baseKey, usedKeys) {
  if (!usedKeys.has(baseKey)) {
    usedKeys.add(baseKey);
    return baseKey;
  }

  let counter = 2;

  while (true) {
    const candidate = `${baseKey}${counter}`;

    if (!usedKeys.has(candidate)) {
      usedKeys.add(candidate);
      return candidate;
    }

    counter += 1;
  }
}

function hasNamespace(namespaceConfig, namespace) {
  return namespaceConfig.namespaceMap.has(namespace);
}

function getRequestedNamespace(entry, namespaceConfig) {
  if (typeof entry?.requestedNamespace !== 'string') {
    return '';
  }

  const normalized = entry.requestedNamespace.trim();

  if (!normalized) {
    return '';
  }

  if (!hasNamespace(namespaceConfig, normalized)) {
    throw new Error(
      `Unknown requested namespace "${normalized}". Use one of the namespaces defined in i18n/config/namespaces.json.`
    );
  }

  return normalized;
}

function getDefaultProposalApplications(applicationConfig) {
  const names = applicationConfig.applications
    .filter((application) => application && typeof application === 'object')
    .filter((application) => typeof application.name === 'string' && application.name.trim() !== '')
    .map((application) => ({
      name: application.name.trim(),
      status:
        typeof application.status === 'string' && application.status.trim() !== ''
          ? application.status.trim()
          : 'active'
    }));

  const web = names.find((application) => application.name === 'mypraxis_web');

  if (web) {
    return [web.name];
  }

  const active = names.find((application) => application.status === 'active');

  if (active) {
    return [active.name];
  }

  if (names.length > 0) {
    return [names[0].name];
  }

  throw new Error('applications.json must define at least one valid application.');
}

function suggestNamespace(entry, namespaceConfig) {
  const text = getUploadText(entry);
  const context = getSuggestionContext(entry);
  const lower = context.toLowerCase();
  const defaultNamespace = hasNamespace(namespaceConfig, namespaceConfig.defaultNamespace)
    ? namespaceConfig.defaultNamespace
    : 'common';

  if (!text) {
    return {
      namespace: defaultNamespace,
      confidence: 'low',
      reason: 'No text was provided, so the default namespace was used.'
    };
  }

  const directMatches = [
    [
      'metadata',
      'high',
      'Detected page metadata wording.',
      /(page title|meta description|browser title|seo title|seo description|\bmetadata\b|titel van de pagina|meta beschrijving)/
    ],
    [
      'applicationNames',
      'high',
      'Detected a product or application name.',
      /^(mypraxis|praxis|postman|postgres|innovaphone)\b/
    ],
    [
      'authentication',
      'high',
      'Detected authentication terminology.',
      /(auth|password|login|logout|sign in|sign out|verify|verification|firebase|token|credential|multifactor|two factor|captcha|bearer|authenticator|email verification|authorization|wachtwoord|inloggen|uitloggen|verificatie|aanmelden|afmelden|mot de passe|connexion|deconnexion)/
    ],
    [
      'warning',
      'high',
      'Detected caution or risky-action wording.',
      /(\bwarning\b|\bwaarschuwing\b|\battention\b|you are about to|let op|caution|careful|risk|risico|gevaar|attention vous etes sur le point)/
    ],
    [
      'error',
      'high',
      'Detected failure or validation language.',
      /(\berror\b|cannot|invalid|failed|failure|missing|required|not found|expired|restricted|unable|forbidden|not authorized|must be|already exists|fout|ongeldig|mislukt|verlopen|verboden|manquant|invalide|echec)/
    ],
    [
      'success',
      'high',
      'Detected completed-state language.',
      /(\bsuccess\b|successfully|\badded\b|\bdeleted\b|\bchanged\b|\bupdated\b|\bsaved\b|\bimported\b|\bregistered\b|\bcompleted\b|\brefreshed\b|\bcreated\b|\bcopied\b|\bsent\b|succes|succesvol|opgeslagen|bijgewerkt|verzonden|supprime|enregistre|termine)/
    ],
    [
      'confirmation',
      'high',
      'Detected confirmation or consent wording.',
      /(\bconfirm\b|confirmation|are you sure|please confirm|sure you want to proceed|i hereby confirm|bevestig|bevestigen|bevestiging|confirmer|confirmez)/
    ],
    [
      'notification',
      'high',
      'Detected notification or alert wording.',
      /(\bnotification\b|\bnotifications\b|notify|notified|push notification|browser notification|melding|meldingen|notificatie|notificaties)/
    ],
    [
      'status',
      'medium',
      'Detected status or state wording.',
      /(\bstatus\b|verification status|state|active inactive|actief inactief|statut|toestand)/
    ],
    [
      'info',
      'medium',
      'Detected explanatory or helper copy.',
      /(^please |^to disable |^to enable |^as soon as |check the box|this means|you can|used to|intended for|before continuing|after successful|by pressing this button|raadpleeg|u kunt|dit betekent|avant de continuer)/
    ]
  ];

  for (const [namespace, confidence, reason, pattern] of directMatches) {
    if (hasNamespace(namespaceConfig, namespace) && pattern.test(lower)) {
      return {
        namespace,
        confidence,
        reason
      };
    }
  }

  if (hasNamespace(namespaceConfig, 'info') && text.length > 90) {
    return {
      namespace: 'info',
      confidence: 'medium',
      reason: 'Longer explanatory copy usually belongs in the info namespace.'
    };
  }

  return {
    namespace: hasNamespace(namespaceConfig, 'common') ? 'common' : defaultNamespace,
    confidence: text.length > 60 ? 'medium' : 'low',
    reason: 'No stronger namespace signal was detected, so common was used.'
  };
}

function buildSuggestedKey(entry, usedKeys, namespaceConfig) {
  const requestedNamespace = getRequestedNamespace(entry, namespaceConfig);
  const namespaceSuggestion = requestedNamespace
    ? {
        namespace: requestedNamespace,
        confidence: 'requested',
        reason: `Upload explicitly requested namespace "${requestedNamespace}".`
      }
    : suggestNamespace(entry, namespaceConfig);
  const baseKey = `${namespaceSuggestion.namespace}.${buildLeafKey(getUploadText(entry)) || 'newTranslation'}`;

  return {
    namespaceSuggestion,
    suggestedKey: ensureUniqueKey(baseKey, usedKeys)
  };
}

module.exports = {
  buildSuggestedKey,
  ensureUniqueKey,
  getDefaultProposalApplications,
  getRequestedNamespace,
  hasNamespace,
  suggestNamespace
};
