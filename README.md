# Open Scripture Explorer

Open Scripture Explorer is a Hebrew-first Scripture study PWA.

Phase 1 is intentionally narrow:

- Mobile-first Bible reader with a disabled Search tab reserved for Part 2
- Hebrew-first Tanakh reader
- JPS 1917 English translation under the Hebrew text
- Shareable reader URLs
- Installable PWA behavior
- Offline access to loaded scripture books

## Current Checkpoint

This repository is scaffolded with:

- Next.js app router
- JavaScript
- Tailwind CSS
- Prisma schema for `books`, `chapters`, and `verses`
- Full local Tanakh reader data
- Basic reference parser
- Initial unit tests and Playwright smoke test scaffold

The AI search service is not implemented yet and is intentionally disabled for the
Part 1 launch.

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

## Local Setup

```bash
npm install
npm run build:scriptures
npm run dev
```

Open http://localhost:3000.

Part 1 does not require local environment variables unless you are working on the
future database or AI routes.

## Hosting Part 1

Deploy the app as a normal Next.js project on Vercel. Do not use GitHub Pages,
`output: export`, or a `basePath`; direct reader routes and future server-side AI
routes need standard Next.js hosting.

Recommended Vercel settings:

- Framework preset: Next.js
- Production branch: `main`
- Build command: `npm run build`
- Environment variables for Part 1: none required

The build script regenerates `public/scriptures/` before `next build`, so the
deployed scripture collection stays in sync with `src/data/tanakh.json`.

After deployment, test:

- `/`
- `/read/gen/1`
- `/read/isa/53`
- `/manifest.webmanifest`
- `/sw.js`

On mobile, open the production HTTPS URL and use Add to Home Screen. After first
loading a book, that book should remain readable offline.

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

Part 1 hosting does not require these variables. They are placeholders for later
database and AI work:

```bash
DATABASE_URL=
OPENAI_API_KEY=
DEFAULT_AI_PROVIDER=openai
APP_ENV=development
```

## Phase 1 Guardrails

Do not add accounts, chat threads, AI commentary, multiple translations, Strong's,
morphology, transliteration, notes, highlights, bookmarks, or social features.

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
