import * as THREE from 'three';

type Point = [number, number, number];

function roundedRoute(points: Point[]) {
  const route = new THREE.CurvePath<THREE.Vector3>();
  const vertices = points.map(p => new THREE.Vector3(...p));
  let previous = vertices[0]!;
  for (let i = 1; i < vertices.length - 1; i++) {
    const corner = vertices[i]!;
    const before = corner.clone().lerp(vertices[i - 1]!, .12);
    const after = corner.clone().lerp(vertices[i + 1]!, .12);
    route.add(new THREE.LineCurve3(previous, before));
    route.add(new THREE.QuadraticBezierCurve3(before, corner, after));
    previous = after;
  }
  route.add(new THREE.LineCurve3(previous, vertices.at(-1)!));
  return route;
}

export function createJourneyPath(portrait = false) {
  const poses: Point[] = [[portrait ? 0 : 4, 3, portrait ? 17 : 13], [portrait ? 0 : 4, 3, portrait ? -11 : -15], [portrait ? 14 : 20, 5, portrait ? -37 : -41], [14, -5, -76], [portrait ? 0 : 4, 7, portrait ? -95 : -99]];
  // Route through apertures and around the comparison platform before descending.
  // Rounded corners stay inside their waypoint hull, unlike an overshooting spline.
  const routes = [
    roundedRoute([poses[0]!, [0, 1.4, 3], [0, 1.4, -3], [0, 4, -8], poses[1]!]),
    roundedRoute([poses[1]!, [0, 5, -20], [0, 5, -35], [20, 7, -38], poses[2]!]),
    roundedRoute([poses[2]!, [27, 7, -43], [27, 7, -75], [27, -5, -76], poses[3]!]),
    roundedRoute([poses[3]!, [14, -5, -101], [14, 7, -101], poses[4]!]),
  ];
  return {
    sample(position: number, out: THREE.Vector3) {
      const p = THREE.MathUtils.clamp(position, 0, 4);
      const segment = Math.min(3, Math.floor(p));
      const t = p - segment;
      const eased = t * t * (3 - 2 * t);
      return routes[segment]!.getPointAt(eased, out);
    },
    guide(position: number, destination: number, out: THREE.Vector3) {
      const direction = Math.sign(destination - position);
      return this.sample(position + direction * Math.min(.12, Math.abs(destination - position)), out);
    },
  };
}
