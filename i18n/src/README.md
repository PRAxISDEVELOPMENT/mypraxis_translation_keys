# i18n/src

Implementation for the translation toolchain lives here. The CLI entry points remain in `i18n/bin/`, but the actual behavior is implemented in this directory.

## Structure

- `core/`
  Shared helpers for paths, JSON IO, config loading, entry loading, and script execution.

- `translation-build/`
  Validation, issue collection, reporting, artifact generation, and artifact sync checks.

- `upload-processing/`
  Upload preparation, direct update handling, proposal generation, inbox processing, and mixed-batch routing.

## Placement rules

- new shared utility -> `core/`
- translation validation or generation logic -> `translation-build/`
- editor upload logic -> `upload-processing/`

## Current upload-processing responsibilities

The upload-processing layer now supports:

- classification of direct updates versus proposals
- suggested namespace and key generation for new entries
- proposal review object generation and application
- inbox processing for both direct and proposal modes
- routing mixed upload batches into separate execution paths

Keep CLI parsing close to the corresponding command implementation unless the logic is shared broadly enough to belong in `core/`.
