import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import type { WorldMaterials } from './world-materials';

type M = { materials: WorldMaterials };
export const stations: [number, number, number][] = [[0, 0, 0], [0, 0, -28], [14, 2, -54], [14, -8, -82], [0, 4, -112]];

function Ring({ radius, width = .12, depth = .12, material }: { radius: number; width?: number; depth?: number; material: THREE.Material }) {
  const shape = useMemo(() => {
    const s = new THREE.Shape(); s.absarc(0, 0, radius, 0, Math.PI * 2, false);
    const hole = new THREE.Path(); hole.absarc(0, 0, radius - width, 0, Math.PI * 2, true); s.holes.push(hole); return s;
  }, [radius, width]);
  return <mesh material={material} castShadow receiveShadow><extrudeGeometry args={[shape, { depth, bevelEnabled: true, bevelSegments: 2, steps: 1, bevelSize: .025, bevelThickness: .025, curveSegments: 64 }]} /></mesh>;
}
function Pedestal({ materials: m }: M) {
  const points = useMemo(() => [[1.1, 0], [1.1, .12], [.98, .18], [.98, .28], [.78, .34], [.65, .7], [.65, .86], [.79, .9], [.79, 1], [.7, 1.04]].map(([x, y]) => new THREE.Vector2(x!, y!)), []);
  return <mesh material={m.stone} castShadow receiveShadow><latheGeometry args={[points, 48]} /></mesh>;
}
function Column({ materials: m, height = 7 }: M & { height?: number }) {
  return <group>
    <mesh position={[0, height / 2, 0]} material={m.stone} castShadow><cylinderGeometry args={[.32, .46, height, 24]} /></mesh>
    {[.2, .4, height - .2, height].map(y => <mesh key={y} position={[0, y, 0]} material={m.metal} castShadow><cylinderGeometry args={[.55, .55, .12, 32]} /></mesh>)}
    {Array.from({ length: 8 }, (_, i) => <mesh key={i} position={[Math.cos(i * Math.PI / 4) * .36, height / 2, Math.sin(i * Math.PI / 4) * .36]} material={m.dark}><cylinderGeometry args={[.035, .035, height - 1, 8]} /></mesh>)}
  </group>;
}
export function Signal({ materials: m }: M) {
  return <group>
    <mesh material={m.light}><octahedronGeometry args={[.28, 0]} /></mesh>
    <group rotation={[Math.PI / 2, .35, 0]}><Ring radius={.48} width={.035} depth={.025} material={m.metal} /></group>
    <pointLight color="#8affd8" intensity={8} distance={6} />
  </group>;
}
function Gateway({ materials: m, opening, active, onTravel }: M & { opening: number; active: boolean; onTravel: () => void }) {
  const iris = useRef<THREE.Group>(null);
  useFrame((_, dt) => { if (iris.current) iris.current.rotation.z = THREE.MathUtils.damp(iris.current.rotation.z, opening * .8, 3, dt); });
  return <group onClick={active ? e => { e.stopPropagation(); onTravel(); } : undefined}>
    <group position={[0, 1.4, 0]}>
      <Ring radius={3.8} width={.48} depth={.65} material={m.stone} />
      {[3.16, 3.29, 3.39, 3.87].map(radius => <group key={radius} position={[0, 0, .72]}><Ring radius={radius} width={.045} depth={.03} material={m.metal} /></group>)}
      <group ref={iris}>{Array.from({ length: 24 }, (_, i) => <group key={i} rotation={[0, 0, i * Math.PI / 12]}><mesh position={[0, 3.54, .76]} material={i % 3 ? m.metal : m.light}><boxGeometry args={[.04, i % 3 ? .14 : .28, .04]} /></mesh></group>)}</group>
      {Array.from({ length: 12 }, (_, i) => <group key={i} rotation={[0, 0, i * Math.PI / 6]}><mesh position={[0, 3.75, .1]} material={m.dark} castShadow><boxGeometry args={[.12, .6, .9]} /></mesh></group>)}
      <group position={[0, 0, .7]} scale={Math.max(.05, 1 - opening)}><Signal materials={m} /></group>
    </group>
    {[-1, 1].map(side => <group key={side} position={[side * 5.4, -3, -1]}><Column materials={m} height={9} /></group>)}
    {Array.from({ length: 6 }, (_, i) => <mesh key={i} position={[0, -2.8 - i * .18, 1.2 + i * .6]} material={m.stone} receiveShadow><boxGeometry args={[9 + i * .5, .25, .65]} /></mesh>)}
  </group>;
}
function Reliquary({ materials: m, selected, onSelect }: M & { selected: boolean; onSelect?: () => void }) {
  const frame = useRef<THREE.Group>(null);
  useFrame((_, dt) => { if (frame.current) frame.current.rotation.y = THREE.MathUtils.damp(frame.current.rotation.y, selected ? .55 : -.25, 3, dt); });
  return <group onClick={onSelect ? e => { e.stopPropagation(); onSelect(); } : undefined}>
    <Pedestal materials={m} />
    <group position={[0, 2.2, 0]} ref={frame}>
      <Ring radius={1} width={.1} depth={.12} material={m.metal} />
      <group rotation={[0, Math.PI / 2, 0]}><Ring radius={.9} width={.06} depth={.06} material={m.dark} /></group>
      <group rotation={[.4, .2, .4]}><mesh material={selected ? m.light : m.dark} castShadow><octahedronGeometry args={[.55, 0]} /></mesh></group>
      {[-1, 1].map(s => <mesh key={s} position={[s * .7, 0, 0]} material={m.metal}><boxGeometry args={[.45, .045, .045]} /></mesh>)}
    </group>
  </group>;
}
export function ChapterEnvironment({ stage, materials: m, position, selected, count, active, onSelect, onTravel, split, patch, patchCount, onPatch }: M & { stage: number; position: number; selected: number; count: number; active: boolean; onSelect: (n: number) => void; onTravel: () => void; split: number; patch: number; patchCount: number; onPatch: (n: number) => void }) {
  const visible = Math.abs(position - stage) < 1.65;
  return <group position={stations[stage]} visible={visible}>
    <mesh position={[0, -3.2, -4]} material={m.stone} receiveShadow><boxGeometry args={[22, .5, 28]} /></mesh>
    {[-3.5, 3.5].map(x => <mesh key={x} position={[x, -2.94, -4]} material={m.metal}><boxGeometry args={[.035, .018, 28]} /></mesh>)}
    {stage === 0 && <Gateway materials={m} opening={Math.min(1, position * 3)} active={active} onTravel={onTravel} />}
    {stage === 1 && <>
      {Array.from({ length: count }, (_, i) => { const a = (i / Math.max(1, count - 1) - .5) * Math.PI * 1.15; return <group key={i} position={[Math.sin(a) * 5, -2.95, -Math.cos(a) * 4]}><Reliquary materials={m} selected={selected === i} onSelect={active ? () => onSelect(i) : undefined} /></group>; })}
      {[-8, 8].map(x => [-7, 2].map(z => <group key={`${x}-${z}`} position={[x, -3, z]}><Column materials={m} height={11} /></group>))}
      <group rotation={[Math.PI / 2, 0, 0]} position={[0, -2.92, -2]}><Ring radius={6.8} width={.07} material={m.metal} /></group>
    </>}
    {stage === 2 && <group position={[0, 1, 0]}>
      {[-1, 1].map(side => <group key={side} position={[side * (.6 + split * 2), 0, side * .65]} rotation={[0, side * split * .4, 0]}>
        <Ring radius={2.5} width={.32} depth={.4} material={m.stone} />
        <group position={[0, 0, .5]}><Ring radius={2.58} width={.06} material={m.metal} /></group>
        <group rotation={[Math.PI / 2, 0, 0]}><Ring radius={2.1} width={.07} material={m.metal} /></group>
        {Array.from({ length: 16 }, (_, i) => <group key={i} rotation={[0, 0, i * Math.PI / 8]}><mesh position={[0, 2.3, .5]} material={m.dark}><boxGeometry args={[.06, .2, .12]} /></mesh></group>)}
      </group>)}
      <Signal materials={m} />
    </group>}
    {stage === 3 && <>
      {Array.from({ length: 5 }, (_, i) => <group key={i} position={[0, 3, -i * 4]}><Ring radius={6} width={.3} depth={.35} material={m.stone} /><group position={[0, 0, .4]}><Ring radius={5.65} width={.035} material={m.metal} /></group></group>)}
      {Array.from({ length: patchCount }, (_, i) => <group key={i} position={[(i % 2 ? 1 : -1) * 4.8, -2.9, -Math.floor(i / 2) * 3]} rotation={[0, (i % 2 ? -1 : 1) * .7 + (patch === i ? .35 : 0), 0]} onClick={active ? e => { e.stopPropagation(); onPatch(i); } : undefined}>
        <Pedestal materials={m} /><mesh position={[0, 2, 0]} material={patch === i ? m.metal : m.dark} castShadow><boxGeometry args={[1.1, 1.8, .2]} /></mesh>
        {Array.from({ length: 5 }, (_, j) => <mesh key={j} position={[0, 1.4 + j * .25, .12]} material={patch === i ? m.light : m.metal}><boxGeometry args={[.72, .025, .025]} /></mesh>)}
      </group>)}
    </>}
    {stage === 4 && <>
      {Array.from({ length: 14 }, (_, i) => <group key={i} position={[Math.sin(i * .45) * 13, -3, -7 - Math.cos(i * .45) * 11]}><Column materials={m} height={5 + (i % 3) * 2} /></group>)}
      <group position={[0, -2.9, 0]} scale={2}><Pedestal materials={m} /></group>
      <group position={[0, 0, 0]} rotation={[-Math.PI / 2, 0, 0]}><Ring radius={3} width={.14} material={m.metal} /><Ring radius={2.7} width={.05} material={m.dark} /></group>
      <group position={[0, 1.5, 0]}><Signal materials={m} /></group>
    </>}
  </group>;
}
