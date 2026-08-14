import { useMemo } from "react";
import * as THREE from "three";
import { useGLTF } from "@react-three/drei";

// Third-party asset — "Chess Board" by Anthony Yanez
// (https://sketchfab.com/paulyanez), CC-BY-4.0
// (https://sketchfab.com/3d-models/chess-board-a0fb4aa0e75649e0991a2571ab70ea44).
// Credited in the 3D view via Chess3DScene's model-credit line.
const GLTF_URL = "/models/chess-set.glb";

const NODE_NAME = {
  w: { p: "W_Pawn_1", r: "W_Rook_1", n: "W_Knight_1", b: "W_Bishop_1", q: "W_Queen", k: "W_King" },
  b: { p: "B_Pawn_1", r: "B_Rook_1", n: "B_Knight_1", b: "B_Bishop_1", q: "B_Queen", k: "B_King" },
};

// Target world-space heights (SQUARE_SIZE = 1 board) — mirrors the same
// king-tallest/pawn-shortest relative proportions the procedural
// PIECE_SCALE table used, so swapping to the loaded model doesn't change
// the board's overall visual scale or camera framing.
// Bumped up ~20% (from p:0.42 ... k:0.72) alongside PIECE_SCALE — the
// original heights read as too small against the board squares.
const TARGET_HEIGHT = { p: 0.87, n: 1, b: 1, r: 1, q: 1.2, k: 1.2 };

function findMesh(root, name) {
  const node = root.getObjectByName(name);
  if (!node) return null;
  if (node.isMesh) return node;
  let found = null;
  node.traverse((child) => {
    if (!found && child.isMesh) found = child;
  });
  return found;
}

// Bakes a mesh's full accumulated world transform (it sits several levels
// deep under a compound scale+axis-conversion matrix in the source file)
// directly into a fresh, self-contained BufferGeometry, then re-centers
// it at its own base so it can be positioned exactly the way the
// procedural pieces already are: a <group position={x,0,z}> with the
// piece resting on y=0.
function normalizedGeometry(mesh, targetHeight) {
  mesh.updateWorldMatrix(true, false);
  const geo = mesh.geometry.clone();
  geo.applyMatrix4(mesh.matrixWorld);
  geo.computeBoundingBox();
  const box = geo.boundingBox;
  const size = new THREE.Vector3();
  box.getSize(size);
  const center = new THREE.Vector3();
  box.getCenter(center);

  const scale = size.y > 0.0001 ? targetHeight / size.y : 1;
  geo.translate(-center.x, -box.min.y, -center.z);
  geo.scale(scale, scale, scale);
  geo.computeVertexNormals();
  return geo;
}

// Returns { w: { p: {geometry, material}, ... }, b: {...} } once the
// model has loaded and every expected piece node was found, or null if
// anything about the file didn't match what's expected — callers should
// fall back to the procedural geometry in that case rather than crash.
export function useGLTFPieceSet() {
  const gltf = useGLTF(GLTF_URL);
  return useMemo(() => {
    try {
      const result = {};
      for (const color of ["w", "b"]) {
        result[color] = {};
        for (const type of ["p", "r", "n", "b", "q", "k"]) {
          const name = NODE_NAME[color][type];
          const mesh = findMesh(gltf.scene, name);
          if (!mesh) throw new Error(`missing node "${name}" in chess-set.glb`);
          result[color][type] = { geometry: normalizedGeometry(mesh, TARGET_HEIGHT[type]), material: mesh.material };
        }
      }
      return result;
    } catch (err) {
      console.warn("[Chess3D] Loaded model is missing expected pieces, falling back to procedural geometry:", err);
      return null;
    }
  }, [gltf]);
}