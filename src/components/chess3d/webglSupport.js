// Capability detection for the 3D chess renderer. Runs once (results are
// cached at module scope) and answers two questions: can this device
// reasonably run WebGL at all, and if so, what quality tier should it get.
//
// The failIfMajorPerformanceCaveat check specifically matters for older
// integrated GPUs (Intel HD 3000-class hardware and similar) where the
// browser is willing to hand back a WebGL context, but only by silently
// falling back to a CPU software rasterizer — context creation succeeds,
// so a naive try/catch wouldn't catch this, but real-time performance
// would be poor. Requesting failIfMajorPerformanceCaveat: true makes the
// browser return null instead in exactly that case, so it's treated the
// same as "no WebGL" and the app falls back to the 2D board.
let cachedSupport = null;

export function detectWebGLSupport() {
  if (cachedSupport !== null) return cachedSupport;

  let supported = false;
  try {
    const canvas = document.createElement("canvas");
    const gl =
      canvas.getContext("webgl2", { failIfMajorPerformanceCaveat: true }) ||
      canvas.getContext("webgl", { failIfMajorPerformanceCaveat: true });
    supported = !!gl;
    if (gl && gl.getExtension) gl.getExtension("WEBGL_lose_context")?.loseContext();
  } catch {
    supported = false;
  }

  cachedSupport = supported;
  return supported;
}

// HIGH / MEDIUM / LOW — used to pick DPR cap, shadow map resolution, and
// whether antialiasing is worth the cost. Heuristic-based since there's no
// direct "how fast is this GPU" API; hardwareConcurrency/deviceMemory are
// rough but standard, widely-used signals for this purpose.
export function detectQualityTier() {
  const cores = navigator.hardwareConcurrency || 4;
  const mem = navigator.deviceMemory; // not available in every browser
  const isMobile = /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent || "");

  if (isMobile) {
    if (cores <= 4 || (mem && mem <= 3)) return "low";
    return "medium";
  }
  if (cores <= 2 || (mem && mem <= 2)) return "low";
  if (cores <= 4) return "medium";
  return "high";
}

export const QUALITY_SETTINGS = {
  high: { dprCap: 2, shadowMapSize: 1024, shadows: true, antialias: true },
  medium: { dprCap: 1.5, shadowMapSize: 512, shadows: true, antialias: true },
  low: { dprCap: 1, shadowMapSize: 0, shadows: false, antialias: false },
};

export function getQualitySettings(manualOverride) {
  const tier = manualOverride && QUALITY_SETTINGS[manualOverride] ? manualOverride : detectQualityTier();
  return { tier, ...QUALITY_SETTINGS[tier] };
}
