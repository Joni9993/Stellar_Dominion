import React, { useEffect, useRef } from 'react';
import { useGameStore } from '../store';
import { StarMap } from '../pixi/StarMap';
import { ARTIFACTS, FACTIONS } from '@stellar-dominion/shared';
import { CombatView } from './CombatView';
import { WinOverlay } from '../components/WinOverlay';

export function ObserverView() {
  const { matchState, activeView, gameSeed } = useGameStore();
  const canvasRef  = useRef<HTMLCanvasElement>(null);
  const starMapRef = useRef<StarMap | null>(null);

  // Init PixiJS once per game
  useEffect(() => {
    if (!canvasRef.current || !matchState) return;

    const map = new StarMap(
      canvasRef.current,
      matchState.galaxy,
      matchState.players,
      '', // no local player — no triangle indicator
      null,
      matchState.rumor.active ? matchState.rumor.systemId : null,
    );
    starMapRef.current = map;

    const observer = new ResizeObserver(() => map.resize());
    observer.observe(canvasRef.current);

    return () => {
      observer.disconnect();
      map.destroy();
      starMapRef.current = null;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gameSeed]);

  // Update map when state changes
  useEffect(() => {
    if (!starMapRef.current || !matchState) return;
    starMapRef.current.update(
      matchState.galaxy,
      matchState.players,
      null,
      matchState.rumor.active ? matchState.rumor.systemId : null,
    );
  }, [matchState]);

  if (!matchState) {
    return (
      <div style={{
        position: 'fixed', inset: 0, background: '#0c1018',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <div style={{ fontFamily: "'Press Start 2P'", fontSize: 9, color: 'var(--dim)' }}>
          WAITING FOR GAME TO START…
        </div>
      </div>
    );
  }

  const rumor         = matchState.rumor;
  const rumorArtifact = rumor.active ? ARTIFACTS[rumor.artifactId] : null;
  const rumorSystem   = rumor.active ? matchState.galaxy.systems[rumor.systemId] : null;
  const activePlayer  = matchState.players.find((p) => p.id === matchState.activePlayerId);
  const activeFaction = activePlayer ? FACTIONS[activePlayer.factionId] : null;

  return (
    <div style={{ position: 'fixed', inset: 0 }}>
      {/* Full-screen star map */}
      <div className="map-canvas-wrap" style={{ position: 'absolute', inset: 0 }}>
        <canvas ref={canvasRef} style={{ width: '100%', height: '100%' }} />

        <div className="corner tl">
          STELLAR DOMINION · OBSERVER<br />
          {matchState.players.length} COMMANDER{matchState.players.length !== 1 ? 'S' : ''}
        </div>
        <div className="corner tr">
          CYCLE {matchState.cycle} / {matchState.maxCycles}<br />
          WIN AT {matchState.winThreshold} ARTIFACTS
        </div>

        {/* Rumor banner (legacy CSS restored) */}
        {rumorArtifact && rumorSystem && (
          <div className="rumor-bar">
            RUMOR · {rumorArtifact.name.toUpperCase()} SIGHTED IN {rumorSystem.name.toUpperCase()} · {rumor.price}◈
          </div>
        )}

        {/* Active player indicator */}
        {activePlayer && (
          <div
            className="observer-active-player"
            style={{ color: activeFaction?.color ?? 'var(--bone)' }}
          >
            ► {activePlayer.name} COMMANDING
          </div>
        )}
      </div>

      {/* Combat overlay — auto-triggered via store when a fight starts */}
      {activeView === 'fight' && (
        <div style={{ position: 'absolute', inset: 0 }}>
          <CombatView />
        </div>
      )}

      <WinOverlay />
    </div>
  );
}
