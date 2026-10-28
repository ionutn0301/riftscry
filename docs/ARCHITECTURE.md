# Architecture

RiftScry combines a versioned patch archive, Riot-backed player review, and a browser-local
preparation workspace. Astro 7 prerenders the archive and preparation shell; the Vercel
adapter serves the dynamic player routes and API. React islands provide interactive state.

## Product routes

| Route | Purpose | Data boundary |
| --- | --- | --- |
| `/` | Explain the companion and offer direct next actions | Static content; local returning-player state |
| `/next-game` | Rift Recall, quick notes, saved builds, reflection and preparation transfer | Browser storage; build-time archive metadata; no player API or AI request |
| `/players` | Riot ID lookup with preserved task and filters | Dynamic shell; explicit player API request |
| `/players/:platform/:puuid` | Recent matches, observed builds, Build Memory | Dynamic shell; Riot API via server; local notes |
| `/matches/:id` | Match facts, optional timeline and AI review, save a build/note | Requested match API data; local preparation |
| `/champions`, `/champion/:slug`, `/patches`, `/patch/:id`, `/compare/*`, `/pool` | Structured changes and personal champion briefing | Committed patch data; local pool/reviewed baseline |
| `/explore` | Immersive archive journey | Prerendered content and on-demand archive JSON |

## Patch ingestion

Official Riot patch notes and Data Dragon enter `scripts/patch-ingestion/`. Raw HTML is
cached locally and excluded from git. The pipeline parses, normalizes, classifies, merges
reviewed overrides, and validates records with Zod. Normalized files in
`src/data/patches/*.json` are committed with source URLs and ingestion metadata.

| Module | Responsibility |
| --- | --- |
| `fetch.ts` | Source retrieval, caching, public patch IDs and Data Dragon version resolution |
| `parse.ts` | Structured champion, item, system and hotfix extraction with coverage reporting |
| `classify.ts` | Deterministic stat semantics; no opaque gameplay impact score |
| `normalize.ts` | Canonical IDs, schema normalization and explicit overrides |
| `validate.ts` | Data validation used by ingestion and CI |
| `index.ts` | Ingestion CLI and reviewable coverage summary |

`src/lib/data.ts` reads this archive at build time. Dates and counts describe committed
coverage; they are not a guarantee of live or complete hotfix coverage. Public patch IDs
(such as `26.21`) and game/Data Dragon versions (`16.21.x`) are separate identifiers.
Preparation resolves their relationship from each patch's actual `assetVersion`.

## Player API

`src/pages/api/player/[action].ts` validates methods, platform, PUUID, queue and match IDs.
It gates access through `src/lib/player/access.ts`. Riot credentials remain server-side.
The request layer caches records, applies regional/application budgets and respects
rate-limit cooldowns. Configured Redis credentials are required for shared cache and
budget state; missing credentials stop player requests with an explicit service error.
Process-local pending-request deduplication supplements the shared cache.

History currently imports at most 20 recent match IDs for the selected exact queue.
Client batching limits simultaneous detail requests; it is not pagination. Rank is a
current observation, not a historical LP ledger. Match review distinguishes summary
facts, timeline evidence, deterministic interpretation and an explicitly requested AI
review. Failed optional services do not rewrite local notes.

Mayhem (`2400`) remains separate from regular ARAM (`450`). Its published queue ID does
not imply API history availability. The unavailable-history state preserves genuine
returned records, real request errors and local notes; it does not invent an empty
history or replace the requested queue silently.

## Browser preparation and Rift Recall

`src/lib/companion.ts` defines a versioned, validated preparation document at
`riftscry:companion:v1`:

- Quick notes carry optional champion, exact queue and manually chosen situation,
  plus source/creation and reviewed-patch context.
- Saved builds retain the source player/server/match, observed final inventory and
  permitted runes. They are references chosen by the user, not meta recommendations.
- Recall cards snapshot the chosen note/build and game context. Later edits, deletions
  or patch acknowledgments do not rewrite a past card.
- Reflections are explicitly self-reported (`helped`, `retry`, `not-applicable`). They
  do not certify that a match occurred or attribute a win to an adjustment.

Matching is deterministic and visible: champion, exact queue, and the situation the user
selected. General notes can apply broadly; a pinned note cannot cross incompatible
context. Patch review links newer matching champion or authoritative item-ID records.
Missing baselines remain unknown, and reviewed baselines never replace original source
patches. Item names alone are not used to infer changed items.

For older archive records without item IDs, `companion-item-identities.json` contains a
small, explicitly reviewed supplement keyed by exact patch and source heading. Every
mapped ID has an item-ID asset in Riot's source notes and a checked entry in that patch's
Data Dragon catalog. Ambiguous headings and same-name mode variants remain unmapped;
the UI explains that this is partial coverage. No catalog is fetched during preparation.

Writes read the latest stored state, validate before persisting, then notify same-page
subscribers. Storage events refresh other open tabs. Failures keep the previous data and
show an error. Limits are 100 notes, 30 builds and 50 cards; old records are not silently
discarded. Import previews an additive merge, preserves local conflicts by default,
rejects incompatible/oversized files, and refuses to merge two independently unfinished
cards without a user resolving one first.

Preparation export contains this document only. The existing `riftscry:pool`, archive
reading state and player-scoped `riftscry:build-memory:v1:*` records remain independent.
Build Memory continues to require its original item/match/evidence conditions; generic
quick notes do not weaken those rules. No local notes are sent to an AI service.

## Deployment and verification

The Vercel Git integration builds branch previews and deploys `main`. Existing deployment
protection and Riot access settings are retained. A successful HTML response that is a
Vercel sign-in page is not application verification; protected deployments are tested with
authorized, short-lived access without committing access URLs or browser credentials.

CI runs Astro typechecking, Vitest/data validation, a production build, player browser
tests, and shared desktop Chromium, mobile Chromium and iPhone WebKit tests. Visual
changes include desktop and 390px before/after captures. The old archive journey retains
its navigation, reduced-motion and recovery coverage at `/explore`; homepage and
preparation tests cover the companion's current actions and full local lifecycle.
