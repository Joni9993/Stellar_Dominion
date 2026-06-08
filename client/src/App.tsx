import React from 'react';
import { GameLayout } from './components/GameLayout';
import { LobbyView } from './views/LobbyView';
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

function AppInner() {
  const matchState = useGameStore((s) => s.matchState);
  const lobbyState = useGameStore((s) => s.lobbyState);

  if (!matchState) {
    return <LobbyView />;
  }

  // lobbyState check: if we're in the online lobby waiting room, show lobby
  if (lobbyState) {
    return <LobbyView />;
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
