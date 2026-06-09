import React, { useState, useRef } from 'react';
import { useGameStore, type StationTab, selectMyPlayer, selectCurrentSystem } from '../store';
import { CREW, CREW_IDS, PARTS, deriveStats, type GoodId, type CrewId } from '@stellar-dominion/shared';
import { getCargoTotal } from '@stellar-dominion/shared';

const PART_COLORS: Record<string, string> = {
  weapon:   'var(--red)',
  shield:   'var(--teal)',
  armor:    'var(--teal)',
  pointdef: 'var(--teal)',
  gen:      'var(--amber)',
  cap:      'var(--amber)',
  engine:   'var(--green)',
  util:     'var(--dim)',
  artifact: 'var(--purple)',
};

const WEAPON_STATS: Record<string, { damage: number; accuracy: number; cooldown: number }> = {
  'pulse-laser': { damage: 4,  accuracy: 0.85, cooldown: 14 },
  'railgun':     { damage: 8,  accuracy: 0.72, cooldown: 22 },
  'missile-pod': { damage: 5,  accuracy: 0.90, cooldown: 20 },
};

const RPS_INFO: Record<string, { strong?: string[]; weak?: string[] }> = {
  'pulse-laser':      { strong: ['×2.0 damage vs Shields'], weak: ['×0.6 damage vs Armor'] },
  'railgun':          { strong: ['×1.5 damage vs Armor'],   weak: ['×0.6 damage vs Shields'] },
  'missile-pod':      { strong: ['bypasses Shields'],       weak: ['50% intercepted by Point-Defense'] },
  'shield-projector': { strong: ['reduces Railgun ×0.6'],   weak: ['Laser ×2.0 through it'] },
  'armor-plate':      { strong: ['absorbs Laser ×0.6'],     weak: ['Railgun ×1.5 damage'] },
  'point-defense':    { strong: ['intercepts 50% of Missiles'], weak: [] },
};

const STAT_LABELS: Record<string, string> = {
  hull: 'Hull HP', shieldMax: 'Shield HP', shieldRegen: 'Shield Regen/tick',
  energyPerTick: 'Energy/tick', energyMax: 'Energy Storage',
  evasion: 'Evasion', range: 'Jump Range', cargo: 'Cargo', fireRate: 'Fire Rate Score',
};

function ModuleInfoPanel({ partId, onClose }: { partId: string; onClose: () => void }) {
  const part = PARTS[partId];
  if (!part) return null;
  const isExclusive = !!part.factionExclusive;
  const color = PART_COLORS[part.type] ?? 'var(--dim)';
  const combat = WEAPON_STATS[partId];
  const rps = RPS_INFO[partId];
  return (
    <div
      className="part-info-box"
      style={{ '--part-color': color, marginBottom: 10 } as React.CSSProperties}
    >
      <div className="part-info-header">
        <span
          className="part-info-icon"
          style={{ background: isExclusive ? 'var(--purple)' : color, color: isExclusive ? '#e9e3d4' : '#0c0f15' }}
        >
          {part.icon}
        </span>
        <div style={{ flex: 1 }}>
          <div className="part-info-name">{part.name}</div>
          <div className="part-info-type">
            {(part.damageType ?? part.defenseType ?? part.type).toUpperCase()} · {part.cost}◈
          </div>
        </div>
        <button className="part-info-close" onClick={onClose}>✕</button>
      </div>

      {Object.entries(part.stats).some(([, v]) => v) && (
        <div className="part-info-section">
          <div className="part-info-stat-label">STATS</div>
          {Object.entries(part.stats).map(([key, val]) => {
            if (!val) return null;
            const label = STAT_LABELS[key] ?? key;
            const display = key === 'evasion' ? `+${Math.round((val as number) * 100)}%` : `+${val}`;
            return (
              <div key={key} className="part-info-stat"><span>{label}</span><b>{display}</b></div>
            );
          })}
        </div>
      )}

      {combat && (
        <div className="part-info-section">
          <div className="part-info-stat-label">COMBAT</div>
          <div className="part-info-stat"><span>Damage</span><b>{combat.damage}</b></div>
          <div className="part-info-stat"><span>Accuracy</span><b>{Math.round(combat.accuracy * 100)}%</b></div>
          <div className="part-info-stat"><span>Cooldown</span><b>{combat.cooldown} ticks</b></div>
        </div>
      )}

      {rps && (rps.strong?.length || rps.weak?.length) ? (
        <div className="part-info-section">
          <div className="part-info-stat-label">COUNTERS</div>
          {rps.strong?.map((s, i) => <div key={i} className="part-info-rps part-info-rps--good">▲ {s}</div>)}
          {rps.weak?.map((s, i) => <div key={i} className="part-info-rps part-info-rps--bad">▼ {s}</div>)}
        </div>
      ) : null}

      {part.zoneAffinity.length > 0 && (
        <div className="part-info-section">
          <div className="part-info-stat-label">BEST ZONE</div>
          <div className="part-info-zones">
            {part.zoneAffinity.map((z) => (
              <span key={z} className="part-info-zone-badge">{z.toUpperCase()}</span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export function StationModal() {
  const store = useGameStore();
  const { isStationOpen, closeStation, stationTab, setStationTab } = store;
  if (!isStationOpen) return null;

  const player = selectMyPlayer(store);
  const sys = selectCurrentSystem(store);
  if (!player || !sys) return null;

  return (
    <div className="station-backdrop" onClick={closeStation}>
      <div className="station-modal" onClick={(e) => e.stopPropagation()}>
        <div className="station-header">
          <span className="station-title">STATION · {sys.name.toUpperCase()}</span>
          <button className="station-close" onClick={closeStation}>✕</button>
        </div>

        <div className="station-tabs">
          {(['market', 'fuel', 'crew', 'modules'] as StationTab[]).map((tab) => (
            <button
              key={tab}
              className={`station-tab ${stationTab === tab ? 'active' : ''}`}
              onClick={() => setStationTab(tab)}
            >
              {tab.toUpperCase()}
            </button>
          ))}
        </div>

        <div className="station-body">
          {stationTab === 'market'  && <MarketTab />}
          {stationTab === 'fuel'    && <FuelTab />}
          {stationTab === 'crew'    && <CrewTab />}
          {stationTab === 'modules' && <ModulesTab />}
        </div>
      </div>
    </div>
  );
}

// ── MARKET TAB ────────────────────────────────────────────────────────────────

function MarketTab() {
  const store = useGameStore();
  const player = selectMyPlayer(store)!;
  const sys = selectCurrentSystem(store)!;
  const { buyGood, sellGood } = store;
  const [qty, setQty] = useState<Record<string, number>>({});

  const stats = deriveStats(player.build, PARTS, player.factionId);
  const maxCargo = stats.cargo;
  const usedCargo = getCargoTotal(player);

  const traderMult = player.crew.includes('trader') ? 1.20 : 1.0;
  const hasSellBonus = traderMult !== 1.0;

  function effectiveSell(basePrice: number) { return Math.round(basePrice * traderMult); }
  function getQty(key: string) { return qty[key] ?? 1; }
  function setQ(key: string, v: number) { setQty((q) => ({ ...q, [key]: Math.max(1, v) })); }

  const buyGoods  = sys.market.filter((m) => m.mode === 'buy_only');
  const sellGoods = sys.market.filter((m) => m.mode === 'sell_only');

  const allSystems = store.matchState?.galaxy.systems ?? [];
  const tradeRoutes = buyGoods.flatMap(m =>
    allSystems
      .filter(s => s.hasStation && s.id !== sys.id)
      .flatMap(s =>
        s.market
          .filter(e => e.mode === 'sell_only' && e.good === m.good)
          .map(e => ({
            good: m.good,
            buyPrice: m.buy,
            system: s,
            sellPrice: effectiveSell(e.sell),
            profit: effectiveSell(e.sell) - m.buy,
          }))
      )
      .filter(r => r.profit > 0)
      .sort((a, b) => b.profit - a.profit)
  );

  return (
    <div className="station-tab-body">
      <div className="station-resource-bar">
        <span style={{ color: 'var(--amber)' }}>{player.credits}◈</span>
        <span style={{ color: 'var(--dim)' }}>CARGO: {usedCargo}/{maxCargo}</span>
      </div>

      {/* Specialty goods — station sells to player */}
      {buyGoods.length > 0 && (
        <>
          <div className="sect">BUY</div>
          {buyGoods.map((m) => {
            const q = getQty(m.good);
            const canAfford = player.credits >= m.buy * q;
            const hasSpace = usedCargo + q <= maxCargo;
            return (
              <div key={m.good} className="market-row">
                <div className="market-good-info">
                  <span className="market-good-name">{m.good.toUpperCase().replace('_', ' ')}</span>
                  <span className="market-price buy">BUY {m.buy}◈</span>
                  <span style={{ color: 'var(--dim)', fontSize: 13 }}>stock {m.stock}</span>
                </div>
                <div className="market-controls">
                  <button className="qty-btn" onClick={() => setQ(m.good, q - 1)}>-</button>
                  <span className="qty-val">{q}</span>
                  <button className="qty-btn" onClick={() => setQ(m.good, q + 1)}>+</button>
                  <button
                    className="btn primary"
                    style={{ width: 70, fontSize: 7 }}
                    disabled={!canAfford || !hasSpace || m.stock < q}
                    onClick={() => buyGood(m.good, q)}
                  >
                    BUY
                  </button>
                </div>
              </div>
            );
          })}
        </>
      )}

      {/* Secondary/import goods — station buys from player */}
      {sellGoods.length > 0 && (
        <>
          <div className="sect" style={{ marginTop: 14 }}>SELL</div>
          <div style={{ fontSize: 11, color: 'var(--faint)', marginBottom: 6 }}>
            This station buys these goods from you.
          </div>
          {sellGoods.map((m) => {
            const have = player.cargo[m.good as GoodId] ?? 0;
            const q = getQty('sell_' + m.good);
            const eff = effectiveSell(m.sell);
            return (
              <div key={m.good} className="market-row">
                <div className="market-good-info">
                  <span className="market-good-name">{m.good.toUpperCase().replace('_', ' ')}</span>
                  <span className="market-price sell">
                    PAYS {eff}◈
                    {hasSellBonus && (
                      <span style={{ fontSize: 11, color: 'var(--green)', marginLeft: 3 }}>
                        ×{traderMult.toFixed(2)}
                      </span>
                    )}
                  </span>
                  <span style={{ color: have > 0 ? 'var(--bone)' : 'var(--faint)', fontSize: 13 }}>
                    {have > 0 ? `you have ${have}×` : 'none in cargo'}
                  </span>
                </div>
                <div className="market-controls">
                  <button className="qty-btn" onClick={() => setQ('sell_' + m.good, Math.max(1, q - 1))}>-</button>
                  <span className="qty-val">{q}</span>
                  <button className="qty-btn" onClick={() => setQ('sell_' + m.good, Math.min(q + 1, Math.max(have, 1)))}>+</button>
                  <button
                    className="btn"
                    style={{ width: 70, fontSize: 7 }}
                    disabled={have < q}
                    onClick={() => sellGood(m.good, q)}
                  >
                    SELL
                  </button>
                </div>
              </div>
            );
          })}
        </>
      )}

      {/* Trade routes — stations that pay more for goods bought here */}
      {tradeRoutes.length > 0 && (
        <>
          <div className="sect" style={{ marginTop: 14 }}>TRADE ROUTES</div>
          <div style={{ fontSize: 11, color: 'var(--faint)', marginBottom: 6 }}>
            Stations that buy these goods at a higher price.
            {hasSellBonus && (
              <span style={{ color: 'var(--green)', marginLeft: 4 }}>×{traderMult.toFixed(2)} Trader bonus included.</span>
            )}
          </div>
          {tradeRoutes.map(r => (
            <div key={`${r.good}-${r.system.id}`} className="market-row">
              <div className="market-good-info" style={{ flex: 1 }}>
                <span className="market-good-name">{r.good.toUpperCase().replace('_', ' ')}</span>
                <span style={{ color: 'var(--dim)', fontSize: 12 }}> › {r.system.name}</span>
              </div>
              <div style={{ flexShrink: 0, textAlign: 'right', display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 2 }}>
                <span className="market-price sell">{r.sellPrice}◈</span>
                <span style={{ color: 'var(--green)', fontSize: 12, fontWeight: 600 }}>+{r.profit}◈/unit</span>
              </div>
            </div>
          ))}
        </>
      )}

      {buyGoods.length === 0 && sellGoods.length === 0 && (
        <div className="station-empty">No trade goods here.</div>
      )}
    </div>
  );
}

// ── FUEL TAB ──────────────────────────────────────────────────────────────────

function FuelTab() {
  const store = useGameStore();
  const player = selectMyPlayer(store)!;
  const sys = selectCurrentSystem(store)!;
  const { refuel } = store;
  const [amount, setAmount] = useState(10);

  const space = player.maxFuel - player.fuel;
  const maxBuy = Math.min(space, sys.fuelStock, Math.floor(player.credits / sys.fuelPrice));
  const cost = sys.fuelPrice * amount;
  const canAfford = player.credits >= cost;
  const fits = player.fuel + amount <= player.maxFuel;

  return (
    <div className="station-tab-body">
      <div className="station-resource-bar">
        <span style={{ color: 'var(--amber)' }}>{player.credits}◈</span>
        <span style={{ color: 'var(--teal)' }}>{player.fuel}/{player.maxFuel}⛽</span>
      </div>

      <div className="fuel-info">
        <div className="kv"><span>PRICE</span><b>{sys.fuelPrice}◈/unit</b></div>
        <div className="kv"><span>AVAILABLE</span><b>{sys.fuelStock}⛽</b></div>
        <div className="kv"><span>YOUR TANK</span><b>{player.fuel}/{player.maxFuel}</b></div>
      </div>

      <div className="fuel-controls">
        <button className="qty-btn large" onClick={() => setAmount(Math.max(1, amount - 5))}>-5</button>
        <button className="qty-btn large" onClick={() => setAmount(Math.max(1, amount - 1))}>-</button>
        <span className="fuel-amount">{amount}⛽</span>
        <button className="qty-btn large" onClick={() => setAmount(Math.min(space, amount + 1))}>+</button>
        <button className="qty-btn large" onClick={() => setAmount(Math.min(space, amount + 5))}>+5</button>
      </div>

      <div style={{ textAlign: 'center', color: 'var(--dim)', fontSize: 15, marginBottom: 12 }}>
        Cost: <b style={{ color: canAfford ? 'var(--amber)' : 'var(--red)' }}>{cost}◈</b>
      </div>

      <button
        className="btn primary"
        disabled={!canAfford || !fits || sys.fuelStock < amount}
        onClick={() => refuel(amount)}
      >
        REFUEL {amount}⛽
      </button>

      {maxBuy > 0 && (
        <button
          className="btn"
          style={{ marginTop: 6 }}
          onClick={() => { const a = Math.min(space, sys.fuelStock, maxBuy); if (a > 0) refuel(a); }}
        >
          FILL TANK ({Math.min(space, sys.fuelStock, maxBuy)}⛽)
        </button>
      )}
    </div>
  );
}

// ── MODULES TAB ───────────────────────────────────────────────────────────────

function ModulesTab() {
  const store = useGameStore();
  const player = selectMyPlayer(store)!;
  const sys = selectCurrentSystem(store)!;
  const { buyModule, sellModule } = store;

  const [inspectedId, setInspectedId] = useState<string | null>(null);
  const [buyConfirm, setBuyConfirm] = useState<string | null>(null);
  const confirmTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const owned = player.ownedModules ?? [];
  const ownedCount: Record<string, number> = {};
  for (const id of owned) ownedCount[id] = (ownedCount[id] ?? 0) + 1;
  const equippedCount: Record<string, number> = {};
  for (const id of player.build.grid) {
    if (id && PARTS[id]) equippedCount[id] = (equippedCount[id] ?? 0) + 1;
  }

  function handleBuy(id: string) {
    buyModule(id);
    setBuyConfirm(PARTS[id]?.name ?? id);
    if (confirmTimerRef.current) clearTimeout(confirmTimerRef.current);
    confirmTimerRef.current = setTimeout(() => setBuyConfirm(null), 2000);
  }

  function toggleInspect(id: string) {
    setInspectedId((prev) => (prev === id ? null : id));
  }

  function ModuleIconSpan({ id }: { id: string }) {
    const part = PARTS[id];
    if (!part) return null;
    const isExclusive = !!part.factionExclusive;
    const color = PART_COLORS[part.type] ?? 'var(--dim)';
    return (
      <span style={{
        display: 'inline-block', width: 22, height: 22, lineHeight: '22px',
        textAlign: 'center', flexShrink: 0,
        background: isExclusive ? 'var(--purple)' : color,
        color: isExclusive ? '#e9e3d4' : '#0c0f15', fontSize: 12, marginRight: 8,
      }}>
        {part.icon}
      </span>
    );
  }

  return (
    <div className="station-tab-body">
      <div className="station-resource-bar">
        <span style={{ color: 'var(--amber)' }}>{player.credits}◈</span>
        <span style={{ color: 'var(--dim)', fontSize: 13 }}>
          INVENTORY: {owned.length} module{owned.length !== 1 ? 's' : ''}
        </span>
      </div>

      {/* Buy confirmation toast */}
      {buyConfirm && (
        <div style={{
          background: 'rgba(95,168,164,0.12)', border: '1px solid var(--teal)',
          color: 'var(--teal)', textAlign: 'center', padding: '7px 8px',
          fontSize: 10, letterSpacing: '0.05em', marginBottom: 8,
        }}>
          ✓ {buyConfirm.toUpperCase()} PURCHASED
        </div>
      )}

      {/* Available to buy */}
      <div className="sect">AVAILABLE HERE</div>
      <div style={{ fontSize: 11, color: 'var(--faint)', marginBottom: 6 }}>Tap a module for details.</div>
      {sys.stationModules.length === 0 && (
        <div className="station-empty">No modules sold here.</div>
      )}
      {sys.stationModules.map((id) => {
        const part = PARTS[id];
        if (!part) return null;
        const isExclusive = !!part.factionExclusive;
        const isMyFaction = part.factionExclusive === player.factionId;
        const canAfford = player.credits >= part.cost;
        const locked = isExclusive && !isMyFaction;
        const isSelected = inspectedId === id;
        return (
          <React.Fragment key={id}>
            <div
              className="market-row"
              style={{ cursor: 'pointer', outline: isSelected ? '1px solid var(--teal)' : undefined }}
              onClick={() => toggleInspect(id)}
            >
              <div className="market-good-info" style={{ flex: 1 }}>
                <ModuleIconSpan id={id} />
                <div style={{ display: 'inline-block', verticalAlign: 'top' }}>
                  <span className="market-good-name" style={{ color: isExclusive ? 'var(--purple)' : undefined }}>
                    {part.name}
                    {isExclusive && (
                      <span style={{ fontSize: 9, color: 'var(--purple)', marginLeft: 5, opacity: 0.8 }}>EXCL.</span>
                    )}
                  </span>
                  <br />
                  <span style={{ fontSize: 12, color: 'var(--dim)' }}>
                    {part.damageType ?? part.defenseType ?? part.type.toUpperCase()}
                  </span>
                </div>
              </div>
              <div style={{ textAlign: 'right', flexShrink: 0 }}>
                <div style={{ color: 'var(--amber)', fontSize: 14, marginBottom: 4 }}>{part.cost}◈</div>
                <button
                  className="btn primary"
                  style={{ fontSize: 6, padding: '4px 8px' }}
                  disabled={!canAfford || locked}
                  title={locked ? `Only ${part.factionExclusive} can buy this` : !canAfford ? `Need ${part.cost}◈` : ''}
                  onClick={(e) => { e.stopPropagation(); handleBuy(id); }}
                >
                  BUY
                </button>
              </div>
            </div>
            {isSelected && (
              <ModuleInfoPanel partId={id} onClose={() => setInspectedId(null)} />
            )}
          </React.Fragment>
        );
      })}

      {/* Sell inventory */}
      {owned.length > 0 && (
        <>
          <div className="sect" style={{ marginTop: 14 }}>YOUR INVENTORY</div>
          <div style={{ fontSize: 11, color: 'var(--faint)', marginBottom: 6 }}>
            Sell for 50% of buy price. Tap for details.
          </div>
          {Object.entries(ownedCount).map(([id, count]) => {
            const part = PARTS[id];
            if (!part) return null;
            const sellPrice = Math.floor(part.cost * 0.5);
            const isSelected = inspectedId === id;
            return (
              <React.Fragment key={id}>
                <div
                  className="market-row"
                  style={{ cursor: 'pointer', outline: isSelected ? '1px solid var(--teal)' : undefined }}
                  onClick={() => toggleInspect(id)}
                >
                  <div className="market-good-info" style={{ flex: 1 }}>
                    <ModuleIconSpan id={id} />
                    <div style={{ display: 'inline-block', verticalAlign: 'top' }}>
                      <span className="market-good-name">{part.name}</span>
                      <span style={{ color: 'var(--dim)', fontSize: 13, marginLeft: 6 }}>×{count}</span>
                      <br />
                      <span className="market-price sell">SELL {sellPrice}◈</span>
                    </div>
                  </div>
                  <div style={{ flexShrink: 0 }}>
                    <button
                      className="btn"
                      style={{ fontSize: 6, padding: '4px 8px' }}
                      onClick={(e) => { e.stopPropagation(); sellModule(id); }}
                    >
                      SELL 1
                    </button>
                  </div>
                </div>
                {isSelected && (
                  <ModuleInfoPanel partId={id} onClose={() => setInspectedId(null)} />
                )}
              </React.Fragment>
            );
          })}
        </>
      )}

      {/* Equipped modules (in grid) for reference */}
      {Object.keys(equippedCount).length > 0 && (
        <>
          <div className="sect" style={{ marginTop: 14 }}>EQUIPPED (IN GRID)</div>
          <div style={{ fontSize: 11, color: 'var(--faint)', marginBottom: 6 }}>
            Remove from grid in Shipyard to sell.
          </div>
          {Object.entries(equippedCount).map(([id, count]) => {
            const part = PARTS[id];
            if (!part) return null;
            const isSelected = inspectedId === id;
            return (
              <React.Fragment key={id}>
                <div
                  className="market-row"
                  style={{ opacity: 0.65, cursor: 'pointer', outline: isSelected ? '1px solid var(--teal)' : undefined }}
                  onClick={() => toggleInspect(id)}
                >
                  <div className="market-good-info" style={{ flex: 1 }}>
                    <ModuleIconSpan id={id} />
                    <div style={{ display: 'inline-block', verticalAlign: 'top' }}>
                      <span className="market-good-name">{part.name}</span>
                      <span style={{ color: 'var(--dim)', fontSize: 13, marginLeft: 6 }}>×{count}</span>
                      <br />
                      <span style={{ fontSize: 12, color: 'var(--teal)' }}>equipped</span>
                    </div>
                  </div>
                </div>
                {isSelected && (
                  <ModuleInfoPanel partId={id} onClose={() => setInspectedId(null)} />
                )}
              </React.Fragment>
            );
          })}
        </>
      )}
    </div>
  );
}

// ── CREW TAB ──────────────────────────────────────────────────────────────────

function CrewTab() {
  const store = useGameStore();
  const player = selectMyPlayer(store)!;
  const sys = selectCurrentSystem(store)!;
  const { hireCrew } = store;

  return (
    <div className="station-tab-body">
      <div className="station-resource-bar">
        <span style={{ color: 'var(--amber)' }}>{player.credits}◈</span>
        <span style={{ color: 'var(--dim)' }}>
          CREW: {player.crew.filter(Boolean).length}/{player.crew.length}
        </span>
      </div>

      <div className="sect">CURRENT CREW</div>
      <div className="crew-slots-row">
        {player.crew.map((c, i) => (
          <div key={i} className={`crew-slot-card ${c ? 'filled' : 'empty'}`}>
            <div className="crew-slot-icon">{c ? CREW[c].icon : '+'}</div>
            <div className="crew-slot-name">{c ? CREW[c].name : `SLOT ${i + 1}`}</div>
            {c && (
              <button
                className="btn"
                style={{ fontSize: 6, padding: '4px 6px', marginTop: 4 }}
                onClick={() => hireCrew(i, null, 0)}
              >
                DISMISS
              </button>
            )}
          </div>
        ))}
      </div>

      <div className="sect" style={{ marginTop: 14 }}>AVAILABLE FOR HIRE</div>
      {(sys.stationCrew ?? []).map((id) => {
        const c = CREW[id];
        const alreadyHired = player.crew.includes(id);
        const canAfford = player.credits >= c.cost;
        const hasSlot = player.crew.includes(null);
        return (
          <div key={id} className="crew-hire-row">
            <div className="crew-hire-icon">{c.icon}</div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 15, color: 'var(--bone)' }}>{c.name}
                <span style={{ fontSize: 12, color: 'var(--dim)', marginLeft: 8 }}>{c.role}</span>
              </div>
              <div style={{ fontSize: 13, color: 'var(--dim)' }}>{c.bonus}</div>
            </div>
            <div>
              <div style={{ color: 'var(--amber)', fontSize: 14, textAlign: 'right', marginBottom: 3 }}>{c.cost}◈</div>
              <button
                className="btn primary"
                style={{ fontSize: 6, padding: '4px 8px' }}
                disabled={alreadyHired || !canAfford || !hasSlot}
                onClick={() => {
                  const slot = player.crew.indexOf(null);
                  if (slot !== -1) hireCrew(slot, id as CrewId, c.cost);
                }}
              >
                {alreadyHired ? 'HIRED' : 'HIRE'}
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
