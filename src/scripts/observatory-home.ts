import { initializeRiftField } from './rift-field';

const root = document.querySelector<HTMLElement>('[data-rift-cinema]');

if (root && root.dataset.cinemaReady !== 'true') {
  root.dataset.cinemaReady = 'true';
  initializeRiftField(root);

  const abort = new AbortController();
  const options = { signal: abort.signal };
  const chapters = [...root.querySelectorAll<HTMLElement>('[data-observatory-chapter]')];
  const chapterLinks = [...root.querySelectorAll<HTMLAnchorElement>('[data-cinema-link]')];
  const audioButtons = [...root.querySelectorAll<HTMLButtonElement>('[data-cinema-audio]')];
  let scrollFrame = 0;
  let audio: AudioContext | null = null;
  let master: GainNode | null = null;
  let audioOn = false;
  let audioBusy = false;
  const voices: OscillatorNode[] = [];

  function updateChapter() {
    scrollFrame = 0;
    if (!root) return;
    const threshold = Math.min(innerHeight * 0.45, 360);
    const current = chapters.filter(chapter => chapter.getBoundingClientRect().top <= threshold).at(-1) ?? chapters[0];
    const chapter = current?.dataset.observatoryChapter ?? 'threshold';
    root.dataset.cinemaChapter = chapter;
    chapterLinks.forEach(link => {
      if (link.dataset.cinemaLink === chapter) link.setAttribute('aria-current', 'location');
      else link.removeAttribute('aria-current');
    });
    const bounds = root.getBoundingClientRect();
    const progress = Math.min(1, Math.max(0, -bounds.top / Math.max(1, bounds.height - innerHeight)));
    root.style.setProperty('--cinema-progress', progress.toFixed(4));
  }

  function scheduleChapter() {
    if (!scrollFrame && !document.hidden) scrollFrame = requestAnimationFrame(updateChapter);
  }

  function updateAudioButtons(message?: string) {
    root!.dataset.audioState = audioOn ? 'on' : 'off';
    audioButtons.forEach(button => {
      button.setAttribute('aria-pressed', String(audioOn));
      button.setAttribute('aria-label', audioOn ? 'Sound on — mute ambient sound' : 'Sound off — enable ambient sound');
      const label = button.querySelector('[data-audio-label]');
      if (label) label.textContent = message ?? (audioOn ? 'Sound on' : 'Sound off');
    });
  }

  // An original, quiet three-tone bed. Audio is constructed only in response
  // to an explicit button activation, never on load or from a saved preference.
  async function toggleAudio() {
    if (audioBusy) return;
    audioBusy = true;
    try {
      if (!audio) {
        audio = new AudioContext();
        master = audio.createGain();
        master.gain.value = 0;
        master.connect(audio.destination);
        [55, 82.4069, 110.08].forEach((frequency, index) => {
          const oscillator = audio!.createOscillator();
          const gain = audio!.createGain();
          oscillator.type = 'sine';
          oscillator.frequency.value = frequency;
          gain.gain.value = index === 0 ? 0.38 : 0.16;
          oscillator.connect(gain);
          gain.connect(master!);
          oscillator.start();
          voices.push(oscillator);
        });
      }
      audioOn = !audioOn;
      if (audioOn) await audio.resume();
      master!.gain.cancelScheduledValues(audio.currentTime);
      master!.gain.setTargetAtTime(audioOn ? 0.055 : 0, audio.currentTime, 0.16);
      if (!audioOn) await audio.suspend();
      updateAudioButtons();
    } catch {
      audioOn = false;
      if (audio && audio.state !== 'closed') void audio.close().catch(() => {});
      audio = null;
      master = null;
      voices.length = 0;
      updateAudioButtons('Unavailable');
    } finally {
      audioBusy = false;
    }
  }

  if ('AudioContext' in window) audioButtons.forEach(button => {
    button.hidden = false;
    button.addEventListener('click', toggleAudio, options);
  });

  function selectArtwork(event: Event) {
    const detail = (event as CustomEvent<{championId?: string; name?: string; index?: number}>).detail;
    if (!detail || typeof detail.championId !== 'string') return;
    // Accept only IDs already serialized from trusted archive data.
    const figures = [...root!.querySelectorAll<HTMLElement>('[data-signal-art]')];
    const selected = figures.find(figure => figure.dataset.signalArt === detail.championId);
    if (!selected) return;
    figures.forEach(figure => { figure.hidden = figure !== selected; });
    root!.dataset.signalIndex = String(figures.indexOf(selected));
    const link = root!.querySelector<HTMLAnchorElement>('[data-signal-follow]');
    if (link) link.href = '/explore?champion=' + encodeURIComponent(detail.championId) + '#change';
    const name = root!.querySelector('[data-signal-name]');
    if (name) name.textContent = selected.querySelector('figcaption strong')?.textContent ?? '';
    const aperture = root!.querySelector<HTMLElement>('[data-signal-aperture]');
    if (aperture && document.documentElement.dataset.motion !== 'reduced') {
      aperture.getAnimations().forEach(animation => animation.cancel());
      aperture.animate([{ opacity: 0.65, filter: 'brightness(1.2)' }, { opacity: 1, filter: 'brightness(1)' }], { duration: 450, easing: 'ease-out' });
    }
    if (audioOn && audio?.state === 'running') {
      voices.forEach((voice, index) => {
        const base = [55, 82.4069, 110.08][index] ?? 55;
        voice.frequency.setTargetAtTime(base * (1 + figures.indexOf(selected) * 0.025), audio!.currentTime, 0.5);
      });
    }
  }

  root.querySelectorAll<HTMLImageElement>('.signal-art-image img').forEach(image => {
    const update = () => {
      const available = image.naturalWidth > 0;
      image.hidden = !available;
      const fallback = image.parentElement?.querySelector<HTMLElement>('.signal-art-fallback');
      if (fallback) fallback.hidden = available;
    };
    image.addEventListener('load', update, options);
    image.addEventListener('error', update, options);
    if (image.complete) update();
  });

  root.addEventListener('riftscry:signal-change', selectArtwork, options);
  window.addEventListener('scroll', scheduleChapter, { ...options, passive: true });
  window.addEventListener('resize', scheduleChapter, { ...options, passive: true });
  window.addEventListener('riftscry:motion-change', () => {
    if (document.documentElement.dataset.motion === 'reduced') root.querySelector<HTMLElement>('[data-signal-aperture]')?.getAnimations().forEach(animation => animation.cancel());
  }, options);
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      cancelAnimationFrame(scrollFrame);
      scrollFrame = 0;
      if (audio?.state === 'running') void audio.suspend().catch(() => {});
    } else {
      scheduleChapter();
      if (audioOn && audio?.state === 'suspended') void audio.resume().catch(() => { audioOn = false; updateAudioButtons(); });
    }
  }, options);
  window.addEventListener('pageshow', scheduleChapter, options);
  window.addEventListener('pagehide', event => {
    cancelAnimationFrame(scrollFrame);
    scrollFrame = 0;
    // A restored page is quiet until the user opts into sound again.
    audioOn = false;
    updateAudioButtons();
    if (audio?.state === 'running') void audio.suspend().catch(() => {});
    if (!event.persisted) {
      voices.forEach(voice => voice.stop());
      if (audio && audio.state !== 'closed') void audio.close().catch(() => {});
      abort.abort();
    }
  }, options);
  updateChapter();
  updateAudioButtons();
}
