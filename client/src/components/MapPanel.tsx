import React, { useState } from 'react';
import { useGameStore, selectMyPlayer, selectCurrentSystem, selectReachableSystems } from '../store';
import { ARTIFACTS, CREW, PARTS, canClaimArtifact, deriveStats } from '@stellar-dominion/shared';
import type { Player } from '@stellar-dominion/shared';
import { CommanderModal } from './CommanderModal';

export function MapPanel() {
  const store = useGameStore();
  const { matchState, selectedSystemId, myPlayerId, setView, jump, openStation, jumpsUsed, hasActed, claimArtifact, startCombat } = store;
  const [targetModalOpen, setTargetModalOpen] = useState(false);
  const [viewingCommander, setViewingCommander] = useState<Player | null>(null);

  if (!matchState) return <div className="side-panel" />;

  const me = selectMyPlayer(store);
  const mySys = selectCurrentSystem(store);
  const reachable = selectReachableSystems(store);

  const sys = selectedSystemId !== null
    ? matchState.galaxy.systems[selectedSystemId]
    : null;

  const rumor       = matchState.rumor;
  const isRumor     = sys?.id === rumor.systemId && rumor.active;
  const rumorArt    = isRumor ? ARTIFACTS[rumor.artifactId] : null;
  const rivalsInSys = matchState.players.filter((p) => p.systemId === selectedSystemId && p.id !== myPlayerId);
  const isMySystem  = sys?.id === me?.systemId;
  const maxJumps    = me ? deriveStats(me.build, PARTS, me.factionId).range : 1;
  const jumpCost    = sys ? reachable.get(sys.id) : undefined;
  const canJumpHere = jumpsUsed < maxJumps && jumpCost !== undefined && (me?.fuel ?? 0) >= jumpCost;
  const claimCheck  = isMySystem && isRumor && me ? canClaimArtifact(matchState, myPlayerId) : { ok: false, reason: '' };

  function handleAttack() {
    if (rivalsInSys.length === 1) {
      startCombat(rivalsInSys[0].id);
    } else {
      setTargetModalOpen(true);
    }
  }

  function handleSelectTarget(targetId: string) {
    setTargetModalOpen(false);
    startCombat(targetId);
  }

  if (!sys) {
    return (
      <div className="side-panel">
        <div className="panel-title">GALAXY</div>
        <div className="panel-body" style={{ color: 'var(--dim)', fontSize: 15, paddingTop: 16 }}>
          Select a system on the map.
        </div>
      </div>
    );
  }

  return (
    <div className="side-panel">
      <div className="panel-title">
        {sys.name}
        <span className="panel-badge" style={{ background: isRumor ? 'var(--amber)' : 'var(--teal)' }}>
          {isRumor ? 'RUMOR' : 'SYSTEM'}
        </span>
      </div>

      <div className="panel-body">
        <div className="kv"><span>STATION</span><b>{sys.hasStation ? 'Yes · Trade' : 'None'}</b></div>
        <div className="kv"><span>REGION</span><b>{sys.region}</b></div>

        {jumpCost !== undefined && (
          <div className="kv">
            <span>JUMP COST</span>
            <b style={{ color: (me?.fuel ?? 0) >= jumpCost ? 'var(--teal)' : 'var(--red)' }}>
              {jumpCost}⛽
            </b>
          </div>
        )}

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
            {rivalsInSys.length > 0 && (
              <div style={{ fontSize: 13, color: 'var(--red)', marginTop: 5 }}>
                ⚠ {rivalsInSys.map((r) => r.name).join(', ')} {rivalsInSys.length === 1 ? 'is' : 'are'} here — contested!
              </div>
            )}
          </>
        )}

        {rivalsInSys.length > 0 && !isRumor && (
          <>
            <div className="sect">{rivalsInSys.length === 1 ? 'COMMANDER HERE' : 'COMMANDERS HERE'}</div>
            {rivalsInSys.map((rival) => (
              <button
                key={rival.id}
                className="commander-entry-btn"
                onClick={() => setViewingCommander(rival)}
              >
                <span style={{ color: rival.color }}>▲</span>
                <span style={{ color: rival.color, flex: 1 }}>{rival.name}</span>
                <span style={{ color: 'var(--amber)', fontSize: 13 }}>✦{rival.artifacts.length}</span>
                <span style={{ color: 'var(--faint)', fontSize: 11 }}>›</span>
              </button>
            ))}
          </>
        )}
      </div>

      <div className="panel-actions">
        {isMySystem && rivalsInSys.length > 0 && (
          <button
            className="btn danger"
            disabled={hasActed}
            title={hasActed ? 'Already acted this turn' : ''}
            onClick={handleAttack}
          >
            ⚔ ATTACK
          </button>
        )}
        {isRumor && rumorArt && (
          <button
            className="btn primary"
            disabled={!claimCheck.ok}
            title={!claimCheck.ok ? (claimCheck as { ok: false; reason: string }).reason : ''}
            onClick={() => { if (claimCheck.ok) claimArtifact(); }}
          >
            ✦ CLAIM · {rumor.price}◈
          </button>
        )}
        {!isMySystem && (
          <button
            className="btn"
            disabled={!canJumpHere}
            title={jumpsUsed >= maxJumps ? 'No jumps remaining this turn' : jumpCost === undefined ? 'Not adjacent' : ''}
            onClick={() => canJumpHere && jump(sys.id)}
          >
            JUMP HERE {jumpCost !== undefined ? `· ${jumpCost}⛽` : ''}
          </button>
        )}
      </div>

      {targetModalOpen && (
        <TargetSelectModal
          rivals={rivalsInSys}
          systemName={sys.name}
          onSelect={handleSelectTarget}
          onClose={() => setTargetModalOpen(false)}
        />
      )}

      {viewingCommander && (
        <CommanderModal
          player={viewingCommander}
          onClose={() => setViewingCommander(null)}
        />
      )}
    </div>
  );
}

// ── Target selection modal ────────────────────────────────────────────────────

type Rival = { id: string; name: string; color: string; artifacts: string[]; factionId: string };

function TargetSelectModal({
  rivals,
  systemName,
  onSelect,
  onClose,
}: {
  rivals: Rival[];
  systemName: string;
  onSelect: (id: string) => void;
  onClose: () => void;
}) {
  return (
    <div className="target-modal-backdrop" onClick={onClose}>
      <div className="target-modal" onClick={(e) => e.stopPropagation()}>
        <div className="target-modal-header">
          <span>SELECT TARGET</span>
          <button className="station-close" onClick={onClose}>✕</button>
        </div>
        <div style={{ fontSize: 12, color: 'var(--dim)', padding: '4px 12px 8px' }}>
          {systemName} · {rivals.length} commanders present
        </div>
        {rivals.map((rival) => (
          <button
            key={rival.id}
            className="target-row"
            onClick={() => onSelect(rival.id)}
          >
            <span className="target-tri" style={{ color: rival.color }}>▲</span>
            <span className="target-name" style={{ color: rival.color }}>{rival.name}</span>
            <span className="target-arts" style={{ color: 'var(--amber)' }}>
              ✦{rival.artifacts.length}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}
