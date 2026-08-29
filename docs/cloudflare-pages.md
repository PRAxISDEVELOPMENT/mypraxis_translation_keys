# Cloudflare Pages Setup

Cloudflare Pages is the primary runtime CDN. GitHub remains the source of truth,
and GitHub Raw remains the automatic network fallback in the client templates.

The intended fixed URLs are:

```text
https://mypraxis-translations.pages.dev/en.json
https://mypraxis-translations.pages.dev/fr.json
https://mypraxis-translations.pages.dev/nl.json
```

## One-Time Setup

1. Sign in to the Cloudflare dashboard.
2. Open **Workers & Pages**.
3. Select **Create** and then **Pages**.
4. Connect the GitHub account that can read
   `PRAxISDEVELOPMENT/mypraxis_translation_keys`.
5. Select that repository.
6. Use these project settings:

   | Setting | Value |
   | --- | --- |
   | Project name | `mypraxis-translations` |
   | Production branch | `main` |
   | Framework preset | `None` |
   | Build command | `npm run translations:check && npm run translations:prepare-cdn` |
   | Build output directory | `.cloudflare-pages` |
   | Root directory | leave empty |
   | Environment variable | `NODE_VERSION=20` |

7. Start the first deployment.
8. Under **Settings -> Builds -> Branch control**, deploy only the production
   branch. Disable preview-branch deployments unless they are explicitly needed.
9. Under **Settings -> Build -> Build watch paths**, add these as include paths
   (one entry per path, or comma-separated when the dashboard shows one field):

   ```text
   i18n/artifacts/generated/en.json
   i18n/artifacts/generated/fr.json
   i18n/artifacts/generated/nl.json
   scripts/prepare-cloudflare-pages.js
   package.json
   package-lock.json
   ```

10. Open all three fixed URLs and confirm that they return JSON.

Cloudflare deploys the three locale files and `_headers` as one atomic static
deployment. `_headers` enables cross-origin reads and forces clients to
revalidate JSON instead of keeping an old browser-cache copy.

## GitHub Verification Setup

In the GitHub repository, open **Settings -> Secrets and variables -> Actions ->
Variables** and add:

| Variable | Value |
| --- | --- |
| `TRANSLATION_CDN_BASE_URL` | `https://mypraxis-translations.pages.dev` |
| `CLOUDFLARE_PAGES_CONFIGURED` | `true` |

Then open **Actions -> Verify Cloudflare Translation CDN -> Run workflow**.
The run must report that GitHub Raw and Cloudflare Pages contain the exact same
bytes for `en.json`, `fr.json`, and `nl.json`.

## If The Project Name Is Unavailable

Choose another Cloudflare project name. Then update:

1. `TRANSLATION_CDN_BASE_URL` in GitHub Actions variables.
2. `TRANSLATION_CDN_BASE_URL` in all four files under `templates/`.
3. Every consuming application's copied i18n configuration.

Do not enable `CLOUDFLARE_PAGES_CONFIGURED` until the selected URL serves the
three locale files.

## Normal Operation

1. A translation change reaches `main`.
2. The repository automation generates and commits the locale files.
3. Cloudflare detects the locale-file commit and creates a new deployment.
4. The fixed URLs switch atomically to that deployment.
5. GitHub Actions waits for the deployment and compares the three files byte
   for byte.
6. Applications load Cloudflare first and GitHub Raw only after a Cloudflare
   request failure, timeout, or invalid JSON response.

The previous successful Cloudflare deployment stays online when a new build
fails. A short deployment interval after a GitHub commit is unavoidable; the
verification workflow confirms when both public hosts have converged.
