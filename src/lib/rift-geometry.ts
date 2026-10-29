/** The same authored sculpture is projected on the server and drawn by WebGL. */
export type Vec3 = readonly [number, number, number];

export type RiftSurface =
  | 'home' | 'explore' | 'players' | 'player' | 'match' | 'next-game'
  | 'notebook' | 'champions' | 'champion' | 'patches' | 'patch'
  | 'compare' | 'pool' | 'missing';

export interface RiftPreset {
  surface: RiftSurface;
  rotation: Vec3;
  focal: number;
  size: number;
  x: number;
  y: number;
  mobileX: number;
  mobileY: number;
  mobileSize: number;
  accent: string;
  secondary: string;
}

const preset = (
  surface: RiftSurface,
  rotation: Vec3,
  accent: string,
  secondary: string,
  composition: Partial<RiftPreset> = {},
): RiftPreset => ({
  surface, rotation, accent, secondary, focal: 1.22,
  size: 1, x: 76, y: 45, mobileX: 87, mobileY: 24, mobileSize: 1,
  ...composition,
});

/** Different views of one object; these colors do not represent game data. */
export const riftScenePresets: Record<RiftSurface, RiftPreset> = {
  home: preset('home', [-.16, -.38, -.33], '#a6f5ef', '#c4b6ff', { x: 76, y: 45, size: 1.12 }),
  explore: preset('explore', [.12, -.30, -.22], '#a9e8f5', '#d9c6fa', { x: 78, size: 1.08 }),
  players: preset('players', [-.10, .32, -.15], '#a9e9f6', '#b9bffc', { x: 82, y: 42, size: .91 }),
  player: preset('player', [.15, .42, .12], '#a9e9f6', '#d6e5fa', { x: 85, y: 35, size: .79, mobileY: 20, mobileSize: .80 }),
  match: preset('match', [.24, -.47, -.46], '#b5edf0', '#e8c9aa', { x: 85, y: 35, size: .77, mobileY: 18, mobileSize: .76 }),
  'next-game': preset('next-game', [-.24, .12, -.10], '#b7f0db', '#b8d9f6', { x: 82, y: 40, size: .94 }),
  notebook: preset('notebook', [.18, -.54, .20], '#d3c4fa', '#a4dae8', { x: 85, y: 38, size: .81, mobileY: 20, mobileSize: .86 }),
  champions: preset('champions', [-.15, .44, -.30], '#b4ecf2', '#d2b9f3', { x: 84, y: 38, size: .90 }),
  champion: preset('champion', [.24, -.55, -.21], '#c4ddf6', '#c7bbf7', { x: 91, y: 38, size: .88, mobileX: 98, mobileSize: .86 }),
  patches: preset('patches', [.17, .57, .27], '#d1d9ff', '#a4e7e7', { x: 84, y: 38, size: .89 }),
  patch: preset('patch', [.30, .62, .36], '#c4d9f3', '#aee8ec', { x: 87, y: 35, size: .82, mobileSize: .87 }),
  compare: preset('compare', [-.22, .69, -.35], '#c9c0f4', '#b1e3eb', { x: 86, y: 38, size: .86, mobileSize: .90 }),
  pool: preset('pool', [.10, -.40, .15], '#c7bdf5', '#afe6e6', { x: 85, y: 38, size: .84, mobileSize: .88 }),
  missing: preset('missing', [-.10, -.24, -.40], '#badce9', '#c4b9e8', { x: 80, size: .98 }),
};

export function getRiftPreset(surface: string | null | undefined): RiftPreset {
  return surface && Object.hasOwn(riftScenePresets, surface)
    ? riftScenePresets[surface as RiftSurface]
    : riftScenePresets.missing;
}

export interface RiftFace {
  points: Vec3[];
  normal: Vec3;
  material: number;
  seed: number;
}

export interface ProjectedRiftFace {
  index: number;
  points: string;
  fill: string;
  depth: number;
  luminous: boolean;
  gradient: string[];
}

export const RIFT_DISTANCE = 6;
const TAU = Math.PI * 2;
const sub = (a: Vec3, b: Vec3): Vec3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const dot = (a: Vec3, b: Vec3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a: Vec3, b: Vec3): Vec3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const normalized = (v: Vec3): Vec3 => {
  const length = Math.hypot(...v) || 1;
  return [v[0] / length, v[1] / length, v[2] / length];
};

function face(points: Vec3[], material: number, seed: number): RiftFace {
  return { points, material, seed, normal: normalized(cross(sub(points[1]!, points[0]!), sub(points[2]!, points[0]!))) };
}

function ringPoint(angle: number, radius: number, z: number): Vec3 {
  return [Math.cos(angle) * radius * .86, Math.sin(angle) * radius * 1.07, z];
}

/** A beveled, slightly irregular annular shard. No two slabs share a silhouette. */
function arcShard(start: number, end: number, seed: number): RiftFace[] {
  const faces: RiftFace[] = [];
  const radius = 1.54 + Math.sin(seed * 7.1) * .085;
  const thickness = .26 + (Math.sin(seed * 4.6) + 1) * .085;
  const offset = Math.sin(seed * 2.7) * .075;
  const front = .22 + Math.sin(seed * 4.3) * .10;
  const back = front - .36 - (seed % 3) * .055;
  const angles = [start, (start + end) * .5, end];
  const outer = angles.map((angle, index) => ringPoint(angle, radius + (index === 1 ? .055 : 0), front));
  const inner = [...angles].reverse().map(angle => ringPoint(angle, radius - thickness, front));
  const outline = [...outer, ...inner].map(([x, y, z]): Vec3 => [x, y, z + offset]);
  const center: Vec3 = [
    outline.reduce((sum, p) => sum + p[0], 0) / outline.length,
    outline.reduce((sum, p) => sum + p[1], 0) / outline.length,
    front + offset + .025,
  ];
  const inset = outline.map(([x, y, z]): Vec3 => [
    center[0] + (x - center[0]) * .90,
    center[1] + (y - center[1]) * .90,
    z + .045,
  ]);
  const rear = outline.map(([x, y]): Vec3 => [x * .985, y * .985, back + offset]);

  // Front planes, a broad bevel, and deep side walls retain their individual
  // normals, so the resting sculpture already has a readable physical form.
  for (let i = 0; i < outline.length; i++) {
    const next = (i + 1) % outline.length;
    faces.push(face([center, inset[i]!, inset[next]!], 0, seed));
    faces.push(face([inset[i]!, outline[i]!, outline[next]!, inset[next]!], 1, seed));
    faces.push(face([outline[i]!, rear[i]!, rear[next]!, outline[next]!], i >= 3 && i < 5 ? 2 : 0, seed));
  }
  faces.push(face([...rear].reverse(), 0, seed));

  // Light lives in the exposed inner fracture, rather than a decorative ring
  // drawn over the object. Each segment has different length and thickness.
  const edgeRadius = radius - thickness - .009;
  const edgeStart = start + .018;
  const edgeEnd = end - .021;
  for (let part = 0; part < 2; part++) {
    const a = edgeStart + (edgeEnd - edgeStart) * part / 2;
    const b = edgeStart + (edgeEnd - edgeStart) * (part + 1) / 2;
    faces.push(face([
      ringPoint(a, edgeRadius, front + offset + .026),
      ringPoint(b, edgeRadius, front + offset + .026),
      ringPoint(b, edgeRadius - .017, front + offset + .028),
      ringPoint(a, edgeRadius - .017, front + offset + .028),
    ], 3, seed));
  }
  return faces;
}

function splinter(position: Vec3, size: Vec3, rotation: number, seed: number): RiftFace[] {
  const local: Vec3[] = [
    [-.45, -.4, -.3], [.34, -.6, -.15], [.55, .28, -.2],
    [.04, .79, .05], [-.4, .16, .2], [.13, .04, .52],
  ];
  const points = local.map(([x, y, z]): Vec3 => [
    position[0] + (x * Math.cos(rotation) - y * Math.sin(rotation)) * size[0],
    position[1] + (x * Math.sin(rotation) + y * Math.cos(rotation)) * size[1],
    position[2] + z * size[2],
  ]);
  const triangles = [[0, 1, 5], [1, 2, 5], [2, 3, 5], [3, 4, 5], [4, 0, 5], [0, 4, 3], [0, 3, 2], [0, 2, 1]];
  return triangles.map((indices, index) => face(indices.map(i => points[i]!), index === 2 ? 1 : 0, seed));
}

function createSculpture(): RiftFace[] {
  const spans = [
    [-65, -40], [-34, -9], [-4, 20], [26, 47], [53, 75], [82, 103],
    [128, 151], [157, 181], [187, 210], [217, 239], [245, 265],
  ];
  const faces = spans.flatMap(([start, end], index) => arcShard(start! * TAU / 360, end! * TAU / 360, index + 1));
  const satellites: [Vec3, Vec3, number][] = [
    [[1.57, .90, .32], [.20, .32, .22], -.5],
    [[1.58, .42, -.48], [.10, .24, .14], -.1],
    [[.49, 1.93, -.20], [.14, .30, .16], .7],
    [[-.65, 1.84, .42], [.12, .24, .18], -.8],
    [[-1.53, .78, -.22], [.12, .25, .18], .5],
    [[-1.57, -.62, .46], [.16, .38, .16], -.5],
    [[-.77, -1.85, -.30], [.15, .22, .18], -.7],
    [[.53, -1.88, .55], [.21, .44, .20], .3],
    [[1.46, -1.14, -.42], [.09, .21, .18], .6],
  ];
  satellites.forEach(([position, size, rotation], index) => faces.push(...splinter(position, size, rotation, index + 21)));
  return faces;
}

export const riftFaces: readonly RiftFace[] = createSculpture();

/** Column-major rotation; both renderers use precisely the same transform. */
export function riftRotation([x, y, z]: Vec3): Float32Array {
  const cx = Math.cos(x), sx = Math.sin(x);
  const cy = Math.cos(y), sy = Math.sin(y);
  const cz = Math.cos(z), sz = Math.sin(z);
  return new Float32Array([
    cy * cz, cy * sz, -sy,
    sx * sy * cz - cx * sz, sx * sy * sz + cx * cz, sx * cy,
    cx * sy * cz + sx * sz, cx * sy * sz - sx * cz, cx * cy,
  ]);
}

export function rotateRiftPoint(point: Vec3, matrix: ArrayLike<number>): Vec3 {
  return [
    matrix[0]! * point[0] + matrix[3]! * point[1] + matrix[6]! * point[2],
    matrix[1]! * point[0] + matrix[4]! * point[1] + matrix[7]! * point[2],
    matrix[2]! * point[0] + matrix[5]! * point[1] + matrix[8]! * point[2],
  ];
}

export function riftColor(hex: string): Vec3 {
  return [parseInt(hex.slice(1, 3), 16) / 255, parseInt(hex.slice(3, 5), 16) / 255, parseInt(hex.slice(5, 7), 16) / 255];
}

function lightFace(normal: Vec3, position: Vec3, material: number, seed: number, colors: readonly [Vec3, Vec3]): string {
  const [accent, secondary] = colors;
  const blend = (Math.sin(seed * 2.3) + 1) * .5;
  const tint = accent.map((value, index) => value * (1 - blend * .35) + secondary[index]! * blend * .35);
  if (material === 3) return `rgb(${tint.map(value => Math.round(Math.min(1, value * 1.20) * 255)).join(' ')})`;
  const light = normalized([-.7, 1.6, 2.8]);
  const fill = normalized([1.8, -.3, .4]);
  const view = normalized([-position[0], -position[1], RIFT_DISTANCE - position[2]]);
  const half = normalized([light[0] + view[0], light[1] + view[1], light[2] + view[2]]);
  const diffuse = Math.max(0, dot(normal, light));
  const edge = Math.pow(1 - Math.max(0, dot(normal, view)), 2.7);
  const specular = Math.pow(Math.max(0, dot(normal, half)), material === 1 ? 25 : 52);
  const grazing = Math.max(0, dot(normal, fill));
  const reflected = normal.map((value, index) => 2 * dot(normal, view) * value - view[index]!);
  // A broad cold light source and one narrow reflected horizon give polished
  // obsidian a readable sheen without making its large faces uniformly grey.
  const reflection = Math.exp(-Math.pow((reflected[1]! - .19) * 12, 2)) * .24
    + Math.exp(-Math.pow((reflected[1]! + .35) * 18, 2)) * .10;
  const base = material === 1 ? .038 : material === 2 ? .017 : .011;
  const energy = base + diffuse * (material === 1 ? .12 : .03) + specular * (material === 1 ? .70 : .42);
  const color = tint.map((value, index) => {
    const channel = energy * (index === 0 ? .64 : index === 1 ? .78 : 1)
      + value * (edge * (material === 1 ? .26 : .13) + grazing * .025 + reflection + (material === 2 ? .035 : 0));
    return Math.round(Math.min(1, Math.max(0, channel)) * 255);
  });
  return `rgb(${color.join(' ')})`;
}

/** A depth-sorted SVG is complete, legible scenery before any browser script. */
export function projectRift(preset: RiftPreset): ProjectedRiftFace[] {
  const matrix = riftRotation(preset.rotation);
  const colors: readonly [Vec3, Vec3] = [riftColor(preset.accent), riftColor(preset.secondary)];
  return riftFaces.map((face, index) => {
    const points = face.points.map(point => rotateRiftPoint(point, matrix));
    const normal = rotateRiftPoint(face.normal, matrix);
    const center: Vec3 = [
      points.reduce((sum, p) => sum + p[0], 0) / points.length,
      points.reduce((sum, p) => sum + p[1], 0) / points.length,
      points.reduce((sum, p) => sum + p[2], 0) / points.length,
    ];
    const minY = Math.min(...points.map(point => point[1]));
    const maxY = Math.max(...points.map(point => point[1]));
    const width = Math.max(...points.map(point => point[0])) - Math.min(...points.map(point => point[0]));
    return {
      index,
      points: points.map(([x, y, z]) => {
        const scale = 1000 * preset.focal / (RIFT_DISTANCE - z);
        return `${(500 + x * scale).toFixed(2)},${(500 - y * scale).toFixed(2)}`;
      }).join(' '),
      depth: center[2],
      fill: lightFace(normal, center, face.material, face.seed, colors),
      luminous: face.material === 3,
      gradient: [0, .28, .50, .72, 1].map(step => lightFace(normal,
        [center[0] + (step - .5) * width * .40, maxY - (maxY - minY) * step, center[2]],
        face.material, face.seed, colors)),
      facing: dot(normal, normalized([-center[0], -center[1], RIFT_DISTANCE - center[2]])),
    };
  }).filter(face => face.facing > -.02 || face.luminous).sort((a, b) => a.depth - b.depth);
}

/** Interleaved position / normal / material / shard seed. */
export function riftVertexData(): Float32Array {
  const vertices: number[] = [];
  for (const face of riftFaces) {
    for (let i = 1; i < face.points.length - 1; i++) {
      for (const point of [face.points[0]!, face.points[i]!, face.points[i + 1]!]) {
        vertices.push(...point, ...face.normal, face.material, face.seed);
      }
    }
  }
  return new Float32Array(vertices);
}
