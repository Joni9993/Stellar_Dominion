/**
 * CombatView — combat playback screen.
 *
 * My ship is always rendered on the LEFT (facing right).
 * The enemy ship is always on the RIGHT (facing left).
 * "My side" = attacker side A when iAmAttacker, else defender side B.
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useGameStore } from '../store';
import { CombatShip } from '../components/CombatShip';
import {
  runCombat,
  FACTIONS,
  PARTS,
  ARTIFACTS,
  type BoardingLoot,
  type CombatResult,
  type CombatEvent,
  type DamageType,
  type FactionId,
} from '@stellar-dominion/shared';

const TICKS_PER_MS    = 0.05;
const CALLOUT_DURATION_MS = 1400;

const PROJ_COLOR: Record<DamageType, string> = {
  laser:   'var(--teal)',
  kinetic: 'var(--red)',
  missile: 'var(--amber)',
};

// Projectile duration by type (ms)
const PROJ_DURATION: Record<DamageType, number> = {
  laser:   750,
  kinetic: 300,
  missile: 950,
};

interface Projectile {
  id: number;
  side: 'A' | 'B';
  dmgType: DamageType;
  startMs: number;
  durationMs: number;
  scatterY: number;  // px vertical offset from center (kinetic scatter)
  delayMs:  number;  // animation delay (kinetic stagger)
}

let projIdSeq = 0;

interface PlayState {
  phase: 'idle' | 'playing' | 'done';
  tick: number;
  hullA: number; hullB: number;
  shieldA: number; shieldB: number;
  energyA: number; energyB: number;
  activeSlotsA: Set<number>;
  activeSlotsB: Set<number>;
  callout: string | null;
  artBanner: string | null;
}

// ── Damage stats computed from the event timeline ─────────────────────────────

interface CombatStats {
  dmgBySlotA: Record<number, number>;
  dmgBySlotB: Record<number, number>;
  shieldBlockedA: number;  // A's shield absorbed hits from B
  shieldBlockedB: number;  // B's shield absorbed hits from A
  shieldRegenA: number;
  shieldRegenB: number;
}

function computeStats(timeline: CombatEvent[]): CombatStats {
  const dmgBySlotA: Record<number, number> = {};
  const dmgBySlotB: Record<number, number> = {};
  let shieldBlockedA = 0, shieldBlockedB = 0, shieldRegenA = 0, shieldRegenB = 0;

  for (const evt of timeline) {
    if (evt.type === 'hit') {
      const total = (evt.shieldDmg ?? 0) + (evt.hullDmg ?? 0);
      if (evt.side === 'A') {
        dmgBySlotA[evt.slotIndex] = (dmgBySlotA[evt.slotIndex] ?? 0) + total;
        shieldBlockedB += evt.shieldDmg ?? 0;
      } else {
        dmgBySlotB[evt.slotIndex] = (dmgBySlotB[evt.slotIndex] ?? 0) + total;
        shieldBlockedA += evt.shieldDmg ?? 0;
      }
    }
    if (evt.type === 'regen') {
      if (evt.side === 'A') shieldRegenA += evt.healAmt ?? 0;
      else                   shieldRegenB += evt.healAmt ?? 0;
    }
  }
  return { dmgBySlotA, dmgBySlotB, shieldBlockedA, shieldBlockedB, shieldRegenA, shieldRegenB };
}

// ── Battle report component ───────────────────────────────────────────────────

function BattleReport({ result, iAmAttacker }: { result: CombatResult; iAmAttacker: boolean }) {
  const stats = computeStats(result.timeline);

  const sides = [
    {
      key: 'mine',
      label: 'YOUR SHIP',
      factionId: iAmAttacker ? result.factionA : result.factionB,
      build:    iAmAttacker ? result.buildA : result.buildB,
      dmgBySlot: iAmAttacker ? stats.dmgBySlotA : stats.dmgBySlotB,
      blocked:   iAmAttacker ? stats.shieldBlockedA : stats.shieldBlockedB,
      regen:     iAmAttacker ? stats.shieldRegenA   : stats.shieldRegenB,
    },
    {
      key: 'enemy',
      label: 'ENEMY',
      factionId: iAmAttacker ? result.factionB : result.factionA,
      build:    iAmAttacker ? result.buildB : result.buildA,
      dmgBySlot: iAmAttacker ? stats.dmgBySlotB : stats.dmgBySlotA,
      blocked:   iAmAttacker ? stats.shieldBlockedB : stats.shieldBlockedA,
      regen:     iAmAttacker ? stats.shieldRegenB   : stats.shieldRegenA,
    },
  ];

  return (
    <div className="battle-report">
      {sides.map(({ key, label, factionId, build, dmgBySlot, blocked, regen }) => {
        const faction = FACTIONS[factionId as FactionId];
        const weaponRows = Object.entries(dmgBySlot)
          .map(([idx, dmg]) => {
            const partId = build.grid[Number(idx)];
            const part   = partId ? PARTS[partId] : null;
            return { idx: Number(idx), dmg, part };
          })
          .filter(r => r.part?.type === 'weapon' && r.dmg > 0)
          .sort((a, b) => b.dmg - a.dmg);
        const totalDmg = Object.values(dmgBySlot).reduce((s, v) => s + v, 0);

        return (
          <div className="battle-report-col" key={key}>
            <div className="br-faction-label" style={{ color: faction?.color }}>
              {label} · {faction?.name ?? factionId}
            </div>

            {weaponRows.map(({ idx, dmg, part }) => (
              <div className="br-row" key={idx}>
                <span className="br-label">{part!.icon} {part!.name}</span>
                <span className="br-val" style={{ color: 'var(--red)' }}>{dmg}</span>
              </div>
            ))}
            {weaponRows.length === 0 && (
              <div className="br-row">
                <span className="br-label" style={{ color: 'var(--faint)' }}>no dmg dealt</span>
              </div>
            )}

            <div className="br-divider" />

            <div className="br-row">
              <span className="br-label">DMG DEALT</span>
              <span className="br-val" style={{ color: 'var(--red)' }}>{totalDmg}</span>
            </div>
            <div className="br-row">
              <span className="br-label">SHD BLOCKED</span>
              <span className="br-val" style={{ color: 'var(--teal)' }}>{blocked}</span>
            </div>
            {regen > 0 && (
              <div className="br-row">
                <span className="br-label">SHD REGEN</span>
                <span className="br-val" style={{ color: '#7fd0cc' }}>{regen}</span>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ── Boarding roulette ─────────────────────────────────────────────────────────

const SPIN_SEQUENCE = ['ARTIFACT', 'MODULE', 'CREDITS', 'MODULE', 'ARTIFACT', 'CREDITS'];
const SPIN_COLORS: Record<string, string> = {
  ARTIFACT: 'var(--purple)',
  MODULE: 'var(--bone)',
  CREDITS: 'var(--teal)',
};
const LOOT_COLORS: Record<BoardingLoot['type'], string> = {
  artifact: 'var(--purple)',
  module: 'var(--bone)',
  credits: 'var(--teal)',
};

function BoardingRoulette({ loot, iWon, onRevealed }: {
  loot: BoardingLoot;
  iWon: boolean;
  onRevealed: () => void;
}) {
  const [spinIdx, setSpinIdx] = useState(0);
  const [phase, setPhase] = useState<'spinning' | 'revealed'>('spinning');

  useEffect(() => {
    let i = 0;
    const interval = setInterval(() => {
      i = (i + 1) % SPIN_SEQUENCE.length;
      setSpinIdx(i);
    }, 110);
    const timeout = setTimeout(() => {
      clearInterval(interval);
      setPhase('revealed');
      onRevealed();
    }, 2200);
    return () => { clearInterval(interval); clearTimeout(timeout); };
  }, [onRevealed]);

  const outcomeLabel = loot.type === 'artifact' ? 'ARTIFACT'
    : loot.type === 'module' ? 'MODULE'
    : 'CREDITS';

  const itemLabel = loot.type === 'artifact'
    ? (ARTIFACTS[loot.artifactId]?.name ?? loot.artifactId)
    : loot.type === 'module'
    ? (PARTS[loot.moduleId]?.name ?? loot.moduleId)
    : `${loot.amount} ◈`;

  return (
    <div className="boarding-roulette">
      <div className="boarding-subtitle">
        {iWon ? 'BOARDING CREW SEARCHED ENEMY SHIP' : 'ENEMY CREW SEARCHED YOUR SHIP'}
      </div>
      <div className="boarding-slot-wrap">
        <div className="boarding-slot">
          {phase === 'spinning' ? (
            <span style={{ color: SPIN_COLORS[SPIN_SEQUENCE[spinIdx]] }}>
              {SPIN_SEQUENCE[spinIdx]}
            </span>
          ) : (
            <span style={{ color: LOOT_COLORS[loot.type] }}>{outcomeLabel}</span>
          )}
        </div>
      </div>
      {phase === 'revealed' && (
        <div className="boarding-found" style={{ color: LOOT_COLORS[loot.type] }}>
          {iWon ? '+ ' : '− '}{itemLabel}
        </div>
      )}
    </div>
  );
}

// ── Main view ─────────────────────────────────────────────────────────────────

export function CombatView() {
  const store = useGameStore();
  const { matchState, myPlayerId, combatAttackerId, combatDefenderId, connectionMode, boardingLoot } = store;
  const player      = matchState?.players.find(p => p.id === myPlayerId);
  const combatResult = store.combatResult as CombatResult | null;

  // Identify which engine side the local player is on
  const iAmAttacker = myPlayerId === combatAttackerId;

  // "My side" = left (facing right). "Enemy side" = right (facing left).
  const myActualSide: 'A' | 'B' = iAmAttacker ? 'A' : 'B';

  const localPlayerWon = combatResult
    ? (combatResult.winner === 'A' && iAmAttacker) || (combatResult.winner === 'B' && !iAmAttacker)
    : false;

  const [pb, setPb] = useState<PlayState | null>(null);
  const [projectiles, setProjectiles] = useState<Projectile[]>([]);
  const rafRef       = useRef<number | null>(null);
  const accRef       = useRef(0);
  const evtIdx       = useRef(0);
  const lastTs       = useRef(0);
  const calloutTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const bannerTimer  = useRef<ReturnType<typeof setTimeout> | null>(null);

  function initPlayState(r: CombatResult): PlayState {
    return {
      phase: 'idle', tick: 0,
      hullA: r.maxHullA, hullB: r.maxHullB,
      shieldA: r.maxShieldA, shieldB: r.maxShieldB,
      energyA: 10, energyB: 10,
      activeSlotsA: new Set(), activeSlotsB: new Set(),
      callout: null, artBanner: null,
    };
  }

  useEffect(() => {
    if (!combatResult) return;
    setPb(initPlayState(combatResult));
    setProjectiles([]);
    evtIdx.current = 0;
    accRef.current = 0;
  }, [combatResult]);

  // ── Spawn projectile(s) for a weapon_fire event ───────────────────────────

  function spawnProjectiles(evt: CombatEvent, nowMs: number) {
    if (!evt.damageType) return;
    const dmgType = evt.damageType;
    const durationMs = PROJ_DURATION[dmgType];

    if (dmgType === 'kinetic') {
      // 3 staggered pellets with slight Y scatter
      for (let i = 0; i < 3; i++) {
        const scatterY = (i - 1) * 13 + (Math.random() - 0.5) * 7;
        const delayMs  = i * 55;
        const proj: Projectile = {
          id: projIdSeq++, side: evt.side, dmgType, startMs: nowMs,
          durationMs, scatterY, delayMs,
        };
        setProjectiles(ps => [...ps, proj]);
        setTimeout(() => setProjectiles(ps => ps.filter(p => p.id !== proj.id)), durationMs + delayMs + 60);
      }
    } else {
      const proj: Projectile = {
        id: projIdSeq++, side: evt.side, dmgType, startMs: nowMs,
        durationMs, scatterY: 0, delayMs: 0,
      };
      setProjectiles(ps => [...ps, proj]);
      setTimeout(() => setProjectiles(ps => ps.filter(p => p.id !== proj.id)), durationMs + 60);
    }
  }

  // ── Process one timeline event ────────────────────────────────────────────

  const processEvent = useCallback((evt: CombatEvent, nowMs: number) => {
    setPb(prev => {
      if (!prev) return prev;
      const next = { ...prev, hullA: evt.hullA, hullB: evt.hullB, shieldA: evt.shieldA, shieldB: evt.shieldB, energyA: evt.energyA, energyB: evt.energyB };

      const slotsA = new Set(prev.activeSlotsA);
      const slotsB = new Set(prev.activeSlotsB);
      if (evt.side === 'A') slotsA.add(evt.slotIndex);
      else                   slotsB.add(evt.slotIndex);

      setTimeout(() => {
        setPb(p => {
          if (!p) return p;
          const sa = new Set(p.activeSlotsA);
          const sb = new Set(p.activeSlotsB);
          if (evt.side === 'A') sa.delete(evt.slotIndex);
          else                   sb.delete(evt.slotIndex);
          return { ...p, activeSlotsA: sa, activeSlotsB: sb };
        });
      }, 300);

      next.activeSlotsA = slotsA;
      next.activeSlotsB = slotsB;

      if (evt.callout) {
        next.callout = evt.callout;
        if (calloutTimer.current) clearTimeout(calloutTimer.current);
        calloutTimer.current = setTimeout(() => setPb(p => p ? { ...p, callout: null } : p), CALLOUT_DURATION_MS);
      }

      if (evt.type === 'artifact_pulse' && evt.effectDesc) {
        const art = ARTIFACTS[evt.artifactId ?? ''];
        next.artBanner = art ? `✦ ${art.name.toUpperCase()}` : evt.effectDesc;
        if (bannerTimer.current) clearTimeout(bannerTimer.current);
        bannerTimer.current = setTimeout(() => setPb(p => p ? { ...p, artBanner: null } : p), 1600);
      }

      return { ...next, tick: evt.tick };
    });

    if (evt.type === 'weapon_fire') spawnProjectiles(evt, nowMs);
  }, []);

  // ── Animation loop ────────────────────────────────────────────────────────

  const startPlayback = useCallback(() => {
    if (!combatResult) return;
    setPb(prev => prev ? { ...prev, phase: 'playing' } : prev);
    evtIdx.current = 0;
    accRef.current = 0;
    lastTs.current = 0;

    function frame(now: number) {
      if (lastTs.current === 0) lastTs.current = now;
      const delta = now - lastTs.current;
      lastTs.current = now;
      accRef.current += delta * TICKS_PER_MS;

      while (
        evtIdx.current < combatResult!.timeline.length &&
        combatResult!.timeline[evtIdx.current].tick <= accRef.current
      ) {
        processEvent(combatResult!.timeline[evtIdx.current], now);
        evtIdx.current++;
      }

      if (evtIdx.current < combatResult!.timeline.length) {
        rafRef.current = requestAnimationFrame(frame);
      } else {
        setPb(prev => prev ? { ...prev, phase: 'done' } : prev);
      }
    }

    rafRef.current = requestAnimationFrame(frame);
  }, [combatResult, processEvent]);

  const [lootChosen, setLootChosen] = useState(false);
  const [rouletteRevealed, setRouletteRevealed] = useState(false);
  useEffect(() => { setLootChosen(false); setRouletteRevealed(false); }, [combatResult]);

  useEffect(() => () => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    if (calloutTimer.current) clearTimeout(calloutTimer.current);
    if (bannerTimer.current) clearTimeout(bannerTimer.current);
  }, []);

  // ── No combat result ──────────────────────────────────────────────────────

  if (!combatResult || !pb || !player) {
    return (
      <div className="combat-empty">
        <div style={{ fontFamily: "'Press Start 2P'", fontSize: 9, color: 'var(--dim)', marginBottom: 16 }}>
          NO ACTIVE ENGAGEMENT
        </div>
        <button className="btn primary" onClick={() => store.startCombat()} disabled={!player}>
          ▸ SIMULATE BATTLE
        </button>
        <div style={{ fontSize: 13, color: 'var(--faint)', marginTop: 10 }}>vs RASK test opponent</div>
      </div>
    );
  }

  // ── Derive visual side data ───────────────────────────────────────────────
  // My ship is always LEFT (facing right), enemy is always RIGHT (facing left).

  const myFactionId    = (iAmAttacker ? combatResult.factionA : combatResult.factionB) as FactionId;
  const enemyFactionId = (iAmAttacker ? combatResult.factionB : combatResult.factionA) as FactionId;
  const myBuild        = iAmAttacker ? combatResult.buildA : combatResult.buildB;
  const enemyBuild     = iAmAttacker ? combatResult.buildB : combatResult.buildA;
  const myHull         = iAmAttacker ? pb.hullA   : pb.hullB;
  const myMaxHull      = iAmAttacker ? combatResult.maxHullA : combatResult.maxHullB;
  const myShield       = iAmAttacker ? pb.shieldA : pb.shieldB;
  const myMaxShield    = iAmAttacker ? combatResult.maxShieldA : combatResult.maxShieldB;
  const myEnergy       = iAmAttacker ? pb.energyA : pb.energyB;
  const myMaxEnergy    = iAmAttacker ? combatResult.maxEnergyA : combatResult.maxEnergyB;
  const mySlots        = iAmAttacker ? pb.activeSlotsA : pb.activeSlotsB;

  const enemyHull      = iAmAttacker ? pb.hullB   : pb.hullA;
  const enemyMaxHull   = iAmAttacker ? combatResult.maxHullB : combatResult.maxHullA;
  const enemyShield    = iAmAttacker ? pb.shieldB : pb.shieldA;
  const enemyMaxShield = iAmAttacker ? combatResult.maxShieldB : combatResult.maxShieldA;
  const enemyEnergy    = iAmAttacker ? pb.energyB : pb.energyA;
  const enemyMaxEnergy = iAmAttacker ? combatResult.maxEnergyB : combatResult.maxEnergyA;
  const enemySlots     = iAmAttacker ? pb.activeSlotsB : pb.activeSlotsA;

  const myFaction = FACTIONS[myFactionId];

  // Projectile visual side: my-side shots go left→right (A), enemy shots go right→left (B)
  function visualSide(actualSide: 'A' | 'B'): 'A' | 'B' {
    return (actualSide === myActualSide) ? 'A' : 'B';
  }

  const winnerFaction = combatResult.winner === 'A'
    ? FACTIONS[combatResult.factionA as FactionId]
    : FACTIONS[combatResult.factionB as FactionId];

  return (
    <div className="combat-view">

      <div className="corner tl">ENGAGEMENT · AUTO-BATTLE</div>
      <div className="corner tr">TICK {pb.tick}/{MAX_TICK_DISPLAY}</div>

      <div className="combat-stage">

        {/* My ship — always LEFT, facing right */}
        <CombatShip
          factionId={myFactionId}
          build={myBuild}
          facing="right"
          label="YOU"
          currentHull={myHull}     maxHull={myMaxHull}
          currentShield={myShield} maxShield={myMaxShield}
          currentEnergy={myEnergy} maxEnergy={myMaxEnergy}
          activeSlots={mySlots}
        />

        {/* Arena */}
        <div className="combat-arena">
          {projectiles.map(p => (
            <div
              key={p.id}
              className={`projectile projectile--${p.dmgType} projectile--${visualSide(p.side)}`}
              style={{
                '--proj-color': PROJ_COLOR[p.dmgType],
                '--ky': `${p.scatterY}px`,
                animationDelay: p.delayMs > 0 ? `${p.delayMs}ms` : undefined,
              } as React.CSSProperties}
            />
          ))}

          {pb.callout && <div className="combat-callout">{pb.callout}</div>}
          {pb.artBanner && <div className="art-banner">{pb.artBanner}</div>}
        </div>

        {/* Enemy ship — always RIGHT, facing left */}
        <CombatShip
          factionId={enemyFactionId}
          build={enemyBuild}
          facing="left"
          label="ENEMY"
          currentHull={enemyHull}     maxHull={enemyMaxHull}
          currentShield={enemyShield} maxShield={enemyMaxShield}
          currentEnergy={enemyEnergy} maxEnergy={enemyMaxEnergy}
          activeSlots={enemySlots}
        />
      </div>

      {/* Controls */}
      <div className="combat-controls">
        {pb.phase === 'idle' && (
          <button className="btn primary" onClick={startPlayback}>▸ START BATTLE</button>
        )}
        {pb.phase === 'playing' && (
          <span style={{ fontFamily: "'Press Start 2P'", fontSize: 7, color: 'var(--dim)' }}>SIMULATING…</span>
        )}
        {pb.phase === 'done' && (
          <>
            <div className="combat-result" style={{ color: winnerFaction?.color }}>
              {combatResult.winner === 'draw' ? 'DRAW' : `${winnerFaction?.name ?? '?'} WINS`}
            </div>
            <button className="btn" onClick={() => { setPb(initPlayState(combatResult)); }}>↻ REPLAY</button>
            <button className="btn" onClick={() => store.startCombat()}>⚔ NEW BATTLE</button>
            <button className="btn" onClick={() => store.setView('map')}>◄ MAP</button>
          </>
        )}
      </div>

      {/* Post-battle overlay */}
      {pb.phase === 'done' && !lootChosen && (
        <div className="combat-victory-overlay">
          <div className="victory-bg" />
          {localPlayerWon ? (
            connectionMode === 'online' ? (
              // Online win
              <div className="victory-content">
                <div className="victory-title" style={{ color: myFaction?.color }}>VICTORY</div>
                <BattleReport result={combatResult} iAmAttacker={iAmAttacker} />
                <div className="victory-stats" style={{ width: 'auto', textAlign: 'center', marginTop: 4 }}>
                  <span style={{ fontSize: 12, color: 'var(--dim)' }}>
                    {pb.tick} ticks · {Math.round(myHull / myMaxHull * 100)}% hull remaining
                  </span>
                </div>
                {boardingLoot && (
                  <BoardingRoulette
                    loot={boardingLoot}
                    iWon={true}
                    onRevealed={() => setRouletteRevealed(true)}
                  />
                )}
                {rouletteRevealed && (
                  <div className="victory-actions">
                    <button className="btn primary" onClick={() => { setLootChosen(true); store.applyCombatOutcome(true, null); }}>
                      ◄ RETURN TO MAP
                    </button>
                    <button className="btn" onClick={() => setPb(initPlayState(combatResult))}>↻ REPLAY</button>
                  </div>
                )}
              </div>
            ) : (
              // Solo win — choose loot
              <div className="victory-content">
                <div className="victory-title" style={{ color: myFaction?.color }}>VICTORY</div>
                <BattleReport result={combatResult} iAmAttacker={iAmAttacker} />
                <div className="victory-stats" style={{ width: 'auto', textAlign: 'center', marginTop: 4 }}>
                  <span style={{ fontSize: 12, color: 'var(--dim)' }}>
                    {pb.tick} ticks · {Math.round(myHull / myMaxHull * 100)}% hull remaining
                  </span>
                </div>
                <div className="victory-sub" style={{ marginTop: 6 }}>CHOOSE YOUR PRIZE</div>
                <div className="loot-grid">
                  {combatResult.buildB.grid
                    .filter(id => id && ARTIFACTS[id])
                    .map(id => {
                      const art = ARTIFACTS[id!]!;
                      return (
                        <button key={id} className="loot-artifact-btn"
                          onClick={() => { setLootChosen(true); store.applyCombatOutcome(true, id!); }}>
                          <span className="loot-art-icon">✦</span>
                          <div>
                            <div className="loot-art-name">{art.name}</div>
                            <div className="loot-art-desc">{art.description}</div>
                          </div>
                        </button>
                      );
                    })}
                  {combatResult.buildB.grid.filter(id => id && ARTIFACTS[id]).length === 0 && (
                    <div style={{ color: 'var(--dim)', fontSize: 14 }}>Enemy had no artifacts to loot.</div>
                  )}
                </div>
                <div className="victory-actions">
                  <button className="btn" onClick={() => { setLootChosen(true); store.applyCombatOutcome(true, null); }}>
                    TAKE NOTHING · RETURN TO MAP
                  </button>
                  <button className="btn" onClick={() => setPb(initPlayState(combatResult))}>↻ REPLAY</button>
                </div>
              </div>
            )
          ) : (
            // Defeat
            <div className="victory-content">
              <div className="victory-title" style={{ color: 'var(--red)' }}>DEFEAT</div>
              <BattleReport result={combatResult} iAmAttacker={iAmAttacker} />
              <div className="victory-stats" style={{ width: 'auto', textAlign: 'center', marginTop: 4 }}>
                <span style={{ fontSize: 12, color: 'var(--dim)' }}>
                  {pb.tick} ticks · your ship warps home
                </span>
              </div>
              {boardingLoot && connectionMode === 'online' && (
                <BoardingRoulette
                  loot={boardingLoot}
                  iWon={false}
                  onRevealed={() => setRouletteRevealed(true)}
                />
              )}
              {(!boardingLoot || !connectionMode || connectionMode !== 'online' || rouletteRevealed) && (
                <div className="victory-actions">
                  <button className="btn primary" onClick={() => { setLootChosen(true); store.applyCombatOutcome(false, null); }}>
                    RETREAT TO MAP
                  </button>
                  <button className="btn" onClick={() => setPb(initPlayState(combatResult))}>↻ REPLAY</button>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

const MAX_TICK_DISPLAY = 1500;
