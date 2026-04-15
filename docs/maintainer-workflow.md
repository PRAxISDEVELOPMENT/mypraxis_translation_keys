# Maintainer Workflow Guide

This document describes how to work in the repository day to day.

## Main Responsibilities

As a maintainer, you are usually doing one of these things:

- updating canonical translation content
- validating that artifacts are in sync
- processing uploads
- reviewing proposal PRs
- keeping automation behavior understandable

## The Normal Manual Change Flow

When you edit translation content directly:

1. update [../i18n/source/translations.json](../i18n/source/translations.json)
2. run `npm run translations:build`
3. inspect changes in source and generated files
4. run `npm run translations:check`
5. commit the result

Use this flow when the change is an intentional repository edit, not an upload-driven workflow event.

## The Normal Validation Flow

Before pushing, the safest local check is:

```bash
npm run tooling:check-syntax
npm run translations:check
```

If `translations:check` fails, rebuild artifacts first:

```bash
npm run translations:build
```

## The Upload Inbox Flow

When queued uploads exist in [../i18n/uploads/incoming/](../i18n/uploads/incoming/):

```bash
npm run uploads:route
npm run uploads:process-inbox -- --mode direct
npm run uploads:process-inbox -- --mode proposal
```

Use this when you want to reproduce the automation path locally.

## The Guided Push Helper

The repository includes:

- [../scripts/update-translations.sh](../scripts/update-translations.sh)

Run it with:

```bash
npm run update
```

What it does:

1. builds translations locally
2. asks for a commit message
3. stages all current changes
4. commits and pushes the current branch
5. optionally waits for relevant GitHub Actions
6. pulls the latest remote state back locally when appropriate

Use it when you want a single interactive maintainer flow instead of separate manual git steps.

## Review Workflow For Proposal PRs

When a proposal PR appears:

1. inspect the suggested keys
2. inspect the namespace choices
3. inspect locale completeness and phrasing
4. inspect application scope
5. confirm validation is green before merge

Useful references:

- [github-automation.md](github-automation.md)
- [../.github/pull_request_template.md](../.github/pull_request_template.md)
- [../i18n/artifacts/reports/](../i18n/artifacts/reports/)
- [../i18n/proposals/pending/](../i18n/proposals/pending/)

## What Not To Edit Manually

Avoid manual edits to:

- [../i18n/artifacts/generated/](../i18n/artifacts/generated/)
- transient upload files that are only workflow state unless you are intentionally debugging the upload pipeline

The canonical source remains:

- [../i18n/source/translations.json](../i18n/source/translations.json)

New keys should be reviewed first in:

- [../i18n/proposals/pending/](../i18n/proposals/pending/)

## Troubleshooting

### Generated files are out of sync

Run:

```bash
npm run translations:build
npm run translations:check
```

### I do not know whether a change belongs in source or uploads

Use this rule:

- repository-authoritative change: edit source
- app/editor-submitted change: use upload flow

### Upload processing left confusing state behind

Inspect:

- [../i18n/uploads/incoming/](../i18n/uploads/incoming/)
- [../i18n/uploads/processed/](../i18n/uploads/processed/)
- [../i18n/artifacts/reports/](../i18n/artifacts/reports/)

### I do not know where implementation lives

Use this shortcut:

- build logic: [../i18n/src/translation-build/](../i18n/src/translation-build/)
- upload logic: [../i18n/src/upload-processing/](../i18n/src/upload-processing/)
- proposal review objects: [../i18n/proposals/pending/](../i18n/proposals/pending/)
- shared utility code: [../i18n/src/core/](../i18n/src/core/)
- command wrappers: [../i18n/bin/](../i18n/bin/)

## Recommended Reading For Maintainers

1. [../README.md](../README.md)
2. [architecture.md](architecture.md)
3. [upload-processing.md](upload-processing.md)
4. [github-automation.md](github-automation.md)

## Short Operational Model

If you need the shortest maintainer summary:

- edit source when the repository itself is the actor
- use uploads when an external editor/app is the actor
- trust generated files only as derived output
- trust automation to separate direct updates from reviewable proposal objects
