#!/usr/bin/env tsx
/**
 * Stellar Dominion — Balance Simulation
 *
 * Runs N headless games per player count (2–6) with simple AI agents.
 * All agents use identical strategy so win-rate differences are faction-driven.
 *
 * Run:  pnpm simulate   (from /simulation)
 * Output: simulation-results.json  +  console summary
 */

import { writeFileSync } from 'fs';

import {
  type MatchState, type Player, type FactionId, type CrewId,
  FACTION_IDS, PARTS, ARTIFACTS, CREW, CREW_IDS,
  createInitialMatchState,
  doJump, doEndTurn, doClaimArtifact, doRefuel,
  doBuyModule, doHireCrew, doChangeBuildSlot,
  canClaimArtifact, canRefuel, canBuyModule, canHireCrew,
  doApplyBoardingLoot, rollBoardingLoot,
  getAdjacentSystems, getEffectiveJumpCost,
  runCombat, mulberry32, seededShuffle,
} from '@stellar-dominion/shared';

// ─────────────────────────────────────────────────────────────────────────────
// BFS utilities
// ─────────────────────────────────────────────────────────────────────────────

function bfsNextHop(state: MatchState, fromId: number, toId: number): number | null {
  if (fromId === toId) return null;
  const prev = new Map<number, number>();
  const queue: number[] = [fromId];
  prev.set(fromId, -1);
  while (queue.length > 0) {
    const cur = queue.shift()!;
    for (const n of getAdjacentSystems(state.galaxy, cur)) {
      if (!prev.has(n)) {
        prev.set(n, cur);
        if (n === toId) {
          // Reconstruct first hop
          let hop = toId;
          while (prev.get(hop) !== fromId) hop = prev.get(hop)!;
          return hop;
        }
        queue.push(n);
      }
    }
  }
  return null;
}

function findNearestStation(state: MatchState, fromId: number): number {
  if (state.galaxy.systems[fromId].hasStation) return fromId;
  const visited = new Set<number>([fromId]);
  const queue: number[] = [fromId];
  while (queue.length > 0) {
    const cur = queue.shift()!;
    for (const n of getAdjacentSystems(state.galaxy, cur)) {
      if (!visited.has(n)) {
        visited.add(n);
        if (state.galaxy.systems[n].hasStation) return n;
        queue.push(n);
      }
    }
  }
  return fromId;
}

// ─────────────────────────────────────────────────────────────────────────────
// Combat power estimate
// ─────────────────────────────────────────────────────────────────────────────

// Rough DPS proxy per weapon type (damage × accuracy / cooldown × 50 ticks/s)
const WEAPON_DPS: Record<string, number> = {
  'pulse-laser':  3  * 0.85 / 14 * 50,  // ~9.1
  'railgun':      8  * 0.72 / 22 * 50,  // ~13.1
  'missile-pod':  5  * 0.90 / 20 * 50,  // ~11.25
};
const DEFENSE_HP: Record<string, number> = {
  'shield-projector': 60,
  'armor-plate':      40,
  'point-defense':    20,
};
const POWER_BONUS: Record<string, number> = {
  'reactor': 3, 'capacitor': 2, 'advanced-reactor': 5, 'advanced-capacitor': 4,
  'ion-engine': 1, 'fuel-tank': 0, 'cargo-bay': 0,
};

function estimatePower(player: Player): number {
  let dps = 0;
  let hp  = 150; // base hull
  let gen = 0;

  for (const slot of player.build.grid) {
    if (!slot) continue;
    const w = WEAPON_DPS[slot];
    if (w !== undefined) { dps += w; continue; }
    const d = DEFENSE_HP[slot];
    if (d !== undefined) { hp += d; continue; }
    const p = POWER_BONUS[slot];
    if (p !== undefined) { gen += p; continue; }
    // artifact: flat bonus
    gen += 3;
  }
  // Combine: DPS × effective HP × generator bonus
  return dps * (hp / 150) + gen;
}

// ─────────────────────────────────────────────────────────────────────────────
// Module buy priority
// ─────────────────────────────────────────────────────────────────────────────

const MODULE_PRIORITY: Record<string, number> = {
  'railgun': 10, 'missile-pod': 9, 'pulse-laser': 8,
  'advanced-reactor': 9, 'advanced-capacitor': 8,
  'shield-projector': 7, 'armor-plate': 6,
  'reactor': 5, 'capacitor': 4,
  'point-defense': 3, 'ion-engine': 3, 'fuel-tank': 2, 'cargo-bay': 2,
};

// ─────────────────────────────────────────────────────────────────────────────
// Per-game tracking
// ─────────────────────────────────────────────────────────────────────────────

interface PerPlayerStats {
  faction: FactionId;
  fuelSpent: number;
  creditsAtEnd: number;
  fuelAtEnd: number;
  combats: number;
  combatWins: number;
  artifactsClaimed: number;
  modulesBought: string[];
  won: boolean;
  artifactsAtEnd: string[];
}

// ─────────────────────────────────────────────────────────────────────────────
// AI Turn — one full turn for the active player
// ─────────────────────────────────────────────────────────────────────────────

function aiTurn(
  state: MatchState,
  playerStats: Map<string, PerPlayerStats>,
  turnSeed: number,
): MatchState {
  if (state.winnerId) return state;

  const rng = mulberry32(turnSeed);
  const playerId = state.activePlayerId;
  let player = state.players.find(p => p.id === playerId)!;
  const pStats = playerStats.get(playerId)!;
  let cur = state;

  // ── 1. DECIDE MOVEMENT TARGET ──────────────────────────────────────────
  let targetSys: number;

  const fuelLow = player.fuel < 20;
  const rumorActive = cur.rumor.active;
  const canAffordRumor = player.credits >= cur.rumor.price;

  if (fuelLow) {
    targetSys = findNearestStation(cur, player.systemId);
  } else if (rumorActive) {
    targetSys = cur.rumor.systemId;
  } else {
    // No active rumor — drift toward center hub (Void Crossing = 17)
    targetSys = findNearestStation(cur, player.systemId);
  }

  // ── 2. JUMP (one per turn) ──────────────────────────────────────────────
  if (targetSys !== player.systemId) {
    const hop = bfsNextHop(cur, player.systemId, targetSys);
    if (hop !== null) {
      const cost = getEffectiveJumpCost(player, cur.galaxy, hop);
      if (player.fuel >= cost) {
        const fuelBefore = player.fuel;
        cur = doJump(cur, playerId, hop);
        player = cur.players.find(p => p.id === playerId)!;
        pStats.fuelSpent += fuelBefore - player.fuel;
      }
    }
  }

  // ── 3. COMBAT ───────────────────────────────────────────────────────────
  // Find active enemies at current system
  const enemies = cur.players.filter(p =>
    p.id !== playerId &&
    p.systemId === player.systemId &&
    p.status === 'active',
  );

  for (const enemy of enemies) {
    if (cur.winnerId) break;
    // Re-read player state (may have changed)
    player = cur.players.find(p => p.id === playerId)!;
    if (!player || player.status !== 'active') break;

    const myPower  = estimatePower(player);
    const ePower   = estimatePower(enemy);

    // Attack if we're at least 85% of enemy power
    if (myPower * 1.0 >= ePower * 0.85) {
      pStats.combats++;
      const result = runCombat(
        player.build, enemy.build,
        player.factionId, enemy.factionId,
        Math.floor(rng() * 0xFFFFFF),
        player.crew as (CrewId | null)[],
        enemy.crew as (CrewId | null)[],
      );

      const eStats = playerStats.get(enemy.id);
      if (eStats) eStats.combats++;

      if (result.winner === 'A') {
        pStats.combatWins++;
        const loot = rollBoardingLoot(enemy, rng);
        cur = doApplyBoardingLoot(cur, playerId, enemy.id, loot);
      } else if (result.winner === 'B') {
        if (eStats) eStats.combatWins++;
        const loot = rollBoardingLoot(player, rng);
        cur = doApplyBoardingLoot(cur, enemy.id, playerId, loot);
        // Active player got crippled → skip remaining actions
        if (cur.winnerId) return doEndTurn(cur);
        // Player teleported to home system
        return doEndTurn(cur);
      }
      // draw: both stay
    }
    if (cur.winnerId) break;
  }

  if (cur.winnerId) return doEndTurn(cur);

  // ── 4. STATION ACTIONS ─────────────────────────────────────────────────
  player = cur.players.find(p => p.id === playerId)!;
  if (!player) return doEndTurn(cur);

  const sys = cur.galaxy.systems[player.systemId];

  if (sys.hasStation) {
    // 4a. Claim artifact if here and affordable
    if (cur.rumor.active && cur.rumor.systemId === player.systemId) {
      const claimCheck = canClaimArtifact(cur, playerId);
      if (claimCheck.ok) {
        const hasEmptySlot = player.build.grid.some(s => s === null);
        if (hasEmptySlot) {
          pStats.artifactsClaimed++;
          cur = doClaimArtifact(cur, playerId);
          if (cur.winnerId) return doEndTurn(cur);
          player = cur.players.find(p => p.id === playerId)!;
        }
      }
    }

    // 4b. Refuel to max
    player = cur.players.find(p => p.id === playerId)!;
    const wantFuel = player.maxFuel - player.fuel;
    const canFuel  = Math.min(wantFuel, sys.fuelStock);
    if (canFuel > 0 && canRefuel(cur, playerId, canFuel).ok) {
      cur = doRefuel(cur, playerId, canFuel);
      player = cur.players.find(p => p.id === playerId)!;
    }

    // 4c. Buy best module if we have empty grid slots
    player = cur.players.find(p => p.id === playerId)!;
    const emptySlots = player.build.grid.filter(s => s === null).length;
    if (emptySlots > 0) {
      const buyable = sys.stationModules
        .filter(id => canBuyModule(cur, playerId, id).ok)
        .sort((a, b) => (MODULE_PRIORITY[b] ?? 0) - (MODULE_PRIORITY[a] ?? 0));

      if (buyable.length > 0) {
        const best = buyable[0];
        cur = doBuyModule(cur, playerId, best);
        player = cur.players.find(p => p.id === playerId)!;
        // Equip into first empty slot
        const slot = player.build.grid.findIndex(s => s === null);
        if (slot !== -1) {
          cur = doChangeBuildSlot(cur, playerId, slot, best);
          player = cur.players.find(p => p.id === playerId)!;
        }
        pStats.modulesBought.push(best);
      }
    }

    // 4d. Hire crew if both slots empty and we have credits
    player = cur.players.find(p => p.id === playerId)!;
    if (player.crew.some(c => c === null) && player.credits >= 130) {
      // Try to hire in priority order: gunner > engineer > demolitions-expert
      const wantCrew: CrewId[] = ['gunner', 'demolitions-expert', 'engineer'];
      for (const crewId of wantCrew) {
        const available = sys.stationCrew.includes(crewId);
        const notHired  = !player.crew.includes(crewId);
        const emptySlot = player.crew.findIndex(c => c === null);
        if (available && notHired && emptySlot !== -1) {
          const cost = CREW[crewId].cost;
          if (canHireCrew(cur, playerId, cost).ok) {
            cur = doHireCrew(cur, playerId, emptySlot, crewId, cost);
            player = cur.players.find(p => p.id === playerId)!;
            break; // one crew per turn
          }
        }
      }
    }
  }

  return doEndTurn(cur);
}

// ─────────────────────────────────────────────────────────────────────────────
// Single game simulation
// ─────────────────────────────────────────────────────────────────────────────

interface GameResult {
  cycles:              number;
  winnerFaction:       FactionId | null;
  factions:            FactionId[];
  playerResults:       PerPlayerStats[];
  draw:                boolean;
}

function simulateGame(factions: FactionId[], seed: number): GameResult {
  const players = factions.map((fId, i) => ({
    id:        `p${i}`,
    name:      `Bot${i}`,
    factionId: fId,
  }));

  let state = createInitialMatchState(players, seed);

  const playerStats = new Map<string, PerPlayerStats>();
  for (const p of state.players) {
    playerStats.set(p.id, {
      faction:          p.factionId,
      fuelSpent:        0,
      creditsAtEnd:     0,
      fuelAtEnd:        0,
      combats:          0,
      combatWins:       0,
      artifactsClaimed: 0,
      modulesBought:    [],
      won:              false,
      artifactsAtEnd:   [],
    });
  }

  let turn = 0;
  const MAX_TURNS = 2000; // safety guard

  while (!state.winnerId && state.cycle <= state.maxCycles && turn < MAX_TURNS) {
    const turnSeed = (seed ^ (turn * 0x9e3779b9)) >>> 0;
    state = aiTurn(state, playerStats, turnSeed);
    turn++;
  }

  // Finalize stats
  for (const p of state.players) {
    const s = playerStats.get(p.id)!;
    s.creditsAtEnd   = p.credits;
    s.fuelAtEnd      = p.fuel;
    s.artifactsAtEnd = [...p.artifacts];
    s.won            = p.id === state.winnerId;
  }

  const winner = state.players.find(p => p.id === state.winnerId);
  const isDraw = !winner && state.cycle >= state.maxCycles;

  return {
    cycles:        state.cycle,
    winnerFaction: winner?.factionId ?? null,
    factions,
    playerResults: [...playerStats.values()],
    draw:          isDraw,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Aggregate statistics
// ─────────────────────────────────────────────────────────────────────────────

interface FactionStat {
  games:            number;
  wins:             number;
  winRate:          number;
  avgFinalCredits:  number;
  avgFuelSpent:     number;
  avgCombatWinRate: number;
  avgArtifacts:     number;
}

interface PlayerCountResult {
  playerCount:       number;
  gamesRun:          number;
  draws:             number;
  avgCycles:         number;
  minCycles:         number;
  maxCycles:         number;
  cycleDist:         number[]; // index = cycle
  factionStats:      Record<FactionId, FactionStat>;
  modulePurchases:   Record<string, number>;
  moduleWinnerHad:   Record<string, number>; // how often winner had this module in grid
  artifactClaimFreq: Record<string, number>;
  artifactWinnerHad: Record<string, number>;
  economyAvg: {
    avgFinalCredits:  number;
    avgFuelAtEnd:     number;
    avgCombatWinRate: number;
  };
}

function aggregateResults(pcResults: GameResult[], pc: number): PlayerCountResult {
  const N = pcResults.length;
  const fStats: Record<string, {
    games: number; wins: number;
    totalCredits: number; totalFuel: number;
    totalCombats: number; totalCombatWins: number;
    totalArts: number;
  }> = {};

  for (const f of FACTION_IDS) {
    fStats[f] = { games: 0, wins: 0, totalCredits: 0, totalFuel: 0,
                  totalCombats: 0, totalCombatWins: 0, totalArts: 0 };
  }

  const modPurchases:  Record<string, number> = {};
  const modWinnerHad:  Record<string, number> = {};
  const artClaims:     Record<string, number> = {};
  const artWinnerHad:  Record<string, number> = {};
  const cycleDist = new Array(22).fill(0);
  let totalCycles = 0;
  let minCycles = Infinity;
  let maxCycles = 0;
  let draws = 0;

  for (const g of pcResults) {
    if (g.draw) draws++;
    totalCycles += g.cycles;
    minCycles = Math.min(minCycles, g.cycles);
    maxCycles = Math.max(maxCycles, g.cycles);
    cycleDist[Math.min(g.cycles, 21)]++;

    for (const ps of g.playerResults) {
      const fs = fStats[ps.faction];
      fs.games++;
      if (ps.won) fs.wins++;
      fs.totalCredits    += ps.creditsAtEnd;
      fs.totalFuel       += ps.fuelAtEnd;
      fs.totalCombats    += ps.combats;
      fs.totalCombatWins += ps.combatWins;
      fs.totalArts       += ps.artifactsAtEnd.length;

      for (const m of ps.modulesBought) {
        modPurchases[m] = (modPurchases[m] ?? 0) + 1;
      }
      if (ps.won) {
        for (const slot of ps.artifactsAtEnd) {
          artWinnerHad[slot] = (artWinnerHad[slot] ?? 0) + 1;
        }
        // Track modules in winner's grid
        // We don't have final grid here, use modulesBought as proxy
        for (const m of ps.modulesBought) {
          modWinnerHad[m] = (modWinnerHad[m] ?? 0) + 1;
        }
        for (const a of ps.artifactsAtEnd) {
          artWinnerHad[a] = (artWinnerHad[a] ?? 0) + 1;
        }
      }
      // artifact claim count
      artClaims['_total'] = (artClaims['_total'] ?? 0) + ps.artifactsClaimed;
    }
  }

  const factionStats: Record<string, FactionStat> = {};
  let overallCredits = 0, overallFuel = 0, overallCombats = 0, overallCombatWins = 0;
  let overallPlayers = 0;

  for (const [f, fs] of Object.entries(fStats)) {
    const g = fs.games || 1;
    factionStats[f] = {
      games:            fs.games,
      wins:             fs.wins,
      winRate:          fs.wins / (fs.games || 1),
      avgFinalCredits:  Math.round(fs.totalCredits / g),
      avgFuelSpent:     Math.round(fs.totalFuel / g),
      avgCombatWinRate: fs.totalCombats > 0 ? fs.totalCombatWins / fs.totalCombats : 0,
      avgArtifacts:     parseFloat((fs.totalArts / g).toFixed(2)),
    };
    overallCredits    += fs.totalCredits;
    overallFuel       += fs.totalFuel;
    overallCombats    += fs.totalCombats;
    overallCombatWins += fs.totalCombatWins;
    overallPlayers    += fs.games;
  }

  return {
    playerCount:       pc,
    gamesRun:          N,
    draws,
    avgCycles:         parseFloat((totalCycles / N).toFixed(2)),
    minCycles,
    maxCycles,
    cycleDist,
    factionStats:      factionStats as Record<FactionId, FactionStat>,
    modulePurchases:   modPurchases,
    moduleWinnerHad:   modWinnerHad,
    artifactClaimFreq: artClaims,
    artifactWinnerHad: artWinnerHad,
    economyAvg: {
      avgFinalCredits:  Math.round(overallCredits / overallPlayers),
      avgFuelAtEnd:     Math.round(overallFuel / overallPlayers),
      avgCombatWinRate: overallCombats > 0 ? parseFloat((overallCombatWins / overallCombats).toFixed(3)) : 0,
    },
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Main
// ─────────────────────────────────────────────────────────────────────────────

const GAMES_PER_CONFIG = 300;

console.log('Stellar Dominion Balance Simulation');
console.log(`Running ${GAMES_PER_CONFIG} games × 5 player-count configs = ${GAMES_PER_CONFIG * 5} total games\n`);

const allResults: PlayerCountResult[] = [];

for (let pc = 2; pc <= 6; pc++) {
  const t0 = Date.now();
  const pcGames: GameResult[] = [];

  for (let g = 0; g < GAMES_PER_CONFIG; g++) {
    const seed = (g * 31337 + pc * 9999) >>> 0;
    const rng  = mulberry32(seed);
    // Shuffle all 6 factions, pick first pc
    const facs = seededShuffle([...FACTION_IDS], rng).slice(0, pc) as FactionId[];
    pcGames.push(simulateGame(facs, seed + 1));
  }

  const agg = aggregateResults(pcGames, pc);
  allResults.push(agg);

  const elapsed = ((Date.now() - t0) / 1000).toFixed(1);
  console.log(`${pc}P done — ${GAMES_PER_CONFIG} games in ${elapsed}s  avg ${agg.avgCycles.toFixed(1)} cycles  draws=${agg.draws}`);
}

// Write JSON output
const outPath = new URL('./simulation-results.json', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1');
writeFileSync(outPath, JSON.stringify(allResults, null, 2), 'utf-8');
console.log(`\nResults written to simulation-results.json`);

// ─────────────────────────────────────────────────────────────────────────────
// Human-readable summary
// ─────────────────────────────────────────────────────────────────────────────

console.log('\n═══════════════════════════════════════════════════════════════');
console.log('  BALANCE REPORT');
console.log('═══════════════════════════════════════════════════════════════\n');

for (const r of allResults) {
  const fair = 1 / r.playerCount;
  console.log(`── ${r.playerCount} PLAYERS  (expected win rate: ${(fair * 100).toFixed(0)}%)  avg cycles: ${r.avgCycles.toFixed(1)} ──`);

  const frows = (FACTION_IDS as FactionId[])
    .map(f => ({ f, s: r.factionStats[f] }))
    .sort((a, b) => b.s.winRate - a.s.winRate);

  for (const { f, s } of frows) {
    const wr   = (s.winRate * 100).toFixed(1).padStart(5);
    const flag = s.winRate > fair * 1.3 ? ' ⚠ HIGH' : s.winRate < fair * 0.6 ? ' ⚠ LOW' : '';
    const cwr  = s.avgCombatWinRate > 0
      ? `  combat-WR:${(s.avgCombatWinRate * 100).toFixed(0)}%`
      : '';
    console.log(`  ${f.padEnd(10)} WR:${wr}%  games:${s.games}  avg-arts:${s.avgArtifacts}${cwr}${flag}`);
  }
  console.log();
}

// Module popularity
console.log('── MODULE PURCHASE COUNTS (all games combined) ──');
const allModPurchases: Record<string, number> = {};
const allModWinnerHad: Record<string, number> = {};
for (const r of allResults) {
  for (const [m, c] of Object.entries(r.modulePurchases))  allModPurchases[m] = (allModPurchases[m] ?? 0) + c;
  for (const [m, c] of Object.entries(r.moduleWinnerHad))  allModWinnerHad[m] = (allModWinnerHad[m] ?? 0) + c;
}
const totalWins = GAMES_PER_CONFIG * 5; // rough
const modRows = Object.entries(allModPurchases)
  .sort((a, b) => b[1] - a[1]);
for (const [m, c] of modRows) {
  const winCorr = allModWinnerHad[m] ?? 0;
  const pct     = totalWins > 0 ? ((winCorr / totalWins) * 100).toFixed(1) : '0.0';
  console.log(`  ${m.padEnd(22)} bought:${String(c).padStart(5)}  winner-had:${String(winCorr).padStart(4)} (${pct}%)`);
}

// Artifact win correlation
console.log('\n── ARTIFACT WIN CORRELATION (winner had artifact at game end) ──');
const allArtWinner: Record<string, number> = {};
for (const r of allResults) {
  for (const [a, c] of Object.entries(r.artifactWinnerHad)) allArtWinner[a] = (allArtWinner[a] ?? 0) + c;
}
const artRows = Object.entries(allArtWinner).sort((a, b) => b[1] - a[1]);
for (const [a, c] of artRows) {
  const pct = ((c / totalWins) * 100).toFixed(1);
  const source = ARTIFACTS[a]?.source ?? '?';
  console.log(`  ${a.padEnd(22)} ${source.padEnd(8)} winner-had:${String(c).padStart(4)} (${pct}%)`);
}

console.log('\nDone.');
