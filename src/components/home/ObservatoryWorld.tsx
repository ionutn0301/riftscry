import { useEffect, useMemo, useRef, useState } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { Environment, Lightformer } from '@react-three/drei';
import * as THREE from 'three';
import { ChapterEnvironment, Signal, stations } from './ChapterEnvironment';
import { createWorldMaterials } from './world-materials';
import { advanceJourney, createJourney, requestJourney, type JourneyPhase } from '../../lib/journey-director';

export type WorldProps = { chapter: number; reduced: boolean; skipVersion: number; paused: boolean; selected: number; count: number; split: number; patch: number; patchCount: number; onSelect: (n: number) => void; onPatch: (n: number) => void; onTravel: (n: number) => void; onArrival: (n: number) => void; onPhase: (phase: JourneyPhase) => void; onReady: () => void; onFailure: () => void };
function World(props: WorldProps) {
  const { chapter, reduced, onArrival, onPhase, onReady, onFailure } = props;
  const materials = useMemo(createWorldMaterials, []);
  const journey = useRef(createJourney(chapter));
  const phase = useRef<JourneyPhase>('ready');
  const signal = useRef<THREE.Group>(null);
  const sun = useRef<THREE.DirectionalLight>(null);
  const sunTarget = useMemo(() => new THREE.Object3D(), []);
  const [position, setPosition] = useState(chapter);
  const { gl, size, invalidate } = useThree();
  const paths = useMemo(() => {
    const portrait = size.width < size.height;
    const points = stations.map(([x, y, z], i) => new THREE.Vector3(x + (portrait ? 0 : i === 2 ? 6 : 4), y + (i === 3 ? 2 : 3), z + (portrait ? 17 : 13)));
    const route = [points[0]!, new THREE.Vector3(0, 1.4, -1), points[1]!, new THREE.Vector3(12, 7, -31), points[2]!, new THREE.Vector3(16, 2, -62), points[3]!, new THREE.Vector3(10, 8, -88), points[4]!];
    const camera = new THREE.CatmullRomCurve3(route, false, 'catmullrom', .25);
    const target = new THREE.CatmullRomCurve3(stations.map(([x, y, z]) => new THREE.Vector3(x - (portrait ? 0 : 1.8), y + .5, z - 1)), false, 'catmullrom', .2);
    return { camera, target };
  }, [size.width, size.height]);
  const vectors = useMemo(() => ({ camera: new THREE.Vector3(), target: new THREE.Vector3(), direction: new THREE.Vector3() }), []);
  const lastSkip = useRef(props.skipVersion);
  useEffect(() => {
    const skip = lastSkip.current !== props.skipVersion;
    lastSkip.current = props.skipVersion;
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
  useFrame(({ camera, pointer }, dt) => {
    if (!props.paused) journey.current = advanceJourney(journey.current, dt);
    const state = journey.current;
    if (phase.current !== state.phase) { phase.current = state.phase; onPhase(state.phase); }
    if (Math.abs(position - state.position) > .08 || (state.phase === 'ready' && position !== state.position)) setPosition(state.position);
    if (state.phase === 'ready') onArrival(state.destination);
    paths.camera.getPoint(state.position / 4, vectors.camera);
    paths.target.getPoint(state.position / 4, vectors.target);
    if (!reduced && state.phase === 'ready') { vectors.camera.x += pointer.x * .18; vectors.camera.y += pointer.y * .12; }
    camera.position.copy(vectors.camera);
    camera.lookAt(vectors.target);
    if (sun.current) {
      sunTarget.position.copy(vectors.target);
      sun.current.position.set(vectors.target.x + 9, vectors.target.y + 16, vectors.target.z + 7);
      sunTarget.updateMatrixWorld();
    }
    if (camera instanceof THREE.PerspectiveCamera) {
      const lens = state.phase === 'travelling' ? 52 : 43;
      camera.fov = THREE.MathUtils.damp(camera.fov, lens, 2, dt);
      camera.updateProjectionMatrix();
    }
    if (signal.current) {
      vectors.direction.subVectors(vectors.target, vectors.camera).normalize();
      signal.current.position.copy(vectors.camera).addScaledVector(vectors.direction, 8);
      signal.current.position.y -= .7;
      signal.current.visible = state.phase !== 'ready';
      if (!reduced) signal.current.rotation.y += dt * .45;
    }
  });
  return <>
    <color attach="background" args={['#d8ded6']} /><fog attach="fog" args={['#d8ded6', 22, 72]} />
    <ambientLight intensity={.6} /><hemisphereLight args={['#eaf4e8', '#526760', 1.5]} />
    <primitive object={sunTarget} />
    <directionalLight ref={sun} target={sunTarget} position={[10, 20, 8]} intensity={3.4} color="#fff0d2" castShadow shadow-mapSize={size.width < 700 ? [512, 512] : [1024, 1024]} shadow-camera-left={-18} shadow-camera-right={18} shadow-camera-top={18} shadow-camera-bottom={-18} shadow-camera-near={1} shadow-camera-far={60} shadow-normalBias={.04} />
    <Environment resolution={128} frames={1}><Lightformer intensity={3} position={[0, 8, 0]} rotation={[Math.PI / 2, 0, 0]} scale={[30, 30, 1]} /><Lightformer intensity={2} position={[-10, 2, 0]} rotation={[0, Math.PI / 2, 0]} scale={[12, 25, 1]} /></Environment>
    {stations.map((_, stage) => <ChapterEnvironment key={stage} stage={stage} materials={materials} position={position} selected={props.selected} count={props.count} active={phase.current === 'ready' && chapter === stage} onSelect={props.onSelect} onTravel={() => props.onTravel(1)} split={props.split} patch={props.patch} patchCount={props.patchCount} onPatch={props.onPatch} />)}
    <group ref={signal}><Signal materials={materials} /></group>
  </>;
}
export default function ObservatoryWorld(props: WorldProps) {
  const [visible, setVisible] = useState(true);
  useEffect(() => { const update = () => setVisible(!document.hidden); document.addEventListener('visibilitychange', update); return () => document.removeEventListener('visibilitychange', update); }, []);
  return <Canvas shadows dpr={[1, 1.5]} frameloop={visible ? 'always' : 'never'} camera={{ position: [4, 3, 13], fov: 43, near: .2, far: 160 }} gl={{ antialias: true, alpha: false, powerPreference: 'high-performance' }}><World {...props} /></Canvas>;
}
