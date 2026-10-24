import { useEffect, useMemo, useRef, useState } from 'react';
import { Html } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import type { WorldMaterials } from './world-materials';

type Props = {
  materials: WorldMaterials;
  title: string;
  subtitle: string;
  detail?: string;
  home: [number, number, number];
  focused: boolean;
  active: boolean;
  reduced?: boolean;
  onInspect: () => void;
  onClose: () => void;
};

export function RecordArtifact({ materials, title, subtitle, detail = 'SELECT TO INSPECT', home, focused, active, reduced, onInspect, onClose }: Props) {
  const group = useRef<THREE.Group>(null);
  const [hovered, setHovered] = useState(false);
  const [texture, setTexture] = useState<THREE.CanvasTexture>();
  const pose = useMemo(() => ({ point: new THREE.Vector3(), rotation: new THREE.Quaternion(), parent: new THREE.Quaternion() }), []);
  useEffect(() => {
    const canvas = document.createElement('canvas'); canvas.width = 768; canvas.height = 1024;
    const ctx = canvas.getContext('2d'); if (!ctx) return;
    ctx.fillStyle = '#eeeade'; ctx.fillRect(0, 0, 768, 1024);
    ctx.strokeStyle = '#8c815a'; ctx.lineWidth = 3; ctx.strokeRect(32, 32, 704, 960);
    ctx.strokeRect(46, 46, 676, 932);
    ctx.textAlign = 'center'; ctx.fillStyle = '#42563e'; ctx.font = '24px sans-serif';
    ctx.fillText('R I F T S C R Y  /  R E C O R D', 384, 120);
    ctx.fillStyle = '#25372d'; ctx.font = 'bold 68px Georgia'; ctx.fillText(title, 384, 340, 620);
    ctx.font = '32px sans-serif'; ctx.fillText(subtitle, 384, 430, 610);
    ctx.strokeStyle = '#8c815a'; ctx.beginPath(); ctx.moveTo(180, 500); ctx.lineTo(588, 500); ctx.stroke();
    ctx.font = '30px sans-serif';
    const words = detail.split(' '); let line = ''; let y = 590;
    words.forEach(word => { const next = `${line} ${word}`.trim(); if (ctx.measureText(next).width > 570 && line) { ctx.fillText(line, 384, y); y += 44; line = word; } else line = next; });
    ctx.fillText(line, 384, y);
    ctx.font = '25px sans-serif'; ctx.fillStyle = '#42563e'; ctx.fillText(focused ? 'RETURN TO COLLECTION  −' : 'INSPECT  +', 384, 900);
    const map = new THREE.CanvasTexture(canvas); map.colorSpace = THREE.SRGBColorSpace; setTexture(map);
    return () => map.dispose();
  }, [title, subtitle, detail, focused]);
  useFrame(({ camera, size }, dt) => {
    const node = group.current; if (!node?.parent) return;
    if (focused && active) {
      pose.point.set(0, .25, -6).applyQuaternion(camera.quaternion).add(camera.position);
      node.parent.worldToLocal(pose.point);
      node.parent.getWorldQuaternion(pose.parent);
      pose.rotation.copy(pose.parent).invert().multiply(camera.quaternion);
    } else { pose.point.set(...home); pose.rotation.identity(); }
    const blend = reduced ? 1 : 1 - Math.exp(-5 * Math.min(dt, .05));
    node.position.lerp(pose.point, blend); node.quaternion.slerp(pose.rotation, blend);
    const scale = focused && active ? Math.min(1.05, size.width / size.height * 1.65) : hovered && active ? .78 : .72;
    node.scale.setScalar(THREE.MathUtils.lerp(node.scale.x, scale, blend));
  });
  return <group ref={group} position={home} scale={.72} onPointerOver={active ? e => { e.stopPropagation(); setHovered(true); } : undefined} onPointerOut={() => setHovered(false)} onClick={active ? e => { e.stopPropagation(); focused ? onClose() : onInspect(); } : undefined}>
    <mesh material={hovered || focused ? materials.metal : materials.dark} castShadow><boxGeometry args={[2.35, 3.15, .24]} /></mesh>
    <mesh position={[0, 0, .126]}><planeGeometry args={[2.2, 3]} /><meshBasicMaterial key={texture?.uuid ?? 'loading'} map={texture} color={texture ? '#ffffff' : '#eeeade'} toneMapped={false} fog={false} /></mesh>
    {active && <Html center position={[0, -1.8, .15]} zIndexRange={[25, 20]}>
      <button className="artifact-keyboard" aria-label={focused ? 'Return artifact to its place' : `Inspect ${title}`} onClick={e => { e.stopPropagation(); focused ? onClose() : onInspect(); }}>{focused ? 'Return to collection · Esc' : `Inspect ${title}`}</button>
    </Html>}
  </group>;
}
