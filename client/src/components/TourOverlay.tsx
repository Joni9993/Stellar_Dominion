import React, { useState } from 'react';

const ANN_COLORS = ['var(--teal)', 'var(--amber)', 'var(--red)', 'var(--purple)'] as const;

function AbsDot({ n, style }: { n: number; style?: React.CSSProperties }) {
  return (
    <div style={{
      position: 'absolute',
      width: 18, height: 18, borderRadius: '50%',
      background: ANN_COLORS[n - 1], color: '#0c1018',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: 10, fontFamily: "'Press Start 2P'",
      lineHeight: 1, zIndex: 20, flexShrink: 0,
      ...style,
    }}>{n}</div>
  );
}

function Badge({ n }: { n: number }) {
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
      width: 16, height: 16, borderRadius: '50%',
      background: ANN_COLORS[n - 1], color: '#0c1018',
      fontSize: 9, fontFamily: "'Press Start 2P'",
      lineHeight: 1, flexShrink: 0,
    }}>{n}</span>
  );
}

// ── Mockups ───────────────────────────────────────────────────────────────────

function IntroMockup() {
  const factions: { color: string; pos: [number, number] }[] = [
    { color: 'var(--teal)',   pos: [50, 12] },
    { color: 'var(--amber)',  pos: [82, 28] },
    { color: 'var(--red)',    pos: [82, 72] },
    { color: '#7aacff',       pos: [50, 88] },
    { color: 'var(--purple)', pos: [18, 72] },
    { color: 'var(--green)',  pos: [18, 28] },
  ];
  return (
    <div style={{ position: 'relative', height: 155, background: 'var(--void)', border: '1px solid var(--line)', overflow: 'hidden' }}>
      <svg style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', overflow: 'visible' }}>
        {factions.map(({ color, pos }, i) => (
          <line key={i} x1={`${pos[0]}%`} y1={`${pos[1]}%`} x2="50%" y2="50%"
            stroke={color} strokeWidth="1" strokeOpacity="0.35" strokeDasharray="4 4" />
        ))}
      </svg>
      {factions.map(({ color, pos }, i) => (
        <div key={i} style={{ position: 'absolute', left: `${pos[0]}%`, top: `${pos[1]}%`, transform: 'translate(-50%,-50%)', color, fontSize: 13, lineHeight: 1 }}>▲</div>
      ))}
      <div style={{
        position: 'absolute', left: '50%', top: '50%', transform: 'translate(-50%,-50%)',
        width: 28, height: 28, borderRadius: '50%',
        background: 'radial-gradient(circle, var(--amber) 0%, rgba(217,164,65,0.4) 70%)',
        boxShadow: '0 0 18px var(--amber), 0 0 36px rgba(217,164,65,0.3)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 13, color: '#1a1000',
      }}>✦</div>
      <div style={{ position: 'absolute', top: 6, left: 8, fontSize: 8, color: 'var(--faint)', fontFamily: "'Press Start 2P'" }}>18 SYSTEMS</div>
      <div style={{ position: 'absolute', bottom: 6, right: 8, fontSize: 8, color: 'var(--amber)', fontFamily: "'Press Start 2P'" }}>RUMORED ARTIFACT</div>
      <AbsDot n={1} style={{ top: '42%', left: '52%' }} />
      <AbsDot n={2} style={{ top: '6%', left: '5%' }} />
    </div>
  );
}

function StarMapMockup() {
  const sys: [number, number][] = [
    [10,20],[28,12],[14,45],[32,38],[50,22],[68,14],[84,24],
    [56,48],[72,42],[88,55],[18,70],[38,64],[55,74],[72,66],
    [88,78],[34,88],[60,90],[82,85],
  ];
  const edges = [[0,2],[1,3],[2,3],[3,4],[4,5],[5,6],[4,7],[7,8],[8,9],[7,10],[10,11],[11,12],[12,13],[13,14],[11,15],[12,15],[13,16],[14,16],[14,17]];
  const rumorIdx = 4;
  return (
    <div style={{ position: 'relative', height: 155, background: 'var(--void)', border: '1px solid var(--line)', overflow: 'hidden' }}>
      <svg style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', overflow: 'visible' }}>
        {edges.map(([a, b], i) => (
          <line key={i} x1={`${sys[a][0]}%`} y1={`${sys[a][1]}%`} x2={`${sys[b][0]}%`} y2={`${sys[b][1]}%`} stroke="rgba(44,58,77,0.9)" strokeWidth="1" />
        ))}
      </svg>
      {sys.map(([x, y], i) => (
        <div key={i} style={{
          position: 'absolute', left: `${x}%`, top: `${y}%`, transform: 'translate(-50%,-50%)',
          width: i === rumorIdx ? 11 : 7, height: i === rumorIdx ? 11 : 7, borderRadius: '50%',
          background: i === rumorIdx ? 'var(--amber)' : 'var(--panel3)',
          border: `1px solid ${i === rumorIdx ? 'var(--amber)' : 'var(--line)'}`,
          boxShadow: i === rumorIdx ? '0 0 10px var(--amber)' : undefined,
        }} />
      ))}
      <div style={{ position: 'absolute', left: `${sys[7][0]}%`, top: `${sys[7][1]}%`, transform: 'translate(-50%,-160%)', color: 'var(--teal)', fontSize: 11, lineHeight: 1 }}>▲</div>
      <AbsDot n={1} style={{ top: '6%', left: '5%' }} />
      <AbsDot n={2} style={{ top: '10%', left: `${sys[rumorIdx][0] + 2}%` }} />
    </div>
  );
}

function MapPanelMockup() {
  const actionRow = (n: number, border: string, color: string, label: string) => (
    <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
      <Badge n={n} />
      <div style={{ flex: 1, padding: '5px 7px', border: `1px solid ${border}`, color, fontSize: 13, fontFamily: "'VT323'" }}>{label}</div>
    </div>
  );
  return (
    <div style={{ display: 'flex', gap: 8, height: 155 }}>
      <div style={{ flex: 1, background: 'var(--panel)', border: '1px solid var(--line)', padding: 8, overflow: 'hidden' }}>
        <div style={{ fontSize: 9, color: 'var(--bone)', fontFamily: "'Press Start 2P'", marginBottom: 6 }}>KEPLER-7</div>
        <div style={{ fontSize: 13, color: 'var(--dim)', marginBottom: 2 }}>STATION · Yes</div>
        <div style={{ fontSize: 13, color: 'var(--dim)', marginBottom: 2 }}>JUMP COST · 2⛽</div>
        <div style={{ fontSize: 13, color: 'var(--amber)', marginTop: 6 }}>✦ VOID COMPASS</div>
        <div style={{ fontSize: 12, color: 'var(--faint)' }}>300◈</div>
      </div>
      <div style={{ width: 148, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', gap: 5 }}>
        {actionRow(3, 'var(--red)', 'var(--red)', '⚔ ATTACK')}
        {actionRow(2, 'var(--teal)', 'var(--teal)', '✦ CLAIM · 300◈')}
        {actionRow(1, 'var(--bone)', 'var(--bone)', 'JUMP HERE · 2⛽')}
      </div>
    </div>
  );
}

function ShipyardMockup() {
  const cells: { icon: string | null; color: string | null }[] = [
    { icon: '⚡', color: 'var(--red)' },
    { icon: '▬', color: 'var(--red)' },
    { icon: null, color: null },
    { icon: '◈', color: 'var(--teal)' },
    { icon: '⊕', color: 'var(--amber)' },
    { icon: null, color: null },
    { icon: null, color: null },
    { icon: '✦', color: 'var(--purple)' },
    { icon: null, color: null },
  ];
  return (
    <div style={{ display: 'flex', gap: 8, height: 155 }}>
      <div style={{ width: 90, background: 'var(--panel)', border: '1px solid var(--line)', padding: 6, overflow: 'hidden' }}>
        <div style={{ fontSize: 8, color: 'var(--dim)', fontFamily: "'Press Start 2P'", marginBottom: 5 }}>WEAPONS</div>
        <div style={{ fontSize: 13, color: 'var(--red)', marginBottom: 3 }}>⚡ Laser</div>
        <div style={{ fontSize: 13, color: 'var(--red)', marginBottom: 10 }}>▬ Railgun</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 4 }}>
          <Badge n={2} />
          <span style={{ fontSize: 8, color: 'var(--purple)', fontFamily: "'Press Start 2P'" }}>ARTIFACTS</span>
        </div>
        <div style={{ fontSize: 13, color: 'var(--purple)' }}>✦ Eye of Arak</div>
      </div>
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 3 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
          <Badge n={1} />
          <span style={{ fontSize: 9, color: 'var(--dim)', fontFamily: "'Press Start 2P'" }}>3×3 GRID</span>
        </div>
        {[0, 3, 6].map(row => (
          <div key={row} style={{ display: 'flex', gap: 3 }}>
            {[0, 1, 2].map(col => {
              const cell = cells[row + col];
              return (
                <div key={col} style={{
                  width: 34, height: 34, background: cell.icon ? 'var(--panel3)' : 'var(--panel)',
                  border: `1px solid ${cell.color ?? 'var(--line)'}`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 13, color: cell.color ?? 'var(--faint)',
                }}>{cell.icon}</div>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}

function StationMockup() {
  const tabs = ['MARKET', 'FUEL', 'CREW', 'MODULES'] as const;
  return (
    <div style={{ height: 155, background: 'var(--panel)', border: '1px solid var(--line)', overflow: 'hidden' }}>
      <div style={{ padding: '6px 10px', borderBottom: '1px solid var(--line)', fontSize: 9, color: 'var(--bone)', fontFamily: "'Press Start 2P'" }}>STATION · KEPLER-7</div>
      <div style={{ display: 'flex', borderBottom: '1px solid var(--line)' }}>
        {tabs.map((tab, i) => (
          <div key={tab} style={{
            flex: 1, padding: '5px 2px', textAlign: 'center',
            fontSize: 8, fontFamily: "'Press Start 2P'",
            color: i === 0 ? 'var(--teal)' : 'var(--dim)',
            borderBottom: i === 0 ? '2px solid var(--teal)' : undefined,
            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3,
          }}>
            <Badge n={i + 1} />{tab}
          </div>
        ))}
      </div>
      <div style={{ padding: '8px 10px', fontSize: 14, color: 'var(--dim)' }}>
        <div style={{ color: 'var(--bone)', marginBottom: 3 }}>SPICE · BUY 80◈ · stock 12</div>
        <div style={{ marginBottom: 3 }}>ISOTOPES · PAYS 140◈</div>
        <div style={{ color: 'var(--faint)', fontSize: 12 }}>TRADE ROUTES ›</div>
      </div>
    </div>
  );
}

function HudMockup() {
  const res = (n: number, value: string, label: string, color: string) => (
    <span style={{ display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0 }}>
      <Badge n={n} />
      <span style={{ color, fontSize: 14 }}>{value}</span>
      <span style={{ color: 'var(--dim)', fontSize: 12 }}>{label}</span>
    </span>
  );
  return (
    <div style={{ height: 155, display: 'flex', flexDirection: 'column', gap: 4 }}>
      <div style={{ background: 'var(--panel)', border: '1px solid var(--line)', padding: '6px 10px', display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        <span style={{ fontSize: 8, color: 'var(--teal)', fontFamily: "'Press Start 2P'", flexShrink: 0 }}>YANTARI HIVE</span>
        <span style={{ fontSize: 13, color: 'var(--dim)', flexShrink: 0 }}>KEPLER-7</span>
        <span style={{ fontSize: 13, color: 'var(--green)', flexShrink: 0 }}>MOVE 1/2</span>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          {res(1, '740◈', 'CREDITS', 'var(--amber)')}
          {res(2, '65/100', 'FUEL', 'var(--teal)')}
          {res(3, '4/20', 'CARGO', 'var(--dim)')}
        </div>
      </div>
      <div style={{ flex: 1, background: 'var(--void)', border: '1px solid var(--line)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <span style={{ fontSize: 13, color: 'var(--faint)' }}>← game area →</span>
      </div>
    </div>
  );
}

function CombatMockup() {
  function Bar({ pct, color }: { pct: number; color: string }) {
    return (
      <div style={{ height: 5, background: 'var(--panel3)', border: '1px solid var(--line)', marginBottom: 3 }}>
        <div style={{ height: '100%', width: `${pct}%`, background: color }} />
      </div>
    );
  }
  function Ship({ label, color, facing, hullPct, shieldPct }: { label: string; color: string; facing: 'right' | 'left'; hullPct: number; shieldPct: number }) {
    return (
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
        <div style={{ fontSize: 9, color, fontFamily: "'Press Start 2P'" }}>{label}</div>
        <div style={{ fontSize: 28, transform: facing === 'left' ? 'scaleX(-1)' : undefined, color, lineHeight: 1 }}>▲</div>
        <div style={{ width: '80%' }}>
          <div style={{ fontSize: 9, color: 'var(--dim)', marginBottom: 1 }}>HULL</div>
          <Bar pct={hullPct} color={color} />
          <div style={{ fontSize: 9, color: 'var(--dim)', marginBottom: 1 }}>SHIELD</div>
          <Bar pct={shieldPct} color="rgba(95,168,164,0.7)" />
        </div>
      </div>
    );
  }
  return (
    <div style={{ position: 'relative', height: 155, background: 'var(--void)', border: '1px solid var(--line)', padding: 8 }}>
      <AbsDot n={1} style={{ top: 0, left: 0 }} />
      <div style={{ display: 'flex', height: '100%', gap: 4, alignItems: 'center', position: 'relative' }}>
        <Ship facing="right" label="YOU" color="var(--teal)" hullPct={62} shieldPct={50} />
        <div style={{ width: 76, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 5, flexShrink: 0, position: 'relative' }}>
          <AbsDot n={3} style={{ top: -8, left: '50%', transform: 'translateX(-50%)' }} />
          <div style={{ fontSize: 8, color: 'var(--amber)', fontFamily: "'Press Start 2P'", textAlign: 'center', lineHeight: 1.6 }}>LASER<br />×2.0</div>
          <div style={{ width: 52, height: 2, background: 'linear-gradient(90deg, var(--teal), transparent)' }} />
          <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
            <Badge n={2} />
            <span style={{ fontSize: 11, color: 'var(--dim)', fontFamily: "'VT323'" }}>HP BARS</span>
          </div>
        </div>
        <Ship facing="left" label="ENEMY" color="var(--red)" hullPct={28} shieldPct={0} />
      </div>
    </div>
  );
}

// ── Step definitions ──────────────────────────────────────────────────────────

interface TourStep {
  screen: string;
  title: string;
  mockup: React.ReactNode;
  annotations: { label: string; detail: string }[];
}

const STEPS: TourStep[] = [
  {
    screen: 'IN THE VOID',
    title: 'Six Factions. One Dominion.',
    mockup: <IntroMockup />,
    annotations: [
      { label: 'The Artifacts', detail: 'Ancient relics scattered across 18 star systems. Collect enough and you control the Dominion.' },
      { label: 'Six Factions', detail: 'Every deal can become a trap. Every ally becomes a target the moment they claim an Artifact. Trade, combat, intrigue — all are valid paths.' },
    ],
  },
  {
    screen: 'STAR MAP',
    title: 'Navigate the Galaxy',
    mockup: <StarMapMockup />,
    annotations: [
      { label: 'Systems', detail: '18 star systems connected by jump lanes. Tap any system to see its details and plan your route.' },
      { label: 'Rumor Ping', detail: 'The glowing amber node is the active Rumored Artifact location. Only one Rumor at a time — everyone converges here.' },
    ],
  },
  {
    screen: 'MAP PANEL',
    title: 'System Actions',
    mockup: <MapPanelMockup />,
    annotations: [
      { label: 'Jump Here', detail: 'Move your ship to the selected system. Costs fuel — check your tank before a long route.' },
      { label: 'Claim Artifact', detail: 'Claim the Rumored Artifact if you are in that system and have enough credits. Race rivals to get there first.' },
      { label: 'Attack', detail: 'Challenge a rival in the same system. The winner loots a module, artifact, or credits from the loser.' },
    ],
  },
  {
    screen: 'SHIPYARD',
    title: 'Build Your Ship',
    mockup: <ShipyardMockup />,
    annotations: [
      { label: '3×3 Grid', detail: '9 slots for weapons, defenses, and energy modules. BOW zone boosts weapons; adjacent Energy modules give +15% fire rate.' },
      { label: 'Artifacts', detail: 'Claimed Artifacts must be slotted into the grid to activate their combat effect — they compete with weapons for space.' },
    ],
  },
  {
    screen: 'STATION',
    title: 'Station Services',
    mockup: <StationMockup />,
    annotations: [
      { label: 'Market', detail: 'Buy specialty goods cheap here, sell them at a distant station that pays more. Trade routes are your main income source.' },
      { label: 'Fuel', detail: 'Refuel your ship. Each jump burns fuel — running out strands you until you reach a station.' },
      { label: 'Crew', detail: 'Hire crew for persistent bonuses: Trader boosts sell prices, Navigator extends range, Gunner improves accuracy.' },
      { label: 'Modules', detail: 'Buy ship modules and sell unused ones here for 50% of their buy price.' },
    ],
  },
  {
    screen: 'HUD',
    title: 'Your Resources',
    mockup: <HudMockup />,
    annotations: [
      { label: 'Credits ◈', detail: 'Spend on fuel, modules, trade goods, and crew. You start every game with 500◈.' },
      { label: 'Fuel ⛽', detail: 'Consumed on every jump. Running out leaves you stranded — always check before a long route.' },
      { label: 'Cargo', detail: 'Caps how many units of trade goods you can carry. Buy a Cargo Bay at a station to increase it.' },
    ],
  },
  {
    screen: 'COMBAT',
    title: 'Auto-Battle',
    mockup: <CombatMockup />,
    annotations: [
      { label: 'Ships', detail: 'Both ships fire automatically based on their loadout. Combat plays out in ticks — your build determines the outcome.' },
      { label: 'HP Bars', detail: 'Hull HP is your life; Shields regenerate each tick and absorb hits first. Destroy the enemy hull to win.' },
      { label: 'RPS Counters', detail: 'Laser ×2.0 vs Shields · Railgun ×1.5 vs Armor · Missiles bypass Shields. Inspect enemy builds before attacking.' },
    ],
  },
];

// ── TourOverlay ───────────────────────────────────────────────────────────────

export function TourOverlay({ onClose }: { onClose: () => void }) {
  const [step, setStep] = useState(0);
  const cur = STEPS[step];
  const isFirst = step === 0;
  const isLast = step === STEPS.length - 1;

  return (
    <div
      className="tour-backdrop"
      onClick={onClose}
      onKeyDown={e => {
        if (e.key === 'ArrowRight' && !isLast) setStep(s => s + 1);
        if (e.key === 'ArrowLeft' && !isFirst) setStep(s => s - 1);
        if (e.key === 'Escape') onClose();
      }}
      tabIndex={-1}
    >
      <div className="tour-card" onClick={e => e.stopPropagation()}>
        <div className="tour-header">
          <span className="tour-screen-badge">{cur.screen}</span>
          <span className="tour-step-count">{step + 1} / {STEPS.length}</span>
          <button className="station-close" onClick={onClose}>✕</button>
        </div>

        <div className="tour-mockup">{cur.mockup}</div>

        <div className="tour-body">
          <div className="tour-title">{cur.title}</div>
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
              <button key={i} className={`tour-nav-dot${i === step ? ' active' : ''}`} onClick={() => setStep(i)} title={STEPS[i].screen} />
            ))}
          </div>
          <button className="btn primary" onClick={() => isLast ? onClose() : setStep(s => s + 1)}>
            {isLast ? 'DONE' : 'NEXT →'}
          </button>
        </div>
      </div>
    </div>
  );
}
