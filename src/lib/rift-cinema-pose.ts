/** The first HTML frame and the enhanced world share these authored coordinates. */
export const CINEMA_MOBILE_MAX_WIDTH = 700;
export const CINEMA_ENVIRONMENT_ZOOM = 1.035;
export const CINEMA_RENDERER_FADE_MS = 400;

export type CinemaFocus = { x?: number; y?: number; scale?: number };
export type CinemaPose = { x: number; y: number; scale: number };
const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, Number.isFinite(value) ? value : min));

export function cinemaFocusFor(champion: string): CinemaPose {
  return { x: .71, y: .46, scale: champion === 'Yasuo' ? 1.17 : 1.13 };
}

export function cinemaEnvironmentZoom(scene = 0): number {
  return CINEMA_ENVIRONMENT_ZOOM + scene * .10;
}

/** Coordinates use the document's top-left origin, before deliberate pointer input. */
export function cinemaForegroundPose(focus: CinemaFocus | undefined, width: number, scene = 0): CinemaPose {
  const mobile = width <= CINEMA_MOBILE_MAX_WIDTH;
  const evidence = clamp(scene - 1, 0, 1);
  const arrivalX = mobile ? .56 : clamp(focus?.x ?? .70, 0, 1);
  return {
    x: arrivalX + ((mobile ? .40 : .35) - arrivalX) * evidence,
    y: clamp(focus?.y ?? .46, 0, 1),
    scale: clamp(focus?.scale ?? 1.15, .4, 1.8) * (mobile ? .83 : 1) * (1 + scene * .11),
  };
}

export function cinemaPosterProperties(focus: CinemaFocus): Record<string, string> {
  const desktop = cinemaForegroundPose(focus, CINEMA_MOBILE_MAX_WIDTH + 1);
  const mobile = cinemaForegroundPose(focus, CINEMA_MOBILE_MAX_WIDTH);
  const desktopInspect = cinemaForegroundPose(focus, CINEMA_MOBILE_MAX_WIDTH + 1, 2);
  const mobileInspect = cinemaForegroundPose(focus, CINEMA_MOBILE_MAX_WIDTH, 2);
  const percent = (value: number) => `${Number((value * 100).toFixed(5))}%`;
  return {
    '--cinema-poster-x': percent(desktop.x),
    '--cinema-poster-y': percent(desktop.y),
    '--cinema-poster-height': percent(desktop.scale),
    '--cinema-poster-mobile-x': percent(mobile.x),
    '--cinema-poster-mobile-y': percent(mobile.y),
    '--cinema-poster-mobile-height': percent(mobile.scale),
    '--cinema-poster-inspect-x': percent(desktopInspect.x),
    '--cinema-poster-inspect-y': percent(desktopInspect.y),
    '--cinema-poster-inspect-height': percent(desktopInspect.scale),
    '--cinema-poster-inspect-mobile-x': percent(mobileInspect.x),
    '--cinema-poster-inspect-mobile-y': percent(mobileInspect.y),
    '--cinema-poster-inspect-mobile-height': percent(mobileInspect.scale),
    '--cinema-world-inspect-zoom': String(cinemaEnvironmentZoom(2)),
  };
}
