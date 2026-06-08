import React from 'react';
import { useGameStore } from '../store';
import { FACTIONS } from '@stellar-dominion/shared';

export function WinOverlay() {
  const { matchState, activeView } = useGameStore();
  if (!matchState?.winnerId) return null;
  // Don't interrupt the combat replay — wait until the player dismisses the fight view.
  if (activeView === 'fight') return null;

  const winner = matchState.players.find((p) => p.id === matchState.winnerId);
  const faction = winner ? FACTIONS[winner.factionId] : null;
  const isCycleLimitWin = matchState.cycle >= matchState.maxCycles;

  return (
    <div className="win-overlay">
      <div className="win-bg" />
      <div className="win-content">
        <div className="win-glow">STELLAR DOMINION</div>
        <div className="win-faction" style={{ color: faction?.color ?? 'var(--amber)' }}>
          {faction?.fullName?.toUpperCase() ?? 'UNKNOWN'}
        </div>
        <div className="win-title">CONTROLS THE GALAXY</div>
        <div className="win-sub">
          {isCycleLimitWin ? `Cycle limit reached — most artifacts wins` : `${matchState.winThreshold} Artifacts collected`}
        </div>
        <div className="win-stats">
          <div className="kv"><span>ARTIFACTS</span><b style={{ color: 'var(--purple)' }}>✦ {winner?.artifacts.length ?? 0}</b></div>
          <div className="kv"><span>CYCLES</span><b>{matchState.cycle} / {matchState.maxCycles}</b></div>
          <div className="kv"><span>CREDITS</span><b style={{ color: 'var(--amber)' }}>{winner?.credits ?? 0}◈</b></div>
        </div>
        <button className="btn primary" style={{ marginTop: 16 }} onClick={() => window.location.reload()}>
          ↻ NEW GAME
        </button>
      </div>
    </div>
  );
}
