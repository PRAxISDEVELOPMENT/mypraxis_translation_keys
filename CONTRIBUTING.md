# Contributing

This repository is intentionally strict.
That is a feature, not friction.

The goal is to keep translation changes easy to review, safe to automate, and predictable to maintain.

If you are new to this repository, read these first:

1. [README.md](README.md)
2. [docs/README.md](docs/README.md)
3. [docs/architecture.md](docs/architecture.md)
4. [docs/upload-processing.md](docs/upload-processing.md)

## What This Repository Is

This repository is the central system for:

- canonical translation source data
- validation rules
- generated runtime artifacts
- upload processing
- proposal pull request automation for new keys

The most important rule is:

- existing keys may be updated directly
- new keys must go through the proposal flow

## Before You Change Anything

Know the separation of responsibilities:

- [i18n/source/](i18n/source/) contains canonical translation content
- [i18n/config/](i18n/config/) contains repository rules and schemas
- [i18n/src/](i18n/src/) contains implementation logic
- [i18n/bin/](i18n/bin/) contains CLI entry points
- [i18n/artifacts/generated/](i18n/artifacts/generated/) contains generated output
- [i18n/uploads/](i18n/uploads/) contains workflow state

If you mix those responsibilities, the repository becomes harder to trust.

## Setup

Requirements:

- Node.js 20 or newer
- npm
- Git
- optionally `gh` if you use the helper workflow that watches Actions runs

Install dependencies:

```bash
npm install
```

Verify the repository locally:

```bash
npm run tooling:check-syntax
npm run translations:check
```

## Common Contribution Types

### 1. Update Existing Translation Content

Use this when the repository itself is the actor and you are intentionally editing canonical content.

Typical flow:

```bash
npm run translations:build
npm run translations:check
```

What to change:

- edit [i18n/source/translations.json](i18n/source/translations.json)
- let the build regenerate [i18n/artifacts/generated/](i18n/artifacts/generated/)

### 2. Change Validation Or Generation Logic

Start in:

- [i18n/src/translation-build/](i18n/src/translation-build/)
- [i18n/src/core/](i18n/src/core/)

Also inspect:

- [i18n/config/](i18n/config/)
- [docs/architecture.md](docs/architecture.md)

### 3. Change Upload Behavior

Start in:

- [i18n/src/upload-processing/](i18n/src/upload-processing/)
- [i18n/bin/process-upload.js](i18n/bin/process-upload.js)
- [i18n/bin/process-upload-inbox.js](i18n/bin/process-upload-inbox.js)
- [i18n/bin/route-upload-batches.js](i18n/bin/route-upload-batches.js)

Also read:

- [docs/upload-processing.md](docs/upload-processing.md)
- [docs/github-automation.md](docs/github-automation.md)

### 4. Change Automation

Start in:

- [.github/workflows/buildTranslations.yml](.github/workflows/buildTranslations.yml)
- [.github/workflows/processTranslationUploads.yml](.github/workflows/processTranslationUploads.yml)
- [.github/workflows/openTranslationProposalPr.yml](.github/workflows/openTranslationProposalPr.yml)

Also read:

- [docs/github-automation.md](docs/github-automation.md)

## Local Commands

| Command | Purpose |
| --- | --- |
| `npm run tooling:check-syntax` | syntax-check all Node tooling files |
| `npm run translations:build` | validate source and regenerate generated artifacts |
| `npm run translations:check` | confirm generated output is in sync |
| `npm run translations:report` | print the detailed validation report |
| `npm run translations:validate` | run strict validation |
| `npm run uploads:prepare -- --input <file>` | analyze one upload file |
| `npm run uploads:route` | split mixed upload batches |
| `npm run uploads:process-inbox -- --mode direct` | process direct-update inbox files |
| `npm run uploads:process-inbox -- --mode proposal` | process proposal inbox files |
| `npm run uploads:simulate -- ...` | simulate upload behavior locally |
| `npm run update` | interactive helper that builds, commits, pushes, and syncs |

## Working Rules

### Do

- treat [i18n/source/translations.json](i18n/source/translations.json) as the canonical source
- regenerate artifacts when source or validation logic changes
- keep docs aligned with repository behavior
- keep CLI wrappers thin
- keep config declarative where possible
- inspect automation impact when changing upload or generation logic

### Do Not

- do not manually edit [i18n/artifacts/generated/](i18n/artifacts/generated/)
- do not treat upload inbox files as canonical business data
- do not bypass the proposal path for genuinely new keys
- do not add logic to the wrong layer just because it is convenient

## Pull Request Expectations

A contribution should make it easy for the next reviewer to answer:

- what changed
- why it changed
- which part of the system owns that behavior
- whether generated output is intentionally updated
- whether docs were updated if behavior changed

If your change affects new translation keys, reviewers should still verify:

- suggested keys
- namespaces
- locale text
- application scope

The existing PR template in [.github/pull_request_template.md](.github/pull_request_template.md) remains part of the review contract.

## Documentation Discipline

When behavior changes:

1. update the relevant detailed guide in [docs/](docs/)
2. update [README.md](README.md) if the high-level behavior or navigation changed
3. update this file if contributor expectations changed

The docs should be usable as a map, not just a summary.

## Suggested Contribution Flow

For most code or content changes:

1. identify the owning layer
2. make the change in the correct directory
3. run the relevant local checks
4. inspect generated changes carefully
5. update docs if behavior changed
6. commit with a message that explains the actual intent

## Where To Ask Questions

- start with [README.md](README.md)
- then use [docs/README.md](docs/README.md) to find the right detailed guide
- for proposal review context, inspect [i18n/artifacts/reports/](i18n/artifacts/reports/)

## Short Version

If you only remember four rules, remember these:

- source is truth
- generated files are derived
- uploads are workflow state
- new keys require review
