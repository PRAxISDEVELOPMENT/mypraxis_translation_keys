#!/bin/sh

printf "Commit message: "
read MESSAGE

if [ -z "$MESSAGE" ]; then
  echo "Geen commit message ingevuld."
  exit 1
fi

git add .
git commit -m "$MESSAGE"
git push

SECONDS_LEFT=120

while [ $SECONDS_LEFT -gt 0 ]; do
  printf "\rPull in %02d seconden..." "$SECONDS_LEFT"
  sleep 1
  SECONDS_LEFT=$((SECONDS_LEFT - 1))
done

printf "\rPulling latest changes now...            \n"
git pull --rebase origin main

echo "Klaar."