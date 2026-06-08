import { create } from 'zustand';
import { Client as ColyseusClient, type Room } from 'colyseus.js';
import {
  type BoardingLoot,
  type CrewId,
  type CombatResult,
  type FactionId,
  type GameView,
  type GoodId,
  type MatchState,
  type Player,
  FACTIONS,
  PARTS,
  RUMOR_ARTIFACT_IDS,
  TEST_RASK_BUILD,
  canJump,
  canBuyGood,
  canSellGood,
  canRefuel,
  canHireCrew,
  canClaimArtifact,
  canBuyModule,
  canSellModule,
  doBuyGood,
  doSellGood,
  doJump,
  doRefuel,
  doHireCrew,
  doChangeBuildSlot,
  doClaimArtifact,
  doBuyModule,
  doSellModule,
  doApplyLoot,
  doCripple,
  checkWin,
  doEndTurn,
  FACTION_HOME_SYSTEM,
  deriveStats,
  generateGalaxy,
  mulberry32,
  runCombat,
  seededShuffle,
  getAdjacentSystems,
  getEffectiveJumpCost,
} from '@stellar-dominion/shared';

// ── Types ─────────────────────────────────────────────────────────────────────

export type StationTab = 'market' | 'fuel' | 'crew' | 'modules';

export type YardZoneLabel = 'BOW' | 'CORE' | 'STERN';
export type YardInspection =
  | { kind: 'part'; id: string; fromGridSlot: number }
  | { kind: 'zone'; zone: YardZoneLabel };

export interface LobbyPlayer {
  id: string;
  name: string;
  factionId: FactionId | null;
  isHost: boolean;
  isObserver: boolean;
}

export interface LobbyState {
  roomId: string;
  players: LobbyPlayer[];
  isHost: boolean;
}

const SERVER_URL = import.meta.env.VITE_SERVER_URL ?? 'ws://localhost:2567';

function getStablePlayerId(): string {
  const key = 'stellar-dominion-player-id';
  let id = localStorage.getItem(key);
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem(key, id);
  }
  return id;
}

// ── Store type ────────────────────────────────────────────────────────────────

type GameStore = {
  // Connection
  connectionMode: 'local' | 'online';
  colyseusRoom: Room | null;
  lobbyState: LobbyState | null;

  // Game
  matchState: MatchState | null;
  selectedSystemId: number | null;
  activeView: GameView;
  myPlayerId: string;
  gameSeed: number;

  // Turn tracking
  jumpsUsed: number;
  hasActed: boolean;

  // Station overlay
  isStationOpen: boolean;
  stationTab: StationTab;

  // Combat
  combatResult: CombatResult | null;
  combatAttackerId: string | null;
  combatDefenderId: string | null;
  boardingLoot: BoardingLoot | null;

  // Shipyard selection
  selectedPalettePartId: string | null;
  yardInspection: YardInspection | null;

  // ── Actions ──

  // Observer
  isObserver: boolean;
  hasObserver: boolean;

  // Lobby / connection
  createOnlineRoom: (playerName: string) => Promise<void>;
  joinOnlineRoom: (roomId: string, playerName: string) => Promise<void>;
  setFaction: (factionId: FactionId) => void;
  setObserver: () => void;
  startOnlineGame: () => void;

  // Game init (local)
  initGame: (seed?: number) => void;

  // Navigation
  selectSystem: (id: number) => void;
  setView: (view: GameView) => void;

  // Combat
  startCombat: (targetPlayerId?: string) => void;
  claimArtifact: () => void;
  applyCombatOutcome: (playerWon: boolean, loserArtifactId: string | null) => void;

  // Turn
  jump: (targetSystemId: number) => void;
  endTurn: () => void;

  // Station
  openStation: () => void;
  closeStation: () => void;
  setStationTab: (tab: StationTab) => void;

  // Trade
  buyGood: (good: GoodId, qty: number) => void;
  sellGood: (good: GoodId, qty: number) => void;
  refuel: (amount: number) => void;
  hireCrew: (slot: number, crewId: CrewId | null, cost: number) => void;

  // Shipyard
  selectPalettePart: (partId: string | null) => void;
  placePartInSlot: (slotIndex: number, fromSlot?: number) => void;
  removePartFromSlot: (slotIndex: number) => void;
  setYardInspection: (i: YardInspection | null) => void;

  // Module shop
  buyModule: (partId: string) => void;
  sellModule: (partId: string) => void;
};

// ── Store ─────────────────────────────────────────────────────────────────────

export const useGameStore = create<GameStore>((set, get) => ({
  connectionMode: 'local',
  colyseusRoom: null,
  lobbyState: null,
  isObserver: false,
  hasObserver: false,

  matchState: null,
  selectedSystemId: null,
  activeView: 'map',
  myPlayerId: 'local',
  gameSeed: 0,
  combatResult: null,
  combatAttackerId: null,
  combatDefenderId: null,
  boardingLoot: null,
  jumpsUsed: 0,
  hasActed: false,
  isStationOpen: false,
  stationTab: 'market',
  selectedPalettePartId: null,
  yardInspection: null,

  // ── Lobby / connection ────────────────────────────────────────────────────

  createOnlineRoom: async (playerName) => {
    const client = new ColyseusClient(SERVER_URL);
    const reconnectId = getStablePlayerId();
    const room = await client.create<unknown>('game', { playerName, reconnectId });
    attachRoomListeners(room, set, get);
    // Use the stable UUID as myPlayerId — it is what the server stores in matchState
    set({ colyseusRoom: room, connectionMode: 'online', myPlayerId: reconnectId });
  },

  joinOnlineRoom: async (roomId, playerName) => {
    const client = new ColyseusClient(SERVER_URL);
    const reconnectId = getStablePlayerId();
    const room = await client.joinById<unknown>(roomId, { playerName, reconnectId });
    attachRoomListeners(room, set, get);
    set({ colyseusRoom: room, connectionMode: 'online', myPlayerId: reconnectId });
  },

  setFaction: (factionId) => {
    const { colyseusRoom } = get();
    colyseusRoom?.send('SET_FACTION', { factionId });
  },

  setObserver: () => {
    const { colyseusRoom } = get();
    colyseusRoom?.send('SET_OBSERVER', {});
  },

  startOnlineGame: () => {
    const { colyseusRoom } = get();
    colyseusRoom?.send('START_GAME', {});
  },

  // ── Local init ────────────────────────────────────────────────────────────

  initGame: (seed = 12345) => {
    const galaxy = generateGalaxy(seed);
    const rng = mulberry32(seed + 1);

    const factionData = FACTIONS['IDRYN'];
    const player: Player = {
      id: 'local',
      name: 'COMMANDER',
      factionId: 'IDRYN',
      color: factionData.color,
      systemId: factionData.homeSystemId,
      status: 'active',
      credits: 500,
      fuel: 60,
      maxFuel: 100,
      cargo: {},
      build: {
        grid: ['pulse-laser', 'railgun', 'pulse-laser', 'reactor', 'concord-prism', 'shield-projector', 'ion-engine', 'fuel-tank', null],
      },
      crew: [null, null],
      artifacts: ['concord-prism'],
      ownedModules: [],
    };

    const rumorPool = seededShuffle([...RUMOR_ARTIFACT_IDS], rng);
    const firstRumorArtifact = rumorPool.shift()!;

    const matchState: MatchState = {
      galaxy,
      players: [player],
      cycle: 1,
      maxCycles: 20,
      rumor: { systemId: 17, artifactId: firstRumorArtifact, price: 300, active: true },
      rumorPool,
      rumorsClaimed: 0,
      turnOrder: ['local'],
      activePlayerId: 'local',
      phase: 'move',
      winThreshold: 3,
    };

    set({
      matchState,
      selectedSystemId: factionData.homeSystemId,
      gameSeed: seed,
      jumpsUsed: 0,
      hasActed: false,
      connectionMode: 'local',
      myPlayerId: 'local',
      lobbyState: null,
    });
  },

  // ── Combat ────────────────────────────────────────────────────────────────

  startCombat: (targetPlayerId) => {
    const { matchState, myPlayerId, gameSeed, connectionMode, colyseusRoom } = get();
    if (!matchState) return;

    if (connectionMode === 'online' && colyseusRoom) {
      if (!targetPlayerId) return;
      colyseusRoom.send('ATTACK', { targetPlayerId });
      return;
    }

    // Local: fight the dummy RASK opponent
    const player = matchState.players.find((p) => p.id === myPlayerId);
    if (!player) return;

    // Find a real opponent if targetPlayerId given
    const opponent = targetPlayerId
      ? matchState.players.find((p) => p.id === targetPlayerId)
      : null;

    const result = runCombat(
      player.build,
      opponent?.build ?? TEST_RASK_BUILD,
      player.factionId,
      opponent?.factionId ?? 'RASK',
      gameSeed + 999,
      player.crew,
      opponent?.crew ?? [],
    );
    set({
      combatResult: result,
      activeView: 'fight',
      combatAttackerId: myPlayerId,
      combatDefenderId: opponent?.id ?? null,
    });
  },

  claimArtifact: () => {
    const { matchState, myPlayerId, connectionMode, colyseusRoom } = get();
    if (!matchState) return;
    if (connectionMode === 'online' && colyseusRoom) {
      colyseusRoom.send('CLAIM_ARTIFACT', {});
      return;
    }
    const result = canClaimArtifact(matchState, myPlayerId);
    if (!result.ok) return;
    set({ matchState: doClaimArtifact(matchState, myPlayerId), hasActed: true });
  },

  applyCombatOutcome: (playerWon, loserArtifactId) => {
    const { matchState, myPlayerId, connectionMode } = get();
    if (!matchState) return;

    // Online: server already applied loot + teleport, just navigate back
    if (connectionMode === 'online') {
      set({ activeView: 'map', hasActed: true });
      return;
    }

    if (playerWon && loserArtifactId) {
      const player = matchState.players.find((p) => p.id === myPlayerId)!;
      const grid = [...player.build.grid];
      const emptySlot = grid.findIndex((s) => s === null);
      if (emptySlot !== -1) grid[emptySlot] = loserArtifactId;
      let next: MatchState = {
        ...matchState,
        players: matchState.players.map((p) =>
          p.id !== myPlayerId ? p : {
            ...p,
            artifacts: [...p.artifacts, loserArtifactId],
            build: emptySlot !== -1 ? { grid } : p.build,
          },
        ),
      };
      const winner = checkWin(next);
      if (winner) next = { ...next, winnerId: winner };
      set({ matchState: next, activeView: 'map', hasActed: true });
    } else {
      const player = matchState.players.find((p) => p.id === myPlayerId)!;
      const lostArt = player.artifacts.length > 0
        ? player.artifacts[player.artifacts.length - 1]
        : null;
      const homeSystemId = FACTION_HOME_SYSTEM[player.factionId] ?? player.systemId;
      const next: MatchState = {
        ...matchState,
        players: matchState.players.map((p) => {
          if (p.id !== myPlayerId) return p;
          const artifacts = lostArt ? p.artifacts.filter((a) => a !== lostArt) : p.artifacts;
          const grid = lostArt ? p.build.grid.map((s) => (s === lostArt ? null : s)) : p.build.grid;
          return { ...p, artifacts, build: { grid }, systemId: homeSystemId };
        }),
      };
      set({ matchState: next, activeView: 'map', hasActed: true });
    }
  },

  // ── Navigation ────────────────────────────────────────────────────────────

  selectSystem: (id) => set({ selectedSystemId: id }),
  setView: (view) => set({ activeView: view, yardInspection: null }),

  // ── Jump ─────────────────────────────────────────────────────────────────

  jump: (targetSystemId) => {
    const { matchState, myPlayerId, jumpsUsed, connectionMode, colyseusRoom } = get();
    if (!matchState) return;
    if (connectionMode === 'online' && colyseusRoom) {
      colyseusRoom.send('JUMP', { targetSystemId });
      return;
    }
    const player = matchState.players.find((p) => p.id === myPlayerId)!;
    const maxJumps = deriveStats(player.build, PARTS, player.factionId).range;
    const result = canJump(matchState, myPlayerId, targetSystemId, jumpsUsed, maxJumps);
    if (!result.ok) return;
    set({ matchState: doJump(matchState, myPlayerId, targetSystemId), selectedSystemId: targetSystemId, jumpsUsed: jumpsUsed + 1 });
  },

  // ── End Turn ──────────────────────────────────────────────────────────────

  endTurn: () => {
    const { matchState, connectionMode, colyseusRoom } = get();
    if (!matchState) return;
    if (connectionMode === 'online' && colyseusRoom) {
      colyseusRoom.send('END_TURN', {});
      return;
    }
    const next = doEndTurn(matchState);
    set({ matchState: next, jumpsUsed: 0, hasActed: false });
  },

  // ── Station ───────────────────────────────────────────────────────────────

  openStation: () => set({ isStationOpen: true, stationTab: 'market' }),
  closeStation: () => set({ isStationOpen: false }),
  setStationTab: (tab) => set({ stationTab: tab }),

  // ── Trade ─────────────────────────────────────────────────────────────────

  buyGood: (good, qty) => {
    const { matchState, myPlayerId, connectionMode, colyseusRoom } = get();
    if (!matchState) return;
    if (connectionMode === 'online' && colyseusRoom) {
      colyseusRoom.send('BUY_GOOD', { good, qty });
      return;
    }
    const player = matchState.players.find((p) => p.id === myPlayerId)!;
    const stats = deriveStats(player.build, PARTS);
    const result = canBuyGood(matchState, myPlayerId, good, qty, stats.cargo);
    if (!result.ok) return;
    set({ matchState: doBuyGood(matchState, myPlayerId, good, qty) });
  },

  sellGood: (good, qty) => {
    const { matchState, myPlayerId, connectionMode, colyseusRoom } = get();
    if (!matchState) return;
    if (connectionMode === 'online' && colyseusRoom) {
      colyseusRoom.send('SELL_GOOD', { good, qty });
      return;
    }
    const result = canSellGood(matchState, myPlayerId, good, qty);
    if (!result.ok) return;
    set({ matchState: doSellGood(matchState, myPlayerId, good, qty) });
  },

  refuel: (amount) => {
    const { matchState, myPlayerId, connectionMode, colyseusRoom } = get();
    if (!matchState) return;
    if (connectionMode === 'online' && colyseusRoom) {
      colyseusRoom.send('REFUEL', { amount });
      return;
    }
    const result = canRefuel(matchState, myPlayerId, amount);
    if (!result.ok) return;
    set({ matchState: doRefuel(matchState, myPlayerId, amount) });
  },

  hireCrew: (slot, crewId, cost) => {
    const { matchState, myPlayerId, connectionMode, colyseusRoom } = get();
    if (!matchState) return;
    if (connectionMode === 'online' && colyseusRoom) {
      colyseusRoom.send('HIRE_CREW', { slot, crewId, cost });
      return;
    }
    if (cost > 0) {
      const result = canHireCrew(matchState, myPlayerId, cost);
      if (!result.ok) return;
    }
    set({ matchState: doHireCrew(matchState, myPlayerId, slot, crewId, cost) });
  },

  // ── Shipyard ──────────────────────────────────────────────────────────────

  selectPalettePart: (partId) => set({ selectedPalettePartId: partId }),
  setYardInspection: (i) => set({ yardInspection: i }),

  placePartInSlot: (slotIndex, fromSlot?) => {
    const { matchState, myPlayerId, selectedPalettePartId, connectionMode, colyseusRoom } = get();
    if (!matchState || !selectedPalettePartId) return;
    if (connectionMode === 'online' && colyseusRoom) {
      colyseusRoom.send('BUILD_CHANGE', { slotIndex, partId: selectedPalettePartId, fromSlot });
      set({ selectedPalettePartId: null });
      return;
    }
    set({ matchState: doChangeBuildSlot(matchState, myPlayerId, slotIndex, selectedPalettePartId, fromSlot) });
  },

  removePartFromSlot: (slotIndex) => {
    const { matchState, myPlayerId, connectionMode, colyseusRoom } = get();
    if (!matchState) return;
    if (connectionMode === 'online' && colyseusRoom) {
      colyseusRoom.send('BUILD_CHANGE', { slotIndex, partId: null });
      return;
    }
    set({ matchState: doChangeBuildSlot(matchState, myPlayerId, slotIndex, null) });
  },

  // ── Module shop ───────────────────────────────────────────────────────────

  buyModule: (partId) => {
    const { matchState, myPlayerId, connectionMode, colyseusRoom } = get();
    if (!matchState) return;
    if (connectionMode === 'online' && colyseusRoom) {
      colyseusRoom.send('BUY_MODULE', { partId });
      return;
    }
    const result = canBuyModule(matchState, myPlayerId, partId);
    if (!result.ok) return;
    set({ matchState: doBuyModule(matchState, myPlayerId, partId) });
  },

  sellModule: (partId) => {
    const { matchState, myPlayerId, connectionMode, colyseusRoom } = get();
    if (!matchState) return;
    if (connectionMode === 'online' && colyseusRoom) {
      colyseusRoom.send('SELL_MODULE', { partId });
      return;
    }
    const result = canSellModule(matchState, myPlayerId, partId);
    if (!result.ok) return;
    set({ matchState: doSellModule(matchState, myPlayerId, partId) });
  },
}));

// ── Colyseus room listener setup ──────────────────────────────────────────────

function attachRoomListeners(
  room: Room,
  set: (partial: Partial<GameStore>) => void,
  get: () => GameStore,
) {
  room.onMessage('LOBBY_UPDATE', (msg: { roomId: string; players: LobbyPlayer[]; hostId: string }) => {
    const myPlayerId = get().myPlayerId || room.sessionId;
    set({
      lobbyState: {
        roomId: msg.roomId,
        players: msg.players,
        isHost: msg.hostId === myPlayerId,
      },
    });
  });

  room.onMessage('GAME_STARTED', (msg: { state: MatchState; myPlayerId: string; isObserver?: boolean; hasObserver?: boolean; jumpsUsed: number; hasActed: boolean }) => {
    const isObs = msg.isObserver === true || !msg.state.players.find((p) => p.id === msg.myPlayerId);
    const player = msg.state.players.find((p) => p.id === msg.myPlayerId);
    set({
      matchState: msg.state,
      myPlayerId: msg.myPlayerId,
      isObserver: isObs,
      hasObserver: msg.hasObserver ?? false,
      jumpsUsed: msg.jumpsUsed,
      hasActed: msg.hasActed,
      lobbyState: null,
      activeView: 'map',
      combatResult: null,
      selectedSystemId: player?.systemId ?? null,
      gameSeed: Date.now(), // force MapView to recreate StarMap for new game
    });
  });

  room.onMessage('STATE_UPDATE', (msg: { state: MatchState; jumpsUsed: number; hasActed: boolean; hasObserver?: boolean }) => {
    const myPlayerId = get().myPlayerId;
    const player = msg.state.players.find((p) => p.id === myPlayerId);
    const isMyTurn = msg.state.activePlayerId === myPlayerId;
    set({
      matchState: msg.state,
      hasObserver: msg.hasObserver ?? get().hasObserver,
      jumpsUsed: isMyTurn ? msg.jumpsUsed : get().jumpsUsed,
      hasActed: isMyTurn ? msg.hasActed : get().hasActed,
      // Auto-select our system when state updates
      selectedSystemId: player?.systemId ?? get().selectedSystemId,
    });
  });

  room.onMessage('COMBAT_RESULT', (msg: {
    result: CombatResult;
    attackerId: string;
    defenderId: string;
    boardingLoot: BoardingLoot;
    state: MatchState;
    jumpsUsed: number;
    hasActed: boolean;
    hasObserver?: boolean;
  }) => {
    const { myPlayerId, isObserver } = get();
    const newHasObserver = msg.hasObserver ?? get().hasObserver;
    const isMyTurn = msg.state.activePlayerId === myPlayerId;
    // Only switch to fight view if: I am the observer, OR no observer is present
    const showCombat = isObserver || !newHasObserver;
    set({
      combatResult: msg.result,
      matchState: msg.state,
      hasObserver: newHasObserver,
      jumpsUsed: isMyTurn ? msg.jumpsUsed : get().jumpsUsed,
      hasActed: isMyTurn ? msg.hasActed : get().hasActed,
      activeView: showCombat ? 'fight' : get().activeView,
      combatAttackerId: msg.attackerId,
      combatDefenderId: msg.defenderId,
      boardingLoot: msg.boardingLoot,
    });
  });

  room.onMessage('ERROR', (msg: { message: string }) => {
    console.warn('[Colyseus]', msg.message);
  });

  room.onLeave(() => {
    console.log('[Colyseus] Disconnected from room');
  });
}

// ── Selector helpers ──────────────────────────────────────────────────────────

export function selectMyPlayer(state: GameStore): Player | undefined {
  return state.matchState?.players.find((p) => p.id === state.myPlayerId);
}

export function selectCurrentSystem(state: GameStore) {
  const player = selectMyPlayer(state);
  if (!player || !state.matchState) return null;
  return state.matchState.galaxy.systems[player.systemId];
}

export function selectReachableSystems(state: GameStore): Map<number, number> {
  const result = new Map<number, number>();
  if (!state.matchState) return result;
  const player = selectMyPlayer(state);
  if (!player) return result;
  const adj = getAdjacentSystems(state.matchState.galaxy, player.systemId);
  for (const id of adj) {
    const cost = getEffectiveJumpCost(player, state.matchState.galaxy, id);
    result.set(id, cost);
  }
  return result;
}
