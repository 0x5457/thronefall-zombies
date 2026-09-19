// Hit-feel math kept free of Three.js and DOM so it can be unit tested in Node.
export const clamp01 = value => Math.max(0, Math.min(1, value));
// Overshoots past 1 before settling: used for construction "pop".
export const easeOutBack = x => { const c1 = 1.70158, c3 = c1 + 1; return 1 + c3 * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2); };

// Camera trauma: events add, decay removes; shake is trauma^2 so light hits barely move.
export function createTrauma({ decay = 1.7, shift = .3, zoom = .015, roll = .006 } = {}) {
  let value = 0, time = 0, frames = 0;
  return {
    add(amount) { value = clamp01(value + Math.max(0, amount)); },
    get value() { return value; },
    get frames() { return frames; },
    update(dt) {
      time += dt;
      value = Math.max(0, value - decay * dt);
      const shake = value * value;
      if (shake > 0) frames++;
      return {
        x: shake * shift * Math.sin(time * 37),
        z: shake * shift * Math.sin(time * 31 + 1.7),
        zoom: shake * zoom * Math.sin(time * 23 + .5),
        roll: shake * roll * Math.sin(time * 19 + 2.1),
      };
    },
  };
}

// Hit-stop: returns the simulation time scale. Always resumes because the timer
// counts down in real time, independent of the scale it hands out.
export function createHitStop(scale = .12) {
  let remaining = 0, count = 0;
  return {
    trigger(seconds) { if (!(seconds > 0)) return; remaining = Math.max(remaining, seconds); count++; },
    get active() { return remaining > 0; },
    get count() { return count; },
    update(realDt) { if (remaining <= 0) return 1; remaining = Math.max(0, remaining - realDt); return scale; },
  };
}

// Juice grows with the target's weight; keep routine kills short so waves stay readable.
export function hitStopFor(maxHp = 5) {
  if (maxHp >= 100) return .15;
  if (maxHp >= 20) return .085;
  return .04;
}
export function killTraumaFor(maxHp = 5) {
  if (maxHp >= 100) return 1;
  if (maxHp >= 20) return .5;
  return .22;
}
