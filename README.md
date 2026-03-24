# mypraxis_translation_keys

Central translation source and generated locale files for MyPRAxIS.

This repository is used to manage translations from a single source file and automatically generate locale-specific JSON files for runtime usage in the MyPRAxIS application.

---

## Table of contents

- [Purpose](#purpose)
- [How it works](#how-it-works)
- [Repository structure](#repository-structure)
- [Translation source format](#translation-source-format)
- [Generated output format](#generated-output-format)
- [Update workflow](#update-workflow)
- [NPM update command](#npm-update-command)
- [GitHub Actions automation](#github-actions-automation)
- [Rules](#rules)
- [Common issues](#common-issues)
- [Why this setup](#why-this-setup)
- [Future-proofing](#future-proofing)

---

## Purpose

This repository exists to solve two problems:

1. Keep translation management simple by editing only one source file
2. Generate runtime locale files automatically for the application

The goal is to avoid manually maintaining multiple translation files while still producing the exact locale-based JSON structure required by the frontend application.

---

## How it works

The flow is:

```text
i18n/translations.json
→ i18n/buildTranslations.js
→ i18n/generated/nl.json
→ i18n/generated/fr.json
→ i18n/generated/en.json
```

### In practice

- You only edit `i18n/translations.json`
- GitHub Actions automatically runs the generator
- Generated locale files are rebuilt
- The generated files are committed automatically if they changed
- The MyPRAxIS application reads the generated locale files

This means there is only **one source of truth** for translations, while the application still receives the per-locale output it needs.

---

## Repository structure

```text
.github/
  workflows/
    buildTranslations.yml

i18n/
  translations.json
  buildTranslations.js
  generated/
    nl.json
    fr.json
    en.json

package.json
update.sh
README.md
```

### File responsibilities

#### `i18n/translations.json`
Main translation source file.  
This is the only file that should be edited manually for translation content.

#### `i18n/buildTranslations.js`
Build script that converts the flat translation source into nested locale-specific JSON files.

#### `i18n/generated/nl.json`
Generated Dutch locale file.

#### `i18n/generated/fr.json`
Generated French locale file.

#### `i18n/generated/en.json`
Generated English locale file.

#### `.github/workflows/buildTranslations.yml`
GitHub Actions workflow that automatically regenerates locale files after updates.

#### `package.json`
Contains the `npm run update` helper command.

#### `update.sh`
Helper script that simplifies the full workflow:
- add
- commit
- push
- wait
- pull latest generated changes

---

## Translation source format

Translations are stored as a flat array of objects.

Each object contains:
- a `key`
- a Dutch translation
- a French translation
- an English translation

### Example

```json
[
  {
    "key": "Metadata.title",
    "nl": "PRAxIS GROUP N.V. - MyPRAxIS",
    "fr": "PRAxIS GROUP N.V. - MyPRAxIS",
    "en": "PRAxIS GROUP N.V. - MyPRAxIS"
  },
  {
    "key": "Metadata.description",
    "nl": "Klantenportaal van PRAxIS Group",
    "fr": "Portail client de PRAxIS Group",
    "en": "Customer portal for PRAxIS Group"
  },
  {
    "key": "Auth.Login.title",
    "nl": "Aanmelden",
    "fr": "Connexion",
    "en": "Sign in"
  },
  {
    "key": "Common.save",
    "nl": "Opslaan",
    "fr": "Enregistrer",
    "en": "Save"
  }
]
```

### Key naming convention

Use semantic dot-notation keys.

Recommended examples:

- `Metadata.title`
- `Metadata.description`
- `Auth.Login.title`
- `Auth.Login.submit`
- `Common.save`
- `Common.cancel`
- `Navigation.dashboard`
- `Validation.required`

### Why dot notation is used

The generator splits the key on `.` and converts it into a nested JSON structure.

Example source key:

```json
{
  "key": "Common.save",
  "nl": "Opslaan",
  "fr": "Enregistrer",
  "en": "Save"
}
```

This becomes:

```json
{
  "Common": {
    "save": "Opslaan"
  }
}
```

in `nl.json`.

---

## Generated output format

The application does not use `translations.json` directly.

It uses the generated locale files:

- `i18n/generated/nl.json`
- `i18n/generated/fr.json`
- `i18n/generated/en.json`

### Example generated `nl.json`

```json
{
  "Metadata": {
    "title": "PRAxIS GROUP N.V. - MyPRAxIS",
    "description": "Klantenportaal van PRAxIS Group"
  },
  "Auth": {
    "Login": {
      "title": "Aanmelden"
    }
  },
  "Common": {
    "save": "Opslaan"
  }
}
```

These files are runtime-ready for the frontend application.

---

## Update workflow

There are two ways to update translations.

### Recommended way

Use the built-in helper command:

```bash
npm run update
```

The script will ask for a commit message and then handle the full process automatically.

### Manual way

If needed, you can still do everything manually:

```bash
git add .
git commit -m "your commit message"
git push --force-with-lease origin main
git pull --rebase origin main
```

But the recommended flow is `npm run update`.

---

## NPM update command

This repository contains a helper command so contributors do not need to remember the full Git workflow.

### Usage

```bash
npm run update
```

The script will prompt for a commit message.

Example:

```text
Commit message: add common translations
```

### What it does

The script automatically performs:

1. `git add .`
2. `git commit -m "your message"`
3. `git push --force-with-lease origin main`
4. waits for GitHub Actions to generate the locale files
5. `git pull --rebase origin main`

This makes the normal update process much easier.

### Related files

#### `package.json`

```json
{
  "name": "mypraxis_translation_keys",
  "private": true,
  "scripts": {
    "update": "sh ./update.sh"
  }
}
```

#### `update.sh`

```sh
#!/bin/sh

printf "Commit message: "
read MESSAGE

if [ -z "$MESSAGE" ]; then
  echo "Geen commit message ingevuld."
  exit 1
fi

git add .
git commit -m "$MESSAGE"
git push --force-with-lease origin main

SECONDS_LEFT=120

while [ $SECONDS_LEFT -gt 0 ]; do
  printf "\rPull in %02d seconden..." "$SECONDS_LEFT"
  sleep 1
  SECONDS_LEFT=$((SECONDS_LEFT - 1))
done

printf "\rPulling latest changes now...            \n"
git pull --rebase origin main

echo "Klaar."
```

### One-time setup

Make sure the script is executable:

```bash
chmod +x update.sh
```

---

## GitHub Actions automation

This repository contains a GitHub Actions workflow that rebuilds generated locale files automatically.

### Workflow file

```text
.github/workflows/buildTranslations.yml
```

### What it does

When relevant files are changed and pushed to `main`, GitHub Actions:

1. checks out the repo
2. sets up Node.js
3. runs the translation generator
4. stages generated files
5. commits and pushes them if they changed

### Relevant trigger paths

The workflow is triggered when these files change:

- `i18n/translations.json`
- `i18n/buildTranslations.js`
- `.github/workflows/buildTranslations.yml`

### Important note

This means the generator works whether changes are made:
- locally through Git and pushed
- or directly through GitHub file editing

As long as the commit lands on `main` and matches the workflow paths, the generation will run.

---

## Rules

### Always edit
- `i18n/translations.json`

### Never edit manually
- `i18n/generated/nl.json`
- `i18n/generated/fr.json`
- `i18n/generated/en.json`

These files are generated output and should be treated as derived files.

### Recommended practice
- keep keys semantic and stable
- keep values complete for all supported locales
- avoid ad hoc or UI-text-as-key patterns

---

## Common issues

### 1. Invalid JSON in `translations.json`

If GitHub Actions fails with a JSON parsing error, your JSON is invalid.

Most common cause:
- trailing comma before `]`

### Invalid example

```json
[
  {
    "key": "Common.save",
    "nl": "Opslaan",
    "fr": "Enregistrer",
    "en": "Save"
  },
]
```

### Correct example

```json
[
  {
    "key": "Common.save",
    "nl": "Opslaan",
    "fr": "Enregistrer",
    "en": "Save"
  }
]
```

### 2. Local branch is behind remote

If GitHub Actions automatically committed generated files, your local repo may be behind.

Run:

```bash
git pull --rebase origin main
```

Using `npm run update` already includes this.

### 3. GitHub Action failed

Check:
- `translations.json` is valid JSON
- file names match the workflow
- the build script path matches the actual file name
- the workflow still points to the correct script

### 4. Generated files did not update

Possible reasons:
- the workflow failed
- the JSON was invalid
- the changed file path did not match the workflow trigger
- no actual output difference was produced

---

## Why this setup

This setup was chosen because it offers the best balance between simplicity and future extensibility.

### Advantages

- one central translation source
- no need to manually maintain three locale files
- generated locale output stays clean and application-ready
- GitHub handles the automation
- contributors only need a simple update flow

This is much easier to manage than manually editing `nl.json`, `fr.json`, and `en.json` separately.

---

## Future-proofing

This structure is designed so it can later evolve into a more advanced translation management system.

Possible future upgrades:

- translation editing from an admin panel
- validation for missing languages
- review/approval status per translation
- database-backed translation storage
- export/import tooling
- automated checks for missing keys

The current source format already supports that future direction because it keeps translations centralized per key.

---

## Typical daily usage

### Edit translations
Open:

```text
i18n/translations.json
```

### Add or update entries
Example:

```json
{
  "key": "Common.cancel",
  "nl": "Annuleren",
  "fr": "Annuler",
  "en": "Cancel"
}
```

### Save and publish
Run:

```bash
npm run update
```

### Done
GitHub Actions will regenerate the locale files and your local repo will pull them back in after the wait period.

---

## Summary

### Source of truth
```text
i18n/translations.json
```

### Generated automatically
```text
i18n/generated/nl.json
i18n/generated/fr.json
i18n/generated/en.json
```

### Recommended command
```bash
npm run update
```

### Do not edit generated files manually
Always edit the source file instead.

---

## Maintainers

PRAxIS DEVELOPMENT / MyPRAxIS
