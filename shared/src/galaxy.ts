import type { CrewId, Galaxy, GoodId, MarketEntry, System, SystemTemplate } from './types';
import { mulberry32, seededInt, seededPick, seededShuffle } from './rng';

const STANDARD_CREW_IDS: CrewId[] = ['gunner', 'engineer', 'smuggler', 'trader', 'demolitions-expert'];

// Module IDs available at standard stations (no faction exclusives)
const STANDARD_MODULE_IDS = [
  'pulse-laser', 'railgun', 'missile-pod',
  'shield-projector', 'armor-plate', 'point-defense',
  'reactor', 'capacitor',
  'ion-engine', 'fuel-tank', 'cargo-bay',
];
const VAESH_HOME_ID = 12;
const VAESH_EXCLUSIVE_MODULE_IDS = ['advanced-reactor', 'advanced-capacitor'];

// ── Static map skeleton ───────────────────────────────────────────────────────
// 18 systems, 4 regions + a contested center cluster.
// Positions are percentages (0–100) of canvas width/height.
// Home systems form a ring around the outer edge (one per faction, 6 total).
// isHome order maps to faction order: VOLKESH, KORTHAAR, IDRYN, NYXARI, RASK, VAESH

export const GALAXY_TEMPLATE: SystemTemplate[] = [
  // ── Region 1: North ─────────────────────────────────────────────────
  { id: 0,  name: 'Sol Gate',      pos: { x: 28, y: 14 }, region: 1, hasStation: true,  isHome: true  }, // VOLKESH
  { id: 1,  name: 'Tarsis',        pos: { x: 48, y: 8  }, region: 1, hasStation: true,  isHome: false },
  { id: 2,  name: 'Kepler-9',      pos: { x: 70, y: 14 }, region: 1, hasStation: true,  isHome: true  }, // KORTHAAR
  { id: 3,  name: 'Veil Pass',     pos: { x: 42, y: 28 }, region: 1, hasStation: false, isHome: false },
  // ── Region 2: East ──────────────────────────────────────────────────
  { id: 4,  name: 'Ordo Vault',    pos: { x: 84, y: 28 }, region: 2, hasStation: true,  isHome: true  }, // IDRYN
  { id: 5,  name: 'Obsidian',      pos: { x: 78, y: 46 }, region: 2, hasStation: true,  isHome: false },
  { id: 6,  name: 'Kess',          pos: { x: 88, y: 62 }, region: 2, hasStation: false, isHome: false },
  // ── Region 3: South ─────────────────────────────────────────────────
  { id: 7,  name: 'Helix Forge',   pos: { x: 72, y: 78 }, region: 3, hasStation: true,  isHome: false },
  { id: 8,  name: 'Drift-7',       pos: { x: 50, y: 86 }, region: 3, hasStation: true,  isHome: true  }, // NYXARI
  { id: 9,  name: 'Warren',        pos: { x: 30, y: 80 }, region: 3, hasStation: false, isHome: false },
  // ── Region 4: West ──────────────────────────────────────────────────
  { id: 10, name: 'Helion',        pos: { x: 14, y: 66 }, region: 4, hasStation: true,  isHome: true  }, // RASK
  { id: 11, name: 'Nyx Rift',      pos: { x: 10, y: 46 }, region: 4, hasStation: false, isHome: false },
  { id: 12, name: 'Dustfall',      pos: { x: 16, y: 30 }, region: 4, hasStation: true,  isHome: true  }, // VAESH
  // ── Center: contested hub ────────────────────────────────────────────
  { id: 13, name: 'Cor Nexus',     pos: { x: 44, y: 46 }, region: 4, hasStation: true,  isHome: false },
  { id: 14, name: 'Relay Prime',   pos: { x: 58, y: 38 }, region: 2, hasStation: false, isHome: false },
  { id: 15, name: 'Sable Station', pos: { x: 64, y: 58 }, region: 3, hasStation: true,  isHome: false },
  { id: 16, name: 'Iron Reach',    pos: { x: 36, y: 62 }, region: 4, hasStation: false, isHome: false },
  { id: 17, name: 'Void Crossing', pos: { x: 50, y: 50 }, region: 1, hasStation: true,  isHome: false },
];

// 27 lane connections — same every game
export const LANES: [number, number][] = [
  // North internal
  [0, 1], [1, 2], [0, 3], [1, 3],
  // East internal
  [4, 5], [5, 6],
  // South internal
  [7, 8], [8, 9],
  // West internal
  [10, 11], [11, 12],
  // North → center
  [3, 13], [2, 14], [1, 17],
  // East → center
  [4, 14], [5, 15], [6, 15],
  // South → center
  [7, 15], [8, 15], [9, 16],
  // West → center
  [10, 16], [11, 13], [12, 13],
  // Center mesh
  [13, 17], [13, 16], [14, 15], [14, 17], [15, 17], [16, 17],
];

// ── Lane cost lookup (Euclidean distance, rounded) ───────────────────────────
export function laneCost(a: SystemTemplate, b: SystemTemplate): number {
  const dx = a.pos.x - b.pos.x;
  const dy = a.pos.y - b.pos.y;
  return Math.max(5, Math.round(Math.sqrt(dx * dx + dy * dy) / 3.5));
}

// ── Home system IDs per faction (index = faction order) ──────────────────────
export const FACTION_HOME_SYSTEM: Record<string, number> = {
  VOLKESH:  0,
  KORTHAAR: 2,
  IDRYN:    4,
  NYXARI:   8,
  RASK:     10,
  VAESH:    12,
};

// ── Galaxy generator ─────────────────────────────────────────────────────────

const TRADEABLE_GOODS: GoodId[] = ['ore', 'data', 'tech', 'bio'];

// Regional price profiles: each region exports one good cheaply
const REGIONAL_SPECIALTY: Record<number, GoodId> = {
  1: 'ore',
  2: 'data',
  3: 'bio',
  4: 'tech',
};

export function generateGalaxy(seed: number): Galaxy {
  const rng = mulberry32(seed);

  // Separate RNG for module assignment — keeps market/fuel RNG sequence stable.
  // Each station gets 3 DISTINCT modules via a full shuffle of all standard modules.
  const moduleRng = mulberry32(seed + 77777);
  const stationSystems = GALAXY_TEMPLATE.filter((t) => t.hasStation);
  const stationModuleMap = new Map<number, string[]>();
  for (const tmpl of stationSystems) {
    const shuffled = seededShuffle([...STANDARD_MODULE_IDS], moduleRng);
    stationModuleMap.set(tmpl.id, shuffled.slice(0, 3));
  }

  // Separate RNG for crew assignment — each station gets 2 distinct crew members.
  const crewRng = mulberry32(seed + 88888);
  const stationCrewMap = new Map<number, CrewId[]>();
  for (const tmpl of stationSystems) {
    const shuffled = seededShuffle([...STANDARD_CREW_IDS], crewRng);
    stationCrewMap.set(tmpl.id, shuffled.slice(0, 2) as CrewId[]);
  }

  const systems: System[] = GALAXY_TEMPLATE.map((tmpl) => {
    const market: MarketEntry[] = [];

    if (tmpl.hasStation) {
      const specialty = REGIONAL_SPECIALTY[tmpl.region];
      // Specialty (export): station sells it cheap — players can only BUY here.
      market.push({
        good: specialty,
        mode: 'buy_only',
        buy: seededInt(rng, 8, 16),
        sell: 0,
        stock: seededInt(rng, 4, 8),
      });
      // Secondary (import): station buys it from players — players can only SELL here.
      const others = TRADEABLE_GOODS.filter((g) => g !== specialty);
      const secondary = seededPick(others, rng);
      market.push({
        good: secondary,
        mode: 'sell_only',
        buy: 0,
        sell: seededInt(rng, 30, 50),
        stock: 0,
      });
    }

    // stationModules: 3 standard for all stations; VAESH home adds 2 exclusives
    let stationModules: string[] = stationModuleMap.get(tmpl.id) ?? [];
    if (tmpl.id === VAESH_HOME_ID) {
      stationModules = [...stationModules, ...VAESH_EXCLUSIVE_MODULE_IDS];
    }

    const stationCrew: CrewId[] = stationCrewMap.get(tmpl.id) ?? [];

    return {
      id: tmpl.id,
      name: tmpl.name,
      pos: tmpl.pos,
      region: tmpl.region,
      hasStation: tmpl.hasStation,
      market,
      fuelPrice: seededInt(rng, 8, 20),
      fuelStock: seededInt(rng, 30, 70),
      stationModules,
      stationCrew,
    };
  });

  return { systems, lanes: LANES };
}
