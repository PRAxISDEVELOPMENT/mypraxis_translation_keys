# i18n/src

De CLI-bestanden staan in `i18n/bin/`. De echte implementatie zit hier:

- `core/`
  Algemene helpers voor paden, JSON-IO, config lezen, entry helpers en script runners.

- `translation-build/`
  Alles voor validatie, rapportage en artifact-generatie van translations.

- `upload-processing/`
  Alles voor uploadverwerking: argument parsing, key-suggesties, reports en inbox-flow.

Snelle regel:

- nieuw gedeeld gedrag -> `core/`
- translation build-logica -> `translation-build/`
- uploadverwerking -> `upload-processing/`
