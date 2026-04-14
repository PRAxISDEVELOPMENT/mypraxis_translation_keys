# MyPRAxIS Translation Keys

Central repository for MyPRAxIS translation content, validation, artifact generation, upload processing, and proposal automation.

> [!IMPORTANT]
> The single source of truth is [i18n/source/translations.json](i18n/source/translations.json).
> Files under [i18n/artifacts/generated/](i18n/artifacts/generated/) are generated output.

## What This Repository Does

This project solves four separate problems in one place:

1. Store canonical translation data.
2. Validate keys, namespaces, applications, and locale completeness.
3. Generate runtime JSON artifacts for consumers.
4. Process editor or frontend uploads for both existing keys and newly proposed keys.

The repository deliberately separates direct edits from structural translation changes:

- Existing keys are updated directly.
- New keys are treated as proposals and routed through review.

That distinction keeps normal editorial work fast while still protecting key structure.

## Operating Model

### Existing key update

When an upload includes an existing `key`:

- the update is classified as a direct update
- safe locale changes are applied to `main`
- generated artifacts are rebuilt
- the upload is archived

### New key proposal

When an upload does not include a `key`:

- the upload is classified as a proposal
- a namespace and key suggestion are generated
- the proposal is processed on a `translation_proposals/*` branch
- GitHub opens or updates a PR to `main`

### Mixed upload batch

One upload file may contain both:

- updates for existing keys
- new translation entries

The router splits those into separate direct and proposal batches automatically.

## Repository Structure

```text
i18n/
├── artifacts/
│   ├── generated/            # generated runtime and metadata files
│   └── reports/              # upload and routing reports
├── bin/                      # CLI entry points
├── config/                   # namespaces, applications, and schemas
├── source/                   # canonical translation source
├── src/
│   ├── core/                 # shared helpers and IO
│   ├── translation-build/    # validation and artifact generation
│   └── upload-processing/    # upload classification, routing, and proposals
└── uploads/
    ├── incoming/             # queued upload payloads
    └── processed/            # archived processed payloads

.github/
├── pull_request_template.md
└── workflows/
    ├── buildTranslations.yml
    ├── openTranslationProposalPr.yml
    └── processTranslationUploads.yml

scripts/
└── update-translations.sh
```

## Core Files

- [i18n/source/translations.json](i18n/source/translations.json)
  Canonical translation entries.
- [i18n/config/namespaces.json](i18n/config/namespaces.json)
  Allowed namespaces and default namespace.
- [i18n/config/applications.json](i18n/config/applications.json)
  Allowed application identifiers.
- [i18n/config/upload.schema.json](i18n/config/upload.schema.json)
  Upload payload shape for editor or frontend integrations.
- [i18n/bin/build-translations.js](i18n/bin/build-translations.js)
  Validation and artifact generation CLI.
- [i18n/bin/process-upload.js](i18n/bin/process-upload.js)
  Single upload prepare and proposal-apply CLI.
- [i18n/bin/process-upload-inbox.js](i18n/bin/process-upload-inbox.js)
  Batch inbox processor.
- [i18n/bin/route-upload-batches.js](i18n/bin/route-upload-batches.js)
  Mixed-batch router.
- [i18n/bin/simulate-upload.js](i18n/bin/simulate-upload.js)
  Local helper for app-style upload simulation.

## Local Development

### Install

```bash
npm install
npm run tooling:check-syntax
```

### Build translations

```bash
npm run translations:build
```

### Validate without writing artifacts

```bash
npm run translations:check
npm run translations:validate
```

### Generate a detailed report

```bash
npm run translations:report
```

## Upload Processing

### Upload payload shape

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
      "en": "New button"
    }
  ]
}
```

Rules:

- Include `key` only for existing translation keys.
- Omit `key` for new translation proposals.
- Locale fields supported today are `nl`, `fr`, and `en`.
- Proposal entries may also include `description` and `notes`.

### Inspect a single upload

```bash
npm run uploads:prepare -- --input path/to/upload.json
```

### Route mixed upload batches

```bash
npm run uploads:route
```

### Process inbox batches

```bash
npm run uploads:process-inbox -- --mode direct
npm run uploads:process-inbox -- --mode proposal
```

## Frontend And App Testing

Use the simulate helper when you want to test the same classification and inbox flow locally without hand-writing files in `i18n/uploads/incoming`.

### Simulate an existing key update

```bash
npm run uploads:simulate -- edit --key common.save --fr "Enregistrer depuis l'app"
```

### Simulate a new translation proposal

```bash
npm run uploads:simulate -- new --nl "Nieuwe knop" --fr "Nouveau bouton" --en "New button"
```

Both commands default to `dry run`.

Add `--apply` if you want the change applied locally to:

- [i18n/source/translations.json](i18n/source/translations.json)
- [i18n/artifacts/generated/](i18n/artifacts/generated/)

Examples:

```bash
npm run uploads:simulate -- edit --key common.save --fr "Enregistrer depuis l'app" --apply
npm run uploads:simulate -- new --nl "Nieuwe knop" --fr "Nouveau bouton" --en "New button" --apply
```

## Automation

This repository uses four GitHub Actions workflows:

- [.github/workflows/buildTranslations.yml](.github/workflows/buildTranslations.yml)
  Validates source changes and regenerates artifacts on `main`.
- [.github/workflows/processTranslationUploads.yml](.github/workflows/processTranslationUploads.yml)
  Routes and processes incoming uploads.
- [.github/workflows/openTranslationProposalPr.yml](.github/workflows/openTranslationProposalPr.yml)
  Opens or updates proposal PRs for new keys.
- [.github/workflows/backupRepository.yml](.github/workflows/backupRepository.yml)
  Creates scheduled repository backups and can mirror the repository to a separate backup remote.

### Proposal PR behavior

Proposal branches target `main` and are automatically prepared for review:

- labels are applied
- reviewers and assignees may be requested through repository variables
- report files are summarized in the PR body

Repository variables used by the PR automation:

- `TRANSLATION_PROPOSAL_REVIEWERS`
- `TRANSLATION_PROPOSAL_TEAM_REVIEWERS`
- `TRANSLATION_PROPOSAL_ASSIGNEES`

## Backups

Automatic backups are supported.

The repository now includes a scheduled backup workflow in [.github/workflows/backupRepository.yml](.github/workflows/backupRepository.yml).

What it does:

- creates a full `git bundle` backup on a schedule
- uploads that bundle as a workflow artifact
- optionally mirrors the entire repository to a separate private backup repository

Important:

- an artifact stored inside the same GitHub repository is convenient, but it is not enough as sole disaster recovery if the repository itself is deleted
- the safe setup is a second private backup repository

Recommended configuration:

1. Create a separate private GitHub repository dedicated to backups.
2. Prefer SSH deploy-key mirroring for the backup repository.
3. Add one of these secret sets in the main repository.

Preferred SSH setup:
   `BACKUP_REPO_SSH_URL`
   SSH URL of the backup repository, for example `git@github.com:<owner>/<repo>.git`
   `BACKUP_REPO_SSH_KEY`
   Private SSH key whose public key is added as a write-enabled deploy key on the backup repository

Fallback HTTPS setup:
   `BACKUP_REPO_URL`
   HTTPS URL of the private backup repository, for example `https://github.com/<owner>/<repo>.git`
   `BACKUP_REPO_TOKEN`
   A token with write access only to that backup repository
   `BACKUP_REPO_USERNAME`
   GitHub username that owns the token
4. Leave the schedule as-is or adjust the cron expression in the workflow.

If mirror secrets are not configured, the workflow still creates a bundle artifact, but that should be treated as convenience only, not as your final safety net.

## Command Reference

| Command | Purpose |
| --- | --- |
| `npm run translations:build` | Validate source and regenerate derived files |
| `npm run tooling:check-syntax` | Syntax-check all Node CLI and implementation files |
| `npm run help` | Print the main translation help output |
| `npm run translations:check` | Verify generated artifacts are in sync |
| `npm run translations:validate` | Fail on warnings or errors |
| `npm run translations:report` | Print a full validation report |
| `npm run translations:list-namespaces` | List configured namespaces |
| `npm run uploads:help` | Print help for single-upload processing |
| `npm run uploads:prepare -- --input <file>` | Analyze one upload payload |
| `npm run uploads:apply-proposals -- --input <report-file>` | Apply proposals from a report |
| `npm run uploads:process-inbox:help` | Print help for inbox processing |
| `npm run uploads:route` | Split mixed upload files into direct and proposal batches |
| `npm run uploads:route:help` | Print help for upload routing |
| `npm run uploads:process-inbox -- --mode direct` | Process direct-update batches |
| `npm run uploads:process-inbox -- --mode proposal` | Process proposal batches |
| `npm run uploads:simulate -- edit ...` | Simulate an existing-key app upload |
| `npm run uploads:simulate -- new ...` | Simulate a new-key app upload |
| `npm run uploads:simulate:help` | Print help for upload simulation |
| `npm run update` | Build, commit, push, and sync the current branch |

## Operational Rules

- Never edit files under `i18n/artifacts/generated/` manually.
- Keep `i18n/source/translations.json` as the canonical source.
- Direct updates must use existing keys only.
- New keys must enter through the proposal path.
- Every entry must use an allowed namespace.
- Every entry must include at least one allowed application.

## Practical Notes

- If a `dry run` succeeds, the payload shape and classification are valid.
- If `--apply` succeeds, the local source and generated artifacts have been updated.
- A warning about missing locale values does not block artifact generation unless validation mode is stricter.
- The `simulate` helper tests the repository upload pipeline, not the frontend UI itself.

## Summary

If you remember only the model:

- source lives in `i18n/source/`
- rules live in `i18n/config/`
- logic lives in `i18n/src/`
- entry points live in `i18n/bin/`
- runtime output lives in `i18n/artifacts/generated/`
- upload state lives in `i18n/uploads/`

That separation is what keeps the system predictable and automatable.
