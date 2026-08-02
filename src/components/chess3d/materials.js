// Shared materials, built once and reused across every piece/board mesh —
// never created per-instance. Colors follow the ranges from the design
// brief: warm ivory/cream for white, deep ebony-with-brown-undertone for
// black (never flat pure black, so edges/highlights still read).
import * as THREE from "three";

let pieceMaterials = null;
export function getPieceMaterial(color) {
  if (!pieceMaterials) {
    pieceMaterials = {
      w: new THREE.MeshStandardMaterial({
        color: new THREE.Color("#EDDCC0"),
        roughness: 0.42,
        metalness: 0.06,
      }),
      b: new THREE.MeshStandardMaterial({
        color: new THREE.Color("#1C130E"),
        roughness: 0.38,
        metalness: 0.08,
      }),
    };
  }
  return pieceMaterials[color];
}

// The bishop's carved-slit accent reuses the same body material family but
// wants a touch darker so it reads as a groove rather than a stuck-on
// block — a separate, still-cached material rather than a per-instance one.
let slitMaterials = null;
export function getSlitMaterial(color) {
  if (!slitMaterials) {
    slitMaterials = {
      w: new THREE.MeshStandardMaterial({ color: new THREE.Color("#8A7454"), roughness: 0.5 }),
      b: new THREE.MeshStandardMaterial({ color: new THREE.Color("#000000"), roughness: 0.5 }),
    };
  }
  return slitMaterials[color];
}

let boardMaterials = null;
export function getBoardMaterials() {
  if (!boardMaterials) {
    boardMaterials = {
      light: new THREE.MeshStandardMaterial({ color: new THREE.Color("#E8D3A6"), roughness: 0.55, metalness: 0.03 }),
      dark: new THREE.MeshStandardMaterial({ color: new THREE.Color("#4A2F1C"), roughness: 0.5, metalness: 0.03 }),
      frame: new THREE.MeshStandardMaterial({ color: new THREE.Color("#2B1A10"), roughness: 0.6, metalness: 0.04 }),
    };
  }
  return boardMaterials;
}

let markerMaterials = null;
export function getMarkerMaterials() {
  if (!markerMaterials) {
    markerMaterials = {
      moveDot: new THREE.MeshStandardMaterial({ color: new THREE.Color("#FFDF33"), emissive: new THREE.Color("#FFDF33"), emissiveIntensity: 0.6, roughness: 0.4 }),
      captureRing: new THREE.MeshStandardMaterial({ color: new THREE.Color("#C85C4F"), emissive: new THREE.Color("#C85C4F"), emissiveIntensity: 0.5, roughness: 0.4 }),
      selectedRing: new THREE.MeshStandardMaterial({ color: new THREE.Color("#FFDF33"), emissive: new THREE.Color("#FFDF33"), emissiveIntensity: 0.8, roughness: 0.3 }),
      lastMove: new THREE.MeshStandardMaterial({ color: new THREE.Color("#FF7800"), emissive: new THREE.Color("#FF7800"), emissiveIntensity: 0.35, roughness: 0.5, transparent: true, opacity: 0.55 }),
      check: new THREE.MeshStandardMaterial({ color: new THREE.Color("#C85C4F"), emissive: new THREE.Color("#C85C4F"), emissiveIntensity: 0.9, roughness: 0.4, transparent: true, opacity: 0.7 }),
    };
  }
  return markerMaterials;
}

export function disposeAllChess3DMaterials() {
  for (const group of [pieceMaterials, slitMaterials, boardMaterials, markerMaterials]) {
    if (!group) continue;
    for (const mat of Object.values(group)) mat.dispose();
  }
  pieceMaterials = null;
  slitMaterials = null;
  boardMaterials = null;
  markerMaterials = null;
}
