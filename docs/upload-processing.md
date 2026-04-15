# Upload Processing Guide

This document explains how uploaded translation payloads move through the system.

## Why This Flow Exists

Uploads allow apps or editors to submit translation changes without manually editing the canonical source file.

The workflow has to solve two different cases:

- an upload changes an existing translation key
- an upload introduces a new translation that still needs a key and review

Those two cases are intentionally handled differently.

## Core Rule

- existing keys may be updated directly
- new keys must go through the proposal path

This is the single most important rule in the upload pipeline.

## Important Directories

| Directory | Meaning |
| --- | --- |
| [../i18n/uploads/incoming/](../i18n/uploads/incoming/) | queued upload files waiting to be processed |
| [../i18n/uploads/processed/](../i18n/uploads/processed/) | archived upload files that already ran through a flow |
| [../i18n/proposals/pending/](../i18n/proposals/pending/) | reviewable proposal object files waiting for approval |
| [../i18n/proposals/processed/](../i18n/proposals/processed/) | archived proposal objects that were already applied |
| [../i18n/artifacts/reports/](../i18n/artifacts/reports/) | routing and proposal report output |

## Upload Payload Contract

The upload schema lives in:

- [../i18n/config/upload.schema.json](../i18n/config/upload.schema.json)

Example payload:

```json
{
  "version": 1,
  "source": "frontend-editor",
  "entries": [
    {
      "key": "common.save",
      "nl": "Opslaan"
    },
    {
      "nl": "Nieuwe knop",
      "fr": "Nouveau bouton",
      "en": "New button",
      "description": "New scheduling CTA"
    }
  ]
}
```

Interpretation:

- entries with `key` target existing translations
- entries without `key` are treated as proposals

## Flow A: Direct Update

Use this path when the upload entry contains a known translation key.

Expected behavior:

1. the entry is recognized as a direct update
2. locale changes are validated
3. the canonical source file is updated
4. generated artifacts are rebuilt
5. the processed upload is archived

Typical examples:

- wording changes
- typo fixes
- locale text improvements for an existing key

## Flow B: Proposal

Use this path when the upload entry does not contain a known key.

Expected behavior:

1. the entry is recognized as a proposal
2. namespace and key suggestions are generated
3. one reviewable proposal file is written under [../i18n/proposals/pending/](../i18n/proposals/pending/) for that upload
4. the proposal branch workflow opens or updates a PR
5. reviewers edit that proposal file when key, applications, or locale text need adjustment
6. merge to `main` applies the final approved proposal file

Typical examples:

- new button labels
- new screen text
- new feature copy that does not yet exist in the canonical source

## Flow C: Mixed Batch

Some uploads contain both direct updates and new-key proposals.

Those files should not be processed as one undifferentiated blob.

Expected behavior:

1. the router reads the mixed file
2. direct-update entries are split into a direct subset
3. new-key entries are split into a proposal subset
4. each subset is processed in the correct execution path
5. the proposal subset still ends up in one reviewable proposal file for that subset

## Processing Stages

### Stage 1: Preparation

Command:

```bash
npm run uploads:prepare -- --input path/to/upload.json
```

Purpose:

- analyze one upload file
- validate its structure
- determine whether entries are direct updates, proposals, or mixed

### Stage 2: Routing

Command:

```bash
npm run uploads:route
```

Purpose:

- split mixed upload files into separate direct and proposal batches
- emit reports describing what happened

### Stage 3: Inbox Processing

Commands:

```bash
npm run uploads:process-inbox -- --mode direct
npm run uploads:process-inbox -- --mode proposal
```

Purpose:

- process queued direct-update files on the direct path
- turn queued proposal uploads into reviewable proposal object files on the proposal path

### Stage 4: Proposal Application

Command:

```bash
npm run proposals:apply-pending
```

Purpose:

- validate and apply reviewed proposal object files from [../i18n/proposals/pending/](../i18n/proposals/pending/)

## Local Simulation

The easiest way to understand the system locally is to simulate uploads.

### Existing Key Update

```bash
npm run uploads:simulate -- edit --key common.save --fr "Enregistrer depuis l'app"
```

### New Proposal

```bash
npm run uploads:simulate -- new --nl "Nieuwe knop" --fr "Nouveau bouton" --en "New button"
```

By default, these are dry runs.

Use `--apply` when you explicitly want the simulated result to be materialized locally.
For direct updates that means source changes.
For new proposals that means review-object files are queued locally.

## Outputs You Should Expect

Depending on the path, upload processing can modify:

- [../i18n/source/translations.json](../i18n/source/translations.json)
- [../i18n/artifacts/generated/](../i18n/artifacts/generated/)
- [../i18n/artifacts/reports/](../i18n/artifacts/reports/)
- [../i18n/proposals/pending/](../i18n/proposals/pending/)
- [../i18n/proposals/processed/](../i18n/proposals/processed/)
- [../i18n/uploads/incoming/](../i18n/uploads/incoming/)
- [../i18n/uploads/processed/](../i18n/uploads/processed/)

## Decision Shortcut

If you need a fast mental rule:

- known key present: direct update
- no key present: proposal
- both in one file: route first

## Where The Logic Lives

Start here when debugging upload behavior:

- implementation: [../i18n/src/upload-processing/](../i18n/src/upload-processing/)
- CLI wrappers: [../i18n/bin/process-upload.js](../i18n/bin/process-upload.js), [../i18n/bin/process-upload-inbox.js](../i18n/bin/process-upload-inbox.js), [../i18n/bin/route-upload-batches.js](../i18n/bin/route-upload-batches.js), [../i18n/bin/simulate-upload.js](../i18n/bin/simulate-upload.js)
- schema: [../i18n/config/upload.schema.json](../i18n/config/upload.schema.json)

## Common Failure Modes

### The upload looks valid but does not apply

Check:

- whether the key actually exists
- whether the payload matches the schema
- whether you are using the correct mode

### The file contains both known and unknown entries

Do not process it blindly.
Route it first with `npm run uploads:route`.

### I cannot tell what the system decided

Inspect:

- [../i18n/artifacts/reports/](../i18n/artifacts/reports/)
- [../i18n/uploads/processed/](../i18n/uploads/processed/)

Those directories provide the clearest operational evidence.
