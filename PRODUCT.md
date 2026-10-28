# RiftScry product contract

This is the current product contract for the complete October 2026 presentation
refactor. The original structured-patch purpose remains; the earlier homepage
storyboards and the claim that other routes retain their incumbent presentation
are superseded by `DESIGN.md`.

## Purpose

RiftScry turns archived League of Legends patch notes into exact, readable changes
for the champions a player cares about. The experience should answer “what changed
for me?” quickly and reward a deeper visit with connected history and source
context. Players can take a cinematic route through the homepage or go straight
to a champion, patch, comparison, or personal briefing.

The site is an independent, static, zero-account product. Personalization is saved
on the visitor's device. The visual promise is **The Rift, revealed**; the
functional promise remains **The patch notes, diffed**.

## Product truth

- Use player-facing patch identities, exact before/after strings, original prose
  records, and traceable Riot source links. Keep rank arrays, scaling, units, and
  conditions intact.
- Classifications summarize recorded changes. They are not measured champion
  strength, win-rate predictions, or a calculated net stat across unrelated fields.
- Compare intervals are `(older, newer]`. The start is excluded and the end is
  included. Explain quiet or invalid intervals instead of inventing a conclusion.
- “No direct records” means no direct records in this archive and interval. It
  does not mean a champion was unaffected by items, systems, or other champions.
- Canonical champion IDs, URLs, source provenance, and git-versioned data survive
  presentation changes. All champions in the roster can be selected, including
  those without a recent direct change.

At the October 28 refresh the committed data has **173 champions and 21 patches**, from
**26.1 / 2026-01-07** through **26.21 / 2026-10-20**. These are archive facts,
not a claim to represent the current live game. Show “latest archived” and its
date where freshness matters. The scheduled ingestion workflow may propose new
data by pull request; it does not automatically merge or guarantee a daily update.

## The journey and its destinations

The homepage has five real document chapters: **Arrival → Perspective → Change →
History → Return**. The first screen fits the viewport; the rest remains normal,
accessible scrolling. Choosing any champion changes the actual evidence and
history, not just a decorative image. Field and interval controls lead to exact
records and then to complete reading surfaces.

The persistent Rift map provides named native links to the journey, champions,
patch archive, comparison, and My Pool. Search remains directly available and
supports Cmd/Ctrl+K. Browser Back, direct URLs, native links, and a clear motion
preference are part of the interface, not optional conveniences.

Every route family participates in the same visual world:

| Surface | Product job |
| --- | --- |
| `/` | Guide a visitor from champion choice to sourced change, connected history, and a personal next visit. |
| `/champions` | Find a champion through server-rendered names, progressive search, and role filters. |
| `/champion/:slug` | Read the champion's exact dated history and open a focused homepage interval. |
| `/patches` | Understand the archive's scope and choose a dated patch. |
| `/patch/:id` | Read champion, item, system, and hotfix records; filter and personalize without losing sources. |
| `/compare/:newer/:older` | Compare an explicit interval, inspect classifications, and open the underlying records. |
| `/pool` | Resume reading, review the saved champions' relevant archive changes, and edit the pool. |

`/patch` and `/compare` remain entry shortcuts to their available data. Unknown
routes provide understandable recovery choices.

## A useful reason to return

The return briefing is grounded in device-local state and real archived records:

- **Kept findings** retain up to 50 exact dated records in `riftscry:kept-findings`
  on this device, independently of the active champion or interval. The briefing
  supports removal and restoration of the last removed finding; failed writes
  show an explicit message rather than claiming the finding was kept.
- **My Pool** retains `riftscry:pool`, the existing canonical-ID storage contract
  and shared `?champions=` links.
- **Reviewed baseline** uses `riftscry:last-reviewed-patch`. Only the explicit
  “Mark reviewed” action advances it. Visiting a page or scrolling to the ending
  must not silently mark an archive patch reviewed.
- **Reading resume** uses `riftscry:resume` and accepts internal destinations
  only. It offers a route back to an actual reading place.
- **Since reviewed** means direct records for saved champions in archived patches
  after the stored baseline. First visits, missing baselines, quiet intervals,
  caught-up visits, and unavailable storage have distinct honest messages.
- **From the archive** rotates an existing, dated source record by day. It is
  labelled as a selection to revisit, never presented as new patch news.

There is no account, cross-device synchronization, live-game integration, or
promise of fresh balance data every day in this implementation. Return visits
must offer useful context without manufacturing urgency or activity.

## Content, assets, and accessibility

Use short, precise, game-aware language: “Know before you queue,” “Follow the
history,” and “Latest in this archive.” Avoid generic technology promises and
unsupported claims about a player's performance.

The original RiftScry environment illustrations establish place and continuity.
Official Riot champion artwork supplies identity and remains intact, separately
composed from controls and source records. These assets have different provenance;
neither the art direction nor a source URL grants blanket legal clearance. Keep
the third-party Riot disclaimer and the asset records. Review applicable policies
before release; do not present generated environments as official game locations.

The rendering baseline is semantic HTML. Keyboard navigation, visible focus,
clear labels, native dialog dismissal/focus return, readable source records, and
text/glyph change semantics remain available. Reduced motion preserves the same
choices and information. Without JavaScript, the initial source records and
ordinary archive/champion/compare links remain readable; device-local controls
require JavaScript and should say so.

## Technical and verification boundaries

Build-time data creates static routes plus `/journey/roster.json` and a compact
`/journey/:canonicalId.json` for each champion. The homepage uses a native
controller rather than a full-archive React presentation. Global map navigation
and CSS cross-document transitions enhance native routes. Reader pages share an
arrival and chapter composition without replacing the existing filter,
comparison, timeline, or pool logic.

The October 28 revision passes typechecking, production build, and 241 unit/integration
tests. Browser acceptance is blocked locally: the hosted preview bridge returned
SANDBOX_NOT_FOUND, and installed Playwright Chromium cannot launch without libnspr4.so.
New acceptance tests are committed but have not passed here. Visual baselines,
recordings, deployed mobile performance, and complete motion review remain release
requirements. See `docs/RELEASE_EVIDENCE.md`; do not treat compile success as visual sign-off.
