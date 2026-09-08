# Aristocracy

Five minutes a day to become the person at the dinner party who knows what they are listening to. A progressive web app that trains cultural fluency in classical music, opera, art and history, framed as a climb through the peerage.

**Status:** v0.1, "The Departure". Four disciplines, four Grand Tour cities (London, Paris, Florence, Vienna), eight exercise types, spaced repetition, ranks to Duke, the Estate, local-only progress. No accounts, no social features, no payments.

Read [`docs/OUTLINE.md`](docs/OUTLINE.md) for the product and [`docs/HISTORY.md`](docs/HISTORY.md) for the history curriculum. [`CLAUDE.md`](CLAUDE.md) is the engineering and content rulebook.

## Run it

```bash
npm install
npm run media      # optional: download public-domain images from Wikimedia Commons (needs network)
npm run dev        # http://localhost:5173
```

`npm run build` validates the content, typechecks, and produces an installable PWA in `dist/`. `npm run preview` serves it.

## How it works

- **Content** is YAML under `content/` (items per discipline and city, Remark scenarios, the city list). `npm run validate` checks it against `src/content/schema.ts`; `npm run content` compiles it into `src/content/generated/content.json`, generating lessons (difficulty rising, disciplines interleaved) and an index of which images are actually on disk.
- **Images** are not committed. Items name a Wikimedia Commons file; `npm run media` checks the file's licence is public domain or CC0, downloads it to `public/media/img/`, and writes `public/media/credits.json`. Until that has run, image exercises (Zoom Out, Who's Who) degrade to text questions so a session is always completable.
- **Music** for Drop the Needle is synthesised in the browser from a compact theme notation (see `CLAUDE.md`), which sidesteps recording rights entirely for the MVP. Real recordings can be added per item later.
- **Progress** lives in IndexedDB (Dexie). Spaced repetition uses FSRS via `ts-fsrs`. An item joins the Collection after correct answers on three distinct days with enough stability.

## Checks

```bash
npm run validate   # content
npm run typecheck
npm test           # vitest
npm run e2e        # playwright, full session
```

## Content review status

Every item carries `reviewed_by: null` until a human signs it off. Machine drafting and machine fact-checking were used; see `docs/CONTENT-REVIEW.md` for the residual doubts the audit pass raised. Do not treat any item as verified until a person has.
