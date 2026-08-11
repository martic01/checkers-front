import { Component, Suspense, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { Canvas } from "@react-three/fiber";
import { OrbitControls, Text } from "@react-three/drei";
import * as THREE from "three";
import Chess3DBoard from "./Chess3DBoard.jsx";
import Chess3DPieces from "./Chess3DPieces.jsx";
import { getMarkerMaterials } from "./materials.js";
import { getQualitySettings } from "./webglSupport.js";
import { getWorldPosition } from "./coords.js";
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

// File (a-h) and rank (1-8) labels sitting on the board frame — these were
// missing from the 3D scene entirely before (2D mode has always had them),
// which was part of why the board read as visually incomplete. Reuses
// getWorldPosition for placement rather than computing positions
// separately, same as every other piece/marker in this scene.
function BoardCoordinates({ orientation }) {
  const EDGE = 4.18;
  const LABEL_Y = 0.9;
  const files = "abcdefgh".split("");
  return (
    <group>
      {files.map((f, col) => {
        const { x } = getWorldPosition(0, col, orientation);
        return (
          <Text key={`f-${f}`} position={[x, LABEL_Y, EDGE]} rotation={[-Math.PI / 2, 0, 0]} fontSize={0.24} color="#EBD3A6" anchorX="center" anchorY="middle">
            {f}
          </Text>
        );
      })}
      {[0, 1, 2, 3, 4, 5, 6, 7].map((row) => {
        const { z } = getWorldPosition(row, 0, orientation);
        return (
          <Text key={`r-${row}`} position={[-EDGE, LABEL_Y, z]} rotation={[-Math.PI / 2, 0, 0]} fontSize={0.24} color="#EBD3A6" anchorX="center" anchorY="middle">
            {8 - row}
          </Text>
        );
      })}
    </group>
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
  forceLowQuality = false,
  onFatalError,
  controlsRef,
}) {
  const quality = useMemo(() => getQualitySettings(qualityOverride, forceLowQuality), [qualityOverride, forceLowQuality]);
  const markers = getMarkerMaterials();

  // .chess3d-container is sized via CSS aspect-ratio, which derives its
  // height from its own width — but on some mobile WebViews, when this
  // whole subtree mounts fresh (i.e. right when the user toggles 2D->3D),
  // the browser hasn't finished resolving that aspect-ratio yet at the
  // moment react-three-fiber's <Canvas> takes its first size measurement,
  // and the canvas gets stuck rendering into a tiny/stale surface with no
  // further resize event to correct it. Measuring the PARENT's width
  // directly (ordinary flex/block layout, not aspect-ratio-derived) and
  // setting an explicit pixel box sidesteps that timing gap entirely.
  const containerRef = useRef(null);
  const [boxPx, setBoxPx] = useState(null);
  useLayoutEffect(() => {
    const el = containerRef.current;
    const parent = el?.parentElement;
    if (!parent) return undefined;
    const measure = () => {
      const w = parent.clientWidth;
      if (w > 0) setBoxPx(Math.max(240, Math.min(w, 640)));
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(parent);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    console.info("[Chess3D] Scene mounted.", { qualityTier: quality.tier, shadows: quality.shadows, dprCap: quality.dprCap });
  }, [quality]);

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
    <div
      ref={containerRef}
      className="chess3d-container"
      style={boxPx ? { width: boxPx, height: boxPx } : undefined}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
    >
      <Chess3DErrorBoundary onFatalError={onFatalError}>
        <Suspense fallback={<LoadingOverlay />}>
          <Canvas
            shadows={quality.shadows}
            dpr={[3, quality.dprCap]}
            gl={{ antialias: quality.antialias, powerPreference: "high-performance" }}
            camera={{ position: [0, 6.6, 9.9], fov:40 , near: 0.1, far: 100 }}
          >
            {/* <color attach="background" args={["#2b1908"]} /> */}
            <ambientLight intensity={0.1} />
            <hemisphereLight args={["#fdf6ea", "#53cc1f", 0.4]} />
            <directionalLight
              position={[4, 8, 3]}
              intensity={1.2}
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
            <BoardCoordinates orientation={orientation} />

            <OrbitControls
              ref={controlsRef}
              enablePan={false}
              enableDamping
              dampingFactor={0.12}
              minDistance={4.5}
              maxDistance={9.5}
              minPolarAngle={THREE.MathUtils.degToRad(20)}
              maxPolarAngle={THREE.MathUtils.degToRad(58)}
             target={[0, 0, 0]}
            />
          </Canvas>
        </Suspense>
      </Chess3DErrorBoundary>
    </div>
  );
}
