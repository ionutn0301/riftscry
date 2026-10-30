# Connected Observatory: research and experience contract

Research date: 30 October 2026. This document distinguishes observations from the creators' published descriptions from the design decisions proposed for RiftScry. The examples are a qualitative reference set, not a measurement of the whole market.

## What recent experiences demonstrate

| Primary source | What its creator documents | Lesson inferred for RiftScry |
| --- | --- | --- |
| [Audemars Piguet — House of Wonders, makemepulse](https://www.makemepulse.com/case-study/audemars-piguet-the-house-of-wonders) | A central website with 20 interactive rooms, connected to related AR and WebXR experiences. The related Journey of an Idea uses three symbolic spaces with different purposes. | Give each destination a recognizable purpose within one shared world. Content becomes something the visitor discovers and operates. |
| [Brunello Cucinelli — Human-Centred AI E-commerce, makemepulse](https://www.makemepulse.com/case-study/brunello-cucinelli-ai-shopping-experience), with [the studio's 2026 launch article](https://www.makemepulse.com/news/makemepulse-reimagines-a-e-commerce-platform-with-callimacus-technology) | An intent-led experience assembled from modular interface components, with different paths for product, discovery, and inspirational intent. | Carry context and offer the next useful action. RiftScry can do this with explicit rules and existing data; this lesson does not require a chatbot or generative AI. |
| [Bruno Simon's current portfolio](https://bruno-simon.com/) | The live site presents an explorable world with desktop, touch, and gamepad controls, plus a map command, sound/quality settings, and recovery controls. | A coherent interaction metaphor makes a place memorable. Use selectable destinations and direct access; driving would add unnecessary work to this product. |
| [ICARE — WithLore / World Labs, June 2026](https://www.worldlabs.ai/case-studies/icare) | Connected browser environments combining exploration, interaction, narrative, and cinematic presentation. Large scenes use progressive streaming. | Continuity between meaningful interactions matters more than applying a different decorative effect to each page. This is a design lesson, not a recommendation to add Gaussian splats. |
| [After Hours — Twined](https://www.twined.io/work/after-hours) | Practical content maps to places such as the Backlot, Foundry, and Post Office. Direct site navigation remains available, and a selected service carries into an inquiry. | Every place needs a job. Context should survive moving between tasks, and visitors should retain a direct route to information. |

No engagement, conversion, rendering-speed, or commercial outcome from these projects is a promised outcome for RiftScry. Their assets, scenes, and brand identities are not copied.

## Chosen direction

Use a navigable Observatory with focused task stations. The visitor chooses a destination, the scene reframes, and the relevant task occupies the same visual world. The core grammar is **select → inspect → continue**.

This combines spatial destinations with context-aware continuity. A compulsory sequence of Next buttons would add work, while free movement would require learning controls before reaching useful information. Both remain less appropriate than clearly named destinations with immediate interaction feedback.

The background alone is insufficient. The selected destination, champion, release, or match must visibly influence the composition and the active content. Data views become focused stations; the visitor should not repeatedly pass through a large title and explanatory article to reach the task.

## Cross-route contract

| Destination | Route families | Primary purpose |
| --- | --- | --- |
| Arrival / world | `/` | Choose a useful destination or resume an existing context. |
| Patches | `/patches`, `/patch/[id]`, `/compare/[a]/[b]` | Select a release, inspect relevant changes, and compare when useful. |
| Champions | `/champions`, `/champion/[slug]`, `/explore` | Select a champion and inspect exact changes through time. |
| Games | `/players`, `/players/[platform]/[puuid]`, `/matches/[matchId]` | Identify a player once and inspect recent games. |
| Briefing | `/next-game` | Review a prepared focus, relevant changes, and the recorded loadout. |
| Saved | `/pool`, `/notebook` | Return to chosen champions, kept findings, and optional notes. |
| Recovery | `/404` and missing routes | Return to the world or a useful valid destination. |

The five named destinations above describe the implemented information architecture. Existing URLs, query context, useful data, and source links remain addressable. The same navigation and task grammar applies to every route family, including player data, detail records, empty states, and errors.

### Interaction and content rules

- Station navigation remains directly available. No mandatory intro, gameplay, drag, or precise gesture stands between the visitor and their task.
- Selecting an item updates a focused view. Inspecting it reveals useful detail. Continuing carries the selected context to an adjacent task where supported.
- Opening screens use short, plain labels and one concise explanation. Detailed records, provenance, and explanations remain available in the appropriate panel or disclosure.
- Preserve the last valid player or selection where the product already supports it. Prefill an available context instead of repeatedly presenting an empty form.
- Offer concise derived briefings using available data and explicit rules. Do not fabricate insights, silently save inferred selections, or imply live data where fixtures or archived records are being shown.
- Keep document navigation and direct links meaningful. Back, Forward, refresh, deep links, and modified link clicks must remain coherent.
- Each active station has a clear focus and one primary next action. The same scene-navigation treatment must reach the whole platform, not stop at the homepage.

### Device and motion rules

- The primary station entrance and navigation fit the viewport. Reading regions may scroll naturally when real data requires space; the overall journey should not be a long stack of hero sections.
- Touch and keyboard users receive the same destinations and task results. Gesture interactions also expose clickable or tappable controls.
- Reduced motion preserves the complete task and selection state with immediate changes or restrained fades instead of camera travel.
- The scene must not intercept controls, trap focus, prevent zoom, or make data unavailable when WebGL fails.
- Sound remains opt-in. Visual movement is a response to selection and navigation, not a requirement to wait.

These are implementation acceptance criteria, not externally measured performance promises. The gesture rule is supported by [W3C Understanding SC 2.5.7: Dragging Movements](https://www.w3.org/WAI/WCAG22/Understanding/dragging-movements), which requires a single-pointer alternative for author-implemented dragging actions. Keyboard equivalence alone is a separate consideration.

## Verification priorities

Verify actual journeys, not only screenshots or implementation flags: destination selection changes the active station; direct navigation and browser history restore useful state; a selected champion or match reaches its next task; all route families keep their primary action reachable on desktop and touch; reduced motion and renderer failure preserve the same tasks. Reuse existing data-integrity and fixture-backed player tests instead of duplicating them.
