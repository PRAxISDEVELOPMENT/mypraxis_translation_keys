# Client Templates

This directory contains ready-to-copy i18n setup templates for applications that consume the generated translation files from this repository.

## Runtime Locale Files

This repository publishes three runtime locale files:

- `en.json`
- `fr.json`
- `nl.json`

The templates first resolve the current `main` commit through the public GitHub
ref API and then use that full commit SHA in both runtime URLs.

Immutable jsDelivr CDN URL pattern:

```text
https://cdn.jsdelivr.net/gh/PRAxISDEVELOPMENT/mypraxis_translation_keys@<commit-sha>/i18n/artifacts/generated/{{lng}}.json
```

Example:

```text
https://cdn.jsdelivr.net/gh/PRAxISDEVELOPMENT/mypraxis_translation_keys@5ad48951e3bd6b5e53aa6c44a85d7d0882df4b1a/i18n/artifacts/generated/nl.json
```

GitHub Raw uses the exact same commit as the secondary endpoint:

```text
https://raw.githubusercontent.com/PRAxISDEVELOPMENT/mypraxis_translation_keys/<commit-sha>/i18n/artifacts/generated/{{lng}}.json
```

Do not replace `<commit-sha>` with `main`. Mutable jsDelivr branch URLs may
serve an older branch snapshot and cannot guarantee byte-for-byte consistency.

## Included Templates

| Template | Purpose |
| --- | --- |
| [javascript/web/i18n.js](javascript/web/i18n.js) | JavaScript template for browser React apps |
| [javascript/expo/i18n.js](javascript/expo/i18n.js) | JavaScript template for Expo or React Native apps |
| [typescript/web/i18n.ts](typescript/web/i18n.ts) | TypeScript template for browser React apps |
| [typescript/expo/i18n.ts](typescript/expo/i18n.ts) | TypeScript template for Expo or React Native apps |

## Behavior

All templates are aligned with the current repository output and assumptions:

- they load `en`, `fr`, and `nl`
- they resolve `main` to one validated 40-character Git commit SHA
- they read from the immutable jsDelivr copy of `i18n/artifacts/generated/{{lng}}.json`
- they use that same SHA for the GitHub Raw fallback, so sources never mix versions
- they normalize detected locales to language-only values such as `nl` or `fr`
- they keep `fallbackLng: false` so missing translations stay visible
- they render missing translations as `(missing key) your.key.here`
- they keep `moment` in sync with the active app language

The browser React and Expo templates additionally:

- fall back from jsDelivr to GitHub Raw after a failed request, invalid JSON,
  or a five-second timeout
- notify React when refreshed resources are loaded
- export `reloadI18nResources` for an immediate refresh after an application
  has successfully changed translations
- bypass the client HTTP cache when resolving the current GitHub commit

The browser React templates also refresh preloaded translations every five
minutes through `i18next-http-backend`. The Expo templates intentionally do not
poll in the background; call `reloadI18nResources` after an app-initiated
translation update or from the app's own foreground/resume flow.

The repository verifies after generated locale changes that GitHub Raw and
jsDelivr return identical bytes for the same immutable commit. The workflow
never purges a mutable CDN cache.

Production applications that must survive a cold start while both remote
endpoints are unavailable should also keep a local last-known-good or bundled
translation file.

## Package Notes

### Web

Install the packages used by the web templates:

```bash
npm install i18next react-i18next i18next-browser-languagedetector i18next-http-backend moment
```

### Expo / React Native

Install the packages used by the Expo templates:

```bash
npm install i18next react-i18next i18next-fetch-backend expo-localization moment
```

## Important Tradeoff

The templates intentionally do not fall back from `nl` or `fr` to `en`.

That means:

- if a key is missing, your app will show `(missing key) your.key`
- if a locale value is empty or missing, you will notice it immediately

That is usually the right behavior when you want translation problems to stay visible during development and QA.
