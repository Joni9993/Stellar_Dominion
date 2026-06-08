import React, { useState } from 'react';
import { useGameStore } from '../store';
import { ShipContour } from '../components/ShipContour';
import { PARTS, ARTIFACTS, deriveStats, indexToZone } from '@stellar-dominion/shared';
import type { Part } from '@stellar-dominion/shared';

function lookupGridItem(id: string): (Part & { isArtifact?: boolean }) | null {
  const p = PARTS[id];
  if (p) return p;
  const a = ARTIFACTS[id];
  if (a) return { id: a.id, name: a.name, type: 'artifact', zoneAffinity: [], stats: {}, cost: 0, icon: '✦', isArtifact: true };
  return null;
}

// Groups for ordering palette display (used for ownedModules grouping)
const MODULE_TYPE_GROUPS: { label: string; ids: string[] }[] = [
  { label: 'WEAPONS',  ids: ['pulse-laser', 'railgun', 'missile-pod'] },
  { label: 'DEFENSE',  ids: ['shield-projector', 'armor-plate', 'point-defense'] },
  { label: 'ENERGY',   ids: ['reactor', 'capacitor', 'advanced-reactor', 'advanced-capacitor'] },
  { label: 'MOBILITY', ids: ['ion-engine', 'fuel-tank', 'cargo-bay'] },
];

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

const ZONE_LABELS = ['BOW', 'CORE', 'STERN'] as const;
type ZoneLabel = typeof ZONE_LABELS[number];

const ZONE_INFO: Record<ZoneLabel, { effect: string; bestFor: string }> = {
  BOW: {
    effect: 'Weapons placed here gain +10% fire rate and +10% accuracy in combat.',
    bestFor: 'Weapons (Pulse Laser, Railgun, Missile Pod)',
  },
  CORE: {
    effect: 'No direct zone bonus — but this is the adjacency hub. A Reactor or Capacitor placed next to a weapon grants +15% fire rate to both modules.',
    bestFor: 'Energy modules (Reactor, Capacitor)',
  },
  STERN: {
    effect: 'No direct combat bonus. Recommended zone for mobility and utility modules by convention.',
    bestFor: 'Mobility modules (Ion Engine, Fuel Tank, Cargo Bay)',
  },
};

// Combat data for weapons — mirrors WEAPON_STATS in combatEngine.ts
const WEAPON_COMBAT_STATS: Record<string, { damage: number; accuracy: number; cooldown: number }> = {
  'pulse-laser': { damage: 3,  accuracy: 0.85, cooldown: 14 },
  'railgun':     { damage: 8,  accuracy: 0.72, cooldown: 22 },
  'missile-pod': { damage: 5,  accuracy: 0.90, cooldown: 20 },
};

// Additional combat context not captured in Part.stats
const PART_COMBAT_NOTES: Record<string, string> = {
  'armor-plate':    '+6 armor reduces incoming physical hits',
  'point-defense':  '50% chance to intercept incoming Missiles',
  'reactor':        'Adjacent to a weapon → +15% fire rate for both',
  'capacitor':      'Adjacent to a weapon → +15% fire rate for both',
  'advanced-reactor':   'Adjacent to a weapon → +15% fire rate for both',
  'advanced-capacitor': 'Adjacent to a weapon → +15% fire rate for both',
};

// RPS counter information
const RPS_INFO: Record<string, { strong?: string[]; weak?: string[] }> = {
  'pulse-laser':      { strong: ['×1.5 damage vs Shields'], weak: ['×0.6 damage vs Armor'] },
  'railgun':          { strong: ['×1.5 damage vs Armor'],   weak: ['×0.6 damage vs Shields'] },
  'missile-pod':      { strong: ['bypasses Shields completely'], weak: ['50% intercepted by Point-Defense'] },
  'shield-projector': { strong: ['reduces Railgun/Kinetic damage (×0.6)'], weak: ['Laser deals ×1.5 damage through it'] },
  'armor-plate':      { strong: ['absorbs Laser damage (×0.6)'],           weak: ['Railgun/Kinetic deals ×1.5 damage'] },
  'point-defense':    { strong: ['intercepts 50% of incoming Missiles'],   weak: [] },
};

const STAT_LABELS: Record<string, string> = {
  hull: 'Hull HP',
  shieldMax: 'Shield HP',
  shieldRegen: 'Shield Regen/tick',
  energyPerTick: 'Energy/tick',
  energyMax: 'Energy Storage',
  evasion: 'Evasion',
  range: 'Jump Range',
  cargo: 'Cargo',
  fireRate: 'Fire Rate Score',
};

type Inspection =
  | { kind: 'part'; id: string; fromGridSlot: number }
  | { kind: 'zone'; zone: ZoneLabel };

export function ShipyardView() {
  const {
    matchState,
    myPlayerId,
    selectedPalettePartId,
    selectPalettePart,
    placePartInSlot,
    removePartFromSlot,
  } = useGameStore();

  const [inspection, setInspection] = useState<Inspection | null>(null);
  const [dragOverSlot, setDragOverSlot] = useState<number | null>(null);
  const [dragSourceSlot, setDragSourceSlot] = useState<number>(-1);

  const player = matchState?.players.find((p) => p.id === myPlayerId);
  if (!player || !matchState) return null;

  const { build, factionId } = player;
  const stats = deriveStats(build, PARTS, factionId);
  const atStation = matchState.galaxy.systems[player.systemId].hasStation;
  const isMyTurn  = matchState.activePlayerId === myPlayerId;
  const canEdit   = atStation && isMyTurn;

  // ── Palette interaction ──────────────────────────────────────────────────

  function handlePaletteClick(id: string) {
    setInspection(prev =>
      prev?.kind === 'part' && prev.id === id && prev.fromGridSlot < 0
        ? null
        : { kind: 'part', id, fromGridSlot: -1 }
    );
  }

  function handleDragStart(e: React.DragEvent, partId: string, sourceSlot = -1) {
    if (!canEdit) { e.preventDefault(); return; }
    e.dataTransfer.setData('partId', partId);
    e.dataTransfer.effectAllowed = 'move';
    selectPalettePart(partId);
    setDragSourceSlot(sourceSlot);
  }

  function handleDragEnd() {
    selectPalettePart(null);
    setDragOverSlot(null);
    setDragSourceSlot(-1);
  }

  // ── Grid cell interaction ────────────────────────────────────────────────

  function handleCellClick(i: number) {
    const partId = build.grid[i];
    if (!partId) return;
    setInspection(prev =>
      prev?.kind === 'part' && prev.id === partId && prev.fromGridSlot === i
        ? null
        : { kind: 'part', id: partId, fromGridSlot: i }
    );
  }

  function handleCellDragOver(e: React.DragEvent, i: number) {
    if (!canEdit) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDragOverSlot(i);
  }

  function handleCellDrop(e: React.DragEvent, i: number) {
    if (!canEdit) return;
    e.preventDefault();
    setDragOverSlot(null);
    const from = dragSourceSlot >= 0 ? dragSourceSlot : undefined;
    placePartInSlot(i, from);
  }

  // ── Inspection panel helpers ─────────────────────────────────────────────

  const inspectedPart =
    inspection?.kind === 'part' ? lookupGridItem(inspection.id) : null;
  const inspectedArtifact =
    inspectedPart?.isArtifact && inspection?.kind === 'part'
      ? ARTIFACTS[inspection.id] ?? null
      : null;
  const isFromGrid   = inspection?.kind === 'part' && inspection.fromGridSlot >= 0;
  const fromGridSlot = inspection?.kind === 'part' ? inspection.fromGridSlot : -1;

  function clearInspection() { setInspection(null); }


  return (
    <div className="yard-layout">

      {/* ── Left: Part palette (owned modules + artifacts) ─────────────── */}
      <div className="yard-palette">
        {!isMyTurn && (
          <div className="yard-locked-notice">WAIT FOR TURN</div>
        )}
        {isMyTurn && !atStation && (
          <div className="yard-locked-notice" style={{ borderColor: 'var(--red)', color: 'var(--red)' }}>
            DOCK AT STATION
          </div>
        )}

        {/* Owned modules grouped by type */}
        {(() => {
          const owned = player.ownedModules ?? [];
          // Count occurrences of each module ID in inventory
          const counts: Record<string, number> = {};
          for (const id of owned) counts[id] = (counts[id] ?? 0) + 1;
          const hasAny = owned.length > 0;

          return (
            <>
              {MODULE_TYPE_GROUPS.map(({ label, ids }) => {
                const groupOwned = ids.filter((id) => counts[id]);
                if (!groupOwned.length) return null;
                return (
                  <React.Fragment key={label}>
                    <div className="yard-palette-label">{label}</div>
                    {groupOwned.map((id) => {
                      const p = PARTS[id];
                      if (!p) return null;
                      const count = counts[id];
                      const isExclusive = !!p.factionExclusive;
                      const isInspected = inspection?.kind === 'part' && inspection.id === id && !isFromGrid;
                      return (
                        <div
                          key={id}
                          className={`yard-part-chip ${isInspected ? 'selected' : ''} ${!canEdit ? 'yard-chip-dim' : ''}`}
                          draggable={canEdit}
                          onDragStart={(e) => handleDragStart(e, id)}
                          onDragEnd={handleDragEnd}
                          onClick={() => handlePaletteClick(id)}
                        >
                          <span
                            className="yard-part-icon"
                            style={{ background: isExclusive ? 'var(--purple)' : (PART_COLORS[p.type] ?? 'var(--dim)'), color: isExclusive ? '#e9e3d4' : '#0c0f15' }}
                          >
                            {p.icon}
                          </span>
                          <div style={{ minWidth: 0, flex: 1 }}>
                            <div style={{ color: isExclusive ? 'var(--purple)' : undefined }}>{p.name}</div>
                            <small style={{ color: 'var(--dim)', fontSize: 11 }}>
                              {p.damageType ?? p.defenseType ?? p.type.toUpperCase()}
                            </small>
                          </div>
                          {count > 1 && (
                            <span style={{ fontSize: 10, color: 'var(--amber)', marginLeft: 4, flexShrink: 0 }}>×{count}</span>
                          )}
                        </div>
                      );
                    })}
                  </React.Fragment>
                );
              })}

              {!hasAny && (
                <>
                  <div className="yard-palette-label">MODULES</div>
                  <div style={{ fontSize: 12, color: 'var(--faint)', padding: '4px 2px', lineHeight: 1.5 }}>
                    Visit a station to buy modules.
                  </div>
                </>
              )}
            </>
          );
        })()}

        {/* Owned artifacts */}
        {player.artifacts.length > 0 && (
          <>
            <div className="yard-palette-label" style={{ color: 'var(--purple)', marginTop: 10 }}>
              ARTIFACTS ({player.artifacts.length})
            </div>
            {player.artifacts.map((id) => {
              const art = ARTIFACTS[id];
              if (!art) return null;
              const isInspected = inspection?.kind === 'part' && inspection.id === id && !isFromGrid;
              const equippedSlot = build.grid.findIndex((s) => s === id);
              const isEquipped = equippedSlot !== -1;
              return (
                <div
                  key={id}
                  className={`yard-part-chip yard-part-chip--artifact ${isInspected ? 'selected' : ''}`}
                  draggable={canEdit && !isEquipped}
                  onDragStart={(e) => handleDragStart(e, id)}
                  onDragEnd={handleDragEnd}
                  onClick={() => handlePaletteClick(id)}
                  title={art.description}
                >
                  <span className="yard-part-icon" style={{ background: 'var(--purple)', color: '#e9e3d4' }}>
                    ✦
                  </span>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ color: 'var(--purple)' }}>{art.name}</div>
                    <small style={{ color: isEquipped ? 'var(--teal)' : 'var(--faint)', fontSize: 10 }}>
                      {isEquipped ? `SLOT ${equippedSlot + 1} · equipped` : 'unequipped'}
                    </small>
                  </div>
                </div>
              );
            })}
          </>
        )}

        {player.artifacts.length === 0 && (
          <>
            <div className="yard-palette-label" style={{ marginTop: 10 }}>ARTIFACTS</div>
            <div style={{ fontSize: 12, color: 'var(--faint)', padding: '4px 2px', lineHeight: 1.5 }}>
              Claim or win artifacts to equip them here.
            </div>
          </>
        )}
      </div>

      {/* ── Centre: Ship + grid ─────────────────────────────────────────── */}
      <div className="yard-center" onClick={clearInspection}>
        <div className="corner tl">
          HULL CLASS · {factionId}<br />
          3×3 MODULE GRID
        </div>

        {!atStation && (
          <div className="yard-dock-warning">DOCK AT STATION TO MODIFY BUILD</div>
        )}
        {atStation && !isMyTurn && (
          <div className="yard-dock-warning" style={{ color: 'var(--amber)' }}>WAIT FOR YOUR TURN</div>
        )}

        <div className="hull-wrap">
          <ShipContour factionId={factionId} />

          {/* Crew slots */}
          <div className="crew-row">
            {player.crew.map((c, i) => (
              <div key={i} className={`crew-slot ${c ? 'filled' : 'empty'}`} title={c ?? 'Empty'}>
                {c ? c[0].toUpperCase() : '+'}
              </div>
            ))}
          </div>

          {/* Zone labels with info buttons */}
          <div className="zone-labels">
            {ZONE_LABELS.map((z) => (
              <div key={z} className="zone-label-row">
                <button
                  className="zone-info-btn"
                  onClick={(e) => {
                    e.stopPropagation();
                    setInspection(prev =>
                      prev?.kind === 'zone' && prev.zone === z
                        ? null
                        : { kind: 'zone', zone: z }
                    );
                  }}
                  title={`What does ${z} zone do?`}
                >?</button>
                <span>{z}</span>
              </div>
            ))}
          </div>

          {/* 3×3 grid */}
          <div className="build-grid">
            {Array.from({ length: 9 }, (_, i) => {
              const partId = build.grid[i];
              const part = partId ? lookupGridItem(partId) : null;
              const hasAdj = stats.adjacencyBonus[i];
              const isArtifact = part?.type === 'artifact';
              const isDragTarget = dragOverSlot === i;
              const isInspectedCell =
                inspection?.kind === 'part' && inspection.fromGridSlot === i;

              return (
                <div
                  key={i}
                  className={[
                    'build-cell',
                    partId ? 'filled' : '',
                    hasAdj ? 'adj' : '',
                    selectedPalettePartId && !partId ? 'droppable' : '',
                    isDragTarget ? 'drag-over' : '',
                    isInspectedCell ? 'inspected' : '',
                  ].filter(Boolean).join(' ')}
                  style={
                    part
                      ? { '--cell-color': PART_COLORS[part.type] ?? 'var(--dim)' } as React.CSSProperties
                      : undefined
                  }
                  draggable={canEdit && !!partId}
                  onClick={(e) => { e.stopPropagation(); handleCellClick(i); }}
                  onDragStart={(e) => partId ? handleDragStart(e, partId, i) : e.preventDefault()}
                  onDragEnd={handleDragEnd}
                  onDragOver={(e) => handleCellDragOver(e, i)}
                  onDrop={(e) => handleCellDrop(e, i)}
                  onDragEnter={(e) => {
                    if (!canEdit) return;
                    e.preventDefault();
                    setDragOverSlot(i);
                  }}
                  onDragLeave={() => setDragOverSlot(prev => prev === i ? null : prev)}
                  title={part ? part.name : `Slot ${i + 1} (${['BOW','BOW','BOW','CORE','CORE','CORE','STERN','STERN','STERN'][i]})`}
                >
                  {part && (
                    <span className="cell-icon" style={{ color: isArtifact ? 'var(--purple)' : '#0c0f15' }}>
                      {part.icon}
                    </span>
                  )}
                  {hasAdj && <span className="adj-badge">+FR</span>}
                </div>
              );
            })}
          </div>
        </div>

        <div className="yard-hint">
          {canEdit
            ? <>Tap a module for <b style={{ color: 'var(--amber)' }}>info</b>. Drag it to a slot to <b style={{ color: 'var(--amber)' }}>place</b>.</>
            : !atStation
              ? <span style={{ color: 'var(--red)' }}>Fly to a station to modify your build.</span>
              : <span style={{ color: 'var(--amber)' }}>Wait for your turn to modify build.</span>
          }
        </div>
      </div>

      {/* ── Right: Info + stats ─────────────────────────────────────────── */}
      <div className="side-panel">

        {/* Zone info card */}
        {inspection?.kind === 'zone' && (
          <div className="part-info-box part-info-box--zone">
            <div className="part-info-header">
              <span className="part-info-icon" style={{ background: 'var(--teal)', color: '#0c1018', fontSize: 12, fontFamily: "'Press Start 2P'" }}>
                {inspection.zone[0]}
              </span>
              <div style={{ flex: 1 }}>
                <div className="part-info-name">{inspection.zone} ZONE</div>
                <div className="part-info-type">SLOTS {inspection.zone === 'BOW' ? '1–3' : inspection.zone === 'CORE' ? '4–6' : '7–9'}</div>
              </div>
              <button className="part-info-close" onClick={clearInspection}>✕</button>
            </div>
            <div className="part-info-section">
              <div style={{ fontSize: 13, color: 'var(--bone)', lineHeight: 1.6 }}>
                {ZONE_INFO[inspection.zone].effect}
              </div>
            </div>
            <div className="part-info-section">
              <div className="part-info-stat-label">BEST FOR</div>
              <div style={{ fontSize: 13, color: 'var(--teal)', lineHeight: 1.5 }}>
                {ZONE_INFO[inspection.zone].bestFor}
              </div>
            </div>
          </div>
        )}

        {/* Part info card */}
        {inspection?.kind === 'part' && inspectedPart && (
          <div
            className="part-info-box"
            style={{ '--part-color': PART_COLORS[inspectedPart.type] ?? 'var(--dim)' } as React.CSSProperties}
          >
            <div className="part-info-header">
              <span
                className="part-info-icon"
                style={{ background: PART_COLORS[inspectedPart.type] ?? 'var(--dim)' }}
              >
                {inspectedPart.icon}
              </span>
              <div style={{ flex: 1 }}>
                <div className="part-info-name">{inspectedPart.name}</div>
                <div className="part-info-type">
                  {inspectedPart.isArtifact
                    ? 'ARTIFACT'
                    : (inspectedPart.damageType ?? inspectedPart.defenseType ?? inspectedPart.type).toUpperCase()
                  }
                  {inspectedPart.cost ? ` · ${inspectedPart.cost}◈` : ''}
                </div>
              </div>
              <button className="part-info-close" onClick={clearInspection}>✕</button>
            </div>

            {/* Artifact description + trigger */}
            {inspectedArtifact && (
              <>
                <div className="part-info-section">
                  <div className="part-info-stat-label">EFFECT</div>
                  <div style={{ fontSize: 13, color: 'var(--bone)', lineHeight: 1.6 }}>
                    {inspectedArtifact.description}
                  </div>
                </div>
                <div className="part-info-section">
                  <div className="part-info-stat-label">TRIGGERS</div>
                  <div style={{ fontSize: 13, color: 'var(--purple)' }}>
                    {inspectedArtifact.trigger === 'cooldown'    && 'Periodically (on cooldown)'}
                    {inspectedArtifact.trigger === 'hpThreshold' && 'When HP drops below threshold'}
                    {inspectedArtifact.trigger === 'combatStart' && 'At combat start (passive)'}
                    {inspectedArtifact.trigger === 'onHit'       && 'On every successful hit'}
                  </div>
                </div>
              </>
            )}

            {/* Part stats from Part.stats */}
            {!inspectedArtifact && Object.entries(inspectedPart.stats).some(([, v]) => v) && (
              <div className="part-info-section">
                <div className="part-info-stat-label">STATS</div>
                {Object.entries(inspectedPart.stats).map(([key, val]) => {
                  if (!val) return null;
                  const label = STAT_LABELS[key] ?? key;
                  const display = key === 'evasion'
                    ? `+${Math.round((val as number) * 100)}%`
                    : `+${val}`;
                  return (
                    <div key={key} className="part-info-stat">
                      <span>{label}</span><b>{display}</b>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Weapon combat stats (not in Part.stats, mirrored from combatEngine) */}
            {inspectedPart.type === 'weapon' && WEAPON_COMBAT_STATS[inspectedPart.id] && (
              <div className="part-info-section">
                <div className="part-info-stat-label">COMBAT</div>
                <div className="part-info-stat">
                  <span>Damage</span>
                  <b>{WEAPON_COMBAT_STATS[inspectedPart.id].damage}</b>
                </div>
                <div className="part-info-stat">
                  <span>Accuracy</span>
                  <b>{Math.round(WEAPON_COMBAT_STATS[inspectedPart.id].accuracy * 100)}%</b>
                </div>
                <div className="part-info-stat">
                  <span>Cooldown</span>
                  <b>{WEAPON_COMBAT_STATS[inspectedPart.id].cooldown} ticks</b>
                </div>
              </div>
            )}

            {/* Extra combat notes (armor points, point-def chance, adjacency notes) */}
            {PART_COMBAT_NOTES[inspectedPart.id] && (
              <div className="part-info-section">
                <div className="part-info-stat-label">NOTE</div>
                <div style={{ fontSize: 12, color: 'var(--dim)', lineHeight: 1.5 }}>
                  {PART_COMBAT_NOTES[inspectedPart.id]}
                </div>
              </div>
            )}

            {/* RPS counters */}
            {RPS_INFO[inspectedPart.id] && (
              (RPS_INFO[inspectedPart.id].strong?.length || RPS_INFO[inspectedPart.id].weak?.length)
                ? (
                  <div className="part-info-section">
                    <div className="part-info-stat-label">COUNTERS</div>
                    {RPS_INFO[inspectedPart.id].strong?.map((s, i) => (
                      <div key={i} className="part-info-rps part-info-rps--good">▲ {s}</div>
                    ))}
                    {RPS_INFO[inspectedPart.id].weak?.map((s, i) => (
                      <div key={i} className="part-info-rps part-info-rps--bad">▼ {s}</div>
                    ))}
                  </div>
                ) : null
            )}

            {/* Zone affinity */}
            {!inspectedPart.isArtifact && inspectedPart.zoneAffinity.length > 0 && (
              <div className="part-info-section">
                <div className="part-info-stat-label">BEST ZONE</div>
                <div className="part-info-zones">
                  {inspectedPart.zoneAffinity.map(z => (
                    <span key={z} className="part-info-zone-badge">{z.toUpperCase()}</span>
                  ))}
                </div>
              </div>
            )}

            {/* Remove button when inspecting an equipped grid slot */}
            {isFromGrid && canEdit && (
              <div style={{ padding: '6px 8px', borderTop: '1px solid var(--line)' }}>
                <button
                  className="btn danger"
                  style={{ fontSize: 8 }}
                  onClick={() => {
                    removePartFromSlot(fromGridSlot);
                    clearInspection();
                  }}
                >
                  ✕ REMOVE FROM SLOT {fromGridSlot + 1}
                </button>
              </div>
            )}
          </div>
        )}

        {/* Ship stats — always visible below */}
        <div className="panel-title">
          SHIP STATS
          <span className="panel-badge" style={{ background: 'var(--teal)' }}>LIVE</span>
        </div>
        <div className="panel-body">
          <StatBar label="HULL"        value={stats.hull}          max={260} color="var(--teal)" />
          <StatBar label="SHIELD"      value={stats.shieldMax}     max={200} color="#7fd0cc" />
          <StatBar label="ENERGY/TICK" value={stats.energyPerTick} max={35}  color="var(--amber)" />
          <StatBar label="FIRE RATE"   value={stats.fireRate}      max={90}  color="var(--red)" />
          <StatBar label="RANGE"       value={stats.range}         max={12}  color="var(--green)" />
          <StatBar label="CARGO"       value={stats.cargo}         max={300} color="var(--dim)" />

          <div className="sect">LOADOUT</div>
          <div className="kv"><span>SLOTS USED</span><b>{build.grid.filter(Boolean).length}/9</b></div>
          <div className="kv"><span>WEAPONS</span><b style={{ color: 'var(--red)' }}>{stats.weaponCount}</b></div>
          <div className="kv"><span>ARTIFACTS</span><b style={{ color: 'var(--purple)' }}>{stats.artifactCount}</b></div>
          <div className="kv"><span>EVASION</span><b>{Math.round(stats.evasion * 100)}%</b></div>
        </div>
        <div className="panel-actions">
          <button className="btn primary" disabled={!canEdit}>✓ SAVE BUILD</button>
        </div>
      </div>
    </div>
  );
}

function StatBar({ label, value, max, color }: { label: string; value: number; max: number; color: string }) {
  const pct = Math.min(100, (value / max) * 100);
  return (
    <div style={{ marginBottom: 8 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: 'var(--dim)', marginBottom: 3 }}>
        <span>{label}</span><span>{value}</span>
      </div>
      <div style={{ height: 9, background: 'var(--panel3)', border: '1px solid var(--line)', position: 'relative' }}>
        <div style={{
          position: 'absolute', inset: 0, width: `${pct}%`,
          background: `repeating-linear-gradient(90deg, ${color} 0 5px, #0003 5px 6px)`,
          transition: 'width 0.2s',
        }} />
      </div>
    </div>
  );
}
