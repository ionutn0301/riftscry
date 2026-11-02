# Read the Rift: research and design record

Date: 2026-11-02

## Purpose

Give RiftScry a distinctive cinematic homepage that demonstrates development craft to prospective clients and recruiters while making the League application understandable and easy to enter. The design should grow from the product's subject and behavior, with a clear visual idea sustained throughout the experience.

This research samples recent work and its makers' explanations. It identifies useful patterns rather than claiming a comprehensive industry survey or a design that has never appeared elsewhere. Dates below are case-study publication dates unless specified otherwise. Igloo is an established reference from 2024; the October 2026 examples provide the more recent context.

## References

| Reference | Date | Observed lesson | Primary source |
| --- | --- | --- | --- |
| [Igloo Inc.](https://www.igloo.inc/) | 2024-10-31 | Abeto and Bureaux develop a scrollable spatial journey around one material world. Art and code evolve together, with performance assessed during development. The useful precedent is coherence between scene, interaction, and content. | [Abeto's case study](https://www.awwwards.com/igloo-inc-case-study.html) |
| [Juan Mora Romero](https://juanmoraromero.com/) | 2026-10-22 | A recurring optical effect unifies distinct compositions, while an exploratory Lab gives visitors something to do. Real anchor links remain available over visual planes. | [Maker's case study](https://tympanus.net/codrops/2026/10/22/juan-mora-romero-portfolio/) |
| [Noho concept redesign](https://noho.ink/) | 2026-10-15 | Interaction follows the product's character and is strongest where it explains something. Runtime work responds to context. This is a self-initiated redesign, not a commissioned brand site. | [Makers' case study](https://tympanus.net/codrops/2026/10/15/noho-redesign/) |
| [Heron](https://heronaiapp.com/) | 2026-10-12 | Technical drawings, annotations, and a drag-to-reveal action make the product's domain its visual language. One model persists as the workflow changes, preserving context between scenes. | [Bearplus case study](https://tympanus.net/codrops/2026/10/12/heron-ai/) |
| [Chasing the Moment](https://chasing-the-moment.byholm.co/) | 2026-10-12 | A five-scene real-time webfilm uses camera direction and transitions to tell a connected story. The maker also provides written content, focusable controls, and a reduced-motion path. | [Maker's case study](https://tympanus.net/codrops/2026/10/12/chasing-the-moment/) |
| [Podium](https://podium.global/) | 2026-06-23 | Sequence, restraint, and shared material treatment preserve the rhythm of a film portfolio. Pointer movement alters the hero's grain instead of merely adding a floating cursor decoration. | [Makers' case study](https://tympanus.net/codrops/2026/06/23/podium-building-a-website-where-running-becomes-storytelling/) |
| [4WIDE](https://4wide.jp/) | 2026-04-23; site launched 2026-03-31 | A focus mode changes both information and image behavior. Expressive distortion supports a clear business message, with mobile-specific adjustments to expensive effects. | [Maker's case study](https://tympanus.net/codrops/2026/04/23/building-4wide-turning-distortion-blur-and-motion-into-a-coherent-experience/) |
| [Exat](https://exat.hottype.co/) | 2026-04-10 | Typography becomes an interactive demonstration of the product. Calm and expressive passages alternate; scroll states reverse predictably, and touch interactions are simplified deliberately. | [Studio Size case study](https://tympanus.net/codrops/2026/04/10/the-exat-microsite-pushing-a-typography-showcase-to-new-creative-extremes/) |

## Design interpretation

Three patterns are especially relevant to RiftScry.

**Subject-specific interaction creates identity.** Heron's drawing interaction and Exat's variable typography demonstrate their subjects directly. For RiftScry, an atlas, signals, records, and focused inspection provide a more grounded vocabulary than an arbitrary collection of visual effects.

**Continuity creates the journey.** Igloo, Heron, Podium, and Chasing the Moment preserve a world or object across changes in viewpoint. The important decision is what persists and what the visitor learns at each stage. More simultaneous animation does not automatically create a stronger narrative.

**Control and restraint support the spectacle.** Readable content, ordinary links, deliberate pacing, and adapted motion allow visitors to choose how deeply to explore. Clients and recruiters should be able to recognize both visual ambition and sound product judgment.

## Recommendation: Read the Rift

The homepage is conceived as a scouting instrument: a quiet, precise interface surrounding a relief atlas. Near-black surfaces, muted text, restrained warm metallic detail, and a cool active signal establish an arcane atmosphere without making every element compete for attention. Large editorial type carries the proposition; smaller labels identify actual controls and scene context.

The signature moment is information coming into focus. The same atlas remains present while its framing, emphasis, and supporting content change. Motion should make those changes understandable. Product access remains visible throughout the journey.

### Four connected scenes

| Scene | Narrative purpose | Product connection |
| --- | --- | --- |
| **Atlas** | Establish the world and the invitation to read it. | Introduce RiftScry and provide a direct entry into the existing application. |
| **Signal** | Focus attention on a particular trace or region. | Connect the visual metaphor to the application's existing records and information. |
| **Reveal** | Move from atmosphere to something inspectable. | Present existing archive records through their native links and available states. |
| **Carry** | Resolve exploration into an action the visitor can take. | Connect to existing saved states and continuation paths. |

These are narrative responsibilities, not claims that the atlas computes gameplay analysis. The product remains the evidence: existing archive records, native links, and saved states should demonstrate what RiftScry actually does. Any sample or decorative content must remain distinguishable from real application data.

## Implementation decisions

- Limit this change to the homepage experience and its supporting presentation code. Reuse existing application routes and data contracts.
- Build a custom code-native relief atlas using the existing runtime. Add no new runtime dependencies for this direction.
- Treat the atlas as **illustrative geography**. It is not an accurate map of Summoner's Rift, and decorative movement is not live telemetry, match tracking, or a prediction.
- Keep one persistent visual surface across the four scenes so transitions retain spatial context.
- Preserve semantic text and native links outside the decorative rendering. Core navigation must not depend on the illustration or a completed animation.
- Make scene selection and product entry usable without pointer movement. Adapt the presentation for touch, keyboard use, and reduced motion.
- Use animation selectively, constrain drawing work, and stop unnecessary work when the scene is not active. These are implementation requirements, not measured performance results.
- Avoid invented accuracy metrics, player counts, improvement claims, endorsements, or analysis outputs. Explain existing capabilities in concrete language.

The intended outcome is a recognizable RiftScry experience whose visual behavior reflects its subject, with enough clarity for a first-time visitor to understand and use the product. Verification and deployment results are intentionally recorded separately.
