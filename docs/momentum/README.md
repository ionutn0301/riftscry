# Momentum release

3 November 2026 · First implementation from the
[competitive strategy](../COMPETITIVE_STRATEGY.md) and
[master prompts](../MASTER_PROMPTS.md).

## Player outcome

The automatic briefing now follows through on a personal target. After a complete
import, Momentum uses three to five valid comparable matches to set a small focus.
The player plays normally. The next three eligible games update the record when
the briefing imports them, without writing notes, choosing games or confirming
success. A finished cycle keeps a receipt; the next focus can start automatically.

A recent personal high can appear even after a loss. It is explicitly a high
within the comparable imported sample. Players with one or two games still see a
measured latest-game value and a suitable starter action. The basic feature has
no paywall or new external service.

## What is implemented

- A pure, versioned evaluator in `src/lib/player/momentum.ts`.
- A separately scoped browser record in `useMomentum.ts`, with validated reads,
  serialized cooperating-tab writes and no false success after storage errors.
- A responsive Momentum card in the existing Focus chapter. While a frozen target
  is active, the old metric suggestion becomes compact source-match context;
  patch evidence remains available.
- Outcome-independent highlights and receipts, with ordinary links to real source
  match pages. No generated score, rank prediction, streak penalty or volume reward.
- Competitive research, a proposed free/premium split and eight implementation
  prompts for future releases. Billing and verified accounts remain future work.

## Calculation and state contracts

The baseline is the median of the latest three to five valid same-champion,
exact-queue, same-role/context and same-game-version matches. Canonical champion
case variants are normalized. Version `16.21` here refers to Riot's game version;
it is not relabelled as public archive patch `26.21` without an archive mapping.

The largest supported recent drop is preferred. Otherwise role-appropriate metric
order selects the focus. A detected drop uses the baseline as the target;
otherwise the target adds 0.2 CS/min, 0.1 vision score/min or 5 percentage points
of participation (capped at 100%). These are modest product targets, not calibrated
rank benchmarks. Metric selection and target values remain inspectable.

| Context | Eligible measures |
| --- | --- |
| Known non-support Summoner's Rift role | CS/min, valid team participation, vision score/min |
| Support on an eligible Rift queue | Vision score/min, valid team participation; never CS targets |
| Ordinary ARAM / ARAM Clash / exposed Mayhem records | Valid team participation only; each exact queue remains separate |
| Arena, rotating modes, contradictory map/mode or unknown role | No unsupported numerical progression; existing records and patch context remain useful |

Participation requires a full valid five-person team with distinct identities,
known kills and a nonzero team-kill denominator. Missing values are not zero.
Invalid/future timestamps, incomplete records, remakes and games shorter than five
minutes cannot produce credit. The current selected newest match anchors the
context; an unsupported newest match cannot silently inherit an older Rift goal.

Each cycle stores its versioned context, metric, baseline value and match IDs,
target, creation timestamp and up to three checks. Only a game started strictly
after creation can count; baseline IDs cannot count again. Deduplication and frozen
checks make repeated imports harmless. Finishing three checks does not mean all
three targets were met: the receipt states the actual hit count.

The separate `riftscry:momentum:v1:<platform>:<puuid>` document retains at most twelve
cycles. A complete successful import is required for mutations. A bounded history
that no longer reaches the focus start pauses the cycle so unseen games are not
silently skipped. Different contexts have independent records. Looking up a player
is still not account ownership, and clearing browser data removes this continuity.

Storage is strictly parsed. Corrupt data is preserved; blocked storage or a failed
write yields current observations without pretending progress was saved. Existing
Notebook, Build Memory and archive-reviewed state are untouched.

## Data flow and operating limits

`/next-game` → existing account/history/summary requests → settled import → pure
Momentum evaluation → successful local persistence → updated card.

The feature adds no Riot requests, AI calls, timelines, dependencies, credentials
or server-side services. It reuses the existing twenty-ID, four-detail batch
import and visible-page two-minute refresh. It does not run while the browser is
closed. History coverage and API availability still limit the evidence.

Mayhem availability remains governed by the existing Riot availability notice.
Support for its record shape does not imply Riot currently exposes its history.
The strict champion context also means varied ARAM pools can stay in the
latest-game observation state until sufficient comparable games exist.

## Verification

The release adds 42 domain tests covering first-visit chronology, context isolation,
immutable baselines, rollover, duplicate imports, missing data, full-team
participation, role/mode safety, storage validation and history gaps.

Five browser scenarios cover the actual automatic refresh and subsequent receipt,
support, ARAM, corrupt storage and recovery after a partial import. They assert
that no timeline or review requests are introduced. Fixtures are synthetic browser
responses; these are not evidence of a successful live-account Riot lookup.

The project typecheck and production Astro/Vercel build succeeded during local
verification. The final PR records complete unit, browser and deployment checks.
The existing all-deployment Vercel protection and Riot access gates remain in place.

## Visual review

The following captures use synthetic game records, at 1440 × 900 and 390 × 844,
with reduced motion. Source-game and player names are fixtures. They show the
latest-game fallback before the change and a target plus sample-high result after
the change. Desktop and mobile captures were inspected for legibility and overflow.

| Before | After |
| --- | --- |
| [Desktop](proof/before-1440.webp) | [Desktop](proof/after-1440.webp) |
| [Phone](proof/before-390.webp) | [Phone](proof/after-390.webp) |

## Next releases

Use the ordered prompts, beginning with more inclusive first-result coverage and
extending the existing personal patch impact. Durable season memory needs verified
identity, storage and privacy controls. Opt-in duo work and paid entitlements depend
on those foundations. No checkout, subscription price, premium access claim or
market-wide exclusivity is part of this release.
