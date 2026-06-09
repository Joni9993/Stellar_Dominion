import React, { useEffect, useState } from 'react';
import { GameLayout } from './GameLayout';
import { useGameStore } from '../store';

const ANN_COLORS = ['var(--teal)', 'var(--amber)', 'var(--red)', 'var(--purple)'] as const;

function Dot({ n, style }: { n: number; style: React.CSSProperties }) {
  return (
    <div style={{
      position: 'absolute',
      width: 22, height: 22, borderRadius: '50%',
      background: ANN_COLORS[n - 1], color: '#0c1018',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: 11, fontFamily: "'Press Start 2P'",
      lineHeight: 1, zIndex: 30, pointerEvents: 'none',
      boxShadow: '0 0 0 2px rgba(0,0,0,0.7), 0 2px 8px rgba(0,0,0,0.5)',
      ...style,
    }}>{n}</div>
  );
}

// ── Step configuration ────────────────────────────────────────────────────────

type Setup = 'map' | 'map-deselect' | 'map-rumor' | 'yard' | 'station' | 'combat' | 'map-close-station';

interface InstructionStep {
  screen: string;
  title: string;
  setup: Setup;
  dots: { n: number; style: React.CSSProperties }[];
  annotations: { label: string; detail: string }[];
}

const STEPS: InstructionStep[] = [
  {
    screen: 'HUD',
    title: 'Your Command Strip',
    setup: 'map-deselect',
    dots: [
      { n: 1, style: { top: 6, left: 8 } },
      { n: 2, style: { top: 6, left: 175 } },
      { n: 3, style: { top: 6, left: 260 } },
      { n: 4, style: { top: 6, right: 8 } },
    ],
    annotations: [
      { label: 'Faction & Location', detail: 'Your faction name and current system are always visible top-left.' },
      { label: 'Move Phase', detail: 'MOVE shows remaining jumps. Once used, the phase switches to ACTION.' },
      { label: 'Cycle Counter', detail: 'CYC tracks the current cycle out of 20. When cycles run out, most Artifacts wins.' },
      { label: 'Resources', detail: 'Credits ◈ for purchases · Fuel ⛽ for jumps · Cargo for trade goods · ART for Artifacts held.' },
    ],
  },
  {
    screen: 'STAR MAP',
    title: 'The Galaxy',
    setup: 'map-deselect',
    dots: [
      { n: 1, style: { top: '30%', left: '28%' } },
      { n: 2, style: { top: '18%', left: '48%' } },
      { n: 3, style: { top: '42%', right: 220 } },
      { n: 4, style: { top: '22%', left: '12%' } },
    ],
    annotations: [
      { label: 'Star Systems', detail: 'Tap any system node to open its panel and see available actions.' },
      { label: 'Rumored Artifact', detail: 'The glowing amber node is the active Rumor target — everyone converges on it.' },
      { label: 'Rival Ships', detail: 'Colored triangles are enemy commanders. Tap their system to scout or attack.' },
      { label: 'Jump Lanes', detail: 'Lines between systems are jump lanes. You can only jump to directly connected systems.' },
    ],
  },
  {
    screen: 'SYSTEM PANEL',
    title: 'System Actions',
    setup: 'map-rumor',
    dots: [
      { n: 1, style: { top: '35%', right: 100 } },
      { n: 2, style: { top: '50%', right: 100 } },
      { n: 3, style: { top: '65%', right: 100 } },
      { n: 4, style: { top: '10%', right: 105 } },
    ],
    annotations: [
      { label: 'JUMP HERE', detail: 'Moves your ship to this system. Costs fuel — check your tank before a long route.' },
      { label: 'CLAIM ARTIFACT', detail: 'Appears at the Rumored Artifact system. Costs credits. You must be physically in that system.' },
      { label: 'ATTACK', detail: 'Visible when a rival is in the same system. Winner loots a module, artifact, or credits.' },
      { label: 'System Info', detail: 'Station status, jump cost, market goods, fuel price, and any rivals currently docked.' },
    ],
  },
  {
    screen: 'SHIPYARD',
    title: 'Build Your Ship',
    setup: 'yard',
    dots: [
      { n: 1, style: { top: '40%', left: '45%' } },
      { n: 2, style: { top: '20%', left: 30 } },
      { n: 3, style: { top: '65%', left: 30 } },
      { n: 4, style: { top: '20%', right: 20 } },
    ],
    annotations: [
      { label: '3×3 Grid', detail: '9 slots for your loadout. Tap a part in the palette, then tap a slot to place it.' },
      { label: 'Weapon Palette', detail: 'Lists all modules in your inventory. Tap to select, then tap the grid to place or swap.' },
      { label: 'Artifacts in Grid', detail: 'Claimed Artifacts must be placed here to activate their combat effect.' },
      { label: 'Ship Stats', detail: 'Hull, DPS, shields, and range update live as you change the grid.' },
    ],
  },
  {
    screen: 'STATION',
    title: 'Station Services',
    setup: 'station',
    dots: [
      { n: 1, style: { top: 80, left: '12%' } },
      { n: 2, style: { top: 80, left: '37%' } },
      { n: 3, style: { top: 80, left: '62%' } },
      { n: 4, style: { top: 80, left: '87%' } },
    ],
    annotations: [
      { label: 'MARKET', detail: 'Buy trade goods cheap here, sell them at a distant station that pays more. Main income source.' },
      { label: 'FUEL', detail: 'Refuel your ship. Without fuel you cannot jump — always keep enough for a return trip.' },
      { label: 'CREW', detail: 'Hire crew for passive bonuses: Trader raises sell prices, Navigator increases range, Gunner improves DPS.' },
      { label: 'MODULES', detail: 'Buy new ship modules. Sell unused ones here for 50% of their buy price.' },
    ],
  },
  {
    screen: 'COMBAT',
    title: 'Auto-Battle',
    setup: 'combat',
    dots: [
      { n: 1, style: { top: '30%', left: '8%' } },
      { n: 2, style: { top: '30%', right: '8%' } },
      { n: 3, style: { top: '30%', left: '42%' } },
      { n: 4, style: { top: '65%', left: '8%' } },
    ],
    annotations: [
      { label: 'Your Ship', detail: 'Left side is yours. Both ships fire automatically — your build determines the outcome.' },
      { label: 'Enemy Ship', detail: 'Right side is the opponent. Use the commander button on the System Panel to inspect their build.' },
      { label: 'Weapon Effects', detail: 'The center shows active weapons and RPS multipliers. Laser ×2.0 vs Shields · Railgun ×1.5 vs Armor.' },
      { label: 'Hull & Shield', detail: 'Shields absorb hits first and regenerate each tick. Hull HP at 0 = defeat. Winner loots the loser.' },
    ],
  },
  {
    screen: 'ACTION BAR',
    title: 'Your Turn',
    setup: 'map-close-station',
    dots: [
      { n: 1, style: { bottom: 6, left: '5%' } },
      { n: 2, style: { bottom: 6, left: '38%' } },
      { n: 3, style: { bottom: 6, right: '5%' } },
      { n: 4, style: { top: 6, left: '30%' } },
    ],
    annotations: [
      { label: 'END TURN', detail: 'Ends your turn and passes to the next player. Their screen glows amber. You cannot undo this.' },
      { label: 'STATION', detail: 'Opens the station dock if your current system has one. Pulses when available here.' },
      { label: 'Navigate Views', detail: 'Switch between Star Map, Shipyard, and back. Changing your build costs no action.' },
      { label: 'MOVE → ACTION', detail: 'The phase indicator shows whether you can still jump (MOVE) or are in the action phase.' },
    ],
  },
];

// ── InstructionsOverlay ───────────────────────────────────────────────────────

export function InstructionsOverlay() {
  const [step, setStep] = useState(0);
  const store = useGameStore();
  const { endTour, setView, selectSystem, openStation, closeStation, startCombat, matchState } = store;

  const cur = STEPS[step];
  const isFirst = step === 0;
  const isLast = step === STEPS.length - 1;

  useEffect(() => {
    const rumorSysId = matchState?.rumor?.systemId;
    switch (cur.setup) {
      case 'map':
      case 'map-deselect':
        setView('map');
        break;
      case 'map-rumor':
        setView('map');
        if (rumorSysId !== undefined) selectSystem(rumorSysId);
        break;
      case 'yard':
        closeStation();
        setView('yard');
        break;
      case 'station':
        setView('map');
        openStation();
        break;
      case 'combat':
        closeStation();
        startCombat();
        break;
      case 'map-close-station':
        closeStation();
        setView('map');
        break;
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step]);

  function advance() {
    if (isLast) endTour();
    else setStep(s => s + 1);
  }

  return (
    <div
      className="inst-overlay"
      tabIndex={-1}
      onKeyDown={e => {
        if (e.key === 'ArrowRight' && !isLast) setStep(s => s + 1);
        if (e.key === 'ArrowLeft' && !isFirst) setStep(s => s - 1);
        if (e.key === 'Escape') endTour();
      }}
    >
      {/* Slim topbar — only shown in portrait */}
      <div className="inst-topbar">
        <span className="tour-screen-badge">{cur.screen}</span>
        <span className="inst-title-badge">{cur.title}</span>
        <span className="tour-step-count">{step + 1} / {STEPS.length}</span>
        <button className="station-close" onClick={endTour}>✕</button>
      </div>

      {/* Full game area — NOT clickable to advance */}
      <div className="inst-game">
        <GameLayout />

        {/* Dots over the real UI */}
        {cur.dots.map(({ n, style }) => <Dot key={n} n={n} style={style} />)}

        {/* Annotation panel — floats over the bottom of the game */}
        <div className="inst-panel">
          {/* Landscape-only header (portrait header is above) */}
          <div className="inst-panel-header">
            <span className="tour-screen-badge">{cur.screen}</span>
            <span className="inst-title-badge" style={{ maxWidth: 'none' }}>{cur.title}</span>
            <span className="tour-step-count">{step + 1}/{STEPS.length}</span>
            <button className="station-close" onClick={endTour}>✕</button>
          </div>

          <div className="inst-ann-list">
            {cur.annotations.map((ann, i) => (
              <div key={i} className="tour-ann-row">
                <div className="tour-ann-num" style={{ background: ANN_COLORS[i] }}>{i + 1}</div>
                <div className="tour-ann-text"><b>{ann.label}</b> — {ann.detail}</div>
              </div>
            ))}
          </div>

          <div className="tour-nav">
            <button className="btn ghost" disabled={isFirst} onClick={() => setStep(s => s - 1)}>
              ← BACK
            </button>
            <div className="tour-nav-dots">
              {STEPS.map((_, i) => (
                <button
                  key={i}
                  className={`tour-nav-dot${i === step ? ' active' : ''}`}
                  onClick={() => setStep(i)}
                  title={STEPS[i].screen}
                />
              ))}
            </div>
            <button className="btn primary" onClick={advance}>
              {isLast ? 'DONE' : 'NEXT →'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
