import React, { useEffect, useRef, useState } from 'react';
import { useGameStore } from '../store';
import { StarMap } from '../pixi/StarMap';
import { ARTIFACTS, CREW, FACTIONS, PARTS } from '@stellar-dominion/shared';
import { CombatView } from './CombatView';
import { WinOverlay } from '../components/WinOverlay';

// ── Read-only system info panel ───────────────────────────────────────────────

function ObserverSystemPanel({ systemId, onClose }: { systemId: number; onClose: () => void }) {
  const matchState = useGameStore((s) => s.matchState);
  if (!matchState) return null;

  const sys        = matchState.galaxy.systems[systemId];
  const rumor      = matchState.rumor;
  const isRumor    = sys.id === rumor.systemId && rumor.active;
  const rumorArt   = isRumor ? ARTIFACTS[rumor.artifactId] : null;
  const commanders = matchState.players.filter((p) => p.systemId === systemId);

  return (
    <div className="observer-sys-panel" onClick={(e) => e.stopPropagation()}>
      <div className="observer-sys-header">
        <span style={{ color: isRumor ? 'var(--amber)' : 'var(--bone)' }}>
          {isRumor && '✦ '}{sys.name}
        </span>
        <button className="station-close" onClick={onClose}>✕</button>
      </div>

      <div className="observer-sys-body">
        <div className="kv"><span>REGION</span><b>{sys.region}</b></div>
        <div className="kv"><span>STATION</span><b>{sys.hasStation ? 'Yes' : 'None'}</b></div>

        {sys.market.length > 0 && (
          <>
            <div className="sect">MARKET</div>
            {sys.market.map((m) => (
              <div className="kv" key={m.good}>
                <span style={{ textTransform: 'uppercase' }}>{m.good.replace('_', ' ')}</span>
                {m.mode === 'buy_only'
                  ? <b style={{ color: 'var(--teal)' }}>BUY {m.buy}◈ · {m.stock} left</b>
                  : <b style={{ color: 'var(--green)' }}>PAYS {m.sell}◈</b>
                }
              </div>
            ))}
          </>
        )}

        {sys.hasStation && (
          <div className="kv"><span>FUEL</span><b>{sys.fuelPrice}◈/unit</b></div>
        )}

        {sys.hasStation && sys.stationModules.length > 0 && (
          <>
            <div className="sect">MODULES</div>
            {sys.stationModules.map((id) => (
              <div className="kv" key={id}>
                <span>{PARTS[id]?.name ?? id}</span>
                <b style={{ color: 'var(--dim)' }}>{PARTS[id]?.cost ?? '?'}◈</b>
              </div>
            ))}
          </>
        )}

        {sys.hasStation && sys.stationCrew.length > 0 && (
          <>
            <div className="sect">CREW</div>
            {sys.stationCrew.map((id) => (
              <div className="kv" key={id}>
                <span>{CREW[id]?.name ?? id}</span>
                <b style={{ color: 'var(--dim)' }}>{CREW[id]?.cost ?? '?'}◈</b>
              </div>
            ))}
          </>
        )}

        {isRumor && rumorArt && (
          <>
            <div className="sect">RUMORED ARTIFACT</div>
            <div style={{ fontSize: 15, color: 'var(--amber)', marginBottom: 4 }}>
              ✦ {rumorArt.name}
              <span style={{ color: 'var(--dim)' }}> · {rumor.price}◈</span>
            </div>
            <div style={{ fontSize: 13, color: 'var(--dim)' }}>{rumorArt.description}</div>
          </>
        )}

        {commanders.length > 0 && (
          <>
            <div className="sect">{commanders.length === 1 ? 'COMMANDER' : 'COMMANDERS'}</div>
            {commanders.map((p) => (
              <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 0' }}>
                <span style={{ color: p.color }}>▲</span>
                <span style={{ color: p.color, flex: 1, fontSize: 14 }}>{p.name}</span>
                <span style={{ color: 'var(--dim)', fontSize: 12 }}>{FACTIONS[p.factionId]?.name}</span>
                <span style={{ color: 'var(--amber)', fontSize: 13 }}>✦{p.artifacts.length}</span>
                <span style={{ color: 'var(--teal)', fontSize: 12 }}>{p.credits}◈</span>
              </div>
            ))}
          </>
        )}
      </div>
    </div>
  );
}

// ── Observer view ─────────────────────────────────────────────────────────────

export function ObserverView() {
  const { matchState, activeView, gameSeed } = useGameStore();
  const canvasRef  = useRef<HTMLCanvasElement>(null);
  const starMapRef = useRef<StarMap | null>(null);

  // Local system selection — doesn't pollute the global player store
  const [selectedSystem, setSelectedSystem] = useState<number | null>(null);

  // Init PixiJS once per game
  useEffect(() => {
    if (!canvasRef.current || !matchState) return;

    const map = new StarMap(
      canvasRef.current,
      matchState.galaxy,
      matchState.players,
      '', // no local player highlight — all triangles shown equally
      selectedSystem,
      matchState.rumor.active ? matchState.rumor.systemId : null,
    );
    map.onSystemClick = (id) => setSelectedSystem((prev) => (prev === id ? null : id));
    starMapRef.current = map;

    const resizeObs = new ResizeObserver(() => map.resize());
    resizeObs.observe(canvasRef.current);

    return () => {
      resizeObs.disconnect();
      map.destroy();
      starMapRef.current = null;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gameSeed]);

  // Live-update: player positions, rumor, selection ring
  useEffect(() => {
    if (!starMapRef.current || !matchState) return;
    starMapRef.current.update(
      matchState.galaxy,
      matchState.players,
      selectedSystem,
      matchState.rumor.active ? matchState.rumor.systemId : null,
    );
  }, [matchState, selectedSystem]);

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

  const inCombat = activeView === 'fight';

  return (
    <div style={{ position: 'fixed', inset: 0, background: '#0c1018' }}>
      {/* ── Star map — hidden during combat ── */}
      <div style={{ display: inCombat ? 'none' : 'block', position: 'absolute', inset: 0 }}>
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

          {/* Rumor banner — map only */}
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

        {/* System info panel */}
        {selectedSystem !== null && (
          <ObserverSystemPanel
            systemId={selectedSystem}
            onClose={() => setSelectedSystem(null)}
          />
        )}
      </div>

      {/* ── Combat — full screen, no map behind it ── */}
      {inCombat && (
        <div style={{ position: 'absolute', inset: 0 }}>
          <CombatView />
        </div>
      )}

      <WinOverlay />
    </div>
  );
}
