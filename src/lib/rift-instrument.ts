/** An original relief atlas. Its geography is illustrative, never live game data. */
export interface RiftInstrumentOptions {
  width: number;
  height: number;
  progress: number;
  lookX: number;
  lookY: number;
  focus: number;
  reduced: boolean;
}

type Point = readonly [x: number, y: number, z: number];
type ScreenPoint = readonly [x: number, y: number, depth: number];
type Face = { indices: number[]; normal: Point; center: Point; material: number; tone: number };
type Stroke = readonly [Point, Point];
type Pose = { yaw: number; elevation: number; scale: number; x: number; y: number; opacity: number };

const TAU = Math.PI * 2;
const clamp = (value: number, low: number, high: number) => Math.max(low, Math.min(high, Number.isFinite(value) ? value : low));
const mix = (a: number, b: number, t: number) => a + (b - a) * t;
const smooth = (t: number) => t * t * (3 - 2 * t);
const riverAt = (x: number) => .66 * x + Math.sin(x * 5.8) * .075 - Math.sin(x * 13) * .014;

function terrain(x: number, z: number): number {
  const radius = Math.hypot(x, z);
  const shore = Math.abs(z - riverAt(x));
  const hills = Math.sin(x * 5.4 + .8) * Math.cos(z * 6.1 - .9) * .043
    + Math.sin(x * 12.4 + z * 6.8) * .014
    + Math.cos(x * 19.2 - z * 11.1) * .006;
  const ridge = Math.exp(-Math.pow((z + x * .18 - .34) * 4.8, 2)) * .14
    + Math.exp(-Math.pow((z + x * .1 + .49) * 6.5, 2)) * .1;
  const bank = smooth(clamp((shore - .026) / .17, 0, 1));
  const edge = smooth(clamp((1.025 - radius) / .2, 0, 1));
  return .015 + Math.max(0, .055 + hills + ridge) * bank * (.5 + edge * .5);
}

function normal(a: Point, b: Point, c: Point): Point {
  const u = [b[0] - a[0], b[1] - a[1], b[2] - a[2]];
  const v = [c[0] - a[0], c[1] - a[1], c[2] - a[2]];
  let x = u[1]! * v[2]! - u[2]! * v[1]!;
  let y = u[2]! * v[0]! - u[0]! * v[2]!;
  let z = u[0]! * v[1]! - u[1]! * v[0]!;
  const length = Math.hypot(x, y, z) || 1;
  x /= length; y /= length; z /= length;
  return [x, y, z];
}

const vertices: Point[] = [];
const faces: Face[] = [];
const contours: Stroke[] = [];
const addVertex = (point: Point) => vertices.push(point) - 1;
function addFace(indices: number[], material: number, tone = 0) {
  const points = indices.map(index => vertices[index]!);
  faces.push({ indices, material, tone, normal: normal(points[0]!, points[1]!, points[2]!), center: [
    points.reduce((n, point) => n + point[0], 0) / points.length,
    points.reduce((n, point) => n + point[1], 0) / points.length,
    points.reduce((n, point) => n + point[2], 0) / points.length,
  ] });
}

// Geometry and contour intersections are authored once; frames only project it.
const sectors = 96;
const rings = 25;
addVertex([0, terrain(0, 0), 0]);
for (let row = 1; row <= rings; row++) {
  for (let column = 0; column < sectors; column++) {
    const angle = column / sectors * TAU;
    const radius = row / rings * (1 + Math.sin(angle * 7) * .009 + Math.sin(angle * 13 + .4) * .005);
    const x = Math.cos(angle) * radius, z = Math.sin(angle) * radius;
    addVertex([x, terrain(x, z), z]);
  }
}
const terrainIndex = (row: number, column: number) => row === 0 ? 0 : 1 + (row - 1) * sectors + (column + sectors) % sectors;
for (let row = 1; row <= rings; row++) {
  for (let column = 0; column < sectors; column++) {
    const a = terrainIndex(row, column), b = terrainIndex(row, column + 1);
    const c = terrainIndex(row - 1, column), d = terrainIndex(row - 1, column + 1);
    addFace([a, c, b], 0, Math.sin(column * 8.7 + row * 4.2));
    if (row > 1) addFace([b, c, d], 0, Math.sin(column * 8.7 + row * 4.2 + 1));
  }
}

for (const face of faces) {
  const points = face.indices.map(index => vertices[index]!);
  for (const level of [.055, .085, .115, .145, .175, .205, .235]) {
    const crossings: Point[] = [];
    for (let edge = 0; edge < 3; edge++) {
      const a = points[edge]!, b = points[(edge + 1) % 3]!;
      if ((a[1] < level) === (b[1] < level)) continue;
      const t = (level - a[1]) / (b[1] - a[1]);
      crossings.push([mix(a[0], b[0], t), level + .0015, mix(a[2], b[2], t)]);
    }
    if (crossings.length === 2) contours.push([crossings[0]!, crossings[1]!]);
  }
}

// A cut stone edge, recessed metal band, and a fine bevel give the atlas weight.
const edgeBands = [
  { radius: 1.005, y: -.009 },
  { radius: 1.045, y: -.035 },
  { radius: 1.11, y: -.038 },
  { radius: 1.135, y: -.065 },
  { radius: 1.132, y: -.15 },
  { radius: 1.09, y: -.19 },
];
const rimStart = vertices.length;
for (const band of edgeBands) for (let column = 0; column < sectors; column++) {
  const angle = column / sectors * TAU;
  addVertex([Math.cos(angle) * band.radius, band.y, Math.sin(angle) * band.radius]);
}
for (let band = 0; band < edgeBands.length - 1; band++) for (let column = 0; column < sectors; column++) {
  const next = (column + 1) % sectors;
  const a = rimStart + band * sectors + column, b = rimStart + band * sectors + next;
  const c = rimStart + (band + 1) * sectors + column, d = rimStart + (band + 1) * sectors + next;
  addFace([a, b, d, c], band === 1 ? 1 : band === 2 ? 2 : 3, Math.sin(column * 3.7) * .5);
}

// The river is part of the depth-sorted surface, so hills can occlude it.
for (let segment = 0; segment < 120; segment++) {
  const x = -.849 + segment / 120 * 1.698, nextX = -.849 + (segment + 1) / 120 * 1.698;
  const half = .011 + Math.sin(segment * .17) * .004;
  const a = addVertex([x, .019, riverAt(x) - half]);
  const b = addVertex([x, .019, riverAt(x) + half]);
  const c = addVertex([nextX, .019, riverAt(nextX) + half]);
  const d = addVertex([nextX, .019, riverAt(nextX) - half]);
  addFace([a, b, c, d], 4, Math.sin(segment * .28));
}

const poses: readonly Pose[] = [
  { yaw: -.48, elevation: .83, scale: 1, x: .73, y: .51, opacity: 1 },
  { yaw: .12, elevation: .65, scale: 1.12, x: .79, y: .57, opacity: .62 },
  { yaw: .84, elevation: 1.0, scale: 1.2, x: .79, y: .51, opacity: .72 },
  { yaw: 1.42, elevation: .78, scale: .97, x: .75, y: .51, opacity: .9 },
];

function poseAt(progress: number): Pose {
  const p = clamp(progress, 0, 3), index = Math.min(2, Math.floor(p));
  const a = poses[index]!, b = poses[index + 1]!, t = smooth(p - index);
  return { yaw: mix(a.yaw, b.yaw, t), elevation: mix(a.elevation, b.elevation, t), scale: mix(a.scale, b.scale, t), x: mix(a.x, b.x, t), y: mix(a.y, b.y, t), opacity: mix(a.opacity, b.opacity, t) };
}

export function drawRiftInstrument(ctx: CanvasRenderingContext2D, options: RiftInstrumentOptions): void {
  const width = clamp(options.width, 0, 16384), height = clamp(options.height, 0, 16384);
  if (!width || !height) return;
  const pose = poseAt(options.progress), mobile = width < 700;
  const lookX = options.reduced ? 0 : clamp(options.lookX, -.5, .5);
  const lookY = options.reduced ? 0 : clamp(options.lookY, -.5, .5);
  const yaw = pose.yaw + lookX * .18, elevation = pose.elevation + lookY * .1;
  const sy = Math.sin(yaw), cy = Math.cos(yaw), se = Math.sin(elevation), ce = Math.cos(elevation);
  const scale = (mobile ? Math.min(width * .43, height * .49) : Math.min(width * .255, height * .57)) * pose.scale;
  const centerX = width * (mobile ? .55 + (pose.x - .73) * .32 : pose.x);
  const centerY = height * (mobile ? .68 + (pose.y - .51) * .35 : pose.y);
  const project = ([x, y, z]: Point): ScreenPoint => {
    const rx = x * cy - z * sy, rz = x * sy + z * cy;
    const depth = rz * ce + y * se;
    const perspective = 5.8 / (5.8 - depth);
    return [centerX + rx * scale * perspective, centerY + (rz * se - y * ce) * scale * perspective, depth];
  };
  const line = (a: Point, b: Point) => {
    const start = project(a), end = project(b);
    ctx.moveTo(start[0], start[1]); ctx.lineTo(end[0], end[1]);
  };
  const circle = (radius: number, y: number, start = 0, end = TAU) => {
    for (let step = 0; step <= 160; step++) {
      const angle = mix(start, end, step / 160);
      const point = project([Math.cos(angle) * radius, y, Math.sin(angle) * radius]);
      if (!step) ctx.moveTo(point[0], point[1]); else ctx.lineTo(point[0], point[1]);
    }
  };

  ctx.save();
  ctx.globalAlpha = pose.opacity;
  // A narrow pool of reflected light supports the object without a glowing halo.
  ctx.save();
  ctx.translate(centerX, centerY + scale * .31); ctx.scale(1, .26);
  const shadow = ctx.createRadialGradient(0, 0, scale * .25, 0, 0, scale * 1.5);
  shadow.addColorStop(0, 'rgba(0,0,0,.72)'); shadow.addColorStop(.65, 'rgba(0,0,0,.28)'); shadow.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = shadow; ctx.fillRect(-scale * 1.6, -scale * 1.6, scale * 3.2, scale * 3.2);
  ctx.restore();

  // The detached measuring arc is an instrument detail, not another content layer.
  ctx.beginPath(); circle(1.32, -.135, -.15, Math.PI * 1.04);
  ctx.strokeStyle = 'rgba(160,153,117,.27)'; ctx.lineWidth = .75; ctx.stroke();
  ctx.beginPath(); circle(1.335, -.14, Math.PI * 1.10, TAU - .2);
  ctx.strokeStyle = 'rgba(160,153,117,.12)'; ctx.stroke();
  ctx.beginPath();
  for (let tick = 0; tick < 72; tick++) {
    const a = tick / 72 * TAU, length = tick % 6 === 0 ? .055 : .018;
    line([Math.cos(a) * 1.32, -.135, Math.sin(a) * 1.32], [Math.cos(a) * (1.32 + length), -.135, Math.sin(a) * (1.32 + length)]);
  }
  ctx.strokeStyle = 'rgba(180,174,145,.2)'; ctx.lineWidth = .65; ctx.stroke();

  const projected = vertices.map(project);
  const ordered = faces.map(face => ({ face, depth: project(face.center)[2] })).sort((a, b) => a.depth - b.depth);
  for (const { face } of ordered) {
    const n = face.normal;
    const nx = n[0] * cy - n[2] * sy, nz = n[0] * sy + n[2] * cy;
    const diffuse = Math.max(0, -nx * .38 + Math.abs(n[1]) * .78 - nz * .47);
    const light = .32 + diffuse * .7;
    let red: number, green: number, blue: number;
    if (face.material === 4) {
      red = 97 + face.tone * 16; green = 169 + face.tone * 19; blue = 155 + face.tone * 18;
    } else if (face.material === 0) {
      const heightTone = clamp(face.center[1] * 1.8, 0, .5);
      red = (43 + heightTone * 71 + face.tone * 1.7) * light;
      green = (65 + heightTone * 67 + face.tone * 1.6) * light;
      blue = (62 + heightTone * 49 + face.tone * 1.5) * light;
    } else if (face.material === 1) {
      red = 78 * light; green = 78 * light; blue = 66 * light;
    } else if (face.material === 2) {
      red = 110 * light; green = 110 * light; blue = 89 * light;
    } else {
      const stratum = face.tone * 3;
      red = (26 + stratum) * light; green = (35 + stratum) * light; blue = (34 + stratum) * light;
    }
    ctx.beginPath();
    face.indices.forEach((index, i) => {
      const point = projected[index]!;
      if (!i) ctx.moveTo(point[0], point[1]); else ctx.lineTo(point[0], point[1]);
    });
    ctx.closePath();
    ctx.fillStyle = `rgb(${Math.round(red)} ${Math.round(green)} ${Math.round(blue)})`;
    ctx.fill();
    // Fill subpixel seams without turning the heightfield into a wireframe.
    if (face.material !== 4) { ctx.strokeStyle = ctx.fillStyle; ctx.lineWidth = .45; ctx.stroke(); }
  }

  ctx.beginPath(); contours.forEach(([a, b]) => line(a, b));
  ctx.strokeStyle = 'rgba(185,201,173,.19)'; ctx.lineWidth = .6; ctx.stroke();

  ctx.beginPath(); circle(1.087, -.036); circle(1.116, -.048);
  ctx.strokeStyle = 'rgba(194,183,140,.38)'; ctx.lineWidth = .65; ctx.stroke();
  ctx.beginPath();
  for (let tick = 0; tick < 120; tick++) {
    const angle = tick / 120 * TAU, inner = tick % 10 === 0 ? 1.047 : tick % 5 === 0 ? 1.059 : 1.073;
    line([Math.cos(angle) * inner, -.034, Math.sin(angle) * inner], [Math.cos(angle) * 1.086, -.034, Math.sin(angle) * 1.086]);
  }
  ctx.strokeStyle = 'rgba(205,196,159,.62)'; ctx.lineWidth = .7; ctx.stroke();

  // Engraved crossing lines catch light on the front-facing stone edge.
  ctx.beginPath();
  circle(1.13, -.105, -yaw + .05, -yaw + Math.PI - .05);
  circle(1.125, -.132, -yaw + .08, -yaw + Math.PI - .08);
  ctx.strokeStyle = 'rgba(161,182,164,.16)'; ctx.lineWidth = .8; ctx.stroke();

  const marks: readonly (readonly [number, number])[] = [[-.48, -.54], [.39, .48], [.08, -.47]];
  const focus = Math.round(clamp(options.focus, 0, 2));
  marks.forEach(([x, z], index) => {
    const y = terrain(x, z) + .012, active = index === focus;
    const radius = active ? .053 : .028;
    ctx.beginPath();
    for (let step = 0; step <= 48; step++) {
      const angle = step / 48 * TAU;
      const point = project([x + Math.cos(angle) * radius, y, z + Math.sin(angle) * radius]);
      if (!step) ctx.moveTo(point[0], point[1]); else ctx.lineTo(point[0], point[1]);
    }
    ctx.strokeStyle = active ? 'rgba(225,216,176,.86)' : 'rgba(182,197,177,.5)';
    ctx.lineWidth = active ? 1 : .7; ctx.stroke();
    const point = project([x, y, z]);
    ctx.beginPath(); ctx.arc(point[0], point[1], active ? 2 : 1.2, 0, TAU);
    ctx.fillStyle = active ? '#d9e8cf' : '#9aaea0'; ctx.fill();
    if (active) {
      ctx.beginPath(); line([x, y + .02, z], [x, y + .18, z]);
      ctx.strokeStyle = 'rgba(204,225,201,.45)'; ctx.lineWidth = .65; ctx.stroke();
      const cap = project([x, y + .185, z]);
      ctx.beginPath(); ctx.moveTo(cap[0], cap[1] - 3); ctx.lineTo(cap[0] + 3, cap[1]); ctx.lineTo(cap[0], cap[1] + 3); ctx.lineTo(cap[0] - 3, cap[1]); ctx.closePath();
      ctx.fillStyle = '#d9dfbb'; ctx.fill();
    }
  });
  ctx.restore();
}
