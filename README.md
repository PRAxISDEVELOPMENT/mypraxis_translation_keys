# mypraxis_translation_keys

Central translation source and automation pipeline for MyPRAxIS.

This repo has 1 source of truth:
- [`i18n/translations.json`](i18n/translations.json)

Everything else is validation, generation, or upload automation around that file.

## Core Rules

- Keys must be unique.
- Editors never choose keys or namespaces.
- Existing keys may be updated directly.
- New entries always go through a proposal branch and PR review.
- Generated files in [`i18n/generated`](i18n/generated) are never edited manually.

## File Overview

### Source and config

- [`i18n/translations.json`](i18n/translations.json)
  Flat source file with every translation entry.

- [`i18n/namespaces.json`](i18n/namespaces.json)
  Allowed namespace list and the default namespace.

- [`i18n/translations.schema.json`](i18n/translations.schema.json)
  Editor schema for the source file.

- [`i18n/upload.schema.json`](i18n/upload.schema.json)
  Schema for editor upload payloads.

### Scripts

- [`update.sh`](update.sh)
  Simple local developer flow: build, commit, push, wait for GitHub Actions, pull latest back.

- [`i18n/buildTranslations.js`](i18n/buildTranslations.js)
  Validates the source, blocks duplicate keys and bad namespaces, and generates runtime files plus reporting artifacts.

- [`i18n/processUpload.js`](i18n/processUpload.js)
  Takes editor uploads and splits them into:
  existing-key direct updates, or new-entry proposals.

- [`i18n/processUploadInbox.js`](i18n/processUploadInbox.js)
  Processes queued upload JSON files from the inbox directories the same way GitHub Actions does.

### Generated output

- [`i18n/generated/nl.json`](i18n/generated/nl.json)
- [`i18n/generated/fr.json`](i18n/generated/fr.json)
- [`i18n/generated/en.json`](i18n/generated/en.json)
  Runtime locale files consumed by the application.

- [`i18n/generated/keys.json`](i18n/generated/keys.json)
  Flat key list for lookups and tooling.

- [`i18n/generated/namespaces.json`](i18n/generated/namespaces.json)
  Namespace summary with key counts.

- [`i18n/generated/registry.json`](i18n/generated/registry.json)
  Per-key registry with metadata, duplicates, and missing locale info.

- [`i18n/generated/summary.json`](i18n/generated/summary.json)
  Compact health summary for dashboards and CI.

### GitHub workflows

- [`.github/workflows/buildTranslations.yml`](.github/workflows/buildTranslations.yml)
  Validates scripts and rebuilds generated translation files.

- [`.github/workflows/processTranslationUploads.yml`](.github/workflows/processTranslationUploads.yml)
  Processes editor-upload payloads committed from the frontend.

### Files that cannot contain inline comments

These files are explained here in the README because JSON does not support comments:

- [`i18n/translations.json`](i18n/translations.json)
- [`i18n/namespaces.json`](i18n/namespaces.json)
- [`i18n/upload.schema.json`](i18n/upload.schema.json)
- [`i18n/translations.schema.json`](i18n/translations.schema.json)
- [`package.json`](package.json)

## Namespaces

Allowed namespaces today:

- `applicationNames`
- `authentication`
- `common`
- `error`
- `info`
- `metadata`
- `success`

Use them like this:

- `common.*`
  Generic UI labels, buttons, field names, reusable text.

- `info.*`
  Help text, explanation, onboarding, instructions.

- `error.*`
  Error labels and failure messages.

- `success.*`
  Success messages and completed-state feedback.

- `authentication.*`
  Login, token, verification, auth-related text.

- `applicationNames.*`
  Product or application names.

- `metadata.*`
  Page titles and meta descriptions.

If no stronger namespace fits, use `common.*`.

## Commands

### Developer flow

```bash
npm run build:translations
```

Validates the source and rewrites generated files.

```bash
npm run check:translations
```

Checks whether generated files are already in sync.

```bash
npm run validate:translations
```

Fails on warnings and errors.

```bash
npm run report:translations
```

Prints a compact health report.

```bash
npm run namespaces:translations
```

Prints the configured namespaces.

```bash
npm run update
```

Local end-to-end developer flow: build, commit, push, wait, pull.

### Upload flow

```bash
npm run prepare:upload -- --input ./upload.json --report ./upload.report.json
```

Classifies an upload into direct updates and proposals.

```bash
npm run prepare:upload -- --input ./upload.json --report ./upload.report.json --apply-direct
```

Does the same, but also applies safe direct updates immediately.

```bash
npm run apply:proposals -- --input ./upload.report.json
```

Accepts the proposals from a previously generated report.

```bash
npm run process:upload-inbox -- --mode direct
```

Processes queued uploads meant for `main`.

```bash
npm run process:upload-inbox -- --mode proposal
```

Processes queued uploads meant for proposal branches.

## Developer Flow

For devs working in editor:

1. Edit [`i18n/translations.json`](i18n/translations.json) and, if needed, [`i18n/namespaces.json`](i18n/namespaces.json).
2. Run `npm run build:translations`.
3. Review generated files in [`i18n/generated`](i18n/generated).
4. Commit and push.

This is the only flow where keys and namespaces are edited directly.

## Editor Flow

Editors work from your application, not directly in the source file.

### Existing key update

Use this when the translation key already exists.

- The payload includes the fixed `key`.
- Only `nl`, `fr`, and `en` may change.
- The payload is committed to [`i18n/uploads/incoming`](i18n/uploads/incoming) on `main`.
- GitHub Actions processes it and applies the locale changes directly.

Example:

```json
{
  "entries": [
    {
      "key": "common.save",
      "fr": "Enregistrer"
    }
  ]
}
```

### New translation proposal

Use this when the editor adds new text without a key.

- The payload does not include a `key`.
- The system suggests a namespace from the existing namespace list.
- The system suggests a key.
- The payload is committed to [`i18n/uploads/incoming`](i18n/uploads/incoming) on a branch like `translation-proposals/<id>`.
- A PR is opened to `main`.
- Devs review the proposed key, namespace, and app usage before merge.

Example:

```json
{
  "entries": [
    {
      "nl": "Tijdelijke bellijst",
      "en": "Temporary call list"
    }
  ]
}
```

## Validation Rules

[`i18n/buildTranslations.js`](i18n/buildTranslations.js) enforces these rules:

- missing or invalid keys are errors
- unknown namespaces are errors
- duplicate keys are errors
- invalid nested key conflicts are errors
- missing locale values are warnings
- restricted namespaces are warnings

Important:

- If a key is duplicated, the build fails.
- If a locale value is empty, the build still works but reports a warning.
- `nl` and `fr` fall back to `en` when possible in generated runtime output.

## Upload Payload Rules

[`i18n/processUpload.js`](i18n/processUpload.js) enforces these rules:

- direct updates must use an existing non-empty key
- direct updates may only contain `key`, `nl`, `fr`, `en`
- proposal entries may not contain a key
- proposal entries may only contain `nl`, `fr`, `en`, `description`, `notes`
- namespace suggestions are limited to namespaces that already exist in [`i18n/namespaces.json`](i18n/namespaces.json)

## Inbox Directories

- [`i18n/uploads/incoming`](i18n/uploads/incoming)
  Frontend-uploaded payloads waiting to be processed.

- [`i18n/uploads/processed`](i18n/uploads/processed)
  Archived payloads after processing.

- [`i18n/upload-reports`](i18n/upload-reports)
  JSON reports written by upload processing.

## Production Model

- developers own keys and namespaces
- editors only submit locale content
- direct existing-key updates can go to `main`
- new entries must go through `translation-proposals/*` and PR review
