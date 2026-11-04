# RiftScry: make the next decision easier

Research and implementation: 4 November 2026 (Europe/Bucharest).
Audited main: `f3ac536`. This is a qualitative product audit, not a representative
player survey, competitor benchmark, accessibility certification or live-service sign-off.

## Recommendation

Position RiftScry as **the clear, evidence-backed companion between games**:
open your briefing, understand a relevant change or decision, carry one focus
forward, and return to see your own progress. Its strongest existing advantage
is connecting exact historical patch changes to a player's actual games and
items. Make that connection easier to find before adding another dashboard.

“One focus,” AI review, progress tracking and personalized builds are already
competitive categories. Do not market them as exclusive. The opportunity to test
is a short browser workflow with understandable reasoning, source links and
honest limits. Return visits should follow useful learning and saved progress;
there is no need for streak penalties, urgency or pressure to queue again.

## Current functionality and audit findings

Source inspection covered routes, primary React islands, match contracts,
metadata, mode capabilities, storage documentation and CI. Production homepage
and briefing entry were also inspected in the browser. Imported player services
were not independently exercised with a live Riot account.

| Area | Already implemented | Finding / action |
| --- | --- | --- |
| Homepage | Cinematic champion artwork, real archive example, search, direct routes, reading resume, motion controls | Strong identity; personal briefing was secondary and disappeared from the main action area when reading resume was present. Make briefing primary. |
| First use | Riot ID/server lookup, guest access, guide, validation and recovery | Keep one short lookup. Guide now offers Before I play / After a match / Returning to League routes. |
| Personal briefing | Bounded recent history, exact modes, sparse first result, automatic visible-page refresh | Valuable existing core. No need to build a second dashboard or request more data. |
| Progress | Momentum with frozen personal baseline and next three comparable games | Reuse it as the return loop. It measures observed activity, not skill or a cause of wins. |
| Patch intelligence | Champion archive, dated comparisons, personal catch-up, supported item/ability calculations | Best differentiation hypothesis. Keep archive coverage and historical version explicit. |
| Match review | Scoreboard, final items, on-demand timeline, optional signed-in AI | Guest usefulness was less prominent than AI entry. Add a short, self-guided replay routine directly in the overview. |
| Recorded builds | Exact-context grouping, final inventory, saved loadouts, bounded boots comparisons | Names and numbers need explanation. Add per-item stat meaning using the existing historical reference. |
| Notebook / Build Memory | Notes, preparation cards, reflections, source-linked adjustments and follow-up | Already extensive. Keep optional; avoid another required journal or persistence format. |
| Champion collection | Pool, kept findings, reviewed-patch baseline | Retain; “nothing found” means no recorded direct changes, not no impact. |
| Accounts | Profile, Riot association, practice plan, private sync, guest import/export, AI gate | Preserve isolation and explicit saves. Current provider availability is deployment configuration, not established by this audit. |
| Reliability | Riot validation, caching, budgets, rate-limit recovery, broad tests | Reuse existing requests. Timeline remains explicit. No new dependency, AI call, database schema or entitlement. |
| UI architecture | Native links/disclosures, reduced motion, responsive scenes and multiple themes | Highly customized navigation has a substantial regression surface. Check small phones, keyboard focus, direct links and Back when changing presentation. |

Open PRs #54 and #76 existed at audit time. This work starts from main and does
not merge or replace them. Historical handover claims and screenshots are not
verification of this release.

## Player research

Method: purposive English-language searches of r/summonerschool,
r/leagueoflegends and MOBAFire, with recent threads where retrievable and older
threads for recurring needs. Read the returned discussions, compare themes, then
check competitor claims on official pages. Search indexing, self-selection,
small samples and age limit generalization. Votes are not market share. Negative
comments describe individual experiences, not independently verified defects.

| Player signal | Evidence | Product implication |
| --- | --- | --- |
| “Help me understand the build” | [October 2026 overlay discussion](https://www.reddit.com/r/leagueoflegends/comments/1wx5awy/overlaysapps_for_league_recommendations/) asks for explanations and enemy-context adaptation, rather than repeating a highest-win-rate loadout. | Explain item properties and the questions behind a choice. A final inventory cannot establish why the player bought it. |
| Less intrusive, fewer features at once | [Minimal companion discussion, 2022](https://www.reddit.com/r/summonerschool/comments/wcwjkf/) seeks quick runes/items; [comparison thread, 2023](https://www.reddit.com/r/summonerschool/comments/10nfv72/porofessor_vs_mobalytics_vs_blitz/) includes complaints about ads, crashes and stuttering and appreciation for toggles. | Keep the browser flow short; put detail behind clear disclosures. These anecdotes do not establish current competitor performance. |
| A simple improvement loop | [Mistake tracking discussion, 2023](https://www.reddit.com/r/summonerschool/comments/12d4lf2/) asks for a next-game tracker; replies caution that outcome statistics omit decision context and can produce poor advice. | Pair Momentum with source games and questions. Do not label a death a mistake or claim low damage proves excessive passivity. |
| One useful lesson is enough | [Replay review discussion, 2022](https://www.reddit.com/r/summonerschool/comments/x42xjz/) emphasizes reviewing one's own decisions and specific concepts. | Start with one recorded moment, rewind to its setup, consider an alternative, choose a concrete cue. |
| Beginners need situational reasoning | [MOBAFire item discussion, 2018](https://www.mobafire.com/league-of-legends/forum/new-player-help/building-items-for-the-situation-42036) discusses threats, damage, defenses and purchase priorities. | Treat this as a historical learning need. Do not reuse its obsolete item names or numerical recommendations. |

The evidence supports these as hypotheses worth testing; it does not establish
their prevalence, prove retention benefits or identify a universally preferred app.

## Competitive check

Official pages checked on the research date. “Advertises” is a vendor claim;
these products were not installed, timed or tested. Unlisted capabilities are
unknown, not absent. No pricing recommendation is made.

| Product | Officially advertised strengths | Implication for RiftScry |
| --- | --- | --- |
| [OP.GG](https://op.gg/desktop/en/games), [setup guide](https://help.op.gg/hc/en-us/articles/48467238743961-Getting-Started-with-the-OP-GG-App) | Automatic setups, many overlays, stats and build analysis | Generic builds and overlays are crowded. Compete on task clarity and understandable evidence. |
| [Porofessor](https://porofessor.gg/en/download) | Draft help, imports, tags, detailed analysis, replays, friend finding; both standalone and Overwolf downloads | “No Overwolf” alone is not a distinctive claim anymore. |
| [Mobalytics](https://mobalytics.gg/lol/glp/plus) | Matchup guidance, progress, challenges, highlights and an ad-free paid experience | Progress and coaching are established features; avoid novelty claims. |
| [iTero](https://www.itero.gg/) | Personalized picks, builds and macro coaching | An adaptive build engine requires a substantial validated data/model investment. Start with transparent learning from known records. |
| [kue](https://kue.gg/) | Personalized preparation, one focus, replay clips and progress against the player's usual performance | A direct competitor to the improvement loop. RiftScry's potential distinction is historical patch-to-game evidence and a lightweight browser path. |
| [U.GG](https://u.gg/app) | Current page could not be retrieved (403) | Do not turn older app descriptions into current verified claims. |

## Brainstorm and implementation plan

Priority is product judgment based on the above evidence and implementation cost,
not a numerical market-size estimate.

| Priority | Idea | Decision and acceptance criteria |
| --- | --- | --- |
| P0 | Task-first entry | Implement: main briefing action stays visible even with archive resume; guide routes players by their immediate task. Native navigation works without waiting for animation. |
| P0 | Explain my recorded build | Implement: select a recorded item; see recognized base stats in plain language, historical description and source. Missing/wrong-version/unsupported-mode data stays unavailable. No inferred optimality or whole-build damage score. |
| P0 | Review one decision | Implement: explicitly load timeline, choose a death/purchase, see a rewind timestamp and three questions, inspect the actual event, reach Notebook with champion/mode retained. No automatic AI request or save. |
| P1 | Better personal patch catch-up | Retain existing functionality; next invest in coverage and freshness with source-backed tests, including a clear returning-player journey. |
| P1 | Build tradeoff comparison | Existing boots comparison is a starting point. Expand only through reviewed item families, mode eligibility and passives; arbitrary stat sums would mislead. |
| P1 | Context-specific progress | Reuse Momentum and validate clarity with supports, ARAM players and small samples before adding more scores. |
| P2 | Matchup mini-guides / champion learning path | Promising, but needs maintained expert content and patch ownership. Prototype a small reviewed champion set before broad automation. |
| P2 | Adaptive builds / replay clips / native overlays | Higher data, desktop integration and policy costs; do not claim these are implemented by a browser timeline reader. |
| Avoid | Hidden-player scouting, invented MMR, blame tags, pressure streaks | Poor fit for understandable self-improvement; several also conflict with Riot's rules. |

Riot's [general policies](https://developer.riotgames.com/policies/general) and
[League documentation](https://developer.riotgames.com/docs/lol) require registered,
up-to-date products and prohibit certain unfair advantages, hidden-player
identification and unofficial ranking alternatives. This release uses existing
post-game records; production registration/approval remains an operator obligation.

## Shipped behavior in this branch

The second pass implements the P1 catch-up, freshness, supported item tradeoffs
and progress-clarity work, plus the small P2 champion-learning pilot. See
[IMPLEMENTATION.md](IMPLEMENTATION.md) for the concrete behavior, source review,
coverage limits and remaining investments. Publication and production
verification are tracked in [VALIDATION.md](VALIDATION.md) and
[PR #78](https://github.com/ionutn0301/riftscry/pull/78).

- Homepage: briefing becomes the primary action. Champion search remains the
  default secondary action; an existing reading resume can replace only that
  secondary action. The patch badge says “Archived patch.”
- Guide: three task shortcuts supplement the complete feature reference.
- Match overview: **Review one decision** and **Understand this build** are
  native disclosures, available to guests without another API entitlement.
- Briefing loadout: the same build explanation, using the existing shared
  patch metadata request. No extra request is introduced by opening it.
- Build explanation: per-item base stats and meanings, reference text rendered
  safely as text, price labeled as total shop price, exact reference link.
  Standard item explanations are deliberately withheld for nonstandard modes.
- Quick review: first valid recorded death (otherwise first purchase) is merely
  a starting point; all valid moments are selectable. Rewind is 20 seconds,
  clamped to zero. Out-of-game/nonfinite timestamps, undos and fabricated IDs
  do not become suggested moments. Original events remain in the evidence view.
- Notebook handoff retains champion and exact queue; it does not save a note or
  pretend to carry a written takeaway. Users author their own takeaway there.

## Validation and remaining research

See [VALIDATION.md](VALIDATION.md) for actual check results and limitations.

Next validation with 5–8 players across new/returning, ranked, support and ARAM
contexts: ask each to find their briefing, explain an item, inspect a source
event and reopen their focus. Record task completion, time to the first useful
answer, wrong turns and whether they can state the data limitations. Ask what
they would use again after their next match. No participants were recruited in
this task; no retention or conversion figures were measured.

Suggested success criteria (targets, not results): at least 80% unassisted task
completion, first useful result within one minute excluding upstream waits, and
no participant confusing a recorded build with an optimal recommendation. Measure
voluntary return after a played game only with an appropriate analytics/privacy
design; do not add silent tracking as part of this release.
