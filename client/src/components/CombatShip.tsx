import React, { useState } from 'react';
import { FACTIONS, PARTS, ARTIFACTS, type FactionId, type ShipBuild } from '@stellar-dominion/shared';
import { ShipContour } from './ShipContour';

const PART_COLORS: Record<string, string> = {
  weapon:   '#e8512e',
  shield:   '#7fd0cc',
  armor:    '#5fa8a4',
  pointdef: '#5fa8a4',
  gen:      '#d9a441',
  cap:      '#d9a441',
  engine:   '#8a9a5b',
  util:     '#8b96a6',
  artifact: '#8a7caa',
};

const STAT_LABELS: Record<string, string> = {
  hull: 'Hull', shieldMax: 'Shield', shieldRegen: 'Shd Regen',
  energyPerTick: 'Nrg/Tick', energyMax: 'Nrg Max',
  evasion: 'Evasion', initiative: 'Init', range: 'Range',
  cargo: 'Cargo', fireRate: 'Fire Rate',
};

const DMG_LABELS: Record<string, string> = { laser: 'LASER', kinetic: 'KINETIC', missile: 'MISSILE' };
const TYPE_LABELS: Record<string, string> = {
  weapon: 'WEAPON', shield: 'SHIELD', armor: 'ARMOR', pointdef: 'POINT-DEF',
  gen: 'GENERATOR', cap: 'CAPACITOR', engine: 'ENGINE', util: 'UTILITY', artifact: 'ARTIFACT',
};

// ── Stat bar ──────────────────────────────────────────────────────────────────

interface StatBarProps {
  label: string;
  value: number;
  max: number;
  color: string;
  reverse?: boolean;
}
function StatBar({ label, value, max, color, reverse }: StatBarProps) {
  const pct = max > 0 ? Math.min(100, (value / max) * 100) : 0;
  const valText = max > 0 ? `${Math.ceil(value)}/${max}` : '—';
  return (
    <div className="combat-stat-bar">
      {!reverse && <span className="csb-label">{label}</span>}
      <div className="csb-track">
        <div
          className="csb-fill"
          style={{ width: `${pct}%`, background: color, ...(reverse ? { marginLeft: 'auto' } : {}) }}
        />
      </div>
      <span className="csb-value" style={{ textAlign: reverse ? 'left' : 'right' }}>{valText}</span>
      {reverse && <span className="csb-label" style={{ textAlign: 'right' }}>{label}</span>}
    </div>
  );
}

// ── Compact part info panel ───────────────────────────────────────────────────

function PartInfoPanel({ partId }: { partId: string }) {
  const part = PARTS[partId];
  const art  = ARTIFACTS[partId];

  if (art) {
    return (
      <div className="combat-part-info">
        <div className="cpi-name">{art.name}</div>
        <div className="cpi-type">ARTIFACT · {art.trigger.toUpperCase()}</div>
        <div style={{ fontSize: 11, color: 'var(--dim)', marginTop: 2 }}>{art.description}</div>
      </div>
    );
  }
  if (!part) return null;

  const statEntries = Object.entries(part.stats)
    .filter(([k, v]) => v && STAT_LABELS[k])
    .map(([k, v]) => ({ label: STAT_LABELS[k], val: v as number }));

  return (
    <div className="combat-part-info">
      <div className="cpi-name">{part.name}</div>
      <div className="cpi-type">
        {TYPE_LABELS[part.type] ?? part.type}
        {part.damageType ? ` · ${DMG_LABELS[part.damageType] ?? part.damageType}` : ''}
        {part.zoneAffinity.length ? ` · ${part.zoneAffinity.map(z => z.toUpperCase()).join('/')}` : ''}
      </div>
      {statEntries.map(({ label, val }) => (
        <div className="cpi-stat" key={label}>
          <span>{label}</span><span>+{val}</span>
        </div>
      ))}
    </div>
  );
}

// ── CombatShip ────────────────────────────────────────────────────────────────

interface CombatShipProps {
  factionId: FactionId;
  build: ShipBuild;
  facing: 'right' | 'left';
  currentHull: number;
  maxHull: number;
  currentShield: number;
  maxShield: number;
  currentEnergy: number;
  maxEnergy: number;
  activeSlots: Set<number>;
  label?: string; // e.g. "YOU" or "ENEMY"
}

export function CombatShip({
  factionId, build, facing,
  currentHull, maxHull,
  currentShield, maxShield,
  currentEnergy, maxEnergy,
  activeSlots,
  label,
}: CombatShipProps) {
  const faction  = FACTIONS[factionId];
  const rotation = facing === 'right' ? 90 : -90;
  const [inspectedId, setInspectedId] = useState<string | null>(null);

  function toggleInspect(partId: string | null) {
    if (!partId) return;
    setInspectedId(prev => prev === partId ? null : partId);
  }

  return (
    <div className={`combat-ship combat-ship--${facing}`}>

      {/* Status bars */}
      <div className="combat-bars">
        <StatBar label="HULL" value={currentHull}   max={maxHull}   color="var(--teal)"  reverse={facing === 'left'} />
        <StatBar label="SHD"  value={currentShield} max={maxShield} color="#7fd0cc"       reverse={facing === 'left'} />
        <StatBar label="NRG"  value={currentEnergy} max={maxEnergy} color="var(--amber)"  reverse={facing === 'left'} />
      </div>

      {/* Faction label */}
      <div className="combat-faction-label" style={{ color: faction.color, textAlign: facing === 'left' ? 'right' : 'left' }}>
        {label && <span style={{ color: 'var(--dim)', marginRight: 5, fontSize: 5 }}>{label} ·</span>}
        {faction.name}
        {build.grid.some(id => id && ARTIFACTS[id]) && (
          <span style={{ color: 'var(--purple)', marginLeft: 6 }}>✦</span>
        )}
      </div>

      {/* Rotated hull with clickable grid */}
      <div className="combat-hull-outer">
        <div className="hull-wrap" style={{ transform: `translate(-50%,-50%) rotate(${rotation}deg)` }}>
          <ShipContour factionId={factionId} />

          <div className="crew-row">
            {[0, 1].map(i => (
              <div key={i} className="crew-slot empty" style={{ width: 22, height: 22, fontSize: 10 }}>+</div>
            ))}
          </div>

          <div className="build-grid">
            {build.grid.map((partId, i) => {
              const part   = partId ? PARTS[partId]     : null;
              const art    = partId ? ARTIFACTS[partId] : null;
              const color  = part ? PART_COLORS[part.type] : (art ? 'var(--purple)' : undefined);
              const icon   = part ? part.icon : (art ? '✦' : '');
              const firing = activeSlots.has(i);
              const active = inspectedId === partId && !!partId;

              return (
                <div
                  key={i}
                  className={`build-cell ${partId ? 'filled' : ''} ${firing ? 'combat-firing' : ''}`}
                  style={{
                    ...(partId ? { '--cell-color': color } as React.CSSProperties : {}),
                    cursor: partId ? 'pointer' : 'default',
                    outline: active ? '2px solid var(--bone)' : undefined,
                  }}
                  onClick={() => toggleInspect(partId)}
                >
                  {icon && (
                    <span className="cell-icon" style={{ color: art ? 'var(--purple)' : '#0c0f15' }}>
                      {icon}
                    </span>
                  )}
                  {firing && <div className="fire-flash" />}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Module info panel — shown below hull when a cell is tapped */}
      {inspectedId && (PARTS[inspectedId] || ARTIFACTS[inspectedId]) && (
        <PartInfoPanel partId={inspectedId} />
      )}

      {/* Loadout chips */}
      <div className="combat-loadout" style={{ justifyContent: facing === 'left' ? 'flex-end' : 'flex-start' }}>
        {build.grid.map((partId, i) => {
          if (!partId) return null;
          const part = PARTS[partId];
          const art  = ARTIFACTS[partId];
          const col  = part ? PART_COLORS[part.type] : 'var(--purple)';
          return (
            <span key={i} className={`lo-chip ${activeSlots.has(i) ? 'lo-chip--firing' : ''}`}
              style={{ background: col }}>
              {part?.icon ?? '✦'}
            </span>
          );
        })}
      </div>
    </div>
  );
}
