/**
 * Stellar Dominion — Deterministic Combat Engine
 *
 * Pure function, runs identically on server and client.
 * Balance references: FTL (cooldown/energy loop), Backpack Battles (RPS counters),
 * Oaken Tower (artifact power curve — neutrals > faction starters).
 *
 * Tick rate: 50 ticks/s sim, MAX_TICKS 1500 (~30s max fight).
 */

import { mulberry32 } from './rng';
import { PARTS } from './parts';
import { ARTIFACTS } from './artifacts';
import { getNeighborIndices } from './shipStats';
import type { CombatEvent, CombatResult, CombatSide, CrewId, DamageType, FactionId, ShipBuild } from './types';

// ── Constants ────────────────────────────────────────────────────────────────

const MAX_TICKS = 1500;
const BASE_HULL = 150;
const BASE_ENERGY = 10;         // starting energy at tick 0
const BASE_ENERGY_PER_TICK = 1;
const BASE_ENERGY_MAX = 30;
const EVASION_CAP = 0.50;

// ── Weapon stats ─────────────────────────────────────────────────────────────
// Damage, accuracy, energy cost, base cooldown ticks
// FTL-style: laser = fast+low dmg, railgun = slow+high dmg, missile = bypass shield

const WEAPON_STATS: Record<string, {
  damage: number; accuracy: number; energyCost: number; cooldown: number;
}> = {
  'pulse-laser': { damage: 4,  accuracy: 0.85, energyCost: 8,  cooldown: 14 },
  'railgun':     { damage: 8,  accuracy: 0.72, energyCost: 20, cooldown: 22 },
  'missile-pod': { damage: 5,  accuracy: 0.90, energyCost: 12, cooldown: 20 },
};

// ── Defensive / utility part stats for combat ─────────────────────────────────

const DEF_STATS: Record<string, {
  hull?: number; shieldPool?: number; shieldRegen?: number;
  armor?: number; pointDefChance?: number;
}> = {
  'shield-projector': { shieldPool: 60, shieldRegen: 1/3 },
  'armor-plate':       { hull: 40, armor: 6 },
  'point-defense':     { pointDefChance: 0.50 },
};

const GEN_STATS: Record<string, { energyPerTick: number; energyMax: number }> = {
  'reactor':             { energyPerTick: 8,  energyMax: 20 },
  'capacitor':           { energyPerTick: 4,  energyMax: 40 },
  'advanced-reactor':    { energyPerTick: 14, energyMax: 30 },
  'advanced-capacitor':  { energyPerTick: 6,  energyMax: 80 },
};

const ENGINE_EVASION = 0.10; // per ion-engine

// ── RPS counter modifier ─────────────────────────────────────────────────────
// vs shield: laser ×2.0, kinetic ×0.6
// vs armor (no shield): laser ×0.6, kinetic ×1.5
// missile always hits hull (bypasses shield), no armor modifier

function counterMod(
  dmgType: DamageType,
  oppShield: number,
  oppHasArmor: boolean,
): { mod: number; callout?: string } {
  if (dmgType === 'missile') return { mod: 1.0 };
  if (oppShield > 0) {
    if (dmgType === 'laser')   return { mod: 2.0, callout: 'LASER ▸ BURNS SHIELD' };
    if (dmgType === 'kinetic') return { mod: 0.6, callout: 'RAILGUN ▸ DEFLECTED BY SHIELD' };
  } else if (oppHasArmor) {
    if (dmgType === 'laser')   return { mod: 0.6, callout: 'ARMOR ▸ ABSORBS LASER' };
    if (dmgType === 'kinetic') return { mod: 1.5, callout: 'RAILGUN ▸ CRACKS ARMOR' };
  }
  return { mod: 1.0 };
}

// ── Combat side state ─────────────────────────────────────────────────────────

interface WeaponState {
  slotIndex: number;
  partId: string;
  dmgType: DamageType;
  damage: number;
  accuracy: number;
  energyCost: number;
  baseCooldown: number;
  cooldownLeft: number;
  disabledFor: number; // ticks remaining disabled
}

interface SideState {
  hull: number;
  maxHull: number;
  shield: number;
  maxShield: number;
  shieldRegen: number;
  energy: number;
  maxEnergy: number;
  energyPerTick: number;
  evasion: number;
  armor: number;
  hasArmor: boolean;
  pointDefChance: number;
  weapons: WeaponState[];
  grid: (string | null)[];
  equippedArtifacts: string[]; // artifact ids physically in grid
  // Artifact runtime state
  nullFieldCd: number;          // ticks until next Null Field regen-block pulse
  phaseDriveCd: number;         // ticks until Phase Drive window opens
  phaseDriveWindowTicks: number; // ticks remaining in active dodge window
  shieldNullTicks: number;      // ticks left that shield regen is blocked
  overclockShots: number;       // Overclock Matrix shots remaining
  chronoActive: boolean;        // Chrono Capacitor burst phase
  wrathActive: boolean;         // Wrath Engine triggered
  weaponJammerUsed: boolean;    // Weapon Jammer one-time trigger used
  swarmAccum: number;           // fractional HP accumulator for Repair Swarm
  missileMult: number;          // Demolitions Expert: 1.5, otherwise 1.0
}

interface SideMods {
  prismMult?: number;
  crewGunnerAcc?: number;       // +0.15 accuracy on all weapons
  crewEngineerEnergy?: number;  // +3 energy/tick
  crewDemoMult?: boolean;       // Demolitions Expert: missile damage ×1.5
}

function buildSide(build: ShipBuild, mods: SideMods = {}): SideState {
  const {
    prismMult = 1.0,
    crewGunnerAcc = 0,
    crewEngineerEnergy = 0,
    crewDemoMult = false,
  } = mods;

  const grid = build.grid;
  let hull = BASE_HULL;
  let maxShield = 0, shieldRegen = 0;
  let energyPerTick = BASE_ENERGY_PER_TICK, maxEnergy = BASE_ENERGY_MAX;
  let evasion = 0, armor = 0, hasArmor = false, pointDefChance = 0;
  const weapons: WeaponState[] = [];
  const equippedArtifacts: string[] = [];

  // Pass 1: gather base defensive / utility stats
  for (let i = 0; i < 9; i++) {
    const id = grid[i];
    if (!id) continue;
    if (DEF_STATS[id]) {
      const d = DEF_STATS[id];
      hull         += d.hull         ?? 0;
      maxShield    += d.shieldPool   ?? 0;
      shieldRegen  += d.shieldRegen  ?? 0;
      armor        += d.armor        ?? 0;
      pointDefChance = Math.min(1, pointDefChance + (d.pointDefChance ?? 0));
      if (id === 'armor-plate') hasArmor = true;
    }
    if (GEN_STATS[id]) {
      energyPerTick += GEN_STATS[id].energyPerTick;
      maxEnergy     += GEN_STATS[id].energyMax;
    }
    if (PARTS[id]?.type === 'engine') {
      evasion += ENGINE_EVASION;
    }
    if (ARTIFACTS[id]) {
      equippedArtifacts.push(id);
    }
  }

  // Pass 2: weapons (need neighbour data)
  for (let i = 0; i < 9; i++) {
    const id = grid[i];
    if (!id || !WEAPON_STATS[id]) continue;
    const ws = WEAPON_STATS[id];
    const part = PARTS[id];

    // Adjacency: generator/capacitor next to weapon → −15% cooldown
    const hasGenAdj = getNeighborIndices(i).some(j => {
      const nid = grid[j];
      return nid !== null && GEN_STATS[nid] !== undefined;
    });
    const adjCooldown = hasGenAdj ? Math.round(ws.cooldown * 0.85) : ws.cooldown;

    // BOW zone: +10% accuracy
    const zoneAcc = i < 3 ? Math.min(0.97, ws.accuracy * 1.10) : ws.accuracy;

    // Gunner crew: +15% accuracy on each weapon
    const gunnerAcc = Math.min(0.97, zoneAcc * (1 + crewGunnerAcc));

    weapons.push({
      slotIndex: i,
      partId: id,
      dmgType: part.damageType!,
      damage: ws.damage,
      accuracy: gunnerAcc,
      energyCost: ws.energyCost,
      baseCooldown: adjCooldown,
      cooldownLeft: adjCooldown, // start with first cooldown (weapons don't instant-fire)
      disabledFor: 0,
    });
  }

  // Engineer crew: +3 energy/tick
  energyPerTick += crewEngineerEnergy;

  // Far Sight: first strike — weapons start at half cooldown; +15% evasion
  if (equippedArtifacts.includes('far-sight')) {
    for (const w of weapons) w.cooldownLeft = Math.ceil(w.baseCooldown / 2);
    evasion += 0.15 * prismMult;
  }

  // Demolitions Expert: missile damage ×1.5
  const missileMult = crewDemoMult ? 1.5 : 1.0;

  // Overclock Matrix: first 3 shots bypass shields
  const overclockShots = equippedArtifacts.includes('overclock-matrix') ? Math.round(3 * prismMult) : 0;

  // Chrono Capacitor active at start
  const chronoActive = equippedArtifacts.includes('chrono-capacitor');

  // Null Field fires at combat start (tick 1), then every 400 ticks
  const nullFieldCd = 1;
  // Phase Drive opens first window after 6s (300 ticks)
  const phaseDriveCd = Math.round(300 / prismMult);

  return {
    hull, maxHull: hull,
    shield: maxShield, maxShield,
    shieldRegen,
    energy: BASE_ENERGY, maxEnergy,
    energyPerTick,
    evasion: Math.min(EVASION_CAP, evasion),
    armor, hasArmor,
    pointDefChance,
    weapons,
    grid,
    equippedArtifacts,
    nullFieldCd,
    phaseDriveCd,
    phaseDriveWindowTicks: 0,
    shieldNullTicks: 0,
    overclockShots,
    chronoActive,
    wrathActive: false,
    weaponJammerUsed: false,
    swarmAccum: 0,
    missileMult,
  };
}

// ── Main combat function ──────────────────────────────────────────────────────

export function runCombat(
  buildA: ShipBuild,
  buildB: ShipBuild,
  factionA: FactionId,
  factionB: FactionId,
  seed: number,
  crewA: (CrewId | null)[] = [],
  crewB: (CrewId | null)[] = [],
): CombatResult {
  const rng = mulberry32(seed);

  const hasCrewA = (id: CrewId) => crewA.includes(id);
  const hasCrewB = (id: CrewId) => crewB.includes(id);

  // Check if either side has Concord Prism (IDRYN artifact: +25% all other arts)
  const artA = buildA.grid.filter(Boolean).filter(id => ARTIFACTS[id!]);
  const artB = buildB.grid.filter(Boolean).filter(id => ARTIFACTS[id!]);
  const prismA = artA.includes('concord-prism') ? 1.25 : 1.0;
  const prismB = artB.includes('concord-prism') ? 1.25 : 1.0;

  const A = buildSide(buildA, {
    prismMult: prismA,
    crewGunnerAcc:    hasCrewA('gunner')               ? 0.15 : 0,
    crewEngineerEnergy: hasCrewA('engineer')            ? 3    : 0,
    crewDemoMult:     hasCrewA('demolitions-expert'),
  });
  const B = buildSide(buildB, {
    prismMult: prismB,
    crewGunnerAcc:    hasCrewB('gunner')               ? 0.15 : 0,
    crewEngineerEnergy: hasCrewB('engineer')            ? 3    : 0,
    crewDemoMult:     hasCrewB('demolitions-expert'),
  });

  // Siege Battery: +10% hull damage only (applied at shot time, not to shield damage)
  const siegeMultA = A.equippedArtifacts.includes('siege-battery') ? 1 + 0.10 * prismA : 1.0;
  const siegeMultB = B.equippedArtifacts.includes('siege-battery') ? 1 + 0.10 * prismB : 1.0;

  const events: CombatEvent[] = [];

  function snap() {
    return {
      hullA: Math.max(0, A.hull), hullB: Math.max(0, B.hull),
      shieldA: A.shield, shieldB: B.shield,
      energyA: A.energy, energyB: B.energy,
    };
  }

  function pushEvt(partial: Omit<CombatEvent, 'hullA' | 'hullB' | 'shieldA' | 'shieldB' | 'energyA' | 'energyB'>) {
    events.push({ ...partial, ...snap() });
  }

  function applyDamage(
    tick: number,
    attackerSide: CombatSide,
    weapon: WeaponState,
    siegeMult: number,
    target: SideState,
    attacker: SideState,
  ): boolean {
    const targetSide: CombatSide = attackerSide === 'A' ? 'B' : 'A';

    // Hit roll (accuracy vs evasion)
    const hitChance = weapon.accuracy * (1 - target.evasion);
    if (rng() > hitChance) {
      pushEvt({ tick, side: attackerSide, type: 'miss', slotIndex: weapon.slotIndex, damageType: weapon.dmgType });
      return false;
    }

    // Missile: point-defense intercept
    if (weapon.dmgType === 'missile' && target.pointDefChance > 0) {
      if (rng() < target.pointDefChance) {
        const pdSlot = target.grid.findIndex(id => id === 'point-defense');
        pushEvt({
          tick, side: targetSide, type: 'intercept',
          slotIndex: pdSlot >= 0 ? pdSlot : weapon.slotIndex,
          damageType: 'missile',
          callout: 'POINT-DEF ▸ INTERCEPTS MISSILE',
        });
        return false;
      }
    }

    // Phase Drive: 50% dodge chance during active window
    if (target.phaseDriveWindowTicks > 0 && rng() < 0.50) {
      const pdSlot = target.grid.findIndex(id => id === 'phase-drive');
      pushEvt({ tick, side: targetSide, type: 'phase_dodge', slotIndex: pdSlot >= 0 ? pdSlot : 8, callout: 'PHASE DRIVE ▸ EVADES VOLLEY' });
      return false;
    }

    // Base damage (missile gets Demolitions Expert ×1.5; Siege Battery applies to hull only)
    const demoBoost = weapon.dmgType === 'missile' ? attacker.missileMult : 1.0;
    let rawDmg = Math.round(weapon.damage * demoBoost);

    // Overclock Matrix: bypass shields for first N shots
    const bypassShield = weapon.dmgType === 'missile' || attacker.overclockShots > 0;
    if (attacker.overclockShots > 0) attacker.overclockShots--;

    let shieldDmg = 0;
    let hullDmg = 0;
    let callout: string | undefined;

    if (!bypassShield && target.shield > 0 && target.shieldNullTicks <= 0) {
      // Damage hits active shield (Siege Battery does NOT boost shield damage)
      const { mod, callout: c } = counterMod(weapon.dmgType, target.shield, target.hasArmor);
      callout = c;
      const totalVsShield = Math.round(rawDmg * mod);
      shieldDmg = Math.min(target.shield, totalVsShield);
      target.shield -= shieldDmg;
      const overflow = totalVsShield - shieldDmg;
      hullDmg = Math.max(0, Math.round(overflow * siegeMult) - target.armor); // Siege Battery on overflow to hull
      target.hull -= hullDmg;
    } else {
      // Hits hull directly (Siege Battery applies here)
      const { mod, callout: c } = counterMod(weapon.dmgType, 0, target.hasArmor);
      if (!callout) callout = c;
      if (weapon.dmgType === 'missile' && shieldDmg === 0 && !callout) callout = 'MISSILE ▸ BREACHES HULL';
      if (bypassShield && weapon.dmgType !== 'missile' && !callout) callout = 'OVERCLOCK ▸ BYPASSES SHIELD';
      hullDmg = Math.max(1, Math.round(rawDmg * mod * siegeMult) - target.armor);
      target.hull -= hullDmg;
    }

    // Vampire Array: life-steal
    if (attacker.equippedArtifacts.includes('vampire-array')) {
      const heal = Math.round((shieldDmg + hullDmg) * 0.15 * (attacker.equippedArtifacts.includes('concord-prism') ? 1.25 : 1));
      if (heal > 0) {
        attacker.hull = Math.min(attacker.maxHull, attacker.hull + heal);
      }
    }

    pushEvt({
      tick, side: attackerSide, type: 'hit',
      slotIndex: weapon.slotIndex, damageType: weapon.dmgType,
      shieldDmg, hullDmg, callout,
    });

    return target.hull <= 0;
  }

  // ── Tick loop ────────────────────────────────────────────────────────────

  for (let tick = 1; tick <= MAX_TICKS; tick++) {
    // ── Regen phase ──────────────────────────────────────────────────────────
    for (const [side, st, prismMult] of [
      ['A' as CombatSide, A, prismA] as const,
      ['B' as CombatSide, B, prismB] as const,
    ]) {
      st.energy = Math.min(st.maxEnergy, st.energy + st.energyPerTick);

      // Shield regen (blocked by Null Field — shield HP is retained, only regen stops)
      // Only apply regen cap when there is actual regen — otherwise Gilded Aegis shield persists
      if (st.shieldNullTicks > 0) {
        st.shieldNullTicks--;
      } else if (st.shieldRegen > 0) {
        st.shield = Math.min(st.maxShield, st.shield + st.shieldRegen);
      }

      // Repair Swarm: +0.5 HP/tick via fractional accumulator
      if (st.equippedArtifacts.includes('repair-swarm') && st.hull < st.maxHull) {
        st.swarmAccum += 0.2 * prismMult;
        if (st.swarmAccum >= 1) {
          const heal = Math.floor(st.swarmAccum);
          st.swarmAccum -= heal;
          st.hull = Math.min(st.maxHull, st.hull + heal);
          if (tick % 20 === 0) {
            const slotIdx = st.grid.findIndex(id => id === 'repair-swarm');
            pushEvt({ tick, side, type: 'regen', slotIndex: slotIdx >= 0 ? slotIdx : 4, healAmt: Math.round(10 * prismMult), effectDesc: 'REPAIR SWARM' });
          }
        }
      }

      // Chrono Capacitor burst phase ends at tick 150 (3s)
      if (st.chronoActive && tick > 150) st.chronoActive = false;

      // Gilded Aegis pulse every 300 ticks (6s) — works with or without Shield Projector
      if (st.equippedArtifacts.includes('gilded-aegis') && tick % Math.round(300 / prismMult) === 0) {
        const aegisCap = Math.round(30 * prismMult);
        const effectiveCap = Math.max(st.maxShield, aegisCap); // own cap of 30 when no shield equipped
        const restore = Math.min(aegisCap, Math.max(0, effectiveCap - st.shield));
        if (restore > 0) {
          st.shield += restore;
          const slotIdx = st.grid.findIndex(id => id === 'gilded-aegis');
          pushEvt({ tick, side, type: 'artifact_pulse', slotIndex: slotIdx >= 0 ? slotIdx : 4, artifactId: 'gilded-aegis', effectDesc: `SHIELD +${restore}` });
        }
      }

      // Null Field: fires at combat start (tick 1), then every 400 ticks — blocks enemy regen for 100 ticks
      if (st.equippedArtifacts.includes('null-field')) {
        st.nullFieldCd--;
        if (st.nullFieldCd <= 0) {
          st.nullFieldCd = Math.round(400 / prismMult);
          const opp = side === 'A' ? B : A;
          const nullDur = Math.round(100 * prismMult);
          opp.shieldNullTicks = nullDur;
          // shield HP is NOT wiped — only regen is blocked
          const slotIdx = st.grid.findIndex(id => id === 'null-field');
          pushEvt({ tick, side, type: 'artifact_pulse', slotIndex: slotIdx >= 0 ? slotIdx : 4, artifactId: 'null-field', callout: 'NULL FIELD ▸ REGEN JAMMED', effectDesc: `Enemy shield regen blocked ${nullDur} ticks` });
        }
      }

      // Phase Drive: every 6s (300 ticks) opens a 1s dodge window (50 ticks, 50% dodge per hit)
      if (st.equippedArtifacts.includes('phase-drive')) {
        if (st.phaseDriveWindowTicks > 0) {
          st.phaseDriveWindowTicks--;
        } else {
          st.phaseDriveCd--;
          if (st.phaseDriveCd <= 0) {
            st.phaseDriveWindowTicks = Math.round(50 * prismMult);
            st.phaseDriveCd = Math.round(300 / prismMult);
            const slotIdx = st.grid.findIndex(id => id === 'phase-drive');
            pushEvt({ tick, side, type: 'artifact_pulse', slotIndex: slotIdx >= 0 ? slotIdx : 4, artifactId: 'phase-drive', callout: 'PHASE DRIVE ▸ DODGE WINDOW OPEN', effectDesc: 'PHASE DRIVE ACTIVE (1s window)' });
          }
        }
      }

      // Weapon Jammer: when OWN hull drops below 30%, one-time disable of one random enemy weapon for 200 ticks (4s)
      if (!st.weaponJammerUsed && st.equippedArtifacts.includes('weapon-jammer') && st.hull < st.maxHull * 0.30) {
        st.weaponJammerUsed = true;
        const opp = side === 'A' ? B : A;
        const activeWeapons = opp.weapons.filter(w => w.disabledFor === 0);
        if (activeWeapons.length > 0) {
          const idx = Math.floor(rng() * activeWeapons.length);
          const disableDur = Math.round(200 * prismMult);
          activeWeapons[idx].disabledFor = disableDur;
          const slotIdx = st.grid.findIndex(id => id === 'weapon-jammer');
          pushEvt({ tick, side, type: 'weapon_disable', slotIndex: slotIdx >= 0 ? slotIdx : 4, artifactId: 'weapon-jammer', callout: 'WEAPON JAMMER ▸ WEAPON DISABLED', effectDesc: `${PARTS[activeWeapons[idx].partId]?.name ?? 'weapon'} disabled` });
        }
      }
    }

    // ── Weapon fire phase (collect shots then apply) ──────────────────────────

    type PendingShot = { side: CombatSide; weapon: WeaponState; siegeMult: number; attacker: SideState; target: SideState };
    const pending: PendingShot[] = [];

    for (const [side, st, opp, siegeMult] of [
      ['A' as CombatSide, A, B, siegeMultA] as const,
      ['B' as CombatSide, B, A, siegeMultB] as const,
    ]) {
      for (const w of st.weapons) {
        // Advance disable countdown
        if (w.disabledFor > 0) { w.disabledFor--; continue; }

        w.cooldownLeft--;
        if (w.cooldownLeft > 0) continue;
        if (st.energy < w.energyCost) {
          // Weapon charged but no energy — wait (don't reset cooldown)
          w.cooldownLeft = 0;
          continue;
        }

        // Fire!
        st.energy -= w.energyCost;

        // Reset cooldown (Wrath Engine + Chrono Capacitor modify this)
        let nextCooldown = w.baseCooldown;
        if (st.wrathActive) nextCooldown = Math.round(nextCooldown * 0.67);
        if (st.chronoActive) nextCooldown = Math.round(nextCooldown * 0.50);
        w.cooldownLeft = nextCooldown;

        // Wrath Engine check: triggers permanently once hull < 50%
        if (!st.wrathActive && st.equippedArtifacts.includes('wrath-engine') && st.hull < st.maxHull * 0.50) {
          st.wrathActive = true;
          const slotIdx = st.grid.findIndex(id => id === 'wrath-engine');
          pushEvt({ tick, side: side, type: 'artifact_pulse', slotIndex: slotIdx >= 0 ? slotIdx : 4, artifactId: 'wrath-engine', callout: 'WRATH ENGINE ▸ FIRE RATE +50%' });
        }

        // Emit fire event for UI slot highlight
        pushEvt({ tick, side: side, type: 'weapon_fire', slotIndex: w.slotIndex, damageType: w.dmgType });

        pending.push({ side: side, weapon: w, siegeMult, attacker: st, target: opp });
      }
    }

    // Apply damage in order (A attacks first on tie, could randomise)
    for (const shot of pending) {
      const killed = applyDamage(tick, shot.side, shot.weapon, shot.siegeMult, shot.target, shot.attacker);
      if (killed) {
        return finalResult(A, B, buildA, buildB, factionA, factionB, events, shot.side);
      }
    }
  }

  // Time limit: higher hull% wins; tie → 'draw'
  const pctA = A.hull / A.maxHull;
  const pctB = B.hull / B.maxHull;
  const winner = pctA > pctB ? 'A' : pctA < pctB ? 'B' : 'draw';
  return finalResult(A, B, buildA, buildB, factionA, factionB, events, winner === 'draw' ? 'A' : winner as CombatSide);
}

function finalResult(
  A: SideState, B: SideState,
  buildA: ShipBuild, buildB: ShipBuild,
  factionA: string, factionB: string,
  events: CombatEvent[],
  winner: CombatSide | 'draw',
): CombatResult {
  return {
    winner,
    timeline: events,
    buildA, buildB,
    factionA, factionB,
    maxHullA: A.maxHull, maxHullB: B.maxHull,
    maxShieldA: Math.max(A.maxShield, A.equippedArtifacts.includes('gilded-aegis') ? 30 : 0),
    maxShieldB: Math.max(B.maxShield, B.equippedArtifacts.includes('gilded-aegis') ? 30 : 0),
    maxEnergyA: A.maxEnergy, maxEnergyB: B.maxEnergy,
  };
}

// ── Test opponent (RASK) for M3 solo testing ──────────────────────────────────

export const TEST_RASK_BUILD: ShipBuild = {
  grid: [
    'railgun',          // 0 BOW — heavy kinetic
    'missile-pod',      // 1 BOW — shield-bypass
    'railgun',          // 2 BOW — heavy kinetic
    'reactor',          // 3 CORE — energy
    'weapon-jammer',    // 4 CORE — RASK artifact: disable enemy weapon when own hull <30%
    'armor-plate',      // 5 CORE — hull+armor
    'shield-projector', // 6 STERN — baseline shield
    'ion-engine',       // 7 STERN — evasion
    null,               // 8
  ],
};
