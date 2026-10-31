<p align="center">
  <img src="src/assets/brand/logo-desktop-dark.png" alt="RiftScry" width="420" />
</p>

<h3 align="center">The space between games.</h3>

RiftScry is a League of Legends companion for following what changed and carrying
something useful into the next game. Choose a champion, reveal an exact archive
record, or enter a Riot ID once for an automatic briefing from available match
history. The experience connects those paths across the whole site.

**Current experience: the Rift atlas.** Read the
[platform audit and research](docs/rift-atlas/AUDIT.md).

- **A connected world:** five spatial destinations form the entrance. Preview a
  setting, enter it, and retain your bearings through the persistent route path.
  The same atlas opens from every champion, patch, game, and saved record.
- **One visual journey:** the Beacon, Echoes, Archive, Fracture and Sanctuary
  connect briefings, games, champions, patches and saved material.

- **Choose, reveal, inspect, keep:** the champion-signal path opens on a real archived change,
  moves into its exact evidence, and carries the selected record forward. Featured
  choices change the evidence itself; source dates distinguish archive examples
  from the visitor's games.
- **One coherent journey:** Discover, My game, and Saved anchor the shared header.
  Named scene controls keep one task active, with natural scrolling for longer
  evidence. The map and ordinary links provide direct access to every destination.
  Browser Back, shared URLs, keyboard controls, reduced motion, and no-JavaScript
  archive reading remain part of the design.
- **Context that follows:** valid selected player and archive context can resume
  across routes. Exact before/after values, a champion's dated history, the patch
  timeline, and comparisons use the same evidence-led presentation. Explicit
  date ranges and queue selections retain their scope.
- **Automatic briefing:** `/next-game` discovers recent champions, exact queues and
  recorded loadouts from imported games. It assembles a session recap and a focus
  supported by available evidence. No notes, saved cards or reflections are required.
- **Personal patch catch-up:** compare each recent champion's latest imported game
  against newer archived champion and verified item changes, with before/after
  records and source links. Unknown patch baselines remain unknown.
- **Personal patch impact:** `/next-game#impact` recalculates supported differences
  for the final items in that imported game using exact historical item references.
  Compare listed stats, total shop prices, reviewed damage components and cooldown
  scenarios, with formulas and sources. No build entry is needed. Standard
  Summoner's Rift calculations are distinct from other modes' archived changes.
- **Recent games and builds:** exact-mode history, automatically grouped observed
  loadouts, match facts, and optional timeline or AI-assisted review. Keep loadout
  saves the actual record in one click and opens its notebook destination. The
  bounded sample is not a complete season history or a global build recommendation.
- **Champion archive:** structured changes, your optional champion pool, comparisons,
  and the immersive archive journey at `/explore`.
- **Optional preparation:** `/notebook` retains notes, loadouts, game cards,
  reflections, and backups. A saved loadout can prefill its champion and exact mode.
  Generated Build Memory adjustments open as ready-to-save summaries with Edit
  details available. Saving, starting a card, and marking a patch reviewed remain
  explicit actions, independent of the automatic briefing.

A successful lookup or explicit valid player selection remembers the player on this
browser when storage is available. Direct player links still work without storage.
There is no automatic cross-device account sync or ownership verification. Automatic
results require exposed match history; checked Mayhem availability metadata explains
empty imports without inventing a report or substituting ordinary ARAM. Exact mode
capabilities and source references live in [modes.ts](src/lib/player/modes.ts).

The first implementation passed typecheck, the production build, and 519 unit/integration
tests. Five new atlas DOM cases passed separately, and the production atlas contract
checked 622 generated content pages. Browser QA is pending: the managed preview daemon
was unavailable, the Vercel preview is protected, and the workspace later became unavailable.
Current verification and remaining limits are recorded in the pull request. Earlier screenshots remain
in the historical release documentation and are not presented as the current UI.

## Run it

```bash
pnpm install
pnpm dev
```

`pnpm build` creates Astro/Vercel output: prerendered archive and briefing shells,
plus server-rendered player routes and the protected player API. A static file server
alone cannot serve the player API or populate an automatic briefing. The existing
Vercel Git integration builds previews for PRs and production from `main`.

## How it works

Official Riot patch notes are parsed into schema-validated JSON in
`src/data/patches/*.json`. Astro uses that committed archive to build pages and serialize
relevant patch records. React islands personalize the experience after hydration.

The briefing imports up to 20 recent match IDs using the existing player API and loads
details in bounded batches. A deterministic model derives session groups, recent
champions, patch catch-up and a review focus. Personal comparisons keep the same
champion, exact queue, role and patch. A sparse sample produces a factual recap rather
than a performance claim. Session grouping uses an explicit 90-minute gap estimate.

While visible, the briefing checks for updates every two minutes and when the player
returns after that interval. Cached data may persist for up to two minutes. History
errors and rate limits pause automatic checks; an explicit Refresh can retry them.
The briefing does not request AI reviews, timelines, ranks or summoner profiles.

`/api/player/*` validates access and identifiers, budgets Riot requests, caches records,
and returns private/no-store responses. Production player access requires the configured
Riot access mode, server-side credentials and Redis cache/budget state; see
[the player release notes](docs/player-release.md). Never expose credentials to the
client or commit deployment environment files.

- [Product contract](PRODUCT.md) — current journey, evidence boundaries, and browser-storage semantics
- [Design contract](DESIGN.md) — shared scene model, route presentation, and active implementation map
- [Signal journey audit](docs/signal-journey/AUDIT.md) — platform scope, simplification, and source/dependency cleanup
- [Signal journey research](docs/signal-journey/RESEARCH.md) — references and the decisions they support
- [Architecture](docs/ARCHITECTURE.md) — archive, automatic briefing, player API and optional notebook
- [Automatic briefing release audit](docs/automatic-briefing/README.md) — behavior, boundaries and verification
- [Personal patch impact](docs/personal-patch-impact/README.md) — calculations, coverage, sources and verification
- [Data & methodology](docs/DATA.md) — schema, classification and provenance
- [Contributing](CONTRIBUTING.md) — checks and contribution workflow

Earlier presentation checkpoints and captures remain discoverable in the
[connected observatory](docs/connected-observatory/README.md),
[cinematic observatory](docs/cinematic-observatory/README.md),
[cinematic continuity](docs/cinematic-everywhere/README.md), and
[homepage refresh](docs/homepage-refresh/README.md) records, and in git history.
Their designs and verification results describe those earlier commits.

## Commands

| Command | What it does |
|---|---|
| `pnpm dev` | Dev server |
| `pnpm build` | Astro/Vercel production build |
| `pnpm check` | Typecheck Astro and TypeScript |
| `pnpm test` | Unit tests and schema validation of committed patch data |
| `pnpm e2e` | Playwright shared browser suite (build first) |
| `pnpm exec playwright test --config=playwright.player.config.ts` | Player and automatic briefing integration against the dev server |
| `pnpm ingest 26.17` | Ingest a patch from the official notes |
| `pnpm ingest --validate` | Re-validate committed patch files offline |

## Legal

RiftScry is not endorsed by Riot Games and does not reflect the views or opinions of Riot
Games or anyone officially involved in producing or managing Riot Games properties. Riot
Games and League of Legends are trademarks or registered trademarks of Riot Games, Inc.
Champion imagery via Riot's [Data Dragon](https://developer.riotgames.com/docs/lol#data-dragon).
Code is [MIT](LICENSE); normalized patch data derives from Riot's official patch notes,
with a source link recorded in every patch file.
