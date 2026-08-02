import { Component, Suspense, useCallback, useMemo, useRef } from "react";
import { Canvas } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import * as THREE from "three";
import Chess3DBoard from "./Chess3DBoard.jsx";
import Chess3DPieces from "./Chess3DPieces.jsx";
import { getMarkerMaterials } from "./materials.js";
import { getQualitySettings } from "./webglSupport.js";
import "./chess3d.css";

// Real React errors (a WebGL context lost mid-session, a driver-specific
// throw, etc.) can only be caught by a class-component error boundary —
// there's no functional-component equivalent. Kept intentionally tiny and
// local to this file rather than a general-purpose shared component, since
// its only job is "3D broke, tell the parent so it can fall back to 2D."
class Chess3DErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }
  static getDerivedStateFromError() {
    return { hasError: true };
  }
  componentDidCatch(error, info) {
    console.error("[Chess3D] render error, falling back to 2D board:", error, info);
    this.props.onFatalError?.();
  }
  render() {
    if (this.state.hasError) return null; // parent (ChessBoard.jsx) switches to the 2D board
    return this.props.children;
  }
}

function LoadingOverlay() {
  return (
    <div className="chess3d-loading">
      <span>Preparing Chess Board…</span>
    </div>
  );
}

export default function Chess3DScene({
  board,
  gameState,
  orientation,
  lastMove,
  selected,
  destinationsBySquare,
  checkedKing,
  onSquareClick,
  qualityOverride,
  onFatalError,
  controlsRef,
}) {
  const quality = useMemo(() => getQualitySettings(qualityOverride), [qualityOverride]);
  const markers = getMarkerMaterials();

  // Distinguishes a tap (select) from a drag (orbit) — a small movement
  // threshold, tracked on the raw pointer events (not per-mesh raycasts),
  // so OrbitControls rotating the camera never also fires a piece/square
  // selection underneath it.
  const dragInfo = useRef({ x: 0, y: 0, dragged: false });
  const handlePointerDown = useCallback((e) => {
    dragInfo.current = { x: e.clientX, y: e.clientY, dragged: false };
  }, []);
  const handlePointerMove = useCallback((e) => {
    if (dragInfo.current.x == null) return;
    const dx = e.clientX - dragInfo.current.x;
    const dy = e.clientY - dragInfo.current.y;
    if (Math.sqrt(dx * dx + dy * dy) > 6) dragInfo.current.dragged = true;
  }, []);
  const guardedSquareClick = useCallback(
    (row, col) => {
      if (dragInfo.current.dragged) return;
      onSquareClick(row, col);
    },
    [onSquareClick]
  );

  const squareState = useCallback(
    (row, col) => {
      const isSelected = !!selected && selected.row === row && selected.col === col;
      const isLastMove = !!lastMove && ((lastMove.from.row === row && lastMove.from.col === col) || (lastMove.to.row === row && lastMove.to.col === col));
      const isCheck = !!checkedKing && checkedKing.row === row && checkedKing.col === col;
      const dest = destinationsBySquare?.get(`${row},${col}`);
      const hasDest = !!selected && dest && dest.length > 0;
      const isCapture = hasDest && dest.some((m) => m.captured);
      const isEmptyDest = hasDest && !board[row][col];
      if (!isSelected && !isLastMove && !isCheck && !isEmptyDest && !isCapture) return null;
      return {
        selected: isSelected,
        selectedMaterial: markers.selectedRing,
        lastMove: isLastMove,
        lastMoveMaterial: markers.lastMove,
        check: isCheck,
        checkMaterial: markers.check,
        moveDot: isEmptyDest,
        moveDotMaterial: markers.moveDot,
        captureRing: isCapture,
        captureRingMaterial: markers.captureRing,
      };
    },
    [selected, lastMove, checkedKing, destinationsBySquare, board, markers]
  );

  return (
    <div className="chess3d-container" onPointerDown={handlePointerDown} onPointerMove={handlePointerMove}>
      <Chess3DErrorBoundary onFatalError={onFatalError}>
        <Suspense fallback={<LoadingOverlay />}>
          <Canvas
            shadows={quality.shadows}
            dpr={[1, quality.dprCap]}
            gl={{ antialias: quality.antialias, powerPreference: "high-performance" }}
            camera={{ position: [0, 7.2, 7.6], fov: 42, near: 0.1, far: 50 }}
          >
            <color attach="background" args={["#0a0a0c"]} />
            <ambientLight intensity={0.55} />
            <hemisphereLight args={["#fdf6ea", "#1a1410", 0.4]} />
            <directionalLight
              position={[4, 8, 3]}
              intensity={1.1}
              castShadow={quality.shadows}
              shadow-mapSize={quality.shadowMapSize ? [quality.shadowMapSize, quality.shadowMapSize] : undefined}
              shadow-camera-left={-6}
              shadow-camera-right={6}
              shadow-camera-top={6}
              shadow-camera-bottom={-6}
            />
            <pointLight position={[-5, 4, -5]} intensity={0.25} color="#e8c25c" />

            <Chess3DBoard orientation={orientation} onSquareClick={guardedSquareClick} squareState={squareState} />
            <Chess3DPieces board={board} lastMove={lastMove} orientation={orientation} selected={selected} onSelect={guardedSquareClick} />

            <OrbitControls
              ref={controlsRef}
              enablePan={false}
              enableDamping
              dampingFactor={0.12}
              minDistance={5}
              maxDistance={13}
              minPolarAngle={THREE.MathUtils.degToRad(15)}
              maxPolarAngle={THREE.MathUtils.degToRad(80)}
              target={[0, 0, 0]}
            />
          </Canvas>
        </Suspense>
      </Chess3DErrorBoundary>
    </div>
  );
}
