#!/bin/sh

set -eu

find i18n/bin i18n/src -type f -name '*.js' | sort | while IFS= read -r file; do
  node --check "$file"
done
