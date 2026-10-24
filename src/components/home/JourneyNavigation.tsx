import { chapters } from '../../lib/observatory';

export default function JourneyNavigation({ chapter, destination, onTravel, reduced, onToggleMotion }: { chapter: number; destination: number; onTravel: (index: number) => void; reduced: boolean; onToggleMotion: () => void }) {
  return <footer className="journey-navigation">
    <button className="journey-motion" aria-pressed={reduced} onClick={onToggleMotion}>{reduced ? 'Motion off' : 'Motion on'}</button>
    <nav aria-label="Journey chapters">{chapters.map((title, index) => <button key={title} aria-label={`Chapter ${index + 1}: ${title}`} aria-current={chapter === index ? 'step' : undefined} data-destination={destination === index} onClick={() => onTravel(index)}><span>{String(index + 1).padStart(2, '0')}</span><i aria-hidden="true" /></button>)}</nav>
    <button className="journey-next" onClick={() => onTravel(destination === 4 ? 0 : destination + 1)}>{destination === 4 ? 'Start again' : 'Continue'} <span aria-hidden="true">→</span></button>
  </footer>;
}
