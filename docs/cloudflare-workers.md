# Cloudflare Workers Setup

Cloudflare Workers with Static Assets is the primary runtime CDN. GitHub remains
the source of truth, and GitHub Raw remains the automatic network fallback.

The fixed production URLs are:

```text
https://praxis-translations.development-3e6.workers.dev/en.json
https://praxis-translations.development-3e6.workers.dev/fr.json
https://praxis-translations.development-3e6.workers.dev/nl.json
```

## One-Time Setup

First push the repository changes containing `wrangler.jsonc` and
`scripts/prepare-cloudflare-assets.js` to GitHub. Then:

1. Sign in to the Cloudflare dashboard.
2. Open **Workers & Pages** and select **Create application**.
3. Connect the GitHub repository
   `PRAxISDEVELOPMENT/mypraxis_translation_keys`.
4. On **Set up your application**, use:

   | Setting | Value |
   | --- | --- |
   | Project name | `praxis-translations` |
   | Build command | `npm run translations:check && npm run translations:prepare-cdn` |
   | Deploy command | `npx wrangler deploy` |
   | Builds for non-production branches | disabled |
   | Protect with Cloudflare Access | disabled |

5. Select **Deploy**.
6. Wait until the production deployment succeeds.
7. Open all three fixed URLs and confirm that they return JSON.

Wrangler reads `wrangler.jsonc` and deploys `.cloudflare-assets/` as one static
asset deployment. `_headers` enables cross-origin reads and forces clients to
revalidate JSON instead of keeping an old browser-cache copy.

## GitHub Verification Setup

In the GitHub repository, open **Settings -> Secrets and variables -> Actions ->
Variables** and add:

| Variable | Value |
| --- | --- |
| `TRANSLATION_CDN_BASE_URL` | `https://praxis-translations.development-3e6.workers.dev` |
| `CLOUDFLARE_WORKER_CONFIGURED` | `true` |

Then open **Actions -> Verify Cloudflare Translation CDN -> Run workflow**.
The run must report that GitHub Raw and Cloudflare Workers contain the exact
same bytes for `en.json`, `fr.json`, and `nl.json`.

## Normal Operation

1. A translation change reaches `main`.
2. Repository automation generates and commits the locale files.
3. Cloudflare Workers Builds runs the build and deploy commands.
4. The fixed URLs switch to the new static asset deployment.
5. GitHub Actions waits for the deployment and compares the three files byte
   for byte.
6. Applications load Cloudflare first and GitHub Raw only after a Cloudflare
   request failure, timeout, or invalid JSON response.

The previous successful deployment stays online when a new build fails. A short
deployment interval after a GitHub commit is unavoidable; the verification
workflow confirms when both public hosts have converged.
