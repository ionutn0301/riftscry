import type { RiftCinemaChampion } from './rift-cinema-world';

/** Transparent foregrounds. Framing follows each painted pose, not a splash crop. */
export const championFigures: Record<string, {
  figure: string; primary: string; secondary: string; region: string;
  focus: NonNullable<RiftCinemaChampion['focus']>;
}> = {
  Urgot: { figure: '/images/rift-cinema/urgot-figure.webp', primary: '#b1d480', secondary: '#547343', region: 'ZAUN',
    focus: { x: .65, y: .62, scale: 1, mobileX: .48, mobileY: .60, mobileScale: .62 } },
  Riven: { figure: '/images/rift-cinema/riven-figure.webp', primary: '#a4dfbc', secondary: '#39765c', region: 'IONIA',
    focus: { x: .53, y: .50, scale: .90, mobileX: .26, mobileY: .49, mobileScale: .65 } },
  Malphite: { figure: '/images/rift-cinema/malphite-figure.webp', primary: '#d6c19a', secondary: '#786349', region: 'IXTAL',
    focus: { x: .55, y: .35, scale: 1, mobileX: .30, mobileY: .28, mobileScale: .65 } },
};
