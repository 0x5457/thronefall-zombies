import * as T from 'three';

// Requires a stencil-enabled renderer. Visible player pixels and the first
// hidden surface claim the same stencil bit, preventing self-occlusion and
// overlapping body parts from accumulating opacity. The frame clear resets it.
export function addOcclusionSilhouette(character) {
  const silhouette = new T.MeshBasicMaterial({
    color: '#a8eee5',
    transparent: true,
    opacity: 0.48,
    depthFunc: T.GreaterDepth,
    depthWrite: false,
    toneMapped: false,
    fog: false,
    stencilWrite: true,
    stencilRef: 1,
    stencilFunc: T.NotEqualStencilFunc,
    stencilZPass: T.ReplaceStencilOp,
  });
  const parts = [];
  character.traverse((part) => {
    if (part.isMesh) parts.push(part);
  });
  for (const part of parts) {
    // World materials are shared with NPCs; only the player's copies mark stencil.
    part.renderOrder = 10; // After opaque occluders, so only truly visible pixels mark stencil.
    part.material = part.material.clone();
    Object.assign(part.material, {
      stencilWrite: true,
      stencilRef: 1,
      stencilFunc: T.AlwaysStencilFunc,
      stencilZPass: T.ReplaceStencilOp,
    });
    const overlay = new T.Mesh(part.geometry, silhouette);
    overlay.name = 'occlusion-silhouette';
    overlay.renderOrder = 1000;
    // Child identity transform follows the exact animated pose, including legs.
    part.add(overlay);
  }
}
