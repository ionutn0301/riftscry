import { useEffect, useMemo, useRef, useState } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { Environment, Lightformer } from '@react-three/drei';
import * as THREE from 'three';
import { ChapterEnvironment, Signal, stations } from './ChapterEnvironment';
import { createWorldMaterials } from './world-materials';
import { createJourneyPath } from '../../lib/journey-path';
import { advanceJourney, createJourney, requestJourney, type JourneyPhase } from '../../lib/journey-director';

export type WorldProps = { onInspectionChange: (value: boolean) => void; record: { patch: string; name: string; before: string; after: string; label: string }; champions: { id: string; name: string }[]; patches: { id: string; date: string }[]; assetVersion?: string; chapter: number; reduced: boolean; skipVersion: number; paused: boolean; selected: number; count: number; split: number; onSplit: (value: number) => void; patch: number; patchCount: number; onSelect: (n: number) => void; onPatch: (n: number) => void; onTravel: (n: number) => void; onArrival: (n: number) => void; onPhase: (phase: JourneyPhase) => void; onReady: () => void; onFailure: () => void };
function World(props: WorldProps) {
  const { chapter, reduced, onArrival, onPhase, onReady, onFailure } = props;
  const materials = useMemo(createWorldMaterials, []);
  const flightMaterials = useMemo(() => {
    const copies = { stone: materials.stone.clone(), metal: materials.metal.clone(), dark: materials.dark.clone(), light: materials.light.clone() };
    Object.values(copies).forEach(material => { material.depthTest = false; material.depthWrite = false; });
    return { ...copies, dispose: () => Object.values(copies).forEach(material => material.dispose()) };
  }, [materials]);
  useEffect(() => () => flightMaterials.dispose(), [flightMaterials]);
  const journey = useRef(createJourney(chapter));
  const phase = useRef<JourneyPhase>('ready');
  const signal = useRef<THREE.Group>(null);
  const sun = useRef<THREE.DirectionalLight>(null);
  const sunTarget = useMemo(() => new THREE.Object3D(), []);
  const [position, setPosition] = useState(chapter);
  const { gl, size, invalidate } = useThree();
  const paths = useMemo(() => {
    const portrait = size.width < size.height;
    const camera = createJourneyPath(portrait);
    return { camera };
  }, [size.width, size.height]);
  const vectors = useMemo(() => ({ camera: new THREE.Vector3(), target: new THREE.Vector3(), direction: new THREE.Vector3(), dock: new THREE.Vector3(), aim: new THREE.Vector3(), pointer: new THREE.Vector2() }), []);
  const bank = useRef(0);
  const initialized = useRef(false);
  const lastSkip = useRef(props.skipVersion);
  useEffect(() => {
    const skip = lastSkip.current !== props.skipVersion;
    lastSkip.current = props.skipVersion;
    if (skip) initialized.current = false;
    journey.current = requestJourney(journey.current, chapter, reduced || skip);
    invalidate();
  }, [chapter, reduced, props.skipVersion, invalidate]);
  useEffect(() => {
    const canvas = gl.domElement;
    const lost = (e: Event) => { e.preventDefault(); onFailure(); };
    canvas.addEventListener('webglcontextlost', lost);
    onReady();
    return () => canvas.removeEventListener('webglcontextlost', lost);
  }, [gl, onReady, onFailure]);
  useEffect(() => () => materials.dispose(), [materials]);
  useFrame(({ camera }, dt) => {
    if (!props.paused) journey.current = advanceJourney(journey.current, dt);
    const state = journey.current;
    if (phase.current !== state.phase) { phase.current = state.phase; onPhase(state.phase); }
    if (Math.abs(position - state.position) > .08 || (state.phase === 'ready' && position !== state.position)) setPosition(state.position);
    if (state.phase === 'ready') onArrival(state.destination);
    paths.camera.sample(state.position, vectors.camera);
    const frameTime = Math.min(dt, .05);
    const snap = !initialized.current || reduced;
    if (snap) camera.position.copy(vectors.camera);
    else camera.position.lerp(vectors.camera, 1 - Math.exp(-3.5 * frameTime));
    initialized.current = true;
    // A fixed horizon avoids the yaw and zoom changes that made bends disorienting.
    vectors.target.copy(camera.position).add(vectors.dock.set(size.width < size.height ? 0 : -3.5, -2.5, -16));
    camera.lookAt(vectors.target);
    vectors.direction.set(size.width < size.height ? 1.55 * size.width / size.height : 0, -.65, -5).applyQuaternion(camera.quaternion).add(camera.position);
    if (sun.current) {
      sunTarget.position.copy(vectors.target);
      sun.current.position.set(vectors.target.x + 9, vectors.target.y + 16, vectors.target.z + 7);
      sunTarget.updateMatrixWorld();
    }
    if (camera instanceof THREE.PerspectiveCamera) {
      const lens = 43;
      camera.fov = THREE.MathUtils.damp(camera.fov, lens, 2, dt);
      camera.updateProjectionMatrix();
    }
    if (signal.current) {
      signal.current.position.copy(vectors.direction);
      signal.current.quaternion.copy(camera.quaternion);
      bank.current = THREE.MathUtils.damp(bank.current, reduced ? 0 : THREE.MathUtils.clamp((camera.position.x - vectors.camera.x) * .15, -.2, .2), 3, frameTime);
      signal.current.rotateZ(bank.current);
      signal.current.scale.setScalar(size.width < size.height ? .18 : .42);
      signal.current.visible = true;
    }
  });
  return <>
    <color attach="background" args={['#d8ded6']} /><fog attach="fog" args={['#d8ded6', 22, 72]} />
    <ambientLight intensity={.6} /><hemisphereLight args={['#eaf4e8', '#526760', 1.5]} />
    <primitive object={sunTarget} />
    <directionalLight ref={sun} target={sunTarget} position={[10, 20, 8]} intensity={3.4} color="#fff0d2" castShadow shadow-mapSize={size.width < 700 ? [512, 512] : [1024, 1024]} shadow-camera-left={-18} shadow-camera-right={18} shadow-camera-top={18} shadow-camera-bottom={-18} shadow-camera-near={1} shadow-camera-far={60} shadow-normalBias={.04} />
    <Environment resolution={128} frames={1}><Lightformer intensity={3} position={[0, 8, 0]} rotation={[Math.PI / 2, 0, 0]} scale={[30, 30, 1]} /><Lightformer intensity={2} position={[-10, 2, 0]} rotation={[0, Math.PI / 2, 0]} scale={[12, 25, 1]} /></Environment>
    {stations.map((_, stage) => <ChapterEnvironment onInspectionChange={props.onInspectionChange} record={props.record} reduced={reduced} champions={props.champions} patches={props.patches} assetVersion={props.assetVersion} key={stage} stage={stage} materials={materials} position={position} selected={props.selected} count={props.count} active={phase.current === 'ready' && chapter === stage} onSelect={props.onSelect} onTravel={() => props.onTravel(1)} split={props.split} onSplit={props.onSplit} patch={props.patch} patchCount={props.patchCount} onPatch={props.onPatch} />)}
    <group ref={signal} renderOrder={100}><Signal materials={flightMaterials} /></group>
  </>;
}
export default function ObservatoryWorld(props: WorldProps) {
  const [visible, setVisible] = useState(true);
  useEffect(() => { const update = () => setVisible(!document.hidden); document.addEventListener('visibilitychange', update); return () => document.removeEventListener('visibilitychange', update); }, []);
  return <Canvas dpr={1} frameloop={visible ? 'always' : 'never'} camera={{ position: [4, 3, 13], fov: 43, near: .2, far: 160 }} gl={{ antialias: true, alpha: false, powerPreference: 'high-performance' }}><World {...props} /></Canvas>;
}
