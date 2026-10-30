# Research behind the signal journey

Reviewed 30 October 2026. This is a focused comparison of current examples and
primary technical guidance, used to make concrete design decisions for RiftScry.
It is a qualitative sample rather than a market-wide popularity ranking.

## What the examples support

| Source | Verified observation | RiftScry decision |
| --- | --- | --- |
| [Bruno Simon's current portfolio](https://bruno-simon.com/?lang=en) | Visitors drive through the portfolio; its interface exposes a map, audio/quality controls, and recovery actions. | Make navigation a meaningful activity, with direct access and recovery always available. For RiftScry, the activity is finding what changed for the next game. |
| [Active Theory: making Santioni's Notturno experience](https://lbbonline.com/news/the-notturno-experience-how-we-built-santioni-spirits-launch), 17 September 2026 | The creators describe deliberate colour and framing progression, concentrating interaction on three story moments, and bridging the final immersive scene into information. | Give selection, evidence reveal, and retaining a finding the strongest choreography. Keep useful content inside the same visual world across routes. |
| [Same-document View Transitions became Baseline Newly Available](https://web.dev/blog/same-document-view-transitions-are-now-baseline-newly-available), 16 October 2025 | The documented same-document transition features reached all three major browser engines; the article distinguishes additional feature support. | Use progressive enhancement and actual subject continuity without requiring a new 3D engine. Check support for each API used. |
| [MDN: View Transition API](https://developer.mozilla.org/en-US/docs/Web/API/View_Transition_API) | Transitions can connect DOM states and, where supported, documents; the guidance describes continuity and focus problems with bespoke implementations. | Preserve real routes and browser behavior. Let presentation express a committed navigation instead of delaying it. |

## A direction specific to this product

The organizing idea is the interval between games: **where you left off, what
moved, and what you take forward**. The selected champion, player, match, or patch
pair supplies the subject. It stays recognizable as the scene changes scale or
perspective. Large exact values and source-backed observations carry the story;
short captions establish context.

The opening should offer an immediate real signal. A returning visitor can resume
the remembered player or subject; a new visitor can inspect a clearly identified
archive example. The product should not require a tutorial, a long scroll, or
several destination choices before showing its value.

A common interaction grammar connects every surface:

1. **Choose** a subject or resume valid remembered context.
2. **Reveal** the important record with clear before/after values when comparable.
3. **Inspect** the source, interval, or match evidence when needed.
4. **Keep** a useful finding, note, or build through an explicit action.

This is a product-specific synthesis of the research. It does not claim that the
interaction has never appeared elsewhere. The important departure from the
baseline is that useful evidence drives the journey, while repeated navigation
and explanatory UI recede.

## Interaction and rendering constraints

- [W3C: Animation from interactions](https://www.w3.org/WAI/WCAG22/Understanding/animation-from-interactions.html)
  supports a site-wide reduced-motion preference. Nonessential spatial movement
  must be removable without losing content or control.
- [W3C: Dragging movements](https://www.w3.org/WAI/WCAG22/Understanding/dragging-movements.html)
  requires a simple pointer alternative to nonessential dragging. Every reveal
  or timeline interaction therefore needs an ordinary click/tap path; keyboard
  support is also retained.
- [W3C: Pause, stop, hide](https://www.w3.org/WAI/WCAG22/Understanding/pause-stop-hide.html)
  explains control over automatic moving and updating content. Decorative motion
  should not compete continuously with reading or task completion.
- [web.dev: Rendering performance](https://web.dev/articles/rendering-performance)
  explains the cost of layout, paint, and compositing work. Prefer restrained
  transform/opacity choreography, bounded decoration, and prompt input response.

No benchmark, conversion improvement, accessibility conformance certification,
or physical-device performance result is inferred from these reference sites.
Those conclusions depend on verification of RiftScry itself.
