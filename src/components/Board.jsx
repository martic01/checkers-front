import { useMemo, useState, useCallback, useEffect, useRef } from "react";
import "./Board.css";
import { BOARD_SIZE, isDark } from "../game/checkersLogic.js";

const COLS = "ABCDEFGHIJ".split("");

export default function Board({
  board,
  pieces = [],
  turn,
  legalMoves,
  onMove,
  onInvalid,
  view = "HORIZ",
  playerColor = "white",
  forceOrientToPlayer = false,
  helper = true,
  disabled = false,
  lastMove = null,
}) {
  const [selected, setSelected] = useState(null);
  const [is3D, setIs3D] = useState(false);
  
  // High-impact multi-axis tracking matrices
  const [rotation, setRotation] = useState({ x: 0, z: 0 });
  const dragRef = useRef({ 
    dragging: false, 
    startX: 0, 
    startY: 0, 
    startIdxX: 0, 
    startIdxZ: 0,
    velX: 0,
    velZ: 0,
    lastTime: 0
  });
  const inertiaRef = useRef(null);

  useEffect(() => setSelected(null), [board]);

  const movesFrom = useMemo(() => {
    const map = new Map();
    for (const move of legalMoves) {
      const key = `${move.from.row}-${move.from.col}`;
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(move);
    }
    return map;
  }, [legalMoves]);

  const selectableSquares = useMemo(() => new Set(movesFrom.keys()), [movesFrom]);

  const destinationsForSelected = useMemo(() => {
    if (!selected) return [];
    return movesFrom.get(`${selected.row}-${selected.col}`) || [];
  }, [selected, movesFrom]);

  const handleSquareClick = useCallback(
    (row, col) => {
      if (disabled) return;
      const key = `${row}-${col}`;
      const piece = board[row][col];

      if (selected) {
        const move = destinationsForSelected.find((m) => m.to.row === row && m.to.col === col);
        if (move) {
          onMove(move);
          setSelected(null);
          return;
        }
      }

      if (piece && piece.color === turn && selectableSquares.has(key)) {
        setSelected({ row, col });
      } else {
        if (piece || selected) onInvalid?.();
        setSelected(null);
      }
    },
    [board, disabled, destinationsForSelected, onMove, onInvalid, selected, selectableSquares, turn]
  );

  const rotated = forceOrientToPlayer ? playerColor === "black" : view === "VERT" && playerColor === "black";

  const handleRotateStart = useCallback((clientX, clientY) => {
    if (inertiaRef.current) cancelAnimationFrame(inertiaRef.current);
    dragRef.current = {
      dragging: true,
      startX: clientX,
      startY: clientY,
      startIdxX: rotation.x,
      startIdxZ: rotation.z,
      velX: 0,
      velZ: 0,
      lastTime: performance.now()
    };
  }, [rotation]);

  const handleRotateMove = useCallback((clientX, clientY) => {
    if (!dragRef.current.dragging) return;
    const now = performance.now();
    const dt = Math.max(now - dragRef.current.lastTime, 1);
    
    const deltaX = clientX - dragRef.current.startX;
    const deltaY = clientY - dragRef.current.startY;

    let nextZ = (dragRef.current.startIdxZ + deltaX * 0.7) % 360;
    if (nextZ < 0) nextZ += 360;

    // Expanded cinematic tilt capacity: 0deg to 75deg pitch tracking
    let nextX = Math.max(0, Math.min(75, dragRef.current.startIdxX - deltaY * 0.5));

    dragRef.current.velZ = ((nextZ - rotation.z) / dt) * 16;
    dragRef.current.velX = ((nextX - rotation.x) / dt) * 16;
    
    dragRef.current.lastTime = now;
    setRotation({ x: nextX, z: nextZ });
  }, [rotation]);

  const handleRotateEnd = useCallback(() => {
    if (!dragRef.current.dragging) return;
    dragRef.current.dragging = false;

    const applyInertia = () => {
      dragRef.current.velX *= 0.93;
      dragRef.current.velZ *= 0.93;

      setRotation((prev) => {
        let nZ = (prev.z + dragRef.current.velZ) % 360;
        let nX = Math.max(0, Math.min(75, prev.x + dragRef.current.velX));
        if (nZ < 0) nZ += 360;

        if (Math.abs(dragRef.current.velX) > 0.04 || Math.abs(dragRef.current.velZ) > 0.04) {
          inertiaRef.current = requestAnimationFrame(applyInertia);
        }
        return { x: nX, z: nZ };
      });
    };
    inertiaRef.current = requestAnimationFrame(applyInertia);
  }, []);

  const handleReset = () => {
    if (inertiaRef.current) cancelAnimationFrame(inertiaRef.current);
    setRotation({ x: 0, z: 0 });
  };

  useEffect(() => {
    const onMove = (e) => {
      const clientX = e.touches ? e.touches[0].clientX : e.clientX;
      const clientY = e.touches ? e.touches[0].clientY : e.clientY;
      handleRotateMove(clientX, clientY);
    };
    const onUp = () => handleRotateEnd();
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    window.addEventListener("touchmove", onMove, { passive: false });
    window.addEventListener("touchend", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
      window.removeEventListener("touchmove", onMove);
      window.removeEventListener("touchend", onUp);
      if (inertiaRef.current) cancelAnimationFrame(inertiaRef.current);
    };
  }, [handleRotateMove, handleRotateEnd]);

  const rows = [...Array(BOARD_SIZE).keys()];
  const cols = [...Array(BOARD_SIZE).keys()];
  const rowOrder = rotated ? [...rows].reverse() : rows;
  const colOrder = rotated ? [...cols].reverse() : cols;

  const displayPos = (row, col) => ({
    dRow: rotated ? BOARD_SIZE - 1 - row : row,
    dCol: rotated ? BOARD_SIZE - 1 - col : col,
  });

  const finalPitch = is3D ? 38 + rotation.x * 0.49 : 0;
  const finalYaw = rotation.z;

  return (
    <div className={`board-wrap ${view === "VERT" ? "board-wrap--vert" : "board-wrap--horiz"} ${is3D ? "mode-3d" : ""}`}>
      <svg className="grain-defs" width="0" height="0">
        <defs>
          <filter id="wood-grain-hq" x="0%" y="0%" width="100%" height="100%">
            <feTurbulence type="fractalNoise" baseFrequency="0.015 0.05" numOctaves="4" seed="42" result="noise" />
            <feColorMatrix type="matrix" values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 0.16 0" result="grain"/>
            <feTurbulence type="turbulence" baseFrequency="0.04" numOctaves="2" seed="15" result="pores" />
            <feColorMatrix type="matrix" values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 0.09 0" result="poresLight"/>
            <feMerge>
              <feMergeNode in="grain" />
              <feMergeNode in="poresLight" />
            </feMerge>
          </filter>
        </defs>
      </svg>

      <div className="board-coords board-coords--top">
        {colOrder.map((c) => <span key={c}>{COLS[c]}</span>)}
      </div>
      
      <div className="board-middle">
        <div className="board-coords board-coords--left">
          {rowOrder.map((r) => <span key={r}>{BOARD_SIZE - r}</span>)}
        </div>

        <div className="board-3d-perspective">
          <div
            className={`board-stage ${is3D ? "board-stage--3d" : ""}`}
            style={{ transform: `rotateX(${finalPitch}deg) rotateZ(${finalYaw}deg)` }}
          >
            {/* Structural Architectural 3D Side Frame Mesh Elements */}
            <div className="board-wall board-wall--front"></div>
            <div className="board-wall board-wall--back"></div>
            <div className="board-wall board-wall--left"></div>
            <div className="board-wall board-wall--right"></div>
            <div className="board-wall board-wall--bottom"></div>
            
            <div className="board-surface-slab">
              <div className="board-grid">
                {rowOrder.map((row) =>
                  colOrder.map((col) => {
                    const dark = isDark(row, col);
                    const key = `${row}-${col}`;
                    const isSelected = selected && selected.row === row && selected.col === col;
                    const isDestination = destinationsForSelected.some((m) => m.to.row === row && m.to.col === col);
                    const isSelectable = helper && selectableSquares.has(key) && board[row][col]?.color === turn;
                    const isLastMove =
                      lastMove &&
                      ((lastMove.from.row === row && lastMove.from.col === col) ||
                        (lastMove.to.row === row && lastMove.to.col === col));

                    const grainVariant = (row * 3 + col * 7) % 4;

                    return (
                      <div
                        key={key}
                        className={[
                          "square",
                          dark ? "square--dark" : "square--light",
                          `grain-v--${grainVariant}`,
                          isSelected ? "square--selected" : "",
                          isDestination ? "square--destination" : "",
                          isSelectable ? "square--hint" : "",
                          isLastMove ? "square--last-move" : "",
                        ]
                          .filter(Boolean)
                          .join(" ")}
                        onClick={() => dark && handleSquareClick(row, col)}
                      >
                        {isDestination && <span className="dot" />}
                      </div>
                    );
                  })
                )}
              </div>

              <div className="pieces-layer">
                {pieces.map((p) => {
                  const { dRow, dCol } = displayPos(p.row, p.col);
                  const isSelected = selected && selected.row === p.row && selected.col === p.col && !p.capturing;
                  return (
                    <div
                      key={p.id}
                      className={[
                        "piece-token",
                        `piece-token--${p.color}`,
                        p.king ? "piece-token--king" : "",
                        p.capturing ? "piece-token--capturing" : "",
                        isSelected ? "piece-token--selected" : "",
                      ]
                        .filter(Boolean)
                        .join(" ")}
                      style={{ left: `${dCol * 10}%`, top: `${dRow * 10}%` }}
                    >
                      <div className="piece-shadow-container"></div>
                      <div className="piece-body-3d">
                        <div className="piece-layer-slice slice-base"></div>
                        <div className="piece-layer-slice slice-mid"></div>
                        <div className="piece-layer-slice slice-deep"></div>
                        <div className="piece-layer-slice slice-top">
                          <div className="piece-concentric-ridges">
                            {p.king && (
                              <div className="premium-crown-container">
                                <svg className="crown-svg" viewBox="0 0 24 24">
                                  <path d="M2 22h20v-2H2v2zm2-4h16v-3l-3.5 2.5-2.5-4.5-2 3.5-2-3.5-2.5 4.5L4 15v3z" />
                                </svg>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>

        <div className="board-coords board-coords--right">
          {rowOrder.map((r) => <span key={r}>{BOARD_SIZE - r}</span>)}
        </div>
      </div>
      
      <div className="board-coords board-coords--bottom">
        {colOrder.map((c) => <span key={c}>{COLS[c]}</span>)}
      </div>

      <div className="board-3d-controls">
        <button
          type="button"
          className={`board-3d-toggle ${is3D ? "board-3d-toggle--active" : ""}`}
          onClick={() => setIs3D((v) => !v)}
          title={is3D ? "Switch to Physical 2D View" : "Enable Premium 3D View"}
        >
          <span className="btn-icon">🧊</span>
          <span className="btn-text">{is3D ? "Physical 2D" : "Premium 3D"}</span>
        </button>
        <div
          className="board-rotate-handle"
          onMouseDown={(e) => handleRotateStart(e.clientX, e.clientY)}
          onTouchStart={(e) => handleRotateStart(e.touches[0].clientX, e.touches[0].clientY)}
          title="Drag to Orbit Object Viewport"
        >
          <span className="btn-icon">↻</span>
          <span className="btn-text">Drag to Orbit</span>
        </div>
        {(rotation.x !== 0 || rotation.z !== 0) && (
          <button 
            type="button" 
            className="board-3d-toggle board-3d-reset" 
            onClick={handleReset}
            title="Reset Camera Orientation"
          >
            <span className="btn-icon">🎯</span>
            <span className="btn-text">Reset</span>
          </button>
        )}
      </div>
    </div>
  );
}

