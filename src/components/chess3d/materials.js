// Shared materials, built once and reused across every piece/board mesh —
// never created per-instance.
//
// Using MeshPhongMaterial rather than MeshStandardMaterial: Phong still
// gives real specular highlights (the glossy look chess sets typically
// have — flat MeshLambertMaterial has none, and that flatness was part of
// why the first pass looked "bad"/lifeless), but unlike the PBR
// MeshStandardMaterial pipeline, Phong doesn't lean on environment/IBL
// lighting to look right and is dramatically friendlier to older or
// software-rendered GPUs — the same reasoning that made simplifying to
// Lambert/Phong-family materials work on old Intel integrated graphics
// elsewhere. Phong is the middle ground: gloss without the PBR cost.
import * as THREE from "three";

function readThemeColor(varName, fallback) {
  try {
    const el = document.querySelector(".app-shell") || document.documentElement;
    const val = getComputedStyle(el).getPropertyValue(varName).trim();
    return val || fallback;
  } catch {
    return fallback;
  }
}

let pieceMaterials = null;
export function getPieceMaterial(color) {
  if (!pieceMaterials) {
    pieceMaterials = {
      w: new THREE.MeshPhongMaterial({
        color: new THREE.Color("#F5E9D3"), /* */
        specular: new THREE.Color("#FFFDF7"), /*[cite: 4] */
        shininess: 20, /*[cite: 4] */
      }),
      b: new THREE.MeshPhongMaterial({
        // Lightened from #241812 to #3a2e2b for far better contrast
        color: new THREE.Color("#4d2822"),
        // Brightened specular reflection so contours pop
        specular: new THREE.Color("#e0ab7c"),
        shininess: 20,
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
      w: new THREE.MeshPhongMaterial({ color: new THREE.Color("#8A7454"), shininess: 20 }),
      b: new THREE.MeshPhongMaterial({ color: new THREE.Color("#e91b1b"), shininess: 20 }),
    };
  }
  return slitMaterials[color];
}

// Board colors are read from the SAME CSS custom properties Checkers'
// board themes define (--sq-light-a, --sq-dark-a, --board-border — see
// styles/theme.css), so picking a theme in Settings affects both boards.
// Cached like everything else here, but refreshBoardMaterialsFromTheme()
// (called on every Chess3DBoard mount) updates the existing materials'
// colors in place rather than recreating them, in case the theme changed
// since they were first built.
let boardMaterials = null;
export function getBoardMaterials() {
  if (!boardMaterials) {
    boardMaterials = {
      light: new THREE.MeshPhongMaterial({ color: new THREE.Color(readThemeColor("--sq-light-a", "#E8D3A6")), shininess: 25 }),
      dark: new THREE.MeshPhongMaterial({ color: new THREE.Color(readThemeColor("--sq-dark-a", "#4A2F1C")), shininess: 25 }),
      frame: new THREE.MeshPhongMaterial({ color: new THREE.Color(readThemeColor("--board-border", "#2B1A10")), shininess: 15 }),
    };
  }
  return boardMaterials;
}

export function refreshBoardMaterialsFromTheme() {
  if (!boardMaterials) return; // nothing built yet — getBoardMaterials() will read fresh values on first call
  boardMaterials.light.color.set(readThemeColor("--sq-light-a", "#E8D3A6"));
  boardMaterials.dark.color.set(readThemeColor("--sq-dark-a", "#4A2F1C"));
  boardMaterials.frame.color.set(readThemeColor("--board-border", "#2B1A10"));
}

let markerMaterials = null;
export function getMarkerMaterials() {
  if (!markerMaterials) {
    markerMaterials = {
      moveDot: new THREE.MeshPhongMaterial({ color: new THREE.Color("#FFDF33"), emissive: new THREE.Color("#FFDF33"), emissiveIntensity: 0.6 }),
      captureRing: new THREE.MeshPhongMaterial({ color: new THREE.Color("#C85C4F"), emissive: new THREE.Color("#C85C4F"), emissiveIntensity: 0.5 }),
      selectedRing: new THREE.MeshPhongMaterial({ color: new THREE.Color("#FFDF33"), emissive: new THREE.Color("#FFDF33"), emissiveIntensity: 0.8 }),
      lastMove: new THREE.MeshPhongMaterial({ color: new THREE.Color("#FF7800"), emissive: new THREE.Color("#FF7800"), emissiveIntensity: 0.35, transparent: true, opacity: 0.55 }),
      check: new THREE.MeshPhongMaterial({ color: new THREE.Color("#C85C4F"), emissive: new THREE.Color("#C85C4F"), emissiveIntensity: 0.9, transparent: true, opacity: 0.7 }),
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