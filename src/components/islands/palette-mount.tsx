import { createRoot } from 'react-dom/client';
import CommandPalette from './CommandPalette';

export function mountPalette(host: HTMLElement, trigger: HTMLElement | undefined, ready: () => void) {
  createRoot(host).render(<CommandPalette initialTrigger={trigger} onReady={ready} />);
}
