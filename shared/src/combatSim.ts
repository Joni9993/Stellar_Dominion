/**
 * Combat balance simulation — run with:
 *   npx tsx shared/src/combatSim.ts
 *
 * Pits every build config against every other config, 1000 seeds each.
 * Neutral faction (VAESH, no passives, no artifacts, no crew) for both sides.
 */

import { runCombat } from './combatEngine.js';
import type { ShipBuild } from './types.js';

const L = 'pulse-laser';
const R = 'railgun';
const M = 'missile-pod';
const Rx = 'reactor';
const Cp = 'capacitor';
const Sh = 'shield-projector';
const Ar = 'armor-plate';
const PD = 'point-defense';

// 9-slot grid helper: BOW=0-2, CORE=3-5, STERN=6-8
function g(...slots: (string | null)[]): ShipBuild {
  const grid: (string | null)[] = Array(9).fill(null);
  slots.forEach((v, i) => { grid[i] = v; });
  return { grid };
}

// ── Build catalog ─────────────────────────────────────────────────────────────
// Reactor in slot 3 (adj to slot 0) or slot 4 (adj to slot 1)
// for max adjacency we put reactor at col aligned with weapons

const BUILDS: Record<string, ShipBuild> = {
  // ── 1 weapon ──
  '1×Laser':          g(L),
  '1×Rail':           g(R),
  '1×Missile':        g(M),
  '1×Laser+Rx':       g(L, null, null, Rx),        // reactor adj to slot 0 (laser)
  '1×Rail+Rx':        g(R, null, null, Rx),
  '1×Missile+Rx':     g(M, null, null, Rx),
  '1×Laser+Shd':      g(L, null, null, null, null, Sh),
  '1×Laser+Arm':      g(L, null, null, null, null, Ar),
  '1×Rail+Shd':       g(R, null, null, null, null, Sh),
  '1×Rail+Arm':       g(R, null, null, null, null, Ar),
  '1×Missile+PD':     g(M, null, null, null, null, PD),

  // ── 2 weapons ──
  '2×Laser':          g(L, L),
  '2×Rail':           g(R, R),
  '2×Missile':        g(M, M),
  '2×Laser+Rx':       g(L, L, null, Rx, null),     // rx at 3, adj to slot 0
  '2×Rail+Rx':        g(R, R, null, Rx, null),
  '2×Missile+Rx':     g(M, M, null, Rx, null),
  '2×Laser+Shd':      g(L, L, null, null, null, Sh),
  '2×Rail+Arm':       g(R, R, null, null, null, Ar),
  '2×Laser+Shd+Rx':   g(L, L, null, Rx, null, Sh),
  '2×Rail+Arm+Rx':    g(R, R, null, Rx, null, Ar),
  '1×Rail+1×Laser+Rx':g(R, L, null, Rx),
  '1×Rail+1×Miss+Rx': g(R, M, null, Rx),
  '1×Laser+1×Miss+Rx':g(L, M, null, Rx),

  // ── 3 weapons ──
  '3×Laser':          g(L, L, L),
  '3×Rail':           g(R, R, R),
  '3×Missile':        g(M, M, M),
  '3×Laser+Rx':       g(L, L, L, Rx),              // rx at 3, adj to slot 0 + L
  '3×Rail+Rx':        g(R, R, R, Rx),
  '3×Laser+Shd+Rx':   g(L, L, L, Rx, null, Sh),
  '3×Rail+Arm+Rx':    g(R, R, R, Rx, null, Ar),
  'L+R+M+Rx':         g(L, R, M, Rx),              // mixed 3-weapon
  '2×Laser+PD+Rx':    g(L, L, null, Rx, null, PD),
  '2×Missile+PD+Rx':  g(M, M, null, Rx, null, PD),
};

const NAMES = Object.keys(BUILDS);
const SEEDS = 1000;
const FACTION = 'VAESH'; // no passives, clean baseline

// ── Run sims ──────────────────────────────────────────────────────────────────

interface Result {
  winsA: number;
  winsB: number;
  draws: number;
  avgTicksA: number; // ticks when A wins
  avgTicksB: number;
  totalTicks: number; // sum of ALL fight durations (wins + losses)
  timeouts: number;  // fights that hit the 1500-tick limit
}

const results: Record<string, Record<string, Result>> = {};

for (const nameA of NAMES) {
  results[nameA] = {};
  for (const nameB of NAMES) {
    if (nameA === nameB) continue; // mirror match, skip
    let winsA = 0, winsB = 0, draws = 0;
    let tickSumA = 0, tickSumB = 0, totalTicks = 0, timeouts = 0;

    for (let seed = 0; seed < SEEDS; seed++) {
      const r = runCombat(BUILDS[nameA], BUILDS[nameB], FACTION, FACTION, seed);
      const lastEvt = r.timeline[r.timeline.length - 1];
      const ticks = lastEvt?.tick ?? 1500;
      totalTicks += ticks;
      // Timeout = both ships still alive at last event (time limit decided winner)
      if ((lastEvt?.hullA ?? 100) > 0 && (lastEvt?.hullB ?? 100) > 0) timeouts++;
      if (r.winner === 'A') { winsA++; tickSumA += ticks; }
      else if (r.winner === 'B') { winsB++; tickSumB += ticks; }
      else draws++;
    }

    results[nameA][nameB] = {
      winsA, winsB, draws,
      avgTicksA: winsA > 0 ? Math.round(tickSumA / winsA) : 0,
      avgTicksB: winsB > 0 ? Math.round(tickSumB / winsB) : 0,
      totalTicks,
      timeouts,
    };
  }
}

// ── Output ───────────────────────────────────────────────────────────────────

// Overall win-rate per build (sum wins as A + wins as B over all matchups)
interface Summary {
  name: string;
  wins: number;
  losses: number;
  draws: number;
  total: number;
  winRate: number;
  avgTicks: number;
}

const summaries: Summary[] = NAMES.map(name => {
  let wins = 0, losses = 0, draws = 0, tickSum = 0, tickCount = 0;
  for (const other of NAMES) {
    if (other === name) continue;
    const r = results[name][other];
    if (r) {
      wins   += r.winsA;
      losses += r.winsB;
      draws  += r.draws;
      tickSum   += r.avgTicksA * r.winsA;
      tickCount += r.winsA;
    }
    // also count when this build was side B
    const rOther = results[other]?.[name];
    if (rOther) {
      wins   += rOther.winsB;
      losses += rOther.winsA;
      draws  += rOther.draws;
      tickSum   += rOther.avgTicksB * rOther.winsB;
      tickCount += rOther.winsB;
    }
  }
  const total = wins + losses + draws;
  return {
    name,
    wins, losses, draws, total,
    winRate: total > 0 ? Math.round((wins / total) * 1000) / 10 : 0,
    avgTicks: tickCount > 0 ? Math.round(tickSum / tickCount) : 0,
  };
}).sort((a, b) => b.winRate - a.winRate);

console.log('\n══════════════════════════════════════════════════════════════════');
console.log('  STELLAR DOMINION — COMBAT BALANCE SIMULATION');
console.log(`  ${SEEDS} seeds × ${NAMES.length} builds × ${NAMES.length - 1} matchups`);
console.log('  Faction: VAESH (no passives) — clean RPS baseline');
console.log('══════════════════════════════════════════════════════════════════\n');
console.log('OVERALL RANKING (aggregated win-rate across all matchups):');
console.log('─'.repeat(66));
console.log('Rank  Build                       WinRate   W     L     D    AvgTicks');
console.log('─'.repeat(66));
summaries.forEach((s, i) => {
  const rank = String(i + 1).padStart(2);
  const name = s.name.padEnd(26);
  const wr   = `${s.winRate.toFixed(1)}%`.padStart(7);
  const w    = String(s.wins).padStart(6);
  const l    = String(s.losses).padStart(6);
  const d    = String(s.draws).padStart(5);
  const t    = String(s.avgTicks).padStart(8);
  console.log(`  ${rank}.  ${name} ${wr}  ${w}  ${l}  ${d}  ${t}`);
});

// Head-to-head for selected interesting matchups
const SPOTLIGHT: [string, string][] = [
  ['1×Laser', '1×Rail'],
  ['1×Rail', '1×Missile'],
  ['1×Missile', '1×Laser'],
  ['1×Laser+Rx', '1×Laser'],
  ['1×Rail+Rx', '1×Rail'],
  ['2×Laser', '1×Laser+Shd'],
  ['2×Rail', '1×Rail+Shd'],
  ['2×Rail+Rx', '2×Laser+Shd+Rx'],
  ['3×Laser+Rx', '3×Rail+Rx'],
  ['L+R+M+Rx', '3×Laser+Rx'],
  ['2×Missile+PD+Rx', '2×Laser+Shd+Rx'],
];

console.log('\nSPOTLIGHT MATCHUPS (A vs B — % shows A win-rate over 1000 seeds):');
console.log('─'.repeat(66));
for (const [a, b] of SPOTLIGHT) {
  const r = results[a]?.[b];
  if (!r) continue;
  const aWr = ((r.winsA / SEEDS) * 100).toFixed(1);
  const bWr = ((r.winsB / SEEDS) * 100).toFixed(1);
  const dPct = ((r.draws / SEEDS) * 100).toFixed(1);
  console.log(`  ${a.padEnd(24)} vs ${b.padEnd(24)}`);
  console.log(`      A: ${aWr.padStart(5)}%  B: ${bWr.padStart(5)}%  Draw: ${dPct}%`);
  console.log();
}

// Energy impact: with vs without reactor
console.log('REACTOR IMPACT (same weapon, with vs without reactor):');
console.log('─'.repeat(66));
const rxPairs: [string, string][] = [
  ['1×Laser+Rx', '1×Laser'],
  ['1×Rail+Rx',  '1×Rail'],
  ['1×Missile+Rx', '1×Missile'],
  ['2×Laser+Rx', '2×Laser'],
  ['2×Rail+Rx',  '2×Rail'],
  ['3×Laser+Rx', '3×Laser'],
  ['3×Rail+Rx',  '3×Rail'],
];
for (const [withRx, withoutRx] of rxPairs) {
  const r = results[withRx]?.[withoutRx];
  if (!r) continue;
  const rxWr = ((r.winsA / SEEDS) * 100).toFixed(1);
  console.log(`  +Rx ${withRx.padEnd(20)} vs no-Rx ${withoutRx.padEnd(16)} → Rx wins ${rxWr}%`);
}

// ── Duration analysis ─────────────────────────────────────────────────────────

const WEAPON_IDS = new Set(['pulse-laser', 'railgun', 'missile-pod']);

function wCount(name: string): number {
  return BUILDS[name].grid.filter(id => id && WEAPON_IDS.has(id)).length;
}
function hasShield(name: string): boolean {
  return BUILDS[name].grid.includes('shield-projector');
}

function dominantWeapon(name: string): string {
  const g = BUILDS[name].grid;
  const l = g.filter(id => id === L).length;
  const r = g.filter(id => id === R).length;
  const m = g.filter(id => id === M).length;
  const max = Math.max(l, r, m);
  if (max === 0) return 'none';
  const tied = [l===max, r===max, m===max].filter(Boolean).length;
  if (tied > 1) return 'Mix';
  if (l === max) return 'Laser';
  if (r === max) return 'Rail';
  return 'Missile';
}

// Per unique fight (nameA < nameB order): collect totalTicks once
interface FightDur { wc: number; shield: boolean; ticks: number; timeouts: number; typeKey: string }
const fights: FightDur[] = [];

for (let i = 0; i < NAMES.length; i++) {
  for (let j = i + 1; j < NAMES.length; j++) {
    const a = NAMES[i], b = NAMES[j];
    const r = results[a]?.[b];
    if (!r) continue;
    // Characterise fight by the build with MORE weapons (or either if equal)
    const maxWc  = Math.max(wCount(a), wCount(b));
    const anyShd = hasShield(a) || hasShield(b);
    const types  = [dominantWeapon(a), dominantWeapon(b)].sort();
    const typeKey = types[0] === types[1] ? types[0] : `${types[0]}+${types[1]}`;
    fights.push({ wc: maxWc, shield: anyShd, ticks: r.totalTicks / SEEDS, timeouts: r.timeouts, typeKey });
  }
}

// Group by weapon-count tier
const byWc: Record<number, { ticks: number[]; timeouts: number; total: number }> = {
  1: { ticks: [], timeouts: 0, total: 0 },
  2: { ticks: [], timeouts: 0, total: 0 },
  3: { ticks: [], timeouts: 0, total: 0 },
};
for (const f of fights) {
  if (byWc[f.wc]) {
    byWc[f.wc].ticks.push(f.ticks);
    byWc[f.wc].timeouts += f.timeouts;
    byWc[f.wc].total += SEEDS;
  }
}

// Group by shield presence
interface ShieldGroup { ticks: number[]; timeouts: number; total: number }
const shielded:   ShieldGroup = { ticks: [], timeouts: 0, total: 0 };
const unshielded: ShieldGroup = { ticks: [], timeouts: 0, total: 0 };
for (const f of fights) {
  const g = f.shield ? shielded : unshielded;
  g.ticks.push(f.ticks);
  g.timeouts += f.timeouts;
  g.total += SEEDS;
}

// Group by weapon type matchup
const byType: Record<string, { ticks: number[]; timeouts: number; total: number }> = {};
for (const f of fights) {
  if (!byType[f.typeKey]) byType[f.typeKey] = { ticks: [], timeouts: 0, total: 0 };
  byType[f.typeKey].ticks.push(f.ticks);
  byType[f.typeKey].timeouts += f.timeouts;
  byType[f.typeKey].total += SEEDS;
}

// Also: per build — avg ticks across ALL fights it participated in
const buildDur: Record<string, number> = {};
for (const name of NAMES) {
  let sum = 0, cnt = 0;
  for (const other of NAMES) {
    if (other === name) continue;
    const r1 = results[name]?.[other];
    const r2 = results[other]?.[name];
    if (r1) { sum += r1.totalTicks; cnt += SEEDS; }
    if (r2) { sum += r2.totalTicks; cnt += SEEDS; }
  }
  buildDur[name] = cnt > 0 ? sum / cnt : 0;
}

function avg(arr: number[]): number {
  if (arr.length === 0) return 0;
  return arr.reduce((s, v) => s + v, 0) / arr.length;
}
function fmt(ticks: number, timeouts: number, total: number): string {
  const s = (ticks / 50).toFixed(1);
  const toRate = total > 0 ? ((timeouts / total) * 100).toFixed(1) : '0.0';
  return `${Math.round(ticks).toString().padStart(5)} ticks (~${s.padStart(5)}s)  timeout: ${toRate.padStart(5)}%`;
}

// Overall timeout rate
const allTimeouts = fights.reduce((s, f) => s + f.timeouts, 0);
const allTotal    = fights.length * SEEDS;

console.log('\n\nAVERAGE FIGHT DURATION ANALYSIS  [Damage −75%: Laser 3 / Rail 8 / Missile 5 | Shield Regen 0.33/tick | Hull 150]');
console.log('══════════════════════════════════════════════════════════════════');
console.log(`Overall timeout rate (hit 1500-tick limit): ${((allTimeouts/allTotal)*100).toFixed(1)}% of all fights`);
console.log('(each duration = avg ticks across 1000 seeds per matchup)\n');

console.log('By maximum weapon count in the fight:');
console.log('─'.repeat(66));
for (const [wc, g] of Object.entries(byWc)) {
  const a = avg(g.ticks);
  console.log(`  ${wc}-weapon fights (${g.ticks.length.toString().padStart(3)} matchups)  →  ${fmt(a, g.timeouts, g.total)}`);
}

console.log('\nBy shield presence (either build has Shield Projector):');
console.log('─'.repeat(66));
console.log(`  Any shield     (${shielded.ticks.length.toString().padStart(3)} matchups)   →  ${fmt(avg(shielded.ticks), shielded.timeouts, shielded.total)}`);
console.log(`  No shield      (${unshielded.ticks.length.toString().padStart(3)} matchups)   →  ${fmt(avg(unshielded.ticks), unshielded.timeouts, unshielded.total)}`);

console.log('\nBy weapon-type matchup:');
console.log('─'.repeat(66));
for (const [key, g] of Object.entries(byType).sort((a, b) => avg(b[1].ticks) - avg(a[1].ticks))) {
  const a = avg(g.ticks);
  console.log(`  ${key.padEnd(18)} (${g.ticks.length.toString().padStart(3)} matchups)  →  ${fmt(a, g.timeouts, g.total)}`);
}
console.log('\nPer-build average fight duration (across all fights, as either side):');
console.log('─'.repeat(66));
const sorted = NAMES.slice().sort((a, b) => buildDur[b] - buildDur[a]);
for (const name of sorted) {
  const ticks = buildDur[name];
  const s = (ticks / 50).toFixed(1);
  const bar = '█'.repeat(Math.round(ticks / 30)).slice(0, 30);
  console.log(`  ${name.padEnd(24)} ${Math.round(ticks).toString().padStart(5)} ticks (~${s.padStart(5)}s)  ${bar}`);
}
