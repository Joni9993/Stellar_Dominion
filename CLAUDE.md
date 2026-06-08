# CLAUDE.md — Stellar Dominion Agent Guide

## The Rules of the Galaxy — MANDATORY UPDATE RULE

**`Rules of the Galaxy.md` must be kept in sync with the game at all times.**

This file is a **player-facing handbook** — not a technical document. It documents every game mechanic, rule, faction, artifact, and system interaction in plain language. Think of it as the rulebook a new player would read to understand how the game works.

**When to update it:**
- Any new mechanic is implemented or designed → add it to the relevant section
- Any existing mechanic changes (balance numbers, rules, interactions) → update the affected entries
- A new faction, artifact, ship part, or crew member is added → add a full entry
- A mechanic is removed → remove or mark it as removed
- The win condition, turn structure, or economy changes → update those sections

**How to write for it:**
- No code, no TypeScript types, no implementation details
- Plain English, player perspective ("you", "your ship", "enemy")
- Tables for catalogs (parts, artifacts, crew)
- Specific numbers where they matter (e.g., ×1.5 damage modifier, 300 ◈ starting price)
- Update the version note at the bottom when making changes

---

## Project Overview

**Stellar Dominion** is a turn-based multiplayer strategy game (browser/PWA, 2–6 players). Players command alien faction flagships across an 18-system galaxy, competing to collect Artifacts through combat and trade.

**Three pillars: COMBAT · TRADE · ARTIFACTS**

Full design specification: [STELLAR_DOMINION_GDD.md](STELLAR_DOMINION_GDD.md)
UI reference mockup: [stellar-dominion-mockup-v3.html](stellar-dominion-mockup-v3.html)

---

## Tech Stack

| Layer | Technology |
|---|---|
| Language | TypeScript everywhere |
| Client | React + Vite |
| Rendering | PixiJS (WebGL) for map & combat, React/DOM for panels |
| State | Zustand |
| Server | Node.js + Colyseus (room-based multiplayer) |
| Persistence | SQLite (MVP) → Postgres later |
| PWA | vite-plugin-pwa |
| Proxy | nginx + Certbot |

**Monorepo structure (pnpm workspaces):**
```
/shared    → types, game rules, map generator, combat engine (pure functions)
/server    → Colyseus rooms, matchmaking, intent validation, DB
/client    → React + Pixi, PWA
```

**Critical rule:** The server is authoritative. Clients only send intents (`JUMP`, `TRADE`, `BUILD_CHANGE`, `ATTACK`, `CLAIM_ARTIFACT`, `END_TURN`). No `Math.random()` in game logic — use `mulberry32` seeded PRNG for determinism.

---

## Project Status

**Current state:** Milestones 1–6 complete. Playable multiplayer (2–6 players) with lobby, faction selection, server-authoritative turns, combat, loot, and win conditions.

**Milestone roadmap (from GDD section 1.9):**

| # | Milestone | Status |
|---|---|---|
| 1 | Fundament: `/shared` types, `generateGalaxy`, star map in Pixi | ✅ Done |
| 2 | Solo loop: turn structure, jump+fuel, station shop, 3×3 build editor | ✅ Done |
| 3 | Combat engine: RPS counters, tick simulation, combat playback | ✅ Done |
| 4 | Artifact + Rumor system: spawn, claim, contest, PvP loot, win check | ✅ Done |
| 5 | Multiplayer: Colyseus rooms, lobby, server-authoritative, reconnection | ✅ Done |
| 6 | Factions (6 kits + silhouettes), crew, balancing pass | ✅ Done |
| 7 | PWA + deploy, polish | Not started |

**What's in the codebase (as of M6 + balance pass):**
- `pnpm-workspace.yaml` — monorepo with `/shared`, `/client`, `/server`
- `/shared/src/` — types, rng (mulberry32), galaxy (18-system template + seeded generator), factions (6 with faction-specific starter builds: artifact + 1 weapon + 1 utility), artifacts (12), parts (11), crew (5), shipStats (deriveStats + adjacency), gameLogic (jump, trade, refuel, crew, endTurn + cycle stock replenishment, claimArtifact, rumorSpawn — all pure functions)
- `/shared/src/combatEngine.ts` — deterministic tick simulation, all 12 artifact effects, RPS counter modifiers (×1.5/×0.6), energy system, point-defense, boarding hook, etc.
- `/client/src/` — React + Vite + PixiJS; Zustand store (online/Colyseus mode); LobbyView (host / join + faction picker); StarMap (PixiJS canvas with Rumor ping + staggered multi-player positions per system); ShipyardView (SVG contours per faction + 3×3 grid + ARTIFACTS palette section); StationModal (MARKET with effective sell prices shown / FUEL / CREW); MapPanel (JUMP HERE, OPEN STATION, CLAIM ARTIFACT, ATTACK with target-selection modal for multi-enemy systems, COMMANDERS HERE as clickable inspector buttons); CommanderModal (full read-only ship build + stats + resources + artifacts + crew overlay); HUD; CombatView; WinOverlay; turn-indicator screen-edge glow (amber pulse on active player's screen)
- `/server/src/` — Colyseus GameRoom: lobby phase (SET_FACTION, START_GAME), game phase (all intents: JUMP/ATTACK/CLAIM/BUY/SELL/REFUEL/HIRE_CREW/BUILD_CHANGE/END_TURN), 60s reconnection, turn flag tracking

**MVP scope:** 2–4 players, 6 factions, core loop, auto-battler + RPS, Rumor system, PvP loot, win condition.

---

## Key Design Decisions (don't change without discussion)

- **Multiplayer only. No solo mode.** Stellar Dominion is a pure multiplayer game. There is no solo campaign, no AI opponents, and no offline single-player loop. Do not implement, restore, or extend solo/local mode features. Every mechanic, screen, and flow must be designed for 2–6 human players connected via Colyseus. The `initGame()` function in the store is legacy scaffolding — do not expose it in the UI or build features on top of it.

- **No fog of war.** All ships and builds are always visible to all players. This makes the RPS counter system a planning layer, not a luck mechanic.
- **Exactly one Rumored Artifact at a time.** Mario Party star mechanic — everyone converges on one target. Only spawns the next one after the current is claimed.
- **3×3 = 9 slots only.** Artifacts compete with weapons and shields for space. This self-balancing constraint is intentional.
- **Authoritative server.** Combat runs server-side. Clients receive an event timeline and replay it. No client can cheat.
- **Seeded PRNG everywhere.** Use `mulberry32`, never `Math.random()` in game logic.
- **All in-game text in English.** Working documents (like this one) can be in German.

---

## Agent Instructions

- When implementing a new game feature, **update `Rules of the Galaxy.md`** before closing the task.
- When balancing numbers change, update both the GDD and `Rules of the Galaxy.md`.
- When adding new parts, artifacts, or factions, add full entries to `Rules of the Galaxy.md`.
- Keep this CLAUDE.md's project status table current as milestones are completed.
- The mockup HTML is a pure design reference — do not modify it unless explicitly asked.
