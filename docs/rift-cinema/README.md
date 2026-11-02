# Rift Cinema: the current homepage

Date: 2 November 2026. This document records the implemented direction and its
review procedure. The release pull request and its CI artifacts record the
exact tested revision, completed checks, deployment and remaining limitations.

## The correction that defines this direction

The user rejected the previous **atlas → signal → reveal → carry** homepage as
too static, too close to a sequence of scroll sections, and insufficiently
recognizable as League of Legends. A persistent abstract instrument and four
chapter labels did not deliver the requested cinematic experience. The
[earlier research](../cinematic-instrument/RESEARCH.md) remains useful historical
context, but its four-scene recommendation is superseded.

The new homepage is **one full-screen League world**. Akali is recognizable on
arrival, with Yasuo and Thresh available as alternate perspectives. Riot's
painted Summoner's Rift environment gives the world a specific visual identity.
The visitor changes the subject, looks around, and inspects a real archived
change without advancing through chapters or scrolling the homepage.

“The Rift has changed” connects the spectacle to the product's actual purpose.
The proof is the selected champion's dated record, exact values and Riot source.
This is a custom presentation of an existing companion application, with no
claim of a design that has never appeared elsewhere.

## What the implementation does

- **Look:** pointer movement or a touch drag adjusts the view. Layered artwork,
  mist, light shafts and motes provide depth. Champion-specific atmosphere uses
  smoke, wind or spectral colour. Moving the view is optional.
- **Choose:** Akali, Yasuo and Thresh links update the foreground, palette,
  identity, ability and actual archive record. The URL preserves the selected
  subject. Modified clicks and the unenhanced links open the record normally.
- **Inspect:** “Scry this champion” and the ability hotspot open the same evidence
  dialog. The camera reframes the champion while the exact before/after values,
  patch and source remain HTML. Long evidence can scroll inside its reading
  area; this is not a scroll-driven chapter sequence.
- **Keep and continue:** retaining a finding is explicit. The full record, kept
  findings, latest archived patch and briefing remain direct destinations.
  Existing validated reading/player context supplies return links; the homepage
  does not fetch a player's games or manufacture a personalized result.

These champions are **two-dimensional official images on layered WebGL planes**,
not rigged or volumetric 3D champion models. The shared environment is decorative
art, not live match telemetry or a statement that a champion occupies that
location in a game. The scene contains no generated substitute for Riot's art.

Cinzel gives the headline an engraved character; General Sans keeps controls and
evidence readable. Warm ivory and gold support the composition while each
champion retains their own recognisable colours.

### Implementation map

| Responsibility | Source |
| --- | --- |
| Server-rendered composition and real archive selection | [RiftCinema.astro](../../src/components/experience/RiftCinema.astro) |
| Selection, dialogs, history, explicit saving, return context and motion controls | [rift-cinema.ts](../../src/scripts/rift-cinema.ts) |
| Artwork planes, camera, atmosphere and renderer lifecycle | [rift-cinema-world.ts](../../src/lib/rift-cinema-world.ts) |
| Viewport composition, responsive treatment and static fallback | [rift-cinema.css](../../src/styles/rift-cinema.css) |
| Shared exact evidence | [SignalRecord.astro](../../src/components/experience/SignalRecord.astro) |

The renderer targets 30 frames per second, bounds device-pixel ratio and canvas
pixel count, and suspends drawing when hidden. Reduced motion renders a still
world while preserving selection and inspection. Static image layers remain the
fallback when graphics cannot start. These are source-level implementation
choices; release testing must establish their actual behavior.

## Asset provenance

Assets were retrieved on 2 November 2026. The
[asset manifest](../../public/images/rift-cinema/asset-manifest.json) contains
the exact original CDN URLs, dimensions, byte sizes, hashes and transformations.

| Asset | Primary source | Treatment |
| --- | --- | --- |
| [Akali](../../public/images/rift-cinema/akali-figure.png), [Yasuo](../../public/images/rift-cinema/yasuo-figure.png), [Thresh](../../public/images/rift-cinema/thresh-figure.png) | [Official League homepage](https://www.leagueoflegends.com/en-us/), “Choose your champion” | Original 1628 × 1628 PNGs with alpha, unchanged. Akali/Thresh retain their original thin gold rings; Yasuo retains the painted wind strokes. |
| [Summoner's Rift](../../public/images/rift-cinema/summoners-rift.webp) | [Official How to Play](https://www.leagueoflegends.com/en-us/how-to-play/), “Welcome to the Rift” | Original 3840 × 2160 painting resized to 2560 × 1440 and encoded as WebP, with alpha retained. No content was generated or retouched. |
| [Cinzel variable font](../../src/assets/fonts/rift-cinema/Cinzel-Variable.ttf) | [Google Fonts official repository](https://github.com/google/fonts/tree/main/ofl/cinzel) | Original variable font, weights 400–900, with its [SIL OFL license](../../src/assets/fonts/rift-cinema/OFL.txt). |

Champion and environment artwork belongs to Riot Games. Preserve RiftScry's
independent-project notice and Riot disclaimer. Source provenance is not an
endorsement. The canonical artwork is distinct from earlier generated
environment illustrations elsewhere in the repository.

## References that informed the interpretation

Publication dates below describe the case studies, not necessarily site launches.
These are observed precedents; the application to RiftScry is our design decision.

| Reference | Observed lesson | Application here |
| --- | --- | --- |
| [Igloo / Abeto + Bureaux](https://www.awwwards.com/igloo-inc-case-study.html), 31 October 2024 | A coherent material world, with art and code developed together and performance iteration throughout. Igloo itself uses a scrollable journey. | Preserve one world and deliberate framing; the user's correction rules out adopting its scroll structure. |
| [Heron / Bearplus](https://tympanus.net/codrops/2026/10/12/heron-ai/), 12 October 2026 | Domain-specific drawings and direct inspection make interaction explain the product. | Champion selection leads to the corresponding exact archived change. |
| [Chasing the Moment](https://tympanus.net/codrops/2026/10/12/chasing-the-moment/), 12 October 2026 | Camera direction gives a webfilm continuity; accessible text and controls accompany the scene. | Use framing and depth to connect the world to evidence; keep content outside the canvas. |
| [Juan Mora Romero](https://tympanus.net/codrops/2026/10/22/juan-mora-romero-portfolio/), 22 October 2026 | A repeated optical treatment unifies different compositions, while exploration remains actionable. | Keep the same camera language across champion choices and the evidence reveal. |

The [earlier comparison](../cinematic-instrument/RESEARCH.md#references) retains
additional references and dates. It is a qualitative sample, not a measurement
of industry-wide trends or evidence of guaranteed originality.

## Release review procedure

1. Follow the checks in [CONTRIBUTING.md](../../CONTRIBUTING.md). Record the exact
   tested commit and results in the release PR; do not infer a pass from test
   collection or a successful build alone.
2. Capture the actual before/after homepage at desktop and 390px mobile widths.
   Add motion footage showing arrival, all three champion choices, inspection,
   return and reduced motion. Review the first visible frame as well as settled
   states; screenshots alone cannot establish cinematic motion quality.
3. Check desktop, short laptop, portrait phone and landscape phone compositions.
   Confirm recognizable, unobscured champions, readable type, reachable actions,
   visible keyboard focus and a single non-scrolling homepage viewport. Inspect
   long evidence without clipping its source or action controls.
4. Exercise each champion's exact values/source, save success and failure,
   resume links, navigation/search, modified clicks, direct `?signal=` and
   `#inspect` URLs, Back/Forward, Escape and dialog focus return. Selection alone
   must not save a finding.
5. Check operating-system and saved reduced motion, no JavaScript, failed art,
   WebGL failure/context loss, background-tab suspension and rapid switching.
   Content and product access must remain usable when presentation is reduced.

Release evidence belongs to this implementation’s pull request and CI artifacts.
Earlier homepage release results are historical and do not validate this
implementation. A browser recording shows the actual composition and interaction;
it is not a benchmark for physical-device performance.
