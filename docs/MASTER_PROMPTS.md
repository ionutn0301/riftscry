# RiftScry implementation master prompts

Research checkpoint: **3 November 2026**. These prompts turn the product direction
into bounded engineering tasks. They are a roadmap and a reusable implementation
brief, not a claim that all the features below have shipped.

The [competitive strategy](COMPETITIVE_STRATEGY.md) contains the broader vendor
comparison, evidence confidence, prioritized bets and proposed free/premium split.

## Product direction

Give a player a useful answer after entering a Riot ID once: **what changed for
me, what is one useful focus, and what happened when I tried it?** Produce the
answer from available records. The repeat-use loop is understanding and visible
progress, including after a loss. No journal, reflection form, build entry,
twenty-metric dashboard, invented skill score, punitive streak, or pressure to
play another game belongs in the critical path.

Competitors already offer builds, patch information and automated analysis.
RiftScry should compete on a coherent experience connecting a player's recorded
game, exact archived changes and prospective personal progress. Do not describe
an individual feature as exclusive without fresh, specific evidence. No prompt
authorizes a guaranteed win-rate uplift, an unsupported competitive claim or a
paid service launch.

### Sources and boundaries to recheck before implementation

Use these official sources, together with the current repository contracts:

- [Riot League developer guidance](https://support-developer.riotgames.com/hc/en-us/articles/22698698001939-League-of-Legends): self-history training use cases, Riot ID handling, free-tier and transformative monetization requirements, game integrity, custom-match privacy, and Arena augment/item restrictions.
- [Riot general policies](https://support-developer.riotgames.com/hc/en-us/articles/22698591841939-General-Policies): registration, feature audit, permitted assets, disclaimer and monetization boundaries.
- [League data documentation](https://developer.riotgames.com/docs/lol): platform/regional routing, versioned Data Dragon references, RSO and game constants.
- [Riot API reference](https://developer.riotgames.com/apis): current endpoint and response contracts; verify exact fields against representative payloads.
- [Developer Portal documentation](https://developer.riotgames.com/docs/portal): API errors, application/method/service budgets and `Retry-After` behavior.
- [Official queue catalogue](https://static.developer.riotgames.com/docs/lol/queues.json): queue identity; an entry does not establish current match-history availability.
- [OP.GG pick-page documentation](https://help.op.gg/hc/en-us/articles/48465746492313-Checking-information-on-the-OP-GG-pick-page) and [Mobalytics product guide](https://mobalytics.gg/lol/guides/mobalytics-beginners-guide): examples of existing automated competitor functionality, not an exhaustive feature census.

The Riot-hosted reports about [irregular timeline frame intervals](https://github.com/RiotGames/developer-relations/issues/1129)
and [duplicated skill events](https://github.com/RiotGames/developer-relations/issues/1100)
are defensive engineering inputs. They are developer reports, not proof that a
particular defect affects every current match.

## Read this contract with every prompt

1. Read `PRODUCT.md`, `DESIGN.md`, `README.md`, `docs/ARCHITECTURE.md` and the
   relevant source before changing behavior. `PRODUCT.md` is the current product
   contract; historical screenshots and release records are not current sign-off.
   Read `docs/COMPETITIVE_STRATEGY.md` and any newer release plan present in `docs/`.
2. Preserve the hybrid architecture: Astro archive and briefing shells, React
   islands, server-only Riot calls behind `src/pages/api/player/[action].ts`,
   Zod validation, the existing Redis/cache/budget layer and private/no-store
   player responses. Do not put Riot or AI credentials in a client bundle.
3. Start from `Match`, `Participant`, `Timeline`, `Fact` and the helpers in
   `src/lib/player/contracts.ts`, the capability catalogue in
   `src/lib/player/modes.ts`, and the actual data returned. A TypeScript assertion
   does not prove an external field exists. Validate additions at runtime.
4. Keep exact queue, champion, compatible role/context and patch boundaries for
   personal comparisons. Do not merge Solo/Duo, Flex, Draft, Swiftplay, ARAM,
   Mayhem, Clash or rotating modes into one performance average. Unsupported,
   unknown, partial and empty are different states. Missing is never zero or a loss.
5. Preserve the current bounded import: at most 20 recent IDs, detail batches of
   four, cancellation/stale-response handling, caching and cooldowns. Increasing
   history requires the dedicated durable-history work, a budget and a reason.
6. Preserve optional AI and timeline requests. The automatic briefing does not
   silently request either. A future preference may enable timeline fetching only
   after a clear user choice and an explicit product-contract update. AI always
   remains a distinct action; local private writing is never automatically sent.
7. Keep browser-local selection, prospective focus state, notebook records, kept
   findings, pool and Build Memory independent. No automatic notebook entry,
   reviewed-patch advancement or claim that a saved adjustment was followed.
   Storage failure cannot claim a successful save. Do not overwrite unreadable data.
8. Make the main result readable on a 320px viewport, keyboard-operable, stable
   during refresh and compatible with reduced motion. Preserve direct links,
   Back navigation, exact evidence links and non-JavaScript archive reading.
9. Instrument only with a consented existing mechanism, or provide an inert typed
   event contract for later activation. No new tracking script, fingerprint,
   cross-site identifier or upload of Riot IDs, PUUIDs, match IDs or private notes
   to analytics. Event names and denominators are defined below; targets are
   hypotheses until measured.
10. Reject busywork, mandatory manual logging, sprawling dashboards, magic
    confidence/skill scores and punitive engagement in every feature. Do not infer
    tilt, intent, deserved wins or the cause of a loss from a scoreboard. Keep a
    free useful path and state evidence limits in ordinary player language.

### Sequence and release status

| Prompt | Scope | Dependency and release intent |
| --- | --- | --- |
| 1 | Product and engineering gate | Run before each feature; establishes the bounded change. |
| 2 | Momentum prospective focus | Implemented in PR #74; inspect the release contracts and verification before extending it. |
| 3 | Fast, broad-mode entry | First-result observations, progressive initial evidence, discovered modes, scope preservation and visible recovery are implemented in the next release; see `docs/first-result/README.md` for validation and remaining limits. |
| 4 | Automatic selection of useful match moments | Future; summary-first, timeline remains a deliberate request or later explicit preference. |
| 5 | Personal patch/loadout decisions | Future extension of already implemented patch-impact functionality. |
| 6 | Verified account and durable history | Future infrastructure prerequisite for cross-device continuity and scheduled processing. |
| 7 | Consented duo patterns | Future; depends on verified account identity, permissions and durable history. |
| 8 | Premium entitlements and subscription readiness | Future; depends on verified identity and approved value/scope; checkout stays disabled. |

Feature prompts are intended to be given to an implementation agent working in
this repository. Each includes a deliverable and evidence gate; a plan alone is
not completion. Existing authorization still governs merge and deployment.

---

## Prompt 1 — Master product and engineering gate

**Copy this implementation brief:**

You are improving RiftScry, an Astro 7/React 19 League companion hosted through
the existing Vercel Git integration. Read the shared contract in
`docs/MASTER_PROMPTS.md` and inspect the current code and tests. Implement the
requested feature as a small, useful complete flow. Do not replace the app with
a generic analytics dashboard or duplicate an existing feature under a new name.

Before editing, produce a short working decision record identifying:

- The player question answered in one sentence, the data that can answer it and
  the first useful result after lookup.
- What already exists, what is actually missing, and why this is more useful
  than another statistic. Name exact routes/modules and the smallest full flow.
- The contexts eligible for the result, evidence provenance, freshness, failure
  states, and whether each proposed claim is observation or inference.
- External/API cost, storage/privacy changes and any dependency that prevents a
  real implementation. Resolve normal implementation choices autonomously.

Use the architecture already present. The first inspection set is
`src/pages/next-game.astro`,
`src/components/companion/AutomaticBriefing.tsx`,
`src/lib/player/automatic-briefing.ts`,
`src/components/player/usePlayerHistory.ts`,
`src/components/player/client.ts`,
`src/lib/player/server.ts` and `src/lib/player/riot-budget.ts`.
Choose pure deterministic logic where it answers the question. Do not add an LLM
call to rewrite a number or generate artificial certainty.

Define a versioned result contract with explicit eligible/insufficient/unsupported/
unavailable states, source identifiers kept within the application, counts and
comparison scope. Keep network/storage effects out of calculation modules. A
refresh, stale response or duplicate match must not create extra progress.

**Acceptance criteria:** a player reaches a real result without writing a note;
one result and one primary action lead the screen; evidence is inspectable; the
empty/error/recovery flow is complete; relevant storage is reversible; all shared
invariants hold. A sourced competitor overlap is acceptable. Unsupported claims
of uniqueness are not.

**Verification:** add only tests that exercise a material behavioral risk. Run
the relevant Vitest tests, `pnpm check` and the production build, then exercise
the changed player flow with the appropriate Playwright configuration. Include
keyboard, narrow viewport, real failure and stale identity cases where affected.
Distinguish fixtures, an actual authorized live lookup, build success and hosted
browser verification. Never describe one as proof of the others.

**Measurement:** define time from successful account lookup to first useful
result, eligible-result coverage and per-result Riot request cost. Use explicit
denominators and existing consented instrumentation or an inert adapter. Do not
transmit player identifiers to measure these. Retention is a hypothesis, not a
claim of causation.

Finish with changed behavior, files, test evidence, limitations and rollback
instructions. Update the product contract only for behavior actually implemented.
Merge/deploy only within existing authorization and required repository checks.
Reject manual journals, twenty-metric dashboards, invented scores and punitive
engagement even if they appear in a draft requirement.

## Prompt 2 — Momentum: one prospective focus that checks itself

**Copy this implementation brief:**

Apply the shared contract and Prompt 1. Implement or extend the Momentum feature
at `src/lib/player/momentum.ts` and its actual React integration. Inspect its
current exports and tests first; this module is part of the first-release work,
not permission to build a second competing goal engine.

The player benefit is: “Give me one attainable focus from my own available
games; check the next three suitable games and show what happened automatically.” No note,
check-in, reflection, goal editor or manual completion button is required. Keep
the existing automatic patch briefing useful and independently accessible.

Use existing `evidence()`, `comparisonRole()`, `patchOf()` and `modeForMatch()`
semantics. Derive any baseline only from eligible prior games in the same
champion, exact queue, compatible role/context and patch. The choice must be
deterministic. Prefer a small, explainable observation over a global skill score.
Support must not receive lane-carry CS targets. ARAM and Mayhem must not inherit
Summoner's Rift farming, vision or standard-item advice. If evidence is sparse,
show a useful factual recap or collecting state rather than invent a target.

**State contract:** extend the actual `MomentumState`, `MomentumCycle`,
`MomentumCheck` and `MomentumReport` schema and its
`parseMomentumState()`/`serializeMomentumState()` boundary. The first-release
constants specify a three-game cycle, a three-to-five-game baseline and at most
twelve retained cycles; change these only for a documented product reason.
The `riftscry:momentum:v1:<platform>:<puuid>` key is separate from other stores.
Preserve versioned player/server
scope, focus definition, source/baseline match references, baseline value and
unit, eligibility context, activation timestamp, processed match IDs and bounded
progress history. Separate derived suggestions from persisted active progress.
Freeze the baseline when tracking begins. A match must begin after activation to
count; a game already in progress or only newly discovered after activation does
not automatically become prospective. No historical completion, replay reward,
moving baseline or accidental reset on page refresh.

If the shipped contract activates a local focus automatically, label when it
began, provide pause/clear controls and document the separate storage key. Do not
silently create a notebook, game card or Build Memory record. If storage is
blocked, the view may calculate a suggestion but must not promise durable
tracking. Read before writing, validate bounds/version, and handle another tab
or a newer player selection without overwriting it.

**Result contract:** preserve the actual tracking/warmup/unsupported/waiting/
read-only report states. Report an observed value, frozen comparator, exact
context and source match for each check; explicitly distinguish evaluated
results from insufficient, ineligible or unavailable evidence.
Missing data is not failure. A met target is not proof of better decision-making
or a caused win. A loss may still contain personal progress. Do not create daily
deadlines, loss-of-progress threats or a reward for playing excessive matches.

**Acceptance criteria:** one lookup produces the focus; later eligible imported
matches evaluate it without manual entry; account/queue/patch changes remain
correct; leaving and returning does not lose valid progress; pause/clear is
understandable; visible refresh/cooldown behavior remains the existing two-minute
bounded process. No extra Riot, timeline, rank or AI request is needed.

**Tests:** build focused deterministic fixtures for prior-versus-prospective
matches, duplicate/reordered/late arrivals, an in-progress-at-activation match,
patch/role/queue changes, support, ordinary ARAM versus Mayhem, unknown values,
malformed storage, failed writes and stale cross-tab/player updates. Browser-test
first visit, return, an automatic evaluation, pause/clear and a blocked-storage
state. Assert that notebooks and existing Build Memory remain untouched and
timeline/review endpoints are not requested.

**Measurement:** with approved instrumentation, count focus surfaced, eligible
later match evaluated, evidence opened and focus paused/cleared. Define coverage
as evaluated focuses divided by focuses with an eligible later imported match,
not all visitors. Track request cost and useful return visits separately from
win rate. No new telemetry collection is implied. Reject manual logging,
score inflation, dashboard sprawl and punitive streaks throughout.

## Prompt 3 — Broad-mode onboarding with a useful first result

**Copy this implementation brief:**

Apply the shared contract and Prompt 1. Improve the existing route from a Riot
ID to the player's first useful briefing. Extend
`src/components/companion/AutomaticBriefing.tsx`,
`src/components/player/PlayerGateway.tsx`,
`src/components/player/PlayerModePicker.tsx`,
`src/components/player/useSelectedPlayer.ts`,
`src/lib/player/identity.ts` and `src/lib/player/modes.ts` where needed. Preserve
the current homepage composition and its no-player-request boundary; do not
rebuild the visual shell as a prerequisite to functionality.

A new or returning player should understand the value without choosing a rank,
writing goals or knowing the internal queue catalogue. Ask only for the identity
and server needed for a correct lookup. Resume a valid remembered player. An
explicit invalid URL must never fall through to somebody else's stored profile.
Name records from successful account responses, not untrusted query text.

Offer all-recent history as a discovery view, then show exact supported contexts
found in the sample. Choose a sensible recent context automatically while
preserving explicit queue/champion links. Keep filtering different from combining
statistics. Do not hide ARAM, unranked, support or infrequent-player paths behind
ranked prerequisites. A useful factual recap is valid for sparse history.

**Data contract:** expose identity status, history status, exact context options,
selected context, sample completeness, one result and a recovery action. Distinguish
bad input, account not found, wrong/unsupported server, authorized-service outage,
429 cooldown, no recent exposed records, partial import and unsupported mode.
Recheck current routing before changing legacy platforms; preserve canonical
player links or migrate them explicitly. Do not silently substitute an empty
Mayhem history with ordinary ARAM.

**Acceptance criteria:** a fresh user sees a relevant result after one successful
lookup with no other required input; an established user resumes directly; a
low-data or unsupported context receives a truthful useful next action; changing
player or mode cannot show stale results under the new label. The primary result
and its evidence action are usable at 320px and 200% zoom. Loading/error
announcements use appropriate accessible status semantics and focus placement.

**Tests:** extend `tests/e2e/automatic-briefing.spec.ts`,
`tests/player-e2e/player.spec.ts` and the relevant identity/mode tests. Cover all
five standard roles, normals, sparse ARAM, unavailable Mayhem, contradictory
map/queue fields, blocked storage, delayed old identity, preserved explicit URL
scope, keyboard submission, Back and cooldown retry. Check no rank, AI or
timeline dependency is introduced into first value.

**Measurement:** report consented/inert milestones for lookup success, first
eligible result, factual fallback and recovery success. Analyze by broad mode
family and data-availability category, never by an exported player identity.
Measure elapsed first-value time and abandonment only when the collection is
actually enabled by consent. A tracking adapter alone is not measured impact.
Reject extra onboarding questionnaires, manual journals, metric walls, magic
scores and daily-return pressure.

## Prompt 4 — Select useful post-match moments automatically

**Copy this implementation brief:**

Apply the shared contract and Prompt 1. Extend the existing match review with up
to three evidence-backed moments selected automatically from an available
timeline: what happened, why it is worth inspecting, and one question for the
next similar situation. The player should not sift through an event log or
annotate a replay before receiving value.

Start with `src/components/player/MatchReview.tsx`,
`src/lib/player/contracts.ts`, `src/lib/player/advice.ts`,
`src/lib/player/review.ts`, `src/lib/player/server.ts` and
`src/pages/api/player/[action].ts`. Add a pure selector module if needed. The
existing `Timeline` type currently carries frames/events, not a complete
simulation. Add only verified optional fields required by the chosen moments,
with runtime validation and fixtures. Do not invent frame-level vision, camera
attention, intention or exact wave state.

Preserve the current explicit timeline action and event-evidence deep links.
“Automatic” means selection and explanation after authorized evidence retrieval.
If a later release adds an opt-in auto-load preference, name the request/cost
change in `PRODUCT.md`, keep it off by default initially and budget it. AI remains
a separate action and is unnecessary for the deterministic first version.

**Proposed result contract:** selector version, source match, selected player,
queue, timeline completeness, and a bounded list of stable moment IDs, actual
timestamps, event references, observed statement, explanation, limitations and
an internal evidence link. Mark approximate frame-derived values explicitly.
Use event timestamps; never treat frame index as elapsed minutes. Deduplicate
identical events without inventing missing actions. Handle purchase undo/sale
before describing a committed build decision.

Prefer well-supported observations such as an actual objective sequence, an
observable item transaction or a distinct recorded skirmish. “Pivotal” is a
selection label, not a causal verdict: do not say a death lost the game or a
purchase guaranteed a fight. If support for the proposed moment is weak, omit
it. Summary evidence remains available when the timeline fails.

**Acceptance criteria:** a player receives at most three concise moments without
manual searching; every claim resolves to loaded evidence; each moment's time
and context are visible; no record fabricates map visibility or hidden live
information; supported non-SR modes use their own semantics. No external video,
desktop client or replay upload is required. Do not label a timestamp card a
video clip.

**Tests:** cover irregular frame intervals, missing frames, duplicated events,
out-of-order timestamps, wrong player/match, unavailable timeline, an undone
purchase, contradictory mode, ARAM deaths and malformed optional fields. Verify
stable IDs and deterministic ordering. Browser-test source navigation and a
timeline error that leaves the summary usable. Preserve explicit AI behavior.

**Measurement:** consented/inert moment-open and source-inspection rates among
eligible timeline requests, timeline request cost and unavailable-result rate.
Do not optimize the count of alarming “mistake” cards. Reject compulsory replay
work, manual notes, ungrounded skill grades and loss-driven engagement pressure.

## Prompt 5 — Explain the patch decisions relevant to my recorded loadout

**Copy this implementation brief:**

Apply the shared contract and Prompt 1. Extend the already implemented personal
patch-impact feature. Do not add a second patch dashboard, generic patch digest
or duplicate build calculator. Begin with
`src/components/companion/PatchImpact.tsx`,
`src/lib/player/patch-impact.ts`, `src/lib/player/impact-service.ts`,
`src/lib/player/advice.ts`, `src/lib/patch-context.ts`,
`src/lib/briefing-archive.ts`, `docs/personal-patch-impact/README.md` and the
patch-impact tests.

Answer: “Which documented change actually touches the champion and final items
from my imported game, and what choice is worth reconsidering?” Automatically
use the recent source match and its known patch baseline. Lead with one relevant
change; let the player inspect the existing formulas and source records. Do not
ask them to recreate their build or enter an opponent's stats.

Keep `PatchImpactReport` and the existing report pipeline as the base contract.
If adding a decision card, make it an additive structure with source match,
exact queue, baseline/target archive versions, supporting record IDs, a plain
observation, at most two valid choices, assumptions and exclusions. A choice
may be “keep using this recorded option”; a changed number does not prove a
different item is better. Never label a final inventory as purchase order.

For an automatic alternative, require verified item identity, compatible mode,
explicit comparable formulas and documented tradeoffs. Withhold unsupported
passive, stack, rune, enemy-defense or whole-fight calculations. No fabricated
win probability, “best build” or automatic rune/item changes. Arena augment/item
win-rate recommendations remain excluded. Ordinary ARAM, Mayhem and Swiftplay
cannot silently inherit standard SR item calculations.

**Failure modes:** unknown game-to-archive baseline, missing contiguous change
chain, missing item metadata, name collision, removed item, rework, partial
formula support, source-version mismatch and stale archive. Preserve supported
partial evidence and explain the uncomputed portion. Say “latest archived”;
never fetch the newest unrelated Data Dragon version as a historical substitute.

**Acceptance criteria:** the first useful change is selected without manual
input; every number has a supported formula and source; no recommendation
outgrows the calculation; unchanged or unsupported contexts remain useful and
honest. The source match, exact archive interval and existing impact view stay
one click away. Optional saving retains actual provenance and remains explicit.

**Tests:** extend `tests/unit/patch-impact.test.ts`,
`tests/unit/patch-impact-service.test.ts`,
`tests/unit/patch-impact-api.test.ts` and
`tests/e2e/personal-patch-impact.spec.ts` around the actual new calculation or
selection rule. Include version mismatch, item aliases, mode exclusions, unknown
baseline and a partial metadata failure. Do not add snapshots that merely repeat
the implementation's own formula as expected output.

**Measurement:** eligible source-match coverage, evidence opens, understood
decision/action feedback if voluntarily given, and cache/API cost. Use existing
consented instrumentation or an inert contract. No inferred purchase attribution
or promised uplift. Reject build-entry busywork, generic metric walls, hidden
confidence scores and “you must play now” messaging.

## Prompt 6 — Verified identity and durable personal history

**Copy this implementation brief:**

Apply the shared contract and Prompt 1. Design and implement a bounded verified
account/history foundation only after inspecting the actual deployment and
credential availability. The current product has browser-local selected-player
state, not verified ownership, cross-device accounts or guaranteed background
sync. Do not describe a public lookup as authentication.

Read `src/lib/player/identity.ts`, `src/components/player/useSelectedPlayer.ts`,
`src/components/player/usePlayerHistory.ts`, `src/lib/player/access.ts`,
`src/lib/player/server.ts`, `src/lib/player/riot-budget.ts`,
`src/pages/api/player/[action].ts`, `docs/player-release.md` and
`src/lib/player/memory.ts`. Verify current Riot RSO requirements and use an
approved integration when credentials exist. Do not collect Riot passwords.
An application login alone does not prove ownership of a Riot account.

**Proposed server contracts:** application user, verified Riot identity binding,
scoped session, explicit history-sync consent, versioned import cursor, unique
player/server/match record, job status, retention policy and per-user entitlement
reference. Separate authorization from display names. Define database migrations,
ownership checks and uniqueness constraints before wiring the UI. Existing Redis
cache/budget state is not automatically the durable user database.

Once verification is available, make opt-in linking short. Existing anonymous
briefings must remain usable. Browser-local notes and Build Memory must not be
uploaded automatically: provide a separate reviewable migration when requested,
preserve local originals and handle conflicts without loss. Progress sync should
preserve original activation times, evidence and algorithm versions.

**Sync behavior:** fetch only new match IDs, maintain an explicit bounded backfill
window, deduplicate records, enforce per-region/method/application budgets and
honor `Retry-After`. Jobs need durable cursors, idempotency, bounded retries and
an observable paused/error state. A closed browser may receive background
processing only when a real authorized scheduler/worker has been implemented.
Provide unlink, sync pause, export and deletion with verified ownership checks.

**Acceptance criteria:** a verified user can resume the same valid progress on
two devices; another user cannot read or mutate it; revocation stops future
processing; deletion behaves as documented; duplicate jobs cannot duplicate
progress; outages preserve the last successful data with freshness shown.
Unavailable RSO/service credentials produce an honest disabled integration
boundary, never a fake successful sign-in.

**Tests:** authorization and cross-account access, session expiry/CSRF/replay as
appropriate, cursor recovery, duplicate job delivery, concurrent imports,
partial match failure, 429 pause, consent revocation during a job, retention,
deletion and local-data migration conflict. Run a full account-to-data-to-response
integration in an isolated environment before enabling sync. Do not place
secrets or production player fixtures in tests or logs.

**Measurement:** sync success within the declared freshness window, requests and
storage per active opted-in account, deduplication, recoverable failure and
cross-device continuity. Operational logs should omit credentials and minimize
player data. Product analytics remains separately consented. This infrastructure
is a prerequisite for Prompts 7 and 8, not authorization to enable billing,
expand ingestion indefinitely or introduce mandatory diaries and streaks.

## Prompt 7 — Consented duo patterns, one useful coordination cue

**Copy this implementation brief:**

Apply the shared contract and Prompt 1. After the verified identity, permissions
and durable-history work in Prompt 6 is operational, implement a duo experience
that answers: “What is one thing we can coordinate better in our next game
together?” Do not build a social feed or infer friendship from recurring names.

Reuse `Match`/participant/mode semantics in `src/lib/player/contracts.ts` and
`src/lib/player/modes.ts`, the existing server budget and cached match readers,
and the new verified account service. The existing
`src/components/player/PlayerProfile.tsx` and `src/pages/next-game.astro` are
candidate entry points; choose one primary flow rather than several new menus.

**Consent and data contract:** create a versioned pair with both verified
members' acceptance, scope, creation/revocation times, and access policy. An
invitation is a user action; do not send messages automatically. Analyze only
matches in the consented scope where both players are recorded on the same
team. Store unique match references, exact queue, each champion/role, patch,
sample completeness and the evidence for one cue. No partner discovery from
hidden players or exposure of custom-match data without its required permission.

Begin with descriptive, supportable patterns from shared records. Timeline
co-involvement requires the necessary real event fields and authorized timeline
retrieval. A shared KDA or win percentage is not “synergy,” communication quality
or proof that the duo caused a result. Do not rank friendships or label the
partner a liability. If the sample cannot support a coordination inference,
show an observed shared highlight and the limitation.

**Acceptance criteria:** both players can understand and revoke the pairing;
neither sees the other's private notes or unrelated histories; the selected cue
requires no manual match tagging, replay upload or journaling; one useful shared
observation leads the experience; evidence is accessible to both under the same
permissions. Revocation removes access and stops future pair processing. Basic
solo functionality remains independent of a partner accepting.

**Tests:** second-party acceptance, unauthorized third-party reads, declined or
revoked invitations, account re-link, same match/opposite teams, duplicate match,
different queues, role/patch mismatch, insufficient history, hidden/custom-data
exclusion and deletion during processing. Test any sharing route against expired
or guessed tokens. Browser-test both members' experience with authorized test
identities; do not use real invitations for verification.

**Measurement:** accepted-pair activation, supported shared-result coverage,
evidence use and voluntary return by both members, using consented aggregate
events. Track revoked pairs as a normal preference, not a failure to prevent.
No public leaderboards, unsolicited reminders, manual reporting burden, opaque
synergy scores, punitive streaks or promises of more wins.

## Prompt 8 — Premium value and subscription readiness, without checkout

**Copy this implementation brief:**

Apply the shared contract and Prompt 1. After Prompt 6, prepare a trustworthy
free/premium boundary for future monetization. Keep purchasing and paid
entitlement issuance disabled until separately requested and configured. This
task does not authorize live prices, checkout, charges, trial countdowns or
claims that a future premium feature is available.

Read the actual verified account service, the automatic briefing/Momentum,
patch-impact and review modules, `src/lib/player/access.ts`,
`src/pages/api/player/[action].ts`, and the current Riot policies. Preserve the
free useful core: account lookup, a recent automatic briefing, one valid personal
focus, basic exact evidence and ordinary archive access. Do not move the only
useful output behind a decorative locked card.

Choose premium candidates only when they already deliver extra transformative
value: a longer verified history with adaptive reviews, deeper supported
post-match evidence, or a consented duo review. Longer raw data alone is a weak
product proposition. For each candidate define the customer benefit, actual
incremental cost, supported coverage and limitation. Do not invent demand,
conversion or savings figures; record pricing as an untested future hypothesis.

**Entitlement contract:** server-authoritative subject, feature/capability,
scope/limit, grant source, validity interval, version and audit reference.
Distinguish anonymous/free, eligible preview, granted, expired, unavailable and
administratively revoked states. Feature availability is separate from
entitlement: a subscription cannot manufacture missing Riot evidence. Never
trust a browser flag or request parameter as proof of access.

Add a billing-provider interface and disabled configuration boundary only if it
serves a tested next integration. No provider purchase is needed for readiness.
Document the eventual webhook requirements: signature verification, replay
protection, idempotent event IDs, ordering, refunds/cancellations, grace-period
policy and reconciliation. Do not implement fake payment events that grant
production premium access. Test adapters stay isolated from production.

**Acceptance criteria:** server checks gate only real additional capabilities;
free features remain complete during billing/provider failure; limits and access
states are comprehensible; downgrading does not silently delete the user's
records; no secrets reach the client; checkout cannot be activated accidentally
by a front-end toggle. Document the Riot registration/audit and business choices
still needed before monetization without claiming they have been completed.

**Tests:** direct API bypass, forged client plan, stale/expired grant, cross-user
entitlement, unavailable feature with a valid grant, missing configuration and
provider timeout. If a webhook adapter exists, verify signature rejection,
duplicates, out-of-order events, replay and environment separation. Meaningfully
test downgrade/read/export behavior. Do not run real transactions.

**Measurement:** initially measure only consented interest or voluntary feedback
on the concrete additional value, plus cost per eligible result and feature
coverage. Purchase conversion, churn and revenue are undefined until real billing
exists. Never report a mock funnel as revenue evidence. The completion report
must explicitly separate implemented entitlement plumbing, functioning premium
value and disabled purchasing. Reject dark patterns, fake scarcity, punitive
engagement, manual productivity tasks and opaque confidence/skill grades.

---

## Evidence required before calling any prompt complete

Record the exact implementation scope, verification performed, remaining
unavailable dependencies and user-visible limitations. Cite the commit/PR and
deployment actually verified when available. A module name, roadmap checkbox,
passing build or mocked account flow alone does not establish a shipped feature.
Keep future claims out of current marketing. For the first release, prioritize
the working Momentum loop and its source evidence over expanding the roadmap.
