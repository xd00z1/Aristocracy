# Aristocracy

Five minutes a day to become the person at the dinner party who knows what they are listening to. A progressive web app that trains cultural fluency in classical music, opera, art and history, framed as a climb through the peerage.

**Status:** v0.1, "The Departure". Four disciplines, four Grand Tour cities (London, Paris, Florence, Vienna), eight exercise types, spaced repetition, ranks to Duke, the Estate, local-only progress. No accounts, no social features, no payments.

Read [`docs/OUTLINE.md`](docs/OUTLINE.md) for the product and [`docs/HISTORY.md`](docs/HISTORY.md) for the history curriculum. [`CLAUDE.md`](CLAUDE.md) is the engineering and content rulebook.

## Run it on your computer

```bash
git clone https://github.com/xd00z1/Aristocracy
cd Aristocracy
git checkout claude/aristocracy-gamification-outline-flnvoa
npm install
npm run media      # fetches the images from Wikimedia Commons; takes a few minutes
npm run dev        # http://localhost:5173
```

Run `npm run media` before the first session if you can. It downloads the 78
public-domain images the content declares, which is what turns on the Zoom Out
and Who's Who exercises. Without it the app still works, but more of what you
see is the same text question. It needs to reach Wikimedia, so it will not work
behind a restrictive proxy.

## Put it on your phone

No Apple developer certificate, no App Store, no TestFlight. This is a
progressive web app, so Safari installs it from a URL: open the page, tap Share,
tap **Add to Home Screen**. It then launches full screen with its own icon, the
same as any other app on the phone. Android is the same through Chrome's
**Install app**.

The only question is how the phone reaches the page.

**Over your wifi, for a quick look.** Build it and serve it to the network:

```bash
npm run build
npm run preview -- --host      # prints a http://192.168.x.x:4173 address
```

Open that address in Safari on the phone and add it to the home screen. It works
and it looks right, but a service worker will not register over plain HTTP, so
there is no offline mode and the app will not open without your computer awake
and serving.

**Deployed, for actually using it.** The build is static files, so any free host
will do, and HTTPS is what unlocks offline and a proper install:

```bash
npm run build
npx vercel deploy --prod dist          # or: npx wrangler pages deploy dist
```

Take the URL it prints, open it in Safari, and add that to the home screen.
Now it works on the train, your progress is saved on the phone, and you can
close the laptop. Progress lives in the phone's own storage and does not sync
between devices, which is a v0.2 feature, so pick the device you actually want
to use it on.

## Checks and builds

`npm run build` validates the content, typechecks, and produces the installable
PWA in `dist/`. `npm run preview` serves that build locally.

## How it works

- **Content** is YAML under `content/` (items per discipline and city, Remark scenarios, the city list). `npm run validate` checks it against `src/content/schema.ts`; `npm run content` compiles it into `src/content/generated/content.json`, generating lessons (difficulty rising, disciplines interleaved) and an index of which images are actually on disk.
- **Images** are not committed. Items name a Wikimedia Commons file; `npm run media` checks the file's licence is public domain or CC0, downloads it to `public/media/img/`, and writes `public/media/credits.json`. Until that has run, image exercises (Zoom Out, Who's Who) degrade to text questions so a session is always completable.
- **Music** for Drop the Needle is synthesised in the browser from a compact theme notation (see `CLAUDE.md`), which sidesteps recording rights entirely for the MVP. Real recordings can be added per item later.
- **Progress** lives in IndexedDB (Dexie). Spaced repetition uses FSRS via `ts-fsrs`. An item joins the Collection after correct answers on three distinct days with enough stability.

## Checks

```bash
npm run validate   # content
npm run typecheck
npm test           # vitest, including the engine against the real content
npm run e2e        # playwright, a full twelve-slot session
npx tsx scripts/exercise-mix.ts   # what a player actually meets
```

The last one is the number to watch as content grows. Variety is the product: if
one exercise type dominates, the five minutes a day feel like a quiz. It reports
the mix as it stands, the mix you would get once `npm run media` has fetched
every declared image, and the items whose missing theme or image costs the most
variety. Themes are the scarcest thing in the content and the most valuable,
because Drop the Needle is the signature exercise and only a music or opera work
carrying `theme` notation can use it.

## Known limitations

**The content bundle still loads before the first screen.** The code review
already took the easy half of this: Zod is now imported for its types only, so
its 433 KB runtime no longer ships, and the content sits in its own chunk. First
load is a 423 KB script (134 KB gzipped) plus a 574 KB content chunk (189 KB
gzipped). What remains is the hard half. `src/content/index.ts` imports the
compiled bundle synchronously, so every city loads even though a first-time
player needs six items. Measuring the bundle field by field shows nothing worth
trimming, because it is all teaching material: facts are 31 percent of it,
remarks 8, gaffes 7, distractors 7, sources 6. The fix is lazy loading, one city
at a time, keyed off the Grand Tour the app already uses to structure the
content. That means making content access async and threading it through the
engine and the screens, which is a v0.2 refactor rather than a patch. It matters
more than it looks: at the 1,500-item v1.0 target the content chunk is roughly
3.5 MB, which no phone should be asked to download to answer twelve questions.

**Images are not fetched in this repository.** Items name a Wikimedia Commons
file; nothing is downloaded until you run `npm run media` locally. Until then
Zoom Out and Who's Who fall back to text questions, which is by design but makes
the exercise mix duller than it should be. See the mix report above.

**Themes are scarce.** Only 18 of 237 items carry the notation Drop the Needle
needs, so the signature exercise is 6 percent of what a player meets. Adding
themes is the highest-value content work available, and the mix report names the
works that lack one.

## Content review status

Every item carries `reviewed_by: null` until a human signs it off. Machine drafting and machine fact-checking were used; see `docs/CONTENT-REVIEW.md` for the residual doubts the audit pass raised. Do not treat any item as verified until a person has.
