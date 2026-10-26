export const clamp = (v: number, low = 0, high = 1) =>
  Math.min(high, Math.max(low, v));
export const smooth = (v: number) => {
  const t = clamp(v);
  return t * t * (3 - 2 * t);
};
export function cameraPose(progress: number, aspect: number) {
  const p = clamp(progress);
  const approach = smooth(p / 0.72);
  const inspect = smooth((p - 0.72) / 0.28);
  const distance = Math.max(
    11,
    6.2 / Math.max(aspect, 0.35) / Math.tan((20 * Math.PI) / 180),
  );
  return {
    position: [
      7 * (1 - approach) - inspect * 0.8,
      5.8 - approach * 2.6,
      -8 + distance + 9 * (1 - approach),
    ] as [number, number, number],
    target: [0, 3.2, -8] as [number, number, number],
    light: 2.3 + approach * 0.6,
    inspection: inspect,
  };
}
