import { useMemo, useRef, useState } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { ContactShadows, Environment, Lightformer, PerformanceMonitor } from '@react-three/drei';
import * as THREE from 'three';
import { chapterAt, type ObservatoryData } from '../../lib/observatory';
import { ChapterEntrance, ChapterEnvironment } from './ChapterEnvironment';

type Props = { selected: number; progress: number; split: number; data: ObservatoryData; select: (n: number) => void; inspect: () => void; archive: (n: number) => void };
function Director({ progress }: { progress: number }) {
  const path = useMemo(() => new THREE.CatmullRomCurve3([
    new THREE.Vector3(0, 1, 11), new THREE.Vector3(8, 2, 7), new THREE.Vector3(1, .1, 6.8), new THREE.Vector3(-7, 6, 7), new THREE.Vector3(0, 4, 13)
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
  const core = useRef<THREE.Mesh>(null);
  useFrame(({ clock }, dt) => {
    if (!group.current) return;
    group.current.rotation.y = THREE.MathUtils.damp(group.current.rotation.y, hover ? .55 : -.2 + Math.sin(clock.elapsedTime * .2) * .12, 2, dt);
    group.current.position.y = Math.sin(clock.elapsedTime * .6) * .1;
    if (core.current) { core.current.rotation.y += dt * .4; core.current.rotation.z += dt * .16; core.current.scale.setScalar(1 + Math.sin(clock.elapsedTime * 2) * .045 + split * .25); }
  });
  return <group ref={group} rotation={[.13, -.2, -.16]} onPointerOver={e => { e.stopPropagation(); setHover(true); }} onPointerOut={() => setHover(false)} onClick={e => { e.stopPropagation(); inspect(); }}>
    {[0, 1].map(i => <mesh key={i} position={[(i ? 1 : -1) * split * .65, 0, 0]} rotation={[0, 0, i * Math.PI + .08]} castShadow>
      <torusGeometry args={[2.05, .69, 48, 110, Math.PI - .16]} />
      <meshPhysicalMaterial color="#e5e1d5" roughness={.32} metalness={.08} clearcoat={.25} />
    </mesh>)}
    <mesh rotation={[.4, -.5, -.5]} castShadow><torusGeometry args={[2.05, .075, 20, 160]} /><meshStandardMaterial color="#b5914d" metalness={.92} roughness={.23} /></mesh>
    <mesh ref={core} rotation={[.2, .3, .4]} castShadow><octahedronGeometry args={[.8, 0]} /><meshPhysicalMaterial color="#38a8aa" emissive="#167e83" emissiveIntensity={hover ? 1.4 : .5} metalness={.65} roughness={.18} clearcoat={1} /></mesh>
    <pointLight color="#46d9d0" intensity={hover ? 18 : 8} distance={7} />
  </group>;
}
function ChampionShard({ index, count, selected, onSelect }: { index: number; count: number; selected: boolean; onSelect: () => void }) {
  const shard = useRef<THREE.Mesh>(null);
  const [hover, setHover] = useState(false);
  const angle = index / count * Math.PI * 2;
  useFrame(({ clock }, dt) => {
    if (!shard.current) return;
    shard.current.position.y = Math.sin(clock.elapsedTime * .8 + index) * .18 + (selected ? .35 : 0);
    shard.current.rotation.y += dt * (hover ? 1 : .22);
    const scale = THREE.MathUtils.damp(shard.current.scale.x, hover || selected ? 1.25 : 1, 5, dt);
    shard.current.scale.setScalar(scale);
  });
  return <group position={[Math.cos(angle) * 4.7, -1.6, Math.sin(angle) * 4.7]} onClick={e => { e.stopPropagation(); onSelect(); }} onPointerOver={e => { e.stopPropagation(); setHover(true); }} onPointerOut={() => setHover(false)}>
    <mesh position={[0, -.8, 0]}><cylinderGeometry args={[.65, .75, .9, 32]} /><meshStandardMaterial color="#c1baab" roughness={.5} /></mesh>
    <mesh ref={shard}><octahedronGeometry args={[.6, 0]} /><meshStandardMaterial color={selected ? '#208e91' : '#ad8947'} emissive={selected || hover ? '#145f65' : '#000000'} emissiveIntensity={.5} roughness={.22} metalness={.65} /></mesh>
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -.32, 0]}><torusGeometry args={[.8, selected ? .035 : .012, 8, 64]} /><meshBasicMaterial color={selected ? '#168b90' : '#8e713e'} /></mesh>
  </group>;
}
function EnergyOrbit() {
  const group = useRef<THREE.Group>(null);
  useFrame((_, dt) => { if (group.current) group.current.rotation.y += dt * .12; });
  return <group ref={group}>{Array.from({ length: 36 }, (_, i) => <mesh key={i} position={[Math.cos(i * 2.4) * (3 + i % 3), Math.sin(i * 1.7) * 2, Math.sin(i * 2.4) * (3 + i % 3)]}><sphereGeometry args={[.018 + (i % 3) * .008, 6, 6]} /><meshBasicMaterial color={i % 2 ? '#207f87' : '#ae8742'} /></mesh>)}</group>;
}
function World({ progress, split, selected, data, select, inspect, archive }: Props) {
  const chapter = chapterAt(progress);
  const atmosphere = ['#e9e8e2', '#dce7e2', '#d6e0de', '#e7dfcf', '#dfe8de'][chapter] ?? '#e9e8e2';
  return <>
    <color attach="background" args={[atmosphere]} /><fog attach="fog" args={[atmosphere, 20, 55]} />
    <ambientLight intensity={.8} /><directionalLight position={[4, 9, 6]} intensity={3} color="#fff6e8" />
    <Environment resolution={128}><Lightformer position={[0, 5, -5]} scale={[10, 8, 1]} intensity={3} /><Lightformer position={[-6, 1, 3]} rotation={[0, Math.PI / 2, 0]} scale={[5, 10, 1]} intensity={2} /><Lightformer position={[5, 3, 4]} rotation={[0, -Math.PI / 3, 0]} scale={[3, 7, 1]} intensity={4} /></Environment>
    <Director progress={chapter} />
    <ChapterEntrance key={chapter} chapter={chapter}>
      <ChapterEnvironment chapter={chapter} data={data} archive={archive} split={split} />
      {(chapter === 0 || chapter === 2) && <Sculpture split={chapter === 2 ? split : 0} inspect={inspect} />}
      {chapter === 1 && data.champions.map((c, i) => <ChampionShard key={c.id} index={i} count={data.champions.length} selected={selected === i} onSelect={() => select(i)} />)}
    </ChapterEntrance>
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -3, 0]} receiveShadow><planeGeometry args={[200, 200]} /><meshStandardMaterial color="#e4e3dc" roughness={.9} /></mesh>
    <ContactShadows position={[0, -2.99, 0]} opacity={.32} scale={24} blur={3} far={10} resolution={256} frames={1} />
    <EnergyOrbit />

    {[3.4, 5.9, 7.4].map(radius => <mesh key={radius} rotation={[-Math.PI / 2, 0, 0]} position={[0, -2.98, 0]}><torusGeometry args={[radius, .016, 6, 120]} /><meshStandardMaterial color="#8a754d" roughness={.4} metalness={.6} /></mesh>)}

  </>;
}
export default function ObservatoryWorld(props: Props & { onFailure: () => void }) {
  const [dpr, setDpr] = useState(() => matchMedia('(pointer: coarse)').matches ? 1.25 : 1.6);
  return <Canvas dpr={dpr} camera={{ fov: 43, position: [0, 2, 12] }} gl={{ antialias: true, powerPreference: 'high-performance' }} onCreated={({ gl }) => { gl.domElement.addEventListener('webglcontextlost', props.onFailure, { once: true }); }}><PerformanceMonitor flipflops={2} onDecline={() => setDpr(1)} onFallback={() => setDpr(1)} /><World {...props} /></Canvas>;
}
