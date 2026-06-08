import React, { useEffect, useRef } from 'react';
import { useGameStore } from '../store';
import { StarMap } from '../pixi/StarMap';
import { ARTIFACTS } from '@stellar-dominion/shared';

export function MapView() {
  const { matchState, selectedSystemId, myPlayerId, selectSystem, gameSeed } = useGameStore();
  const canvasRef  = useRef<HTMLCanvasElement>(null);
  const starMapRef = useRef<StarMap | null>(null);

  // Init PixiJS once per game (gameSeed only changes on initGame, never on trades/refuel)
  useEffect(() => {
    if (!canvasRef.current || !matchState) return;

    const map = new StarMap(
      canvasRef.current,
      matchState.galaxy,
      matchState.players,
      myPlayerId,
      selectedSystemId,
      matchState.rumor.active ? matchState.rumor.systemId : null,
    );
    map.onSystemClick = (id) => selectSystem(id);
    starMapRef.current = map;

    const observer = new ResizeObserver(() => map.resize());
    observer.observe(canvasRef.current);

    return () => {
      observer.disconnect();
      map.destroy();
      starMapRef.current = null;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gameSeed]); // gameSeed is stable across trades — only changes on new game

  // Re-render when selection or players change (no full rebuild needed)
  useEffect(() => {
    if (!starMapRef.current || !matchState) return;
    starMapRef.current.update(
      matchState.galaxy,
      matchState.players,
      selectedSystemId,
      matchState.rumor.active ? matchState.rumor.systemId : null,
    );
  }, [selectedSystemId, matchState]);

  if (!matchState) return null;

  const rumor         = matchState.rumor;
  const rumorArtifact = rumor.active ? ARTIFACTS[rumor.artifactId] : null;
  const rumorSystem   = rumor.active ? matchState.galaxy.systems[rumor.systemId] : null;
  const cycle         = matchState.cycle;
  const maxCycles     = matchState.maxCycles;
  const winAt         = matchState.winThreshold;

  return (
    <>
      <div className="map-canvas-wrap">
        <canvas ref={canvasRef} />

        <div className="corner tl">
          SECTOR ORION · 18 SYSTEMS<br />
          {matchState.players.length} COMMANDER{matchState.players.length !== 1 ? 'S' : ''}
        </div>
        <div className="corner tr">
          CYCLE {cycle} / {maxCycles}<br />
          WIN AT {winAt} ARTIFACTS
        </div>
        <div className="corner br">
          {selectedSystemId !== null
            ? matchState.galaxy.systems[selectedSystemId]?.name + ' ◄'
            : 'SELECT A SYSTEM ►'}
        </div>
      </div>

    </>
  );
}
