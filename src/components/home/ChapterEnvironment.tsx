import { useRef, type ReactNode } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { RoundedBox } from '@react-three/drei';
import type { ObservatoryData } from '../../lib/observatory';

export function ChapterEntrance({ chapter, active, children }: { chapter: number; active: boolean; children: ReactNode }) {
  const root = useRef<THREE.Group>(null);
  const presence = useRef(active ? 1 : 0);
  useFrame((_, dt) => {
    if (!root.current) return;
    presence.current = THREE.MathUtils.damp(presence.current, active ? 1 : 0, 2.4, Math.min(dt, .05));
    const amount = presence.current;
    const remainder = 1 - amount;
    root.current.visible = amount > .003;
    root.current.position.set(chapter === 2 ? remainder * 2 : 0, chapter === 1 ? remainder * 2 : chapter === 3 ? -remainder * 2 : 0, -remainder * 5);
    root.current.rotation.set(0, (chapter % 2 ? -1 : 1) * remainder * .18, 0);
    root.current.traverse(object => {
      if (!(object instanceof THREE.Mesh)) return;
      const materials = Array.isArray(object.material) ? object.material : [object.material];
      materials.forEach(material => { material.transparent = true; material.opacity = amount; material.depthWrite = amount > .98; });
    });
  });
  return <group ref={root} visible={active} onClick={event => { if (!active) event.stopPropagation(); }} raycast={active ? undefined : () => null}>{children}</group>;
}

export function ChapterEnvironment({ chapter, data, archive, split }: { chapter: number; data: ObservatoryData; archive: (n: number) => void; split: number }) {
  const moving = useRef<THREE.Group>(null);
  useFrame(({ clock }) => {
    if (moving.current && chapter === 1) moving.current.rotation.y = clock.elapsedTime * .035;
  });
  return <group>
    {chapter === 0 && Array.from({ length: 7 }, (_, i) => <mesh key={i} position={[0, -.5, -4 - i * 2.5]} rotation={[0, 0, i * .09]}><torusGeometry args={[4.2 + i * .2, .12, 12, 80]} /><meshStandardMaterial color={i % 2 ? '#b5914d' : '#ddd8ca'} metalness={.45} roughness={.35} /></mesh>)}
    {chapter === 1 && <group ref={moving}>{Array.from({ length: 14 }, (_, i) => {
      const angle = i / 14 * Math.PI * 2;
      return <group key={i} position={[Math.cos(angle) * 9, -2 + Math.sin(i * 2) * 1.3, Math.sin(angle) * 9]}><mesh rotation={[.1, angle, .1]}><torusGeometry args={[1.1, .32, 24, 80]} /><meshStandardMaterial color="#bfcfc7" roughness={.75} /></mesh><mesh position={[0, 1.8, 0]}><cylinderGeometry args={[.08, .08, 1.4, 20]} /><meshStandardMaterial color="#9a7a40" metalness={.65} roughness={.3} /></mesh></group>;
    })}</group>}
    {chapter === 2 && [-1, 1].map(side => <group key={side} position={[side * (3 + split * 2), 0, -2]} rotation={[0, -side * .18, 0]}>{Array.from({ length: 9 }, (_, i) => <RoundedBox key={i} args={[1.25, 1.65, .5]} radius={.12} smoothness={4} position={[(i % 3 - 1) * 1.35, (Math.floor(i / 3) - 1) * 1.8, 0]}><meshPhysicalMaterial color={side < 0 ? '#c9c4b7' : '#80aaa4'} metalness={.4} roughness={.28} clearcoat={.4} /></RoundedBox>)}</group>)}
    {chapter === 3 && <group rotation={[0, -.35, 0]}>{data.patches.map((patch, i) => <group key={patch.id} position={[(i - (data.patches.length - 1) / 2) * 1.7, -1.4, -1 - Math.abs(i - 2) * .65]} onClick={e => { e.stopPropagation(); archive(i); }}><RoundedBox args={[1.2, 3 + i * .35, .65]} radius={.16} smoothness={4}><meshPhysicalMaterial color={i % 2 ? '#c4b28b' : '#b1c3bd'} roughness={.24} metalness={.5} clearcoat={.5} /></RoundedBox><mesh position={[0, 0, .34]}><boxGeometry args={[.035, 2.4, .025]} /><meshBasicMaterial color="#166e73" /></mesh></group>)}{[0, 1, 2].map(i => <mesh key={i} position={[0, -2.8 - i * .3, 0]}><cylinderGeometry args={[6 + i, 6 + i, .25, 64]} /><meshStandardMaterial color="#d9d4c8" /></mesh>)}</group>}
    {chapter === 4 && <group>{Array.from({ length: 12 }, (_, i) => <mesh key={i} position={[Math.sin(i * 2.4) * 13, -4, -5 - i * 2]} rotation={[0, i, 0]}><torusGeometry args={[3 + i % 3, .48, 24, 96, Math.PI]} /><meshStandardMaterial color={i % 2 ? '#a0b9ae' : '#c3cfc3'} roughness={.9} /></mesh>)}<mesh position={[0, 3, -23]}><sphereGeometry args={[4, 40, 40]} /><meshBasicMaterial color="#ead4a0" /></mesh><mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -3, 0]}><planeGeometry args={[8, 65]} /><meshStandardMaterial color="#a4c8c2" metalness={.55} roughness={.24} /></mesh></group>}
  </group>;
}
