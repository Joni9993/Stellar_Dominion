import React, { useState } from 'react';
import { useGameStore } from '../store';
import { ShipContour } from '../components/ShipContour';
import { PARTS, ARTIFACTS, deriveStats } from '@stellar-dominion/shared';
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
  cargo:    'var(--dim)',
  artifact: 'var(--purple)',
};

const ZONE_LABELS = ['BOW', 'CORE', 'STERN'] as const;


export function ShipyardView() {
  const {
    matchState,
    myPlayerId,
    selectedPalettePartId,
    selectPalettePart,
    placePartInSlot,
    yardInspection: inspection,
    setYardInspection: setInspection,
  } = useGameStore();

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
    setInspection(
      inspection?.kind === 'part' && inspection.id === id && inspection.fromGridSlot < 0
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
    setInspection(
      inspection?.kind === 'part' && inspection.id === partId && inspection.fromGridSlot === i
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
                      const isInspected = inspection?.kind === 'part' && inspection.id === id && inspection.fromGridSlot < 0;
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
              const isInspected = inspection?.kind === 'part' && inspection.id === id && inspection.fromGridSlot < 0;
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
      <div className="yard-center" onClick={() => setInspection(null)}>
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
                    setInspection(
                      inspection?.kind === 'zone' && inspection.zone === z
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

      {/* Right panel is rendered as ShipyardPanel in GameLayout */}

    </div>
  );
}

