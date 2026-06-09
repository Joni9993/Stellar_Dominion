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
  // Dots positioned over the real game area (position: absolute within .inst-game)
  // HUD is 34px tall at top; act-bar is 32px tall at bottom of canvas; side-panel is 208px from right
  dots: { n: number; style: React.CSSProperties }[];
  annotations: { label: string; detail: string }[];
}

const STEPS: InstructionStep[] = [
  {
    screen: 'HUD',
    title: 'Your Command Strip',
    setup: 'map-deselect',
    dots: [
      { n: 1, style: { top: 6, left: 8 } },          // faction name
      { n: 2, style: { top: 6, left: 175 } },         // MOVE counter
      { n: 3, style: { top: 6, left: 260 } },         // CYC
      { n: 4, style: { top: 6, right: 8 } },          // resources
    ],
    annotations: [
      { label: 'Faction & Location', detail: 'Your faction name and current system are always visible top-left.' },
      { label: 'Move Phase', detail: 'MOVE shows remaining jumps this turn. Once all jumps are used, the phase switches to ACTION.' },
      { label: 'Cycle Counter', detail: 'CYC shows the current cycle out of 20. When cycles run out, whoever holds the most Artifacts wins.' },
      { label: 'Resources', detail: 'Credits ◈ for purchases · Fuel ⛽ for jumps · Cargo for trade goods · ART for Artifacts held.' },
    ],
  },
  {
    screen: 'STAR MAP',
    title: 'The Galaxy',
    setup: 'map-deselect',
    dots: [
      { n: 1, style: { top: '30%', left: '28%' } },   // a system node area
      { n: 2, style: { top: '18%', left: '48%' } },   // roughly where rumor sits (system 4)
      { n: 3, style: { top: '42%', right: 220 } },    // rival ship area
      { n: 4, style: { top: '22%', left: '12%' } },   // jump lane area
    ],
    annotations: [
      { label: 'Star Systems', detail: 'Tap any system node to open its panel and see what actions are available there.' },
      { label: 'Rumored Artifact', detail: 'The glowing amber node is the active Rumor target. Only one exists at a time — everyone converges on it.' },
      { label: 'Rival Ships', detail: 'Colored triangles are enemy commanders. Tap their system to inspect their build or initiate combat.' },
      { label: 'Jump Lanes', detail: 'Lines between systems are jump lanes. You can only jump to directly connected systems per jump.' },
    ],
  },
  {
    screen: 'SYSTEM PANEL',
    title: 'System Actions',
    setup: 'map-rumor',
    dots: [
      { n: 1, style: { top: '35%', right: 100 } },   // JUMP HERE button
      { n: 2, style: { top: '50%', right: 100 } },   // CLAIM ARTIFACT
      { n: 3, style: { top: '65%', right: 100 } },   // ATTACK (if enemies present)
      { n: 4, style: { top: '10%', right: 105 } },   // system info header
    ],
    annotations: [
      { label: 'JUMP HERE', detail: 'Moves your ship to this system. Costs fuel — check your tank. Costs more the farther the system.' },
      { label: 'CLAIM ARTIFACT', detail: 'Appears only at the Rumored Artifact system. Costs credits. You must be physically in that system.' },
      { label: 'ATTACK', detail: 'Visible when a rival is in the same system as you. Winner loots a module, artifact, or credits.' },
      { label: 'System Info', detail: 'Shows station availability, jump cost, market goods, fuel price, and any rivals currently docked.' },
    ],
  },
  {
    screen: 'SHIPYARD',
    title: 'Build Your Ship',
    setup: 'yard',
    dots: [
      { n: 1, style: { top: '40%', left: '45%' } },   // 3×3 grid center
      { n: 2, style: { top: '20%', left: 30 } },      // weapon palette
      { n: 3, style: { top: '65%', left: 30 } },      // artifact palette
      { n: 4, style: { top: '20%', right: 20 } },     // ship contour / stats
    ],
    annotations: [
      { label: '3×3 Grid', detail: '9 slots for your loadout. Tap a part in the palette, then tap a slot to place it. Neighbors and zones affect stats.' },
      { label: 'Weapon Palette', detail: 'Lists all modules in your inventory. Tap to select, then tap the grid to place. Tap an occupied slot to swap.' },
      { label: 'Artifacts in Grid', detail: 'Claimed Artifacts appear in the palette. They must be placed in the grid to activate their combat effect.' },
      { label: 'Ship Stats', detail: 'Your derived stats (hull, DPS, shields, range) update in real time as you change the grid.' },
    ],
  },
  {
    screen: 'STATION',
    title: 'Station Services',
    setup: 'station',
    dots: [
      { n: 1, style: { top: 80, left: '12%' } },    // MARKET tab
      { n: 2, style: { top: 80, left: '37%' } },    // FUEL tab
      { n: 3, style: { top: 80, left: '62%' } },    // CREW tab
      { n: 4, style: { top: 80, left: '87%' } },    // MODULES tab
    ],
    annotations: [
      { label: 'MARKET', detail: 'Buy trade goods cheap here, sell them at a distant station that pays more. This is your main income source.' },
      { label: 'FUEL', detail: 'Refuel your ship. Fuel costs credits. Without fuel you cannot jump — always keep enough for a return trip.' },
      { label: 'CREW', detail: 'Hire crew for passive bonuses. Trader raises sell prices, Navigator increases jump range, Gunner improves DPS.' },
      { label: 'MODULES', detail: 'Buy new ship modules for your inventory. Sell unused modules here for 50% of their buy price.' },
    ],
  },
  {
    screen: 'COMBAT',
    title: 'Auto-Battle',
    setup: 'combat',
    dots: [
      { n: 1, style: { top: '35%', left: '10%' } },    // your ship
      { n: 2, style: { top: '35%', right: '10%' } },   // enemy ship
      { n: 3, style: { top: '35%', left: '42%' } },    // center weapons area
      { n: 4, style: { top: '70%', left: '10%' } },    // hull bar
    ],
    annotations: [
      { label: 'Your Ship', detail: 'Left side is yours. Both ships fire automatically based on their build — you cannot intervene mid-battle.' },
      { label: 'Enemy Ship', detail: 'Right side is your opponent. Inspect their build before attacking using the System Panel commander button.' },
      { label: 'Weapon Fire', detail: 'Each weapon fires on its own cooldown. The center shows active weapon effects and RPS multipliers.' },
      { label: 'Hull & Shield Bars', detail: 'Shields absorb hits first and regenerate each tick. Hull HP reaching 0 ends the battle. Winner loots the loser.' },
    ],
  },
  {
    screen: 'ACTION BAR',
    title: 'Your Turn',
    setup: 'map-close-station',
    dots: [
      { n: 1, style: { bottom: 6, left: '5%' } },      // END TURN
      { n: 2, style: { bottom: 6, left: '38%' } },     // STATION button
      { n: 3, style: { bottom: 6, right: '5%' } },     // MAP / SHIPYARD nav
      { n: 4, style: { top: 6, left: '30%' } },        // MOVE → ACTION indicator in HUD
    ],
    annotations: [
      { label: 'END TURN', detail: 'Ends your turn and passes to the next player. Their screen glows amber. You cannot undo this.' },
      { label: 'STATION', detail: 'Opens the station dock if your current system has one. Pulses when a station is available here.' },
      { label: 'Navigate Views', detail: 'Switch between the Star Map, Shipyard, and back. Changing your build costs no action.' },
      { label: 'MOVE → ACTION', detail: 'The phase indicator in the HUD shows whether you can still jump (MOVE) or are in the action phase.' },
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

  // Run setup whenever the step changes
  useEffect(() => {
    const rumorSysId = matchState?.rumor?.systemId;
    switch (cur.setup) {
      case 'map':
        setView('map');
        break;
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
      {/* ── Portrait layout: topbar above game ── */}
      <div className="inst-topbar">
        <span className="tour-screen-badge">{cur.screen}</span>
        <span className="inst-title-badge">{cur.title}</span>
        <span className="tour-step-count">{step + 1} / {STEPS.length}</span>
        <button className="station-close" onClick={endTour}>✕</button>
      </div>

      {/* ── Main area: real game + dot overlay ── */}
      <div className="inst-game" onClick={advance}>
        {/* Real game renders here */}
        <GameLayout />

        {/* Annotation dots float over the game */}
        {cur.dots.map(({ n, style }) => <Dot key={n} n={n} style={style} />)}

        {/* Tap hint */}
        <div className="inst-tap-hint">TAP TO CONTINUE</div>
      </div>

      {/* ── Bottom panel: annotation sheet + nav ── */}
      <div className="inst-bottom">
        <div className="inst-ann-sheet">
          <div className="tour-anns">
            {cur.annotations.map((ann, i) => (
              <div key={i} className="tour-ann-row">
                <div className="tour-ann-num" style={{ background: ANN_COLORS[i] }}>{i + 1}</div>
                <div className="tour-ann-text"><b>{ann.label}</b> — {ann.detail}</div>
              </div>
            ))}
          </div>
        </div>

        <div className="tour-nav">
          <button className="btn ghost" disabled={isFirst} onClick={() => setStep(s => s - 1)}>← BACK</button>
          <div className="tour-nav-dots">
            {STEPS.map((_, i) => (
              <button key={i} className={`tour-nav-dot${i === step ? ' active' : ''}`}
                onClick={() => setStep(i)} title={STEPS[i].screen} />
            ))}
          </div>
          <button className="btn primary" onClick={advance}>{isLast ? 'DONE' : 'NEXT →'}</button>
        </div>
      </div>
    </div>
  );
}
