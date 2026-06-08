import React, { useState } from 'react';
import { useGameStore } from '../store';
import { FACTIONS, FACTION_IDS } from '@stellar-dominion/shared';
import type { FactionId } from '@stellar-dominion/shared';
import { TourOverlay } from '../components/TourOverlay';

export function LobbyView() {
  const {
    lobbyState,
    connectionMode,
    createOnlineRoom,
    joinOnlineRoom,
    setFaction,
    startOnlineGame,
  } = useGameStore();

  const [joinCode, setJoinCode] = useState('');
  const [playerName, setPlayerName] = useState('COMMANDER');
  const [screen, setScreen] = useState<'home' | 'create' | 'join' | 'lobby'>('home');
  const [tourOpen, setTourOpen] = useState(false);

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

            <div className="lobby-btn-group">
              <button
                className="btn primary large"
                onClick={async () => {
                  await createOnlineRoom(playerName);
                  setScreen('lobby');
                }}
              >
                ▶ HOST GAME
              </button>
              <button className="btn secondary large" onClick={() => setScreen('join')}>
                → JOIN GAME
              </button>
              <button className="btn secondary large" style={{ opacity: 0.7, fontSize: 13 }} onClick={() => setTourOpen(true)}>
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
          <button
            className="btn primary large"
            disabled={!joinCode}
            onClick={async () => {
              await joinOnlineRoom(joinCode, playerName);
              setScreen('lobby');
            }}
          >
            JOIN
          </button>
          <button className="btn ghost" onClick={() => setScreen('home')}>← BACK</button>
        </div>
      </div>
    );
  }

  // ── Online lobby ───────────────────────────────────────────────────────────
  if (lobbyState) {
    const myPlayerId = useGameStore.getState().myPlayerId;
    const me = lobbyState.players.find((p) => p.id === myPlayerId);
    const isHost = lobbyState.isHost;
    const allPickedFaction = lobbyState.players.every((p) => p.factionId !== null);

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
            {lobbyState.players.map((p) => (
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
          </div>

          {/* Faction picker for me */}
          {me && (
            <div className="lobby-faction-picker">
              <div className="lobby-label">CHOOSE YOUR FACTION</div>
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

          {/* Start button (host only) */}
          {isHost && (
            <button
              className="btn primary large"
              disabled={!allPickedFaction || lobbyState.players.length < 2}
              onClick={startOnlineGame}
            >
              {lobbyState.players.length < 2
                ? 'WAITING FOR PLAYERS…'
                : !allPickedFaction
                ? 'ALL PLAYERS MUST PICK FACTION'
                : '▶ START GAME'}
            </button>
          )}
          {!isHost && (
            <div className="lobby-hint">Waiting for host to start…</div>
          )}
        </div>
      </div>
    );
  }

  return null;
}
