import React from 'react';
import { useGameStore } from '../store';
import type { GameView } from '@stellar-dominion/shared';

const NAV_ITEMS: { view: GameView; label: string; icon: React.ReactNode }[] = [
  {
    view: 'map',
    label: 'MAP',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
        <circle cx="6" cy="7" r="1.6" />
        <circle cx="18" cy="9" r="1.6" />
        <circle cx="11" cy="17" r="1.6" />
        <path d="M7 8 L17 9 M9 16 L7 9 M12 16 L17 10" />
      </svg>
    ),
  },
  {
    view: 'yard',
    label: 'SHIPYARD',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
        <path d="M12 3 L16 11 L12 9 L8 11 Z" />
        <rect x="8" y="11" width="8" height="7" />
        <path d="M9 18 L7 21 M15 18 L17 21" />
      </svg>
    ),
  },
  {
    view: 'fight',
    label: 'COMBAT',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
        <path d="M4 13 L11 6 L14 9 L7 16 Z" />
        <path d="M14 9 L20 4 M13 14 L18 19" />
      </svg>
    ),
  },
];

export function NavRail() {
  const { activeView, setView } = useGameStore();

  return (
    <nav className="nav-rail">
      <div className="nav-crest">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="20" height="20">
          <path d="M12 2 L20 12 L12 22 L4 12 Z" />
          <circle cx="12" cy="12" r="3" />
        </svg>
      </div>

      {NAV_ITEMS.map((item) => (
        <button
          key={item.view}
          className={`nav-btn ${activeView === item.view ? 'active' : ''}`}
          onClick={() => setView(item.view)}
          title={item.label}
        >
          {item.icon}
          <span className="nav-label">{item.label}</span>
        </button>
      ))}

      <div className="nav-spacer" />
    </nav>
  );
}
