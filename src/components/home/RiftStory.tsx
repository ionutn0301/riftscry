import { useState } from 'react';
import ChampionEncounter from './ChampionEncounter';
import ChangeReveal from './ChangeReveal';
import PoolDestination from './PoolDestination';
import { storyChampions } from './story-data';
import './rift-story.css';
export default function RiftStory() {
  const [selectedId,setSelectedId] = useState('Azir');
  const selected = storyChampions.find(c=>c.id===selectedId)!;
  return <div className="rift-story">
    <header className="story-header"><a href="/" className="story-brand" aria-label="RiftScry home">RIFT<span>SCRY</span><i aria-hidden="true">✳</i></a><nav aria-label="Main navigation"><a href="/champions">Champions</a><a href="/patches">Patches</a><a href="/compare">Compare</a><a href="/pool">My Pool ↗</a></nav></header>
    <section className="battlefield" id="battlefield" aria-labelledby="story-heading">
      <picture className="battlefield-art"><source media="(max-width: 600px)" srcSet="/images/story/battlefield-mobile.webp"/><img src="/images/story/battlefield.webp" width="1920" height="1080" fetchPriority="high" alt="An original fantasy battlefield: ancient stone ramparts, a forest valley and distant mountains" /></picture>
      <div className="battlefield-foreground" aria-hidden="true" />
      <div className="battlefield-copy"><p className="eyebrow">A LEAGUE OF LEGENDS COMPANION</p><h1 id="story-heading">The Rift changes.<br/><em>Know your next move.</em></h1><p>Understand what changed for your champions.<br/>Take that knowledge into your next game.</p><a href="#champions" className="story-button">See the changes <span aria-hidden="true">↘</span></a></div>
      <div className="battlefield-bottom"><a href="#champions">↓ <span>Scroll to explore</span></a><span>THE WORLD MOVES. SO DO YOU.</span></div>
      <div className="forest-edge" aria-hidden="true" />
    </section>
    <ChampionEncounter champions={storyChampions} selected={selected} onSelect={setSelectedId}/>
    <ChangeReveal champion={selected}/>
    <PoolDestination champion={selected}/>
    <footer className="story-footer"><div><a className="story-brand" href="/">RIFT<span>SCRY</span></a><nav aria-label="Story chapters"><a href="#battlefield">Battlefield</a><a href="#champions">Champions</a><a href="#changes">Changes</a><a href="#my-pool">My Pool</a></nav></div><p>RiftScry isn&apos;t endorsed by Riot Games and doesn&apos;t reflect the views or opinions of Riot Games or anyone officially involved in producing or managing Riot Games properties. Riot Games, and all associated properties are trademarks or registered trademarks of Riot Games, Inc.</p><p>RiftScry was created under Riot Games&apos; “Legal Jibber Jabber” policy using assets owned by Riot Games. Riot Games does not endorse or sponsor this project. Environment artwork is original, not an official game location.</p></footer>
  </div>;
}
