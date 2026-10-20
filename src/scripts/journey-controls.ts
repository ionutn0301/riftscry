const world = document.querySelector<HTMLElement>("[data-home-world]");
const track = world?.querySelector<HTMLElement>("[data-journey-track]");
const buttons = [...document.querySelectorAll<HTMLButtonElement>("[data-chapter]")];
const progress = document.querySelector<HTMLElement>("[data-journey-progress]");
const chapterName = document.querySelector<HTMLElement>("[data-chapter-name]");
const chapterIndex = document.querySelector<HTMLElement>("[data-chapter-index]");
const soundButton = document.querySelector<HTMLButtonElement>("[data-sound-toggle]");
let frame = 0;
let active = -1;
let audio: AudioContext | undefined;
let soundEnabled = false;

function positionFor(beat: string): number | undefined {
  const label = window.__riftscryJourney?.labels[beat];
  if (!track || label === undefined) return;
  const top = track.getBoundingClientRect().top + window.scrollY;
  return top + (track.offsetHeight - window.innerHeight) * label;
}

function travel(beat: string): void {
  const position = positionFor(beat);
  if (position === undefined) return;
  window.scrollTo({ top: position, behavior: "smooth" });
}

function update(): void {
  frame = 0;
  if (!track) return;
  const range = track.offsetHeight - window.innerHeight;
  const fraction = Math.max(0, Math.min(1, -track.getBoundingClientRect().top / Math.max(1, range)));
  if (progress) progress.style.transform = `scaleX(${fraction})`;
  let next = 0;
  buttons.forEach((button, index) => {
    const label = window.__riftscryJourney?.labels[button.dataset.chapter ?? ""];
    if (label !== undefined && fraction >= label - 0.003) next = index;
  });
  if (next === active) return;
  active = next;
  buttons.forEach((button, index) => {
    if (index === active) button.setAttribute("aria-current", "step");
    else button.removeAttribute("aria-current");
  });
  if (chapterName) chapterName.textContent = buttons[active]?.dataset.chapterLabel ?? "";
  if (chapterIndex) chapterIndex.textContent = `0${active + 1} / 05`;
}

function requestUpdate(): void {
  if (!frame) frame = requestAnimationFrame(update);
}

buttons.forEach((button) => button.addEventListener("click", () => travel(button.dataset.chapter ?? "opening")));
document.querySelector<HTMLAnchorElement>("[data-enter-journey]")?.addEventListener("click", (event) => {
  if (!world?.classList.contains("motion-ready")) return;
  event.preventDefault();
  travel("signal");
});

function renderSound(): void {
  soundButton?.setAttribute("aria-pressed", String(soundEnabled));
  soundButton?.setAttribute("aria-label", soundEnabled ? "Mute ambient sound" : "Enable ambient sound");
  const label = soundButton?.querySelector("[data-sound-label]");
  if (label) label.textContent = soundEnabled ? "Sound on" : "Sound off";
}

soundButton?.addEventListener("click", async () => {
  try {
    if (!audio) {
      audio = new AudioContext();
      const master = audio.createGain();
      master.gain.value = 0.035;
      master.connect(audio.destination);
      [55, 82.41, 110.16].forEach((frequency) => {
        const oscillator = audio!.createOscillator();
        oscillator.type = "sine";
        oscillator.frequency.value = frequency;
        oscillator.connect(master);
        oscillator.start();
      });
    }
    if (soundEnabled) await audio.suspend();
    else await audio.resume();
    soundEnabled = audio.state === "running";
    renderSound();
  } catch {
    soundEnabled = false;
    renderSound();
    const label = soundButton.querySelector("[data-sound-label]");
    if (label) label.textContent = "Sound unavailable";
  }
});

document.addEventListener("visibilitychange", () => {
  if (document.hidden) void audio?.suspend();
  else if (soundEnabled) void audio?.resume();
});
window.addEventListener("pagehide", () => { void audio?.suspend(); });
window.addEventListener("pageshow", () => {
  if (soundEnabled) void audio?.resume();
  requestUpdate();
});
window.addEventListener("scroll", requestUpdate, { passive: true });
window.addEventListener("resize", requestUpdate, { passive: true });
update();

const pointerMotion = matchMedia("(prefers-reduced-motion: no-preference) and (pointer: fine)");
let lookFrame = 0;
let targetX = 0;
let targetY = 0;
let lookX = 0;
let lookY = 0;

function animateLook(): void {
  lookX += (targetX - lookX) * 0.1;
  lookY += (targetY - lookY) * 0.1;
  world?.style.setProperty("--look-x", lookX.toFixed(4));
  world?.style.setProperty("--look-y", lookY.toFixed(4));
  lookFrame = Math.abs(targetX - lookX) + Math.abs(targetY - lookY) > 0.001
    ? requestAnimationFrame(animateLook) : 0;
}

function resetLook(): void {
  cancelAnimationFrame(lookFrame);
  lookFrame = 0;
  lookX = lookY = targetX = targetY = 0;
  world?.style.removeProperty("--look-x");
  world?.style.removeProperty("--look-y");
}

world?.addEventListener("pointermove", (event) => {
  if (!pointerMotion.matches || !world.classList.contains("motion-ready")) return;
  targetX = Math.max(-1, Math.min(1, event.clientX / innerWidth * 2 - 1));
  targetY = Math.max(-1, Math.min(1, event.clientY / innerHeight * 2 - 1));
  if (!lookFrame) lookFrame = requestAnimationFrame(animateLook);
}, { passive: true });
world?.addEventListener("pointerleave", () => {
  targetX = targetY = 0;
  if (pointerMotion.matches && !lookFrame) lookFrame = requestAnimationFrame(animateLook);
});
pointerMotion.addEventListener("change", resetLook);
window.addEventListener("pagehide", resetLook);
document.addEventListener("visibilitychange", () => { if (document.hidden) resetLook(); });
