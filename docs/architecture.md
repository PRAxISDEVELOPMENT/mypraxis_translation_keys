# Architecture Guide

This document explains how the repository is structured, what each layer is responsible for, and where new logic should be added.

## Core Design Goal

The repository is designed to keep translation changes:

- traceable
- validated
- reproducible
- automation-friendly

The structure is intentionally strict so that source data, generated output, and operational upload state never blur together.

## System Layers

### 1. Canonical Source

Location:

- [../i18n/source/translations.json](../i18n/source/translations.json)

Responsibility:

- holds the authoritative translation entries
- acts as the single human-edited source of truth
- feeds all generated runtime artifacts

Rules:

- edit this file when you intend to change translation content directly
- keep generated files in sync after changes

### 2. Configuration

Location:

- [../i18n/config/](../i18n/config/)

Responsibility:

- defines allowed namespaces
- defines allowed applications
- defines schema expectations for source and uploads

Files to know:

- [../i18n/config/namespaces.json](../i18n/config/namespaces.json)
- [../i18n/config/applications.json](../i18n/config/applications.json)
- [../i18n/config/translations.schema.json](../i18n/config/translations.schema.json)
- [../i18n/config/upload.schema.json](../i18n/config/upload.schema.json)

### 3. Shared Core Utilities

Location:

- [../i18n/src/core/](../i18n/src/core/)

Responsibility:

- path handling
- JSON file loading and writing
- source entry loading
- upload file helpers
- config loading
- script execution helpers

Add code here when the logic is cross-cutting and used by multiple subsystems.

### 4. Translation Build Logic

Location:

- [../i18n/src/translation-build/](../i18n/src/translation-build/)

Responsibility:

- validate canonical source data
- analyze errors and warnings
- generate derived artifact files
- report repository translation health
- verify whether generated files are already in sync

This layer is responsible for deterministic build output.

### 5. Upload Processing Logic

Location:

- [../i18n/src/upload-processing/](../i18n/src/upload-processing/)

Responsibility:

- analyze upload payloads
- classify entries as direct updates or proposals
- suggest namespace/key values for new entries
- route mixed upload batches
- process inbox payloads
- generate proposal reports

This layer is operational workflow logic, not source-of-truth logic.

### 6. CLI Entry Points

Location:

- [../i18n/bin/](../i18n/bin/)

Responsibility:

- expose the implementation through stable command-line scripts
- keep argument parsing close to command execution
- stay thin and predictable

These files should remain wrappers, not business-logic dumping grounds.

### 7. Generated Runtime Output

Location:

- [../i18n/artifacts/generated/](../i18n/artifacts/generated/)

Responsibility:

- provide runtime-friendly derived translation data
- expose registry and metadata files for consumers
- reflect the canonical source plus current configuration rules

Never edit these files manually.

### 8. Operational Upload State

Location:

- [../i18n/uploads/incoming/](../i18n/uploads/incoming/)
- [../i18n/uploads/processed/](../i18n/uploads/processed/)

Responsibility:

- `incoming/` is the queue
- `processed/` is the archive

These directories describe workflow state, not canonical content.

## Architectural Boundaries

The repository works because these boundaries stay clean:

- source data is not mixed with runtime artifacts
- generated output is not treated as handwritten truth
- upload state is not treated as permanent business data
- CLI wrappers stay separate from implementation logic
- configuration stays declarative

When one of these boundaries erodes, the repository becomes harder to debug and trust.

## Data Flow

### Build Side

```text
i18n/source/translations.json
  -> validation
  -> issue analysis
  -> artifact generation
  -> i18n/artifacts/generated/*.json
```

### Upload Side

```text
upload payload
  -> schema and entry analysis
  -> direct update or proposal classification
  -> source updates and/or proposal reports
  -> generated artifacts and workflow outputs
```

## Where New Changes Belong

| If you are adding... | Put it in... |
| --- | --- |
| shared filesystem or config helper | [../i18n/src/core/](../i18n/src/core/) |
| source validation or artifact generation logic | [../i18n/src/translation-build/](../i18n/src/translation-build/) |
| upload classification or proposal logic | [../i18n/src/upload-processing/](../i18n/src/upload-processing/) |
| a new command-line entry point | [../i18n/bin/](../i18n/bin/) |
| a new repository rule or allowed values list | [../i18n/config/](../i18n/config/) |
| maintainer-facing process notes | this `docs/` directory |

## Extension Rules

When extending the system:

- keep canonical source concerns separate from workflow concerns
- prefer declarative config changes over hard-coded values
- keep generated output reproducible from source and config
- keep automation behavior legible from the workflow files
- document new behavior in both the root [README.md](../README.md) and the relevant guide under `docs/`

## Important Anchors

If you need to inspect the repo quickly, start with these:

- source: [../i18n/source/translations.json](../i18n/source/translations.json)
- config: [../i18n/config/](../i18n/config/)
- build implementation: [../i18n/src/translation-build/](../i18n/src/translation-build/)
- upload implementation: [../i18n/src/upload-processing/](../i18n/src/upload-processing/)
- command wrappers: [../i18n/bin/](../i18n/bin/)
- generated output: [../i18n/artifacts/generated/](../i18n/artifacts/generated/)
- upload state: [../i18n/uploads/](../i18n/uploads/)

## One-Line Model

If someone asks how the repo works, the shortest accurate answer is:

The repository keeps one canonical translation source, validates it, derives runtime artifacts from it, and routes uploaded changes either into safe direct updates or reviewed proposal PRs.
