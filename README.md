# Open Scripture Explorer

Open Scripture Explorer is a Hebrew-first Scripture study PWA.

The current app includes the offline reader plus an online-capable search layer:

- Mobile-first Bible reader and Search tab
- Hebrew-first Tanakh reader
- JPS 1917 English translation under the Hebrew text
- Shareable reader URLs
- Installable PWA behavior
- Offline access to loaded scripture books
- Natural language scripture search
- Direct reference lookup
- Local fuzzy search over verified scripture text
- Optional OpenAI/web-backed reference discovery

## Current Checkpoint

This repository is scaffolded with:

- Next.js app router
- JavaScript
- Tailwind CSS
- Prisma schema for `books`, `chapters`, and `verses`
- Full local Tanakh reader data
- Basic reference parser
- Initial unit tests and Playwright smoke test scaffold
- Server-side `/api/search` route
- Server-side `/api/health` deployment check

AI-assisted discovery is optional. Without `OPENAI_API_KEY`, direct references and
local fuzzy search still work. With `OPENAI_API_KEY`, the server can use OpenAI to
discover candidate references, then validates those references against local OSHB
+ JPS data before returning them.

## Scripture Data

The reader uses generated local data at `src/data/tanakh.json`.

Current import:

- Hebrew: `HBOMAS`, Hebrew Masoretic OT from HelloAO/eBible
- English: `eng_jps`, JPS TaNaKH 1917 from HelloAO/eBible
- Scope: 39 Tanakh books, 929 chapters, 23,213 OSHB/MT-numbered verses

Regenerate the local data with:

```bash
npm run import:tanakh
```

Source metadata is stored in `src/data/sources.json`.

The offline reader uses a generated static scripture collection under
`public/scriptures/`. Rebuild it after changing `src/data/tanakh.json`:

```bash
npm run build:scriptures
```

The generated collection is organized as one manifest plus one JSON file per
Tanakh book, so the mobile reader can cache only the books the user opens.

## Offline Reader PWA

The Bible reader loads scripture from static files instead of `/api/chapter`.
This keeps immutable Scripture text CDN-friendly and allows loaded books to
remain available offline after the service worker caches them.

Direct reader URLs use:

```text
/read/{bookId}/{chapter}
```

Example:

```text
/read/exo/19
```

## Scripture Search

Search uses a layered server-side flow:

1. Parse direct references.
2. Search verified local OSHB / JPS text.
3. Use fuzzy token matching for remembered wording.
4. Use OpenAI web-backed reference discovery when `OPENAI_API_KEY` is configured.
5. Validate every returned reference against the local scripture collection.

The API returns reference metadata only. The client displays quotations by loading
the verified local scripture collection, so AI-provided verse text is never shown.

Endpoint:

```text
POST /api/search
```

Input:

```json
{ "query": "where does God carry Israel on eagle wings" }
```

Output:

```json
{
  "results": [
    {
      "reference": "Exodus 19:4",
      "bookId": "exo",
      "chapter": 19,
      "verseStart": 4,
      "verseEnd": 4,
      "confidence": 0.94,
      "source": "local",
      "reason": "Matched verified local scripture text"
    }
  ]
}
```

## Local Setup

```bash
npm install
cp .env.example .env.local
npm run build:scriptures
npm run dev
```

Open http://localhost:3000.

Reader and local search do not require local environment variables. Add
`OPENAI_API_KEY` to `.env.local` only when testing AI/web-backed discovery.

## Hosting Part 1

Deploy the app as a normal Next.js project on Vercel. Do not use GitHub Pages,
`output: export`, or a `basePath`; direct reader routes and future server-side AI
routes need standard Next.js hosting.

Recommended Vercel settings:

- Framework preset: Next.js
- Production branch: `main`
- Build command: `npm run build`
- Environment variables for reader/local search: none required
- Environment variables for AI discovery: `OPENAI_API_KEY`, `DEFAULT_AI_PROVIDER=openai`, optionally `OPENAI_MODEL`
- Environment variables for launch metadata: `NEXT_PUBLIC_SITE_URL=https://your-domain.example`
- Environment variables for throttling: `SEARCH_RATE_LIMIT_MAX`, `SEARCH_RATE_LIMIT_WINDOW_SECONDS`

The build script regenerates `public/scriptures/` before `next build`, so the
deployed scripture collection stays in sync with `src/data/tanakh.json`.

After deployment, test:

- `/`
- `/read/gen/1`
- `/read/isa/53`
- `/api/health`
- `/api/search` with a direct reference query such as `Isaiah 8:20`
- `/manifest.webmanifest`
- `/sw.js`
- `/robots.txt`
- `/sitemap.xml`

On mobile, open the production HTTPS URL and use Add to Home Screen. After first
loading a book, that book should remain readable offline. Search requires network
access because it calls a server route.

`/api/health` intentionally reports launch-critical state only: app status,
scripture counts, whether AI search is configured, and the active search rate
limit. It does not expose secret values.

## Verification

```bash
npm run lint
npm test
npm run build:scriptures
npm run prisma:validate
npm run build
```

The browser smoke test can be run after Playwright browsers are installed:

```bash
npx playwright install
npx playwright test
```

## Required Environment

Reader and local search do not require environment variables. AI-backed discovery
uses:

```bash
DATABASE_URL=
OPENAI_API_KEY=
OPENAI_MODEL=gpt-5.5
DEFAULT_AI_PROVIDER=openai
NEXT_PUBLIC_SITE_URL=
SEARCH_RATE_LIMIT_MAX=30
SEARCH_RATE_LIMIT_WINDOW_SECONDS=60
APP_ENV=development
```

## Product Guardrails

Do not add accounts, chat threads, AI commentary, AI-generated scripture
quotations, multiple translations, Strong's, morphology, transliteration, notes,
highlights, bookmarks, or social features.

# License & Usage Disclaimer

## Public Domain (Code)

All source code in this repository is released into the public domain under:

* The Unlicense

You are free to:

* Use, copy, modify, and distribute this code
* Use it for commercial or private purposes
* Re-license or incorporate it into other projects

No attribution is required.

---

## Public Domain (Data)

Where applicable, data in this repository may be released under:

* CC0

Unless otherwise specified.

---

## ⚠️ Scripture Text Licensing

The public domain status of this repository **does NOT automatically apply to Bible translations**.

---

## Responsibility

If you:

* Add scripture text to this project
* Distribute this project with bundled translations

You are solely responsible for complying with the licensing terms of those texts.

This repository does not grant rights to any copyrighted Bible translation.

---

## No Warranty

This software is provided “as is”, without warranty of any kind.

Use at your own risk.

---
