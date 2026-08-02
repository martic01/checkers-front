import { useMemo } from "react";
import * as THREE from "three";
import { getBoardMaterials } from "./materials.js";
import { getWorldPosition, SQUARE_SIZE } from "./coords.js";

const SQUARE_HEIGHT = 0.12;
const FRAME_THICKNESS = 0.35;
const FRAME_HEIGHT = 0.22;

// One shared box geometry for every square (position/material differ per
// instance, the geometry never does) — built once per board mount, not
// once per square.
export default function Chess3DBoard({ orientation, onSquareClick, squareState }) {
  const materials = getBoardMaterials();
  const squareGeometry = useMemo(() => new THREE.BoxGeometry(SQUARE_SIZE * 0.98, SQUARE_HEIGHT, SQUARE_SIZE * 0.98), []);

  const squares = useMemo(() => {
    const list = [];
    for (let row = 0; row < 8; row++) {
      for (let col = 0; col < 8; col++) {
        list.push({ row, col, isLight: (row + col) % 2 === 0 });
      }
    }
    return list;
  }, []);

  return (
    <group>
      {/* Raised outer frame — real geometric thickness, not a CSS trick. */}
      <mesh position={[0, -SQUARE_HEIGHT / 2 - FRAME_HEIGHT / 2 + 0.01, 0]} receiveShadow castShadow>
        <boxGeometry args={[8 * SQUARE_SIZE + FRAME_THICKNESS * 2, FRAME_HEIGHT, 8 * SQUARE_SIZE + FRAME_THICKNESS * 2]} />
        <primitive object={materials.frame} attach="material" />
      </mesh>

      {squares.map(({ row, col, isLight }) => {
        const { x, z } = getWorldPosition(row, col, orientation);
        const key = `${row}-${col}`;
        const state = squareState?.(row, col);
        return (
          <group key={key} position={[x, 0, z]}>
            <mesh
              geometry={squareGeometry}
              receiveShadow
              onClick={(e) => {
                e.stopPropagation();
                onSquareClick(row, col);
              }}
            >
              <primitive object={isLight ? materials.light : materials.dark} attach="material" />
            </mesh>
            {state?.lastMove && (
              <mesh position={[0, SQUARE_HEIGHT / 2 + 0.005, 0]} rotation={[-Math.PI / 2, 0, 0]}>
                <planeGeometry args={[SQUARE_SIZE * 0.94, SQUARE_SIZE * 0.94]} />
                <primitive object={state.lastMoveMaterial} attach="material" />
              </mesh>
            )}
            {state?.check && (
              <mesh position={[0, SQUARE_HEIGHT / 2 + 0.006, 0]} rotation={[-Math.PI / 2, 0, 0]}>
                <planeGeometry args={[SQUARE_SIZE * 0.98, SQUARE_SIZE * 0.98]} />
                <primitive object={state.checkMaterial} attach="material" />
              </mesh>
            )}
            {state?.selected && (
              <mesh position={[0, SQUARE_HEIGHT / 2 + 0.012, 0]} rotation={[-Math.PI / 2, 0, 0]}>
                <circleGeometry args={[0.42, 28]} />
                <primitive object={state.selectedMaterial} attach="material" />
              </mesh>
            )}
            {state?.moveDot && (
              <mesh position={[0, SQUARE_HEIGHT / 2 + 0.08, 0]}>
                <sphereGeometry args={[0.09, 12, 10]} />
                <primitive object={state.moveDotMaterial} attach="material" />
              </mesh>
            )}
            {state?.captureRing && (
              <mesh position={[0, SQUARE_HEIGHT / 2 + 0.01, 0]} rotation={[-Math.PI / 2, 0, 0]}>
                <ringGeometry args={[0.38, 0.46, 24]} />
                <primitive object={state.captureRingMaterial} attach="material" />
              </mesh>
            )}
          </group>
        );
      })}
    </group>
  );
}
