import React, { useState, useEffect } from 'react';
import { useGameStore, getSavedGameSummary, type GameSummary } from '../store';
import { FACTIONS, FACTION_IDS } from '@stellar-dominion/shared';
import type { FactionId } from '@stellar-dominion/shared';
import { TourOverlay } from '../components/TourOverlay';

export function LobbyView() {
  const {
    lobbyState,
    createOnlineRoom,
    joinOnlineRoom,
    setFaction,
    setObserver,
    startOnlineGame,
    attemptReconnect,
    isReconnecting,
  } = useGameStore();

  const [savedGame, setSavedGame] = useState<GameSummary | null>(null);

  useEffect(() => {
    setSavedGame(getSavedGameSummary());
  }, []);

  const [joinCode, setJoinCode] = useState('');
  const [playerName, setPlayerName] = useState('COMMANDER');
  const [screen, setScreen] = useState<'home' | 'join' | 'lobby'>('home');
  const [tourOpen, setTourOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleHost() {
    setLoading(true);
    setError(null);
    try {
      await createOnlineRoom(playerName);
      setScreen('lobby');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not connect to server.');
    } finally {
      setLoading(false);
    }
  }

  async function handleJoin() {
    setLoading(true);
    setError(null);
    try {
      await joinOnlineRoom(joinCode, playerName);
      setScreen('lobby');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Room not found or server unreachable.');
    } finally {
      setLoading(false);
    }
  }

  // ── Home screen ────────────────────────────────────────────────────────────
  if (screen === 'home') {
    return (
      <>
        <div className="lobby-root">
          <div className="lobby-card">
            <div className="lobby-title">STELLAR DOMINION</div>
            <div className="lobby-subtitle">MULTIPLAYER · 2–6 COMMANDERS</div>

            <div className="lobby-name-row">
              <label className="lobby-label">COMMANDER NAME</label>
              <input
                className="lobby-input"
                value={playerName}
                maxLength={16}
                onChange={(e) => setPlayerName(e.target.value.toUpperCase())}
              />
            </div>

            {savedGame && (
              <ResumeCard
                summary={savedGame}
                loading={isReconnecting}
                onResume={() => attemptReconnect()}
              />
            )}

            {error && <div className="lobby-error">{error}</div>}

            <div className="lobby-btn-group">
              <button
                className="btn primary large"
                disabled={loading || !playerName.trim()}
                onClick={handleHost}
              >
                {loading ? '…CONNECTING' : '▶ HOST GAME'}
              </button>
              <button
                className="btn secondary large"
                disabled={loading}
                onClick={() => { setError(null); setScreen('join'); }}
              >
                → JOIN GAME
              </button>
              <button
                className="btn secondary large"
                style={{ opacity: 0.7, fontSize: 13 }}
                onClick={() => setTourOpen(true)}
              >
                ? QUICK GUIDE
              </button>
            </div>
          </div>
        </div>
        {tourOpen && <TourOverlay onClose={() => setTourOpen(false)} />}
      </>
    );
  }

  // ── Join screen ────────────────────────────────────────────────────────────
  if (screen === 'join') {
    return (
      <div className="lobby-root">
        <div className="lobby-card">
          <div className="lobby-title">JOIN GAME</div>
          <div className="lobby-name-row">
            <label className="lobby-label">ROOM CODE</label>
            <input
              className="lobby-input"
              value={joinCode}
              placeholder="PASTE CODE HERE"
              onChange={(e) => setJoinCode(e.target.value.trim())}
            />
          </div>

          {error && <div className="lobby-error">{error}</div>}

          <button
            className="btn primary large"
            disabled={!joinCode || loading}
            onClick={handleJoin}
          >
            {loading ? '…CONNECTING' : 'JOIN'}
          </button>
          <button className="btn ghost" disabled={loading} onClick={() => { setError(null); setScreen('home'); }}>
            ← BACK
          </button>
        </div>
      </div>
    );
  }

  // ── Online lobby ───────────────────────────────────────────────────────────
  if (lobbyState) {
    const myPlayerId = useGameStore.getState().myPlayerId;
    const me = lobbyState.players.find((p) => p.id === myPlayerId);
    const isHost = lobbyState.isHost;
    const gamePlayers = lobbyState.players.filter((p) => !p.isObserver);
    const observers = lobbyState.players.filter((p) => p.isObserver);
    const allPickedFaction = gamePlayers.every((p) => p.factionId !== null);
    const iAmObserver = me?.isObserver === true;

    return (
      <div className="lobby-root">
        <div className="lobby-card wide">
          <div className="lobby-title">LOBBY</div>
          <div className="lobby-room-code">
            ROOM CODE: <span className="lobby-code-value">{lobbyState.roomId}</span>
            <button
              className="btn ghost small"
              onClick={() => navigator.clipboard.writeText(lobbyState.roomId)}
            >
              COPY
            </button>
          </div>

          {/* Player list */}
          <div className="lobby-players">
            {gamePlayers.map((p) => (
              <div key={p.id} className={`lobby-player-row ${p.id === myPlayerId ? 'me' : ''}`}>
                <span className="lobby-player-name">{p.name}{p.isHost ? ' ★' : ''}</span>
                {p.factionId ? (
                  <span className="lobby-faction-badge" style={{ color: FACTIONS[p.factionId].color }}>
                    {FACTIONS[p.factionId].name}
                  </span>
                ) : (
                  <span className="lobby-faction-badge empty">— picking —</span>
                )}
              </div>
            ))}
            {observers.map((p) => (
              <div key={p.id} className={`lobby-player-row observer-row ${p.id === myPlayerId ? 'me' : ''}`}>
                <span className="lobby-player-name">{p.name}</span>
                <span className="lobby-faction-badge" style={{ color: 'var(--dim)' }}>◉ OBSERVER</span>
              </div>
            ))}
          </div>

          {/* Faction picker or observer status for me */}
          {me && !iAmObserver && (
            <div className="lobby-faction-picker">
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
                <div className="lobby-label" style={{ margin: 0 }}>CHOOSE YOUR FACTION</div>
                <button
                  className="btn ghost small"
                  style={{ fontSize: 10, letterSpacing: 0.5, whiteSpace: 'nowrap' }}
                  onClick={setObserver}
                >
                  ◉ OBSERVER MODE
                </button>
              </div>
              <div className="lobby-faction-grid">
                {FACTION_IDS.map((id) => {
                  const taken = lobbyState.players.some((p) => p.factionId === id && p.id !== myPlayerId);
                  const selected = me.factionId === id;
                  return (
                    <button
                      key={id}
                      disabled={taken}
                      className={`lobby-faction-btn ${selected ? 'selected' : ''} ${taken ? 'taken' : ''}`}
                      style={{ '--faction-color': FACTIONS[id].color } as React.CSSProperties}
                      onClick={() => setFaction(id as FactionId)}
                    >
                      <span className="lobby-faction-name">{FACTIONS[id].name}</span>
                      <span className="lobby-faction-sub">{FACTIONS[id].strengths.split('—')[0]?.trim()}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {me && iAmObserver && (
            <div style={{
              background: 'var(--panel3)', border: '1px dashed var(--dim)',
              padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 12,
            }}>
              <span style={{ color: 'var(--dim)', fontSize: 18 }}>◉</span>
              <div>
                <div style={{ fontFamily: "'Press Start 2P'", fontSize: 8, color: 'var(--dim)' }}>OBSERVER MODE</div>
                <div style={{ fontSize: 12, color: 'var(--faint)', marginTop: 4 }}>
                  No faction — you will see the full map and all battles
                </div>
              </div>
            </div>
          )}

          {/* Start button (host only) */}
          {isHost && (
            <button
              className="btn primary large"
              disabled={!allPickedFaction || gamePlayers.length < 2}
              onClick={startOnlineGame}
            >
              {gamePlayers.length < 2
                ? 'WAITING FOR PLAYERS…'
                : !allPickedFaction
                ? 'ALL PLAYERS MUST PICK FACTION'
                : '▶ START GAME'}
            </button>
          )}
          {!isHost && (
            <div className="lobby-hint">{iAmObserver ? 'Waiting for host to start the game…' : 'Waiting for host to start…'}</div>
          )}
        </div>
      </div>
    );
  }

  return null;
}

// ── Resume Game Card ──────────────────────────────────────────────────────────

function ResumeCard({ summary, loading, onResume }: { summary: GameSummary; loading: boolean; onResume: () => void }) {
  const activePlayer = summary.players.find((p) => p.id === summary.activePlayerId);
  const isMyTurn = summary.activePlayerId === summary.myPlayerId;
  const factionColor = activePlayer ? (FACTIONS[activePlayer.factionId as FactionId]?.color ?? '#4ecdc4') : '#4ecdc4';

  return (
    <div className="resume-card">
      <div className="resume-card-header">ACTIVE GAME</div>
      <div className="resume-card-info">
        <span className="resume-card-cycle">CYC {summary.cycle}/{summary.maxCycles}</span>
        <span
          className="resume-card-turn"
          style={{ color: isMyTurn ? 'var(--green)' : factionColor }}
        >
          {isMyTurn ? '▶ YOUR TURN' : `Waiting for ${activePlayer?.name ?? '?'}`}
        </span>
      </div>
      <div className="resume-card-players">
        {summary.players.map((p) => {
          const fc = FACTIONS[p.factionId as FactionId];
          return (
            <span
              key={p.id}
              className="resume-card-player"
              style={{ color: p.id === summary.activePlayerId ? (fc?.color ?? '#e9e3d4') : 'var(--dim)' }}
            >
              {p.id === summary.activePlayerId ? '▲ ' : ''}{p.name}
            </span>
          );
        })}
      </div>
      <button
        className="btn primary large"
        disabled={loading}
        onClick={onResume}
      >
        {loading ? '…RECONNECTING' : '↩ RESUME GAME'}
      </button>
    </div>
  );
}
