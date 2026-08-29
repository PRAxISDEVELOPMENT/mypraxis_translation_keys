# Documentation Index

This directory contains the detailed reference material for the translation repository.

Use the root [README.md](../README.md) when you want the short version.
Use the documents here when you need exact responsibility boundaries, workflow details, or maintainer guidance.

## Reading Order

If someone is new to the repository, this order works best:

1. [../README.md](../README.md)
2. [architecture.md](architecture.md)
3. [upload-processing.md](upload-processing.md)
4. [github-automation.md](github-automation.md)
5. [maintainer-workflow.md](maintainer-workflow.md)
6. [cloudflare-pages.md](cloudflare-pages.md)

## Which Document Should I Read?

| If you want to understand... | Read... |
| --- | --- |
| what the repository is for | [../README.md](../README.md) |
| how contributors should work in this repository | [../CONTRIBUTING.md](../CONTRIBUTING.md) |
| how to consume the generated locale files in an app | [../templates/README.md](../templates/README.md) |
| how the system is split into source, config, logic, artifacts, and uploads | [architecture.md](architecture.md) |
| how app/editor uploads are classified and processed | [upload-processing.md](upload-processing.md) |
| how GitHub Actions, proposal PRs, and CDN publication behave | [github-automation.md](github-automation.md) |
| how to configure the fixed Cloudflare CDN URLs | [cloudflare-pages.md](cloudflare-pages.md) |
| how to work in this repo as a maintainer | [maintainer-workflow.md](maintainer-workflow.md) |

## Documentation Map

### Core Orientation

- [../README.md](../README.md)
  Main landing page with quick navigation, command guide, and project model.

- [../CONTRIBUTING.md](../CONTRIBUTING.md)
  Contributor onboarding, working rules, and expected local workflow.

- [../templates/README.md](../templates/README.md)
  Copy-ready client integration templates for consuming the generated locale files.

### Deep Reference

- [architecture.md](architecture.md)
  Explains repository boundaries, data flow, generated artifacts, and where implementation belongs.

- [upload-processing.md](upload-processing.md)
  Explains the direct-update path, proposal path, mixed-batch routing, review-object files, inbox behavior, and report output.

- [github-automation.md](github-automation.md)
  Explains what each GitHub workflow does, which branches trigger which jobs,
  how proposal PRs are created, and how Cloudflare runtime files are verified.

- [maintainer-workflow.md](maintainer-workflow.md)
  Explains everyday tasks, local validation, commit flow, sync behavior, and troubleshooting.

- [cloudflare-pages.md](cloudflare-pages.md)
  Contains the one-time Cloudflare Pages setup and final verification steps.

## Stable Shortcuts

These are the most important repository anchors:

- canonical source: [../i18n/source/translations.json](../i18n/source/translations.json)
- rules: [../i18n/config/](../i18n/config/)
- implementation: [../i18n/src/](../i18n/src/)
- CLI entry points: [../i18n/bin/](../i18n/bin/)
- generated runtime output: [../i18n/artifacts/generated/](../i18n/artifacts/generated/)
- upload state: [../i18n/uploads/](../i18n/uploads/)
- automation: [../.github/workflows/](../.github/workflows/)

## Change Discipline For Docs

When the repository behavior changes, update the docs in this order:

1. update the detailed guide in `docs/`
2. update the root [README.md](../README.md) if the high-level behavior changed
3. keep command names, directories, and operational rules identical to the implementation

The goal is that readers can trust the docs as an exact map of the repository, not a marketing summary.
