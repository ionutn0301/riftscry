/** Only authored Astro titles are split; React-owned headings keep their DOM. */
export function prepareKineticTitle(heading:HTMLElement){
  if(heading.hasAttribute('data-kinetic-title'))return;
  const label=heading.getAttribute('aria-label')||heading.textContent?.replace(/\s+/g,' ').trim()||'';
  const walker=document.createTreeWalker(heading,NodeFilter.SHOW_TEXT),nodes:Text[]=[];
  while(walker.nextNode())nodes.push(walker.currentNode as Text);
  let index=0;
  for(const node of nodes){
    const fragment=document.createDocumentFragment();
    for(const part of (node.textContent||'').split(/(\s+)/)){
      if(!part.trim()){fragment.append(document.createTextNode(part));continue;}
      const mask=document.createElement('span'),word=document.createElement('span');
      mask.className='kinetic-word-mask';mask.setAttribute('aria-hidden','true');word.className='kinetic-word';word.textContent=part;
      word.style.setProperty('--word-delay',`${Math.min(index++,6)*28}ms`);mask.append(word);fragment.append(mask);
    }
    node.replaceWith(fragment);
  }
  heading.setAttribute('aria-label',label);heading.setAttribute('data-kinetic-title','');
}
export function setKineticTitle(heading:HTMLElement,value:string){
  heading.textContent=value;heading.removeAttribute('data-kinetic-title');heading.setAttribute('aria-label',value);prepareKineticTitle(heading);
}
