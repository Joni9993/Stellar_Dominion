import React, { useEffect } from 'react';
import { GameLayout } from './components/GameLayout';
import { LobbyView } from './views/LobbyView';
import { ObserverView } from './views/ObserverView';
import { useGameStore } from './store';

class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { error: Error | null }
> {
  state = { error: null };
  static getDerivedStateFromError(error: Error) { return { error }; }
  render() {
    if (this.state.error) {
      const err = this.state.error as Error;
      return (
        <div style={{
          position: 'fixed', inset: 0, background: '#0c1018', color: '#e9e3d4',
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          fontFamily: 'VT323, monospace', padding: 32, gap: 16,
        }}>
          <div style={{ color: '#e8512e', fontSize: 22 }}>RENDER ERROR</div>
          <div style={{ color: '#8b96a6', fontSize: 14, maxWidth: 600, textAlign: 'center' }}>{err.message}</div>
          <pre style={{ color: '#586374', fontSize: 11, maxWidth: 700, overflow: 'auto' }}>{err.stack}</pre>
          <button
            style={{ marginTop: 16, padding: '8px 24px', background: 'transparent', border: '1px solid #e8512e', color: '#e9e3d4', fontFamily: 'inherit', fontSize: 16, cursor: 'pointer' }}
            onClick={() => window.location.reload()}
          >
            ↻ RELOAD
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

function ReconnectingScreen() {
  return (
    <div style={{
      position: 'fixed', inset: 0, background: '#0c1018', color: '#e9e3d4',
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      fontFamily: "'Press Start 2P', monospace", gap: 16,
    }}>
      <div style={{ fontSize: 14, color: 'var(--teal, #4ecdc4)', letterSpacing: 2 }}>RECONNECTING...</div>
      <div style={{ fontSize: 10, color: '#8b96a6' }}>Restoring connection to game</div>
    </div>
  );
}

function AppInner() {
  const matchState       = useGameStore((s) => s.matchState);
  const lobbyState       = useGameStore((s) => s.lobbyState);
  const isObserver       = useGameStore((s) => s.isObserver);
  const isReconnecting   = useGameStore((s) => s.isReconnecting);
  const attemptReconnect = useGameStore((s) => s.attemptReconnect);
  const colyseusRoom     = useGameStore((s) => s.colyseusRoom);

  useEffect(() => {
    if (!colyseusRoom) attemptReconnect();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (isReconnecting) return <ReconnectingScreen />;

  if (!matchState || lobbyState) {
    return <LobbyView />;
  }

  if (isObserver) {
    return <ObserverView />;
  }

  return <GameLayout />;
}

export default function App() {
  return (
    <ErrorBoundary>
      <AppInner />
    </ErrorBoundary>
  );
}
