import React, { useState } from 'react';

const ANN_COLORS = ['var(--teal)', 'var(--amber)', 'var(--red)', 'var(--purple)'] as const;

function Dot({ n, style }: { n: number; style?: React.CSSProperties }) {
  return (
    <div style={{
      position: 'absolute',
      width: 21, height: 21, borderRadius: '50%',
      background: ANN_COLORS[n - 1], color: '#0c1018',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: 10, fontFamily: "'Press Start 2P'",
      lineHeight: 1, zIndex: 20, flexShrink: 0,
      boxShadow: '0 0 0 2px rgba(0,0,0,0.6)',
      ...style,
    }}>{n}</div>
  );
}

// ── Galaxy map data ──────────────────────────────────────────────────────────

const SYS: [number, number][] = [
  [10, 20], [28, 12], [14, 45], [32, 38], [50, 22], [68, 14], [84, 24],
  [56, 48], [72, 42], [88, 55], [18, 70], [38, 64], [55, 74], [72, 66],
  [88, 78], [34, 88], [60, 90], [82, 85],
];
const EDGES: [number, number][] = [
  [0, 2], [1, 3], [2, 3], [3, 4], [4, 5], [5, 6], [4, 7], [7, 8], [8, 9],
  [7, 10], [10, 11], [11, 12], [12, 13], [13, 14], [11, 15], [12, 15], [13, 16], [14, 16], [14, 17],
];

function GalaxyMap({ rumorIdx = 4, myShipIdx = 7, rivals = [11] }: {
  rumorIdx?: number; myShipIdx?: number; rivals?: number[];
}) {
  return (
    <div style={{ position: 'relative', width: '100%', height: '100%' }}>
      <svg style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', overflow: 'visible' }}>
        {EDGES.map(([a, b], i) => (
          <line key={i}
            x1={`${SYS[a][0]}%`} y1={`${SYS[a][1]}%`}
            x2={`${SYS[b][0]}%`} y2={`${SYS[b][1]}%`}
            stroke="rgba(44,58,77,0.9)" strokeWidth="1"
          />
        ))}
      </svg>
      {SYS.map(([x, y], i) => {
        const isRumor = i === rumorIdx;
        const isMe = i === myShipIdx;
        const isRival = rivals.includes(i);
        const hasStation = [4, 7, 11, 14].includes(i);
        return (
          <React.Fragment key={i}>
            <div style={{
              position: 'absolute',
              left: `${x}%`, top: `${y}%`,
              transform: 'translate(-50%, -50%)',
              width: isRumor ? 12 : 8, height: isRumor ? 12 : 8,
              borderRadius: '50%',
              background: isRumor ? 'var(--amber)' : 'var(--panel3)',
              border: `1px solid ${isRumor ? 'var(--amber)' : hasStation ? 'rgba(95,168,164,0.5)' : 'var(--line)'}`,
              boxShadow: isRumor ? '0 0 10px var(--amber), 0 0 22px rgba(217,164,65,0.3)' : undefined,
            }} />
            {isMe && (
              <div style={{
                position: 'absolute',
                left: `${x}%`, top: `${y}%`,
                transform: 'translate(-50%, -210%)',
                color: 'var(--teal)', fontSize: 14, lineHeight: 1,
              }}>▲</div>
            )}
            {isRival && (
              <div style={{
                position: 'absolute',
                left: `${x}%`, top: `${y}%`,
                transform: 'translate(-50%, -210%)',
                color: 'var(--red)', fontSize: 11, lineHeight: 1,
              }}>▲</div>
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
}

// ── MockHUD bar ──────────────────────────────────────────────────────────────

function MockHUD({ phase = 'MOVE 1/2', showDots = false }: { phase?: string; showDots?: boolean }) {
  return (
    <div style={{
      flexShrink: 0,
      background: 'var(--panel)', borderBottom: '1px solid var(--line)',
      padding: '7px 12px', display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap',
      position: 'relative', userSelect: 'none',
    }}>
      <span style={{ fontFamily: "'Press Start 2P'", fontSize: 8, color: 'var(--teal)', flexShrink: 0 }}>YANTARI HIVE</span>
      <span style={{ fontSize: 13, color: 'var(--dim)', flexShrink: 0 }}>KEPLER-7</span>
      <span style={{ fontSize: 13, color: 'var(--green)', flexShrink: 0 }}>{phase}</span>
      <span style={{ fontSize: 11, color: 'var(--faint)', flexShrink: 0 }}>CYC 3/20</span>
      <span style={{ fontSize: 12, color: 'var(--faint)', marginLeft: 2, marginRight: 2, flexShrink: 0 }}>?</span>
      <div style={{ marginLeft: 'auto', display: 'flex', gap: 12, flexWrap: 'wrap' }}>
        <span style={{ fontSize: 13, color: 'var(--amber)' }}>740◈ <span style={{ color: 'var(--faint)', fontSize: 11 }}>CREDITS</span></span>
        <span style={{ fontSize: 13, color: 'var(--teal)' }}>65/100 <span style={{ color: 'var(--faint)', fontSize: 11 }}>FUEL</span></span>
        <span style={{ fontSize: 13, color: 'var(--dim)' }}>4/20 <span style={{ color: 'var(--faint)', fontSize: 11 }}>CARGO</span></span>
        <span style={{ fontSize: 13, color: 'var(--purple)' }}>2 <span style={{ color: 'var(--faint)', fontSize: 11 }}>ART</span></span>
      </div>
      {showDots && (
        <>
          <Dot n={1} style={{ top: 2, left: 2 }} />
          <Dot n={2} style={{ top: 2, left: 164 }} />
          <Dot n={3} style={{ top: 2, left: 232 }} />
          <Dot n={4} style={{ top: 2, right: 2 }} />
        </>
      )}
    </div>
  );
}

// ── Screen mockups ───────────────────────────────────────────────────────────

function HUDScreen() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <MockHUD showDots />
      {/* Rest of screen: empty game area */}
      <div style={{ flex: 1, background: 'var(--void)', position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{
          border: '1px dashed var(--line)', padding: '20px 32px',
          color: 'var(--faint)', fontSize: 11,
          fontFamily: "'Press Start 2P'", textAlign: 'center', lineHeight: 2,
        }}>
          GAME AREA<br />(MAP / SHIPYARD / COMBAT)
        </div>
      </div>
    </div>
  );
}

function StarMapScreen() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <MockHUD />
      <div style={{ flex: 1, background: 'var(--void)', position: 'relative', minHeight: 0 }}>
        <GalaxyMap />
        {/* Jump lane label */}
        <div style={{
          position: 'absolute', top: '28%', left: '22%',
          fontSize: 9, color: 'var(--faint)', fontFamily: "'Press Start 2P'",
          transform: 'rotate(-20deg)',
        }}>JUMP LANE</div>
        {/* Station indicator */}
        <div style={{
          position: 'absolute', top: '43%', left: '53%',
          fontSize: 9, color: 'var(--teal)', fontFamily: "'Press Start 2P'",
        }}>⇄</div>
        {/* Dots */}
        <Dot n={1} style={{ top: '38%', left: '53%' }} />
        <Dot n={2} style={{ top: '15%', left: '46%' }} />
        <Dot n={3} style={{ top: '62%', left: '34%' }} />
        <Dot n={4} style={{ top: '6%', left: '6%' }} />
      </div>
    </div>
  );
}

function MapPanelScreen() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <MockHUD />
      <div style={{ flex: 1, display: 'flex', minHeight: 0 }}>
        {/* Map (left) */}
        <div style={{ flex: 1, background: 'var(--void)', position: 'relative', minHeight: 0 }}>
          <GalaxyMap rivals={[11, 4]} />
          {/* Selected system highlight */}
          <div style={{
            position: 'absolute',
            left: `${SYS[4][0]}%`, top: `${SYS[4][1]}%`,
            transform: 'translate(-50%, -50%)',
            width: 24, height: 24, borderRadius: '50%',
            border: '2px solid var(--amber)',
            boxShadow: '0 0 14px rgba(217,164,65,0.5)',
            pointerEvents: 'none',
          }} />
        </div>
        {/* Panel (right) */}
        <div style={{
          width: 160, background: 'var(--panel)', borderLeft: '1px solid var(--line)',
          display: 'flex', flexDirection: 'column', padding: '10px 0', position: 'relative',
          flexShrink: 0,
        }}>
          <div style={{ padding: '0 10px 8px', borderBottom: '1px solid var(--line)', marginBottom: 8 }}>
            <div style={{ fontFamily: "'Press Start 2P'", fontSize: 8, color: 'var(--amber)', marginBottom: 4 }}>KEPLER-7</div>
            <div style={{ fontSize: 12, color: 'var(--dim)' }}>STATION · YES</div>
            <div style={{ fontSize: 12, color: 'var(--dim)' }}>JUMP COST · 4⛽</div>
            <div style={{ marginTop: 6, fontSize: 12, color: 'var(--amber)' }}>✦ VOID COMPASS</div>
            <div style={{ fontSize: 11, color: 'var(--faint)' }}>300◈</div>
          </div>
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6, padding: '0 10px', justifyContent: 'flex-end' }}>
            <div style={{
              padding: '7px 10px', border: '1px solid var(--line)', color: 'var(--bone)',
              fontSize: 13, fontFamily: "'VT323'", position: 'relative',
            }}>JUMP HERE · 4⛽<Dot n={1} style={{ top: -8, right: -8 }} /></div>
            <div style={{
              padding: '7px 10px', border: '1px solid var(--teal)', color: 'var(--teal)',
              fontSize: 13, fontFamily: "'VT323'", position: 'relative',
            }}>✦ CLAIM · 300◈<Dot n={2} style={{ top: -8, right: -8 }} /></div>
            <div style={{
              padding: '7px 10px', border: '1px solid var(--red)', color: 'var(--red)',
              fontSize: 13, fontFamily: "'VT323'", position: 'relative',
            }}>⚔ ATTACK<Dot n={3} style={{ top: -8, right: -8 }} /></div>
          </div>
          <Dot n={4} style={{ top: 10, right: -10 }} />
        </div>
      </div>
    </div>
  );
}

function ShipyardScreen() {
  const cells: { icon: string | null; color: string | null; label: string | null }[] = [
    { icon: '⚡', color: 'var(--red)', label: 'Laser' },
    { icon: '▬', color: 'var(--red)', label: 'Railgun' },
    { icon: null, color: null, label: null },
    { icon: '◈', color: 'var(--teal)', label: 'Shield' },
    { icon: '⊕', color: 'var(--amber)', label: 'Engine' },
    { icon: null, color: null, label: null },
    { icon: null, color: null, label: null },
    { icon: '✦', color: 'var(--purple)', label: 'Artifact' },
    { icon: null, color: null, label: null },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <MockHUD />
      <div style={{ flex: 1, display: 'flex', minHeight: 0 }}>
        {/* Palette (left) */}
        <div style={{
          width: 110, background: 'var(--panel2)', borderRight: '1px solid var(--line)',
          padding: 8, overflow: 'hidden', position: 'relative', flexShrink: 0,
        }}>
          <div style={{ fontSize: 8, color: 'var(--faint)', fontFamily: "'Press Start 2P'", marginBottom: 6 }}>WEAPONS</div>
          <div style={{ fontSize: 13, color: 'var(--red)', marginBottom: 2 }}>⚡ Laser</div>
          <div style={{ fontSize: 13, color: 'var(--red)', marginBottom: 2 }}>▬ Railgun</div>
          <div style={{ fontSize: 13, color: 'var(--red)', marginBottom: 10 }}>◎ Missile</div>
          <div style={{ fontSize: 8, color: 'var(--faint)', fontFamily: "'Press Start 2P'", marginBottom: 6 }}>DEFENSE</div>
          <div style={{ fontSize: 13, color: 'var(--teal)', marginBottom: 2 }}>◈ Shield</div>
          <div style={{ fontSize: 13, color: 'var(--teal)', marginBottom: 10 }}>▣ Armor</div>
          <div style={{ fontSize: 8, color: 'var(--purple)', fontFamily: "'Press Start 2P'", marginBottom: 6 }}>ARTIFACTS</div>
          <div style={{ fontSize: 13, color: 'var(--purple)', marginBottom: 2 }}>✦ Eye of Arak</div>
          <div style={{ fontSize: 13, color: 'var(--purple)' }}>✦ Void Compass</div>
          <Dot n={2} style={{ top: 4, right: -10 }} />
          <Dot n={3} style={{ bottom: 50, right: -10 }} />
        </div>

        {/* Grid (center) */}
        <div style={{
          flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center',
          justifyContent: 'center', gap: 10, position: 'relative', padding: 12,
        }}>
          <div style={{ fontSize: 9, color: 'var(--faint)', fontFamily: "'Press Start 2P'" }}>BOW</div>
          {[0, 3, 6].map(row => (
            <div key={row} style={{ display: 'flex', gap: 4 }}>
              {[0, 1, 2].map(col => {
                const cell = cells[row + col];
                return (
                  <div key={col} style={{
                    width: 44, height: 44,
                    background: cell.icon ? 'var(--panel3)' : 'var(--panel)',
                    border: `1px solid ${cell.color ?? 'var(--line)'}`,
                    display: 'flex', flexDirection: 'column',
                    alignItems: 'center', justifyContent: 'center',
                    fontSize: 16, color: cell.color ?? 'var(--faint)',
                    gap: 1,
                  }}>
                    {cell.icon}
                    {cell.label && <span style={{ fontSize: 7, fontFamily: "'Press Start 2P'", color: cell.color ?? 'var(--faint)', opacity: 0.7 }}>{cell.label.slice(0,4)}</span>}
                  </div>
                );
              })}
            </div>
          ))}
          <div style={{ fontSize: 9, color: 'var(--faint)', fontFamily: "'Press Start 2P'" }}>STERN</div>
          <Dot n={1} style={{ top: 30, left: '50%', transform: 'translateX(-50%)' }} />
        </div>

        {/* Ship silhouette (right) */}
        <div style={{
          width: 80, background: 'var(--panel)', borderLeft: '1px solid var(--line)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          position: 'relative', flexShrink: 0,
        }}>
          <div style={{ fontSize: 52, color: 'var(--teal)', opacity: 0.3, transform: 'rotate(90deg)' }}>▲</div>
          <Dot n={4} style={{ top: 8, left: '50%', transform: 'translateX(-50%)' }} />
        </div>
      </div>
    </div>
  );
}

function StationScreen() {
  const tabs = [
    { key: 'MARKET', color: 'var(--teal)', n: 1 },
    { key: 'FUEL', color: 'var(--amber)', n: 2 },
    { key: 'CREW', color: 'var(--green)', n: 3 },
    { key: 'MODULES', color: 'var(--purple)', n: 4 },
  ] as const;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <MockHUD />
      <div style={{ flex: 1, background: 'var(--panel)', display: 'flex', flexDirection: 'column', minHeight: 0 }}>
        {/* Station header */}
        <div style={{
          padding: '8px 14px', borderBottom: '1px solid var(--line)',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}>
          <span style={{ fontFamily: "'Press Start 2P'", fontSize: 9, color: 'var(--bone)' }}>STATION · KEPLER-7</span>
          <span style={{ fontSize: 16, color: 'var(--faint)', cursor: 'pointer' }}>✕</span>
        </div>
        {/* Tabs */}
        <div style={{ display: 'flex', borderBottom: '1px solid var(--line)', position: 'relative' }}>
          {tabs.map(({ key, color, n }) => (
            <div key={key} style={{
              flex: 1, padding: '8px 4px', textAlign: 'center',
              fontSize: 9, fontFamily: "'Press Start 2P'",
              color: n === 1 ? color : 'var(--dim)',
              borderBottom: n === 1 ? `2px solid ${color}` : undefined,
              position: 'relative',
            }}>
              {key}
              <Dot n={n} style={{ top: -10, right: -2, width: 18, height: 18, fontSize: 9 }} />
            </div>
          ))}
        </div>
        {/* Market content */}
        <div style={{ flex: 1, padding: '12px 14px', overflow: 'hidden' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10, fontSize: 12, color: 'var(--faint)', fontFamily: "'Press Start 2P'" }}>
            <span>GOOD</span><span>BUY / SELL</span>
          </div>
          {[
            { name: 'SPICE', buy: 80, sell: 140, stock: 12 },
            { name: 'ISOTOPES', buy: 120, sell: null, stock: 8 },
            { name: 'NANOGEL', buy: 200, sell: 310, stock: 4 },
            { name: 'VOID DUST', buy: null, sell: 95, stock: null },
          ].map(({ name, buy, sell, stock }) => (
            <div key={name} style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              padding: '7px 0', borderBottom: '1px solid var(--line)',
            }}>
              <span style={{ fontSize: 14, color: 'var(--bone)' }}>{name}</span>
              <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                {buy && <span style={{ fontSize: 13, color: 'var(--teal)' }}>BUY {buy}◈</span>}
                {sell && <span style={{ fontSize: 13, color: 'var(--amber)' }}>PAYS {sell}◈</span>}
                {stock && <span style={{ fontSize: 11, color: 'var(--faint)' }}>×{stock}</span>}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function CommanderScreen() {
  const parts = [
    { icon: '⚡', color: 'var(--red)' },
    { icon: '▬', color: 'var(--red)' },
    { icon: null, color: null },
    { icon: '◈', color: 'var(--teal)' },
    { icon: '◈', color: 'var(--teal)' },
    { icon: null, color: null },
    { icon: null, color: null },
    { icon: '✦', color: 'var(--purple)' },
    { icon: null, color: null },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <MockHUD />
      <div style={{ flex: 1, background: 'rgba(7,10,16,0.9)', display: 'flex', flexDirection: 'column', minHeight: 0 }}>
        {/* Commander modal */}
        <div style={{
          margin: '12px', flex: 1, background: 'var(--panel)',
          border: '1px solid var(--line)', display: 'flex', flexDirection: 'column', overflow: 'hidden',
          position: 'relative',
        }}>
          {/* Header */}
          <div style={{
            padding: '8px 12px', borderBottom: '1px solid var(--line)',
            display: 'flex', alignItems: 'center', gap: 10, background: 'var(--panel2)',
          }}>
            <span style={{ fontFamily: "'Press Start 2P'", fontSize: 8, color: 'var(--red)' }}>VORN IMPERIAL</span>
            <span style={{ fontSize: 13, color: 'var(--dim)' }}>HELIX-4</span>
            <span style={{ marginLeft: 'auto', fontSize: 16, color: 'var(--faint)' }}>✕</span>
          </div>
          <div style={{ flex: 1, display: 'flex', minHeight: 0 }}>
            {/* Build grid */}
            <div style={{
              flex: 1, display: 'flex', flexDirection: 'column',
              alignItems: 'center', justifyContent: 'center', gap: 8, padding: 12, position: 'relative',
            }}>
              {[0, 3, 6].map(row => (
                <div key={row} style={{ display: 'flex', gap: 4 }}>
                  {[0, 1, 2].map(col => {
                    const p = parts[row + col];
                    return (
                      <div key={col} style={{
                        width: 40, height: 40,
                        background: p.icon ? 'var(--panel3)' : 'var(--panel)',
                        border: `1px solid ${p.color ?? 'var(--line)'}`,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: 16, color: p.color ?? 'var(--faint)',
                      }}>{p.icon}</div>
                    );
                  })}
                </div>
              ))}
              <Dot n={1} style={{ top: 8, left: 8 }} />
            </div>
            {/* Stats panel */}
            <div style={{
              width: 120, borderLeft: '1px solid var(--line)',
              padding: '10px 10px', display: 'flex', flexDirection: 'column', gap: 5,
              position: 'relative', flexShrink: 0,
            }}>
              <div style={{ fontSize: 9, color: 'var(--faint)', fontFamily: "'Press Start 2P'", marginBottom: 4 }}>STATS</div>
              {[
                { label: 'HULL', val: '120', color: 'var(--bone)' },
                { label: 'DPS', val: '38', color: 'var(--red)' },
                { label: 'RANGE', val: '2', color: 'var(--teal)' },
                { label: 'CREDITS', val: '1,240◈', color: 'var(--amber)' },
                { label: 'ARTIFACTS', val: '1', color: 'var(--purple)' },
              ].map(({ label, val, color }) => (
                <div key={label} style={{ fontSize: 12 }}>
                  <span style={{ color: 'var(--faint)' }}>{label} </span>
                  <span style={{ color }}>{val}</span>
                </div>
              ))}
              <Dot n={2} style={{ top: 8, right: -10 }} />
              <Dot n={3} style={{ bottom: 8, right: -10 }} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function CombatScreen() {
  function Bar({ pct, color }: { pct: number; color: string }) {
    return (
      <div style={{ height: 6, background: 'var(--panel3)', border: '1px solid var(--line)', borderRadius: 2 }}>
        <div style={{ height: '100%', width: `${pct}%`, background: color, borderRadius: 2 }} />
      </div>
    );
  }

  function Ship({ label, color, facing, hullPct, shieldPct }: {
    label: string; color: string; facing: 'right' | 'left'; hullPct: number; shieldPct: number;
  }) {
    return (
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, position: 'relative' }}>
        <div style={{ fontSize: 9, color, fontFamily: "'Press Start 2P'" }}>{label}</div>
        <div style={{ fontSize: 36, transform: facing === 'left' ? 'scaleX(-1)' : undefined, color, lineHeight: 1 }}>▲</div>
        <div style={{ width: '80%' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: 'var(--dim)', marginBottom: 2 }}>
            <span>HULL</span><span>{hullPct}%</span>
          </div>
          <Bar pct={hullPct} color={color} />
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: 'var(--dim)', marginTop: 4, marginBottom: 2 }}>
            <span>SHIELD</span><span>{shieldPct}%</span>
          </div>
          <Bar pct={shieldPct} color="rgba(95,168,164,0.7)" />
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <MockHUD />
      <div style={{ flex: 1, background: 'var(--void)', position: 'relative', display: 'flex', flexDirection: 'column', minHeight: 0 }}>
        {/* Round counter */}
        <div style={{
          padding: '6px 14px', borderBottom: '1px solid var(--line)',
          fontFamily: "'Press Start 2P'", fontSize: 8, color: 'var(--faint)',
          textAlign: 'center', background: 'var(--panel)', flexShrink: 0,
        }}>ROUND 4 / 20</div>

        {/* Ships */}
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', padding: '0 12px', gap: 8, position: 'relative', minHeight: 0 }}>
          <Ship label="YOU" color="var(--teal)" facing="right" hullPct={62} shieldPct={50} />

          {/* Combat log / weapon fire */}
          <div style={{
            width: 90, flexShrink: 0,
            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, position: 'relative',
          }}>
            <div style={{
              fontFamily: "'Press Start 2P'", fontSize: 7,
              color: 'var(--amber)', textAlign: 'center', lineHeight: 1.6,
            }}>LASER<br />×2.0 vs SHIELD</div>
            <div style={{ width: 60, height: 2, background: 'linear-gradient(90deg, var(--teal), var(--red))' }} />
            <div style={{
              fontFamily: "'Press Start 2P'", fontSize: 7,
              color: 'var(--dim)', textAlign: 'center', lineHeight: 1.6,
            }}>RAILGUN<br />×1.5 vs ARMOR</div>
            <Dot n={3} style={{ top: -10, left: '50%', transform: 'translateX(-50%)' }} />
          </div>

          <Ship label="ENEMY" color="var(--red)" facing="left" hullPct={28} shieldPct={0} />
          <Dot n={1} style={{ top: 10, left: 10 }} />
          <Dot n={2} style={{ top: 10, right: 10 }} />
        </div>

        {/* Outcome hint */}
        <div style={{
          padding: '8px 14px', borderTop: '1px solid var(--line)',
          display: 'flex', justifyContent: 'center', gap: 20, flexShrink: 0, background: 'var(--panel)',
        }}>
          <span style={{ fontSize: 12, color: 'var(--dim)' }}>WINNER LOOTS A MODULE, ARTIFACT, OR CREDITS</span>
        </div>
      </div>
    </div>
  );
}

function EndTurnScreen() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <MockHUD phase="ACTION" />
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: 'var(--void)', minHeight: 0 }}>
        {/* Map area */}
        <div style={{ flex: 1, position: 'relative', minHeight: 0 }}>
          <GalaxyMap />
          {/* Rival's turn glow hint */}
          <div style={{
            position: 'absolute', top: 8, left: 0, right: 0, textAlign: 'center',
            fontFamily: "'Press Start 2P'", fontSize: 7, color: 'var(--amber)',
          }}>WAITING FOR OTHER PLAYERS…</div>
        </div>
        {/* Action bar */}
        <div style={{
          flexShrink: 0, background: 'var(--panel2)', borderTop: '1px solid var(--line)',
          padding: '10px 12px', display: 'flex', gap: 8, alignItems: 'center', position: 'relative',
        }}>
          <div style={{
            flex: 1, padding: '8px 12px', border: '2px solid var(--teal)',
            color: 'var(--teal)', fontSize: 14, fontFamily: "'VT323'", textAlign: 'center',
            background: 'rgba(95,168,164,0.08)', position: 'relative',
          }}>
            ⟳ END TURN
            <Dot n={1} style={{ top: -10, left: '50%', transform: 'translateX(-50%)' }} />
          </div>
          <div style={{
            padding: '8px 12px', border: '1px solid var(--line)',
            color: 'var(--dim)', fontSize: 14, fontFamily: "'VT323'",
            position: 'relative',
          }}>
            ⇄ STATION
            <Dot n={2} style={{ top: -10, right: -10 }} />
          </div>
          <div style={{
            padding: '8px 12px', border: '1px solid var(--line)',
            color: 'var(--dim)', fontSize: 14, fontFamily: "'VT323'",
            position: 'relative',
          }}>
            ✦ SHIPYARD
            <Dot n={3} style={{ top: -10, right: -10 }} />
          </div>
          <Dot n={4} style={{ top: -12, left: 8 }} />
        </div>
      </div>
    </div>
  );
}

// ── Step definitions ─────────────────────────────────────────────────────────

interface TourStep {
  screen: string;
  title: string;
  content: React.ReactNode;
  annotations: { label: string; detail: string }[];
}

const STEPS: TourStep[] = [
  {
    screen: 'HUD',
    title: 'Dein Command Strip',
    content: <HUDScreen />,
    annotations: [
      { label: 'Fraktion & Position', detail: 'Links steht deine Fraktion und das System, in dem du gerade bist.' },
      { label: 'Bewegungsphase', detail: 'MOVE zeigt, wie viele Sprünge du in diesem Zug noch machen kannst. Danach wechselt es zu ACTION.' },
      { label: 'Zyklen', detail: 'CYC zeigt den aktuellen Zyklus. Nach 20 Zyklen endet das Spiel — wer die meisten Artifacts hat, gewinnt.' },
      { label: 'Ressourcen', detail: 'Credits ◈ für Käufe · Fuel ⛽ für Sprünge · Cargo für Handelsgüter · ART für gesammelte Artifacts.' },
    ],
  },
  {
    screen: 'STAR MAP',
    title: 'Die Galaxie navigieren',
    content: <StarMapScreen />,
    annotations: [
      { label: 'Systeme antippen', detail: 'Tippe auf ein Sternsystem um das Aktions-Panel zu öffnen und zu sehen, was dort los ist.' },
      { label: 'Rumored Artifact', detail: 'Der leuchtende Amber-Punkt ist das aktuelle Ziel. Nur ein Artifact ist gleichzeitig aktiv — alle konvergieren darauf.' },
      { label: 'Rivalen', detail: 'Rote Dreiecke sind gegnerische Schiffe. Tippe auf ihr System um es zu scouten — oder anzugreifen.' },
      { label: 'Stationen', detail: 'Systeme mit Türkis-Rand haben eine Station. Dort kannst du tanken, handeln und Crew anheuern.' },
    ],
  },
  {
    screen: 'AKTIONEN',
    title: 'Was kannst du tun?',
    content: <MapPanelScreen />,
    annotations: [
      { label: 'JUMP HERE', detail: 'Fliege in dieses System. Der Sprung kostet Fuel — je weiter, desto mehr. Prüfe erst deinen Tankstand!' },
      { label: 'CLAIM ARTIFACT', detail: 'Wenn das Rumored Artifact hier ist und du genug Credits hast, kannst du es hier beanspruchen.' },
      { label: 'ATTACK', detail: 'Fordere einen Rivalen im selben System zum Kampf heraus. Der Sieger plündert ein Modul, Artifact oder Credits.' },
      { label: 'Systeminfo', detail: 'Das Panel zeigt: ob eine Station da ist, Sprungkosten, und welche Artifacts / Schiffe sich im System befinden.' },
    ],
  },
  {
    screen: 'SHIPYARD',
    title: 'Schiff ausrüsten',
    content: <ShipyardScreen />,
    annotations: [
      { label: '3×3 Grid', detail: 'Dein Schiff hat 9 Slots. Ziehe Waffen, Schilde und Module per Tap in die Felder — Anordnung und Nachbarschaft beeinflussen die Stats.' },
      { label: 'Palette (Waffen & Schilde)', detail: 'Links siehst du alle Module in deinem Inventar. Tippe eins an, um es im Grid zu platzieren oder zu tauschen.' },
      { label: 'Artifacts im Grid', detail: 'Geclaimte Artifacts müssen hier ins Grid, um ihren Kampfeffekt zu aktivieren. Sie belegen normale Slots.' },
      { label: 'Fraktionssilhouette', detail: 'Jede Fraktion hat eine eigene Schiffsform — nur ein Designelement, beeinflusst keine Stats.' },
    ],
  },
  {
    screen: 'STATION',
    title: 'Station andocken',
    content: <StationScreen />,
    annotations: [
      { label: 'MARKET', detail: 'Kaufe Handelsgüter günstig hier und verkaufe sie teuer an einer anderen Station. Haupteinnahmequelle.' },
      { label: 'FUEL', detail: 'Tanke dein Schiff auf. Fuel kostet Credits — ohne Tank bist du gefangen.' },
      { label: 'CREW', detail: 'Heuere Crew für dauerhafte Boni an: Trader erhöht Verkaufspreise, Navigator verlängert Sprungreichweite.' },
      { label: 'MODULES', detail: 'Kaufe Schiffsmodule und verkaufe alte für 50% des Kaufpreises. Hier baust du dein Inventar auf.' },
    ],
  },
  {
    screen: 'COMBAT',
    title: 'Auto-Kampf',
    content: <CombatScreen />,
    annotations: [
      { label: 'Dein Schiff', detail: 'Links dein Schiff, rechts der Gegner. Beide feuern automatisch — dein Build bestimmt das Ergebnis.' },
      { label: 'HP-Balken', detail: 'Hull HP ist dein Leben. Shields regenerieren sich pro Runde und absorbieren Treffer zuerst. Hull auf 0 = Niederlage.' },
      { label: 'RPS-Counters', detail: 'Laser ×2.0 vs Shields · Railgun ×1.5 vs Armor · Missiles ignorieren Shields. Inspiziere den Gegner-Build vor dem Angriff!' },
    ],
  },
  {
    screen: 'COMMANDER',
    title: 'Gegner inspizieren',
    content: <CommanderScreen />,
    annotations: [
      { label: 'Build-Grid', detail: 'Tippe auf das Dreieck eines Rivalen auf der Karte um seinen kompletten Build zu sehen — Waffen, Schilde, Artifacts.' },
      { label: 'Stats', detail: 'Schaden, Reichweite, Credits und Artifact-Anzahl auf einen Blick. Planst du einen Angriff? Check das vorher.' },
      { label: 'Artifact-Besitz', detail: 'Wer viele Artifacts hat, ist das Hauptziel. Angriff auf einen Artifact-reichen Rivalen ist riskant aber lohnend.' },
    ],
  },
  {
    screen: 'ZUG BEENDEN',
    title: 'Zug & Aktionsleiste',
    content: <EndTurnScreen />,
    annotations: [
      { label: 'END TURN', detail: 'Wenn du fertig bist, drücke END TURN. Danach ist der nächste Spieler dran — sein Bildschirm pulst amber.' },
      { label: 'STATION öffnen', detail: 'STATION kannst du auch direkt über die Aktionsleiste öffnen, wenn du in einem System mit Station bist.' },
      { label: 'SHIPYARD öffnen', detail: 'Der Shipyard ist jederzeit über die Aktionsleiste erreichbar — Umbau dauert keinen Zug.' },
      { label: 'Zugphase', detail: 'MOVE = springen. Sobald alle Sprünge aufgebraucht sind, wechselt die Phase zu ACTION. Dann kannst du kämpfen oder claimen.' },
    ],
  },
];

// ── TourOverlay ──────────────────────────────────────────────────────────────

export function TourOverlay({ onClose }: { onClose: () => void }) {
  const [step, setStep] = useState(0);
  const cur = STEPS[step];
  const isFirst = step === 0;
  const isLast = step === STEPS.length - 1;

  function advance() {
    if (isLast) onClose();
    else setStep(s => s + 1);
  }

  return (
    <div
      className="tour-overlay"
      tabIndex={-1}
      onKeyDown={e => {
        if (e.key === 'ArrowRight' && !isLast) setStep(s => s + 1);
        if (e.key === 'ArrowLeft' && !isFirst) setStep(s => s - 1);
        if (e.key === 'Escape') onClose();
      }}
    >
      {/* Top bar */}
      <div className="tour-topbar">
        <span className="tour-screen-badge">{cur.screen}</span>
        <span className="tour-step-count">{step + 1} / {STEPS.length}</span>
        <button className="station-close" onClick={onClose}>✕</button>
      </div>

      {/* Full-size screen area — tap to advance */}
      <div className="tour-screen" onClick={advance}>
        {cur.content}
        <div className="tour-tap-hint">TIPPEN UM WEITERZUGEHEN</div>
      </div>

      {/* Annotation sheet */}
      <div className="tour-ann-sheet">
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

      {/* Navigation */}
      <div className="tour-nav">
        <button className="btn ghost" disabled={isFirst} onClick={() => setStep(s => s - 1)}>
          ← ZURÜCK
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
          {isLast ? 'FERTIG' : 'WEITER →'}
        </button>
      </div>
    </div>
  );
}
