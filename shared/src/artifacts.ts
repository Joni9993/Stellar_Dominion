import type { Artifact } from './types';

export const ARTIFACTS: Record<string, Artifact> = {
  // ── Faction artifacts ─────────────────────────────────────────────────────
  'gilded-aegis': {
    id: 'gilded-aegis',
    name: 'Gilded Aegis',
    source: 'faction',
    factionId: 'VOLKESH',
    trigger: 'cooldown',
    effect: { type: 'shieldWave', cooldown: 300 },
    description: 'Every 6 seconds (300 ticks): restores up to 30 shield points. Works without a Shield Projector — the Aegis generates its own 30-point shield pool. With a Shield Projector equipped, restores toward your normal cap instead.',
  },
  'wrath-engine': {
    id: 'wrath-engine',
    name: 'Wrath Engine',
    source: 'faction',
    factionId: 'KORTHAAR',
    trigger: 'hpThreshold',
    effect: { type: 'rageMode', hpThreshold: 0.5, firerateBonus: 0.5 },
    description: 'When your hull drops below 50%, all weapon cooldowns are permanently reduced by 33% (fire rate +50%). Triggers once and stays active.',
  },
  'concord-prism': {
    id: 'concord-prism',
    name: 'Concord Prism',
    source: 'faction',
    factionId: 'IDRYN',
    trigger: 'combatStart',
    effect: { type: 'allArtifactBoost', multiplier: 1.25 },
    description: 'Passive: all other equipped artifacts deal +25% effectiveness (cooldowns shorter, durations longer, damage/heal higher).',
  },
  'far-sight': {
    id: 'far-sight',
    name: 'Far Sight',
    source: 'faction',
    factionId: 'NYXARI',
    trigger: 'combatStart',
    effect: { type: 'firstStrike', evasionBonus: 0.15 },
    description: 'Combat start: all your weapons fire at half their normal cooldown on the first shot (First Strike). Grants +15% evasion permanently.',
  },
  'weapon-jammer': {
    id: 'weapon-jammer',
    name: 'Weapon Jammer',
    source: 'faction',
    factionId: 'RASK',
    trigger: 'hpThreshold',
    effect: { type: 'weaponDisable', hpThreshold: 0.3, selfTrigger: true, duration: 200, oneTime: true },
    description: 'When your own hull drops below 30%, instantly disables one random enemy weapon for 4 seconds (200 ticks). Triggers once per combat.',
  },
  'overclock-matrix': {
    id: 'overclock-matrix',
    name: 'Overclock Matrix',
    source: 'faction',
    factionId: 'VAESH',
    trigger: 'combatStart',
    effect: { type: 'shieldIgnore', shots: 3 },
    description: 'Combat start: your first 3 weapon shots bypass enemy shields entirely, dealing full damage directly to hull. Does not affect missiles (they always bypass shields).',
  },

  // ── Neutral (Rumor pool) ──────────────────────────────────────────────────
  'null-field': {
    id: 'null-field',
    name: 'Null Field',
    source: 'rumor',
    trigger: 'cooldown',
    effect: { type: 'shieldRegenNull', duration: 100, cooldown: 400 },
    description: 'At combat start and every 8 seconds (400 ticks): blocks enemy shield regeneration for 2 seconds (100 ticks). Enemy shield HP is not wiped — only regen is stopped.',
  },
  'phase-drive': {
    id: 'phase-drive',
    name: 'Phase Drive',
    source: 'rumor',
    trigger: 'cooldown',
    effect: { type: 'evadeWindow', chance: 0.5, windowDuration: 50, cooldown: 300 },
    description: 'Every 6 seconds (300 ticks): opens a 1-second dodge window (50 ticks) during which each incoming attack has a 50% chance to be evaded entirely.',
  },
  'siege-battery': {
    id: 'siege-battery',
    name: 'Siege Battery',
    source: 'rumor',
    trigger: 'combatStart',
    effect: { type: 'bonusHullDmg', multiplier: 1.1 },
    description: 'Passive: all weapons deal +10% extra damage directly to hull. Shield damage is unaffected — the bonus only applies when damage reaches the enemy hull.',
  },
  'repair-swarm': {
    id: 'repair-swarm',
    name: 'Repair Swarm',
    source: 'rumor',
    trigger: 'combatStart',
    effect: { type: 'hullRegen', perTick: 0.5 },
    description: 'Passive: hull regenerates 0.2 HP per tick (1 HP every 5 ticks, ~10 HP per second).',
  },
  'chrono-capacitor': {
    id: 'chrono-capacitor',
    name: 'Chrono Capacitor',
    source: 'rumor',
    trigger: 'combatStart',
    effect: { type: 'firerateBoost', multiplier: 2.0, duration: 150 },
    description: 'Combat start: all weapon cooldowns are halved (fire rate ×2) for the first 3 seconds (150 ticks).',
  },
  'vampire-array': {
    id: 'vampire-array',
    name: 'Vampire Array',
    source: 'rumor',
    trigger: 'onHit',
    effect: { type: 'lifesteal', fraction: 0.15 },
    description: 'On each successful hit: restore 15% of the total damage dealt (shield + hull combined) as your own hull HP.',
  },
};

export const RUMOR_ARTIFACT_IDS = Object.values(ARTIFACTS)
  .filter((a) => a.source === 'rumor')
  .map((a) => a.id);
