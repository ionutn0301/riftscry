# Stay with the evidence

Follow-up audit and implementation: 30 October 2026. Baseline: the kinetic
observatory release at `ce1ce5f4d04217179feb7ef774dd31be9c6957f1`.

The shared world and scene navigation already span the platform. This pass makes
the investigation continuous inside that world: changing a perspective, following
a source, or returning from a game should retain the actual record and scope.

## Explore becomes a smaller, continuous instrument

One champion-and-field control remains available in both **The change** and
**Through time**. Choosing another field or champion while following the timeline
keeps that scene open. The selected event, interval, and unrelated query values
stay in the URL; reload and browser history resolve the same canonical evidence.

The timeline separates selection from reading. Date controls select real patches,
and each chronological stop shows its date and patch number. The selected record
has one complete value readout next to its full field name, exact date, original source, and
explicit keep action. Rank arrays, units, and rule-change prose remain complete.
The accessible name of each date also includes its full recorded change.

Longer interpretation moves into **Read the context**, a native disclosure. The
interval's starting-excluded, ending-included meaning stays visible. Empty
intervals retain their explicit coverage message and recovery controls.

Artwork and its unavailable state now occupy the same media cell. A failed
external image cannot add a row to the phone's identity layout and push the name
or save control into the field selector. Successful artwork retains its original
framing; records and navigation work when imagery is unavailable.
Compact champion choices also retain explicit accessible names and show an
initials fallback when their thumbnail fails, including on phones where the
full visible labels are abbreviated.
Short landscape screens put champion and field selection on one control row,
leaving enough reading height for native touch controls, including Safari's
larger select elements.

## Follow a record without changing its meaning

A patch's champion link carries that patch's exact history fragment. For example,
Ahri's 26.3 cooldown record returns to 26.3 after opening the patch; it no longer
jumps to the latest damage record.

Comparison intervals retain the active Champions, Items, or Systems scene when
that scene has records in the new interval. Missing scenes fall back to Champions.
Contextual champion comparisons hide empty classification groups and report the
visible counts. **Show all champions** restores the complete interval and labels
that broader scope.

## One player task across destinations

The shared Briefing and Games links read the current task URL. An explicit routed
player takes precedence over a remembered player, including a shortcut changed in
another tab. Queue and champion filters follow the task across those stations.

Briefing source games carry their originating scene and scope. A match opened
from Loadout can return to that same Loadout, queue, champion, and player. Return
destinations accept only the same player's local profile or briefing; external,
cross-player, incomplete, and nested-match destinations fall back to the player's
profile. Private player task state does not replace the public reading resume.

Evidence in match review uses native anchors. Modified activation remains native;
ordinary keyboard activation commits one scene and focuses the actual evidence.
Timeline and AI generation remain explicit requests.

## Close the saved-loadout loop

**Your builds** now exposes the existing explicit **Save loadout** action. After a
successful device-local save, that same action area becomes **View saved loadout**
and opens the Notebook's Loadouts scene. The saved record retains its source game,
player, queue, champion, patch, final items, and runes. Repeated activation does not
duplicate the source loadout. Metadata shares the existing per-patch cache.

No save action is added to match review or the automatic briefing. Viewing a game
or opening a source creates no note, finding, reviewed baseline, or saved build.
Storage failure is reported without presenting an unsuccessful write as saved.

## Movement belongs to the selected evidence

Roster media, patch readouts, champion history, patch records, and Explore use one
small selection-presentation helper. The selected data, DOM, URL, and accessible
state commit synchronously. The changing pane then receives a 180 ms opacity
emphasis; controls retain their size, position, and immediate response.

The helper seeds the initial identity without animation, replaces only its own
in-progress effect, and never clones controls or interpolates numeric records.
Hidden selections update their identity without replaying an old change when
revealed. Device, saved, and visit motion preferences cancel active effects.
Back-forward-cache restoration retains selection identity and live listeners.

## Reference review and implementation choice

This is a qualitative review of interaction techniques, not a market-adoption
measurement or a claim that a particular effect improves engagement.

- [Chrome: element-scoped view transitions](https://developer.chrome.com/docs/css-ui/view-transitions/element-scoped-view-transitions)
  illustrates transitions confined to changing content while the surrounding
  interface remains available. Its asynchronous snapshot/update lifecycle is not
  used for canonical record updates here. A small presentation-only Web Animations
  effect provides the same local focus without deferring evidence or requiring
  that newer API.
- [Observable Plot: pointer transforms](https://observablehq.github.io/plot/interactions/pointer)
  demonstrates a selected datum coordinating a marker and readout. RiftScry uses
  that principle with actual archive dates and exact values, including discrete
  keyboard and touch controls.
- [W3C: tabs pattern](https://www.w3.org/WAI/ARIA/apg/patterns/tabs/)
  informs the scene controls' keyboard and focus behavior. Selection stays
  immediate; animation never becomes a prerequisite for reading or navigation.

No dependency, data source, API budget, environment setting, or deployment
protection change is required for this pass.

## Rendered views

- [Desktop timeline](screenshots/continuous-history-desktop.jpg)
- [Phone timeline](screenshots/continuous-history-mobile.jpg)

These are actual browser captures with reduced motion selected. Both show the
same chosen field, interval, and source record. Unavailable external thumbnails
use the named initials fallback; the environment is part of the application.

## Verification

The release pull request records execution results for type checking, the full
unit/data suite, focused browser stories, the full shared and player browser
gates, and the exact tested commit. The new regressions cover exact-record
roundtrips, comparison scene/count restoration, Explore continuity and missing
artwork, selection motion ownership, player scope and cross-tab identity,
explicit loadout saves, and native evidence activation.

Player scenarios use deterministic API fixtures. They verify the UI and request
contracts, not live Riot availability. Protected hosted UI access is outside the
browser checks; production readiness, source commit, canonical alias, and retained
protection are verified through Vercel metadata after deployment.
