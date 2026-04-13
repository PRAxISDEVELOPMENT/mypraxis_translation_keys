#!/bin/sh

# Local developer helper for the normal translation workflow.
# It builds translations, asks for a commit message, pushes the current branch,
# waits for the main build workflow when applicable, then pulls the latest changes back.

set -eu

POLL_INTERVAL="${POLL_INTERVAL:-5}"
MAX_WAIT_SECONDS="${MAX_WAIT_SECONDS:-300}"
WORKFLOW_FILE="${WORKFLOW_FILE:-buildTranslations.yml}"
CURRENT_BRANCH="$(git rev-parse --abbrev-ref HEAD)"

wait_for_github_actions() {
  target_sha="$1"

  if ! command -v gh >/dev/null 2>&1; then
    echo "GitHub CLI not found. Skipping workflow wait."
    return 1
  fi

  if ! gh auth status >/dev/null 2>&1; then
    echo "GitHub CLI is not authenticated correctly. Skipping workflow wait."
    return 1
  fi

  elapsed=0


  echo "Waiting for GitHub Actions run to start..."

  while [ "$elapsed" -lt "$MAX_WAIT_SECONDS" ]; do
    run_id=$(
      gh run list \
        --workflow "$WORKFLOW_FILE" \
        --branch main \
        --event push \
        --limit 20 \
        --json databaseId,headSha \
        --jq ".[] | select(.headSha == \"$target_sha\") | .databaseId" \
        2>/dev/null | head -n 1
    )

    if [ -n "$run_id" ]; then
      echo "Watching GitHub Actions run $run_id..."
      gh run watch "$run_id" --exit-status
      return 0
    fi

    printf "\rWaiting for workflow registration... %03ds" "$elapsed"
    sleep "$POLL_INTERVAL"
    elapsed=$((elapsed + POLL_INTERVAL))
  done

  printf "\nNo matching workflow run was found within %ss.\n" "$MAX_WAIT_SECONDS"
  return 1
}

printf "\n==> Step 1/5: Building translations locally\n"
node i18n/bin/build-translations.js

printf "\n==> Step 2/5: Enter commit message\n"
printf "Commit message: "
IFS= read -r MESSAGE

if [ -z "$MESSAGE" ]; then
  echo "No commit message filled in."
  exit 1
fi

git add .

if git diff --cached --quiet; then
  echo "No changes to commit."
  exit 0
fi

printf "\n==> Step 3/5: Commit and push\n"
git commit -m "$MESSAGE"
git push origin HEAD:"$CURRENT_BRANCH"

PUSHED_SHA="$(git rev-parse HEAD)"

printf "\n==> Step 4/5: Waiting for automation\n"
if [ "$CURRENT_BRANCH" = "main" ] && wait_for_github_actions "$PUSHED_SHA"; then
  echo "GitHub Actions completed successfully."
else
  if [ "$CURRENT_BRANCH" = "main" ]; then
    echo "Continuing without confirmed workflow completion."
  else
    echo "Skipping workflow wait because the current branch is \"$CURRENT_BRANCH\"."
  fi
fi

printf "\n==> Step 5/5: Pulling latest changes\n"
git pull --rebase origin "$CURRENT_BRANCH"

echo "Ready."
