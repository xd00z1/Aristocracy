# Aristocracy: Product Outline (v0, for review)

Working title: **Aristocracy** (repo name). Public name to be decided; see section 14.
Status: outline only. Nothing is built. This document is the thing to argue with before code exists.

---

## 0. The premise, corrected

The brief says "gamify becoming aristocratic." Nobody becomes aristocratic by knowing opera; aristocracy is birth, land and manners. What this product can actually deliver is **cultural fluency**: the ability to recognise a canonical work within ten seconds and say one intelligent, non-embarrassing sentence about it. That is the skill people mean when they call someone "cultured," and it is trainable. The aristocratic costume is the hook and the progression metaphor. Fluency is the product.

Three design consequences follow, and everything below obeys them:

1. **Recognition over recall.** Drop-the-needle and zoom-out exercises, not dates and opus numbers. A user who can hear eight bars and say "late Beethoven, probably a quartet" has the skill. A user who knows Op. 131 was published in 1827 has trivia.
2. **Conversation is a first-class skill.** Every content item ships with a *remark* (one sayable, defensible sentence) and a *gaffe* (the thing that exposes you). Wrong answers teach the remark. This is the feature no quiz app has.
3. **Restraint is the aesthetic.** "Easy and fun" and "aristocratic" pull in opposite directions; most gamification cheapens. Fun here comes from wit, collection and rank, not confetti. No mascot, no streak-fire emoji, no slot-machine sounds. If it would embarrass a duchess, cut it.

Confidence that this reframing is right: high. The evidence is that every durable learning game (Duolingo, Anki) wins on habit loop and content depth, not theme, and that recognition-style category learning is what actually transfers (Kornell & Bjork 2008 showed interleaved exposure to paintings improved later identification of *new* works by the same artists).

---

## 1. One-liner and audience

**One-liner:** Five minutes a day to become the person at the dinner party who knows what they're listening to.

**Primary user:** Adults 25 to 55 who feel a gap between their professional competence and their cultural literacy, and are mildly embarrassed by it. They've been to one opera. They can name Monet and nobody else. They want to fix this privately and without a syllabus.

**Secondary users:** Students before a Grand Tour of their own; the newly wealthy; anyone dating above their cultural station.

**Not the user:** Musicologists, art historians, actual peers. They will find it shallow. That is fine.

**Nearest patterns:** Duolingo (habit loop, units, leagues), Anki (spaced repetition), collection games (the Estate). No breakout product owns high-culture literacy specifically; a proper competitive scan is a to-do, not a claim (confidence: moderate).

---

## 2. Core loop

```mermaid
flowchart LR
    A[Open app] --> B[Correspondence: due reviews, 1-3 min]
    B --> C[Today's Lesson: 12 exercises, ~5 min]
    C --> D[Grade + Prestige + items acquired]
    D --> E[Estate updates / rank-up ceremony]
    E --> F[Optional: Duel, Salon standing, share card]
```

**Session anatomy (12 exercises, about 5 minutes):**

| Slot | Content | Purpose |
|---|---|---|
| 1 to 3 | Review items (from the SRS queue) | Retention |
| 4 to 9 | New items from the current Grand Tour city, interleaved across disciplines | Acquisition |
| 10 to 11 | One *Remark* scenario + one *Timeline* | Transfer to conversation and chronology |
| 12 | "Finale": a hard recognition item for bonus Prestige | Stakes without punishment |

**Rules of the loop:**

- Disciplines are interleaved within a session, never blocked. (Interleaving beats blocking for style recognition; high confidence, see section 0.)
- No hearts, no lives. A wrong answer shows the correct answer plus the item's *remark*, then re-queues the item later in the same session. Punishment mechanics are widely resented, and they are beneath the tone.
- No timers, except in optional Duels.
- Every session ends with a **grade** styled on British degree classes: First, Upper Second, Lower Second, Third, Pass. A First requires zero errors on review items.
- Sessions are always completable. There is no "you must buy more turns."

---

## 3. Disciplines (the curriculum)

Each discipline maps to a wing of the player's Estate (section 6).

| Discipline | Estate wing | Release | What "fluency" means here |
|---|---|---|---|
| Classical music | Music Room | **MVP** | Hear 10 seconds, name era and probable composer; know the big forms (sonata, symphony, concerto, quartet, lied) |
| Opera | Opera Box | **MVP** | Recognise the twenty arias that get played at dinner; know plots well enough to follow a conversation; know voice types and who sings what |
| Visual art | Gallery | **MVP** | See a painting, name the movement and probable artist; know where the famous ones hang; recognise brushwork at close range |
| History | Long Gallery | **MVP** | Know the dynasties, courts, revolutions and scandals the art, music and opera are about; know which famous stories are false. Curriculum in [`HISTORY.md`](HISTORY.md) |
| Architecture | The House itself | v2 | Tell Baroque from Rococo from Neoclassical from a doorway; name the orders |
| Literature and poetry | Library | v2 | Recognise first lines and famous passages; know who wrote what and roughly when; quote without misquoting |
| Titles, forms of address, heraldry | Muniment Room | v2 | Address a marquess in writing and in person; read a coat of arms; know that a baronet is not a peer |
| Etiquette and protocol | Drawing Room | v2 | Seating, precedence, when to applaud, what to wear to what |
| Ballet and dance | Ballroom | v3 | Recognise the major ballets and their scores; know the vocabulary |
| Wine and the table | Cellar | v3 | Regions, grapes, vintages that matter; how to order, taste, and talk without being a bore |
| Languages of culture | Schoolroom | v2 | Pronounce Italian, French, German titles and terms; the fifty phrases you need (*sprezzatura*, *bel canto*, *plein air*, *Gesamtkunstwerk*) |

MVP is four disciplines, deliberately few. Every additional discipline multiplies content cost linearly and dilutes the first impression. History is the fourth because it is the cheapest to source (portraits and history paintings are public domain, and it needs no audio) and because the other three are unintelligible without it. Architecture and Literature come first in v2 because they are next cheapest (public-domain text and photographs).

### History: the filter

History is not taught as wars and treaties. An episode gets in only if it explains something in another discipline, explains the aristocracy itself, or is a story a cultured person is expected to have on hand, and it must pass the dinner test. Wars appear only through what they did to art and the people who made it: the Second World War as a war is out; the Monuments Men and the Leningrad Symphony are in. Famous false stories are content in their own right (the *Apocrypha* strand). Every history item must link to an item in another discipline or it does not ship. The episode list, the Apocrypha table, and the MVP allocation by city are in [`HISTORY.md`](HISTORY.md).

---

## 4. Exercise types

The exercise catalogue is where "fun" actually lives. Each type is a reusable component that takes content items and distractors.

| # | Name | Mechanic | Disciplines | Release |
|---|---|---|---|---|
| 1 | **Drop the Needle** | 10 to 20 second clip; pick composer, era, or work from 4 options. Variant: two clips, "which is earlier?" | Music, Opera | MVP |
| 2 | **Zoom Out** | Image starts zoomed to brushwork and zooms out over 6 seconds; answer earlier for more Prestige | Art | MVP |
| 3 | **The Remark** | A social situation with three replies: one correct and graceful, one factually wrong, one gaffe. Explanation on every answer | All | MVP |
| 4 | **Timeline** | Drag 3 or 4 works or people into chronological order. Succession variant: order the Tudors, the Louis, the Medici | All | MVP |
| 5 | **Match** | Pair arias to operas, paintings to museums, patrons to artists, rulers to palaces | All | MVP |
| 6 | **Lexicon** | Term to definition, with pronunciation audio for foreign terms | All | MVP |
| 7 | **Who's Who** | A portrait, four names. Cross-trains art, since the portraits are Holbein, Titian, Van Dyck, Velázquez, Winterhalter, Sargent | History, Art | MVP |
| 8 | **Apocrypha** | A famous line or story; choose *attested*, *embellished*, or *invented*. Every answer shows the source | History, Music, Opera | MVP |
| 9 | **Odd One Out** | Four items, one doesn't belong (three Impressionists and a Fauve) | All | v2 |
| 10 | **Programme Note** | Read three sentences, answer one question. Trains the habit of reading the programme | All | v2 |
| 11 | **Attribution** | Two images: which is the master, which the follower (Caravaggio vs. the Caravaggisti)? Hard tier | Art | v2 |
| 12 | **The Libretto** | Fill the blank in a famous line ("La donna è ___") | Opera, Literature | v2 |
| 13 | **Precedence** | Seat six named guests correctly, or address a letter to a given rank | Etiquette, Titles | v2 |
| 14 | **Kinship** | Who was whose daughter, cousin, mistress? The royal houses as gossip | History, Titles | v2 |
| 15 | **Duel** | Asynchronous head-to-head: same 10 questions, timed, best score wins | All | v2 |

**Sample Remark (Opera, tier 2):**

> Interval, Covent Garden, *Tosca*. Your host says: "The Scarpia was rather underpowered, didn't you think?"
>
> A. "Baritones always are." *(gaffe: sweeping, and wrong)*
> B. "He was, though the Te Deum still landed. That orchestra could carry a corpse." *(correct: specific, generous, and shows you know how Act I ends)*
> C. "I thought the tenor was wonderful as Scarpia." *(factual error: Scarpia is a baritone role)*

The Remark is the signature exercise. It is also the most expensive to write well, because each one needs a real situation, a real correct answer, and a wrong answer that is wrong in an instructive way.

---

## 5. Progression and economy

### Ranks

Ranks follow the British system in ascending order. The first five are not peers; the peerage begins at Baron. The app says so, because that is exactly the kind of thing the user is here to learn.

| Rank | Style | Unlock (indicative) |
|---|---|---|
| 1 | Commoner | Start |
| 2 | Gentleman / Gentlewoman | First session completed |
| 3 | Esquire | 25 items in the Collection |
| 4 | Knight / Dame | 60 items, first city of the Grand Tour complete |
| 5 | Baronet | 120 items |
| 6 | Baron / Baroness | 200 items, 2 cities |
| 7 | Viscount / Viscountess | 320 items |
| 8 | Earl / Countess | 480 items, 4 cities |
| 9 | Marquess / Marchioness | 700 items |
| 10 | Duke / Duchess | 1,000 items, Grand Tour complete |

The user chooses their style of title at signup: masculine, feminine, or the plain rank word with no gendered style (an option the historical system never offered; the app offers it anyway). Rank-up is a ceremony: a letters-patent style certificate, shareable as an image. Thresholds are placeholders until there is content to count.

### Currencies and meters

| Meter | In-game name | What it does |
|---|---|---|
| XP | **Prestige** | Total points; drives rank |
| Streak | **Standing** | Consecutive days; a missed day costs Standing, not progress. Streak freeze is called a *Country Weekend* and you get two a month |
| Soft currency | **Guineas** | Earned per session; spent on Estate furnishings (cosmetic only) |
| Mastery | **The Collection** | Items reaching SRS stability threshold are "acquired" and appear in the Estate |

No hard currency in MVP. No hearts. No energy. No loot boxes, ever.

### Spaced repetition

Every item is an SRS card. Scheduler: FSRS via the `ts-fsrs` library (open source, the algorithm Anki adopted in 2023; confidence high that it exists and is maintained, moderate on exact version details). Due cards surface as **Correspondence** at the start of each session. An item is "acquired" into the Collection when its predicted retention crosses a threshold and it has been answered correctly across at least three separate days.

---

## 6. The Estate

The player's house is the collection screen and the emotional payoff. It starts as a modest hall and grows a wing per discipline as the user progresses.

- **Visual:** a 2D cross-section elevation in an engraving style, SVG, rooms lit as they unlock. Not isometric, not 3D. Cheap to make, fits the tone, works on a phone.
- **Furnishing:** acquired items appear as thumbnails on the walls (paintings in the Gallery), as spines on shelves (scores in the Music Room), as playbills in the Opera Box, as ancestral-style portraits along the Long Gallery (history). Tapping one replays the item and its remark.
- **Guineas** buy cosmetic upgrades: a better chandelier, a Canaletto over the mantelpiece you have not earned yet (it hangs "on loan" until you acquire it, which is a small joke and a real nudge).
- **Share card:** a rendered image of your Estate with rank and item count, for the one social channel that matters at this stage (people showing friends).

---

## 7. The Grand Tour (campaign)

The campaign structure is the historical Grand Tour: the 17th to early 19th century journey through France and Italy that was, literally, the aristocratic education. Cities are units; each city weights its lessons toward what the city is actually known for. This aligns the curriculum with geography, which helps memory (a natural method of loci) and gives the whole thing a narrative spine.

| Order | City | Weighted content | Release |
|---|---|---|---|
| 1 | London (Departure) | Fundamentals: eras, voice types, forms, the ten paintings everyone knows; Handel, Purcell, Turner, Constable; the Conquest, the Tudors, the Restoration, the Regency, the fall of the Lords | MVP |
| 2 | Paris | Louvre canon; Impressionism and after; Debussy, Ravel, Berlioz; Opéra Garnier; Bizet, Gounod; Versailles, the salons, the Revolution, Napoleon, Dreyfus | MVP |
| 3 | Florence | Renaissance: Botticelli, Michelangelo, Leonardo; the Uffizi; early opera's origins (the Florentine Camerata); Dante, the Medici, Savonarola, Machiavelli, Galileo | MVP |
| 4 | Vienna | Haydn, Mozart, Beethoven, Schubert, Brahms, Mahler; the Strausses; Klimt and the Secession; the 1683 siege, Maria Theresa, the Congress, Mayerling, the end of the Habsburgs | MVP |
| 5 | Rome | Baroque: Bernini, Caravaggio, Borromini; Palestrina; the Tosca locations | v2 |
| 6 | Venice | Titian, Tintoretto, Canaletto; Vivaldi, Monteverdi; La Fenice; the Biennale | v2 |
| 7 | Naples | Caravaggio's late work; Teatro di San Carlo; the Neapolitan school and song | v2 |
| 8 | Milan | La Scala; Verdi, Puccini; Leonardo's *Last Supper* | v2 |
| 9 | Dresden and Munich | Wagner and Strauss; the Old Masters galleries; Bavarian Rococo | v3 |
| 10 | St Petersburg | The Hermitage; Tchaikovsky, Mussorgsky, Stravinsky; the Ballets Russes bridge to Paris | v3 |
| 11 | Return (Country House) | Consolidation; Titles, Etiquette, Architecture of the English house | v3 |

Each city is 6 to 10 lessons and carries a history strand weighted to that city's own story (per-city list in [`HISTORY.md`](HISTORY.md), section 3). Lessons within a city are unlocked in order; cities are unlocked in order. A "Season Ticket" (free) lets a user jump ahead to a later city after passing a placement test, so an expert is not forced through the fundamentals.

---

## 8. The Season and social features (v2 onward)

**The Season** is the live-ops layer, named after the London social season. It is a rolling six-week event whose content is synchronised with the real cultural calendar, so that what the user learns is what people are currently talking about.

| Real event | Approximate timing | Themed content |
|---|---|---|
| Glyndebourne, Chelsea Flower Show | May to August | English opera; the garden as art |
| Royal Ascot | June | Dress codes, precedence |
| BBC Proms | mid-July to mid-September | Orchestral repertoire, British music |
| Bayreuth, Salzburg | late July to August | Wagner; Mozart and Strauss |
| Metropolitan Opera opening | late September | The Met's season repertoire |
| Venice Art Biennale | odd years, roughly April to November | Contemporary art literacy |

**Salons** are leagues: cohorts of about 30 players ranked weekly by Prestige, with promotion and relegation between tiers (Provincial Salon, Town Salon, Court). Duolingo has publicly credited leagues with large engagement gains (moderate confidence on the specific figures, so none are quoted). Leagues are also the feature most at odds with the tone, so tier names and copy must stay dry.

**Duels** are asynchronous head-to-heads on the same ten questions.

**Patronage** is the referral system: a Patron and a Protégé each earn Guineas when the Protégé reaches Esquire.

None of this is in the MVP. Social features on top of thin content are a graveyard.

---

## 9. Content model and sourcing

Content is the whole business. A connoisseurship app that gets a fact wrong is dead on arrival, so every item carries a source and passes human review. Drafting can be machine-assisted; approval cannot.

### Item schema (draft)

```yaml
id: opera.puccini.tosca.e-lucevan-le-stelle
discipline: opera
kind: work            # work | creator | movement | term | venue | scenario | episode | person | apocrypha
title: "E lucevan le stelle"
parent: "Tosca (1900)"
creator: "Giacomo Puccini"
year: 1900
era: "Verismo / late Romantic"
difficulty: 1         # 1 easy, 2 standard, 3 hard
media:
  audio:
    file: audio/tosca-e-lucevan.mp3
    seconds: 18
    source: "Enrico Caruso, Victor, early 1900s; exact recording to be selected"
    license: "Public domain in the US if published before 1926; verify for other jurisdictions"
facts:
  - "Sung by Cavaradossi in Act III, awaiting execution."
  - "Premiered at the Teatro Costanzi, Rome, 14 January 1900."
remark: "The clarinet sings the whole tune before the tenor does; Puccini gives away the melody on purpose."
gaffe: "Referring to Scarpia as the tenor. Scarpia is a baritone."
distractors:
  composer: ["Verdi", "Mascagni", "Leoncavallo"]
  work: ["Nessun dorma", "Che gelida manina", "Recondita armonia"]
tags: [aria, tenor, verismo, rome, 1900s]
sources:
  - "Grove Music Online, 'Tosca'"
reviewed_by: null
```

Two more samples to show the range (history samples, using the `episode` and `apocrypha` kinds, are in [`HISTORY.md`](HISTORY.md), section 8):

```yaml
id: art.vermeer.girl-with-a-pearl-earring
discipline: art
kind: work
title: "Girl with a Pearl Earring"
creator: "Johannes Vermeer"
year: 1665            # approximate
era: "Dutch Golden Age"
difficulty: 1
media:
  image:
    file: img/vermeer-girl-pearl.webp
    source: "Mauritshuis, The Hague"
    license: "Public domain image; verify the specific file's licence"
facts:
  - "Hangs in the Mauritshuis, The Hague."
remark: "It's a tronie, not a portrait: a study of a type and an expression, not a picture of a particular sitter."
gaffe: "Attributing it to Rembrandt, or asking who the girl was as if that were known."
distractors:
  creator: ["Rembrandt", "Frans Hals", "Gerard ter Borch"]
tags: [painting, baroque, netherlands, 1600s]
```

```yaml
id: music.beethoven.symphony-5.i
discipline: music
kind: work
title: "Symphony No. 5 in C minor, Op. 67, first movement"
creator: "Ludwig van Beethoven"
year: 1808
era: "Classical / early Romantic"
difficulty: 1
media:
  audio:
    file: audio/beethoven-5-i.mp3
    seconds: 15
    source: "TBD: Musopen or other CC0 performance"
    license: "TBD"
remark: "The 'fate knocking at the door' line comes from Beethoven's secretary Schindler, whose reliability scholars doubt. Say that, and you sound like you've read something."
gaffe: "Calling it the Fifth Piano Concerto (that is the 'Emperor')."
distractors:
  creator: ["Haydn", "Mozart", "Schubert"]
tags: [symphony, vienna, 1800s]
```

### Sourcing

| Need | Source | Licence | Confidence / note |
|---|---|---|---|
| Paintings, drawings, sculpture photos | The Met Open Access, Art Institute of Chicago API, Cleveland Museum of Art Open Access, National Gallery of Art (US) open data, Smithsonian Open Access, Rijksmuseum, Paris Musées, Wikimedia Commons | CC0 or public domain | High that these programmes exist. Rijksmuseum changed its API recently; verify the current endpoint |
| Zoom-out crops | IIIF image servers from the museums above | Same as image | High; IIIF supports region requests natively |
| Portraits and history paintings | The same museum programmes; Wikimedia Commons files tagged public domain | CC0 or public domain | High. UK institutions often claim rights in their own photographs of public-domain paintings, so take portraits only from explicit open-access releases or from Commons files with a clear tag |
| History facts and Apocrypha verdicts | Standard scholarly biographies and reference works; the primary source wherever a verdict rests on one (Rousseau, Tacitus, Ries) | n/a | Editorial. The Apocrypha strand ships nothing without a citation |
| Classical music recordings | Musopen (CC0/CC recordings), Wikimedia Commons, IMSLP's recordings section | CC0 / CC-BY / PD | Moderate. Coverage is uneven; solo piano and chamber are well covered, opera and large orchestral less so |
| Historic opera recordings | US recordings published before 1926 (Caruso, Melba, early Chaliapin, Galli-Curci) | Public domain in the US under the Music Modernization Act; in the EU, recordings published before 1963 are generally out of term | Moderate-high on the law; avoid the Internet Archive's Great 78 Project as a source while its litigation with the major labels remains unresolved (check current status before relying on it either way) |
| Composer and work metadata | Wikidata; Open Opus API | CC0 | High for Wikidata; moderate for Open Opus (verify it is still maintained) |
| Literary text | Project Gutenberg, Wikisource | Public domain | High |
| Pronunciation audio | Record it, or TTS with a human check | Own | High |
| Facts and remarks | Editorial: drafted with machine assistance, checked against Grove, museum catalogues, standard references, then signed off by a human | Own | This is the cost centre |

**Content volume targets**

| Release | Items | Remark scenarios | Audio clips | Images |
|---|---|---|---|---|
| MVP (v0.1) | 300 (80 each for music, opera, art; 60 history) | 50 | 110 | 150 |
| v0.2 | 720 | 130 | 250 | 300 |
| v1.0 | 1,800 | 320 | 550 | 650 |

The audio column is the schedule risk. If public-domain opera coverage proves too thin, the fallback is to commission short recordings or use synthesised renderings for *thematic* recognition (a clean piano reduction still teaches "which tune is this"), while reserving real recordings for the items where the voice matters.

---

## 10. Tech stack (recommendation, not a survey)

**Platform: progressive web app first, native wrappers later.**
One codebase, installable to the home screen, no store review during the period when the product changes weekly. Web push on iOS has worked for installed PWAs since iOS 16.4, so daily reminders are possible. When the product is stable, wrap the same build with Capacitor for App Store and Play Store presence. Confidence: high that this is the right call for a solo or small team; the cost is slightly worse iOS polish, which is acceptable at this stage.

**Stack**

| Layer | Choice | Why |
|---|---|---|
| Framework | Vite + React + TypeScript | Boring, fast, the largest example base; Capacitor-friendly |
| Styling | Tailwind + a small custom design token set (ivory, oxblood, gilt, one serif, one sans) | Restraint needs a system, not a UI kit |
| PWA | vite-plugin-pwa (Workbox) | Offline lessons; install prompt |
| Local data | IndexedDB via Dexie | Progress, SRS state, downloaded lessons; works without an account |
| SRS | ts-fsrs | See section 5 |
| Content | YAML in `content/`, validated by a Zod schema, compiled to JSON at build | Editors touch YAML, the app touches JSON; validation catches missing licences and sources |
| Media | MP3 clips at 128 kbps (plays everywhere), WebP images at three sizes | No codec games |
| Hosting | Cloudflare Pages or Vercel, static | Free tier is enough for a long time |
| Accounts and sync (v2) | Supabase (auth, Postgres, row-level security) | Adds leagues and duels without running a server |
| Payments (v3) | Stripe | Patron subscription |
| Analytics | Plausible or PostHog, minimal events | Retention, not surveillance |
| Tests | Vitest for logic (scheduler, grading), Playwright for the lesson flow | The scheduler and the content validator are the two things that must not silently break |

**Repository layout (proposed)**

```
aristocracy/
  content/            # YAML items, scenarios, cities, lessons
  scripts/            # validate-content, build-content, fetch-media
  public/media/       # audio and images with licence manifest
  src/
    app/              # routes: Today, Estate, Tour, Collection, Settings
    exercises/        # one component per exercise type
    engine/           # scheduler (FSRS), session builder, grading, ranks
    content/          # typed loaders for compiled JSON
    ui/               # design system primitives
  docs/               # this outline, content style guide, licence policy
```

---

## 11. Scope by release

| Release | Name | Contents | Done when |
|---|---|---|---|
| v0.1 | The Departure | 4 disciplines; 300 items; 8 exercise types (1 to 8 above); Grand Tour cities 1 to 4; ranks to Baron; Estate with 4 wings; Standing streak; FSRS reviews; local-only progress; share card. No accounts, no social, no payments | 20 outside testers complete 7 consecutive days and the content review log shows zero unresolved factual flags |
| v0.2 | The Season | Accounts and sync; Salons; Duels; cities 5 to 8; Architecture and Literature; exercise types 9 to 15; iOS and Android wrappers | Week-4 retention is measured and the number is written down |
| v0.3 | The Court | Live Season events; Patron subscription; Titles and Etiquette; cities 9 to 11; Ballet, Wine | First paying users |

The MVP is deliberately small on features and comparatively large on content. History adds items but almost no engineering: two new exercise components and three content kinds. Feature work without content is a demo.

---

## 12. Metrics

| Metric | Why it matters |
|---|---|
| D1, D7, D30 retention | The only number that matters for a habit product |
| Sessions per user per week | Should approach 5 or more if the loop works |
| Items acquired per active week | Learning actually happening |
| Remark correct rate by tier | Whether the conversational skill is transferring |
| Rank distribution | Where people stall; a cliff at Knight means city 1 is too long |
| Content flags per 1,000 sessions | Accuracy is the brand |

No targets are set until there are 200 users; guessing benchmarks now would be theatre.

---

## 13. Risks and mitigations

| Risk | Severity | Mitigation |
|---|---|---|
| Factual errors in content | Fatal to credibility | Sources on every item; two-person review; in-app "dispute this" button that files a flag; no unreviewed item ships |
| Audio rights and coverage | High; the schedule risk | Public-domain-only policy enforced by the content validator; synthesised fallbacks for thematic recognition; commission where needed |
| Tone drifts to camp or to snobbery | High; either kills the audience | Written tone guide: "the knowing wink." The app knows you are playing at being a duke, and so do you. Copy is dry, never arch; it never mocks the user for not knowing |
| Trivia creep | Medium | Item acceptance rule: if the fact cannot be used in a sentence at dinner, it does not go in |
| History drifts into contested narrative or live politics | Medium | The filter keeps to courts, patrons, art, scandal and myth; nothing that is a live political dispute goes in; every Apocrypha verdict is sourced or cut |
| Scope creep across disciplines | Medium | Three disciplines in MVP, enforced |
| "Aristocracy" as a name alienates | Medium | Keep as working title; test public names (section 14) |
| PWA limitations on iOS (audio autoplay, background, install friction) | Medium | Audio always follows a user tap; Capacitor wrappers in v0.2 |

---

## 14. Decisions taken and decisions needed

**Assumed unless you object:**

1. Platform: PWA first, native wrappers in v0.2.
2. Tone: the knowing wink (see risks).
3. Title system: British, with the user choosing style.
4. Language: English UI; foreign terms with pronunciation.
5. MVP disciplines: Music, Opera, Art, History. Etiquette and Titles wait for v2 even though they fit the theme, because they are the hardest to source authoritatively and the easiest to get subtly wrong.
6. No monetisation in MVP.

**Needs your call:**

1. **Public name.** Candidates: *Peerage* (clean, one word, says the progression system), *Grand Tour* (the best metaphor, but Amazon's motoring show of that name is a trademark problem in entertainment classes), *The Season*, *Salon*, *Noblesse*. Recommendation: *Peerage* for the product, *The Grand Tour* as the campaign name inside it. Trademark search required either way.
2. **Content authorship.** Who writes and reviews the 240 MVP items? Options: you with machine-assisted drafting and a paid reviewer; a commissioned editor; or ship a smaller, fully-verified set. Recommendation: a smaller verified set beats a larger unverified one, every time.
3. **Web vs. native as the eventual home.** If you already know you want to be in the App Store on day one, say so now; it changes the first month.

**Next step if approved:** scaffold v0.1 as scoped in section 11, starting with the content schema and validator, then the session engine, then the six MVP exercise types, with a seed of about 30 verified items so the loop can be played end to end before any content push.
