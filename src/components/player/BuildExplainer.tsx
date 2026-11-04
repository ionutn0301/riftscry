import { useId, useState } from 'react';
import type { ItemMetadata } from '../../lib/player/advice';
import type { Match } from '../../lib/player/contracts';
import { buildAlternatives, explainBuild } from '../../lib/player/build-learning';
import '../../styles/companion-learning.css';

export default function BuildExplainer({ match, puuid, metadata }: { match: Match; puuid: string; metadata?: ItemMetadata }) {
  const uid = useId();
  const [selected, setSelected] = useState<number>();
  const model = explainBuild(match, puuid, metadata);
  const item = model.items.find(item => item.id === selected) ?? model.items[0];
  return <details className="build-learning" data-build-learning>
    <summary><span>Understand this build<small>What each recorded item offers</small></span></summary>
    <div className="learning-body">
      <p className="learning-intro">Select an item to understand its listed stats, then decide what matters for your next matchup.</p>
      {!item ? <p>No final items were recorded.</p> : <>
        <div className="learning-items" role="group" aria-label="Choose an item to understand">
          {model.items.map(option => <button type="button" key={option.id} aria-pressed={option.id === item.id} aria-controls={`${uid}-item`} onClick={() => setSelected(option.id)}>{option.name}</button>)}
        </div>
        <section id={`${uid}-item`} className="learning-item" aria-labelledby={`${uid}-heading`}>
          <header><h3 id={`${uid}-heading`}>{item.name}</h3>{item.price !== null && <span>{item.price.toLocaleString()} gold<small>Total shop price</small></span>}</header>
          {item.summary && <p>{item.summary}</p>}
          {item.stats.length > 0 ? <dl className="learning-stats">{item.stats.map(stat => <div key={stat.key}><dt>{stat.label}<strong>+{stat.value}</strong></dt><dd>{stat.meaning}</dd></div>)}</dl> : <p>{item.known ? 'No supported base-stat explanation in this reference. Its description may include other effects.' : 'Item details are unavailable for this match and mode.'}</p>}
          {item.description && <details className="learning-reference"><summary>Read the patch item description</summary><p>{item.description}</p></details>}
        </section>
        <p className="sr-only" role="status">Showing {item.name}</p>
        <ItemComparison key={`${match.metadata.matchId}:${item.id}`} match={match} puuid={puuid} metadata={metadata} itemId={item.id} />
        {item.known && <aside className="learning-question"><strong>Before buying it again</strong><p>What job do you need this item to do? Check the enemy threats and your champion’s scaling, then weigh what you give up by delaying another item.</p></aside>}
      </>}
      <footer className="learning-source"><p>{model.notice} Final slots do not show purchase order, and shop price is not gold spent.</p>{model.source && <a href={model.source} target="_blank" rel="noreferrer">Riot item reference {model.version} ↗</a>}</footer>
    </div>
  </details>;
}

function ItemComparison({ match, puuid, metadata, itemId }: { match: Match; puuid: string; metadata?: ItemMetadata; itemId: number }) {
  const uid = useId();
  const [selected, setSelected] = useState(0);
  const model = buildAlternatives(match, puuid, metadata, itemId);
  if (!model) return null;
  const alternative = model.alternatives.find(item => item.id === selected);
  return <details className="learning-reference learning-comparison" data-item-comparison>
    <summary>Compare a tradeoff <small>· {model.label}</small></summary>
    <p>Explore a different item from this patch. These choices are not ranked or tailored to your opponent.</p>
    <label className="learning-label" htmlFor={`${uid}-choice`}>Compare {model.recordedName} with</label>
    <select id={`${uid}-choice`} value={alternative?.id ?? 0} onChange={event => setSelected(Number(event.target.value))}>
      <option value={0}>Choose an alternative</option>{model.alternatives.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}
    </select>
    {alternative && <div className="learning-comparison-result">
      <p role="status">Comparing with <strong>{alternative.name}</strong>{alternative.priceDifference !== null && <> · {alternative.priceDifference > 0 ? '+' : ''}{alternative.priceDifference.toLocaleString()} gold in total shop price</>}. This is not the cost of selling or replacing your item.</p>
      <div className="learning-table-wrap"><table><caption>Listed base stats · {model.recordedName} and {alternative.name}</caption><thead><tr><th scope="col">Stat</th><th scope="col">Recorded</th><th scope="col">Alternative</th></tr></thead><tbody>{alternative.stats.map(stat => <tr key={stat.key}><th scope="row">{stat.label}</th><td>{stat.before}</td><td>{stat.after}{stat.difference !== null && <small>Change: {stat.difference}</small>}</td></tr>)}</tbody></table></div>
      <p>“Not listed” means the structured reference did not supply that stat. It is not treated as zero. Effects and stat multipliers are not added to these numbers.</p>
      <h4>{alternative.name}: item description</h4><p>{alternative.description || 'No description available in this reference.'}</p>
      <aside className="learning-question"><strong>Think about the tradeoff</strong><p>{model.question}</p></aside>
    </div>}
  </details>;
}
