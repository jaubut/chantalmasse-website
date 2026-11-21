#!/usr/bin/env bash
# Build the Astro site and deploy it to the PREVIEW Worker chantalmasse-website-astro (workers.dev, noindex).
# Never touches the live Worker. Run from the repo root: bash astro/scripts/deploy-preview.sh
set -euo pipefail
bun node_modules/astro/bin/astro.mjs build --root astro
# Static files never reach the Worker's middleware: give them the preview noindex header here.
printf '/*\n  X-Robots-Tag: noindex\n' >> astro/dist/client/_headers
cd astro && bun ../node_modules/wrangler/bin/wrangler.js deploy
