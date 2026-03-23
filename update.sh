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
sleep 120
git pull --rebase origin main