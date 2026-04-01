# mypraxis_translation_keys

Central translation source and automation pipeline for MyPRAxIS.

This repository keeps one editable source file and derives everything else from it:

- source translations
- namespace governance
- application usage metadata
- generated runtime locale files
- editor upload processing
- CI validation and sync checks

## Source Of Truth

The primary source file is:

- [`i18n/translations.json`](i18n/translations.json)

Every translation entry lives there and must define:

- `key`
- `nl`
- `fr`
- `en`
- `applications`

Optional fields:

- `description`
- `notes`
- `deprecated`

Example:

```json
{
  "key": "common.save",
  "nl": "Opslaan",
  "fr": "Enregistrer",
  "en": "Save",
  "applications": ["mypraxis_web"]
}
```

## Repository Structure

### Source And Config

- [`i18n/translations.json`](i18n/translations.json)
  Flat translation source used for all generation and validation.

- [`i18n/namespaces.json`](i18n/namespaces.json)
  Allowed namespaces and default namespace.

- [`i18n/applications.json`](i18n/applications.json)
  Allowed application identifiers, labels, descriptions, and status.

- [`i18n/translations.schema.json`](i18n/translations.schema.json)
  Editor schema for `translations.json`.

- [`i18n/upload.schema.json`](i18n/upload.schema.json)
  Schema for editor upload payloads.

### Scripts

- [`i18n/buildTranslations.js`](i18n/buildTranslations.js)
  Core validator and generator. Reads the source/config files and writes `i18n/generated/*`.

- [`i18n/processUpload.js`](i18n/processUpload.js)
  Classifies editor uploads into direct existing-key updates or new-entry proposals.

- [`i18n/processUploadInbox.js`](i18n/processUploadInbox.js)
  Batch processor for upload files already committed into the repo.

- [`update.sh`](update.sh)
  Local developer shortcut: build, commit, push, wait for GitHub Actions, pull latest back.

### Generated Files

- [`i18n/generated/nl.json`](i18n/generated/nl.json)
- [`i18n/generated/fr.json`](i18n/generated/fr.json)
- [`i18n/generated/en.json`](i18n/generated/en.json)
  Runtime locale files consumed by applications.

- [`i18n/generated/keys.json`](i18n/generated/keys.json)
  Flat list of generated keys.

- [`i18n/generated/namespaces.json`](i18n/generated/namespaces.json)
  Namespace metadata with key counts.

- [`i18n/generated/applications.json`](i18n/generated/applications.json)
  Application metadata for frontend mapping.

- [`i18n/generated/registry.json`](i18n/generated/registry.json)
  Per-key registry including namespace, applications, duplicates, missing locales, and resolved values.

- [`i18n/generated/summary.json`](i18n/generated/summary.json)
  Compact build summary for diagnostics, dashboards, and CI.

### Workflows

- [`.github/workflows/buildTranslations.yml`](.github/workflows/buildTranslations.yml)
  Validates and rebuilds translation artifacts.

- [`.github/workflows/processTranslationUploads.yml`](.github/workflows/processTranslationUploads.yml)
  Processes frontend-uploaded translation payloads.

## Core Rules

- Keys must be unique.
- Unknown namespaces are not allowed.
- Unknown applications are not allowed.
- Every entry must define at least one application.
- Generated files are never edited manually.
- Editors do not choose keys or namespaces.
- Existing keys may go directly to `main`.
- New keys always go through proposal review.

## Namespaces

Allowed namespaces:

- `applicationNames`
- `authentication`
- `common`
- `error`
- `info`
- `metadata`
- `success`

Usage guide:

- `common.*`
  Shared UI labels, buttons, field names, reusable interface text.

- `info.*`
  Explanations, help text, onboarding, contextual guidance.

- `error.*`
  Errors, failure messages, validation feedback.

- `success.*`
  Completed-state and success feedback.

- `authentication.*`
  Identity, login, token, verification, and auth-specific copy.

- `applicationNames.*`
  Product and application names.

- `metadata.*`
  Page titles and meta descriptions.

If no stronger namespace fits, use `common.*`.

## Applications

Allowed application values are defined in [`i18n/applications.json`](i18n/applications.json):

- `mypraxis_app`
- `mypraxis_web`
- `documenten`
- `mypraxis_data`

These values are validated in:

- the editor schema
- the build pipeline
- generated metadata output

This allows frontend code to map application labels from a single generated source:

- [`i18n/generated/applications.json`](i18n/generated/applications.json)

## Commands

### Build And Validate

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

Prints a compact report with namespace and application counts.

```bash
npm run namespaces:translations
```

Prints configured namespaces.

```bash
npm run update
```

Runs the local developer flow end-to-end.

### Upload Processing

```bash
npm run prepare:upload -- --input ./upload.json --report ./upload.report.json
```

Classifies one upload payload into direct updates and proposals.

```bash
npm run prepare:upload -- --input ./upload.json --report ./upload.report.json --apply-direct
```

Same as above, but immediately applies safe direct updates.

```bash
npm run apply:proposals -- --input ./upload.report.json
```

Accepts proposal entries from a report.

```bash
npm run process:upload-inbox -- --mode direct
```

Processes queued uploads intended for `main`.

```bash
npm run process:upload-inbox -- --mode proposal
```

Processes queued uploads intended for proposal branches.

### Frontend Flow Dry Runs

```bash
npm run test:frontend:direct
```

Dry-run simulation of the direct frontend flow.

```bash
npm run test:frontend:proposal
```

Dry-run simulation of the proposal frontend flow.

## Provenance And Naming

Use batch-based naming in GitHub so each translation upload is traceable and readable.

### Frontend-Created Objects

These are created by the editor frontend or its GitHub API integration.

#### Direct Update Flow

- branch
  `main`

- upload file
  `frontend_direct_batch_<batchId>.json`

- frontend commit message
  `Frontend Translation Direct Batch <batchId>`

#### Proposal Flow

- branch
  `translation_proposals/<batchId>`

- upload file
  `frontend_proposal_batch_<batchId>.json`

- pull request title
  `Translation Review Batch <batchId> (<count> entries)`

- frontend commit message
  `Frontend Translation Proposal Batch <batchId>`

- pull request body
  Include:
  - batch id
  - entry count
  - source `frontend-editor`
  - optional editor note or batch label

#### Batch Id Format

Use a stable machine-friendly id:

```text
YYYYMMDD-HHMMSS-<shortId>
```

Example:

```text
20260401-114343-gz8lix
```

That produces:

```text
branch: translation_proposals/20260401-114343-gz8lix
file:   frontend_proposal_batch_20260401-114343-gz8lix.json
pr:     Translation Review Batch 20260401-114343-gz8lix (12 entries)
```

### Bot-Created Objects

These are created by GitHub Actions after the frontend has already committed the upload payload.

- artifact regeneration commit
  `Translation Bot: Regenerate Generated Files`

- upload processing commit
  `Translation Bot: Process Upload Batch`

### Why This Format

- one batch can contain multiple unrelated entries
- names stay readable even when scopes are mixed
- frontend-created items and bot-created items are easy to distinguish
- branch, file, PR, and commit names all point back to the same batch id

## Developer Workflow

For developers working directly in the repository:

1. Edit [`i18n/translations.json`](i18n/translations.json).
2. Edit [`i18n/namespaces.json`](i18n/namespaces.json) only when a genuinely new namespace is required.
3. Keep `applications` accurate per entry.
4. Run `npm run build:translations`.
5. Review generated output in [`i18n/generated`](i18n/generated).
6. Commit and push.

This is the only flow where keys and namespaces are changed manually.

## Editor Workflow

Editors work through your application, not directly in `translations.json`.

### Existing Key Update

Use this path when the key already exists.

- upload payload includes a fixed `key`
- only `nl`, `fr`, and `en` may change
- payload is committed into [`i18n/uploads/incoming`](i18n/uploads/incoming) on `main`
- GitHub Actions processes the update automatically

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

### New Translation Proposal

Use this path when no key exists yet.

- payload does not contain a `key`
- the system suggests a namespace
- the system suggests a key
- the system assigns default applications from the repository config, currently `mypraxis_web`
- payload is committed into [`i18n/uploads/incoming`](i18n/uploads/incoming) on a branch like `translation_proposals/<batchId>`
- a PR is opened to `main`
- developers review key, namespace, applications, and usage before merge

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

[`i18n/buildTranslations.js`](i18n/buildTranslations.js) enforces:

- missing or invalid keys are errors
- unknown namespaces are errors
- unknown or missing applications are errors
- duplicate keys are errors
- nested key conflicts are errors
- missing locale values are warnings
- restricted namespaces are warnings
- duplicate application values inside one entry are warnings

Important behavior:

- duplicate keys fail the build
- missing locales do not block a normal build, but do block `validate`
- generated runtime locales fall back to `en` when `nl` or `fr` is empty

## Upload Rules

[`i18n/processUpload.js`](i18n/processUpload.js) enforces:

- direct updates must use an existing non-empty key
- direct updates may only contain `key`, `nl`, `fr`, `en`
- proposal entries may not contain a key
- proposal entries may only contain `nl`, `fr`, `en`, `description`, `notes`
- namespace suggestions only use existing namespaces

## Inbox Directories

- [`i18n/uploads/incoming`](i18n/uploads/incoming)
  Frontend-uploaded payloads waiting to be processed.

- [`i18n/uploads/processed`](i18n/uploads/processed)
  Archived payloads after processing.

- [`i18n/upload-reports`](i18n/upload-reports)
  JSON reports produced by upload processing.

## Production Model

- developers own keys, namespaces, and application usage
- editors only submit translation content
- existing-key updates may go directly to `main`
- new keys must go through `translation_proposals/*` and PR review
- frontend can read generated metadata from `registry.json`, `summary.json`, `namespaces.json`, and `applications.json`

## Notes

These files are explained in this README because JSON cannot contain inline comments:

- [`i18n/translations.json`](i18n/translations.json)
- [`i18n/namespaces.json`](i18n/namespaces.json)
- [`i18n/applications.json`](i18n/applications.json)
- [`i18n/upload.schema.json`](i18n/upload.schema.json)
- [`i18n/translations.schema.json`](i18n/translations.schema.json)
- [`package.json`](package.json)
