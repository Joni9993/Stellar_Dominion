// ── Primitives ────────────────────────────────────────────────────────────────

export type FactionId = 'VOLKESH' | 'KORTHAAR' | 'IDRYN' | 'NYXARI' | 'RASK' | 'VAESH';
export type GoodId    = 'ore' | 'data' | 'tech' | 'bio' | 'fuel_cells';
export type PartType  = 'weapon' | 'shield' | 'armor' | 'pointdef' | 'gen' | 'cap' | 'engine' | 'util' | 'artifact';
export type DamageType  = 'laser' | 'kinetic' | 'missile';
export type DefenseType = 'shield' | 'armor' | 'pointdef';
export type Zone         = 'bow' | 'core' | 'stern';
export type PlayerStatus = 'active' | 'crippled';
export type TurnPhase    = 'move' | 'action';
export type ArtifactTrigger = 'cooldown' | 'hpThreshold' | 'combatStart' | 'onHit';
export type CrewId = 'gunner' | 'engineer' | 'smuggler' | 'trader' | 'demolitions-expert';
export type GameView = 'map' | 'yard' | 'fight';

// ── Map ───────────────────────────────────────────────────────────────────────

export type Pos = { x: number; y: number };

export type MarketEntry = {
  good: GoodId;
  mode: 'buy_only' | 'sell_only';
  buy: number;   // price player pays (only meaningful for buy_only)
  sell: number;  // price station pays (only meaningful for sell_only)
  stock: number; // only meaningful for buy_only
};

export type System = {
  id: number;
  name: string;
  pos: Pos;
  region: number;
  hasStation: boolean;
  market: MarketEntry[];
  fuelPrice: number;
  fuelStock: number;
  stationModules: string[]; // module IDs offered for sale (unlimited stock)
  stationCrew: CrewId[];    // crew members available for hire at this station
};

export type Galaxy = {
  systems: System[];
  lanes: [number, number][];
};

// Static template — only used by galaxy generator, not in runtime state
export type SystemTemplate = {
  id: number;
  name: string;
  pos: Pos;
  region: number;
  hasStation: boolean;
  isHome: boolean;
};

// ── Ship ──────────────────────────────────────────────────────────────────────

export type Stats = {
  hull: number;
  shieldMax: number;
  shieldRegen: number;
  energyPerTick: number;
  energyMax: number;
  evasion: number;
  initiative: number;
  range: number;
  cargo: number;
  fireRate: number; // display score: higher = more offensive output
};

export type AdjBonus = {
  neighborType: PartType;
  stats: Partial<Stats>;
  cooldownMult?: number;
};

export type Part = {
  id: string;
  name: string;
  type: PartType;
  damageType?: DamageType;
  defenseType?: DefenseType;
  zoneAffinity: Zone[];
  stats: Partial<Stats>;
  adjacency?: AdjBonus[];
  cost: number;
  icon: string;
  factionExclusive?: FactionId; // only this faction can buy/use this part
};

// Faction passives — reserved for future use, currently all factions are equal
export type FactionPassive = Record<string, never>;

export type ShipBuild = {
  // 9 slots, index 0-2 = BOW, 3-5 = CORE, 6-8 = STERN. Value = Part id or null.
  grid: (string | null)[];
};

// ── Artifacts ─────────────────────────────────────────────────────────────────

export type CombatEffect =
  | { type: 'shieldNull';       duration: number }
  | { type: 'shieldRegenNull';  duration: number; cooldown: number }
  | { type: 'evadeVolley';      chance: number }
  | { type: 'evadeWindow';      chance: number; windowDuration: number; cooldown: number }
  | { type: 'bonusHullDmg';     multiplier: number }
  | { type: 'hullRegen';        perTick: number }
  | { type: 'firerateBoost';    multiplier: number; duration: number }
  | { type: 'lifesteal';        fraction: number }
  | { type: 'weaponDisable';    hpThreshold: number; selfTrigger?: boolean; duration?: number; oneTime?: boolean }
  | { type: 'shieldIgnore';     shots: number }
  | { type: 'shieldWave';       cooldown: number }
  | { type: 'rageMode';         hpThreshold: number; firerateBonus: number }
  | { type: 'allArtifactBoost'; multiplier: number }
  | { type: 'firstStrike';      evasionBonus: number };

export type Artifact = {
  id: string;
  name: string;
  source: 'faction' | 'rumor';
  factionId?: FactionId;
  trigger: ArtifactTrigger;
  effect: CombatEffect;
  description: string;
};

// ── Match ─────────────────────────────────────────────────────────────────────

export type Rumor = {
  systemId: number;
  artifactId: string;
  price: number;
  active: boolean;
};

export type Player = {
  id: string;
  name: string;
  factionId: FactionId;
  color: string;
  systemId: number;
  status: PlayerStatus;
  credits: number;
  fuel: number;
  maxFuel: number;
  cargo: Partial<Record<GoodId, number>>;
  build: ShipBuild;
  crew: (CrewId | null)[];
  artifacts: string[]; // artifact ids
  ownedModules: string[]; // module part IDs in inventory (not in grid); duplicates allowed
};

// ── Boarding loot ─────────────────────────────────────────────────────────────

export type BoardingLoot =
  | { type: 'artifact'; artifactId: string }
  | { type: 'module';   moduleId: string }
  | { type: 'credits';  amount: number };

// ── Combat ────────────────────────────────────────────────────────────────────

export type CombatSide = 'A' | 'B';

export type CombatEventType =
  | 'weapon_fire'    // weapon charged and shot
  | 'hit'            // projectile landed (with damage breakdown)
  | 'miss'           // projectile missed (evasion)
  | 'intercept'      // point-defense destroyed incoming missile
  | 'phase_dodge'    // phase drive evaded entire volley
  | 'artifact_pulse' // artifact ability activated (gilded aegis, null field, etc.)
  | 'weapon_disable' // boarding hook disabled a weapon
  | 'regen';         // significant heal/shield event

export type CombatEvent = {
  tick: number;
  side: CombatSide;
  type: CombatEventType;
  slotIndex: number;      // which slot (0–8) triggered this
  damageType?: DamageType;
  shieldDmg?: number;
  hullDmg?: number;
  healAmt?: number;
  callout?: string;       // RPS callout banner text
  artifactId?: string;
  effectDesc?: string;
  // post-event state snapshot for playback bar updates
  hullA: number;
  hullB: number;
  shieldA: number;
  shieldB: number;
  energyA: number;
  energyB: number;
};

export type CombatResult = {
  winner: CombatSide | 'draw';
  timeline: CombatEvent[];
  buildA: ShipBuild;
  buildB: ShipBuild;
  factionA: string;
  factionB: string;
  maxHullA: number;
  maxHullB: number;
  maxShieldA: number;
  maxShieldB: number;
  maxEnergyA: number;
  maxEnergyB: number;
};

export type MatchState = {
  galaxy: Galaxy;
  players: Player[];
  cycle: number;
  maxCycles: number;
  rumor: Rumor;
  rumorPool: string[];
  rumorsClaimed: number; // total artifacts claimed from rumor pool (drives price escalation)
  turnOrder: string[];
  activePlayerId: string;
  phase: TurnPhase;
  winThreshold: number;
  winnerId?: string;
};
