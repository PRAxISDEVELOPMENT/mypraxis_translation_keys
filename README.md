# mypraxis_translation_keys

Central translation source and generation pipeline for MyPRAxIS.

This repository keeps translations in one editable source file and automatically generates:

- runtime locale files for the application
- namespace metadata for future tooling
- a key registry for autocomplete, validation, and editor support
- an upload-processing layer for editor-submitted translation changes

## Quick Start

If you only need the normal daily workflow, use this:

```bash
npm run update
```

What it does:

1. builds translations locally
2. shows a compact validation summary
3. asks for a commit message
4. commits and pushes
5. waits for GitHub Actions when possible
6. pulls the latest generated files back

If you only want to rebuild locally:

```bash
npm run build:translations
```

If you want to process an editor upload:

```bash
npm run prepare:upload -- --input ./upload.json --report ./upload.report.json
```

If you want help in the terminal:

```bash
npm run help:translations
```

If you want a quick health report:

```bash
npm run report:translations
```

---

## What You Edit

In normal use, you usually edit only:

- [`i18n/translations.json`](i18n/translations.json)

Sometimes you may also edit:

- [`i18n/namespaces.json`](i18n/namespaces.json)

You should **not** manually edit:

- [`i18n/generated/nl.json`](i18n/generated/nl.json)
- [`i18n/generated/fr.json`](i18n/generated/fr.json)
- [`i18n/generated/en.json`](i18n/generated/en.json)
- [`i18n/generated/keys.json`](i18n/generated/keys.json)
- [`i18n/generated/namespaces.json`](i18n/generated/namespaces.json)
- [`i18n/generated/registry.json`](i18n/generated/registry.json)

Those files are generated automatically.

Editor uploads should not write directly to [`i18n/translations.json`](i18n/translations.json).
They should first go through [`i18n/processUpload.js`](i18n/processUpload.js).

---

## Daily Workflow

### Add or update translations

1. Open [`i18n/translations.json`](i18n/translations.json)
2. Add or update a translation entry
3. Run:

```bash
npm run update
```

### Only validate locally

```bash
npm run validate:translations
```

Use this when you want to catch warnings and errors before committing.

### Only check whether generated files are already correct

```bash
npm run check:translations
```

Use this when you want to verify sync without rewriting files.

### Process editor uploads

This repository now supports a split upload flow:

- existing keys can be updated directly
- new translations without a key become proposals for developer review

Prepare an upload report:

```bash
npm run prepare:upload -- --input ./upload.json --report ./upload.report.json
```

Prepare an upload and immediately merge safe updates for existing keys:

```bash
npm run prepare:upload -- --input ./upload.json --report ./upload.report.json --apply-direct
```

Accept the proposal entries from a report after review:

```bash
npm run apply:proposals -- --input ./upload.report.json
```

---

## How A Translation Entry Works

Each entry in [`i18n/translations.json`](i18n/translations.json) is a flat object.

Example:

```json
{
  "key": "common.save",
  "description": "Primary save button",
  "nl": "Opslaan",
  "fr": "Enregistrer",
  "en": "Save"
}
```

Required fields:

- `key`
- `nl`
- `fr`
- `en`

Optional fields:

- `description`
- `notes`
- `deprecated`

The generator converts this flat structure into nested runtime JSON.

Example:

```json
{
  "key": "common.save",
  "nl": "Opslaan",
  "fr": "Enregistrer",
  "en": "Save"
}
```

becomes this in [`i18n/generated/nl.json`](i18n/generated/nl.json):

```json
{
  "common": {
    "save": "Opslaan"
  }
}
```

---

## How To Choose A Key

Keys use dot notation:

```text
namespace.leaf
namespace.group.leaf
```

Good examples:

- `common.save`
- `common.delete`
- `info.helpText`
- `error.apiErrors`
- `success.customerActivated`
- `authentication.firebaseUUID`

Avoid:

- `.save`
- `save.`
- `common..save`
- `button that saves`
- using the same key for two different meanings

### Practical naming advice

- Use `common.*` for shared UI labels, buttons, form fields, and generic text
- Use `info.*` for helper text, descriptions, instructions, and hints
- Use `error.*` for error labels or failure-state text
- Use `success.*` for success confirmations
- Use `authentication.*` for login or auth-related terms
- Use `applicationNames.*` for product or app names
- Use `metadata.*` for page title and meta description content

If you are unsure, start with `common.*` only when the text is truly generic and reusable.

For editor uploads, keys are optional in the upload payload.
If the editor supplies an existing key, the upload processor treats the item as a direct update.
If no key is supplied, the upload processor suggests a namespace and a new key for review.

---

## Namespace System

Allowed namespaces are defined centrally in [`i18n/namespaces.json`](i18n/namespaces.json).

Current namespaces:

- `applicationNames`
- `authentication`
- `common`
- `error`
- `info`
- `metadata`
- `success`

Important rules:

- if you use a namespace that does not exist in [`i18n/namespaces.json`](i18n/namespaces.json), the build fails
- if you use a namespace marked as restricted, the build warns

This is how namespace governance works:

1. choose an existing namespace
2. create a clear key under that namespace
3. only add a new namespace if it is truly needed

For editor uploads, namespace suggestions are automatic.
New namespace creation should still be reviewed by developers before merge.

---

## How To Add A New Key

Example: you want to add a new reusable button label for "Cancel".

1. Decide the namespace:
   `common`, because this is generic UI text

2. Add the entry to [`i18n/translations.json`](i18n/translations.json):

```json
{
  "key": "common.cancel",
  "description": "Generic cancel button",
  "nl": "Annuleren",
  "fr": "Annuler",
  "en": "Cancel"
}
```

3. Run:

```bash
npm run build:translations
```

4. The generator updates:
   - [`i18n/generated/nl.json`](i18n/generated/nl.json)
   - [`i18n/generated/fr.json`](i18n/generated/fr.json)
   - [`i18n/generated/en.json`](i18n/generated/en.json)
   - [`i18n/generated/keys.json`](i18n/generated/keys.json)
   - [`i18n/generated/namespaces.json`](i18n/generated/namespaces.json)
   - [`i18n/generated/registry.json`](i18n/generated/registry.json)

5. If everything looks correct, run:

```bash
npm run update
```

---

## Editor Upload Flow

The editor-facing flow is intentionally different from the developer flow.

### Existing key updates

If the upload entry contains a known key:

- the key is treated as fixed
- namespace is treated as fixed
- only locale values are updated
- this path is safe to merge directly

Example upload item:

```json
{
  "key": "common.save",
  "fr": "Enregistrer"
}
```

### New translation proposals

If the upload entry does not contain a key:

- the processor suggests a namespace
- the processor suggests a new key
- the entry is placed in the proposal section of the report
- developers can review and accept it before merge

Example upload item:

```json
{
  "nl": "Tijdelijke bellijst",
  "en": "Temporary call list"
}
```

### Upload payload schema

Use [`i18n/upload.schema.json`](i18n/upload.schema.json) for editor payloads.
The payload format is intentionally lighter than the main source file.

Example payload:

```json
{
  "version": 1,
  "source": "editor-ui",
  "entries": [
    {
      "key": "common.save",
      "fr": "Enregistrer"
    },
    {
      "nl": "Tijdelijke bellijst",
      "en": "Temporary call list"
    }
  ]
}
```

### What the upload processor does

[`i18n/processUpload.js`](i18n/processUpload.js) reads the upload payload and:

- separates direct existing-key updates from new-entry proposals
- suggests a namespace for entries without a key
- suggests a new key for entries without a key
- optionally applies direct updates to [`i18n/translations.json`](i18n/translations.json)
- writes a report JSON file for review and automation

### Suggested production flow

For editors using your application:

1. editor submits upload payload
2. backend runs `npm run prepare:upload`
3. direct updates for existing keys may be auto-applied
4. proposal entries are committed on a review branch or PR
5. developers review the proposal PR
6. after merge, GitHub Actions regenerates [`i18n/generated`](i18n/generated)

For developers working in VS Code:

1. edit [`i18n/translations.json`](i18n/translations.json) or [`i18n/namespaces.json`](i18n/namespaces.json)
2. run `npm run build:translations`
3. commit and push

This keeps the developer workflow strict while keeping the editor workflow simple.

---

## Commands

### `npm run help:translations`

Shows a quick help guide in the terminal:

```bash
npm run help:translations
```

### `npm run build:translations`

Builds all generated artifacts:

```bash
npm run build:translations
```

This:

- validates the source file
- validates namespace usage
- prints a summary
- rewrites all generated files

### `npm run check:translations`

Checks whether generated files are already in sync:

```bash
npm run check:translations
```

### `npm run validate:translations`

Fails on warnings and errors:

```bash
npm run validate:translations
```

This is useful before a commit or before merging changes.

### `npm run namespaces:translations`

Prints all configured namespaces and their status:

```bash
npm run namespaces:translations
```

### `npm run report:translations`

Prints a compact translation health report:

```bash
npm run report:translations
```

This gives you:

- total source entries
- total unique keys
- namespace counts
- duplicate-key count
- missing-locale count
- warning and error totals

### `npm run update`

Runs the end-to-end local workflow:

```bash
npm run update
```

This uses [`update.sh`](update.sh).

---

## What The Generator Produces

The generator script is [`i18n/buildTranslations.js`](i18n/buildTranslations.js).

It creates two types of output.

### 1. Runtime locale files

These are the files your application should consume:

- [`i18n/generated/nl.json`](i18n/generated/nl.json)
- [`i18n/generated/fr.json`](i18n/generated/fr.json)
- [`i18n/generated/en.json`](i18n/generated/en.json)

The application should **not** read [`i18n/translations.json`](i18n/translations.json) directly.

### 2. Tooling and editor support files

These files exist for governance, autocomplete, and future editor support.

#### [`i18n/generated/keys.json`](i18n/generated/keys.json)

Contains a flat sorted list of all unique keys.

Useful for:

- autocomplete
- usage scans
- quick key lookups

#### [`i18n/generated/namespaces.json`](i18n/generated/namespaces.json)

Contains the generated namespace summary, including:

- namespace names
- labels
- descriptions
- status
- key counts

Useful for:

- namespace dropdowns
- docs
- future editor forms

#### [`i18n/generated/registry.json`](i18n/generated/registry.json)

Contains detailed metadata per unique key, including:

- namespace
- leaf segment
- source entry numbers
- duplicate counts
- missing locale info
- resolved values

Useful for:

- future editor backends
- validation reports
- usage comparison with another repo

#### [`i18n/generated/summary.json`](i18n/generated/summary.json)

Contains a compact health summary of the current translation source.

Useful for:

- dashboards
- CI reporting
- future admin overviews
- quick diagnostics without parsing the full registry

---

## Validation Rules

The build checks for:

- invalid JSON
- missing `key`
- invalid key structure
- unknown namespaces
- restricted namespaces
- duplicate keys
- missing locale values
- nested key conflicts

### Important behavior

- unknown namespaces are **errors**
- invalid structure is an **error**
- missing locale values are **warnings**
- duplicate keys are **warnings**
- restricted namespaces are **warnings**

If you run `npm run validate:translations`, warnings also become blocking.

---

## GitHub Actions

The workflow file is:

- [`.github/workflows/buildTranslations.yml`](.github/workflows/buildTranslations.yml)

It runs when these files change:

- `i18n/translations.json`
- `i18n/namespaces.json`
- `i18n/buildTranslations.js`
- `.github/workflows/buildTranslations.yml`

### On pull requests

GitHub Actions:

1. checks out the repo
2. sets up Node.js
3. runs the generator
4. checks that generated files are in sync

### On `main`

GitHub Actions:

1. rebuilds generated files
2. commits them if they changed
3. pushes the generated commit back to `main`

This means the repo can stay the single source of truth while still shipping runtime-ready locale files.

---

## VS Code Support

This repository includes:

- [`i18n/translations.schema.json`](i18n/translations.schema.json)
- [`.vscode/settings.json`](.vscode/settings.json)

That gives [`i18n/translations.json`](i18n/translations.json) better editor support in VS Code.

It helps with:

- structure awareness
- expected fields
- less guesswork when editing entries

---

## Future Editor Integration

This repo is ready to support a future translation editor.

Recommended architecture:

```text
translation editor frontend
-> backend or controlled GitHub integration
-> update translations.json in this repo
-> GitHub Actions rebuilds generated files
-> editor polls workflow status
-> main application consumes generated locale files
```

Recommended responsibility split:

This repo should own:

- source data
- namespace contract
- generator logic
- generated artifacts
- GitHub workflow

Another project should own:

- translator UI
- authentication
- save flow
- workflow polling
- user-facing success and error messages

---

## Common Problems

### 1. Unknown namespace

You added a key like:

```json
{
  "key": "random.save",
  "nl": "Opslaan",
  "fr": "Enregistrer",
  "en": "Save"
}
```

but `random` does not exist in [`i18n/namespaces.json`](i18n/namespaces.json).

Fix:

- use an existing namespace
- or deliberately add a new namespace to [`i18n/namespaces.json`](i18n/namespaces.json)

### 2. Duplicate key

Two entries use the same `key`.

Result:

- build warns
- last value wins in generated runtime files

Fix:

- merge them into one entry
- or rename one of the keys

### 3. Missing locale values

If `nl`, `fr`, or `en` is empty, the build warns.

For `nl` and `fr`, the generator falls back to English when possible.

Fix:

- fill in the missing translation values

### 4. Generated files are out of sync

Run:

```bash
npm run build:translations
```

or:

```bash
npm run update
```

### 5. Local branch is behind remote

If GitHub Actions created an extra generated commit, your branch may be behind.

Run:

```bash
git pull --rebase origin main
```

The update script already does this at the end.

---

## Best Practices

- keep keys unique
- keep values complete in all locales
- use `description` when meaning is not obvious
- use `notes` when translators need context
- prefer an existing namespace before creating a new one
- do not leave `test.*` keys in production
- treat warnings as real cleanup work

---

## Why This Setup Is Strong

This setup gives you:

- one source of truth
- generated runtime files
- namespace governance
- key registry support
- editor readiness
- GitHub automation
