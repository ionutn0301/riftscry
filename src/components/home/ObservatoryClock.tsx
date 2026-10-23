import { useRef, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import { Html } from '@react-three/drei';
import type { Group } from 'three';
import type { WorldMaterials } from './world-materials';

export function ObservatoryClock({ materials: m, opening, active }: { materials: WorldMaterials; opening: number; active: boolean }) {
  const hands = useRef<Group>(null);
  const [utc, setUtc] = useState(false);
  useFrame(() => {
    if (!hands.current) return;
    const now = new Date();
    const seconds = utc ? now.getUTCSeconds() : now.getSeconds();
    const minutes = (utc ? now.getUTCMinutes() : now.getMinutes()) + seconds / 60;
    const hours = (utc ? now.getUTCHours() : now.getHours()) % 12 + minutes / 60;
    [hours / 12, minutes / 60, seconds / 60].forEach((turn, i) => {
      hands.current!.children[i]!.rotation.z = -turn * Math.PI * 2;
    });
  });
  return <group position={[0, 1.4, 1]} scale={Math.max(.001, 1 - opening)} visible={opening < .99}>
    {Array.from({ length: 60 }, (_, i) => <group key={i} rotation={[0, 0, -i * Math.PI / 30]}>
      <mesh position={[0, 2.9, 0]} material={i % 5 ? m.dark : m.metal}><boxGeometry args={[i % 5 ? .025 : .06, i % 5 ? .11 : .24, .04]} /></mesh>
    </group>)}
    {[12, 3, 6, 9].map((n, i) => <Html key={n} position={[Math.sin(i * Math.PI / 2) * 2.5, Math.cos(i * Math.PI / 2) * 2.5, .02]} center style={{ pointerEvents: 'none', color: '#253e38', fontFamily: 'Georgia, serif', fontSize: '20px' }}>{n}</Html>)}
    <group ref={hands}>
      {[1.4, 2.1, 2.55].map((length, i) => <group key={i}>
        <mesh position={[0, length / 2 - .2, .08 + i * .08]} material={i === 2 ? m.light : m.metal} castShadow><boxGeometry args={[i === 2 ? .035 : .1, length, .06]} /></mesh>
      </group>)}
    </group>
    <mesh material={m.metal} position={[0, 0, .4]}><sphereGeometry args={[.14, 16, 12]} /></mesh>
    {active && <Html position={[0, -1.5, .1]} center><button onPointerDown={e => e.stopPropagation()} onClick={e => { e.stopPropagation(); setUtc(v => !v); }} aria-label="Toggle watch between local time and UTC" style={{ cursor: 'pointer', background: '#ecede3', border: '1px solid #8e9479', borderRadius: '20px', padding: '8px 14px', color: '#253e38', whiteSpace: 'nowrap', fontSize: '11px' }}>{utc ? 'UTC' : 'LOCAL TIME'} · SWITCH</button></Html>}
  </group>;
}
