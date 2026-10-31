const versions=new WeakMap<HTMLImageElement,number>();
let sequence=0;

/** Decode offscreen before replacing a displayed asset. Never blank the current frame. */
export function decodeArtwork(src:string):Promise<HTMLImageElement>{
  return new Promise((resolve,reject)=>{
    const probe=new Image();probe.decoding='async';
    const failed=()=>reject(new Error('Artwork unavailable'));
    probe.onerror=failed;
    probe.onload=()=>{
      const decoded=typeof probe.decode==='function'?probe.decode():Promise.resolve();
      void decoded.then(()=>{if(probe.naturalWidth>0)resolve(probe);else failed();},failed);
    };
    probe.src=src;
  });
}

export async function swapArtwork(image:HTMLImageElement,options:{src:string;alt:string;fallback?:HTMLElement|null;portrait?:{source:HTMLSourceElement;src:string}},signal?:AbortSignal){
  const version=++sequence;versions.set(image,version);
  const portrait=options.portrait;
  const effective=portrait&&matchMedia(portrait.source.media||'all').matches?portrait.src:options.src;
  if(image.getAttribute('src')===options.src&&(!portrait||portrait.source.srcset===portrait.src)&&image.complete&&image.naturalWidth>0){
    image.alt=options.alt;image.hidden=false;image.dataset.artworkState='ready';
    if(options.fallback)options.fallback.hidden=true;
    return true;
  }
  image.dataset.artworkState='loading';
  try{
    await decodeArtwork(effective);
    if(signal?.aborted||versions.get(image)!==version)return false;
    if(portrait)portrait.source.srcset=portrait.src;
    image.src=options.src;image.alt=options.alt;image.hidden=false;
    if(options.fallback)options.fallback.hidden=true;
    image.dataset.artworkState='ready';
    return true;
  }catch{
    if(signal?.aborted||versions.get(image)!==version)return false;
    image.hidden=true;image.alt=options.alt;
    if(options.fallback)options.fallback.hidden=false;
    image.dataset.artworkState='failed';
    return false;
  }
}
