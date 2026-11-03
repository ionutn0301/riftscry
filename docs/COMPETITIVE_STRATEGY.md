# RiftScry competitive strategy

**Research date:** 3 November 2026, Europe/Bucharest. Official sources linked below
were accessed during this research session; the access record was consolidated at
01:43 EET (2 November, 23:43 UTC).

## Decision

Prioritize **Momentum**: one automatically selected focus, a frozen personal
baseline, and an automatic check of the next three eligible games. Show the player
what changed, which games counted, and whether the target was met. Recognize useful
personal records even after a loss.

The competitive bet is the combination of automatic follow-through, inspectable
evidence, fair comparisons and a short browser experience. Research does **not**
establish that any individual component is exclusive to RiftScry, nor that this
combination will outperform competitors. Retention and willingness to pay require
validation with players.

## Starting from the existing product

RiftScry already assembles a session recap, personal patch catch-up, one evidence-led
focus and the observed loadout after lookup. It remembers the recent player in the
browser and refreshes available history while the page is visible. See the
[automatic briefing audit](automatic-briefing/README.md) and
[`automatic-briefing.ts`](../src/lib/player/automatic-briefing.ts).

The existing [personal patch impact](personal-patch-impact/README.md) compares exact
recorded items and supported champion components across pinned patch references.
Reuse this capability; another generic patch digest would add less value.

Momentum closes the remaining follow-through gap: a focus should persist long enough
to be evaluated against future games, instead of being regenerated without a stable
record of the previous promise. This document describes the release priority and
future bets; the release audit and tests determine which behavior actually shipped.

## Competitor evidence

**Evidence standard:** “Advertises” means the vendor's current official page states
the feature. These products were not installed or independently benchmarked.
An unlisted feature is **unknown**, not proven absent. Explicit documented mode
limits are stronger evidence, but may change after this access date.

| Product and primary source | Officially advertised capabilities | Paid offering and implication |
| --- | --- | --- |
| [OP.GG membership](https://member.op.gg/membership?hl=en-US), [desktop LoL](https://las.op.gg/desktop/en/games/lol) | Agent match reviews, AI Voice, builds, scouting, overlays and history across modes. | Premium includes Agent and voice; ad removal has a separate tier. Generic AI review is established competition. |
| [Mobalytics Plus](https://mobalytics.gg/lol/glp/plus?int_medium=footer&int_source=homepage) | GPI progress tracking, skill challenges, matchup advice, combos and automatic Smart Highlights. | Plus sells deeper coaching and analysis. Challenges and progress are not novel by themselves. |
| [U.GG app](https://u.gg/app), [U.GG Plus](https://u.gg/plus) | Automatic loadouts, scouting, live metrics, LP tracking and post-game timelines; Plus lists personal counters, insights and a personal tier list. | Personalization, as well as ad removal and profile features, is monetized. Avoid presenting a personal tier list as a new category. |
| [Porofessor](https://porofessor.gg/en/download), [official Overwolf listing](https://www.overwolf.com/app/trebonius-porofessor.gg) | Pick/ban assistance, imports, player tags, detailed match analysis, pro replays and teammate discovery. | Ads and Premium are listed; exact current premium scope and price were not established. More tags or a generic teammate directory are weak differentiation. |
| [Blitz's official advertising site](https://ads.blitz.gg/) | Auto setup, overlays, profiles and performance analysis. | This accessible page is old. Current product/pricing pages could not be retrieved; current premium details remain unverified. Do not substitute third-party claims. |
| [iTero](https://www.itero.gg/) | Draft/build recommendations using match history and champion pool, personalized macro coaching and post-game strengths/weaknesses. | The page describes core features as free; paid benefits include ad removal and model customization. Personalized coaching faces free competition. |
| [Hexgate](https://hexgate.app/) | Timeline evidence, role-specific match breakdowns, recurring habits and automatic clips. Its breakdown list explicitly covers ranked, Draft and Swiftplay; broader modes receive other features. | Pro+ sells coaching, scouting and clips. ARAM-appropriate progress is a possible comparative opportunity against the documented breakdown scope, not a proven market-wide gap. |
| [kue](https://kue.gg/) | Persistent next-game focus, recurring mistakes, automatic clips, personal-baseline progress and a player dossier. Its FAQ limits deep reviews to Ranked Solo/Duo. | Currently advertised as free open beta. Own-baseline coaching and persistent focus already exist. |
| [Trenix](https://trenix.net/) | Browser-based cross-match patterns, an ongoing focus, weekly checks, focus history and eligible-match counts. | Currently advertised as free. This is a close comparator for Momentum; prospective frozen evidence and automatic per-game checks must provide a concrete benefit. |
| [GamerOne](https://gamerone.org/en), [paid plans](https://gamerone.org/en/plus) | Automatic quests verified against Riot match data, a coach, progress and rewards. | Paid plans extend coach capacity and quest/reward benefits. Automatic completion, XP and quests alone are not unique. |

### What the evidence supports

- **High confidence:** generic coaching, single next-game focus, challenges, personal
  progress, automatic clips and draft assistance already have substantial competition.
- **Documented comparative opening:** some reviewed products restrict deep analysis
  to ranked or Summoner's Rift queues. Mode-appropriate progress could reach players
  their deepest features currently serve less directly.
- **Product hypothesis:** a transparent, frozen-baseline record with low-effort
  follow-through can earn trust and repeat use. The reviewed pages do not establish
  whether competitors implement the same comparison guarantees internally.
- **Unknown:** comparative accuracy, actual retention, willingness to pay, full
  competitor feature coverage and market-wide exclusivity. Do not turn these into
  marketing claims.

## Priorities

| Priority | Bet | Why it matters | Evidence needed before expanding |
| --- | --- | --- | --- |
| 1 — this release | Momentum: automatic focus and three-game follow-through | Connects the existing briefing to a visible outcome without journals, checkboxes or manual match selection. | Future-only evaluations, frozen baseline, duplicate protection and correctly isolated player/champion/queue/role/patch contexts. |
| 2 | Personal progress receipts and small records | Gives a player something useful after a loss and a clear end to a session. | Every result links to real imported games; compare compatible duration-normalized metrics and label bounded sample records accurately. |
| 3 | Patch follow-through | Connects the existing exact patch-impact calculation to later personal observations. | Sufficient post-patch samples, separate numerical reference effects from observed performance, and no causal claims. |
| 4 | Mode-specific journeys | Broadens usefulness beyond ranked climbing, with suitable goals for supports and ordinary ARAM where data is available. | Queue-specific rules and coverage tests; no farming targets for supports or ward/dragon targets for ARAM. Unsupported modes remain explicit. |
| 5 | Season memory, then opt-in duo journeys | Adds durable personal value and a plausible premium reason to return. | Reliable identity, durable history, deletion controls and consent for shared/private coaching. Validate individual use before adding social complexity. |

The three-game check is a short product loop, not proof of statistically reliable
improvement. Present “target met” or “observed progress,” not “this caused your win.”
Preserve a completed baseline rather than moving it to manufacture progress. A patch
or context change must not silently enter a supposedly comparable evaluation.

Keep one main action visible. Explanations can expand inline. Reward mastery,
discovery and completed progress; avoid punitive streak resets or incentives to play
more games just to protect a reward. A completed session should feel complete.

## Proposed free and premium split

This is a product proposal, not an implemented subscription or pricing commitment.

| Free foundation | Potential premium depth |
| --- | --- |
| Useful player lookup, current briefing and existing patch information | Longer season history and comparisons across separate patch periods |
| One automatic focus and its recent evidence | Multiple independent journeys for main champion, secondary role and supported casual modes |
| Clear results and meaningful personal records | Richer evidence exploration and automatic weekly progress stories |
| Honest insufficient-data and unsupported-mode states | Personal patch follow-through over larger samples |
| Core accessibility and useful basic progress | Later, opt-in duo progress with appropriate privacy and consent |

Do not paywall the first useful answer or basic reliability. Paid value should come
from deeper interpretation and continuity, not merely repackaged raw statistics.
[Riot's current general policies](https://developer.riotgames.com/policies/general)
require a free tier, transformative paid content and Approved or Acknowledged product
status for monetization. The [registration policy](https://support-developer.riotgames.com/hc/en-us/articles/22698591841939-General-Policies)
also states that new features and product changes require auditing through the
Developer Portal. Verify that product status before enabling billing; this research
does not establish RiftScry's approval status.

## Validation and release measurements

Measure useful outcomes before adding complexity. Establish an initial baseline;
there are no measured RiftScry results or invented success benchmarks in this document.

| Measure | Definition and interpretation |
| --- | --- |
| Time to first useful result | Median and p90 from successful lookup to a rendered evidence-backed focus or honest insufficient-data result. Separate API failures. |
| Automatic follow-through | Share of created journeys with a later eligible game evaluated, among players who actually have a later eligible imported game. |
| Three-game completion | Share reaching three eligible checks; distinguish no later play, context changes, missing history and technical failure. |
| Return after a loss | Return to inspect progress after a loss, with a defined observation window; not a causal measure of improvement. |
| Return after completion | Voluntary return after finishing a journey, without threatening to erase progress. |
| Comprehension and trust | Can a player identify the target, baseline, counted games and limits? Track corrections or reports of misleading advice. |
| Evidence integrity | Duplicate evaluations, wrong-player/context matches, post-start baseline contamination and missing-source records. These are correctness defects. |
| Coverage | Useful outcomes by role, queue, rank-known/unknown state and sample size; expose who is still underserved. |
| Premium demand | Voluntary interest in longer history and multiple journeys, followed by actual conversion only after approval and billing are ready. |

Use aggregate, privacy-conscious measurement when analytics are implemented. Avoid
recording Riot identifiers or private coaching text unnecessarily. More games played
is not the primary product success metric.

## Claims to use and avoid

**Use when implemented and verified:** “Your next focus, followed through
automatically.” “See which games counted.” “Progress can matter even when you lose.”

**Avoid:** “The only AI coach,” “no competitor has this,” “guaranteed LP,” “proves this
habit won the game,” “all modes supported,” or “fully automatic in the background”
when updates require an open visible page. The current imported sample is bounded;
personal records are records within available comparable history, not lifetime bests.
