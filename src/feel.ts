// Hit-feel math kept free of Three.js and DOM so it can be unit tested in Node.
export const clamp01 = (value: number): number => Math.max(0, Math.min(1, value));
// Overshoots past 1 before settling: used for construction "pop".
export const easeOutBack = (x: number): number => {
  const c1 = 1.70158,
    c3 = c1 + 1;
  return 1 + c3 * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2);
};

export interface TraumaOptions {
  decay?: number;
  shift?: number;
  zoom?: number;
  roll?: number;
}

export interface Shake {
  x: number;
  z: number;
  zoom: number;
  roll: number;
}

export interface Trauma {
  add(amount: number): void;
  readonly value: number;
  readonly frames: number;
  update(dt: number): Shake;
}

// Camera trauma: events add, decay removes; shake is trauma^2 so light hits barely move.
export function createTrauma({
  decay = 1.7,
  shift = 0.3,
  zoom = 0.015,
  roll = 0.006,
}: TraumaOptions = {}): Trauma {
  let value = 0,
    time = 0,
    frames = 0;
  return {
    add(amount: number): void {
      value = clamp01(value + Math.max(0, amount));
    },
    get value(): number {
      return value;
    },
    get frames(): number {
      return frames;
    },
    update(dt: number): Shake {
      time += dt;
      value = Math.max(0, value - decay * dt);
      const shake = value * value;
      if (shake > 0) frames++;
      return {
        x: shake * shift * Math.sin(time * 37),
        z: shake * shift * Math.sin(time * 31 + 1.7),
        zoom: shake * zoom * Math.sin(time * 23 + 0.5),
        roll: shake * roll * Math.sin(time * 19 + 2.1),
      };
    },
  };
}

export interface HitStop {
  trigger(seconds: number): void;
  readonly active: boolean;
  readonly count: number;
  update(realDt: number): number;
}

// Hit-stop: returns the simulation time scale. Always resumes because the timer
// counts down in real time, independent of the scale it hands out.
export function createHitStop(scale = 0.12): HitStop {
  let remaining = 0,
    count = 0;
  return {
    trigger(seconds: number): void {
      if (!(seconds > 0)) return;
      remaining = Math.max(remaining, seconds);
      count++;
    },
    get active(): boolean {
      return remaining > 0;
    },
    get count(): number {
      return count;
    },
    update(realDt: number): number {
      if (remaining <= 0) return 1;
      remaining = Math.max(0, remaining - realDt);
      return scale;
    },
  };
}

// Juice grows with the target's weight; keep routine kills short so waves stay readable.
export function hitStopFor(maxHp = 5): number {
  if (maxHp >= 100) return 0.15;
  if (maxHp >= 20) return 0.085;
  return 0.04;
}
export function killTraumaFor(maxHp = 5): number {
  if (maxHp >= 100) return 1;
  if (maxHp >= 20) return 0.5;
  return 0.22;
}
