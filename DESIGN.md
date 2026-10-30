# RiftScry design

## Current direction: the signal journey

This is the design contract implemented in the 30 October 2026 refactor. It
supersedes earlier scrolling-homepage, observatory, and disconnected player
presentation amendments. See the [platform audit](docs/signal-journey/AUDIT.md)
and [research](docs/signal-journey/RESEARCH.md) for the rationale, and
[PRODUCT.md](PRODUCT.md) for evidence, queue, privacy, and storage contracts.

The organizing idea is the space between games: where the visitor left off,
what changed, and what they take forward. A champion, player, recorded match, or
patch pair gives the scene a subject. **Choose → reveal → inspect → keep** is the
shared interaction grammar. The important moment is an understandable change or
useful recorded fact; scenery and movement frame that moment.

## One shell across the platform

The header offers Discover, My game, and Saved. The map provides direct links to
the five established destinations, with comparison, exploration, and notebook
shortcuts. A lower continuation link follows the selected archive subject or
player; named scene tabs and previous/next controls belong to the active route.
No destination requires completing the homepage first.

After enhancement, the shell fits the viewport and exposes one active scene.
Long evidence has a natural scrolling area within that scene. Hidden scenes are
inert and removed from the focus order. Headers and route controls stay reachable;
short screens must not hide the action or create a second document-sized page
inside the shell. Ordinary document flow and source records remain the archive
fallback without JavaScript.

URL queries and fragments carry actual subject, scope, and scene state. Direct
links, reload, modified clicks, and Back/Forward remain native browser behaviors.
A transition expresses navigation after the selection is committed; it must not
delay a request, block a record, or require an animation to finish.

## The opening and its continuations

The homepage is `SignalJourney.astro`. It has three focused scenes:

| Scene | Experience |
| --- | --- |
| Find a signal — `#signal` | Recognizable champion art, a real archive example, a reveal action, and a direct route to the visitor's games. Featured subjects change the actual record. |
| Reveal the change — `#reveal` | An exact before/after record or rule is the focal object. The field, patch, and source remain identifiable; keeping the finding is explicit. |
| Take it forward — `#carry` | The selected record remains recognizable. Continue to the briefing, reopen kept findings, or trace the same subject in `/explore`. |

The homepage does not fetch player records. A validated remembered player
personalizes its briefing link; public archive context can offer a continuation.
Neither behavior invents a personal result from the archive example.

`/explore` continues through the selected change, its history, and the return
scene. It retains the existing canonical champion model, field and interval
controls, exact records, and URL compatibility. Full champion, patch, and
comparison routes are alternate entry points into the same evidence.

## A record as an interaction

`SignalRecord.astro` is the shared record presentation. The selected field is
prominent, before/after strings are real text, and a source link stays nearby.
A native range input and Before/After buttons change visual emphasis; they do
not interpolate a stat, alter source values, or imply a game simulation. Long
rank arrays, scaling expressions, units, and prose stay complete.

Champion histories focus one dated record while retaining the rest as ordinary
links or disclosures. Patch pages focus one champion record with filters and
native hash navigation. The patch directory's timeline selects a real dated
patch. Comparison selects a champion within the explicit `(older, newer]`
interval and opens its underlying records. Classification labels keep text and
glyph semantics; color alone never carries the conclusion.

## Player tasks with less repeated work

- **Briefing:** lead with one supported focus. Exact patch deltas or measured
  comparisons are prominent; the reason and calculation details are disclosures.
  Player, mode, and refresh settings are grouped under the player summary.
  Import status, partial samples, failures, and the retry action stay visible.
- **Gateway and profile:** use a compact identity and a useful first action.
  Explicit valid player selection supplies continuity. Account data, not a
  query-string name, identifies the player. Recognizable mode categories expose
  exact queues; matches are whole-row links with champion, mode, result, KDA,
  final items, date, and duration. Filters and statistics are optional.
- **Match:** move between overview, review, evidence, and Build Memory scenes.
  The recorded summary works before optional timeline or AI requests. A labelled
  AI result keeps its evidence and full text available. Keep loadout retains the
  source game and opens the notebook without re-entering items.
- **Adjustment:** a generated suggestion arrives as a prepared summary with one
  Save adjustment action. Edit details exposes the complete native form; manual
  adjustments begin with fields open. Invalid hidden fields reopen for correction.
  Opening a draft never saves it or starts prospective tracking.
- **Notebook and Saved:** notes and retained material are useful immediately.
  A kept loadout can prefill its champion and exact mode for an optional game
  card. Starting a card, saving a reflection, reviewing a patch, and keeping a
  finding remain separate deliberate actions.

These presentation changes retain exact queues, real missing-data states,
source links, player-scoped comparison eligibility, existing storage keys, and
all API access and rate-limit boundaries described in PRODUCT.md.

## Visual world, motion, and access

The shared palette is ink, pale paper, and a restrained green signal, defined in
`experience-shell.css`. Clash Display carries the large subject headings;
General Sans carries controls and reading; Spline Sans Mono identifies compact
coordinates and metadata. Use open compositions, quiet borders, and intentional
changes of scale. Reduce repeated explanation through native disclosures, not
by truncating a visitor's notes or removing evidence.

Original RiftScry environment illustrations establish continuity. Official Riot
champion icons, portraits, and splash artwork provide identity. Their provenance
and roles are distinct; see [the environment asset record](public/images/voyage/README.md).
Keep source text separate from imagery. Failed art retains readable identity and
the task's controls. The optional environment renderer has a static fallback;
no sound or 3D interaction is required to navigate or inspect a record.

Scene and supported cross-document transitions preserve a recognizable subject
and direction of travel. Operating-system reduced motion and the persistent
motion control retain all choices with nonessential movement removed. Before/After
and timeline interactions have click/tap and keyboard alternatives to dragging.
Preserve the skip link, visible focus, labelled controls, dialog Escape and focus
return, search with Cmd/Ctrl+K, and the guarded Alt+M map shortcut. Keyboard
shortcuts must not capture text entry or composition.

## Active implementation map

| Responsibility | Active sources |
| --- | --- |
| Shared shell and navigation | `src/layouts/Layout.astro`, `src/components/experience/JourneyWayfinder.astro`, `src/components/experience/JourneyChrome.astro`, `src/styles/experience-shell.css` |
| Scene visibility, history, and focus | `src/scripts/connected-observatory.ts`; shared map/motion behavior in `src/scripts/experience.ts` |
| Public subject and player continuation | `src/scripts/signal-continuity.ts`, `src/lib/signal-context.ts`, `src/lib/player/identity.ts` |
| Homepage | `src/components/experience/SignalJourney.astro`, `src/scripts/signal-journey.ts`, `src/styles/signal-journey.css` |
| Shared exact records and readers | `src/components/experience/SignalRecord.astro`, `src/scripts/signal-record.ts`, `src/styles/signal-readers.css` |
| Champion exploration | `src/components/experience/HomeVoyage.astro`, `src/scripts/voyage.ts`, `src/styles/signal-explore.css` |
| Roster/archive preview and comparisons | `src/scripts/reader-lens.ts`, `src/scripts/signal-comparison.ts` |
| Player, briefing, and notebook presentation | `src/components/player/`, `src/components/companion/`, `src/styles/signal-player.css`, and their retained task styles |
| Shared environment | `src/components/experience/RiftScene.astro`, `src/scripts/rift-scene.ts`, `src/styles/rift-scene.css` |

The filename `connected-observatory.ts` remains the scene controller; it does not
reintroduce the retired observatory homepage. Superseded global style layers and
unreachable presentation trees were removed. Add shared layout changes to the
single shell, and task-specific changes to the relevant route styles.

Build-time archive data supplies `/journey/roster.json` and compact
`/journey/:canonicalId.json` models. Champion exploration loads another model on
demand. React islands remain for bounded product tasks; do not hydrate the entire
archive merely to present the opening scene.

## Verification and historical evidence

Verification of this refactor is still in progress. Record the tested commit and
actual results in the pull request and CI artifacts. Test collection is not a
browser pass, historical screenshots are not current baselines, and controlled
fixtures do not establish successful live Riot or AI access.

Acceptance must follow a complete route: enter or resume, choose a subject,
reveal evidence, inspect its source, keep a finding/loadout/adjustment, reopen it,
and return through browser Back. Check desktop, portrait, 320px and short-landscape
viewports, enlarged text, keyboard-only access, reduced motion, long records,
empty/partial imports, cooldowns, API failures, and unavailable storage or artwork.
Measure performance on the actual build; neither the architecture nor a screenshot
establishes a cinematic, accessible, or fast experience.

Earlier checkpoints and assets remain in [docs](docs/), including the
[connected-observatory record](docs/connected-observatory/README.md),
[player release history](docs/player-release.md), and
[release evidence](docs/RELEASE_EVIDENCE.md). Their presentation descriptions and
check results apply to their own commits. Git history retains superseded designs.
