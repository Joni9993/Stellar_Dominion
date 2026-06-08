import React from 'react';
import { useGameStore, selectMyPlayer, selectCurrentSystem } from '../store';

export function ActBar() {
  const store = useGameStore();
  const { activeView, setView, endTurn, openStation } = store;
  const me = selectMyPlayer(store);
  const sys = selectCurrentSystem(store);

  if (activeView === 'map') {
    return (
      <div className="act-bar">
        <button className="end-turn" onClick={endTurn}>⟳ END TURN</button>
        <button
          className={sys?.hasStation && sys?.id === me?.systemId ? 'station-pulse' : ''}
          disabled={!sys?.hasStation || sys?.id !== me?.systemId}
          onClick={openStation}
          title={!sys?.hasStation ? 'No station here' : sys?.id !== me?.systemId ? 'Not your location' : ''}
        >
          ⇄ STATION
        </button>
        <button onClick={() => setView('yard')}>♟ SHIPYARD</button>
      </div>
    );
  }

  if (activeView === 'yard') {
    return (
      <div className="act-bar">
        <button onClick={() => setView('map')}>◄ MAP</button>
        <button className="end-turn">✓ SAVE BUILD</button>
      </div>
    );
  }

  if (activeView === 'fight') {
    return (
      <div className="act-bar">
        <button onClick={() => setView('map')}>◄ MAP</button>
        <button>↻ REPLAY</button>
      </div>
    );
  }

  return null;
}
