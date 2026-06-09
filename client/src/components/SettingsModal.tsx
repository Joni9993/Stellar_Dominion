import React from 'react';
import { useGameStore } from '../store';

interface Props {
  onClose: () => void;
}

export function SettingsModal({ onClose }: Props) {
  const leaveGame = useGameStore((s) => s.leaveGame);

  function handleLeave() {
    if (!confirm('Leave the current game and return to the main menu?')) return;
    leaveGame();
    onClose();
  }

  return (
    <div className="target-modal-backdrop" onClick={onClose}>
      <div className="settings-modal" onClick={(e) => e.stopPropagation()}>
        <div className="settings-modal-header">
          <span>SETTINGS</span>
          <button className="hud-rules-btn" style={{ fontSize: 10 }} onClick={onClose}>✕</button>
        </div>
        <div className="settings-modal-body">
          <button className="settings-leave-btn" onClick={handleLeave}>
            ← LEAVE GAME
          </button>
        </div>
      </div>
    </div>
  );
}
