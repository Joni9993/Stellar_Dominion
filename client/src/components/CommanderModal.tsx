import React from 'react';
import { PARTS, ARTIFACTS, CREW, FACTIONS, deriveStats } from '@stellar-dominion/shared';
import type { Player } from '@stellar-dominion/shared';
import { ShipContour } from './ShipContour';

const PART_COLORS: Record<string, string> = {
  weapon:   'var(--red)',
  shield:   'var(--teal)',
  armor:    'var(--teal)',
  pointdef: 'var(--teal)',
  gen:      'var(--amber)',
  cap:      'var(--amber)',
  engine:   'var(--green)',
  util:     'var(--dim)',
  artifact: 'var(--purple)',
};

function lookupGridItem(id: string) {
  const p = PARTS[id];
  if (p) return p;
  const a = ARTIFACTS[id];
  if (a) return { id: a.id, name: a.name, type: 'artifact' as const, zoneAffinity: [], stats: {}, cost: 0, icon: '✦' };
  return null;
}

export function CommanderModal({ player, onClose }: { player: Player; onClose: () => void }) {
  const faction = FACTIONS[player.factionId];
  const stats = deriveStats(player.build, PARTS, player.factionId);
  const crewFilled = player.crew.filter(Boolean);

  return (
    <div className="station-backdrop" onClick={onClose}>
      <div className="commander-modal" onClick={(e) => e.stopPropagation()}>

        {/* ── Header ── */}
        <div className="station-header">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
            <span style={{ fontFamily: "'Press Start 2P'", fontSize: 8, color: player.color, letterSpacing: 1 }}>
              {player.name}
            </span>
            <span style={{ fontSize: 13, color: 'var(--dim)', letterSpacing: 0.5 }}>
              {faction.fullName}
            </span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <span style={{ fontSize: 17, color: 'var(--amber)' }}>✦{player.artifacts.length}</span>
            <button className="station-close" onClick={onClose}>✕</button>
          </div>
        </div>

        {/* ── Body: ship left / info right ── */}
        <div className="commander-modal-body">

          {/* Ship visual */}
          <div className="commander-ship-col">
            {/* Wrapper clips the scaled hull-wrap to its zoomed dimensions */}
            <div style={{ width: 120, height: 174, position: 'relative', overflow: 'hidden', flexShrink: 0 }}>
              <div style={{ transform: 'scale(0.6)', transformOrigin: 'top left', position: 'absolute' }}>
                <div className="hull-wrap">
                  <ShipContour factionId={player.factionId} />

                  <div className="crew-row">
                    {player.crew.map((c, i) => (
                      <div key={i} className={`crew-slot ${c ? 'filled' : 'empty'}`} title={c ? CREW[c].name : 'Empty'}>
                        {c ? CREW[c].icon : '+'}
                      </div>
                    ))}
                  </div>

                  <div className="zone-labels">
                    {['BOW', 'CORE', 'STERN'].map((z) => <span key={z}>{z}</span>)}
                  </div>

                  <div className="build-grid">
                    {Array.from({ length: 9 }, (_, i) => {
                      const partId = player.build.grid[i];
                      const part = partId ? lookupGridItem(partId) : null;
                      const hasAdj = stats.adjacencyBonus[i];
                      return (
                        <div
                          key={i}
                          className={`build-cell ${partId ? 'filled' : ''} ${hasAdj ? 'adj' : ''}`}
                          style={part ? { '--cell-color': PART_COLORS[part.type] ?? 'var(--dim)' } as React.CSSProperties : undefined}
                          title={part?.name ?? `Slot ${i + 1}`}
                        >
                          {part && (
                            <span className="cell-icon" style={{ color: part.type === 'artifact' ? 'var(--purple)' : '#0c0f15' }}>
                              {part.icon}
                            </span>
                          )}
                          {hasAdj && <span className="adj-badge">+FR</span>}
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Info panel */}
          <div className="commander-info-col">

            {/* Resources */}
            <div className="sect">RESOURCES</div>
            <div className="kv"><span>CREDITS</span><b style={{ color: 'var(--amber)' }}>{player.credits}◈</b></div>
            <div className="kv"><span>FUEL</span><b style={{ color: 'var(--teal)' }}>{player.fuel}/{player.maxFuel}⛽</b></div>

            {/* Combat stats */}
            <div className="sect" style={{ marginTop: 12 }}>COMBAT STATS</div>
            <CdrStatBar label="HULL"        value={stats.hull}          max={260} color="var(--teal)" />
            <CdrStatBar label="SHIELD"      value={stats.shieldMax}     max={200} color="#7fd0cc" />
            <CdrStatBar label="ENERGY/TICK" value={stats.energyPerTick} max={35}  color="var(--amber)" />
            <CdrStatBar label="FIRE RATE"   value={stats.fireRate}      max={90}  color="var(--red)" />
            <CdrStatBar label="EVASION"     value={Math.round(stats.evasion * 100)} max={50} color="var(--green)" unit="%" />
            <CdrStatBar label="CARGO"       value={stats.cargo}         max={300} color="var(--dim)" />

            {/* Artifacts */}
            <div className="sect" style={{ marginTop: 12 }}>ARTIFACTS</div>
            {player.artifacts.length === 0 ? (
              <div style={{ fontSize: 13, color: 'var(--faint)' }}>None</div>
            ) : player.artifacts.map((id) => {
              const art = ARTIFACTS[id];
              if (!art) return null;
              const equipped = player.build.grid.includes(id);
              return (
                <div key={id} style={{ marginBottom: 8, paddingBottom: 7, borderBottom: '1px dotted #2a3545' }}>
                  <div style={{ fontSize: 14, color: 'var(--purple)', display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
                    ✦ {art.name}
                    {equipped && (
                      <span style={{ fontFamily: "'Press Start 2P'", fontSize: 5, color: 'var(--teal)', letterSpacing: 0.5 }}>
                        EQUIPPED
                      </span>
                    )}
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--dim)', lineHeight: 1.4 }}>{art.description}</div>
                </div>
              );
            })}

            {/* Crew */}
            <div className="sect" style={{ marginTop: 12 }}>CREW</div>
            {crewFilled.length === 0 ? (
              <div style={{ fontSize: 13, color: 'var(--faint)' }}>No crew hired</div>
            ) : player.crew.map((c, i) =>
              c ? (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
                  <div style={{
                    width: 28, height: 28, background: 'var(--panel3)', border: '1px solid var(--teal)',
                    display: 'grid', placeItems: 'center', fontSize: 13, color: 'var(--teal)', flexShrink: 0,
                  }}>
                    {CREW[c].icon}
                  </div>
                  <div>
                    <div style={{ fontSize: 14 }}>{CREW[c].name}
                      <span style={{ fontSize: 11, color: 'var(--dim)', marginLeft: 6 }}>{CREW[c].role}</span>
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--dim)' }}>{CREW[c].bonus}</div>
                  </div>
                </div>
              ) : null
            )}

          </div>
        </div>
      </div>
    </div>
  );
}

function CdrStatBar({
  label, value, max, color, unit = '',
}: { label: string; value: number; max: number; color: string; unit?: string }) {
  const pct = Math.min(100, (value / max) * 100);
  return (
    <div style={{ marginBottom: 7 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: 'var(--dim)', marginBottom: 2 }}>
        <span>{label}</span>
        <span style={{ color: 'var(--bone)' }}>{value}{unit}</span>
      </div>
      <div style={{ height: 7, background: 'var(--panel3)', border: '1px solid var(--line)', position: 'relative' }}>
        <div style={{
          position: 'absolute', inset: 0, width: `${pct}%`,
          background: `repeating-linear-gradient(90deg, ${color} 0 5px, #0003 5px 6px)`,
        }} />
      </div>
    </div>
  );
}
