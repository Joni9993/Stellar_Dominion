import React, { useState } from 'react';
import { useGameStore, selectMyPlayer, selectCurrentSystem } from '../store';
import { FACTIONS, PARTS, deriveStats, getCargoTotal } from '@stellar-dominion/shared';
import { RulesModal } from './RulesModal';
import { SettingsModal } from './SettingsModal';

export function HUD() {
  const store = useGameStore();
  const { matchState, jumpsUsed, hasActed } = store;
  const [rulesOpen, setRulesOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const player = selectMyPlayer(store);
  const sys = selectCurrentSystem(store);
  const faction = player ? FACTIONS[player.factionId] : null;

  const phase = matchState?.phase ?? 'move';
  const cycle = matchState?.cycle ?? 1;
  const maxCycles = matchState?.maxCycles ?? 20;
  const maxJumps = player ? deriveStats(player.build, PARTS, player.factionId).range : 1;
  const jumpsLeft = maxJumps - jumpsUsed;
  const stats = player ? deriveStats(player.build, PARTS, player.factionId) : null;
  const usedCargo = player ? getCargoTotal(player) : 0;
  const maxCargo = stats?.cargo ?? 0;

  return (
    <>
    <header className="hud">
      <span className="hud-faction" style={{ color: faction?.color ?? 'var(--teal)' }}>
        {faction?.fullName?.toUpperCase() ?? '—'}
      </span>
      <span className="hud-location">
        POS <b>{sys?.name ?? '—'}</b>
      </span>
      <span className="hud-phase" style={{ color: jumpsLeft > 0 ? 'var(--green)' : 'var(--dim)' }}>
        {phase === 'move'
          ? (maxJumps > 1 ? `MOVE ${jumpsLeft}/${maxJumps}` : (jumpsLeft > 0 ? 'MOVE' : 'MOVED'))
          : 'ACTION'}
      </span>
      <span style={{ color: 'var(--dim)', fontSize: 14 }}>CYC {cycle}/{maxCycles}</span>
      <button className="hud-rules-btn" onClick={() => setRulesOpen(true)} title="Rules of the Galaxy">?</button>
      <button className="hud-rules-btn" onClick={() => setSettingsOpen(true)} title="Settings">⚙</button>
      <div className="hud-resources">
        <span className="hud-res"><i className="res-dot credits" />{player?.credits ?? 0}◈ <span style={{ color: 'var(--dim)', fontSize: 11 }}>CREDITS</span></span>
        <span className="hud-res"><i className="res-dot fuel" />{player?.fuel ?? 0}/{player?.maxFuel ?? 100} <span style={{ color: 'var(--dim)', fontSize: 11 }}>FUEL</span></span>
        <span className="hud-res"><i className="res-dot cargo" />{usedCargo}/{maxCargo} <span style={{ color: 'var(--dim)', fontSize: 11 }}>CARGO</span></span>
        <span className="hud-res"><i className="res-dot artifact" />{player?.artifacts.length ?? 0} ART</span>
      </div>
    </header>
    {rulesOpen && <RulesModal onClose={() => setRulesOpen(false)} />}
    {settingsOpen && <SettingsModal onClose={() => setSettingsOpen(false)} />}
    </>
  );
}
