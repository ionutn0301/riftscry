import { useMemo, useRef, useState } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { ContactShadows, Environment, Lightformer, PerformanceMonitor } from '@react-three/drei';
import * as THREE from 'three';
import type { ObservatoryData } from '../../lib/observatory';

type Props = { progress: number; split: number; data: ObservatoryData; select: (n: number) => void; inspect: () => void; archive: (n: number) => void };
function Director({ progress }: { progress: number }) {
  const path = useMemo(() => new THREE.CatmullRomCurve3([
    new THREE.Vector3(0, 2, 12), new THREE.Vector3(7, 3, 9), new THREE.Vector3(2, 1.4, 7), new THREE.Vector3(-7, 5, 8), new THREE.Vector3(0, 3.2, 13)
  ]), []);
  const travel = useRef(0);
  const target = useRef(new THREE.Vector3());
  useFrame(({ camera, pointer, size }, dt) => {
    travel.current = THREE.MathUtils.damp(travel.current, progress / 4, 2, Math.min(dt, .05));
    const p = path.getPoint(THREE.MathUtils.clamp(travel.current, 0, 1));
    const mobile = size.width < 760;
    const distance = mobile ? 1.5 : 1;
    camera.position.set(p.x * distance + (mobile ? 0 : pointer.x * .15), p.y * distance, p.z * distance);
    target.current.set(mobile ? 0 : -1.7, mobile ? -.65 : .1, 0);
    camera.lookAt(target.current);
  });
  return null;
}
function Sculpture({ split, inspect }: { split: number; inspect: () => void }) {
  const group = useRef<THREE.Group>(null);
  const [hover, setHover] = useState(false);
  useFrame((_, dt) => {
    if (!group.current) return;
    group.current.rotation.y = THREE.MathUtils.damp(group.current.rotation.y, hover ? .35 : -.2, 2, dt);
  });
  return <group ref={group} rotation={[.13, -.2, -.16]} onPointerOver={e => { e.stopPropagation(); setHover(true); }} onPointerOut={() => setHover(false)} onClick={e => { e.stopPropagation(); inspect(); }}>
    {[0, 1].map(i => <mesh key={i} position={[(i ? 1 : -1) * split * .65, 0, 0]} rotation={[0, 0, i * Math.PI + .08]} castShadow>
      <torusGeometry args={[2.05, .69, 48, 110, Math.PI - .16]} />
      <meshPhysicalMaterial color="#e5e1d5" roughness={.32} metalness={.08} clearcoat={.25} />
    </mesh>)}
    <mesh rotation={[.4, -.5, -.5]} castShadow><torusGeometry args={[2.05, .075, 20, 160]} /><meshStandardMaterial color="#b5914d" metalness={.92} roughness={.23} /></mesh>
    <mesh rotation={[.2, .3, .4]} castShadow><octahedronGeometry args={[.8, 0]} /><meshPhysicalMaterial color={hover ? '#dfbd70' : '#b39758'} metalness={.9} roughness={.18} clearcoat={1} /></mesh>
  </group>;
}
function World({ progress, split, data, select, inspect, archive }: Props) {
  return <>
    <color attach="background" args={['#e9e8e2']} /><fog attach="fog" args={['#e9e8e2', 20, 45]} />
    <ambientLight intensity={.8} /><directionalLight position={[4, 9, 6]} intensity={3} color="#fff6e8" />
    <Environment resolution={128}><Lightformer position={[0, 5, -5]} scale={[10, 8, 1]} intensity={3} /><Lightformer position={[-6, 1, 3]} rotation={[0, Math.PI / 2, 0]} scale={[5, 10, 1]} intensity={2} /><Lightformer position={[5, 3, 4]} rotation={[0, -Math.PI / 3, 0]} scale={[3, 7, 1]} intensity={4} /></Environment>
    <Director progress={progress} /><Sculpture split={split} inspect={inspect} />
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -3, 0]} receiveShadow><planeGeometry args={[200, 200]} /><meshStandardMaterial color="#e4e3dc" roughness={.9} /></mesh>
    <ContactShadows position={[0, -2.99, 0]} opacity={.32} scale={24} blur={3} far={10} resolution={256} frames={1} />
    {data.champions.map((c, i) => { const a = i / data.champions.length * Math.PI * 2; return <group key={c.id} position={[Math.cos(a) * 5, -1.7, Math.sin(a) * 5]} onClick={e => { e.stopPropagation(); select(i); }}>
      <mesh position={[0, -.6, 0]}><cylinderGeometry args={[.7, .75, 1.3, 48]} /><meshStandardMaterial color="#d9d6cc" roughness={.6} /></mesh>
      <mesh rotation={[0, a, .2]}><octahedronGeometry args={[.6, 0]} /><meshStandardMaterial color={i % 2 ? '#b09a6d' : '#8a9d91'} roughness={.22} metalness={.7} /></mesh>
    </group>; })}
    {data.patches.map((p, i) => <mesh key={p.id} position={[-4.8 + i * 1.2, -2.6, -5]} rotation={[0, .2, -.12]} onClick={e => { e.stopPropagation(); archive(i); }}><boxGeometry args={[.8, .8 + i * .23, .3]} /><meshStandardMaterial color="#b1b7ac" roughness={.6} /></mesh>)}
  </>;
}
export default function ObservatoryWorld(props: Props & { onFailure: () => void }) {
  const [dpr, setDpr] = useState(() => matchMedia('(pointer: coarse)').matches ? 1.25 : 1.6);
  return <Canvas dpr={dpr} camera={{ fov: 43, position: [0, 2, 12] }} gl={{ antialias: true, powerPreference: 'high-performance' }} onCreated={({ gl }) => { gl.domElement.addEventListener('webglcontextlost', props.onFailure, { once: true }); }}><PerformanceMonitor flipflops={2} onDecline={() => setDpr(1)} onFallback={() => setDpr(1)} /><World {...props} /></Canvas>;
}
