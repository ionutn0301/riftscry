# RiftScry product contract

Current contract for the Rift atlas, 31 October 2026. This document and
[DESIGN.md](DESIGN.md) supersede earlier presentation storyboards. The
[platform audit](docs/signal-journey/AUDIT.md) records the scope and cleanup;
[the research](docs/signal-journey/RESEARCH.md) explains the design decisions.

## Purpose

RiftScry connects exact League of Legends archive records with available player
match history. A visitor can follow a champion's change, discover what moved
since a recorded game, inspect the evidence, and keep something useful for the
next visit. The shared interaction is **choose → reveal → inspect → keep**.

The homepage begins with five connected spatial destinations and a direct briefing
action. Its champion-signal branch reveals a real, identified archive record. Returning visitors
can resume a selected player or public archive context. Personal briefings build
from available records without requiring a note, build entry, preparation card,
or reflection. Each route supports the same journey and remains a direct entry.

RiftScry is an independent hybrid Astro application: prerendered archive and
briefing shells, server-rendered player routes, and a protected server-side Riot
API with optional AI review. Personalization is browser-local. Looking up an
account does not verify ownership or create a synchronized RiftScry account.

## One journey, distinct useful destinations

With JavaScript, the shared shell keeps one task chapter active. Named scene
controls move between tasks; longer evidence grows in the ordinary document. A
spatial atlas and persistent destination path keep every chapter connected.
The header provides **Discover, My game, and Saved**. The map exposes Briefing,
Games, Champions, Patches, and Saved, with comparison and notebook shortcuts.
Direct links, URL scope, browser Back, search, and reduced motion remain integral.

| Route | Product job |
| --- | --- |
| `/` | Enter the spatial atlas or follow a champion signal; resume remembered context. |
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
| Motion preference | `riftscry:motion`: the visitor's preference, combined with the operating-system reduced-motion setting. |
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

Original environment art and official Riot artwork have separate provenance;
retain the [asset record](public/images/voyage/README.md) and third-party Riot
disclaimer. The visual treatment does not grant asset-policy clearance.

Current verification is still in progress. The pull request and its CI runs must
identify the tested commit, checks, browser captures, and remaining limitations.
Do not treat test collection, typechecking, a build, historical screenshots, or
fixture-backed results as a current visual sign-off or a successful live-account
lookup. Earlier release records remain discoverable under [docs](docs/) and in
git history; they describe their own checkpoints.
