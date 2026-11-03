# First result: useful before a personal baseline

3 November 2026 · Follow-up to [Momentum](../momentum/README.md) and
[Prompt 3](../MASTER_PROMPTS.md#prompt-3--broad-mode-onboarding-with-a-useful-first-result).

**Local verification:** the 43 new domain tests, typecheck and production build
passed. The full local unit run passed 656 of 657 tests; the existing exhaustive
archive-interval test timed out under load, then its complete 24-test file passed
in isolation without changes. Hosted browser checks and deployment status are
tracked on the associated pull request and exact released commit. Earlier
Momentum verification is not substituted for this change’s checks.

## Player outcome

A player should receive something useful from one available game. They should
not need to repeat the same champion three times, create a goal, enter a build
or write a reflection before RiftScry explains a recorded observation.

The first-result layer supplies one source-linked fact and a short appropriate
suggestion in the existing Focus scene. For example, a valid ARAM record can
show a player's involvement in their team's kills, including its numerator and
denominator. A compatible support game can show recorded vision activity. A
record that cannot support a numerical observation still supplies factual match
context and a route to its evidence. These are observations, not inferred skill,
mistake or win-cause assessments.

This complements Momentum's prospective three-game cycle. The new layer does
not weaken its baseline rules, merge different champions into a personal target,
or create numerical goals for unsupported contexts. An active Momentum focus
continues to own the primary progression experience.

## Accepted release scope

- Derive a first result from the already imported match summaries with the pure
  model in `src/lib/player/first-result.ts`.
- Replace repetitive sparse-history/warmup presentation with a concise observed
  result; retain real patch evidence and active Momentum progress.
- Keep completed receipts and sample highlights as supporting history when no
  current target is active. An old receipt from another context must not displace
  the newest game's first result or introduce a shadow target for that game.
- Show the first valid observed result during the initial progressive import,
  with a visible loading/partial-sample qualification. Keep Momentum evaluation
  and writes tied to the settled import.
- Preserve the previous settled presentation during a background refresh;
  stale player or queue responses must not appear under a different identity.
- Offer discovered mode chips as optional explicit shortcuts. A chip uses the
  existing queue-change flow; it does not silently substitute another mode.
- Preserve valid explicit queue and champion context through Riot ID lookup.
  An invalid explicit identity cannot silently become the remembered player.
- Provide useful empty/error recovery and move focus to the loaded report's
  labeled Focus section after a successful lookup, with accessible loading/status text.

The first-result calculation itself needs **no additional API request**. An
explicit mode change still triggers the existing bounded history import for
that queue. Ordinary lookup, refresh, patch impact and source navigation retain
their existing request behavior; this release does not claim those interactions
are network-free.

### Implementation map

| Module | Responsibility |
| --- | --- |
| `src/lib/player/first-result.ts` | Pure source selection, validation, observed facts, mode discovery and sample/scope states. |
| `src/components/companion/FirstGameResult.tsx` | Concise one-game result, source action, limitations and discovered-context controls. |
| `src/components/companion/AutomaticBriefing.tsx` | Initial progressive sample, settled refresh, focus precedence, lookup scope and recovery. |
| `src/components/companion/Momentum.tsx` | Existing active target plus a compact history-only rendering for receipts/highlights. |
| `src/components/companion/useMomentum.ts` | Existing persistence workflow, with scope-aware presentation so a champion-filter change cannot briefly show the previous target. |
| `src/styles/first-result.css` | Responsive result and context-control presentation. |

## Model contract

`FirstResultOptions` receives the exact optional queue/champion scope, loading
state, available count, failed count, error state and a clock value for validating
record chronology. The model accepts existing `Match` records and the selected
PUUID. It does not fetch, persist, schedule or author a user record.

| Output | Meaning |
| --- | --- |
| `insight` | One selected source match, champion/mode/role labels, a fact kind, a short action, optional measured metric, nullable match facts and a limitation. Null means no valid source can be presented in the selected scope. |
| `contexts` | Exact queue contexts found in the imported records, their literal match/champion counts and latest source IDs. Discovery is not an all-mode performance comparison. |
| `sample` | Loading, partial, ready, empty or error status; loaded/available/failed/omitted counts and import completeness. Complete import does not mean every field is known; field limitations belong to the insight. An imported sample is not an account's complete history. |
| `scope` | Validated queue and champion selection. Missing requested context is distinct from no records anywhere. |
| `reason` | An absent result is explained as invalid scope, no records, empty scope, unsupported source or unavailable source. The model must not silently borrow an older incompatible game. |

The optional metric is a rate or percentage from one recorded game. Team
participation includes the underlying numerator and denominator. Match facts
retain nullable kills, deaths, assists and duration, an explicit unknown result,
and recorded item IDs. An unknown value is not replaced with zero, a loss or an
empty-item conclusion.

### Source and chronology rules

The newest recorded source in the requested scope anchors selection before
metric eligibility is considered. If the newest record is Arena, an older Rift
game cannot supply a farming suggestion under its heading. If an unsupported or
unavailable newest source cannot produce a factual view, return the appropriate
reason instead of claiming an older result is the player's latest game.

Require a valid match identifier and structure, a unique selected participant,
valid chronology and a supported public matchmade context before offering a
match-derived result. Duplicate records cannot inflate counts. Contradictory
duplicates and incomplete fields must be handled conservatively. Canonical
champion casing may be normalized without treating display names as new aliases.
Explicit queue/champion scope must survive normalization.

The initial import may be incomplete, including an unavailable newest requested
record. Its result must therefore be described as coming from the **loaded or
imported games**, rather than guaranteed to be the latest game on the account.
The existing import limit remains twenty recent IDs in detail batches of four.

### Numerical and mode rules

| Context | Permitted first-result behavior |
| --- | --- |
| Compatible Rift queue and known non-support role | A validated whole-match CS rate, or another supported recorded observation; no rank benchmark or invented target. |
| Compatible support game | A validated vision/activity or team-participation observation; no lane-carry farming advice. |
| Ordinary ARAM and ARAM Clash | Valid team-kill participation when the record supports it; each queue remains separate, without Rift farming/vision rules. |
| Genuinely exposed Mayhem, Arena or another recognized rotating queue | Factual match/loadout context; no first-result coaching metric, unsupported numerical goal, standard-item recommendation or inferred placement. |
| Short game, remake, unknown role or contradictory map/mode | Factual context when safe; omit metrics whose assumptions are not supported. |
| Custom, bots, tutorial, unknown queue or unusable source | No unsupported gameplay insight; an honest availability/recovery state. |

Numerical counts must be finite, nonnegative integers. Rates need a valid
duration of at least five minutes; short/remade games do not justify a normal
rate-based cue. Team participation needs the appropriate five-player context,
a valid team identifier, five distinct player/participant identities, known
kill values and a positive team-kill denominator. The selected player's kills
plus assists cannot exceed that denominator.

A vision score measures recorded activity, not whether every ward was useful.
Whole-match CS includes recorded minions and monsters, not a reconstructed lane
phase. Participation does not establish the quality of a fight. A suggestion to
look for safe income or useful team involvement is general guidance, not a
diagnosis inferred from the number.

Mayhem availability remains governed by the existing source notice in
`src/lib/player/modes.ts`. Supporting valid returned records does not imply that
Riot currently exposes that mode's history. An empty Mayhem selection must not
be automatically replaced with ordinary ARAM; an explicit recovery button may
offer that alternative.

## Presentation, state and request boundaries

The first-result layer consumes existing data; it introduces no identity claim,
account verification, extra Riot endpoint, timeline dependency, automatic AI
request, new persistence key or cross-device sync.

During an initial import, the observed result can become useful before all
twenty details have finished. Its copy and sample status must agree with that
state. Momentum continues to wait for a complete settled sample before creating
or evaluating durable progress. A partial first result is not an authorization
to award progress from a partial sample.

During refresh, preserve the previous settled source/result until the replacement
is ready. Explicit player or queue changes remain isolated through the existing
request keys and report lifecycle. Account names come from validated account
responses; a delayed response cannot overwrite the newer selection.

Discovered mode chips represent literal available contexts, not recommended
modes or ranked priorities. Their exact queue labels and counts are visible;
choosing one is an explicit action. Filtering does not combine performance across
queues. A varied champion pool can receive useful one-game facts without lowering
the same-champion requirement for Momentum comparisons.

The session recap remains an estimate within the selected mode and imported
sample, using the existing ninety-minute gap rule. An incomplete or filtered
sample cannot establish a complete real-life session. This layer must not add
tilt labels, winning-streak pressure, inferred sessions since the last visit or
claims about activity while the page was closed.

## Verification contract

The local results above cover the domain model, types and production build. The
existing CI pipeline runs the complete browser matrix and player workflows before
release. The associated pull request records those results and visual inspection;
the scenarios below define the release gate.

| Gate | Evidence to record |
| --- | --- |
| First-result domain tests | One-game role/mode coverage; nullable facts; correct denominators; duplicate, malformed and future data; newest-source anchoring; explicit scope; progressive/partial states; deterministic selection and no mutation. |
| Momentum regression | Complete-import and frozen-baseline behavior unchanged; newest Arena/unknown-role record cannot inherit an older Rift target. |
| Player browser flow | First useful result before later detail batches finish; no premature Momentum writes; correct source link; preserved queue/champion through lookup; mode chip selection; empty recovery; stale player isolation. |
| Accessibility and visual check | Post-lookup Focus-section focus, keyboard controls, live status behavior, narrow viewport, reduced motion and no unintended overflow. |
| Request assertions | First-result derivation adds no endpoint call; no timeline/review/rank/profile dependency. Explicit queue changes keep their ordinary history requests. |
| Project gates | Actual Astro/TypeScript check, relevant/full unit coverage as required, production build and required CI checks. |
| Hosted verification | Exact commit/PR/deployment identity, authorized application access and tested routes. A protection/sign-in page is not application verification. |

The browser suite saves `player-visuals/first-result-desktop.png` and
`player-visuals/first-result-mobile.png` in the `player-experience` CI artifact.
The briefing-composition job also captures the same first-batch loading state at
1440px and 390px used by the preceding release, so before/after evidence is
available in the two runs. The baseline run is
[41593284500](https://github.com/ionutn0301/riftscry/actions/runs/41593284500).
Fixture screenshots demonstrate synthetic data flows and layout; they do not
prove a successful live Riot account lookup. Existing deployment protection is
preserved, and exact deployment readiness is distinct from authenticated page
verification.

## Measurement and follow-up

No new analytics collection is part of this release. Future approved measurement
can track time from successful lookup to the first evidence-backed result,
coverage by broad mode/data-availability category and source inspection. Keep
player identifiers and private text out of product analytics, and distinguish an
inert event contract from measured results.

The release is successful when sparse and varied-champion players receive an
honest useful result earlier, while established players retain valid Momentum
progress and patch evidence. There is no promised retention uplift, win-rate
improvement, universal mode coverage or competitive exclusivity. Durable history,
verified identity, duo permissions and monetization remain separate future work.
