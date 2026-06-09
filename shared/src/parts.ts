import type { Part } from './types';

export const PARTS: Record<string, Part> = {
  // ── Weapons ───────────────────────────────────────────────────────────────
  'pulse-laser': {
    id: 'pulse-laser',
    name: 'Pulse Laser',
    type: 'weapon',
    damageType: 'laser',
    zoneAffinity: ['bow'],
    stats: { fireRate: 14 },
    adjacency: [{ neighborType: 'gen', stats: {}, cooldownMult: 0.85 }],
    cost: 120,
    icon: '/',
  },
  'railgun': {
    id: 'railgun',
    name: 'Railgun',
    type: 'weapon',
    damageType: 'kinetic',
    zoneAffinity: ['bow'],
    stats: { fireRate: 22 },
    adjacency: [{ neighborType: 'cap', stats: {}, cooldownMult: 0.85 }],
    cost: 180,
    icon: '=',
  },
  'missile-pod': {
    id: 'missile-pod',
    name: 'Missile Pod',
    type: 'weapon',
    damageType: 'missile',
    zoneAffinity: ['bow'],
    stats: { fireRate: 10 },
    adjacency: [{ neighborType: 'cargo', stats: {}, cooldownMult: 0.85 }],
    cost: 150,
    icon: '^',
  },

  // ── Defenses ─────────────────────────────────────────────────────────────
  'shield-projector': {
    id: 'shield-projector',
    name: 'Shield Projector',
    type: 'shield',
    defenseType: 'shield',
    zoneAffinity: ['core'],
    stats: { shieldMax: 60, shieldRegen: 1/3 },
    cost: 130,
    icon: 'U',
  },
  'armor-plate': {
    id: 'armor-plate',
    name: 'Armor Plate',
    type: 'armor',
    defenseType: 'armor',
    zoneAffinity: ['core'],
    stats: { hull: 40 },
    cost: 100,
    icon: '#',
  },
  'point-defense': {
    id: 'point-defense',
    name: 'Point-Defense',
    type: 'pointdef',
    defenseType: 'pointdef',
    zoneAffinity: ['bow', 'core'],
    stats: {},
    cost: 110,
    icon: '*',
  },

  // ── Power ─────────────────────────────────────────────────────────────────
  'reactor': {
    id: 'reactor',
    name: 'Reactor',
    type: 'gen',
    zoneAffinity: ['core'],
    stats: { energyPerTick: 8, energyMax: 40 },
    cost: 140,
    icon: 'E',
  },
  'capacitor': {
    id: 'capacitor',
    name: 'Capacitor',
    type: 'cap',
    zoneAffinity: ['core'],
    stats: { energyPerTick: 4, energyMax: 20 },
    cost: 90,
    icon: 'C',
  },

  // ── Vaesh Exclusive (VAESH SYNOD only) ───────────────────────────────────
  'advanced-reactor': {
    id: 'advanced-reactor',
    name: 'Advanced Reactor',
    type: 'gen',
    zoneAffinity: ['core'],
    stats: { energyPerTick: 14, energyMax: 50 },
    cost: 220,
    icon: 'Ē',
    factionExclusive: 'VAESH',
  },
  'advanced-capacitor': {
    id: 'advanced-capacitor',
    name: 'Advanced Capacitor',
    type: 'cap',
    zoneAffinity: ['core'],
    stats: { energyPerTick: 6, energyMax: 60 },
    cost: 200,
    icon: 'Ć',
    factionExclusive: 'VAESH',
  },

  // ── Mobility & Utility ────────────────────────────────────────────────────
  'ion-engine': {
    id: 'ion-engine',
    name: 'Ion Engine',
    type: 'engine',
    zoneAffinity: ['stern'],
    stats: { evasion: 0.1, range: 1 },
    cost: 120,
    icon: '>',
  },
  'fuel-tank': {
    id: 'fuel-tank',
    name: 'Fuel Tank',
    type: 'util',
    zoneAffinity: ['stern'],
    stats: { range: 2 },
    cost: 80,
    icon: 'O',
  },
  'cargo-bay': {
    id: 'cargo-bay',
    name: 'Cargo Bay',
    type: 'cargo',
    zoneAffinity: ['bow', 'core', 'stern'],
    stats: { cargo: 30 },
    cost: 70,
    icon: 'B',
  },
};

export const PART_IDS = Object.keys(PARTS);
