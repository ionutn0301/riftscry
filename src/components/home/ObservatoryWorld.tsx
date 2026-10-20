import { useMemo, useRef, useState } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { Float, Stars, PerformanceMonitor } from '@react-three/drei';
import * as THREE from 'three';
import type { ObservatoryData } from '../../lib/observatory';

function Director({ progress }: { progress: number }) {
  const path = useMemo(() => new THREE.CatmullRomCurve3([
    new THREE.Vector3(0, 1.2, 10), new THREE.Vector3(8, 2, 8), new THREE.Vector3(2, .6, 4.7), new THREE.Vector3(-9, 6, 7), new THREE.Vector3(0, 3, 13)
  ]), []);
  const position = useRef(0);
  useFrame(({ camera, pointer, size }, dt) => {
    const portrait = size.width < size.height;
    position.current = THREE.MathUtils.damp(position.current, progress / 4, 2.2, Math.min(dt, .05));
    const point = path.getPoint(THREE.MathUtils.clamp(position.current, 0, 1));
    const distance = portrait ? Math.max(1.35, Math.min(1.85, size.height / size.width)) : 1;
    const parallax = portrait ? 0 : 1;
    camera.position.set(point.x * distance + pointer.x * .18 * parallax, point.y * distance + pointer.y * .12 * parallax, point.z * distance);
    camera.lookAt(0, portrait ? -1.6 : .2, 0);
  });
  return null;
}
function Lens({ split, onInspect }: { split: number; onInspect: () => void }) {
  const group = useRef<THREE.Group>(null);
  const geometry = useMemo(() => {
    const shape = new THREE.Shape();
    shape.moveTo(0, 2.7); shape.lineTo(1.18, .65); shape.lineTo(.82, -1.65); shape.lineTo(0, -2.6); shape.lineTo(-.82, -1.65); shape.lineTo(-1.18, .65); shape.closePath();
    return new THREE.ExtrudeGeometry(shape, { depth: .42, bevelEnabled: true, bevelSize: .18, bevelThickness: .2, bevelSegments: 3, steps: 1 });
  }, []);
  useFrame((_, dt) => { if (group.current) group.current.rotation.y += dt * .07; });
  return <group ref={group} rotation={[.12, -.3, -.16]} onClick={e => { e.stopPropagation(); onInspect(); }}>
    {[-1, 1].map(side => <group key={side} position={[side * (.12 + split * .65), 0, 0]} scale={[.49, 1, 1]}>
      <mesh geometry={geometry}><meshPhysicalMaterial color="#74a0ac" metalness={.78} roughness={.19} clearcoat={1} clearcoatRoughness={.08} /></mesh>
      <lineSegments><edgesGeometry args={[geometry, 20]} /><lineBasicMaterial color="#d6e5df" transparent opacity={.5} /></lineSegments>
    </group>)}
    <mesh position={[0, 0, .25]}><boxGeometry args={[.035, 4.8, .03]} /><meshBasicMaterial color="#d8ffed" /></mesh>
    {[0, 1, 2].map(i => <mesh key={i} rotation={[Math.PI / 2 + i * .4, i * .7, i * .3]}><torusGeometry args={[3.1 + i * .22, .012, 8, 180]} /><meshStandardMaterial color="#b3c6bd" metalness={.8} roughness={.3} /></mesh>)}
  </group>;
}
function World({ progress, split, data, select, inspect, archive }: { progress: number; split: number; data: ObservatoryData; select: (n: number) => void; inspect: () => void; archive: (n: number) => void }) {
  return <>
    <color attach="background" args={['#080e11']} /><fog attach="fog" args={['#080e11', 14, 42]} />
    <ambientLight intensity={.65} /><directionalLight position={[4, 8, 5]} intensity={4} color="#d9efea" /><pointLight position={[-4, 0, 2]} intensity={35} color="#68a8b4" /><pointLight position={[0, -2, 1]} intensity={12} color="#d3c198" />
    <Director progress={progress} />
    <Float speed={.65} rotationIntensity={.05} floatIntensity={.3}><Lens split={split} onInspect={inspect} /></Float>
    <Stars radius={35} depth={20} count={1100} factor={1.1} saturation={0} fade speed={.1} />
    {Array.from({ length: 40 }, (_, i) => { const a = i / 40 * Math.PI * 2; return <group key={i} position={[Math.cos(a) * 10, -4, Math.sin(a) * 10]} rotation={[0, -a, 0]}><mesh><boxGeometry args={[.16, 7 + Math.sin(i * 4) * 2, .65]} /><meshStandardMaterial color="#253439" metalness={.65} roughness={.38} /></mesh><mesh position={[0, 3, .34]}><boxGeometry args={[.025, 1.3, .015]} /><meshBasicMaterial color="#819b96" /></mesh></group>; })}
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -4, 0]}><circleGeometry args={[30, 128]} /><meshStandardMaterial color="#101c20" metalness={.8} roughness={.3} /></mesh>
    {[5, 7, 10, 13].map(r => <mesh key={r} rotation={[Math.PI / 2, 0, 0]} position={[0, -3.95, 0]}><torusGeometry args={[r, .018, 6, 180]} /><meshBasicMaterial color="#647c78" /></mesh>)}
    {data.champions.map((champion, i) => { const a = i / data.champions.length * Math.PI * 2; return <Float key={champion.id} speed={.8} floatIntensity={.3}><group position={[Math.cos(a) * 5, Math.sin(a * 2) * .6, Math.sin(a) * 5]} rotation={[0, -a, .1]} onClick={e => { e.stopPropagation(); select(i); }}><mesh><octahedronGeometry args={[.62, 0]} /><meshPhysicalMaterial color="#71979e" metalness={.8} roughness={.13} clearcoat={1} /></mesh><mesh rotation={[Math.PI / 2, 0, 0]}><torusGeometry args={[.84, .018, 8, 64]} /><meshBasicMaterial color="#d2c5a2" /></mesh></group></Float>; })}
    {data.patches.map((p, i) => { const a = i / data.patches.length * Math.PI * 2; return <mesh key={p.id} position={[Math.cos(a) * 8, -2.8, Math.sin(a) * 8]} onClick={e => { e.stopPropagation(); archive(i); }}><icosahedronGeometry args={[.18, 1]} /><meshStandardMaterial color="#bfcfc2" emissive="#92af9c" emissiveIntensity={.6} /></mesh>; })}
  </>;
}
export default function ObservatoryWorld(props: Parameters<typeof World>[0] & { onFailure: () => void }) {
  const [dpr, setDpr] = useState(() => matchMedia('(pointer: coarse)').matches ? 1.25 : 1.6);
  return <Canvas dpr={dpr} camera={{ fov: 43, position: [0, 1.2, 10] }} gl={{ antialias: true, powerPreference: 'high-performance' }} onCreated={({ gl }) => { gl.domElement.addEventListener('webglcontextlost', props.onFailure, { once: true }); }}><PerformanceMonitor flipflops={2} onDecline={() => setDpr(1)} onFallback={() => setDpr(1)} /><World {...props} /></Canvas>;
}
