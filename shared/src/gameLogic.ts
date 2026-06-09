import type { BoardingLoot, CrewId, FactionId, Galaxy, GoodId, MatchState, Player } from './types';
import { FACTION_HOME_SYSTEM, generateGalaxy } from './galaxy';
import { mulberry32, seededShuffle } from './rng';
import { FACTIONS, FACTION_STARTER_BUILDS } from './factions';
import { RUMOR_ARTIFACT_IDS } from './artifacts';
import { PARTS } from './parts';

function hasCrew(player: Player, crewId: CrewId): boolean {
  return player.crew.includes(crewId);
}

// ── Map helpers ───────────────────────────────────────────────────────────────

export function getAdjacentSystems(galaxy: Galaxy, systemId: number): number[] {
  return galaxy.lanes
    .filter(([a, b]) => a === systemId || b === systemId)
    .map(([a, b]) => (a === systemId ? b : a));
}

export function getJumpCost(galaxy: Galaxy, fromId: number, toId: number): number {
  const a = galaxy.systems[fromId];
  const b = galaxy.systems[toId];
  const dx = a.pos.x - b.pos.x;
  const dy = a.pos.y - b.pos.y;
  return Math.max(8, Math.round(Math.sqrt(dx * dx + dy * dy) / 6));
}

export function getCargoTotal(player: Player): number {
  return Object.values(player.cargo).reduce((s, q) => s + (q ?? 0), 0);
}

// ── Result type ───────────────────────────────────────────────────────────────

export type ActionResult = { ok: true } | { ok: false; reason: string };

// ── Jump ─────────────────────────────────────────────────────────────────────

export function canJump(
  state: MatchState,
  playerId: string,
  targetId: number,
  jumpsUsed: number,
  maxJumps: number,
): ActionResult {
  if (jumpsUsed >= maxJumps) return { ok: false, reason: 'No jumps remaining this turn' };
  const player = state.players.find((p) => p.id === playerId);
  if (!player) return { ok: false, reason: 'Player not found' };
  const adj = getAdjacentSystems(state.galaxy, player.systemId);
  if (!adj.includes(targetId)) return { ok: false, reason: 'Not an adjacent system' };
  const cost = getEffectiveJumpCost(player, state.galaxy, targetId);
  if (player.fuel < cost) return { ok: false, reason: `Not enough fuel (need ${cost}⛽)` };
  return { ok: true };
}

export function getEffectiveJumpCost(player: Player, galaxy: Galaxy, targetId: number): number {
  const baseCost = getJumpCost(galaxy, player.systemId, targetId);
  const crewDiscount = hasCrew(player, 'smuggler') ? 3 : 0;
  return Math.max(1, baseCost - crewDiscount);
}

export function doJump(state: MatchState, playerId: string, targetId: number): MatchState {
  const player = state.players.find((p) => p.id === playerId)!;
  const cost = getEffectiveJumpCost(player, state.galaxy, targetId);
  return {
    ...state,
    players: state.players.map((p) =>
      p.id === playerId ? { ...p, systemId: targetId, fuel: p.fuel - cost } : p,
    ),
  };
}

// ── Trade ─────────────────────────────────────────────────────────────────────

export function canBuyGood(
  state: MatchState,
  playerId: string,
  good: GoodId,
  qty: number,
  maxCargo: number,
): ActionResult {
  const player = state.players.find((p) => p.id === playerId)!;
  const sys = state.galaxy.systems[player.systemId];
  if (!sys.hasStation) return { ok: false, reason: 'No station here' };
  const entry = sys.market.find((m) => m.good === good);
  if (!entry) return { ok: false, reason: 'Good not available here' };
  if (entry.mode === 'sell_only') return { ok: false, reason: 'Station does not sell this good' };
  if (entry.stock < qty) return { ok: false, reason: `Only ${entry.stock} in stock` };
  const cost = entry.buy * qty;
  if (player.credits < cost) return { ok: false, reason: `Need ${cost}◈` };
  if (getCargoTotal(player) + qty > maxCargo)
    return { ok: false, reason: 'Not enough cargo space' };
  return { ok: true };
}

export function doBuyGood(
  state: MatchState,
  playerId: string,
  good: GoodId,
  qty: number,
): MatchState {
  const player = state.players.find((p) => p.id === playerId)!;
  const sys = state.galaxy.systems[player.systemId];
  const entry = sys.market.find((m) => m.good === good)!;
  const cost = entry.buy * qty;
  return {
    ...state,
    players: state.players.map((p) =>
      p.id === playerId
        ? { ...p, credits: p.credits - cost, cargo: { ...p.cargo, [good]: (p.cargo[good] ?? 0) + qty } }
        : p,
    ),
    galaxy: {
      ...state.galaxy,
      systems: state.galaxy.systems.map((s) =>
        s.id === player.systemId
          ? { ...s, market: s.market.map((m) => (m.good === good ? { ...m, stock: m.stock - qty } : m)) }
          : s,
      ),
    },
  };
}

export function canSellGood(
  state: MatchState,
  playerId: string,
  good: GoodId,
  qty: number,
): ActionResult {
  const player = state.players.find((p) => p.id === playerId)!;
  const sys = state.galaxy.systems[player.systemId];
  if (!sys.hasStation) return { ok: false, reason: 'No station here' };
  const entry = sys.market.find((m) => m.good === good);
  if (!entry) return { ok: false, reason: 'No buyer for this good here' };
  if (entry.mode === 'buy_only') return { ok: false, reason: 'Station does not buy this good' };
  const have = player.cargo[good] ?? 0;
  if (have < qty) return { ok: false, reason: `Only have ${have} units` };
  return { ok: true };
}

export function doSellGood(
  state: MatchState,
  playerId: string,
  good: GoodId,
  qty: number,
): MatchState {
  const player = state.players.find((p) => p.id === playerId)!;
  const sys = state.galaxy.systems[player.systemId];
  const entry = sys.market.find((m) => m.good === good)!;
  const traderMult = hasCrew(player, 'trader') ? 1.20 : 1.0;
  const revenue = Math.round(entry.sell * qty * traderMult);
  return {
    ...state,
    players: state.players.map((p) =>
      p.id === playerId
        ? {
            ...p,
            credits: p.credits + revenue,
            cargo: { ...p.cargo, [good]: (p.cargo[good] ?? 0) - qty },
          }
        : p,
    ),
    // sell_only goods have no stock to track; only update stock for buy_only entries
    galaxy: state.galaxy,
  };
}

// ── Fuel ──────────────────────────────────────────────────────────────────────

export function canRefuel(
  state: MatchState,
  playerId: string,
  amount: number,
): ActionResult {
  const player = state.players.find((p) => p.id === playerId)!;
  const sys = state.galaxy.systems[player.systemId];
  if (sys.fuelStock < amount) return { ok: false, reason: `Only ${sys.fuelStock}⛽ available` };
  const cost = sys.fuelPrice * amount;
  if (player.credits < cost) return { ok: false, reason: `Need ${cost}◈` };
  if (player.fuel + amount > player.maxFuel)
    return { ok: false, reason: 'Tank would overflow' };
  return { ok: true };
}

export function doRefuel(
  state: MatchState,
  playerId: string,
  amount: number,
): MatchState {
  const player = state.players.find((p) => p.id === playerId)!;
  const sys = state.galaxy.systems[player.systemId];
  const cost = sys.fuelPrice * amount;
  return {
    ...state,
    players: state.players.map((p) =>
      p.id === playerId ? { ...p, credits: p.credits - cost, fuel: p.fuel + amount } : p,
    ),
    galaxy: {
      ...state.galaxy,
      systems: state.galaxy.systems.map((s) =>
        s.id === player.systemId ? { ...s, fuelStock: s.fuelStock - amount } : s,
      ),
    },
  };
}

// ── Crew ──────────────────────────────────────────────────────────────────────

export function canHireCrew(
  state: MatchState,
  playerId: string,
  crewCost: number,
): ActionResult {
  const player = state.players.find((p) => p.id === playerId)!;
  const sys = state.galaxy.systems[player.systemId];
  if (!sys.hasStation) return { ok: false, reason: 'No station here' };
  if (player.credits < crewCost) return { ok: false, reason: `Need ${crewCost}◈` };
  return { ok: true };
}

export function doHireCrew(
  state: MatchState,
  playerId: string,
  slot: number,
  crewId: CrewId | null,
  cost: number,
): MatchState {
  return {
    ...state,
    players: state.players.map((p) => {
      if (p.id !== playerId) return p;
      const crew = [...p.crew];
      crew[slot] = crewId;
      return { ...p, crew, credits: p.credits - cost };
    }),
  };
}

// ── Build ─────────────────────────────────────────────────────────────────────

export function doChangeBuildSlot(
  state: MatchState,
  playerId: string,
  slotIndex: number,
  partId: string | null,
  fromSlot?: number, // when set: within-grid move (swap), no inventory change
): MatchState {
  return {
    ...state,
    players: state.players.map((p) => {
      if (p.id !== playerId) return p;
      const grid = [...p.build.grid];
      const owned = [...(p.ownedModules ?? [])];
      const displaced = grid[slotIndex];

      if (fromSlot !== undefined) {
        // Within-grid swap: just exchange slots, no inventory touch
        grid[fromSlot] = displaced;
        grid[slotIndex] = partId;
      } else if (partId !== null) {
        // From inventory: remove one copy from owned, displace current occupant back to owned
        const idx = owned.indexOf(partId);
        if (idx !== -1) owned.splice(idx, 1);
        // Only push displaced to owned if it's a module (not an artifact)
        if (displaced !== null && PARTS[displaced]) owned.push(displaced);
        grid[slotIndex] = partId;
      } else {
        // Remove slot to inventory (null = clear)
        if (displaced !== null && PARTS[displaced]) owned.push(displaced);
        grid[slotIndex] = null;
      }

      return { ...p, build: { grid }, ownedModules: owned };
    }),
  };
}

// ── Module shop ───────────────────────────────────────────────────────────────

export function canBuyModule(
  state: MatchState,
  playerId: string,
  partId: string,
): ActionResult {
  const player = state.players.find((p) => p.id === playerId)!;
  const sys = state.galaxy.systems[player.systemId];
  if (!sys.hasStation) return { ok: false, reason: 'No station here' };
  if (!sys.stationModules.includes(partId)) return { ok: false, reason: 'Module not sold here' };
  const part = PARTS[partId];
  if (!part) return { ok: false, reason: 'Unknown module' };
  if (part.factionExclusive && part.factionExclusive !== player.factionId) {
    return { ok: false, reason: 'Exclusive to another faction' };
  }
  if (player.credits < part.cost) return { ok: false, reason: `Need ${part.cost}◈` };
  return { ok: true };
}

export function doBuyModule(
  state: MatchState,
  playerId: string,
  partId: string,
): MatchState {
  const part = PARTS[partId];
  return {
    ...state,
    players: state.players.map((p) =>
      p.id !== playerId
        ? p
        : { ...p, credits: p.credits - part.cost, ownedModules: [...(p.ownedModules ?? []), partId] },
    ),
  };
}

export function canSellModule(
  state: MatchState,
  playerId: string,
  partId: string,
): ActionResult {
  const player = state.players.find((p) => p.id === playerId)!;
  const sys = state.galaxy.systems[player.systemId];
  if (!sys.hasStation) return { ok: false, reason: 'No station here' };
  if (!(player.ownedModules ?? []).includes(partId)) {
    return { ok: false, reason: 'Module not in inventory' };
  }
  return { ok: true };
}

export function doSellModule(
  state: MatchState,
  playerId: string,
  partId: string,
): MatchState {
  const part = PARTS[partId];
  const sellPrice = Math.floor(part.cost * 0.5);
  return {
    ...state,
    players: state.players.map((p) => {
      if (p.id !== playerId) return p;
      const owned = [...(p.ownedModules ?? [])];
      const idx = owned.indexOf(partId);
      if (idx !== -1) owned.splice(idx, 1);
      return { ...p, credits: p.credits + sellPrice, ownedModules: owned };
    }),
  };
}

// ── Turn ──────────────────────────────────────────────────────────────────────

export function doEndTurn(state: MatchState): MatchState {
  const currentIndex = state.turnOrder.indexOf(state.activePlayerId);
  const nextIndex = (currentIndex + 1) % state.turnOrder.length;
  const nextPlayerId = state.turnOrder[nextIndex];
  const isEndOfCycle = nextIndex === 0;

  const newCycle = isEndOfCycle ? Math.min(state.cycle + 1, state.maxCycles) : state.cycle;

  let next: MatchState = {
    ...state,
    activePlayerId: nextPlayerId,
    cycle: newCycle,
    phase: 'move',
    players: isEndOfCycle
      ? state.players.map((p) => ({
          ...p,
          credits: p.credits + 50,
          status: 'active' as const,
        }))
      : state.players,
    galaxy: isEndOfCycle
      ? {
          ...state.galaxy,
          systems: state.galaxy.systems.map((s) =>
            !s.hasStation ? s : {
              ...s,
              fuelStock: s.fuelStock + 5,
              // only primary good (index 0 = regional specialty) gets restocked
              market: s.market.map((m, i) => i === 0 ? { ...m, stock: m.stock + 3 } : m),
            }
          ),
        }
      : state.galaxy,
  };

  if (isEndOfCycle) {
    if (!next.rumor.active && next.rumorPool.length > 0) {
      next = doSpawnNextRumor(next);
    }
    if (next.cycle >= next.maxCycles && !next.winnerId) {
      const winner = checkWin(next);
      if (winner) next = { ...next, winnerId: winner };
    }
  }

  return next;
}

// ── Artifact / Rumor ──────────────────────────────────────────────────────────

export function canClaimArtifact(state: MatchState, playerId: string): ActionResult {
  const player = state.players.find((p) => p.id === playerId)!;
  const { rumor } = state;
  if (!rumor.active) return { ok: false, reason: 'No active rumor' };
  if (player.systemId !== rumor.systemId) return { ok: false, reason: 'Not at rumor location' };
  const effectivePrice = getEffectiveArtifactPrice(state, playerId);
  if (player.credits < effectivePrice) return { ok: false, reason: `Need ${effectivePrice}◈ to claim` };
  return { ok: true };
}

export function getEffectiveArtifactPrice(state: MatchState, playerId: string): number {
  const player = state.players.find((p) => p.id === playerId)!;
  return state.rumor.price;
}

export function doClaimArtifact(state: MatchState, playerId: string): MatchState {
  const player = state.players.find((p) => p.id === playerId)!;
  const { rumor } = state;
  const effectivePrice = getEffectiveArtifactPrice(state, playerId);

  // Place artifact in first empty grid slot (if available)
  const grid = [...player.build.grid];
  const emptySlot = grid.findIndex((s) => s === null);
  if (emptySlot !== -1) grid[emptySlot] = rumor.artifactId;

  let next: MatchState = {
    ...state,
    rumor: { ...state.rumor, active: false },
    rumorsClaimed: state.rumorsClaimed + 1,
    players: state.players.map((p) =>
      p.id !== playerId
        ? p
        : {
            ...p,
            credits: p.credits - effectivePrice,
            artifacts: [...p.artifacts, rumor.artifactId],
            build: emptySlot !== -1 ? { grid } : p.build,
          },
    ),
  };

  if (next.rumorPool.length > 0) {
    next = doSpawnNextRumor(next);
  }

  const winner = checkWin(next);
  if (winner) next = { ...next, winnerId: winner };
  return next;
}

export function doSpawnNextRumor(state: MatchState): MatchState {
  if (state.rumorPool.length === 0) return state;
  const [nextArtifactId, ...remaining] = state.rumorPool;

  // Find a station system that no player currently occupies, preferring a different region
  const playerRegions = new Set(state.players.map((p) => state.galaxy.systems[p.systemId].region));
  const playerSystems = new Set(state.players.map((p) => p.systemId));

  const candidates = state.galaxy.systems.filter(
    (s) => s.hasStation && !playerSystems.has(s.id) && !playerRegions.has(s.region),
  );
  const fallback = state.galaxy.systems.filter((s) => s.hasStation && !playerSystems.has(s.id));
  const pool = candidates.length > 0 ? candidates : fallback;

  // Deterministic pick: cycle % pool.length
  const idx = state.cycle % pool.length;
  const systemId = pool[idx]?.id ?? 17; // fallback to Void Crossing

  const price = 300 + 50 * state.rumorsClaimed;

  return {
    ...state,
    rumorPool: remaining,
    rumor: { systemId, artifactId: nextArtifactId, price, active: true },
  };
}

// ── Win check ─────────────────────────────────────────────────────────────────

export function checkWin(state: MatchState): string | null {
  // Instant win: first to reach winThreshold
  for (const p of state.players) {
    if (p.artifacts.length >= state.winThreshold) return p.id;
  }
  // Cycle-limit win: most artifacts at end
  if (state.cycle >= state.maxCycles) {
    const sorted = [...state.players].sort((a, b) => b.artifacts.length - a.artifacts.length);
    if (sorted[0].artifacts.length > (sorted[1]?.artifacts.length ?? -1)) return sorted[0].id;
  }
  return null;
}

// ── Combat loot ───────────────────────────────────────────────────────────────

/**
 * Roll the boarding roulette: 15% artifact, 35% module, 50% credits (15% of loser's credits).
 * Falls back to credits if the rolled category is empty.
 * rng must return values in [0, 1).
 */
export function rollBoardingLoot(loser: Player, rng: () => number): BoardingLoot {
  const roll = rng() * 100;

  if (roll < 15) {
    if (loser.artifacts.length > 0) {
      const idx = Math.floor(rng() * loser.artifacts.length);
      return { type: 'artifact', artifactId: loser.artifacts[idx] };
    }
  } else if (roll < 50) {
    const pool: string[] = [];
    for (const s of loser.build.grid) {
      if (s !== null && PARTS[s] !== undefined) pool.push(s);
    }
    for (const m of loser.ownedModules ?? []) pool.push(m);
    if (pool.length > 0) {
      const idx = Math.floor(rng() * pool.length);
      return { type: 'module', moduleId: pool[idx] };
    }
  }

  const amount = Math.max(1, Math.floor(loser.credits * 0.15));
  return { type: 'credits', amount };
}

/** Apply boarding loot to match state after a combat. Cripples the loser and checks win. */
export function doApplyBoardingLoot(
  state: MatchState,
  winnerId: string,
  loserId: string,
  loot: BoardingLoot,
): MatchState {
  let next: MatchState = {
    ...state,
    players: state.players.map((p) => {
      if (p.id === winnerId) return _applyLootToWinner(p, loot);
      if (p.id === loserId)  return _removeLootFromLoser(p, loot);
      return p;
    }),
  };
  next = doCripple(next, loserId);
  const winner = checkWin(next);
  if (winner) next = { ...next, winnerId: winner };
  return next;
}

function _applyLootToWinner(winner: Player, loot: BoardingLoot): Player {
  if (loot.type === 'artifact') {
    const grid = [...winner.build.grid];
    const emptySlot = grid.findIndex((s) => s === null);
    if (emptySlot !== -1) grid[emptySlot] = loot.artifactId;
    return {
      ...winner,
      artifacts: [...winner.artifacts, loot.artifactId],
      build: emptySlot !== -1 ? { grid } : winner.build,
    };
  }
  if (loot.type === 'module') {
    return { ...winner, ownedModules: [...(winner.ownedModules ?? []), loot.moduleId] };
  }
  return { ...winner, credits: winner.credits + loot.amount };
}

function _removeLootFromLoser(loser: Player, loot: BoardingLoot): Player {
  if (loot.type === 'artifact') {
    const idx = loser.artifacts.indexOf(loot.artifactId);
    const artifacts = loser.artifacts.filter((_, i) => i !== idx);
    const grid = loser.build.grid.map((s) => (s === loot.artifactId ? null : s));
    return { ...loser, artifacts, build: { grid } };
  }
  if (loot.type === 'module') {
    let removedFromGrid = false;
    const grid = loser.build.grid.map((s) => {
      if (!removedFromGrid && s === loot.moduleId) { removedFromGrid = true; return null; }
      return s;
    });
    if (removedFromGrid) return { ...loser, build: { grid } };
    const owned = [...(loser.ownedModules ?? [])];
    const oidx = owned.indexOf(loot.moduleId);
    if (oidx !== -1) owned.splice(oidx, 1);
    return { ...loser, ownedModules: owned };
  }
  return { ...loser, credits: Math.max(0, loser.credits - loot.amount) };
}

/** Legacy: apply artifact loot directly (used by solo/local mode). */
export function doApplyLoot(
  state: MatchState,
  winnerId: string,
  loserId: string,
  artifactsToTransfer: string[],
): MatchState {
  let next: MatchState = {
    ...state,
    players: state.players.map((p) => {
      if (p.id === winnerId && artifactsToTransfer.length > 0) {
        const grid = [...p.build.grid];
        for (const artId of artifactsToTransfer) {
          const emptySlot = grid.findIndex((s) => s === null);
          if (emptySlot !== -1) grid[emptySlot] = artId;
        }
        return { ...p, artifacts: [...p.artifacts, ...artifactsToTransfer], build: { grid } };
      }
      if (p.id === loserId && artifactsToTransfer.length > 0) {
        const remaining = p.artifacts.filter((a) => !artifactsToTransfer.includes(a));
        const grid = p.build.grid.map((s) => (s && artifactsToTransfer.includes(s) ? null : s));
        return { ...p, artifacts: remaining, build: { grid } };
      }
      return p;
    }),
  };
  next = doCripple(next, loserId);
  const winner = checkWin(next);
  if (winner) next = { ...next, winnerId: winner };
  return next;
}

export function doCripple(state: MatchState, playerId: string): MatchState {
  const player = state.players.find((p) => p.id === playerId)!;
  const homeSystemId = FACTION_HOME_SYSTEM[player.factionId] ?? player.systemId;
  return {
    ...state,
    players: state.players.map((p) =>
      p.id !== playerId ? p : { ...p, systemId: homeSystemId },
    ),
  };
}

// ── Emergency Signal ──────────────────────────────────────────────────────────

export const EMERGENCY_FUEL = 40;

export function isStranded(state: MatchState, playerId: string): boolean {
  const player = state.players.find((p) => p.id === playerId);
  if (!player) return false;
  const neighbors = getAdjacentSystems(state.galaxy, player.systemId);
  return neighbors.every(
    (neighborId) => getEffectiveJumpCost(player, state.galaxy, neighborId) > player.fuel,
  );
}

export function canEmergencySignal(state: MatchState, playerId: string): ActionResult {
  const player = state.players.find((p) => p.id === playerId);
  if (!player) return { ok: false, reason: 'Player not found' };
  if (!isStranded(state, playerId)) return { ok: false, reason: 'You still have enough fuel to jump' };
  return { ok: true };
}

export function doEmergencySignal(state: MatchState, playerId: string): MatchState {
  const player = state.players.find((p) => p.id === playerId)!;
  const homeSystemId = FACTION_HOME_SYSTEM[player.factionId] ?? player.systemId;
  return {
    ...state,
    players: state.players.map((p) =>
      p.id !== playerId ? p : { ...p, systemId: homeSystemId, fuel: EMERGENCY_FUEL },
    ),
  };
}

// ── Match setup ───────────────────────────────────────────────────────────────

export type PlayerSetup = { id: string; name: string; factionId: FactionId };

export function createInitialMatchState(players: PlayerSetup[], seed: number): MatchState {
  const galaxy = generateGalaxy(seed);
  const rng = mulberry32(seed + 1);
  const rumorPool = seededShuffle([...RUMOR_ARTIFACT_IDS], rng);
  const firstRumor = rumorPool.shift()!;
  const winThreshold = players.length <= 2 ? 3 : players.length <= 4 ? 4 : 5;

  const gamePlayers: Player[] = players.map(({ id, name, factionId }) => {
    const faction = FACTIONS[factionId];
    return {
      id,
      name,
      factionId,
      color: faction.color,
      systemId: faction.homeSystemId,
      status: 'active',
      credits: 500,
      fuel: 60,
      maxFuel: 100,
      cargo: {},
      build: { grid: [...FACTION_STARTER_BUILDS[factionId].grid] },
      crew: [null, null],
      artifacts: [faction.startArtifactId],
      ownedModules: [], // starter modules are in the grid (equipped), not in inventory
    };
  });

  return {
    galaxy,
    players: gamePlayers,
    cycle: 1,
    maxCycles: 20,
    rumor: { systemId: 17, artifactId: firstRumor, price: 300, active: true },
    rumorPool,
    rumorsClaimed: 0,
    turnOrder: players.map((p) => p.id),
    activePlayerId: players[0].id,
    phase: 'move',
    winThreshold,
  };
}
