import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { initScene, runAll, scopedWillChange } from "./motion-utils";

/**
 * Homepage scroll narrative.
 *
 * Motion notes (per-scene, agreed before implementation):
 *
 * HERO — "the game just changed"
 *   Scrubbed pin, ≤80vh of scroll. The patch number is the shared element:
 *   digits common to 26.15/26.16 never move; only the changing digit masks
 *   out upward (clip + translateY) while the new digit masks in from below.
 *   Orbiting real deltas flash in staggered (opacity + 6px rise), headline
 *   and CTAs are visible from the start (static page = from-state). Scrub
 *   makes the motion user-driven and interruptible; no fixed durations.
 *   Eases inside the timeline: power3.out equivalents of --ease-out.
 *
 * WALL — "compression"
 *   Scrubbed pin, ≤120vh. Phase 1: three note columns drift at different
 *   speeds (parallax, linear in scrub). Phase 2: the wall collapses —
 *   lines dim to near-nothing and columns compress toward the center
 *   (scaleY/translate) — while the funnel lines resolve one by one
 *   (opacity + 8px rise, 4 steps). The signal literally replaces the noise.
 *
 * Reduced motion / mobile: runAll() guards — reduced motion gets the static
 * composition; mobile skips pinned scenes (desktopOnly) per spec §11.
 */

gsap.registerPlugin(ScrollTrigger);

// ---------------------------------------------------------------- hero
initScene(
  "hero",
  () => {
    const hero = document.querySelector<HTMLElement>("[data-scene='hero']");
    const number = hero?.querySelector<HTMLElement>("[data-hero-number]");
    if (!hero || !number) return;

    const from = number.dataset.from ?? "";
    const to = number.dataset.to ?? "";
    if (!to) return;

    // Split into shared prefix + swapping tail so only what changed moves.
    let prefixLen = 0;
    while (prefixLen < Math.min(from.length, to.length) && from[prefixLen] === to[prefixLen]) {
      prefixLen += 1;
    }
    const prefix = to.slice(0, prefixLen);
    const oldTail = from.slice(prefixLen) || from;
    const newTail = to.slice(prefixLen) || to;
    number.innerHTML =
      `<span class="hn-prefix">${prefix}</span>` +
      `<span class="hn-swap"><span class="hn-old">${oldTail}</span><span class="hn-new">${newTail}</span></span>`;

    const oldDigit = number.querySelector<HTMLElement>(".hn-old")!;
    const newDigit = number.querySelector<HTMLElement>(".hn-new")!;
    const orbits = [...hero.querySelectorAll<HTMLElement>("[data-hero-orbit]")];
    const cue = hero.querySelector<HTMLElement>("[data-hero-cue]");

    // Start state: the OLD patch number shows; deltas hidden.
    gsap.set(newDigit, { yPercent: 60, opacity: 0, clipPath: "inset(100% 0 0 0)" });
    gsap.set(oldDigit, { yPercent: 0, opacity: 1, clipPath: "inset(0 0 0 0)" });
    gsap.set(orbits, { opacity: 0, y: 10 });

    const wc = scopedWillChange([oldDigit, newDigit], "transform, opacity, clip-path");
    const tl = gsap.timeline({
      scrollTrigger: {
        trigger: hero,
        start: "top top",
        end: "+=80%",
        scrub: 0.5,
        pin: true,
        onToggle: (self) => (self.isActive ? wc.on() : wc.off()),
      },
    });

    tl.to(oldDigit, { yPercent: -55, opacity: 0, clipPath: "inset(0 0 100% 0)", ease: "power2.in", duration: 0.4 }, 0.05)
      .to(newDigit, { yPercent: 0, opacity: 1, clipPath: "inset(0% 0 0 0)", ease: "power3.out", duration: 0.45 }, 0.22)
      .to(orbits, { opacity: 1, y: 0, ease: "power3.out", duration: 0.3, stagger: 0.07 }, 0.35)
      .to(cue, { opacity: 0, duration: 0.15 }, 0.1);
  },
  { desktopOnly: true },
);

// ---------------------------------------------------------------- wall
initScene(
  "wall",
  () => {
    const wall = document.querySelector<HTMLElement>("[data-scene='wall']");
    if (!wall) return;
    const cols = [...wall.querySelectorAll<HTMLElement>(".col")];
    const lines = [...wall.querySelectorAll<HTMLElement>(".line")];
    const funnel = [...wall.querySelectorAll<HTMLElement>("[data-wall-funnel] li")];
    const headline = wall.querySelector<HTMLElement>("[data-wall-headline]");
    if (cols.length === 0) return;

    gsap.set(funnel, { opacity: 0, y: 8 });
    gsap.set(headline, { opacity: 0.4 });

    const wc = scopedWillChange(cols, "transform");
    const tl = gsap.timeline({
      scrollTrigger: {
        trigger: wall,
        start: "top top",
        end: "+=120%",
        scrub: 0.5,
        pin: true,
        onToggle: (self) => (self.isActive ? wc.on() : wc.off()),
      },
    });

    // Phase 1 — drift: columns move at different speeds (linear in scrub).
    tl.to(cols[0]!, { yPercent: -6, ease: "none", duration: 0.5 }, 0)
      .to(cols[1]!, { yPercent: -12, ease: "none", duration: 0.5 }, 0)
      .to(cols[2] ?? cols[0]!, { yPercent: -3, ease: "none", duration: 0.5 }, 0)
      .to(headline, { opacity: 1, ease: "power2.out", duration: 0.25 }, 0.1);

    // Phase 2 — compression: the noise collapses, the signal resolves.
    tl.to(lines, { opacity: 0.08, ease: "power2.inOut", duration: 0.3 }, 0.45)
      .to(cols, { scaleY: 0.94, transformOrigin: "50% 50%", ease: "power2.inOut", duration: 0.3 }, 0.45)
      .to(funnel, { opacity: 1, y: 0, ease: "power3.out", duration: 0.22, stagger: 0.09 }, 0.55);
  },
  { desktopOnly: true },
);

runAll();
