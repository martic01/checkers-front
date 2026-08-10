// Capability detection for the 3D chess renderer. Runs once (results are
// cached at module scope) and answers two questions: can this device
// reasonably run WebGL at all, and if so, should quality be forced down.
//
// Every branch logs to the console on purpose — "3D does nothing and I
// have no idea why" is exactly the failure mode this is meant to prevent.
//
// Strategy: try a context with failIfMajorPerformanceCaveat first (best
// case — real hardware acceleration). If that's refused (the classic
// older-integrated-GPU case, where the browser would otherwise silently
// hand back a CPU software rasterizer), retry WITHOUT that flag rather
// than giving up — accept the software-rendered context and automatically
// force the LOW quality tier for it, instead of locking 3D out entirely.
let cachedResult = null;

export function detectWebGLSupport() {
  if (cachedResult !== null) return cachedResult;

  let result = { supported: false, softwareRendered: false };
  try {
    const canvas = document.createElement("canvas");
    let gl = canvas.getContext("webgl2", { failIfMajorPerformanceCaveat: true }) || canvas.getContext("webgl", { failIfMajorPerformanceCaveat: true });

    if (gl) {
      result = { supported: true, softwareRendered: false };
      console.info("[Chess3D] WebGL available with real hardware acceleration — 3D will run at full quality (subject to device tier).");
    } else {
      gl = canvas.getContext("webgl2") || canvas.getContext("webgl");
      if (gl) {
        result = { supported: true, softwareRendered: true };
        console.warn(
          "[Chess3D] WebGL is only available via a software-rendered / performance-caveat context on this device. " +
            "3D will still run, but quality is being forced to LOW (no shadows, capped resolution) to keep it usable."
        );
      } else {
        console.warn("[Chess3D] No WebGL context could be created at all on this device — staying on the 2D board.");
      }
    }
    if (gl?.getExtension) gl.getExtension("WEBGL_lose_context")?.loseContext();
  } catch (err) {
    console.error("[Chess3D] WebGL detection threw an error — falling back to the 2D board:", err);
    result = { supported: false, softwareRendered: false };
  }

  cachedResult = result;
  return result;
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

// forceLow (set when the only available WebGL context is software-rendered)
// always wins over the heuristic tier and any manual override — running a
// shadowed, high-DPR scene through a CPU rasterizer is the exact scenario
// this exists to avoid.
export function getQualitySettings(manualOverride, forceLow = false) {
  if (forceLow) {
    console.info("[Chess3D] Quality forced to LOW (software-rendered WebGL context).");
    return { tier: "low", ...QUALITY_SETTINGS.low };
  }
  const tier = manualOverride && QUALITY_SETTINGS[manualOverride] ? manualOverride : detectQualityTier();
  console.info(`[Chess3D] Quality tier: ${tier}`);
  return { tier, ...QUALITY_SETTINGS[tier] };
}
