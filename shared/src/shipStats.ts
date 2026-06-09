import type { FactionId, Part, ShipBuild, Zone } from './types';

export type DerivedStats = {
  hull: number;
  shieldMax: number;
  shieldRegen: number;
  energyPerTick: number;
  energyMax: number;
  evasion: number;
  range: number;
  cargo: number;
  fireRate: number;
  weaponCount: number;
  artifactCount: number;
  adjacencyBonus: boolean[]; // length 9 — true = cell has an active adjacency bonus
};

export function indexToZone(i: number): Zone {
  if (i < 3) return 'bow';
  if (i < 6) return 'core';
  return 'stern';
}

export function getNeighborIndices(i: number): number[] {
  const row = Math.floor(i / 3);
  const col = i % 3;
  const out: number[] = [];
  if (col > 0) out.push(i - 1);
  if (col < 2) out.push(i + 1);
  if (row > 0) out.push(i - 3);
  if (row < 2) out.push(i + 3);
  return out;
}

export function deriveStats(build: ShipBuild, parts: Record<string, Part>, factionId?: FactionId): DerivedStats {
  const grid = build.grid;

  let hull          = 150;
  let shieldMax     = 0;
  let shieldRegen   = 0;
  let energyPerTick = 1;
  let energyMax     = 30;
  let evasion       = 0;
  let range         = 1;
  let cargo         = 10;
  let fireRate      = 0;
  let weaponCount   = 0;
  let artifactCount = 0;
  const adjacencyBonus: boolean[] = Array(9).fill(false);

  // Pass 1: base stats
  let hasGildedAegis = false;
  for (let i = 0; i < 9; i++) {
    const id = grid[i];
    if (!id) continue;
    const p = parts[id];

    if (!p) {
      // Not a Part → must be an Artifact
      artifactCount++;
      if (id === 'gilded-aegis') hasGildedAegis = true;
      continue;
    }

    hull          += p.stats.hull          ?? 0;
    shieldMax     += p.stats.shieldMax     ?? 0;
    shieldRegen   += p.stats.shieldRegen   ?? 0;
    energyPerTick += p.stats.energyPerTick ?? 0;
    energyMax     += p.stats.energyMax     ?? 0;
    evasion       += p.stats.evasion       ?? 0;
    range         += p.stats.range         ?? 0;
    cargo         += p.stats.cargo         ?? 0;

    if (p.type === 'weapon')   weaponCount++;
    if (p.type === 'artifact') artifactCount++;

  }

  // Gilded Aegis provides a virtual 30-point shield pool even without a Shield Projector
  if (hasGildedAegis && shieldMax === 0) shieldMax = 30;

  // Pass 2: adjacency-dependent fire rate (type-specific — only the weapon gets the bonus and glows)
  // pulse-laser: Reactor (gen) | railgun: Capacitor (cap) | missile-pod: Cargo Bay (cargo)
  for (let i = 0; i < 9; i++) {
    const id = grid[i];
    if (!id) continue;
    const p = parts[id];
    if (!p || p.type !== 'weapon') continue;

    let fr = p.stats.fireRate ?? 10;

    // Bow zone: +10%
    if (indexToZone(i) === 'bow') fr *= 1.1;

    const hasAdj = getNeighborIndices(i).some(j => {
      const nid = grid[j];
      if (!nid) return false;
      const nt = parts[nid]?.type;
      if (id === 'pulse-laser')  return nt === 'gen';
      if (id === 'railgun')      return nt === 'cap';
      if (id === 'missile-pod')  return nt === 'cargo';
      return false;
    });
    if (hasAdj) {
      fr *= 1.15;
      adjacencyBonus[i] = true;
    }

    fireRate += fr;
  }

  return {
    hull,
    shieldMax,
    shieldRegen,
    energyPerTick,
    energyMax,
    evasion,
    range,
    cargo,
    fireRate: Math.round(fireRate),
    weaponCount,
    artifactCount,
    adjacencyBonus,
  };
}
