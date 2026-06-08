import React from 'react';
import type { FactionId } from '@stellar-dominion/shared';
import { FACTIONS } from '@stellar-dominion/shared';

const SVG_STYLE: React.CSSProperties = {
  position: 'absolute',
  inset: 0,
  width: '100%',
  height: '100%',
};

// Vol'Kesh: wide, opulent merchant freighter — bulging cargo hull, rounded bow
function VolkeshHull({ color }: { color: string }) {
  const fill = color + '18';
  return (
    <svg viewBox="0 0 200 290" style={SVG_STYLE}>
      {/* Wide barrel hull */}
      <polygon
        points="70,18 130,18 162,60 172,130 168,210 140,262 60,262 32,210 28,130 38,60"
        fill={fill} stroke={color} strokeWidth="2" strokeLinejoin="round"
      />
      {/* Side cargo bulges */}
      <ellipse cx="28" cy="145" rx="18" ry="55" fill={fill} stroke={color} strokeWidth="1.5"/>
      <ellipse cx="172" cy="145" rx="18" ry="55" fill={fill} stroke={color} strokeWidth="1.5"/>
      {/* Ornate bow ridge */}
      <polygon points="88,18 100,6 112,18" fill={color} opacity="0.5"/>
      {/* Dual wide nozzles */}
      <rect x="66" y="254" width="28" height="34" rx="6" fill={color} opacity="0.45"/>
      <rect x="106" y="254" width="28" height="34" rx="6" fill={color} opacity="0.45"/>
      {/* Zone dividers */}
      <line x1="32" y1="118" x2="168" y2="118" stroke={color} strokeWidth="1" strokeOpacity="0.3" strokeDasharray="5,5"/>
      <line x1="30" y1="202" x2="170" y2="202" stroke={color} strokeWidth="1" strokeOpacity="0.3" strokeDasharray="5,5"/>
    </svg>
  );
}

// Korthaar: heavy angular warship — brutal wedge, aggressive forward spikes
function KorthaarHull({ color }: { color: string }) {
  const fill = color + '18';
  return (
    <svg viewBox="0 0 200 290" style={SVG_STYLE}>
      {/* Bow spike */}
      <polygon points="100,2 116,62 84,62" fill={fill} stroke={color} strokeWidth="2" strokeLinejoin="round"/>
      {/* Heavy angular body */}
      <polygon
        points="76,58 124,58 148,140 144,220 100,262 56,220 52,140"
        fill={fill} stroke={color} strokeWidth="2" strokeLinejoin="round"
      />
      {/* Forward weapon booms — long and aggressive */}
      <polygon points="80,80 4,112 72,136" fill={fill} stroke={color} strokeWidth="2"/>
      <polygon points="120,80 196,112 128,136" fill={fill} stroke={color} strokeWidth="2"/>
      {/* Boom tip spikes */}
      <polygon points="4,112 -4,108 -2,120" fill={color} opacity="0.7"/>
      <polygon points="196,112 204,108 202,120" fill={color} opacity="0.7"/>
      {/* Heavy exhaust */}
      <rect x="80" y="220" width="40" height="50" rx="2" fill={color} opacity="0.45"/>
      {/* Zone dividers */}
      <line x1="58" y1="126" x2="142" y2="126" stroke={color} strokeWidth="1" strokeOpacity="0.3" strokeDasharray="5,5"/>
      <line x1="54" y1="208" x2="146" y2="208" stroke={color} strokeWidth="1" strokeOpacity="0.3" strokeDasharray="5,5"/>
    </svg>
  );
}

// Idryn: elegant symmetric light-ship — curved swept wings, luminous narrow fuselage
function IdrynHull({ color }: { color: string }) {
  const fill = color + '18';
  return (
    <svg viewBox="0 0 200 290" style={SVG_STYLE}>
      {/* Narrow tapered fuselage */}
      <polygon
        points="100,4 116,72 120,230 100,274 80,230 84,72"
        fill={fill} stroke={color} strokeWidth="2" strokeLinejoin="round"
      />
      {/* Gracefully swept wings — curved via two-segment polygons */}
      <polygon points="84,140 14,172 20,210 82,206" fill={fill} stroke={color} strokeWidth="1.5"/>
      <polygon points="116,140 186,172 180,210 118,206" fill={fill} stroke={color} strokeWidth="1.5"/>
      {/* Wing-tip glow points */}
      <circle cx="14" cy="191" r="4" fill={color} opacity="0.6"/>
      <circle cx="186" cy="191" r="4" fill={color} opacity="0.6"/>
      {/* Twin nacelle engines */}
      <rect x="80" y="248" width="18" height="40" rx="5" fill={color} opacity="0.45"/>
      <rect x="102" y="248" width="18" height="40" rx="5" fill={color} opacity="0.45"/>
      {/* Zone dividers */}
      <line x1="84" y1="122" x2="116" y2="122" stroke={color} strokeWidth="1" strokeOpacity="0.3" strokeDasharray="5,5"/>
      <line x1="82" y1="208" x2="118" y2="208" stroke={color} strokeWidth="1" strokeOpacity="0.3" strokeDasharray="5,5"/>
    </svg>
  );
}

// Nyxari: scout with long sensor antennae — slender, forward-facing masts, narrow solar sails
function NyxariHull({ color }: { color: string }) {
  const fill = color + '18';
  return (
    <svg viewBox="0 0 200 290" style={SVG_STYLE}>
      {/* Narrow scout fuselage */}
      <polygon
        points="100,20 112,80 114,230 100,270 86,230 88,80"
        fill={fill} stroke={color} strokeWidth="2" strokeLinejoin="round"
      />
      {/* Long sensor antennae at bow */}
      <line x1="96" y1="20" x2="76" y2="2" stroke={color} strokeWidth="2"/>
      <line x1="104" y1="20" x2="124" y2="2" stroke={color} strokeWidth="2"/>
      <circle cx="76" cy="2" r="3" fill={color} opacity="0.8"/>
      <circle cx="124" cy="2" r="3" fill={color} opacity="0.8"/>
      {/* Short secondary antennae */}
      <line x1="94" y1="28" x2="60" y2="12" stroke={color} strokeWidth="1.5" strokeOpacity="0.7"/>
      <line x1="106" y1="28" x2="140" y2="12" stroke={color} strokeWidth="1.5" strokeOpacity="0.7"/>
      {/* Thin solar sail wings */}
      <polygon points="88,150 20,180 88,200" fill={fill} stroke={color} strokeWidth="1.5"/>
      <polygon points="112,150 180,180 112,200" fill={fill} stroke={color} strokeWidth="1.5"/>
      {/* Single slim exhaust */}
      <rect x="91" y="244" width="18" height="44" rx="4" fill={color} opacity="0.45"/>
      {/* Zone dividers */}
      <line x1="88" y1="130" x2="112" y2="130" stroke={color} strokeWidth="1" strokeOpacity="0.3" strokeDasharray="5,5"/>
      <line x1="87" y1="214" x2="113" y2="214" stroke={color} strokeWidth="1" strokeOpacity="0.3" strokeDasharray="5,5"/>
    </svg>
  );
}

// Rask: asymmetric patchwork raider — deliberately unbalanced, jagged panels
function RaskHull({ color }: { color: string }) {
  const fill = color + '18';
  return (
    <svg viewBox="0 0 200 290" style={SVG_STYLE}>
      {/* Asymmetric main body */}
      <polygon
        points="94,10 128,10 152,68 158,170 140,252 90,258 56,216 52,130 68,68"
        fill={fill} stroke={color} strokeWidth="2" strokeLinejoin="round"
      />
      {/* Stolen weapon boom — left side only */}
      <polygon points="72,100 6,138 68,158" fill={fill} stroke={color} strokeWidth="1.5"/>
      {/* Salvaged engine pod bolted on right */}
      <polygon points="148,180 188,176 190,228 148,230" fill={fill} stroke={color} strokeWidth="1.5"/>
      {/* Patched hull plates — jagged seams */}
      <line x1="68" y1="68" x2="94" y2="100" stroke={color} strokeWidth="1.5" strokeOpacity="0.5"/>
      <line x1="128" y1="10" x2="148" y2="68" stroke={color} strokeWidth="1.5" strokeOpacity="0.5"/>
      <line x1="56" y1="165" x2="82" y2="175" stroke={color} strokeWidth="2" strokeOpacity="0.4"/>
      {/* Mismatched exhaust — two different sizes */}
      <rect x="82" y="244" width="22" height="38" rx="2" fill={color} opacity="0.45"/>
      <rect x="116" y="252" width="16" height="28" rx="2" fill={color} opacity="0.35"/>
      {/* Zone dividers */}
      <line x1="58" y1="125" x2="150" y2="125" stroke={color} strokeWidth="1" strokeOpacity="0.3" strokeDasharray="5,5"/>
      <line x1="56" y1="205" x2="148" y2="205" stroke={color} strokeWidth="1" strokeOpacity="0.3" strokeDasharray="5,5"/>
    </svg>
  );
}

// Vaesh: crystalline geometric AI vessel — diamond/hexagonal facets, perfect symmetry
function VaeshHull({ color }: { color: string }) {
  const fill = color + '18';
  return (
    <svg viewBox="0 0 200 290" style={SVG_STYLE}>
      {/* Primary crystal diamond hull */}
      <polygon
        points="100,6 142,80 148,180 100,264 52,180 58,80"
        fill={fill} stroke={color} strokeWidth="2" strokeLinejoin="round"
      />
      {/* Crystal facet lines — inner geometry */}
      <line x1="100" y1="6" x2="100" y2="264" stroke={color} strokeWidth="1" strokeOpacity="0.25"/>
      <line x1="58" y1="80" x2="148" y2="80" stroke={color} strokeWidth="1" strokeOpacity="0.25"/>
      <line x1="52" y1="180" x2="148" y2="180" stroke={color} strokeWidth="1" strokeOpacity="0.25"/>
      {/* Lateral crystal shards */}
      <polygon points="58,80 18,130 52,180" fill={fill} stroke={color} strokeWidth="1.5"/>
      <polygon points="142,80 182,130 148,180" fill={fill} stroke={color} strokeWidth="1.5"/>
      {/* Crystal tip glow */}
      <circle cx="100" cy="6" r="4" fill={color} opacity="0.7"/>
      {/* Symmetric crystal exhaust */}
      <polygon points="84,248 100,270 116,248 108,264 92,264" fill={color} opacity="0.45"/>
      {/* Zone dividers — precise geometric */}
      <line x1="62" y1="120" x2="138" y2="120" stroke={color} strokeWidth="1" strokeOpacity="0.35" strokeDasharray="4,4"/>
      <line x1="56" y1="186" x2="144" y2="186" stroke={color} strokeWidth="1" strokeOpacity="0.35" strokeDasharray="4,4"/>
    </svg>
  );
}

interface ShipContourProps {
  factionId: FactionId;
}

export function ShipContour({ factionId }: ShipContourProps) {
  const color = FACTIONS[factionId].color;
  switch (factionId) {
    case 'VOLKESH':  return <VolkeshHull  color={color} />;
    case 'KORTHAAR': return <KorthaarHull color={color} />;
    case 'IDRYN':    return <IdrynHull    color={color} />;
    case 'NYXARI':   return <NyxariHull   color={color} />;
    case 'RASK':     return <RaskHull     color={color} />;
    case 'VAESH':    return <VaeshHull    color={color} />;
  }
}
