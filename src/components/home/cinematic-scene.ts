import * as T from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import { cameraPose } from "./cinematic-path";

export async function buildScene(
  host: HTMLElement,
  champion: string,
  reduced: boolean,
) {
  const steel = champion === "rule";
  const renderer = new T.WebGLRenderer({
    antialias: true,
    alpha: false,
    powerPreference: "high-performance",
  });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
  renderer.outputColorSpace = T.SRGBColorSpace;
  renderer.toneMapping = T.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.15;
  host.appendChild(renderer.domElement);
  const scene = new T.Scene();
  scene.background = new T.Color("#17150f");
  scene.fog = new T.FogExp2("#292419", 0.018);
  const camera = new T.PerspectiveCamera(40, 1, 0.1, 180);
  const materials: T.Material[] = [];
  const stone = new T.MeshPhongMaterial({
    color: "#6d5e43",
    shininess: 5,
    specular: "#29251e",
  });
  const dark = new T.MeshPhongMaterial({
    color: "#24231e",
    shininess: 28,
    specular: "#464d4b",
  });
  const brass = new T.MeshPhongMaterial({
    color: "#ad8950",
    shininess: 50,
    specular: "#ccb38b",
  });
  const glow = new T.MeshBasicMaterial({ color: "#e5b665" });
  materials.push(stone, dark, brass, glow);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = T.PCFSoftShadowMap;
  const surface = await new T.TextureLoader().loadAsync(
    steel ? "/images/incision/steel.webp" : "/images/cinematic/sandstone.png",
  );
  surface.colorSpace = T.SRGBColorSpace;
  surface.wrapS = surface.wrapT = T.RepeatWrapping;
  surface.repeat.set(0.35, 0.35);
  stone.map = surface;
  stone.bumpMap = surface;
  stone.bumpScale = 0.13;
  stone.color.set("#b1a18a");
  const floorMaterial = stone.clone();
  const floorTexture = surface.clone();
  floorTexture.repeat.set(32, 32);
  floorTexture.needsUpdate = true;
  floorMaterial.map = floorTexture;
  floorMaterial.bumpMap = floorTexture;
  materials.push(floorMaterial);
  const add = (
    geometry: T.BufferGeometry,
    material: T.Material,
    x = 0,
    y = 0,
    z = 0,
    rx = 0,
    ry = 0,
    rz = 0,
  ) => {
    const mesh = new T.Mesh(geometry, material);
    mesh.position.set(x, y, z);
    mesh.rotation.set(rx, ry, rz);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    scene.add(mesh);
    return mesh;
  };
  const sunlight = new T.DirectionalLight("#ffe0a2", 2.8);
  sunlight.position.set(-9, 18, 8);
  sunlight.castShadow = true;
  sunlight.shadow.mapSize.set(1024, 1024);
  sunlight.shadow.camera.left = -25;
  sunlight.shadow.camera.right = 25;
  sunlight.shadow.camera.top = 25;
  sunlight.shadow.camera.bottom = -25;
  sunlight.shadow.bias = -0.001;
  scene.add(sunlight);
  scene.add(new T.HemisphereLight("#e3d3b5", "#25221c", 1.3));
  const rim = new T.PointLight("#e9ad52", 35, 35, 2);
  rim.position.set(7, 7, -10);
  scene.add(rim);
  if (steel) {
    scene.background = new T.Color("#102023");
    scene.fog = new T.FogExp2("#23383b", 0.022);
    stone.color.set("#4f7378");
    stone.shininess = 38;
    stone.specular.set("#76969a");
    brass.color.set("#77aeb4");
    glow.color.set("#8de2e7");
    sunlight.color.set("#b6e2ed");
    rim.color.set("#6bbecb");
    add(new T.BoxGeometry(15, 0.55, 24), dark, 0, -0.7, -5);
    for (let i = 0; i < 12; i++) {
      const z = 8 - i * 2.5;
      for (const side of [-1, 1]) {
        const x = side * (8.5 + Math.sin(i * 0.7) * 0.8);
        const fin = new T.Shape();
        fin.moveTo(0, 0);
        fin.lineTo(1.4, 0);
        fin.lineTo(2.2, 14);
        fin.lineTo(0.5, 16);
        fin.lineTo(-0.35, 11);
        fin.closePath();
        add(
          new T.ExtrudeGeometry(fin, {
            depth: 0.4,
            bevelEnabled: true,
            bevelSize: 0.06,
            bevelThickness: 0.05,
            bevelSegments: 2,
            steps: 1,
          }),
          stone,
          x,
          -0.5,
          z,
          0,
          side * 0.2,
          side * -0.08,
        );
        add(new T.BoxGeometry(0.04, 0.025, 2), glow, side * 6, 0.01, z);
        add(
          new T.CylinderGeometry(0.025, 0.025, 16, 6),
          brass,
          side * 7,
          7,
          z,
          0,
          0,
          side * 0.2,
        );
        for (let k = 0; k < 3; k++)
          add(new T.BoxGeometry(0.8, 0.05, 0.12), brass, x, 2 + k * 2, z + 0.5);
      }
      add(new T.BoxGeometry(15, 0.025, 0.04), brass, 0, -0.4, z);
    }
    for (let i = 0; i < 16; i++) {
      const x = (i - 8) * 3.5,
        h = 8 + (i % 5) * 2;
      add(new T.BoxGeometry(2, h, 4), dark, x, h / 2 - 6, -38 - (i % 3) * 4);
      for (let j = 0; j < 4; j++)
        add(
          new T.BoxGeometry(0.08, 1.4, 0.03),
          glow,
          x + 0.3 * (j - 2),
          h / 2 - 2,
          -35.98 - (i % 3) * 4,
        );
    }
  } else {
    add(new T.PlaneGeometry(180, 180), floorMaterial, 0, -0.8, 0, -Math.PI / 2);
    const relief = new T.PlaneGeometry(160, 50, 100, 40);
    const points = relief.attributes.position!;
    for (let i = 0; i < points.count; i++) {
      const x = points.getX(i),
        y = points.getY(i);
      points.setZ(
        i,
        3 +
          Math.sin(x * 0.14 + y * 0.08) * 2 +
          Math.sin(x * 0.31 - y * 0.18) * 0.8,
      );
    }
    relief.computeVertexNormals();
    add(relief, floorMaterial, 0, -0.5, -48, -Math.PI / 2);
    for (const side of [-1, 1])
      for (let j = 0; j < 5; j++) {
        const height = 12 + j * 0.8;
        add(
          new T.BoxGeometry(1.7, height, 2.3),
          stone,
          side * (14 + j * 1.7),
          height / 2 - 1,
          -18 - j * 4,
          0,
          side * 0.15,
        );
        add(
          new T.BoxGeometry(2, height * 0.03, 2.5),
          brass,
          side * (14 + j * 1.7),
          height * 0.7,
          -18 - j * 4,
          0,
          side * 0.15,
        );
      }
    for (let i = 0; i < 5; i++) {
      add(
        new T.CylinderGeometry(
          9 + i * 2.2,
          9.2 + i * 2.2,
          0.22,
          96,
          1,
          false,
          0,
          Math.PI * 2,
        ),
        i % 2 ? dark : stone,
        0,
        -0.6 + i * 0.13,
        -8,
      );
      add(
        new T.TorusGeometry(9 + i * 2.2, 0.027, 6, 128),
        brass,
        0,
        -0.46 + i * 0.13,
        -8,
        Math.PI / 2,
      );
    }
    for (let j = 0; j < 3; j++) {
      const radius = 8.8 + j * 2.5;
      for (let i = 0; i < 30; i++) {
        const a = (i / 30) * Math.PI + 0.004,
          b = ((i + 1) / 30) * Math.PI - 0.004;
        const shape = new T.Shape();
        shape.absarc(0, 0, radius, a, b, false);
        shape.lineTo(
          Math.cos(b) * (radius + 1.1),
          Math.sin(b) * (radius + 1.1),
        );
        shape.absarc(0, 0, radius + 1.1, b, a, true);
        shape.closePath();
        add(
          new T.ExtrudeGeometry(shape, {
            depth: 1.2,
            bevelEnabled: true,
            bevelSegments: 2,
            steps: 1,
            bevelSize: 0.04,
            bevelThickness: 0.04,
            curveSegments: 4,
          }),
          stone,
          0,
          -0.4,
          -12 - j * 3,
        );
      }
      add(
        new T.TorusGeometry(radius, 0.055, 8, 96, Math.PI),
        brass,
        0,
        -0.4,
        -12 - j * 3,
      );
    }
    for (let i = 0; i < 40; i++) {
      const a = (i / 40) * Math.PI * 2;
      const m = add(
        new T.BoxGeometry(0.025, 0.012, 5),
        brass,
        Math.sin(a) * 12,
        0.1,
        Math.cos(a) * 12 - 8,
      );
      m.rotation.y = a;
    }
    for (const side of [-1, 1]) {
      for (let i = 0; i < 6; i++) {
        const y = i * 0.8;
        add(
          new T.BoxGeometry(1.2 - i * 0.08, 0.72, 1.3),
          stone,
          side * 8,
          y,
          2 - i * 0.2,
          0,
          side * 0.1,
        );
        add(
          new T.BoxGeometry(1.24 - i * 0.08, 0.035, 1.34),
          brass,
          side * 8,
          y + 0.36,
          2 - i * 0.2,
          0,
          side * 0.1,
        );
      }
      add(new T.BoxGeometry(0.07, 4.6, 0.07), glow, side * 7.5, 2.1, 2.8);
    }
  }
  const steelSurface = await new T.TextureLoader().loadAsync('/images/incision/steel.webp');
  steelSurface.colorSpace=T.SRGBColorSpace;
  const coolMaterial=new T.MeshPhongMaterial({color:'#557e85',map:steelSurface,shininess:45,specular:'#8caeb1'});
  materials.push(coolMaterial);
  for(let i=0;i<4;i++){
    add(new T.BoxGeometry(.3,8+i*.6,1.8),coolMaterial,-10-i*.8,3,-5-i*2,0,-.3,-.15);
    add(new T.BoxGeometry(.3,8+i*.6,1.8),coolMaterial,10+i*.8,3,-5-i*2,0,.3,.15);
  }
  const instrument = new T.Group();
  instrument.position.set(0, 4, -8);
  scene.add(instrument);
  const leafMaterial = brass.clone();
  materials.push(leafMaterial);
  const leaves = Array.from({ length: 3 }, (_, i) => {
    const shape = new T.Shape();
    const a = (i * Math.PI * 2) / 3,
      b = a + (Math.PI * 2) / 3 - 0.12;
    shape.absarc(0, 0, 3.6, a, b, false);
    shape.lineTo(Math.cos(b) * 1.25, Math.sin(b) * 1.25);
    shape.absarc(0, 0, 1.25, b, a, true);
    shape.closePath();
    const leaf = new T.Mesh(
      new T.ExtrudeGeometry(shape, {
        depth: 0.32,
        bevelEnabled: true,
        bevelSize: 0.08,
        bevelThickness: 0.08,
        bevelSegments: 2,
        curveSegments: 24,
      }),
      leafMaterial,
    );
    instrument.add(leaf);
    return leaf;
  });
  const coordinates = new Float32Array(180 * 3);
  for (let i = 0; i < 180; i++) {
    coordinates[i * 3] = Math.sin(i * 173.71) * 20;
    coordinates[i * 3 + 1] = ((i % 41) / 41) * 12;
    coordinates[i * 3 + 2] = Math.cos(i * 29.1) * 23 - 8;
  }
  const dustGeometry = new T.BufferGeometry();
  dustGeometry.setAttribute("position", new T.BufferAttribute(coordinates, 3));
  const dustMaterial = new T.PointsMaterial({
    color: "#e6c681",
    size: 0.035,
    transparent: true,
    opacity: 0.48,
    depthWrite: false,
  });
  materials.push(dustMaterial);
  const dust = new T.Points(dustGeometry, dustMaterial);
  scene.add(dust);
  for (const material of [stone, brass, dark, glow, floorMaterial, coolMaterial]) {
    const meshes = scene.children.filter(
      (o) => o instanceof T.Mesh && o.material === material,
    ) as T.Mesh[];
    if (!meshes.length) continue;
    const geometries = meshes.map((mesh) => {
      mesh.updateMatrix();
      const g = mesh.geometry.index
        ? mesh.geometry.toNonIndexed()
        : mesh.geometry.clone();
      g.applyMatrix4(mesh.matrix);
      return g;
    });
    const merged = mergeGeometries(geometries);
    meshes.forEach((mesh) => {
      scene.remove(mesh);
      mesh.geometry.dispose();
    });
    geometries.forEach((g) => g.dispose());
    if (merged) add(merged, material);
  }
  renderer.shadowMap.autoUpdate = false;
  renderer.shadowMap.needsUpdate = true;
  const directedPosition = new T.Vector3(9, 8, 18);
  let firstDirectedFrame = true;
  let width = 0,
    height = 0;
  function render(
    progress: number,
    time: number,
    arrival: number,
    direction?: {
      beat: number;
      event: number;
      treatment: string;
      focus: number;
      reduced: boolean;
    },
  ) {
    const w = host.clientWidth,
      h = host.clientHeight;
    if (w !== width || h !== height) {
      width = w;
      height = h;
      renderer.setSize(w, h);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    }
    const pose = cameraPose(progress, camera.aspect);
    camera.position.set(...pose.position);
    camera.position.z += arrival;
    camera.lookAt(...pose.target);
    if (direction) {
      const { beat, event, treatment, focus } = direction;
      const k = direction.reduced || firstDirectedFrame ? 1 : 0.075;
      const view =
        beat < 0.5
          ? [9, 8, 18]
          : beat < 1.5
            ? [-8, 6, 12]
            : beat < 2.5
              ? treatment === "rule"
                ? [10, 5, 3]
                : treatment === "mixed"
                  ? [5, 13, 5]
                  : [-5 + Math.min(event, 3) * 3, 6, 5]
              : [9, 9, 19];
      directedPosition.lerp(
        new T.Vector3(...(view as [number, number, number])),
        firstDirectedFrame || direction.reduced ? 1 : 0.09,
      );
      firstDirectedFrame = false;
      camera.position.copy(directedPosition);
      camera.lookAt(0, 4, -8);
      instrument.rotation.y +=
        ((beat > 2.5 ? Math.PI : beat > 1.5 ? -0.25 : 0) -
          instrument.rotation.y) *
        k;
      leaves.forEach((leaf, i) => {
        const opening = Math.min(1, time / 1.5);
        const spread =
          beat < 0.5 ? opening : beat < 1.5 ? 1.4 : beat < 2.5 ? 1.8 : 0;
        const angle = (i * Math.PI * 2) / 3;
        const aligned = treatment === "return" && event > 0;
        const z = beat > 1.5 && beat < 2.5 ? (aligned ? 0 : (i - 1) * 2) : 0;
        leaf.position.lerp(
          new T.Vector3(Math.cos(angle) * spread, Math.sin(angle) * spread, z),
          k,
        );
        const rotation =
          beat > 2.5 ? 0 : beat > 1.5 ? (i === focus % 3 ? 0 : 0.55) : 0.18;
        leaf.rotation.y += (rotation - leaf.rotation.y) * k;
      });
      host.dataset.action =
        beat > 2.5
          ? "assembled"
          : beat > 1.5
            ? treatment === "return" && event > 0
              ? "aligned"
              : "examining"
            : "separating";
    }
    camera.updateMatrixWorld();
    sunlight.intensity = pose.light;
    if (!reduced) {
      dust.position.y = steel
        ? -((time * 0.35) % 2)
        : Math.sin(time * 0.5) * 0.5;
      dust.rotation.y = steel ? 0 : Math.sin(time * 0.09) * 0.04;
      rim.intensity = 33 + Math.sin(time * 0.6) * 3;
    }
    renderer.render(scene, camera);
    const corners = [
      [-5, 0.249, -8],
      [5, 0.249, -8],
      [-5, 6.151, -8],
      [5, 6.151, -8],
    ].map((c) => new T.Vector3(c[0], c[1], c[2]).project(camera).toArray());
    host.dataset.progress = progress.toFixed(4);
    host.dataset.camera = camera.position
      .toArray()
      .map((v) => v.toFixed(4))
      .join(",");
    host.dataset.framing = JSON.stringify(corners);
    host.dataset.life = (!reduced ? dust.position.y : 0).toFixed(4);
    return {
      calls: renderer.info.render.calls,
      triangles: renderer.info.render.triangles,
    };
  }
  return {
    render,
    dispose() {
      surface.dispose();
      steelSurface.dispose();
      floorTexture.dispose();
      scene.traverse((object) => {
        if (object instanceof T.Mesh || object instanceof T.Points)
          object.geometry.dispose();
      });
      materials.forEach((m) => m.dispose());
      renderer.dispose();
      renderer.domElement.remove();
    },
    artwork: instrument,
  };
}
