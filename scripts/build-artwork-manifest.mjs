import fs from 'node:fs/promises';
const meta=JSON.parse(await fs.readFile(new URL('../src/data/champions.json',import.meta.url),'utf8'));
const url=`https://ddragon.leagueoflegends.com/cdn/${meta.assetVersion}/data/en_US/champion.json`;
const response=await fetch(url,{signal:AbortSignal.timeout(20000)});if(!response.ok)throw Error(`Metadata ${response.status}`);
const official=await response.json();
const entries=Object.entries(meta.champions).map(([id,identity])=>{const source=official.data[id];return {id,...identity,status:source?'official-metadata-resolved':'missing-official-metadata',assetVersion:meta.assetVersion,metadataSource:url,sourceId:source?.id??null,icon:source?`https://ddragon.leagueoflegends.com/cdn/${meta.assetVersion}/img/champion/${source.image.full}`:null,splash:source?`https://ddragon.leagueoflegends.com/cdn/img/champion/splash/${source.id}_0.jpg`:null,portrait:source?`https://ddragon.leagueoflegends.com/cdn/img/champion/loading/${source.id}_0.jpg`:null,skinNumber:0,framing:'contain; complete illustration; no cutout',fallback:'Artwork unavailable; preserve identity, records and full story',rights:'Riot static assets; conditional policy compliance, registration not verified'};});
await fs.writeFile(new URL('../src/data/artwork-manifest.json',import.meta.url),JSON.stringify({generatedAt:new Date().toISOString(),count:entries.length,entries},null,2)+'\n');
console.log(JSON.stringify({count:entries.length,missing:entries.filter(e=>!e.sourceId).map(e=>e.id)}));
