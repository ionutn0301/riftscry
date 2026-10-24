import { useEffect, useState } from 'react';
import * as THREE from 'three';

export function ChampionMedallion({ champion, assetVersion, selected }: { champion: { id: string; name: string }; assetVersion?: string; selected: boolean }) {
  const [portrait, setPortrait] = useState<THREE.CanvasTexture>();
  const [label, setLabel] = useState<THREE.CanvasTexture>();
  useEffect(() => {
    const canvas = document.createElement('canvas'); canvas.width = canvas.height = 256;
    const context = canvas.getContext('2d'); if (!context) return;
    context.fillStyle = '#25372d'; context.fillRect(0, 0, 256, 256);
    context.fillStyle = '#eeeade'; context.font = 'bold 80px Georgia'; context.textAlign = 'center'; context.fillText(champion.name.slice(0, 1), 128, 155);
    const texture = new THREE.CanvasTexture(canvas); texture.colorSpace = THREE.SRGBColorSpace; setPortrait(texture);
    let disposed = false;
    const image = new Image(); image.crossOrigin = 'anonymous';
    image.onload = () => { if (!disposed) { context.drawImage(image, 0, 0, 256, 256); texture.needsUpdate = true; } };
    if (assetVersion) image.src = `https://ddragon.leagueoflegends.com/cdn/${assetVersion}/img/champion/${champion.id}.png`;
    return () => { disposed = true; image.onload = null; texture.dispose(); };
  }, [champion.id, champion.name, assetVersion]);
  useEffect(() => {
    const canvas = document.createElement('canvas'); canvas.width = 768; canvas.height = 192;
    const context = canvas.getContext('2d'); if (!context) return;
    context.fillStyle = selected ? '#25372d' : '#eeeade'; context.fillRect(0, 0, 768, 192);
    context.strokeStyle = '#8c815a'; context.lineWidth = 4; context.strokeRect(8, 8, 752, 176);
    context.textAlign = 'center'; context.fillStyle = selected ? '#f6f5ef' : '#25372d';
    context.font = 'bold 52px Georgia'; context.fillText(champion.name, 384, 82, 700);
    context.font = '24px sans-serif'; context.fillText(selected ? 'SELECTED · CHAMPION RECORD' : 'SELECT TO REVEAL', 384, 142);
    const texture = new THREE.CanvasTexture(canvas); texture.colorSpace = THREE.SRGBColorSpace; setLabel(texture);
    return () => texture.dispose();
  }, [champion.name, selected]);
  return <>
    <mesh position={[0, 0, .19]}><circleGeometry args={[.78, 48]} /><meshBasicMaterial key={portrait?.uuid} map={portrait} color={portrait ? '#ffffff' : '#25372d'} toneMapped={false} fog={false} /></mesh>
    <mesh position={[0, -1.2, .2]}><boxGeometry args={[2.05, .55, .1]} /><meshStandardMaterial color="#8c815a" metalness={.65} roughness={.35} /></mesh>
    <mesh position={[0, -1.2, .255]}><planeGeometry args={[1.98, .49]} /><meshBasicMaterial key={label?.uuid} map={label} toneMapped={false} fog={false} /></mesh>
  </>;
}
