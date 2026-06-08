import React from 'react';
import { HUD } from './HUD';
import { ActBar } from './ActBar';
import { MapPanel } from './MapPanel';
import { StationModal } from './StationModal';
import { WinOverlay } from './WinOverlay';
import { MapView } from '../views/MapView';
import { ShipyardView } from '../views/ShipyardView';
import { CombatView } from '../views/CombatView';
import { useGameStore } from '../store';

export function GameLayout() {
  const { activeView, matchState, myPlayerId } = useGameStore();
  const isMyTurn = matchState?.activePlayerId === myPlayerId;

  return (
    <div className="game-layout">
      <div className={`screen${isMyTurn ? ' my-turn' : ''}`}>
        <div className="main-area">
          <HUD />
          <div className="game-body">
            <div className="canvas-area">
              <div className="stage">
                <div className={`view ${activeView === 'map' ? '' : 'hidden'}`}>
                  <MapView />
                </div>
                <div className={`view ${activeView === 'yard' ? '' : 'hidden'}`}>
                  <ShipyardView />
                </div>
                <div className={`view ${activeView === 'fight' ? '' : 'hidden'}`}>
                  <CombatView />
                </div>
              </div>
              <ActBar />
            </div>
            {activeView === 'map' && <MapPanel />}
          </div>
        </div>
      </div>

      {/* Station overlay rendered outside the main flow so it floats above everything */}
      <StationModal />

      {/* Win overlay — shown when a winner is set */}
      <WinOverlay />
    </div>
  );
}
