// Deterministic LCG shared by world generation and scene effects. Not for gameplay RNG.
export function seeded(seed = 731): () => number {
  return () => {
    seed = (Math.imul(1664525, seed) + 1013904223) | 0;
    return (seed >>> 0) / 4294967296;
  };
}
