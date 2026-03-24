#!/bin/sh

printf "Commit message: "
read MESSAGE

if [ -z "$MESSAGE" ]; then
  echo "No commit message filled in."
  exit 1
fi

git add .
git commit -m "$MESSAGE"
git push --force-with-lease origin main

SECONDS_LEFT=120

while [ $SECONDS_LEFT -gt 0 ]; do
  printf "\rPull in %02d seconds..." "$SECONDS_LEFT"
  sleep 1
  SECONDS_LEFT=$((SECONDS_LEFT - 1))
done

printf "\rPulling latest changes now...            \n"
git pull --rebase origin main

echo "Ready."