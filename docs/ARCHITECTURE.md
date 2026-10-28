# Architecture

RiftScry combines a versioned patch archive, Riot-backed player review, and an automatic
personal briefing. Astro 7 prerenders archive and briefing shells; the Vercel adapter
serves dynamic player routes and API handlers. React islands import and render player data.

## Product routes

| Route | Purpose | Data boundary |
| --- | --- | --- |
| `/` | Introduce automatic preparation, show archive examples and launch the selected player's next task | Prerendered archive examples; validated local identity; no player API requests |
| `/next-game` | Automatic session recap, personal patch catch-up, review focus and recorded loadout | Existing account/history/match/items API; build-time archive |
| `/notebook` | Existing Rift Recall notes, saved loadouts, original cards and backups | Existing browser-local preparation document |
| `/players` | Riot ID lookup with preserved task and filters | Dynamic shell; explicit lookup API request |
| `/players/:platform/:puuid` | Recent matches, observed builds, optional Build Memory | Dynamic shell; Riot API via server; local legacy notes |
| `/matches/:id` | Match facts, optional timeline/AI review, direct automatic briefing link | Requested match API data; optional Build Memory |
| `/champions`, `/champion/:slug`, `/patches`, `/patch/:id`, `/compare/*`, `/pool` | Structured changes and optional personal champion pool | Committed patch data; local pool/reviewed baseline |
| `/explore` | Immersive archive journey | Prerendered content and on-demand archive JSON |

## Homepage

`CompanionHome.astro` introduces the companion with a single hero, an interactive
archive example, three everyday task links, and an archive exploration section.
`HomeReturn.tsx` owns the hero action area: the server-rendered newcomer state offers
briefing and player-lookup links, while the hydrated returning state shows the validated
selected player and server with explicit-identity briefing, match, build and catch-up
links. Change player opens the existing lookup flow. No match-history requests or
claims about new games are made on the homepage.

The launcher uses `readRecentPlayer`, including the legacy remembered-player fallback,
and listens for storage, recent-player and `pageshow` events. When no valid identity can
be read, the public actions remain available. Selecting another identity updates all direct links;
the homepage does not write a second identity or personal-report cache.

`HomeSignals.astro` receives three examples from the build-time `buildHomeSignals`
selector in `src/lib/home-signals.ts`. It prefers readable numeric records from the
newest committed patch, a mix of available source directions, and distinct known
champions. Older patches only fill a shortage and keep their actual patch labels.
Values, champion classifications, source URLs and record anchors come directly from
the archive. The UI says **From the archive**, **Latest archived patch**, and **An
archive example**; it does not present these records as a live patch feed or the selected
player's personal changes.

The example switcher uses native buttons, tab/panel relationships, roving focus and
Arrow/Home/End navigation. It never rotates automatically. The first complete record
and source links are available without JavaScript; selection buttons enable after
initialization. Homepage motion follows both the OS and saved reduced-motion setting.
Legacy homepage journey parameters and hashes still redirect to `/explore` with their
query and reading position intact. See the [homepage audit](homepage-refresh/README.md).

## Patch ingestion and matching

Official Riot patch notes and Data Dragon enter `scripts/patch-ingestion/`. Raw HTML is
cached locally and excluded from git. The pipeline parses, normalizes, classifies, merges
reviewed overrides, and validates records with Zod. Normalized files in
`src/data/patches/*.json` retain source URLs and ingestion metadata.

| Module | Responsibility |
| --- | --- |
| `fetch.ts` | Source retrieval, caching, public patch IDs and Data Dragon version resolution |
| `parse.ts` | Structured champion, item, system and hotfix extraction with coverage reporting |
| `classify.ts` | Deterministic stat semantics; no opaque gameplay impact score |
| `normalize.ts` | Canonical IDs, schema normalization and explicit overrides |
| `validate.ts` | Data validation used by ingestion and CI |
| `index.ts` | Ingestion CLI and reviewable coverage summary |

`src/lib/data.ts` reads the archive at build time. Dates and counts describe committed
coverage, not guaranteed live or complete hotfix coverage. Public patch IDs such as
`26.21` and game/Data Dragon versions such as `16.21.x` are separate identifiers.
`src/lib/patch-context.ts` resolves their relationship from each patch's actual
`assetVersion` and compares only newer matching records. Missing baselines remain unknown.

`src/lib/briefing-archive.ts` serializes champion references, verified item IDs and
numeric before/after records for both the automatic briefing and optional notebook.
Item names alone never establish identity. For archive records without IDs,
`companion-item-identities.json` supplies a small reviewed mapping keyed by exact patch
and source heading, with source-image and patch-catalog provenance. Ambiguous headings
and same-name mode variants remain unmapped. The UI states that archive/item coverage
is partial and that mode-specific rules can also matter.

## Player API

`src/pages/api/player/[action].ts` validates methods, platform, PUUID, queue and match IDs.
It gates access through `src/lib/player/access.ts`; Riot credentials remain server-side.
The request layer caches records, applies regional/application budgets and respects
rate-limit cooldowns. Redis credentials are required for shared cache and budget state;
missing credentials stop player requests with an explicit service error. Process-local
pending-request deduplication supplements the shared cache.

`usePlayerHistory` imports at most 20 recent match IDs for the selected queue, or the
all-mode sample, with detail requests in batches of four. This is not full-history
pagination. Match failures remain visible as incomplete imports. Rank is a current
observation, not a historical LP ledger. Match review distinguishes recorded summary
facts, timeline evidence, deterministic interpretation and explicitly requested AI review.

Mayhem (`2400`) remains separate from regular ARAM (`450`). A published queue ID does
not guarantee history availability. Actual returned matches are used, including genuine
Mayhem records if available. Empty Mayhem imports show the availability explanation;
request failures retain their own error. No report is invented and no queue is silently
substituted. Automatic preparation cannot reconstruct private client-only history.

## Automatic briefing

### Identity and retrieval

`src/lib/player/identity.ts` validates the recent player at `riftscry:recent-player:v1`,
with the existing remembered-player key as a fallback. Successful lookup stores a recent
player automatically; storage failure does not block navigation or the report. Direct
briefing links carry platform and PUUID explicitly, plus validated optional name, queue
and champion. An invalid explicit identity cannot silently open another stored player.
These routes do not verify account ownership or provide cross-device identity sync.

`AutomaticBriefing.tsx` loads account identity and the bounded history sample. It fetches
item metadata only for the displayed observed loadout. It does not request rank,
summoner-profile, timeline or AI-review endpoints. Player profile, build and match links
open this report directly; there is no Save or note-authoring prerequisite.

Automatic checks run every 120,000 milliseconds while the page is visible, and when
focus/visibility returns after that interval. Hidden pages, an active load, history errors
or a cooldown pause checks. The existing browser history cache can retain results for
up to two minutes. Refresh is an explicit retry. Listeners and timers are cleaned up on
unmount; changing player remounts the report with the new identity.

### Derived evidence

`src/lib/player/automatic-briefing.ts` is a deterministic model with no browser-storage
or network dependency. It deduplicates matches, validates player/mode/timestamp context,
sorts by recorded start time, and retains incomplete-sample information.

- **Latest session:** consecutive imported games whose previous end and next start are
  separated by at most 90 minutes. Overlaps or invalid durations stop grouping. Outcomes
  stay separated by queue; time played sums known match durations. The sample edge and
  missing records can make the session incomplete. This is an explicit estimate, not
  knowledge of a player's real-life activity or mental state.
- **Personal patch catch-up:** up to five recent champion/exact-queue contexts, each
  anchored to that context's latest imported match and final item IDs. Selected champion
  context is prioritized. Numeric changes and archive/source-game links expose the
  records behind the result.
- **One review focus:** relevant patch changes take precedence. Otherwise, valid
  comparisons use the same champion, exact queue, role and patch, with three to five
  prior comparable games. Supported metrics follow the existing mode-aware evidence
  rules. A substantial difference is a prompt to inspect, not a grade or cause of a
  win/loss. Sparse samples fall back to a factual latest-game recap.
- **Observed loadout:** final items and applicable runes are obtained from the chosen
  source match automatically. Metadata must match its game patch. Unknown names retain
  IDs; augments modes do not receive standard rune assumptions. A final inventory is
  neither a purchase sequence nor a recommendation.

No user-authored notebook record is used to generate this briefing. Its outputs are
recomputed from imported data rather than saved as personal notes or reflections.

## Existing notebook and Build Memory

`/notebook` retains the existing validated `riftscry:companion:v1` document and its UI:
quick notes, saved loadouts, immutable original cards, self-reported reflections,
removal/undo and previewed backups. Route migration does not rename or clear this key.
The automatic workflow does not require these records. A contextual link remains for
browsers with existing notebook data.

Notebook writes read current storage before validating and persisting. Storage events
refresh other tabs; stale editors preserve their draft and report conflicts. Limits remain
100 notes, 30 loadouts and 50 cards, without silent discarding. Imports preserve matching
local records by default and reject incompatible/oversized files or conflicting unfinished
cards. Its export covers only that document.

Champion pool, archive reading state and player-scoped `riftscry:build-memory:v1:*`
records remain independent. Build Memory retains its existing item/match/evidence
conditions. No local notebook text is sent to an AI service.

## Deployment and verification

The Vercel Git integration builds branch previews and deploys `main`. Existing deployment
protection and Riot access settings are retained. Protected deployments are verified with
authorized short-lived access; a sign-in page is not application verification. Access URLs
and browser credentials are never committed.

CI runs Astro typechecking, Vitest/data validation, production build, player workflows,
and shared desktop Chromium, mobile Chromium and iPhone WebKit tests. The archive
journey retains navigation, motion and recovery coverage at `/explore`. Notebook tests
follow its moved route. Automatic tests cover identity, exact queues, source provenance,
incomplete imports, storage failure and returned results without manual authoring.
