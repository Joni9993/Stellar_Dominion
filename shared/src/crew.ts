import type { CrewId } from './types';

export type CrewData = {
  id: CrewId;
  name: string;
  role: string;
  bonus: string;
  cost: number;
  icon: string;
};

export const CREW: Record<CrewId, CrewData> = {
  gunner: {
    id: 'gunner',
    name: 'Gunner',
    role: 'WEAPONS',
    bonus: '+15% accuracy on all weapons',
    cost: 120,
    icon: 'G',
  },
  engineer: {
    id: 'engineer',
    name: 'Engineer',
    role: 'ENERGY',
    bonus: '+3 energy per tick in combat',
    cost: 100,
    icon: 'E',
  },
  smuggler: {
    id: 'smuggler',
    name: 'Smuggler',
    role: 'MOBILITY',
    bonus: '-3 fuel per jump',
    cost: 90,
    icon: 'S',
  },
  trader: {
    id: 'trader',
    name: 'Trader',
    role: 'TRADE',
    bonus: '+20% sell price on all goods',
    cost: 110,
    icon: 'T',
  },
  'demolitions-expert': {
    id: 'demolitions-expert',
    name: 'Demolitions Expert',
    role: 'COMBAT',
    bonus: 'Missile Pod damage ×1.5 in combat',
    cost: 130,
    icon: 'D',
  },
};

export const CREW_IDS: CrewId[] = ['gunner', 'engineer', 'smuggler', 'trader', 'demolitions-expert'];
