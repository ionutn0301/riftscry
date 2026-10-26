import { Component, Suspense, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { useTexture } from '@react-three/drei';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import * as THREE from 'three';
import { atlasPose, type AtlasState } from '../../lib/atlas-state';
import type { ArchiveData } from '../../lib/living-archive';

export type AtlasWorldProps = { state: AtlasState; data: ArchiveData; reduced: boolean; preview: number | null; onChampion: (id: string) => void; onPatch: (id: string) => void; onReady: () => void; onFailure: (reason: string) => void };
const stone = '#788b91'; const pale = '#bcc9ca'; const bronze = '#9b7047';
const blockGeometry = new RoundedBoxGeometry(1, 1, 1, 1, .025);
const materialCache = new Map<string, THREE.MeshStandardMaterial>();
function surface(color: string, metal: boolean) {
  const key = `${color}-${metal}`; if (materialCache.has(key)) return materialCache.get(key)!;
  const material = new THREE.MeshStandardMaterial({ color, roughness: metal ? .38 : .89, metalness: metal ? .68 : .04 });
  material.onBeforeCompile = shader => {
    shader.vertexShader = shader.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 atlasLocal;').replace('#include <begin_vertex>', '#include <begin_vertex>\natlasLocal = position;');
    shader.fragmentShader = shader.fragmentShader.replace('#include <common>', '#include <common>\nvarying vec3 atlasLocal;').replace('#include <color_fragment>', '#include <color_fragment>\nfloat grain = fract(sin(dot(floor(atlasLocal * 460.0), vec3(12.9898,78.233,45.164))) * 43758.5453);\nfloat strata = sin(atlasLocal.y * 150.0 + sin(atlasLocal.x * 9.0) * 2.0);\ndiffuseColor.rgb *= 0.92 + grain * 0.10 + strata * 0.025;');
  };
  materialCache.set(key, material); return material;
}
function Block({ at, size, color = stone, metal = false, rotation = 0 }: { at: [number, number, number]; size: [number, number, number]; color?: string; metal?: boolean; rotation?: number }) {
  return <mesh position={at} scale={size} geometry={blockGeometry} material={surface(color, metal)} rotation-z={rotation} castShadow receiveShadow />;
}
class ArtBoundary extends Component<{ children: ReactNode; id: string }, { failed: boolean }> { state = { failed: false }; static getDerivedStateFromError() { return { failed: true }; } componentDidCatch() { window.dispatchEvent(new CustomEvent('atlas:asset-error', { detail: this.props.id })); } render() { return this.state.failed ? null : this.props.children; } }
function Portrait({ id }: { id: string }) {
  const texture = useTexture(`https://ddragon.leagueoflegends.com/cdn/img/champion/loading/${id}_0.jpg`);
  texture.colorSpace = THREE.SRGBColorSpace;
  useEffect(() => () => { texture.dispose(); useTexture.clear(`https://ddragon.leagueoflegends.com/cdn/img/champion/loading/${id}_0.jpg`); }, [texture, id]);
  return <mesh position={[0, 3.05, .19]}><planeGeometry args={[2.3, 4.18]} /><meshBasicMaterial map={texture} toneMapped={false} /></mesh>;
}
function intervalGeometry(props: AtlasWorldProps) {
  const ordered = [...props.data.patches].reverse();
  const a = ordered.findIndex(p => p.id === props.state.comparisonFrom); const b = ordered.findIndex(p => p.id === props.state.comparisonTo);
  return { center: (a + b) / 2, span: Math.abs(a - b) * 3.4 };
}
function Bay({ id, index, props }: { id: string; index: number; props: AtlasWorldProps }) {
  const { invalidate } = useThree();
  const group = useRef<THREE.Group>(null); const { state, reduced } = props; const selected = state.championId === id;
  const z = -(state.comparisonOpen ? intervalGeometry(props).center : state.journeyProgress) * 3.4;
  const inCollection = state.view === 'pool' && state.pool.includes(id);
  const destination = useMemo(() => {
    if (state.view === 'pool') return inCollection ? new THREE.Vector3(state.pool.indexOf(id) % 2 ? 5 : -5, 0, -4 - Math.floor(state.pool.indexOf(id) / 2) * 7) : new THREE.Vector3(index % 2 ? 15 : -15, 0, -48 - index * 3);
    if (selected && ['champion', 'history', 'compare'].includes(state.view)) return new THREE.Vector3(-4.2, 0, z);
    return new THREE.Vector3(index % 2 ? 6 : -6, 0, -5 - Math.floor(index / 2) * 10);
  }, [selected, state.view, state.pool, inCollection, id, index, z]);
  const initialized = useRef(false);
  useFrame((_, dt) => { if (!group.current) return; if (reduced || !initialized.current) group.current.position.copy(destination); else group.current.position.lerp(destination, 1 - Math.exp(-7 * Math.min(dt, .5))); initialized.current = true; if (group.current.position.distanceTo(destination) > .002) invalidate(); });
  return <group name={`champion-${id}`} ref={group} position={destination} onClick={e => { e.stopPropagation(); props.onChampion(id); }}>
    <Block at={[0, -.35, 0]} size={[3.2, .9, 2]} color={stone} />
    <Block at={[0, .18, 0]} size={[3.4, .36, 2.15]} color={pale} />
    <Block at={[0, .45, 0]} size={[2.8, .18, 1.55]} color={bronze} metal />
    <Block at={[0, 3.05, -.08]} size={[2.65, 4.65, .42]} color="#344f5b" />
    {[-1.27, 1.27].map(x => <Block key={x} at={[x, 3.05, .12]} size={[.09, 4.55, .14]} color={bronze} metal />)}
    <Block at={[0, 5.34, .1]} size={[2.72, .09, .3]} color={bronze} metal />
    <ArtBoundary key={id} id={id}><Suspense fallback={null}><Portrait id={id} /></Suspense></ArtBoundary>
    <Block at={[0, .8, .65]} size={[2.3, .12, .2]} color={selected ? '#c19059' : pale} metal />
  </group>;
}
function Station({ index, props }: { index: number; props: AtlasWorldProps }) {
  const { invalidate } = useThree();
  const g = useRef<THREE.Group>(null); const patch = [...props.data.patches].reverse()[index]!;
  const ordered = [...props.data.patches].reverse(); const a = ordered.findIndex(p => p.id === props.state.comparisonFrom); const b = ordered.findIndex(p => p.id === props.state.comparisonTo);
  const included = props.state.comparisonOpen && index > Math.min(a, b) && index <= Math.max(a, b);
  const hasRecord = props.data.champions.find(c => c.id === props.state.championId)?.records.some(r => r.patchId === patch.id);
  const x = included ? 3.3 + (index - Math.min(a, b)) * .23 : 0;
  useFrame((_, dt) => { if (!g.current) return; g.current.position.x = props.reduced ? x : THREE.MathUtils.damp(g.current.position.x, x, 12, Math.min(dt, .5)); if (Math.abs(g.current.position.x - x) > .002) invalidate(); });
  return <group ref={g} position={[0, 0, -index * 3.4]} onClick={e => { e.stopPropagation(); props.onPatch(patch.id); }}>
    <Block at={[0, .05, 0]} size={[6.8, .3, 2.7]} color={index % 2 ? '#97a7ac' : '#a4b2b5'} />
    <Block at={[0, .23, 0]} size={[.07, .04, 2.72]} color={bronze} metal />
    <Block at={[2.5, .3, .65]} size={[.7, .12, .3]} color={hasRecord ? bronze : pale} metal />
    {included && hasRecord && <Block at={[2, .8, 0]} size={[1.2, .9, .1]} color="#d5dfdc" />}
  </group>;
}
function Bracket({ endpoint, props }: { endpoint: 'comparisonFrom' | 'comparisonTo'; props: AtlasWorldProps }) {
  const { invalidate } = useThree();
  const g = useRef<THREE.Group>(null); const index = [...props.data.patches].reverse().findIndex(p => p.id === props.state[endpoint]);
  useFrame((_, dt) => { if (!g.current) return; const t = props.reduced ? 1 : 1 - Math.exp(-10 * Math.min(dt, .5)); g.current.position.z = THREE.MathUtils.lerp(g.current.position.z, -index * 3.4, t); g.current.scale.y = THREE.MathUtils.lerp(g.current.scale.y, props.state.comparisonOpen ? 1 : .02, t); if (Math.abs(g.current.position.z + index * 3.4) > .002 || Math.abs(g.current.scale.y - (props.state.comparisonOpen ? 1 : .02)) > .002) invalidate(); });
  return <group name={endpoint} ref={g} position={[0, .28, -index * 3.4]}>
    <Block at={[0, 0, 0]} size={[7.7, .14, .14]} color={bronze} metal />
    {[-3.8, 3.8].map(x => <Block key={x} at={[x, .8, 0]} size={[.14, 1.6, .14]} color={bronze} metal />)}
  </group>;
}
function Rig(props: AtlasWorldProps) {
  const { camera, size, gl, invalidate, scene } = useThree();
  const started = useRef(0);
  const initialized = useRef(false); const progress = useRef(1); const target = useRef(new THREE.Vector3()); const fromPosition = useRef(new THREE.Vector3()); const fromTarget = useRef(new THREE.Vector3());
  const interval = intervalGeometry(props);
  const pose = useMemo(() => atlasPose(props.state, size.width < 600, props.state.comparisonOpen ? interval.center : props.preview ?? props.state.journeyProgress, props.state.comparisonOpen ? interval.span : 0), [props.state.view, props.state.journeyProgress, props.preview, interval.center, interval.span, size.width, size.height]);
  const destination = useMemo(() => new THREE.Vector3(...pose.position), [pose]); const aim = useMemo(() => new THREE.Vector3(...pose.target), [pose]);
  const instance = useRef(`atlas-${Math.random().toString(36).slice(2, 9)}`); const times = useRef<number[]>([]);
  useEffect(() => { fromPosition.current.copy(camera.position); fromTarget.current.copy(target.current); progress.current = initialized.current && !props.reduced ? 0 : 1; started.current = performance.now(); invalidate(); }, [pose, props.reduced, camera, invalidate]);
  useEffect(() => { const lost = (e: Event) => { e.preventDefault(); props.onFailure('WebGL context lost'); }; gl.domElement.addEventListener('webglcontextlost', lost); props.onReady(); return () => gl.domElement.removeEventListener('webglcontextlost', lost); }, [gl]);
  useFrame((_, dt) => {
    const snap = props.reduced || !initialized.current;
    progress.current = snap ? 1 : Math.min(1, (performance.now() - started.current) / (props.preview !== null ? 280 : 1050));
    const t = progress.current * progress.current * (3 - 2 * progress.current);
    camera.position.lerpVectors(fromPosition.current, destination, t); if (!props.reduced && progress.current < 1) camera.position.x += Math.sin(Math.PI * t) * (props.state.view === 'champion' ? 2 : props.state.view === 'compare' ? -1.3 : .5); target.current.lerpVectors(fromTarget.current, aim, t); camera.lookAt(target.current); initialized.current = true;
    if (progress.current < 1) invalidate();
    if (import.meta.env.DEV) {
      times.current.push(dt * 1000); if (times.current.length > 240) times.current.shift();
      Object.assign(window, { __riftAtlas: { mode: props.reduced ? 'reduced' : 'full', renderer: instance.current, ready: true, state: props.state, progress: progress.current, camera: camera.position.toArray(), target: target.current.toArray(), drawCalls: gl.info.render.calls, triangles: gl.info.render.triangles, textures: gl.info.memory.textures, dpr: gl.getPixelRatio(), frameMs: times.current.slice(), viewport: [size.width, size.height], fallbackReason: null, objects: Object.fromEntries([`champion-${props.state.championId}`, 'comparisonFrom', 'comparisonTo'].map(name => [name, scene.getObjectByName(name)?.position.toArray()])) } });
    }
  }); return null;
}
function RibRows({ right = false }: { right?: boolean }) {
  const mesh = useRef<THREE.InstancedMesh>(null);
  const geometry = useMemo(() => {
    const shape = new THREE.Shape();
    const points = right ? [[0, 0], [2.1, 0], [1.5, 9], [-4.4, 10], [-4.7, 10.8], [.6, 10.5]] : [[0, 0], [2.3, 0], [1.55, 10.9], [9.1, 11.9], [9.5, 12.8], [.5, 12.1]];
    shape.moveTo(points[0]![0]!, points[0]![1]!); points.slice(1).forEach(p => shape.lineTo(p[0]!, p[1]!)); shape.closePath();
    return new THREE.ExtrudeGeometry(shape, { depth: 1.35, bevelEnabled: true, bevelSegments: 1, steps: 1, bevelSize: .06, bevelThickness: .06 });
  }, [right]);
  useEffect(() => { const matrix = new THREE.Matrix4(); for (let i = 0; i < 7; i++) mesh.current?.setMatrixAt(i, matrix.makeTranslation(right ? 9 : -11, -.6, 5 - i * 10)); if (mesh.current) mesh.current.instanceMatrix.needsUpdate = true; return () => geometry.dispose(); }, [geometry, right]);
  return <instancedMesh ref={mesh} args={[geometry, surface(right ? '#8fa4ab' : '#607c88', false), 7]} castShadow receiveShadow />;
}
function Architecture(props: AtlasWorldProps) {
  const ids = Array.from(new Set(['Azir', 'Camille', 'Ahri', 'Jinx', props.state.championId, ...props.state.pool.slice(0, 12)]));
  return <>
    <color attach="background" args={['#dbe3e3']} /><fog attach="fog" args={['#dbe3e3', 45, 115]} />
    <ambientLight intensity={.75} /><hemisphereLight args={['#e8f3ff', '#607378', 2]} />
    <directionalLight position={[15, 25, 8]} intensity={3} color="#fff1da" castShadow shadow-mapSize={[1024, 1024]} shadow-camera-left={-35} shadow-camera-right={35} shadow-camera-top={35} shadow-camera-bottom={-35} shadow-camera-far={110} shadow-normalBias={.04} />
    <mesh rotation-x={-Math.PI / 2} position={[0, -.8, -22]} receiveShadow><planeGeometry args={[200, 200]} /><meshStandardMaterial color="#c6d4d7" roughness={.96} /></mesh>
    {[-1.85, 1.85].map(x => <Block key={x} at={[x, -.28, -25.5]} size={[3.3, .7, 58]} color="#71868d" />)}
    <Block at={[0, -.13, -25.5]} size={[.11, .25, 58]} color={bronze} metal />
    {Array.from({ length: props.data.patches.length }, (_, i) => <Station index={i} key={i} props={props} />)}
    <RibRows /><RibRows right />
    <Block at={[-1.85, 12.15, -25]} size={[.4, .3, 60]} color={bronze} metal />
    <Block at={[4.3, 10.3, -25]} size={[.4, .3, 60]} color={bronze} metal />
    {[-1, 0, 1].map(i => <Block key={i} at={[0, -.58 + i * .08, 5.3 + i * .45]} size={[7.3 + i * .4, .15, .44]} color={pale} />)}
    {ids.map((id, index) => <Bay key={id} id={id} index={index} props={props} />)}
    <Bracket endpoint="comparisonFrom" props={props} /><Bracket endpoint="comparisonTo" props={props} />
    <Rig {...props} />
  </>;
}
export default function AtlasWorld(props: AtlasWorldProps) {
  const [visible, setVisible] = useState(true);
  useEffect(() => { const update = () => setVisible(!document.hidden); document.addEventListener('visibilitychange', update); return () => document.removeEventListener('visibilitychange', update); }, []);
  return <Canvas shadows dpr={[1, 1.25]} frameloop={visible ? 'demand' : 'never'} camera={{ position: [22, 15, 20], fov: 43, near: .2, far: 180 }} gl={{ antialias: true, alpha: false, powerPreference: 'high-performance' }}><Architecture {...props} /></Canvas>;
}
