import type { FactionId, FactionPassive, ShipBuild } from './types';
import { FACTION_HOME_SYSTEM } from './galaxy';

export type HullShape = 'volkesh' | 'korthaar' | 'idryn' | 'nyxari' | 'rask' | 'vaesh';

export type FactionData = {
  id: FactionId;
  name: string;
  fullName: string;
  color: string;       // hex string
  colorHex: number;    // 0xRRGGBB for PixiJS
  homeSystemId: number;
  startArtifactId: string;
  strengths: string;
  weaknesses: string;
  hullShape: HullShape;
  passives: FactionPassive;
};

export const FACTIONS: Record<FactionId, FactionData> = {
  VOLKESH: {
    id: 'VOLKESH',
    name: "VOL'KESH",
    fullName: "Vol'Kesh Combine",
    color: '#d9a441',
    colorHex: 0xd9a441,
    homeSystemId: FACTION_HOME_SYSTEM['VOLKESH'],
    startArtifactId: 'gilded-aegis',
    strengths: 'Trade — best market prices, bonus cargo, cheaper fuel',
    weaknesses: 'Combat — thin hull (−20 base hull)',
    hullShape: 'volkesh',
    passives: {},
  },
  KORTHAAR: {
    id: 'KORTHAAR',
    name: 'KORTHAAR',
    fullName: 'Korthaar Clans',
    color: '#c4513b',
    colorHex: 0xc4513b,
    homeSystemId: FACTION_HOME_SYSTEM['KORTHAAR'],
    startArtifactId: 'wrath-engine',
    strengths: 'Combat — +30 hull, +10% weapon damage',
    weaknesses: 'Trade — sell prices ×0.75',
    hullShape: 'korthaar',
    passives: {},
  },
  IDRYN: {
    id: 'IDRYN',
    name: 'IDRYN',
    fullName: 'Idryn Concord',
    color: '#5fa8a4',
    colorHex: 0x5fa8a4,
    homeSystemId: FACTION_HOME_SYSTEM['IDRYN'],
    startArtifactId: 'concord-prism',
    strengths: 'Artifacts — amplifies all artifact abilities, −50◈ on rumored artifacts',
    weaknesses: 'Average combat firepower',
    hullShape: 'idryn',
    passives: {},
  },
  NYXARI: {
    id: 'NYXARI',
    name: 'NYXARI',
    fullName: 'Nyxari Nomads',
    color: '#8a9a5b',
    colorHex: 0x8a9a5b,
    homeSystemId: FACTION_HOME_SYSTEM['NYXARI'],
    startArtifactId: 'far-sight',
    strengths: 'Mobility — −2 fuel per jump',
    weaknesses: 'Small cargo hold (−20 base cargo)',
    hullShape: 'nyxari',
    passives: {},
  },
  RASK: {
    id: 'RASK',
    name: 'RASK',
    fullName: 'The Rask',
    color: '#e8512e',
    colorHex: 0xe8512e,
    homeSystemId: FACTION_HOME_SYSTEM['RASK'],
    startArtifactId: 'weapon-jammer',
    strengths: 'Disruption — Weapon Jammer shuts down an enemy weapon when cornered, turning losing fights around',
    weaknesses: 'No special stat advantage; success depends on building a strong combat loadout and picking good fights',
    hullShape: 'rask',
    passives: {},
  },
  VAESH: {
    id: 'VAESH',
    name: 'VAESH',
    fullName: 'Vaesh Synod',
    color: '#8a7caa',
    colorHex: 0x8a7caa,
    homeSystemId: FACTION_HOME_SYSTEM['VAESH'],
    startArtifactId: 'overclock-matrix',
    strengths: 'Technology — exclusive Advanced Reactor & Advanced Capacitor modules',
    weaknesses: 'Expensive to maintain',
    hullShape: 'vaesh',
    passives: {}, // advantage comes from exclusive parts, not stat modifiers
  },
};

export const FACTION_IDS: FactionId[] = ['VOLKESH', 'KORTHAAR', 'IDRYN', 'NYXARI', 'RASK', 'VAESH'];

export function factionColor(id: FactionId): string {
  return FACTIONS[id].color;
}

// Default starting build per faction (artifact in CORE slot 4, weapon in BOW slot 0, utility in STERN slot 8)
export const FACTION_STARTER_BUILDS: Record<FactionId, ShipBuild> = {
  VOLKESH:  { grid: ['pulse-laser', null, null, null, 'gilded-aegis',     null, null, null, 'cargo-bay'] },
  KORTHAAR: { grid: ['railgun',     null, null, null, 'wrath-engine',     null, null, null, 'armor-plate'] },
  IDRYN:    { grid: ['pulse-laser', null, null, null, 'concord-prism',    null, null, null, 'shield-projector'] },
  NYXARI:   { grid: ['pulse-laser', null, null, null, 'far-sight',        null, null, null, 'ion-engine'] },
  RASK:     { grid: ['missile-pod', null, null, null, 'weapon-jammer',    null, null, null, 'shield-projector'] },
  VAESH:    { grid: ['railgun', 'capacitor', null, null, 'overclock-matrix', null, null, null, null] },
};
