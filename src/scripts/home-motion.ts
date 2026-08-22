/**
 * RiftScry homepage — one master timeline, one sticky stage.
 *
 * Every scene is a layer of the same composition. A single ScrollTrigger
 * scrubs one labeled timeline across the whole track, so matter (the seam,
 * the archive numerals, the emblem, champion imagery) persists across beats
 * as the same DOM nodes. Opacity is used only as depth falloff or a
 * technical visibility gate while an element is fully off-camera — never as
 * the transition itself.
 */
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

gsap.registerPlugin(ScrollTrigger);

type SignalCandidate = {
  id: string;
  name: string;
  art: string;
  historyCount: number;
};

declare global {
  interface Window {
    __riftscryJourney?: { labels: Record<string, number> };
  }
}

const DESKTOP = "(min-width: 801px) and (prefers-reduced-motion: no-preference)";
const MOBILE = "(max-width: 800px) and (prefers-reduced-motion: no-preference)";
const SCRUB = 0.7;
const SETTLE = "power3.out";

/* Beat map — one shared clock for desktop and mobile. */
const B = {
  opening: 0,
  approach: 1.0,
  macro: 2.2,
  threshold: 3.0,
  landing: 4.0,
  signal: 4.6,
  resolve: 6.2,
  delta: 7.2,
  rail: 9.0,
  history: 9.6,
  compare: 10.8,
  roles: 11.5,
  source: 12.6,
  return: 14.0,
  rest: 15.2,
} as const;
const DURATION = 16;

const vh = (n: number) => (window.innerHeight * n) / 100;
const vw = (n: number) => (window.innerWidth * n) / 100;

function personalizeSignalField(world: HTMLElement): void {
  const field = world.querySelector<HTMLElement>("[data-champion-apertures]");
  const status = world.querySelector<HTMLElement>("[data-signal-status]");
  if (!field) return;

  try {
    const candidates = JSON.parse(field.dataset.poolCandidates ?? "[]") as SignalCandidate[];
    const pool = JSON.parse(localStorage.getItem("riftscry:pool") ?? "[]") as string[];
    if (!Array.isArray(pool) || pool.length === 0) return;

    const matches = pool
      .map((id) => candidates.find((candidate) => candidate.id === id))
      .filter((candidate): candidate is SignalCandidate => Boolean(candidate));
    if (matches.length === 0) return;

    const chosen = [
      ...matches,
      ...candidates.filter((candidate) => !matches.some((match) => match.id === candidate.id)),
    ];
    const apertures = [...field.querySelectorAll<HTMLAnchorElement>("[data-champion-aperture]")];

    apertures.forEach((aperture, index) => {
      const champion = chosen[index];
      if (!champion) return;
      const image = aperture.querySelector<HTMLImageElement>("img");
      const name = aperture.querySelector<HTMLElement>("[data-champion-name]");
      const trace = aperture.querySelector<HTMLElement>("[data-champion-trace]");
      aperture.href = "/champion/" + champion.id.toLowerCase();
      aperture.dataset.championId = champion.id;
      if (image) {
        image.src = champion.art;
        image.alt = champion.name + " champion art";
      }
      if (name) name.textContent = champion.name;
      if (trace) trace.textContent = champion.historyCount + " season entries";
    });

    if (status) {
      const shownPool = Math.min(matches.length, apertures.length);
      const historyCount = chosen
        .slice(0, apertures.length)
        .reduce((total, champion) => total + champion.historyCount, 0);
      status.textContent =
        shownPool + " from your pool / " + historyCount + " season entries in view";
    }
  } catch {
    // Corrupt or unavailable local state leaves the authored exemplar intact.
  }
}

type Refs = ReturnType<typeof collect>;

function collect(world: HTMLElement) {
  const q = <T extends HTMLElement = HTMLElement>(sel: string) =>
    world.querySelector<T>(sel);
  const qa = <T extends HTMLElement = HTMLElement>(sel: string) => [
    ...world.querySelectorAll<T>(sel),
  ];

  return {
    track: q("[data-journey-track]")!,
    stage: q("[data-journey-stage]")!,
    env: q("[data-env]")!,
    envNums: qa("[data-env-num]"),
    strata: qa("[data-env-stratum]"),
    echoes: qa("[data-env-echo]"),
    seam: q("[data-seam]")!,
    emblem: q("[data-emblem]")!,
    emblemLayers: qa("[data-emblem] .rift-mark__layer"),
    hero: q("[data-station='hero']")!,
    heroMeta: q("[data-hero-meta]"),
    heroCopy: q("[data-hero-copy]"),
    versionOld: q("[data-version-old]"),
    versionCurrent: q("[data-version-current]"),
    signal: q("[data-station='signal']")!,
    ghost: q("[data-signal-ghost]"),
    strips: qa("[data-signal-strip]"),
    apertures: qa("[data-champion-aperture]"),
    apertureChrome: qa(
      ".champion-aperture__name, .champion-aperture__trace, .champion-aperture__veil",
    ),
    handoff: q("[data-handoff-ui]"),
    signalCopy: q("[data-signal-copy]"),
    signalAction: q("[data-signal-action]"),
    delta: q("[data-station='delta']")!,
    deltaCopy: q("[data-delta-copy]"),
    deltaFrames: qa("[data-delta-frame]"),
    history: q("[data-station='history']")!,
    historyCopy: q("[data-history-copy]"),
    historyPortrait: q("[data-history-portrait]"),
    historyTimeline: q("[data-history-timeline]"),
    historyNodes: qa("[data-history-node]"),
    compare: q("[data-compare-plane]"),
    roles: q("[data-role-paths]"),
    rolePaths: qa("[data-role-path]"),
    roleForks: qa(".st-history__role-fork"),
    source: q("[data-station='source']")!,
    sourceCopy: q("[data-source-copy]"),
    sourceLedger: q("[data-source-ledger]"),
    sourceGuides: qa("[data-source-guides] span"),
    sourceCode: q("[data-source-code]"),
    sourceClosing: q("[data-source-closing]"),
  };
}

interface Amplitude {
  emblemScale: [number, number, number];
  /** vw/vh translation that carries the strokes out of frame at the crossing —
      capped zoom keeps the raster crisp; the camera travels instead. */
  emblemExit: [number, number];
  apertureClip: [string, string, string];
  seamStart: number;
  stripDepth: number;
  frontTravelX: number;
  frontTravelY: number;
  timelinePan: number;
  emblemReturn: number;
}

const DESKTOP_AMP: Amplitude = {
  emblemScale: [2.0, 3.6, 5.2],
  emblemExit: [160, 22],
  apertureClip: [
    "ellipse(20% 24% at 68% 36%)",
    "ellipse(22% 28% at 68% 36%)",
    "ellipse(112% 132% at 68% 36%)",
  ],
  seamStart: 46,
  stripDepth: -900,
  frontTravelX: -26,
  frontTravelY: 4,
  timelinePan: 0.72,
  emblemReturn: 0.55,
};

const MOBILE_AMP: Amplitude = {
  emblemScale: [1.8, 3.0, 4.6],
  emblemExit: [255, 18],
  apertureClip: [
    "ellipse(22% 24% at 60% 32%)",
    "ellipse(28% 34% at 60% 32%)",
    "ellipse(120% 140% at 60% 32%)",
  ],
  seamStart: 42,
  stripDepth: -640,
  frontTravelX: -12,
  frontTravelY: 6,
  timelinePan: 0.85,
  emblemReturn: 0.8,
};

/* Initial (pre-arrival) states. Timeline time 0 must render the opening
   composition; static CSS holds each station's RESOLVED still instead. */
function setInitialStates(r: Refs, a: Amplitude): void {
  gsap.set([r.hero, r.signal], { autoAlpha: 1 });
  gsap.set([r.delta, r.history, r.source], { autoAlpha: 0 });

  gsap.set(r.seam, {
    y: vh(a.seamStart),
    rotation: window.innerWidth <= 800 ? -16 : -14,
    force3D: true,
  });

  gsap.set(r.emblem, { scale: 1, autoAlpha: 1, force3D: true });
  gsap.set(r.emblemLayers[0]!, { xPercent: -1.8, yPercent: 1.6, z: -70 });
  gsap.set(r.emblemLayers[1]!, { xPercent: -0.8, yPercent: 0.8, z: -34 });

  gsap.set(r.envNums, {
    z: (i) => -140 - i * 120,
    xPercent: (i) => i * -4,
    force3D: true,
  });

  /* Signal world, dormant behind the emblem's counter. */
  gsap.set(r.ghost, { scale: 1.3, xPercent: 7, opacity: 0.1, force3D: true });
  gsap.set(r.strips, {
    z: a.stripDepth,
    autoAlpha: 0,
    xPercent: (i) => 24 + (i % 5) * 6,
    force3D: true,
  });
  gsap.set(r.apertures, {
    y: vh(26),
    z: -420,
    scaleY: 0.12,
    autoAlpha: 0,
    force3D: true,
  });
  if (r.handoff) gsap.set(r.handoff, { clipPath: "inset(100% 0 0)" });
  gsap.set([r.signalCopy, r.signalAction], { autoAlpha: 0, y: 26 });

  /* Delta stage. */
  gsap.set(r.deltaCopy, { autoAlpha: 0, y: 22 });
  gsap.set(r.deltaFrames, { autoAlpha: 0, z: -650, scale: 0.84, force3D: true });
  r.deltaFrames.forEach((frame) => {
    const after = frame.querySelector<HTMLElement>("[data-delta-after]");
    const caption = frame.querySelector<HTMLElement>("figcaption");
    if (after) gsap.set(after, { clipPath: "inset(0 100% 0 0)", xPercent: -12 });
    if (caption) gsap.set(caption, { opacity: 0, y: 16 });
  });

  /* History. */
  gsap.set(r.historyCopy, { autoAlpha: 0, xPercent: -4 });
  gsap.set(r.historyPortrait, { opacity: 0, xPercent: 16, force3D: true });
  gsap.set(r.historyNodes, { x: () => vw(46), autoAlpha: 0, force3D: true });
  gsap.set(r.compare, { autoAlpha: 0, z: -420, rotateY: -16, force3D: true });
  gsap.set(r.rolePaths, { yPercent: 130, autoAlpha: 0, force3D: true });
  gsap.set(r.roleForks, { scaleX: 0 });

  /* Source. */
  gsap.set(r.sourceCopy, { autoAlpha: 0, y: 24 });
  gsap.set(r.sourceGuides, { scaleX: 0 });
  gsap.set(r.sourceCode, { clipPath: "inset(0 100% 0 0)" });
  gsap.set(r.sourceClosing, { autoAlpha: 0, y: 30 });
}

function buildJourney(world: HTMLElement, a: Amplitude): void {
  const r = collect(world);
  const isMobile = window.innerWidth <= 800;
  setInitialStates(r, a);

  const tl = gsap.timeline({
    defaults: { ease: "none" },
    scrollTrigger: {
      id: "journey",
      trigger: r.track,
      start: "top top",
      end: "bottom bottom",
      scrub: SCRUB,
      invalidateOnRefresh: true,
    },
  });

  for (const [name, time] of Object.entries(B)) tl.addLabel(name, time);

  /* ---------------------------------------------------- approach + macro */
  /* Information leaves fast and decisively; the monument (numeral + emblem)
     carries the long camera move. */
  tl.to(r.versionOld, { xPercent: -34, z: 180, autoAlpha: 0, duration: 0.5 }, B.approach)
    .to(r.versionCurrent, { xPercent: -14, yPercent: -16, scale: 1.42, duration: 1.4 }, B.approach)
    .to(r.heroMeta, { y: () => -vh(12), autoAlpha: 0, duration: 0.4 }, B.approach + 0.1)
    .to(r.heroCopy, { x: () => -vw(20), z: 200, autoAlpha: 0, duration: 0.3, ease: "power1.in" }, B.approach + 0.1)
    .to(r.emblem, { scale: a.emblemScale[0], duration: 1.2 }, B.approach)
    .to(r.emblemLayers[0]!, { xPercent: -3.4, yPercent: 2.8, z: -150, duration: 1.2 }, B.approach)
    .to(r.emblemLayers[1]!, { xPercent: -1.6, yPercent: 1.4, z: -70, duration: 1.2 }, B.approach)
    .to(r.signal, { clipPath: a.apertureClip[0], duration: 1.2 }, B.approach)
    .to(r.seam, { y: () => vh(a.seamStart - 4), rotation: -11, duration: 1.2 }, B.approach)
    .to(r.envNums, { xPercent: (i: number) => -6 - i * 4, z: (i: number) => -50 - i * 120, duration: 1.2 }, B.approach)
    .to(r.versionCurrent, { xPercent: -46, yPercent: -34, scale: 1.9, autoAlpha: 0, duration: 0.35 }, B.macro)
    .to(r.emblem, { scale: a.emblemScale[1], duration: 0.8 }, B.macro)
    .to(r.signal, { clipPath: a.apertureClip[1], duration: 0.8 }, B.macro)
    .to(r.seam, { y: () => vh(a.seamStart - 8), rotation: -7, scaleY: 0.8, duration: 0.8 }, B.macro)
    .to(r.ghost, { scale: 1.16, xPercent: 3, opacity: 0.16, duration: 0.8 }, B.macro)
    .set(r.hero, { autoAlpha: 0 }, B.threshold);

  /* ------------------------------------------------------------ threshold */
  /* Capped zoom (raster stays crisp) + a diagonal camera move along the
     slash carries the metal out of frame — the crossing is travel, not zoom. */
  tl.to(r.emblem, { scale: a.emblemScale[2], duration: 0.7 }, B.threshold)
    .to(r.emblem, {
      x: () => vw(a.emblemExit[0]),
      y: () => -vh(a.emblemExit[1]),
      duration: 0.55,
      ease: "power1.in",
    }, B.threshold + 0.45)
    .to(r.emblemLayers[0]!, { xPercent: -5, yPercent: 4.2, z: -230, duration: 1.0 }, B.threshold)
    .to(r.signal, { clipPath: a.apertureClip[2], duration: 1.0 }, B.threshold)
    .to(r.seam, { y: () => vh(58), rotation: -5, scaleY: 0.9, duration: 1.4, ease: "power1.inOut" }, B.threshold)
    .to(r.ghost, { scale: 1.05, xPercent: 0, opacity: 0.22, duration: 1.2 }, B.threshold + 0.2)
    .set(r.emblem, { autoAlpha: 0 }, B.landing)
    .set(r.signal, { clipPath: "none" }, B.landing);

  /* -------------------------------------------------------------- landing */
  tl.to(r.envNums, { scale: 1.16, xPercent: (i: number) => -14 - i * 4, z: (i: number) => 90 - i * 120, duration: 0.6 }, B.landing)
    .to(r.echoes, { opacity: 1, duration: 0.6 }, B.landing)
    .to(r.strata, { xPercent: -4, duration: 1.2 }, B.landing);

  /* --------------------------------------------------------------- signal */
  /* Strips light up fast, then glide in depth — visible matter from the first
     landing frame, no long dim mid-arrival. */
  tl.to(r.strips, {
    autoAlpha: 1,
    stagger: 0.04,
    duration: 0.3,
    ease: "power1.out",
  }, B.landing)
    .to(r.strips, {
      z: 0,
      xPercent: 0,
      stagger: 0.04,
      duration: 0.9,
      ease: SETTLE,
    }, B.landing)
    .to([r.signalCopy, r.signalAction], {
      autoAlpha: 1,
      y: 0,
      stagger: 0.08,
      duration: 0.3,
      ease: SETTLE,
    }, B.signal + 0.25)
    /* The cut: strips dive to the seam line and pass the lens... */
    .to(r.strips, {
      y: () => vh(30),
      scaleY: 0.2,
      stagger: 0.02,
      duration: 0.5,
      ease: "power1.in",
    }, B.signal + 0.8)
    .to(r.strips, {
      xPercent: 40,
      z: 420,
      autoAlpha: 0,
      stagger: 0.02,
      duration: 0.4,
    }, B.signal + 1.1)
    /* ...and the survivors grow back out of it as champion apertures. */
    .to(r.apertures, {
      y: 0,
      z: 0,
      scaleY: 1,
      autoAlpha: 1,
      stagger: 0.06,
      duration: 0.45,
      ease: SETTLE,
    }, B.signal + 0.75)
    .to(r.ghost, { xPercent: 10, opacity: 0.1, duration: 0.8 }, B.signal + 1.0);

  /* -------------------------------------------------------------- resolve */
  const rear = r.apertures.slice(1);
  const front = r.apertures[0];
  tl.to(rear, {
    z: 300,
    scale: 1.1,
    autoAlpha: 0,
    stagger: 0.07,
    duration: 0.35,
  }, B.resolve + 0.2)
    .to([r.signalCopy, r.signalAction], { x: -60, z: 160, autoAlpha: 0, duration: 0.25 }, B.resolve + 0.15)
    .to(r.seam, { y: () => vh(isMobile ? 80 : 72), rotation: -2, scaleY: 0.7, duration: 0.8 }, B.resolve);
  if (front) {
    tl.to(front, {
      x: () => vw(a.frontTravelX),
      y: () => vh(a.frontTravelY),
      rotateY: 0,
      scaleX: 1.85,
      scaleY: 0.8,
      duration: 0.45,
      ease: "power1.inOut",
    }, B.resolve + 0.3)
      .to(r.apertureChrome.filter((el) => front.contains(el)), {
        yPercent: -20,
        autoAlpha: 0,
        duration: 0.18,
      }, B.resolve + 0.35);
    if (r.handoff) {
      tl.to(r.handoff, { clipPath: "inset(0% 0 0)", duration: 0.28, ease: SETTLE }, B.resolve + 0.6);
    }
    tl.to(front, { scaleX: 2.35, scaleY: 1.12, z: 140, autoAlpha: 0, duration: 0.25 }, B.delta - 0.25);
  }
  tl.set(r.signal, { autoAlpha: 0 }, B.delta + 0.1);

  /* ---------------------------------------------------------------- delta */
  /* The heading arrives while the plate is still on stage, so the
     environment-to-UI moment reads in context, never in a void. */
  tl.set(r.delta, { autoAlpha: 1 }, B.resolve + 0.7)
    .to(r.deltaCopy, { autoAlpha: 1, y: 0, duration: 0.3, ease: SETTLE }, B.resolve + 0.75);

  const slots: Array<[number, number]> = [
    [B.delta - 0.05, B.delta + 0.75],
    [B.delta + 0.7, B.delta + 1.35],
    [B.delta + 1.3, Infinity],
  ];
  r.deltaFrames.forEach((frame, index) => {
    const [enter, exit] = slots[index]!;
    const before = frame.querySelector<HTMLElement>("[data-delta-before]");
    const after = frame.querySelector<HTMLElement>("[data-delta-after]");
    const caption = frame.querySelector<HTMLElement>("figcaption");
    tl.to(frame, { autoAlpha: 1, z: 0, scale: 1, duration: 0.3, ease: SETTLE }, enter);
    if (after) {
      tl.to(after, { clipPath: "inset(0 0% 0 0)", xPercent: 0, duration: 0.25, ease: SETTLE }, enter + 0.12);
    }
    if (before) {
      tl.to(before, { yPercent: -20, z: -260, opacity: 0.22, duration: 0.28 }, enter + 0.18);
    }
    if (caption) tl.to(caption, { opacity: 1, y: 0, duration: 0.22, ease: SETTLE }, enter + 0.2);
    if (Number.isFinite(exit)) {
      tl.to(frame, { z: 520, scale: 1.14, autoAlpha: 0, duration: 0.22 }, exit);
    }
  });

  /* ----------------------------------------------------- rail + history */
  const last = r.deltaFrames[r.deltaFrames.length - 1];
  const lastArrow = last?.querySelector<HTMLElement>("[data-delta-arrow]");
  const lastBefore = last?.querySelector<HTMLElement>("[data-delta-before]");
  const lastAfter = last?.querySelector<HTMLElement>("[data-delta-after]");
  const lastCaption = last?.querySelector<HTMLElement>("figcaption");
  tl.to(r.deltaCopy, { x: -60, z: 160, autoAlpha: 0, duration: 0.25 }, B.rail - 0.1);
  if (lastCaption) tl.to(lastCaption, { autoAlpha: 0, y: 14, duration: 0.2 }, B.rail);
  if (lastArrow) {
    tl.to(lastArrow, {
      scaleX: isMobile ? 10 : 20,
      scaleY: 0.18,
      xPercent: -40,
      duration: 0.45,
      ease: "power1.in",
    }, B.rail);
  }
  if (lastBefore) tl.to(lastBefore, { x: () => -vw(26), z: -320, opacity: 0.1, duration: 0.4 }, B.rail);
  if (lastAfter) tl.to(lastAfter, { x: () => vw(28), z: 200, autoAlpha: 0, duration: 0.4 }, B.rail);
  /* History matter rides in DURING the rail beat — the rail is never bare. */
  tl.to(r.seam, { y: () => vh(isMobile ? 60 : 64), rotation: 0, scaleY: 1, duration: 0.5 }, B.rail)
    .set(r.delta, { autoAlpha: 0 }, B.history)
    .set(r.history, { autoAlpha: 1 }, B.rail + 0.05);

  tl.to(r.historyPortrait, { opacity: 0.25, xPercent: 0, duration: 0.5, ease: SETTLE }, B.rail + 0.15)
    .to(r.historyCopy, { autoAlpha: 1, xPercent: 0, duration: 0.3, ease: SETTLE }, B.rail + 0.3)
    .to(r.historyNodes, {
      x: 0,
      autoAlpha: 1,
      stagger: 0.04,
      duration: 0.5,
      ease: SETTLE,
    }, B.rail + 0.1)
    .to(r.historyTimeline, {
      x: () => {
        const timeline = r.historyTimeline;
        if (!timeline) return 0;
        return Math.min(0, (window.innerWidth - timeline.scrollWidth) * a.timelinePan);
      },
      duration: 0.9,
    }, B.history + 0.2);

  /* -------------------------------------------------------------- compare */
  tl.to(r.historyNodes, { z: -260, opacity: 0.3, duration: 0.4 }, B.compare)
    .to(r.envNums.slice(0, 2), {
      scale: 1.35,
      xPercent: (i) => (i === 0 ? 4 : -2),
      z: (i) => (i === 0 ? -40 : -180),
      duration: 0.6,
    }, B.compare)
    .to(r.compare, { autoAlpha: 1, z: 0, rotateY: 0, duration: 0.5, ease: SETTLE }, B.compare + 0.2);

  /* ---------------------------------------------------------------- roles */
  tl.to(r.roleForks, { scaleX: 1, stagger: 0.06, duration: 0.35, ease: SETTLE }, B.roles)
    .to(r.rolePaths, {
      yPercent: 0,
      autoAlpha: 1,
      stagger: 0.07,
      duration: 0.5,
      ease: SETTLE,
    }, B.roles + 0.1)
    .to(r.seam, { scaleY: 0.5, duration: 0.5 }, B.roles)
    .to(r.compare, { z: 140, autoAlpha: 0, duration: 0.35 }, B.roles + 0.45)
    .to(r.historyCopy, { x: -60, z: 160, autoAlpha: 0, duration: 0.35 }, B.roles + 0.4)
    .to([r.historyTimeline, r.historyPortrait], { opacity: 0, z: -200, duration: 0.4 }, B.source - 0.4);

  /* --------------------------------------------------------------- source */
  tl.to(r.rolePaths, { yPercent: 40, z: 220, autoAlpha: 0, stagger: 0.04, duration: 0.3 }, B.source)
    .set(r.history, { autoAlpha: 0 }, B.source + 0.45)
    .set(r.source, { autoAlpha: 1 }, B.source - 0.05)
    .to(r.seam, {
      y: () => vh(isMobile ? 37 : 33.5),
      x: () => vw(isMobile ? 0 : 24),
      scaleX: isMobile ? 0.8 : 0.42,
      scaleY: 0.35,
      duration: 0.5,
    }, B.source + 0.05)
    .to(r.sourceGuides, { scaleX: 1, stagger: 0.07, duration: 0.4, ease: SETTLE }, B.source + 0.15)
    .to(r.sourceCopy, { autoAlpha: 1, y: 0, duration: 0.3, ease: SETTLE }, B.source - 0.15)
    .to(r.sourceCode, { clipPath: "inset(0 0% 0 0)", duration: 0.8, ease: SETTLE }, B.source + 0.35)
    .to(r.envNums, { scale: 0.62, xPercent: (i: number) => 12 - i * 4, z: -320, duration: 1.0 }, B.source + 0.2);

  /* --------------------------------------------------------------- return */
  tl.to(r.sourceCode, { clipPath: "inset(0 0 100% 0)", duration: 0.45, ease: "power1.in" }, B.return)
    .to(r.sourceGuides, { scaleX: 0.3, x: 60, opacity: 0.4, stagger: 0.04, duration: 0.4 }, B.return + 0.1)
    .to(r.sourceCopy, { x: -50, z: 150, autoAlpha: 0, duration: 0.25 }, B.return)
    .set(r.emblem, { autoAlpha: 1 }, B.return + 0.05)
    .to(r.emblem, { scale: a.emblemReturn, x: 0, y: 0, duration: 0.7, ease: "power1.inOut" }, B.return + 0.05)
    .to(r.emblemLayers[0]!, { xPercent: -1.2, yPercent: 1, z: -40, duration: 0.7 }, B.return + 0.05)
    .to(r.emblemLayers[1]!, { xPercent: -0.5, yPercent: 0.5, z: -20, duration: 0.7 }, B.return + 0.05)
    .to(r.seam, {
      y: () => vh(isMobile ? 30 : 34),
      x: () => vw(isMobile ? 6 : 18),
      rotation: isMobile ? -16 : -14,
      scaleX: 0.2,
      scaleY: 0.6,
      duration: 0.8,
    }, B.return + 0.3)
    .to(r.sourceClosing, { autoAlpha: 1, y: 0, duration: 0.3, ease: SETTLE }, B.return + 0.6);

  /* Rest beat: the final composition holds until the stage unsticks. */
  tl.to({ hold: 0 }, { hold: 1, duration: DURATION - B.rest }, B.rest);

  const labels: Record<string, number> = {};
  for (const [name, time] of Object.entries(B)) labels[name] = time / DURATION;
  window.__riftscryJourney = { labels };
}

function boot(): void {
  const world = document.querySelector<HTMLElement>("[data-home-world]");
  if (!world || world.dataset.motionInitialized === "true") return;
  world.dataset.motionInitialized = "true";
  personalizeSignalField(world);

  const media = gsap.matchMedia();

  media.add(DESKTOP, () => {
    world.classList.add("motion-ready");
    const context = gsap.context(() => buildJourney(world, DESKTOP_AMP), world);
    return () => {
      context.revert();
      world.classList.remove("motion-ready");
    };
  });

  media.add(MOBILE, () => {
    world.classList.add("motion-ready");
    const context = gsap.context(() => buildJourney(world, MOBILE_AMP), world);
    return () => {
      context.revert();
      world.classList.remove("motion-ready");
    };
  });

  const refresh = () => ScrollTrigger.refresh();
  if ("fonts" in document) void document.fonts.ready.then(refresh);
  window.addEventListener("load", refresh, { once: true });

  const onPageShow = (event: PageTransitionEvent) => {
    if (event.persisted) ScrollTrigger.refresh();
  };

  const teardown = () => {
    window.removeEventListener("load", refresh);
    window.removeEventListener("pageshow", onPageShow);
    window.removeEventListener("pagehide", onPageHide);
    media.revert();
    delete world.dataset.motionInitialized;
  };

  const onPageHide = (event: PageTransitionEvent) => {
    if (!event.persisted) teardown();
  };

  window.addEventListener("pageshow", onPageShow);
  window.addEventListener("pagehide", onPageHide);
}

boot();
