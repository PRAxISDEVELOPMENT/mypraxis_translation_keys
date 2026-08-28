# Client Templates

This directory contains ready-to-copy i18n setup templates for applications that consume the generated translation files from this repository.

## Runtime Locale Files

This repository publishes three runtime locale files:

- `en.json`
- `fr.json`
- `nl.json`

Primary jsDelivr CDN URL pattern:

```text
https://cdn.jsdelivr.net/gh/PRAxISDEVELOPMENT/mypraxis_translation_keys@main/i18n/artifacts/generated/{{lng}}.json
```

Example:

```text
https://cdn.jsdelivr.net/gh/PRAxISDEVELOPMENT/mypraxis_translation_keys@main/i18n/artifacts/generated/nl.json
```

GitHub Raw remains the origin and can be used as a secondary endpoint:

```text
https://raw.githubusercontent.com/PRAxISDEVELOPMENT/mypraxis_translation_keys/main/i18n/artifacts/generated/{{lng}}.json
```

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
- they read from the jsDelivr mirror of `i18n/artifacts/generated/{{lng}}.json`
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
- bypass the browser HTTP cache while still adding a version parameter for
  explicit refreshes

The browser React templates also refresh preloaded translations every five
minutes through `i18next-http-backend`. The Expo templates intentionally do not
poll in the background; call `reloadI18nResources` after an app-initiated
translation update or from the app's own foreground/resume flow.

The repository refreshes and verifies the jsDelivr copy after generated locale
files change and every six hours. The six-hour workflow repairs missed mirror
updates; it is not the normal publication delay.

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
