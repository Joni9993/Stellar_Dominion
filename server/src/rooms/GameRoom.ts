import { Room, Client } from 'colyseus';
import type {
  MatchState,
  FactionId,
  GoodId,
  CrewId,
  CombatResult,
} from '@stellar-dominion/shared';
import {
  FACTION_IDS,
  PARTS,
  deriveStats,
  runCombat,
  mulberry32,
  canJump,
  canBuyGood,
  canSellGood,
  canRefuel,
  canHireCrew,
  canClaimArtifact,
  canBuyModule,
  canSellModule,
  canEmergencySignal,
  doJump,
  doBuyGood,
  doSellGood,
  doRefuel,
  doHireCrew,
  doChangeBuildSlot,
  doClaimArtifact,
  doBuyModule,
  doSellModule,
  doEmergencySignal,
  doEndTurn,
  rollBoardingLoot,
  doApplyBoardingLoot,
  checkWin,
  createInitialMatchState,
} from '@stellar-dominion/shared';

// ── Types ─────────────────────────────────────────────────────────────────────

interface LobbyPlayer {
  id: string;
  name: string;
  factionId: FactionId | null;
  isHost: boolean;
  isObserver: boolean;
}

interface TurnFlags {
  jumpsUsed: number;
  hasActed: boolean;
}

// ── GameRoom ──────────────────────────────────────────────────────────────────

export class GameRoom extends Room {
  private gamePhase: 'lobby' | 'playing' | 'ended' = 'lobby';
  private matchState: MatchState | null = null;
  private gameSeed = 0;

  // sessionId ↔ playerId (same value, but stored for reconnect lookup)
  private sessionToPlayer = new Map<string, string>();
  private playerToSession = new Map<string, string>();

  // Lobby
  private lobbyPlayers = new Map<string, LobbyPlayer>(); // sessionId → LobbyPlayer
  private hostSessionId = '';

  // Per-turn tracking (not in MatchState)
  private turnFlags = new Map<string, TurnFlags>(); // playerId → flags

  onCreate(_options: unknown) {
    this.maxClients = 10; // 6 players + up to 4 observers

    this.onMessage('*', (client: Client, type: string | number, message: unknown) => {
      try {
        this.handleMessage(client, String(type), message as Record<string, unknown>);
      } catch (err) {
        console.error(`[GameRoom] Error handling ${type}:`, err);
        client.send('ERROR', { message: String(err) });
      }
    });

    console.log(`[GameRoom] Room ${this.roomId} created`);
  }

  onJoin(client: Client, options: Record<string, string> = {}) {
    const reconnectId = options.reconnectId as string | undefined;
    const playerName = options.playerName ?? `Commander ${this.lobbyPlayers.size + 1}`;

    // ── Reconnect to running game ──────────────────────────────────────────────
    if (this.gamePhase === 'playing' && this.matchState && reconnectId) {
      const existingPlayer = this.matchState.players.find((p) => p.id === reconnectId);
      if (existingPlayer) {
        // Remap stale session → new session
        const oldSession = this.playerToSession.get(reconnectId);
        if (oldSession) this.sessionToPlayer.delete(oldSession);
        this.sessionToPlayer.set(client.sessionId, reconnectId);
        this.playerToSession.set(reconnectId, client.sessionId);
        client.send('GAME_STARTED', {
          state: this.matchState,
          myPlayerId: reconnectId,
          isObserver: false,
          hasObserver: this.getHasObserver(),
          ...this.getTurnFlagsForPlayer(reconnectId),
        });
        console.log(`[GameRoom] ${existingPlayer.name} reconnected (${reconnectId})`);
        return;
      }
    }

    // ── Normal join ───────────────────────────────────────────────────────────
    // Use stable client-generated reconnectId as playerId when available so that
    // a later reconnect can find this player in matchState by the same ID.
    const playerId = reconnectId ?? client.sessionId;

    this.sessionToPlayer.set(client.sessionId, playerId);
    this.playerToSession.set(playerId, client.sessionId);

    const isFirstPlayer = this.lobbyPlayers.size === 0;
    if (isFirstPlayer) this.hostSessionId = client.sessionId;

    this.lobbyPlayers.set(client.sessionId, {
      id: playerId,
      name: playerName,
      factionId: null,
      isHost: isFirstPlayer,
      isObserver: false,
    });

    if (this.gamePhase === 'playing' && this.matchState) {
      // New player joining an already-started game — send state so they can observe
      const isObs = !this.matchState.players.some((p) => p.id === playerId);
      client.send('GAME_STARTED', {
        state: this.matchState,
        myPlayerId: playerId,
        isObserver: isObs,
        hasObserver: this.getHasObserver(),
        ...this.getTurnFlagsForPlayer(playerId),
      });
    } else {
      this.broadcastLobby();
    }

    console.log(`[GameRoom] ${playerName} joined as ${playerId} (${this.lobbyPlayers.size} players)`);
  }

  async onLeave(client: Client, consented: boolean) {
    if (this.gamePhase === 'playing' && !consented) {
      try {
        await this.allowReconnection(client, 600);
        // Reconnected via Colyseus token within the 60 s window — resend state
        const playerId = this.sessionToPlayer.get(client.sessionId);
        if (playerId && this.matchState) {
          client.send('GAME_STARTED', {
            state: this.matchState,
            myPlayerId: playerId,
            isObserver: !this.matchState.players.some((p) => p.id === playerId),
            hasObserver: this.getHasObserver(),
            ...this.getTurnFlagsForPlayer(playerId),
          });
        }
        return;
      } catch {
        // Reconnection timed out — fall through to cleanup
      }
    }

    const playerId = this.sessionToPlayer.get(client.sessionId);
    const lobby = this.lobbyPlayers.get(client.sessionId);
    console.log(`[GameRoom] ${lobby?.name ?? playerId ?? client.sessionId} left (consented=${consented})`);

    this.lobbyPlayers.delete(client.sessionId);
    this.sessionToPlayer.delete(client.sessionId);
    // Keep playerToSession entry so a late reconnect via stable UUID can still remap.
    // The stale session pointer is harmless because onJoin clears it on reconnect.

    if (this.gamePhase === 'lobby') {
      if (client.sessionId === this.hostSessionId && this.lobbyPlayers.size > 0) {
        const newHostId = this.lobbyPlayers.keys().next().value as string;
        this.hostSessionId = newHostId;
        const newHost = this.lobbyPlayers.get(newHostId);
        if (newHost) newHost.isHost = true;
      }
      this.broadcastLobby();
    }
  }

  // ── Message routing ─────────────────────────────────────────────────────────

  private handleMessage(client: Client, type: string, msg: Record<string, unknown>) {
    if (this.gamePhase === 'lobby') {
      this.handleLobbyMessage(client, type, msg);
    } else if (this.gamePhase === 'playing') {
      const playerId = this.sessionToPlayer.get(client.sessionId);
      if (!playerId) return;
      this.handleGameMessage(client, playerId, type, msg);
    }
  }

  // ── Lobby handlers ──────────────────────────────────────────────────────────

  private handleLobbyMessage(client: Client, type: string, msg: Record<string, unknown>) {
    if (type === 'SET_FACTION') {
      const factionId = msg.factionId as FactionId;
      if (!FACTION_IDS.includes(factionId)) return;

      // Check faction not already taken by another player
      const taken = [...this.lobbyPlayers.values()].some(
        (p) => p.factionId === factionId && this.playerToSession.get(p.id) !== client.sessionId,
      );
      if (taken) {
        client.send('ERROR', { message: 'Faction already taken' });
        return;
      }

      const lobby = this.lobbyPlayers.get(client.sessionId);
      if (lobby) {
        lobby.factionId = factionId;
        lobby.isObserver = false;
      }
      this.broadcastLobby();
    }

    if (type === 'SET_OBSERVER') {
      const lobby = this.lobbyPlayers.get(client.sessionId);
      if (lobby) {
        lobby.isObserver = true;
        lobby.factionId = null;
      }
      this.broadcastLobby();
    }

    if (type === 'START_GAME' && client.sessionId === this.hostSessionId) {
      const allPlayers = [...this.lobbyPlayers.values()];
      const gamePlayers = allPlayers.filter((p) => !p.isObserver);
      if (gamePlayers.length < 2) {
        client.send('ERROR', { message: 'Need at least 2 players to start' });
        return;
      }
      if (gamePlayers.some((p) => p.factionId === null)) {
        client.send('ERROR', { message: 'All players must pick a faction' });
        return;
      }
      this.startGame();
    }
  }

  private startGame() {
    this.gameSeed = Date.now();
    const allLobby = [...this.lobbyPlayers.values()];
    const gamePlayers = allLobby.filter((p) => !p.isObserver);
    const observerIds = new Set(allLobby.filter((p) => p.isObserver).map((p) => p.id));

    const setups = gamePlayers.map((p) => ({
      id: p.id,
      name: p.name,
      factionId: p.factionId!,
    }));

    this.matchState = createInitialMatchState(setups, this.gameSeed);
    this.gamePhase = 'playing';

    // Reset turn flags for first active player
    this.resetTurnFlags(this.matchState.activePlayerId);

    const hasObserver = observerIds.size > 0;

    // Send each client their personalised GAME_STARTED
    this.clients.forEach((c) => {
      const playerId = this.sessionToPlayer.get(c.sessionId);
      if (!playerId) return;
      c.send('GAME_STARTED', {
        state: this.matchState,
        myPlayerId: playerId,
        isObserver: observerIds.has(playerId),
        hasObserver,
        jumpsUsed: 0,
        hasActed: false,
      });
    });

    console.log(`[GameRoom] Game started with ${setups.length} players, ${observerIds.size} observers, seed=${this.gameSeed}`);
  }

  // ── In-game handlers ────────────────────────────────────────────────────────

  private getHasObserver(): boolean {
    return [...this.lobbyPlayers.values()].some((p) => p.isObserver);
  }

  private handleGameMessage(
    client: Client,
    playerId: string,
    type: string,
    msg: Record<string, unknown>,
  ) {
    // Observers and late joiners who aren't in matchState cannot send game actions
    const isPlayerInGame = this.matchState?.players.some((p) => p.id === playerId) ?? false;
    if (!isPlayerInGame) return;

    const state = this.matchState!;
    const flags = this.turnFlags.get(playerId) ?? { jumpsUsed: 0, hasActed: false };

    // BUILD_CHANGE is allowed any time at a station, not turn-locked
    if (type === 'BUILD_CHANGE') {
      this.handleBuildChange(client, playerId, msg);
      return;
    }

    // All other actions require it to be this player's turn
    if (state.activePlayerId !== playerId) {
      client.send('ERROR', { message: 'Not your turn' });
      return;
    }

    switch (type) {
      case 'JUMP': {
        const targetSystemId = msg.targetSystemId as number;
        const player = state.players.find((p) => p.id === playerId)!;
        const maxJumps = deriveStats(player.build, PARTS, player.factionId).range;
        const r = canJump(state, playerId, targetSystemId, flags.jumpsUsed, maxJumps);
        if (!r.ok) { client.send('ERROR', { message: r.reason }); return; }
        this.matchState = doJump(state, playerId, targetSystemId);
        flags.jumpsUsed++;
        this.turnFlags.set(playerId, flags);
        this.broadcastState();
        break;
      }

      case 'ATTACK': {
        if (flags.hasActed) { client.send('ERROR', { message: 'Already acted this turn' }); return; }
        const targetPlayerId = msg.targetPlayerId as string;
        const attacker = state.players.find((p) => p.id === playerId);
        const defender = state.players.find((p) => p.id === targetPlayerId);
        if (!attacker || !defender) { client.send('ERROR', { message: 'Player not found' }); return; }
        if (attacker.systemId !== defender.systemId) {
          client.send('ERROR', { message: 'Target not in same system' });
          return;
        }

        const combatResult: CombatResult = runCombat(
          attacker.build,
          defender.build,
          attacker.factionId,
          defender.factionId,
          this.gameSeed + state.cycle * 1000,
          attacker.crew,
          defender.crew,
        );

        const playerWon = combatResult.winner === 'A';
        const loser = playerWon ? defender : attacker;
        const winner = playerWon ? attacker : defender;

        const lootRng = mulberry32(this.gameSeed + state.cycle * 1000 + 777);
        const boardingLoot = rollBoardingLoot(loser, lootRng);
        this.matchState = doApplyBoardingLoot(state, winner.id, loser.id, boardingLoot);
        flags.hasActed = true;
        this.turnFlags.set(playerId, flags);

        this.broadcast('COMBAT_RESULT', {
          result: combatResult,
          attackerId: playerId,
          defenderId: targetPlayerId,
          boardingLoot,
          state: this.matchState,
          jumpsUsed: flags.jumpsUsed,
          hasActed: flags.hasActed,
          hasObserver: this.getHasObserver(),
        });
        break;
      }

      case 'CLAIM_ARTIFACT': {
        if (flags.hasActed) { client.send('ERROR', { message: 'Already acted this turn' }); return; }
        const r = canClaimArtifact(state, playerId);
        if (!r.ok) { client.send('ERROR', { message: r.reason }); return; }
        this.matchState = doClaimArtifact(state, playerId);
        flags.hasActed = true;
        this.turnFlags.set(playerId, flags);
        this.broadcastState();
        break;
      }

      case 'BUY_GOOD': {
        const { good, qty } = msg as { good: GoodId; qty: number };
        const player = state.players.find((p) => p.id === playerId)!;
        const stats = deriveStats(player.build, PARTS);
        const r = canBuyGood(state, playerId, good, qty, stats.cargo);
        if (!r.ok) { client.send('ERROR', { message: r.reason }); return; }
        this.matchState = doBuyGood(state, playerId, good, qty);
        this.broadcastState();
        break;
      }

      case 'SELL_GOOD': {
        const { good, qty } = msg as { good: GoodId; qty: number };
        const r = canSellGood(state, playerId, good, qty);
        if (!r.ok) { client.send('ERROR', { message: r.reason }); return; }
        this.matchState = doSellGood(state, playerId, good, qty);
        this.broadcastState();
        break;
      }

      case 'REFUEL': {
        const amount = msg.amount as number;
        const r = canRefuel(state, playerId, amount);
        if (!r.ok) { client.send('ERROR', { message: r.reason }); return; }
        this.matchState = doRefuel(state, playerId, amount);
        this.broadcastState();
        break;
      }

      case 'BUY_MODULE': {
        const partId = msg.partId as string;
        const r = canBuyModule(state, playerId, partId);
        if (!r.ok) { client.send('ERROR', { message: r.reason }); return; }
        this.matchState = doBuyModule(state, playerId, partId);
        this.broadcastState();
        break;
      }

      case 'SELL_MODULE': {
        const partId = msg.partId as string;
        const r = canSellModule(state, playerId, partId);
        if (!r.ok) { client.send('ERROR', { message: r.reason }); return; }
        this.matchState = doSellModule(state, playerId, partId);
        this.broadcastState();
        break;
      }

      case 'HIRE_CREW': {
        const { slot, crewId, cost } = msg as { slot: number; crewId: CrewId | null; cost: number };
        if (cost > 0) {
          const r = canHireCrew(state, playerId, cost);
          if (!r.ok) { client.send('ERROR', { message: r.reason }); return; }
          // Validate crew is available at this station
          const player = state.players.find(p => p.id === playerId)!;
          const sys = state.galaxy.systems[player.systemId];
          if (crewId && !sys.stationCrew.includes(crewId)) {
            client.send('ERROR', { message: 'Crew not available at this station' });
            return;
          }
        }
        this.matchState = doHireCrew(state, playerId, slot, crewId, cost);
        this.broadcastState();
        break;
      }

      case 'EMERGENCY_SIGNAL': {
        const r = canEmergencySignal(state, playerId, flags.jumpsUsed);
        if (!r.ok) { client.send('ERROR', { message: r.reason }); return; }
        this.matchState = doEmergencySignal(state, playerId);
        this.matchState = doEndTurn(this.matchState);
        const nextPlayerIdEmergency = this.matchState.activePlayerId;
        this.resetTurnFlags(nextPlayerIdEmergency);
        const nextFlagsEmergency = this.turnFlags.get(nextPlayerIdEmergency)!;
        this.broadcast('STATE_UPDATE', {
          state: this.matchState,
          jumpsUsed: nextFlagsEmergency.jumpsUsed,
          hasActed: nextFlagsEmergency.hasActed,
          hasObserver: this.getHasObserver(),
        });
        break;
      }

      case 'END_TURN': {
        this.matchState = doEndTurn(state);
        const nextPlayerId = this.matchState.activePlayerId;
        this.resetTurnFlags(nextPlayerId);

        const nextFlags = this.turnFlags.get(nextPlayerId)!;
        this.broadcast('STATE_UPDATE', {
          state: this.matchState,
          jumpsUsed: nextFlags.jumpsUsed,
          hasActed: nextFlags.hasActed,
        });
        break;
      }

      default:
        client.send('ERROR', { message: `Unknown message type: ${type}` });
    }
  }

  private handleBuildChange(client: Client, playerId: string, msg: Record<string, unknown>) {
    const state = this.matchState!;
    const player = state.players.find((p) => p.id === playerId);
    if (!player) return;

    // Only allow build changes at a station
    if (!state.galaxy.systems[player.systemId].hasStation) {
      client.send('ERROR', { message: 'Must be at a station to modify build' });
      return;
    }

    const { slotIndex, partId, fromSlot } = msg as { slotIndex: number; partId: string | null; fromSlot?: number };
    this.matchState = doChangeBuildSlot(state, playerId, slotIndex, partId, fromSlot);
    this.broadcastState();
  }

  // ── Broadcast helpers ───────────────────────────────────────────────────────

  private broadcastLobby() {
    const players = [...this.lobbyPlayers.values()];
    this.broadcast('LOBBY_UPDATE', {
      roomId: this.roomId,
      players,
      hostId: this.sessionToPlayer.get(this.hostSessionId) ?? '',
    });
  }

  private broadcastState() {
    if (!this.matchState) return;
    const activePlayerId = this.matchState.activePlayerId;
    const flags = this.turnFlags.get(activePlayerId) ?? { jumpsUsed: 0, hasActed: false };
    this.broadcast('STATE_UPDATE', {
      state: this.matchState,
      jumpsUsed: flags.jumpsUsed,
      hasActed: flags.hasActed,
      hasObserver: this.getHasObserver(),
    });

    // Check if game is over
    if (this.matchState.winnerId) {
      this.gamePhase = 'ended';
    }
  }

  private resetTurnFlags(playerId: string) {
    this.turnFlags.set(playerId, { jumpsUsed: 0, hasActed: false });
  }

  private getTurnFlagsForPlayer(playerId: string): TurnFlags {
    return this.turnFlags.get(playerId) ?? { jumpsUsed: 0, hasActed: false };
  }
}
