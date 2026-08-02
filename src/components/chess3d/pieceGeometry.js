// Procedural Staunton-inspired chess piece geometry. No external models, no
// network fetch — everything here is built from Three.js primitives.
//
// Each createXGeometry() returns { body, parts } where:
//   body  - a single THREE.LatheGeometry for the rotationally-symmetric
//           trunk (base, collar, neck, main mass) — every piece has one.
//   parts - an array of { geometry, position: [x,y,z], rotation: [x,y,z] }
//           for anything that ISN'T rotationally symmetric (a rook's
//           crenellations, a queen's finials, a king's cross, a knight's
//           head) — rendered as sibling meshes in the same group rather
//           than merged into one buffer, which avoids pulling in the
//           BufferGeometryUtils addon just for this.
//
// All six factories are called exactly once (see the cache below) — 32
// pieces on a board reuse the same six pairs of geometry, never one
// geometry per piece.
import * as THREE from "three";

const LATHE_SEGMENTS = 24; // smooth enough to read as turned wood, not so
// dense that 32 on-screen pieces cost anything on a weak mobile GPU.

function lathe(points) {
  const vec2s = points.map(([r, y]) => new THREE.Vector2(r, y));
  return new THREE.LatheGeometry(vec2s, LATHE_SEGMENTS);
}

// Shared base+collar silhouette every piece starts from (radius, height),
// scaled per piece by the caller. Keeping this shape consistent is what
// makes a full set read as "one matching family" rather than six unrelated
// shapes.
function baseProfile(scale = 1) {
  return [
    [0.34, 0.0],
    [0.34, 0.035],
    [0.22, 0.075],
    [0.16, 0.095],
  ].map(([r, y]) => [r * scale, y * scale]);
}

export function createPawnGeometry() {
  const body = lathe([
    ...baseProfile(),
    [0.15, 0.16],
    [0.21, 0.19],
    [0.14, 0.225],
    [0.135, 0.29],
    [0.19, 0.33],
    [0.235, 0.385],
    [0.2, 0.44],
    [0.1, 0.49],
    [0.0, 0.51],
  ]);
  return { body, parts: [] };
}

export function createRookGeometry() {
  const body = lathe([
    ...baseProfile(1.05),
    [0.16, 0.17],
    [0.2, 0.2],
    [0.2, 0.44],
    [0.27, 0.48],
    [0.27, 0.56],
    [0.24, 0.58],
  ]);

  // Crenellated crown: a ring of small merlons around the top rim. Real
  // battlements aren't rotationally symmetric (they're notched), so this
  // is a ring of boxes rather than part of the lathe body.
  const parts = [];
  const merlonCount = 8;
  const ringRadius = 0.22;
  for (let i = 0; i < merlonCount; i++) {
    const angle = (i / merlonCount) * Math.PI * 2;
    parts.push({
      geometry: new THREE.BoxGeometry(0.1, 0.07, 0.06),
      position: [Math.cos(angle) * ringRadius, 0.615, Math.sin(angle) * ringRadius],
      rotation: [0, -angle, 0],
    });
  }
  return { body, parts };
}

export function createBishopGeometry() {
  const body = lathe([
    ...baseProfile(0.95),
    [0.15, 0.19],
    [0.19, 0.22],
    [0.13, 0.26],
    [0.12, 0.4],
    [0.22, 0.5],
    [0.24, 0.58],
    [0.15, 0.66],
    [0.05, 0.7],
    [0.0, 0.72],
  ]);

  // The traditional carved slit across the mitre, faked as a thin dark
  // wedge sitting on the surface rather than a true boolean cut (Three.js
  // has no built-in CSG, and pulling in a third-party CSG library just for
  // one detail isn't worth the added, unverifiable dependency risk).
  const parts = [
    {
      geometry: new THREE.BoxGeometry(0.16, 0.045, 0.03),
      position: [0, 0.63, 0.115],
      rotation: [0, 0, Math.PI / 10],
      materialKey: "slit",
    },
  ];
  return { body, parts };
}

export function createKnightGeometry() {
  // The trunk: base + neck, shared silhouette language with the rest of
  // the set, stopping short of a head (the head is built from primitives
  // below — a true horse profile isn't a solid of revolution).
  const body = lathe([...baseProfile(1.0), [0.16, 0.18], [0.19, 0.22], [0.14, 0.3], [0.13, 0.38]]);

  // Stylized low-poly horse head: an elongated, upward-tilted snout
  // tapering to a point, a rounded head mass behind it, and two small
  // ears — a genuine, recognizable silhouette built from real geometry
  // rather than a flat glyph, without requiring a fetched 3D model.
  const parts = [
    // neck rising from the trunk into the head, angled back
    { geometry: new THREE.CylinderGeometry(0.11, 0.14, 0.22, 12), position: [0, 0.46, -0.02], rotation: [0.35, 0, 0] },
    // head mass
    { geometry: new THREE.SphereGeometry(0.14, 14, 12), position: [0, 0.58, 0.07], rotation: [0, 0, 0] },
    // snout, tapered box pointing forward
    { geometry: new THREE.BoxGeometry(0.1, 0.09, 0.24), position: [0, 0.56, 0.24], rotation: [0.08, 0, 0] },
    // muzzle taper (smaller box at the very tip)
    { geometry: new THREE.BoxGeometry(0.075, 0.065, 0.08), position: [0, 0.545, 0.35], rotation: [0, 0, 0] },
    // two ears
    { geometry: new THREE.ConeGeometry(0.035, 0.09, 8), position: [-0.06, 0.7, 0.02], rotation: [0, 0, -0.25] },
    { geometry: new THREE.ConeGeometry(0.035, 0.09, 8), position: [0.06, 0.7, 0.02], rotation: [0, 0, 0.25] },
  ];
  return { body, parts };
}

export function createQueenGeometry() {
  const body = lathe([
    ...baseProfile(1.1),
    [0.17, 0.19],
    [0.21, 0.22],
    [0.12, 0.28],
    [0.115, 0.5],
    [0.2, 0.58],
    [0.26, 0.63],
    [0.19, 0.68],
  ]);

  // Coronet: small spherical finials around the crown rim.
  const parts = [];
  const finialCount = 6;
  const ringRadius = 0.155;
  for (let i = 0; i < finialCount; i++) {
    const angle = (i / finialCount) * Math.PI * 2;
    parts.push({
      geometry: new THREE.SphereGeometry(0.045, 10, 8),
      position: [Math.cos(angle) * ringRadius, 0.71, Math.sin(angle) * ringRadius],
      rotation: [0, 0, 0],
    });
  }
  parts.push({ geometry: new THREE.SphereGeometry(0.05, 12, 10), position: [0, 0.75, 0], rotation: [0, 0, 0] });
  return { body, parts };
}

export function createKingGeometry() {
  const body = lathe([
    ...baseProfile(1.15),
    [0.18, 0.2],
    [0.22, 0.23],
    [0.13, 0.29],
    [0.125, 0.55],
    [0.21, 0.63],
    [0.27, 0.68],
    [0.18, 0.73],
    [0.14, 0.76],
  ]);

  // Cross finial: two intersecting bars on top, the traditional king's
  // crown topper.
  const parts = [
    { geometry: new THREE.BoxGeometry(0.05, 0.16, 0.05), position: [0, 0.85, 0], rotation: [0, 0, 0] },
    { geometry: new THREE.BoxGeometry(0.13, 0.05, 0.05), position: [0, 0.83, 0], rotation: [0, 0, 0] },
  ];
  return { body, parts };
}

const FACTORIES = {
  p: createPawnGeometry,
  r: createRookGeometry,
  b: createBishopGeometry,
  n: createKnightGeometry,
  q: createQueenGeometry,
  k: createKingGeometry,
};

// Relative scale so the six piece types read at believable relative
// heights against each other (king tallest, pawn shortest), applied on
// top of each profile's own natural height.
export const PIECE_SCALE = {
  p: 0.72,
  n: 0.86,
  b: 0.92,
  r: 0.8,
  q: 1.0,
  k: 1.05,
};

let cache = null;
// Built once, on first use, and reused for the lifetime of the page —
// this is the thing that makes "32 pieces on the board" cost six
// geometries instead of thirty-two.
export function getPieceGeometry(type) {
  if (!cache) cache = {};
  if (!cache[type]) {
    const factory = FACTORIES[type];
    cache[type] = factory ? factory() : { body: new THREE.BoxGeometry(0.3, 0.3, 0.3), parts: [] };
  }
  return cache[type];
}

export function disposePieceGeometryCache() {
  if (!cache) return;
  for (const entry of Object.values(cache)) {
    entry.body.dispose();
    for (const part of entry.parts) part.geometry.dispose();
  }
  cache = null;
}
