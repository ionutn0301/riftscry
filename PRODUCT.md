# RiftScry product contract

Current contract for the Rift atlas platform, established 31 October 2026, with
the single-world Rift Cinema homepage revision of 2 November 2026. This document and
[DESIGN.md](DESIGN.md) supersede earlier presentation storyboards. The
[platform audit](docs/signal-journey/AUDIT.md) records the scope and cleanup;
[the platform research](docs/signal-journey/RESEARCH.md) and
[current homepage record](docs/rift-cinema/README.md) explain their respective
design decisions.

## Purpose

RiftScry connects exact League of Legends archive records with available player
match history. A visitor can follow a champion's change, discover what moved
since a recorded game, inspect the evidence, and keep something useful for the
next visit. The shared interaction is **choose → reveal → inspect → keep**.

The homepage is one full-screen League world, with official Akali, Yasuo and
Thresh artwork over a painted Summoner's Rift environment. Looking around and
choosing a champion change the view; inspection opens that champion's exact
archived change in a dialog. The entrance has no scroll-driven chapters. Its
navigation exposes the existing application destinations, and returning visitors
can resume a selected player or public archive context. The entrance offers a
direct remembered briefing and an exact archive reading link without requesting
player data. Patch changes lead to personal item
impact; impact and loadout scenes link to their actual source match and its
explicit AI action. Personal briefings build from available records without
requiring a note, build entry, preparation card, or reflection. Each route
supports the same journey and remains a direct entry.

RiftScry is an independent hybrid Astro application: prerendered archive and
briefing shells, server-rendered player routes, and a protected server-side Riot
API with optional AI review. Personalization is browser-local. Looking up an
account does not verify ownership or create a synchronized RiftScry account.

## One journey, distinct useful destinations

Away from the homepage, the shared shell keeps one task chapter active with
JavaScript. Named scene
controls and guarded wheel/swipe gestures move between tasks; longer evidence
grows in the ordinary document, with a separate gesture at its boundary changing
the chapter. A
spatial atlas and persistent destination path keep every chapter connected.
The header provides **Discover, My game, and Saved**. The map exposes Briefing,
Games, Champions, Patches, and Saved, with comparison and notebook shortcuts.
Direct links, URL scope, browser Back, search, and reduced motion remain integral.
The homepage uses its own full-screen composition and native navigation/evidence
dialogs; long evidence remains readable within the dialog without scrolling the
world itself.

| Route | Product job |
| --- | --- |
| `/` | Enter the League world, choose Akali/Yasuo/Thresh, inspect an exact archived change, or resume remembered context. |
| `/explore` | Follow a selected champion and field through exact changes, an explicit interval, and kept findings. |
| `/next-game` | Assemble a focus, patch catch-up, supported patch-impact calculations, and the recorded final loadout from imported games. |
| `/players` | Look up a player or resume the remembered player with the selected task and filters. |
| `/players/:platform/:puuid` | Inspect the verified identity, recent matches, observed builds, and player-scoped Build Memory. |
| `/matches/:id` | Inspect a recorded match, optionally request more evidence or AI interpretation, and keep a loadout or adjustment. |
| `/champions` | Search the complete committed roster and preview a champion before entering their history. |
| `/champion/:slug` | Move through a champion's dated records, inspect sources, and retain that subject. |
| `/patches` | Choose a dated archive moment through the timeline and ordinary patch links. |
| `/patch/:id` | Focus on a champion, item, system, or hotfix record while retaining filters and sources. |
| `/compare/:newer/:older` | Inspect changes across two explicit archive endpoints, optionally scoped to a subject. |
| `/pool` | Reopen kept findings, review saved champions against the archive baseline, and edit the champion pool. |
| `/notebook` | Use private notes and retained loadouts; preparation cards, reflections, and backups are optional. |
| Unknown route | Provide a clear route back to the archive or another useful destination. |

`/patch`, `/compare`, and `/compare/:patch` remain archive-aware shortcuts. The
current route inventory and implementation scope are in the platform audit.

## Evidence and player boundaries

- **Archive truth:** exact before/after strings, rank arrays, scaling, units,
  conditions, original prose, canonical champion IDs, and Riot sources survive
  presentation changes. Archive dates and counts come from committed data. Use
  “latest archived”; a successful build is not proof of current live balance data.
  Scheduled ingestion proposes data through pull requests, not automatic merging.
- **Interpretation:** classifications describe records, not measured champion
  strength or predicted wins. Compare intervals are `(older, newer]`. A quiet
  interval means no direct records in that scope, not that the champion was
  unaffected by items, systems, or the rest of the game.
- **Available games:** import at most 20 recent match IDs in batches of four.
  All recent games has no upstream queue/type restriction; a selected mode uses
  the exact queue. Partial imports, unsupported records, unknown values, API
  errors, and cooldowns stay visible. Missing records never become losses.
- **Exact contexts:** ranked Solo/Duo, ranked Flex, normal Draft, Swiftplay,
  Quickplay, ARAM (`450`), Mayhem (`2400`), and ARAM Clash (`720`) remain separate.
  The full catalogue and capability rules live in
  [modes.ts](src/lib/player/modes.ts). There is no all-mode performance average.
  Non-lane and augment modes do not inherit standard Summoner's Rift advice.
  Checked Mayhem availability metadata explains empty imports without blocking
  real records or substituting ordinary ARAM. Current official rank is separate
  from the imported match sample.
- **Automatic preparation:** the briefing uses deterministic evidence. It needs
  no timeline, AI review, rank, or summoner-profile request. Patch impact uses
  supported historical references, a recorded inventory, and visible formulas,
  assumptions, exclusions, and sources; it does not simulate an entire fight.
  Unknown patch baselines and unsupported calculations remain explicit.
- **Automatic progress:** Momentum in the briefing starts one target for an
  eligible comparison context from the latest three to five valid games. It
  freezes that median and target before checking the next three games started
  after creation. Champion, exact queue, known role/context and game-version
  pair must match. Supports do not receive farming targets; ARAM uses valid
  team participation only. Short/remade games and missing measurements do not
  count as failure. Incomplete imports, storage failures and history gaps pause
  evaluation. A completed cycle retains its observed results and can start the
  next focus automatically. A sample high requires at least three prior
  comparable imported games and is not a lifetime record or a skill grade.
  A useful latest-game observation remains available before a target can start.
  Momentum is separate from authored notes and does not confirm Build Memory.
- **Useful first result:** a validated imported game can provide an observation
  before a comparable history exists. During an initial import, loaded records
  may produce a clearly provisional factual card; Momentum and patch/session
  presentation keep their settled-sample boundaries. Background refreshes retain
  the previous source until the new import settles. An active target takes
  precedence; an unrelated completed receipt stays secondary. Missing or corrupt
  browser storage does not remove current match facts. Mode discovery describes
  exact queues actually found and does not combine their performance statistics.
  Selecting a mode remains an explicit bounded history request. Lookup preserves
  a valid incoming queue/champion scope; empty and failed results expose recovery.
  This layer adds no automatic API request, new storage, account entitlement,
  analytics event or rank dependency. See [first-result contracts](docs/first-result/README.md).
- **Optional review:** a timeline loads on request or through a direct
  event-evidence link. AI review requires its own explicit action. AI
  interpretation is labelled; validation constrains its evidence references and
  numeric claims without proving every qualitative interpretation. Failure leaves
  the recorded match usable. Local notebook text
  and Build Memory notes are not sent to AI. Imported history is not a live-client
  connection or an in-game overlay.

## Continuity and deliberate saving

Selecting a valid player or public archive subject can remember context. It must
not silently keep a finding, create a notebook record, mark a patch reviewed,
start a game card, or confirm that a saved adjustment applied in a later game.
The following storage contracts remain distinct:

| State | Storage and behavior |
| --- | --- |
| Selected archive subject | `riftscry:signal-context:v1`: validated champion/name and an internal public reading URL, with optional patch/event. No player identity or authoring URL is stored here. Comparison shortcuts add the subject only when no explicit champion scope exists. |
| Kept findings | `riftscry:kept-findings`: up to 50 exact dated records, saved explicitly, with removal and restoration of the last removed finding. |
| Champion pool | `riftscry:pool`: the existing canonical-ID collection and shared `?champions=` links. |
| Reviewed archive baseline | `riftscry:last-reviewed-patch`: only an explicit Mark reviewed action advances it. |
| Reading resume | `riftscry:resume`: a validated internal archive reading destination; player identities, match-review routes, and authoring state are excluded. |
| Recent player | `riftscry:recent-player:v1`: validated player/server context from lookup or an explicit valid selection. `riftscry:remembered-player:v1` remains a read fallback. Verified account data supplies names; late responses must not replace a newer player selection. |
| Notebook | `riftscry:companion:v1`: context, up to 100 notes, 30 recorded loadouts, and 50 game cards. Writes validate the current stored state. Additive backup import preserves local records by default, rejects incompatible/oversized files and conflicting unfinished cards, and has a 2 MB limit. |
| Build Memory | `riftscry:build-memory:v1:<platform>:<puuid>`: up to 50 private adjustments per player/server. Saving is explicit; generated drafts are reviewable summaries with optional editing. Prospective tracking starts on save or a material revision. Historical games, unknown roles, custom-condition confirmation, and reflection-only edits retain their existing meanings. |
| Momentum | `riftscry:momentum:v1:<platform>:<puuid>`: up to 12 automatically recorded focus cycles with fixed baselines, source match IDs and up to three later results each. Valid complete imports create/check cycles; timestamps and exact contexts prevent retrospective credit. Web Locks serialize cooperating tabs where available. Corrupt data remains untouched; failed writes never claim new saved progress. No cross-device sync or automatic processing while the browser is closed. |
| Motion preference | `riftscry:motion`: the visitor's explicit `full` or `reduced` choice. The homepage uses the operating-system preference when no choice is saved; a saved choice takes precedence. Starting its optional Play tour explicitly enables and saves full motion. Still World stops the tour. |
| Temporary record reuse | `riftscry:player-cache:v1` in session storage: bounded tab-local Riot record/cooldown reuse, not saved notes or persistent AI responses. In-memory reuse remains available when storage fails. |

Keep loadout on a match or observed build saves its actual provenance in one
explicit action and links to `/notebook#loadouts`. Use in a game card carries that
build's champion and exact queue into optional preparation; it does not begin a
card or replace an unfinished one.

Build Memory follow-up eligibility continues to require the same player,
champion, exact queue, patch, compatible recorded role/context, and prospective
time window. Custom conditions require confirmation for each later game;
reflection-only edits preserve the tracking baseline.

Saved champions' “since reviewed” state uses direct archive records after the
baseline. First visits, missing baselines, quiet intervals, caught-up visits, and
unavailable storage have distinct meanings. A rotating “from the archive” record
is dated archive material, not new patch news.

Clearing browser data removes local personalization. There is no automatic
cross-device sync. Failed writes must not claim success; unreadable notebook or
Build Memory data must not be silently overwritten. Direct player links and
archive navigation remain useful when browser storage is unavailable.

## Presentation and verification

Short captions, a recognizable subject, exact evidence, and one primary action
lead each scene. Sources, formulas, filters, and optional authoring remain
inspectable. Use semantic HTML, visible focus, native form controls, accessible
scene tabs and dialogs, and ordinary links. Without JavaScript, server-rendered
archive records and navigation remain readable; player requests and local
personalization need JavaScript.

The homepage uses layered two-dimensional official Riot artwork with optional
WebGL camera and atmosphere effects. It does not contain rigged 3D champion
models, live game telemetry, or a claim about a champion's position in a match.
Retain the [asset manifest](public/images/rift-cinema/asset-manifest.json), the
bundled Cinzel font license, and the third-party Riot disclaimer. Earlier
environment illustrations have separate provenance and are not the homepage's
visual source.

Verification for the current Rift Cinema homepage is recorded in its release
pull request and CI artifacts. The
[homepage record](docs/rift-cinema/README.md) describes the design, sources and
review procedure. The earlier 2 November 2026 relief-instrument revision is
recorded in [pull request #70](https://github.com/ionutn0301/riftscry/pull/70) and
[its historical homepage record](docs/cinematic-instrument/README.md); those
results apply to that superseded implementation.
Do not treat test collection, typechecking, a build, historical screenshots, or
fixture-backed results as a current visual sign-off or a successful live-account
lookup. Earlier release records remain discoverable under [docs](docs/) and in
git history; they describe their own checkpoints.
