export const MAP = Object.freeze({ size: 180, half: 90, playable: 64 });

// Enemy entry points, one per lane; order must match `LANES` in rules.ts.
export const LANE_SPAWNS: readonly [number, number][] = [
  [-2, -29],
  [-28, -0.5],
  [18, 9],
];

export interface CameraFocus {
  x: number;
  z: number;
}

export const cameraFocus = (
  x: number,
  z: number,
  halfWidth: number,
  halfHeight: number,
): CameraFocus => {
  const limitX = Math.max(0, MAP.half - halfWidth - 9);
  const limitZ = Math.max(0, MAP.half - halfHeight * 1.32 - 12);
  const follow = (n: number): number => Math.sign(n) * Math.max(0, Math.abs(n) - 7);
  return {
    x: Math.max(-limitX, Math.min(limitX, follow(x))) || 0,
    z: Math.max(-limitZ, Math.min(limitZ, follow(z))) || 0,
  };
};
