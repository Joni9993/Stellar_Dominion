import React from 'react';
import { useGameStore } from '../store';
import { PARTS, ARTIFACTS, deriveStats } from '@stellar-dominion/shared';
import type { Part } from '@stellar-dominion/shared';

function lookupGridItem(id: string): (Part & { isArtifact?: boolean }) | null {
  const p = PARTS[id];
  if (p) return p;
  const a = ARTIFACTS[id];
  if (a) return { id: a.id, name: a.name, type: 'artifact', zoneAffinity: [], stats: {}, cost: 0, icon: '✦', isArtifact: true };
  return null;
}

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

const STAT_LABELS: Record<string, string> = {
  hull:         'Hull',
  shieldMax:    'Shield',
  energyPerTick:'Energy/tick',
  energyMax:    'Energy Storage',
  evasion:      'Evasion',
  range:        'Jump Range',
  cargo:        'Cargo',
  fireRate:     'Fire Rate Score',
};

const WEAPON_COMBAT_STATS: Record<string, { damage: number; accuracy: number; cooldown: number }> = {
  'pulse-laser': { damage: 4,  accuracy: 0.85, cooldown: 14 },
  'railgun':     { damage: 8,  accuracy: 0.72, cooldown: 22 },
  'missile-pod': { damage: 5,  accuracy: 0.90, cooldown: 20 },
};

const PART_COMBAT_NOTES: Record<string, string> = {
  'pulse-laser':        'Next to a Reactor → −15% cooldown (fires faster)',
  'railgun':            'Next to a Capacitor → −15% cooldown (fires faster)',
  'missile-pod':        'Next to a Cargo Bay → −15% cooldown (more ammo space)',
  'armor-plate':        '+6 armor reduces all incoming hull damage per hit',
  'point-defense':      '50% chance to intercept incoming Missiles',
  'shield-projector':   'Next to a Reactor or Capacitor → shield regen 0.33 → 0.5/tick',
};

const RPS_INFO: Record<string, { strong?: string[]; weak?: string[] }> = {
  'pulse-laser':      { strong: ['×2.0 damage vs Shields'],               weak: ['×0.6 damage vs Armor'] },
  'railgun':          { strong: ['×1.5 damage vs Armor'],                 weak: ['×0.6 damage vs Shields'] },
  'missile-pod':      { strong: ['bypasses Shields completely'],           weak: ['50% intercepted by Point-Defense'] },
  'shield-projector': { strong: ['reduces Railgun/Kinetic damage (×0.6)'],weak: ['Laser deals ×2.0 damage through it'] },
  'armor-plate':      { strong: ['absorbs Laser damage (×0.6)'],          weak: ['Railgun/Kinetic deals ×1.5 damage'] },
  'point-defense':    { strong: ['intercepts 50% of incoming Missiles'],  weak: [] },
};

const ZONE_INFO: Record<string, { effect: string; bestFor: string }> = {
  BOW:  { effect: 'Weapons placed here gain +10% fire rate and +10% accuracy in combat.', bestFor: 'Weapons (Pulse Laser, Railgun, Missile Pod)' },
  CORE: { effect: 'No direct zone bonus — but ideal for adjacency combos. A Reactor next to a Pulse Laser grants it −15% cooldown. A Capacitor next to a Railgun does the same. Only the weapon benefits and glows. Shield Projectors next to any Reactor or Capacitor also gain +0.17 extra shield regen per tick.', bestFor: 'Energy modules (Reactor, Capacitor) and Shield Projector' },
  STERN:{ effect: 'No direct combat bonus. Recommended zone for mobility and utility modules by convention.', bestFor: 'Mobility modules (Ion Engine, Fuel Tank, Cargo Bay)' },
};

export function ShipyardPanel() {
  const {
    matchState,
    myPlayerId,
    yardInspection: inspection,
    setYardInspection: setInspection,
    removePartFromSlot,
  } = useGameStore();

  const player = matchState?.players.find((p) => p.id === myPlayerId);
  if (!player || !matchState) return <div className="side-panel" />;

  const { build, factionId } = player;
  const stats = deriveStats(build, PARTS, factionId);
  const atStation = matchState.galaxy.systems[player.systemId].hasStation;
  const isMyTurn  = matchState.activePlayerId === myPlayerId;
  const canEdit   = atStation && isMyTurn;

  const inspectedPart =
    inspection?.kind === 'part' ? lookupGridItem(inspection.id) : null;
  const inspectedArtifact =
    inspectedPart?.isArtifact && inspection?.kind === 'part'
      ? ARTIFACTS[inspection.id] ?? null
      : null;
  const isFromGrid   = inspection?.kind === 'part' && inspection.fromGridSlot >= 0;
  const fromGridSlot = inspection?.kind === 'part' ? inspection.fromGridSlot : -1;

  return (
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
            <button className="part-info-close" onClick={() => setInspection(null)}>✕</button>
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
            <button className="part-info-close" onClick={() => setInspection(null)}>✕</button>
          </div>

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

          {PART_COMBAT_NOTES[inspectedPart.id] && (
            <div className="part-info-section">
              <div className="part-info-stat-label">NOTE</div>
              <div style={{ fontSize: 12, color: 'var(--dim)', lineHeight: 1.5 }}>
                {PART_COMBAT_NOTES[inspectedPart.id]}
              </div>
            </div>
          )}

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

          {isFromGrid && canEdit && (
            <div style={{ padding: '6px 8px', borderTop: '1px solid var(--line)' }}>
              <button
                className="btn danger"
                style={{ fontSize: 8 }}
                onClick={() => {
                  removePartFromSlot(fromGridSlot);
                  setInspection(null);
                }}
              >
                ✕ REMOVE FROM SLOT {fromGridSlot + 1}
              </button>
            </div>
          )}
        </div>
      )}

      {/* Ship stats — always visible */}
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
        }} />
      </div>
    </div>
  );
}
