import { useRef, useMemo, useEffect } from "react";
import { useFrame } from "@react-three/fiber";
import { getPieceGeometry, PIECE_SCALE } from "./pieceGeometry.js";
import { getPieceMaterial, getSlitMaterial } from "./materials.js";
import { getWorldPosition } from "./coords.js";

const MOVE_DURATION = 0.42; // seconds — within the 300-500ms brief
const LIFT_HEIGHT = 0.18;
const SELECT_LIFT = 0.12;
const CAPTURE_DURATION = 0.45;

function easeOutCubic(t) {
  return 1 - Math.pow(1 - t, 3);
}

// type/color/row/col describe where this piece IS right now (from board
// state — the chess engine's board, not anything this component decides).
// fromSquare, if set, is where it moved FROM this turn (see
// Chess3DPieces.jsx, which derives this from lastMove) — that's what
// drives the slide animation; without it the piece just appears in place
// (used for the initial board setup and for the opponent's own pieces
// that didn't move this turn).
export default function Chess3DPiece({ type, color, row, col, orientation, fromSquare = null, isSelected = false, isCapturing = false, onSelect }) {
  const groupRef = useRef();
  const { body, parts } = useMemo(() => getPieceGeometry(type), [type]);
  const bodyMaterial = getPieceMaterial(color);
  const pieceScale = PIECE_SCALE[type] || 1;

  const target = getWorldPosition(row, col, orientation);
  const start = fromSquare ? getWorldPosition(fromSquare.row, fromSquare.col, orientation) : target;

  const animState = useRef({ t: fromSquare ? 0 : 1, startX: start.x, startZ: start.z });

  const captureProgress = useRef(0);
  useEffect(() => {
    if (isCapturing) captureProgress.current = 0;
  }, [isCapturing]);

  useFrame((_, delta) => {
    const g = groupRef.current;
    if (!g) return;
    const st = animState.current;

    if (st.t < 1) {
      st.t = Math.min(1, st.t + delta / MOVE_DURATION);
      const e = easeOutCubic(st.t);
      g.position.x = st.startX + (target.x - st.startX) * e;
      g.position.z = st.startZ + (target.z - st.startZ) * e;
      g.position.y = Math.sin(Math.min(st.t, 1) * Math.PI) * LIFT_HEIGHT;
    } else {
      g.position.x = target.x;
      g.position.z = target.z;
      g.position.y = isSelected ? SELECT_LIFT : 0;
    }

    if (isCapturing) {
      captureProgress.current = Math.min(1, captureProgress.current + delta / CAPTURE_DURATION);
      const s = Math.max(0.001, 1 - captureProgress.current);
      g.scale.setScalar(s * pieceScale);
      g.position.y -= captureProgress.current * 0.3;
    } else {
      g.scale.setScalar(pieceScale);
    }
  });

  return (
    <group
      ref={groupRef}
      position={[start.x, 0, start.z]}
      scale={pieceScale}
      onClick={(e) => {
        e.stopPropagation();
        onSelect(row, col);
      }}
    >
      <mesh geometry={body} material={bodyMaterial} castShadow receiveShadow />
      {parts.map((part, i) => (
        <mesh
          key={i}
          geometry={part.geometry}
          material={part.materialKey === "slit" ? getSlitMaterial(color) : bodyMaterial}
          position={part.position}
          rotation={part.rotation}
          castShadow
        />
      ))}
      {isSelected && (
        <mesh position={[0, 0.02, 0]}>
          <torusGeometry args={[0.28, 0.015, 8, 24]} />
          <meshStandardMaterial color="#FFDF33" emissive="#FFDF33" emissiveIntensity={0.9} />
        </mesh>
      )}
    </group>
  );
}
