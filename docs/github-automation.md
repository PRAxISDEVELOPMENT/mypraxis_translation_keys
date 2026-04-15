# GitHub Automation Guide

This document explains what the repository automation does and when it runs.

## Automation Goals

GitHub Actions exist here to do three jobs:

- validate translation changes
- keep generated artifacts synchronized on `main`
- turn new translation proposals into reviewable pull requests

## Workflow Inventory

| Workflow | File | Responsibility |
| --- | --- | --- |
| build and validation | [../.github/workflows/buildTranslations.yml](../.github/workflows/buildTranslations.yml) | validate source changes and regenerate artifacts on `main` |
| upload processing | [../.github/workflows/processTranslationUploads.yml](../.github/workflows/processTranslationUploads.yml) | route incoming upload files and process direct/proposal paths |
| proposal PR automation | [../.github/workflows/openTranslationProposalPr.yml](../.github/workflows/openTranslationProposalPr.yml) | open or update PRs for proposal branches |

## Workflow 1: Validate And Build Translation Artifacts

File:

- [../.github/workflows/buildTranslations.yml](../.github/workflows/buildTranslations.yml)

Behavior:

- on pull requests, it validates syntax, validates pending proposal objects, validates source data, and checks whether generated artifacts are in sync
- on pushes to `main`, it applies approved proposal objects, regenerates generated artifacts, and commits the result back when needed

Important consequence:

- on `main`, generated files are automation-managed
- on pull requests, generated files are checked for correctness

## Workflow 2: Process Translation Editor Uploads

File:

- [../.github/workflows/processTranslationUploads.yml](../.github/workflows/processTranslationUploads.yml)

Behavior on `main`:

1. checks out the repository
2. routes incoming upload payloads
3. removes routed payloads from the main inbox
4. processes direct-update uploads on `main`
5. commits source, generated, report, and processed-state changes back to `main`
6. creates a `translation_proposals/...` branch when proposal uploads exist

Behavior on `translation_proposals/**` branches:

1. detects queued proposal uploads
2. converts them into reviewable proposal object files under [../i18n/proposals/pending/](../i18n/proposals/pending/)
3. commits the resulting proposal objects, reports, and processed upload state back to that proposal branch

This workflow is the operational bridge between raw uploads and either direct source updates or proposal PRs.

## Workflow 3: Open Translation Proposal Pull Request

File:

- [../.github/workflows/openTranslationProposalPr.yml](../.github/workflows/openTranslationProposalPr.yml)

Behavior:

- runs on pushes to `translation_proposals/**`
- compares proposal-branch changes against `main`
- finds reviewable proposal object files
- summarizes the exact objects that will be added
- opens or updates a pull request targeting `main`
- applies labels, assignees, and reviewer routing

## Proposal PR Behavior

The automation produces PRs with a consistent structure:

- target branch is `main`
- title is derived from the proposal branch name
- PR body summarizes the exact proposal objects under review
- labels are enforced automatically
- reviewers and assignees can be injected from repository variables

Repository variables used:

- `TRANSLATION_PROPOSAL_REVIEWERS`
- `TRANSLATION_PROPOSAL_TEAM_REVIEWERS`
- `TRANSLATION_PROPOSAL_ASSIGNEES`

## Recommended Repository Setup

For a professional proposal-review workflow, configure these once in the repository settings.

### Actions Variables

Set these under `Settings -> Secrets and variables -> Actions -> Variables`:

- `TRANSLATION_PROPOSAL_REVIEWERS`
  comma-separated GitHub usernames for direct reviewer requests
- `TRANSLATION_PROPOSAL_TEAM_REVIEWERS`
  comma-separated team slugs for team review requests
- `TRANSLATION_PROPOSAL_ASSIGNEES`
  comma-separated GitHub usernames that should be auto-assigned to proposal PRs

### Branch Protection

Recommended settings for `main`:

- require a pull request before merging
- require at least 1 approval
- require status checks to pass before merging
- require conversation resolution before merging
- optionally restrict who can push directly to `main`

These settings make the proposal-object review model much more reliable.

## Branch Model

The branch strategy is simple:

- `main`
  canonical integration branch for direct updates and validated source changes
- `translation_proposals/**`
  temporary proposal branches for new translation keys that require review

Interpretation:

- existing-key changes can flow directly to `main`
- new keys should flow through a proposal branch and pull request

## Files Automation Commonly Touches

Automation can update:

- [../i18n/source/translations.json](../i18n/source/translations.json)
- [../i18n/artifacts/generated/](../i18n/artifacts/generated/)
- [../i18n/artifacts/reports/](../i18n/artifacts/reports/)
- [../i18n/proposals/pending/](../i18n/proposals/pending/)
- [../i18n/proposals/processed/](../i18n/proposals/processed/)
- [../i18n/uploads/incoming/](../i18n/uploads/incoming/)
- [../i18n/uploads/processed/](../i18n/uploads/processed/)

This is expected repository behavior, not accidental churn.

## PR Template

The proposal PR template is:

- [../.github/pull_request_template.md](../.github/pull_request_template.md)

It reinforces the review rule:

- suggested keys and namespaces must be checked
- locale text must be intentional and complete
- application scope must be correct
- the validation workflow must be green

## Debugging Automation

If something looks wrong, check in this order:

1. the triggering branch
2. the paths changed in the commit
3. the relevant workflow file under [../.github/workflows/](../.github/workflows/)
4. the repository variables used for reviewer routing
5. the generated report files under [../i18n/artifacts/reports/](../i18n/artifacts/reports/)

## Most Important Mental Model

The automation is not generic CI glue.
It is part of the product behavior of this repository.

It exists to enforce a strict distinction between:

- direct edits to existing keys
- reviewed introduction of new keys through explicit proposal objects
