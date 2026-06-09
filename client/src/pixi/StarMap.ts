import * as PIXI from 'pixi.js';
import type { Galaxy, Player } from '@stellar-dominion/shared';
import { FACTIONS } from '@stellar-dominion/shared';

const C = {
  void:   0x0c1018,
  panel:  0x161d2a,
  line:   0x2c3a4d,
  bone:   0xe9e3d4,
  dim:    0x8b96a6,
  faint:  0x586374,
  amber:  0xd9a441,
  teal:   0x5fa8a4,
  red:    0xe8512e,
  purple: 0x8a7caa,
  green:  0x8a9a5b,
};

function hexStr(h: string): number {
  return parseInt(h.replace('#', ''), 16);
}

// ── Dashed line helper ────────────────────────────────────────────────────────
function dashLine(
  g: PIXI.Graphics,
  x1: number, y1: number,
  x2: number, y2: number,
  dash = 5, gap = 6, margin = 10,
) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const len = Math.sqrt(dx * dx + dy * dy);
  if (len < margin * 2) return;
  const nx = dx / len;
  const ny = dy / len;
  let pos = margin;
  while (pos < len - margin) {
    const end = Math.min(pos + dash, len - margin);
    g.moveTo(x1 + nx * pos, y1 + ny * pos);
    g.lineTo(x1 + nx * end, y1 + ny * end);
    pos = end + gap;
  }
}

// ── StarMap class ─────────────────────────────────────────────────────────────

export class StarMap {
  private app: PIXI.Application;
  private starsGfx  = new PIXI.Graphics();
  private lanesGfx  = new PIXI.Graphics();
  private sysLayer  = new PIXI.Container();
  private shipLayer = new PIXI.Container();

  // animated refs
  private rumorGlyphs: PIXI.Text[]    = [];
  private myShipTri:   PIXI.Graphics | null = null;

  onSystemClick: ((id: number) => void) | null = null;

  constructor(
    canvas: HTMLCanvasElement,
    private galaxy: Galaxy,
    private players: Player[],
    private myPlayerId: string,
    private selectedId: number | null,
    private rumorSystemId: number | null,
  ) {
    const w = canvas.clientWidth  || 800;
    const h = canvas.clientHeight || 500;

    this.app = new PIXI.Application({
      view: canvas,
      width: w,
      height: h,
      backgroundColor: C.void,
      antialias: false,
      resolution: Math.min(window.devicePixelRatio ?? 1, 2),
      autoDensity: true,
    });

    this.app.stage.addChild(
      this.starsGfx,
      this.lanesGfx,
      this.sysLayer,
      this.shipLayer,
    );

    this.drawStars();
    this.redraw();

    let t = 0;
    this.app.ticker.add((delta) => {
      t += delta * 0.04;
      const a = 0.45 + 0.55 * Math.abs(Math.sin(t));
      this.rumorGlyphs.forEach((g) => { g.alpha = a; });
      if (this.myShipTri) this.myShipTri.alpha = 0.5 + 0.5 * Math.abs(Math.sin(t * 0.7));
    });
  }

  // ── Public API ─────────────────────────────────────────────────────────────

  update(
    galaxy: Galaxy,
    players: Player[],
    selectedId: number | null,
    rumorSystemId: number | null,
  ) {
    this.galaxy       = galaxy;
    this.players      = players;
    this.selectedId   = selectedId;
    this.rumorSystemId = rumorSystemId;
    this.redraw();
  }

  resize() {
    const canvas = this.app.view as HTMLCanvasElement;
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;
    this.app.renderer.resize(w, h);
    this.drawStars();
    this.redraw();
  }

  /** Freeze/unfreeze rendering — use during combat to suppress WebGL output. */
  setVisible(visible: boolean) {
    this.app.stage.visible = visible;
    if (visible) {
      this.app.ticker.start();
    } else {
      this.app.ticker.stop();
      // Clear to background so the GPU layer shows solid black, not a stale frame
      (this.app.renderer as PIXI.Renderer).clear();
    }
  }

  destroy() {
    this.app.destroy(false);
  }

  // ── Private draw ───────────────────────────────────────────────────────────

  private redraw() {
    this.drawLanes();
    this.drawSystems();
    this.drawShips();
  }

  private px(xPct: number) { return (xPct / 100) * this.app.screen.width;  }
  private py(yPct: number) { return (yPct / 100) * this.app.screen.height; }

  private drawStars() {
    const g = this.starsGfx;
    g.clear();
    const W = this.app.screen.width;
    const H = this.app.screen.height;
    for (let i = 0; i < 140; i++) {
      const x = ((i * 2971 + 13) % 997) / 997 * W;
      const y = ((i * 1723 + 7)  % 991) / 991 * H;
      const alpha = 0.06 + ((i * 431) % 100) / 280;
      const sz = i % 9 === 0 ? 2 : 1;
      g.beginFill(C.bone, alpha);
      g.drawRect(Math.floor(x), Math.floor(y), sz, sz);
      g.endFill();
    }
  }

  private drawLanes() {
    const g = this.lanesGfx;
    g.clear();
    g.lineStyle(1, C.teal, 0.22);
    for (const [a, b] of this.galaxy.lanes) {
      const sa = this.galaxy.systems[a];
      const sb = this.galaxy.systems[b];
      dashLine(
        g,
        this.px(sa.pos.x), this.py(sa.pos.y),
        this.px(sb.pos.x), this.py(sb.pos.y),
      );
    }
    g.lineStyle(0);
  }

  private drawSystems() {
    this.sysLayer.removeChildren();
    this.rumorGlyphs = [];

    for (const sys of this.galaxy.systems) {
      const x = this.px(sys.pos.x);
      const y = this.py(sys.pos.y);
      const isRumor    = sys.id === this.rumorSystemId;
      const isSelected = sys.id === this.selectedId;

      const ct = new PIXI.Container();
      ct.x = x;
      ct.y = y;

      // selection ring
      if (isSelected) {
        const ring = new PIXI.Graphics();
        ring.lineStyle(1, C.bone, 0.65);
        ring.drawRect(-13, -13, 26, 26);
        ring.lineStyle(0);
        ct.addChild(ring);
      }

      // glow halo for rumor
      if (isRumor) {
        const halo = new PIXI.Graphics();
        halo.lineStyle(1, C.amber, 0.3);
        halo.drawRect(-10, -10, 20, 20);
        halo.lineStyle(0);
        ct.addChild(halo);
      }

      // system dot
      const dotColor = isRumor ? C.amber : C.dim;
      const dot = new PIXI.Graphics();
      dot.beginFill(dotColor);
      dot.drawRect(-5, -5, 10, 10);
      dot.endFill();
      ct.addChild(dot);

      // station indicator (small teal dot)
      if (sys.hasStation) {
        const stDot = new PIXI.Graphics();
        stDot.beginFill(C.teal, 0.8);
        stDot.drawRect(0, 0, 3, 3);
        stDot.endFill();
        stDot.x = 7;
        stDot.y = -8;
        ct.addChild(stDot);
      }

      // rumor glyph (animated ✦)
      if (isRumor) {
        const glyph = new PIXI.Text('✦', new PIXI.TextStyle({
          fontFamily: 'VT323',
          fontSize: 18,
          fill: C.amber,
        }));
        glyph.anchor.set(0.5, 1);
        glyph.y = -8;
        ct.addChild(glyph);
        this.rumorGlyphs.push(glyph);
      }

      // system name label
      const label = new PIXI.Text(sys.name, new PIXI.TextStyle({
        fontFamily: 'VT323',
        fontSize: 12,
        fill: C.bone,
        align: 'center',
      }));
      label.anchor.set(0.5, 0);
      label.y = 9;
      ct.addChild(label);

      // hit area
      const hit = new PIXI.Graphics();
      hit.beginFill(0xffffff, 0.001);
      hit.drawCircle(0, 0, 18);
      hit.endFill();
      hit.interactive = true;
      hit.cursor = 'pointer';
      hit.on('pointerdown', () => this.onSystemClick?.(sys.id));
      ct.addChild(hit);

      this.sysLayer.addChild(ct);
    }
  }

  private drawShips() {
    this.shipLayer.removeChildren();
    this.myShipTri = null;

    // Group players by system so we can spread their icons around the node
    const playersBySystem = new Map<number, Player[]>();
    for (const player of this.players) {
      if (!playersBySystem.has(player.systemId)) playersBySystem.set(player.systemId, []);
      playersBySystem.get(player.systemId)!.push(player);
    }

    // Clockwise offsets around a system node for up to 6 ships
    const SLOT_OFFSETS = [
      { dx:  13, dy: -13 }, // top-right
      { dx: -20, dy: -13 }, // top-left
      { dx:  13, dy:   8 }, // bottom-right
      { dx: -20, dy:   8 }, // bottom-left
      { dx:   0, dy: -20 }, // top-center
      { dx:   0, dy:  15 }, // bottom-center
    ];

    for (const player of this.players) {
      const sys   = this.galaxy.systems[player.systemId];
      const color = hexStr(player.color);
      const isMe  = player.id === this.myPlayerId;

      const playersHere = playersBySystem.get(player.systemId)!;
      const slotIdx = playersHere.indexOf(player);
      const off = SLOT_OFFSETS[slotIdx] ?? SLOT_OFFSETS[0];

      const ct = new PIXI.Container();
      ct.x = this.px(sys.pos.x) + off.dx;
      ct.y = this.py(sys.pos.y) + off.dy;

      // triangle ship
      const tri = new PIXI.Graphics();
      tri.beginFill(color);
      tri.drawPolygon([ 0, -8,  -5, 5,  5, 5 ]);
      tri.endFill();
      ct.addChild(tri);

      if (isMe) this.myShipTri = tri;

      // faction label
      const nameText = new PIXI.Text(
        FACTIONS[player.factionId].name.substring(0, 5),
        new PIXI.TextStyle({ fontFamily: 'VT323', fontSize: 11, fill: color }),
      );
      nameText.x = 7;
      nameText.y = -8;
      ct.addChild(nameText);

      // artifact count
      if (player.artifacts.length > 0) {
        const artText = new PIXI.Text(
          `✦${player.artifacts.length}`,
          new PIXI.TextStyle({ fontFamily: 'VT323', fontSize: 11, fill: C.amber }),
        );
        artText.x = 7;
        artText.y = 3;
        ct.addChild(artText);
      }

      this.shipLayer.addChild(ct);
    }
  }
}
