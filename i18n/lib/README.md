# i18n/lib

De CLI-bestanden in `i18n/` zijn entry points. De echte logica zit hier:

- `shared/`
  Algemene helpers voor paden, JSON-IO, config lezen, entry helpers en script runners.

- `build/`
  Alles voor translation build: args, help/output, validatie en artifact-generatie.

- `upload/`
  Alles voor uploadverwerking: args, tekst/key-suggesties, reports, prepare/apply en inbox-flow.

Snelle regel:

- nieuw gedeeld gedrag -> `shared/`
- build-gerelateerde logica -> `build/`
- upload-gerelateerde logica -> `upload/`
