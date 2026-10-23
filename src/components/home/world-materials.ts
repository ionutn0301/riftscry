import * as THREE from 'three';

export function createWorldMaterials() {
  const size = 256;
  const bytes = new Uint8Array(size * size * 4);
  let seed = 731;
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    const grain = (seed >>> 24) / 255;
    const vein = Math.sin(x * .09 + Math.sin(y * .04) * 3) * .5 + .5;
    const value = Math.round(155 + grain * 45 + vein * 30);
    const i = (y * size + x) * 4;
    bytes[i] = bytes[i + 1] = bytes[i + 2] = value;
    bytes[i + 3] = 255;
  }
  const texture = new THREE.DataTexture(bytes, size, size);
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(3, 3);
  texture.needsUpdate = true;
  const stone = new THREE.MeshStandardMaterial({ color: '#c9c9bb', roughness: .77, bumpMap: texture, bumpScale: .035, roughnessMap: texture });
  const metal = new THREE.MeshStandardMaterial({ color: '#a48a54', metalness: .82, roughness: .29, bumpMap: texture, bumpScale: .008 });
  const dark = new THREE.MeshStandardMaterial({ color: '#173d3b', metalness: .55, roughness: .35 });
  const light = new THREE.MeshStandardMaterial({ color: '#9fffe0', emissive: '#64dfbf', emissiveIntensity: 2, roughness: .3 });
  return { stone, metal, dark, light, dispose: () => { texture.dispose(); [stone, metal, dark, light].forEach(m => m.dispose()); } };
}
export type WorldMaterials = ReturnType<typeof createWorldMaterials>;
