/**
 * Krunked Quest — Authoritative 16-Bit Neo-Retro Color Palettes
 * Exact extracted hex palettes for all 11 Biomes & all 6 Hero Forms,
 * anchored by crisp dark-plum pixel outlines (#180b20 / #24101f).
 */

import type { BiomeId, HeroFormId, Palette6 } from '../contracts/index.js';

export const OUTLINE_DARK = '#180b20';
export const OUTLINE_PLUM = '#24101f';
export const OUTLINE_VOID = '#0d0816';
export const HIGHLIGHT_CREAM = '#fff8ee';
export const FLASH_WHITE = '#ffffff';

export const UI_COLORS = {
  frameDark: '#180b20',
  frameMid: '#311a47',
  frameLight: '#6e4596',
  frameGold: '#ffd84d',
  frameGoldDark: '#a66214',
  panelBg: '#160c24',
  panelBgAlt: '#231338',
  heartBright: '#ffb8cc',
  heartMid: '#ff3366',
  heartDark: '#b81042',
  heartDeep: '#5e0a28',
  heartEmpty: '#321c42',
  heartEmptyInner: '#21112e',
  crystalLight: '#c4ffff',
  crystalMid: '#38e8ff',
  crystalDark: '#8c3dff',
  crystalDeep: '#371478',
  coinLight: '#fff8b8',
  coinMid: '#ffd838',
  coinDark: '#d98414',
  coinDeep: '#7d3c08',
  shieldLight: '#ffe7a1',
  shieldMid: '#ffad16',
  shieldDark: '#945f00',
  shieldGem: '#c44dff',
  magicShield: '#63f5ff',
  bossHpLight: '#ff9e66',
  bossHpMid: '#ff2b4a',
  bossHpDark: '#9c0d30',
  bossHpTrail: '#fff2cc',
  comboLow: '#3be8ff',
  comboMid: '#ffe140',
  comboHigh: '#ff42b3',
  comboMax: '#ffffff',
} as const;

/**
 * Exact 6-color hero form palettes:
 * [0] Primary bright body
 * [1] Midtone body
 * [2] Deep shadow body
 * [3] Signature accent (scarf / flame / vine / stone / bolt / aura)
 * [4] Highlight (horns / cheeks / crest tip)
 * [5] Deep contrast (boots / inner shadow / eyes)
 */
export const HERO_FORM_PALETTES: Readonly<
  Record<HeroFormId, readonly [string, string, string, string, string, string]>
> = {
  krunk_basic: ['#d42aff', '#9d1cd4', '#5b2a97', '#da0b35', '#fbb7ff', '#030835'],
  krunk_fire: ['#ff1f1f', '#cf0707', '#ff8a00', '#dc5800', '#ffc082', '#5b0d0d'],
  krunk_leaf: ['#4eff00', '#58d123', '#47872b', '#38582a', '#fbffaa', '#451d49'],
  krunk_rock: ['#ffad16', '#d78b00', '#945f00', '#674200', '#ffe7a1', '#a20ec7'],
  krunk_electric: ['#e4ff00', '#dedf00', '#b7b700', '#676800', '#98efff', '#1a4e58'],
  krunk_shadow: ['#1d1220', '#730087', '#ff006a', '#ab0085', '#18c700', '#8678d2'],
} as const;

export const HERO_FORM_LABELS: Readonly<Record<HeroFormId, string>> = {
  krunk_basic: 'BASE',
  krunk_fire: 'FIRE',
  krunk_leaf: 'LEAF',
  krunk_rock: 'ROCK',
  krunk_electric: 'VOLT',
  krunk_shadow: 'SHDW',
} as const;

export type BiomeTileStyle =
  | 'cavern_moss'
  | 'village_meadow'
  | 'sunlit_trail'
  | 'infested_canopy'
  | 'primal_bark'
  | 'volcanic_basalt'
  | 'desert_sandstone'
  | 'arcane_labyrinth'
  | 'atomic_temple'
  | 'nightmare_spire'
  | 'ghost_timber';

export interface BiomePalette extends Palette6 {
  readonly id: BiomeId;
  readonly label: string;
  readonly style: BiomeTileStyle;
  /** Canonical 6-color biome hex swatch */
  readonly colors: readonly [string, string, string, string, string, string];
  /** 3-stop stepped retro sky bands */
  readonly skyTop: string;
  readonly skyMid: string;
  readonly skyBot: string;
  readonly skyGlow: string;
  /** 3-layer parallax silhouettes */
  readonly farSil: string;
  readonly farHighlight: string;
  readonly midSil: string;
  readonly midHighlight: string;
  readonly nearSil: string;
  /** Terrain top-cap (grass/moss/snow/crust/circuit) */
  readonly capLight: string;
  readonly capMid: string;
  readonly capDark: string;
  /** Terrain interior masonry/earth */
  readonly earthLight: string;
  readonly earthMid: string;
  readonly earthDark: string;
  readonly earthDeep: string;
  /** Biome accents, flowers, glowing runes, motes */
  readonly accent: string;
  readonly accentAlt: string;
  readonly outline: string;
  readonly ambientMote: string;
  readonly celestialColor: string;
  readonly celestialRing: string;
}

export const BIOME_PALETTES: Readonly<Record<BiomeId, BiomePalette>> = {
  MLAIR: {
    id: 'MLAIR',
    label: 'TUTORIAL LAIR',
    style: 'cavern_moss',
    colors: ['#7be84b', '#45b832', '#8c6d8a', '#624869', '#332058', '#c084ff'],
    skyTop: '#160d2e',
    skyMid: '#2a1a4d',
    skyBot: '#4c2c73',
    skyGlow: '#7848a8',
    farSil: '#21133d',
    farHighlight: '#36215e',
    midSil: '#301c52',
    midHighlight: '#4a2e75',
    nearSil: '#24133d',
    capLight: '#8cf257',
    capMid: '#48bd37',
    capDark: '#237528',
    earthLight: '#917394',
    earthMid: '#684e73',
    earthDark: '#453154',
    earthDeep: '#291a38',
    accent: '#ff69c8',
    accentAlt: '#c084ff',
    outline: OUTLINE_DARK,
    ambientMote: '#d4a6ff',
    celestialColor: '#ffe4ff',
    celestialRing: '#9957e6',
  },
  OPOUSO: {
    id: 'OPOUSO',
    label: 'SUBROSA HAVEN',
    style: 'village_meadow',
    colors: ['#8ff044', '#4ec431', '#c9885b', '#9c5f3c', '#58a8ff', '#ffd24a'],
    skyTop: '#2463d6',
    skyMid: '#52a3ff',
    skyBot: '#a3e3ff',
    skyGlow: '#e8fbff',
    farSil: '#578ad4',
    farHighlight: '#82b4f5',
    midSil: '#427d70',
    midHighlight: '#67ab91',
    nearSil: '#2f6b4b',
    capLight: '#9cf549',
    capMid: '#50c732',
    capDark: '#288526',
    earthLight: '#cf8e5f',
    earthMid: '#a1623d',
    earthDark: '#703d27',
    earthDeep: '#472219',
    accent: '#ffd84a',
    accentAlt: '#ff6b8b',
    outline: OUTLINE_PLUM,
    ambientMote: '#fff5b8',
    celestialColor: '#fff9c4',
    celestialRing: '#ffd966',
  },
  TDM: {
    id: 'TDM',
    label: "MONSTER'S TRAIL",
    style: 'sunlit_trail',
    colors: ['#9ef53d', '#53c728', '#c47a47', '#965430', '#479cff', '#ff5268'],
    skyTop: '#1b57cc',
    skyMid: '#4298ff',
    skyBot: '#94e3ff',
    skyGlow: '#dffaff',
    farSil: '#4479cc',
    farHighlight: '#6fa6f2',
    midSil: '#32826c',
    midHighlight: '#52b088',
    nearSil: '#226944',
    capLight: '#a6fa46',
    capMid: '#55cc29',
    capDark: '#2a8c20',
    earthLight: '#c97d49',
    earthMid: '#995530',
    earthDark: '#6b3621',
    earthDeep: '#451f17',
    accent: '#ff5268',
    accentAlt: '#ffe666',
    outline: OUTLINE_PLUM,
    ambientMote: '#eaffb3',
    celestialColor: '#fff8bd',
    celestialRing: '#ffc94d',
  },
  FLIN: {
    id: 'FLIN',
    label: 'INFESTED FOREST',
    style: 'infested_canopy',
    colors: ['#6bff8d', '#2ecc6b', '#5c4e6b', '#3e324f', '#16424d', '#ff47d1'],
    skyTop: '#0b202e',
    skyMid: '#143c47',
    skyBot: '#216661',
    skyGlow: '#3d9c88',
    farSil: '#10303b',
    farHighlight: '#1e5259',
    midSil: '#164547',
    midHighlight: '#29706a',
    nearSil: '#103333',
    capLight: '#73ff94',
    capMid: '#2ecc6b',
    capDark: '#19874f',
    earthLight: '#635473',
    earthMid: '#433654',
    earthDark: '#2b203b',
    earthDeep: '#191126',
    accent: '#ff47d1',
    accentAlt: '#5cffd6',
    outline: OUTLINE_DARK,
    ambientMote: '#78ffbf',
    celestialColor: '#b3ffe8',
    celestialRing: '#38c7a3',
  },
  AP: {
    id: 'AP',
    label: 'PRIMAL TREE',
    style: 'primal_bark',
    colors: ['#a8f03c', '#65b828', '#ad6b3e', '#804929', '#3d2147', '#ffae33'],
    skyTop: '#1c102b',
    skyMid: '#3a1f45',
    skyBot: '#6b3852',
    skyGlow: '#a65d63',
    farSil: '#291536',
    farHighlight: '#472652',
    midSil: '#452242',
    midHighlight: '#6b3658',
    nearSil: '#33192e',
    capLight: '#b3f542',
    capMid: '#66bd28',
    capDark: '#367a1c',
    earthLight: '#b57042',
    earthMid: '#854c2b',
    earthDark: '#592f1c',
    earthDeep: '#381912',
    accent: '#ffb538',
    accentAlt: '#9dff57',
    outline: OUTLINE_PLUM,
    ambientMote: '#d4ff6e',
    celestialColor: '#ffe08a',
    celestialRing: '#e67e38',
  },
  ATVC: {
    id: 'ATVC',
    label: 'VOLCANIC ALTAR',
    style: 'volcanic_basalt',
    colors: ['#ff9d2e', '#e04c1b', '#664c5c', '#473242', '#451126', '#ffdd47'],
    skyTop: '#1a081a',
    skyMid: '#421024',
    skyBot: '#8f2323',
    skyGlow: '#d95326',
    farSil: '#2b0b1d',
    farHighlight: '#54172b',
    midSil: '#4a1421',
    midHighlight: '#7a2229',
    nearSil: '#330c18',
    capLight: '#ffa738',
    capMid: '#e34e1c',
    capDark: '#911f18',
    earthLight: '#6b5060',
    earthMid: '#4a3445',
    earthDark: '#301f30',
    earthDeep: '#1c1021',
    accent: '#ffe14a',
    accentAlt: '#ff661a',
    outline: OUTLINE_DARK,
    ambientMote: '#ff9c38',
    celestialColor: '#ffcf59',
    celestialRing: '#ff4f24',
  },
  DSI: {
    id: 'DSI',
    label: 'ISOLATED DESERT',
    style: 'desert_sandstone',
    colors: ['#ffe28a', '#e8b24d', '#d98d4a', '#ad6231', '#b8475c', '#38e8d9'],
    skyTop: '#4c2066',
    skyMid: '#b5455a',
    skyBot: '#ffad54',
    skyGlow: '#ffe08a',
    farSil: '#7a335a',
    farHighlight: '#ab516b',
    midSil: '#b05948',
    midHighlight: '#db7c56',
    nearSil: '#8f4437',
    capLight: '#ffe896',
    capMid: '#ebb54f',
    capDark: '#ba7d27',
    earthLight: '#de904b',
    earthMid: '#b06431',
    earthDark: '#7f3f22',
    earthDeep: '#522318',
    accent: '#38ebd9',
    accentAlt: '#fff0a6',
    outline: OUTLINE_PLUM,
    ambientMote: '#ffe79e',
    celestialColor: '#fff5b8',
    celestialRing: '#ff9640',
  },
  LAB: {
    id: 'LAB',
    label: 'FORGOTTEN LABYRINTH',
    style: 'arcane_labyrinth',
    colors: ['#88a8e6', '#5874b8', '#6b6e94', '#4b4e73', '#241e4f', '#ff4fa3'],
    skyTop: '#110e29',
    skyMid: '#211c4a',
    skyBot: '#393170',
    skyGlow: '#5d52a3',
    farSil: '#19143b',
    farHighlight: '#2f2766',
    midSil: '#282257',
    midHighlight: '#433a85',
    nearSil: '#1d1940',
    capLight: '#91b2f0',
    capMid: '#5a77bd',
    capDark: '#384c87',
    earthLight: '#707399',
    earthMid: '#4e5178',
    earthDark: '#333554',
    earthDeep: '#1d1e36',
    accent: '#ff52a8',
    accentAlt: '#6ce8ff',
    outline: OUTLINE_DARK,
    ambientMote: '#a8b8ff',
    celestialColor: '#d4dfff',
    celestialRing: '#8252d9',
  },
  TEMP: {
    id: 'TEMP',
    label: 'ATOMIC TEMPLE',
    style: 'atomic_temple',
    colors: ['#75f5ff', '#2bc2e0', '#70879e', '#495d75', '#103454', '#ffe838'],
    skyTop: '#08182b',
    skyMid: '#0e3152',
    skyBot: '#185978',
    skyGlow: '#2c8fa8',
    farSil: '#0c233d',
    farHighlight: '#1b476e',
    midSil: '#133a5c',
    midHighlight: '#24668f',
    nearSil: '#0e2c47',
    capLight: '#80f7ff',
    capMid: '#2cc5e3',
    capDark: '#167a9e',
    earthLight: '#758da6',
    earthMid: '#4c617a',
    earthDark: '#303f57',
    earthDeep: '#1a2438',
    accent: '#ffeb3b',
    accentAlt: '#59ffff',
    outline: OUTLINE_DARK,
    ambientMote: '#80ffff',
    celestialColor: '#c2ffff',
    celestialRing: '#ffe838',
  },
  EVIL: {
    id: 'EVIL',
    label: 'NIGHTMARE SPIRE',
    style: 'nightmare_spire',
    colors: ['#ff3b9a', '#b81670', '#5b4173', '#3d2854', '#260b38', '#24ff78'],
    skyTop: '#0b0417',
    skyMid: '#240a36',
    skyBot: '#52114f',
    skyGlow: '#8c1b6e',
    farSil: '#180729',
    farHighlight: '#361252',
    midSil: '#2e0d40',
    midHighlight: '#54186b',
    nearSil: '#1f082e',
    capLight: '#ff47a3',
    capMid: '#bd1773',
    capDark: '#6e0d4d',
    earthLight: '#60457a',
    earthMid: '#3f2a57',
    earthDark: '#28173d',
    earthDeep: '#160b24',
    accent: '#26ff7a',
    accentAlt: '#ff3b9a',
    outline: OUTLINE_DARK,
    ambientMote: '#ff6ec7',
    celestialColor: '#ff3b7f',
    celestialRing: '#26ff7a',
  },
  GSHIP: {
    id: 'GSHIP',
    label: 'GHOST SHIP',
    style: 'ghost_timber',
    colors: ['#7affa8', '#3bc782', '#7a5b52', '#573d39', '#132a47', '#94ffe4'],
    skyTop: '#071124',
    skyMid: '#112845',
    skyBot: '#204b66',
    skyGlow: '#397c8c',
    farSil: '#0c1d36',
    farHighlight: '#1b3b61',
    midSil: '#15314f',
    midHighlight: '#27557a',
    nearSil: '#0f243b',
    capLight: '#82ffad',
    capMid: '#3cca84',
    capDark: '#1e805f',
    earthLight: '#806057',
    earthMid: '#5c403c',
    earthDark: '#3d2729',
    earthDeep: '#24151a',
    accent: '#99ffe6',
    accentAlt: '#5cffad',
    outline: OUTLINE_DARK,
    ambientMote: '#8cffd9',
    celestialColor: '#d6fff4',
    celestialRing: '#5ce6b8',
  },
} as const;

export function getBiomePalette(biome: BiomeId): BiomePalette {
  return BIOME_PALETTES[biome];
}

export function getHeroFormPalette(
  form: HeroFormId,
): readonly [string, string, string, string, string, string] {
  return HERO_FORM_PALETTES[form];
}

/** Parse #rrggbb hex string into packed 0xAABBGGRR little-endian Uint32 pixel value. */
const hexPackCache = new Map<string, number>();

export function hexToAbgr(hex: string, alpha = 255): number {
  const key = alpha === 255 ? hex : `${hex}_${alpha}`;
  const cached = hexPackCache.get(key);
  if (cached !== undefined) return cached;
  const clean = hex.charCodeAt(0) === 35 ? hex.slice(1) : hex;
  const r = parseInt(clean.slice(0, 2), 16) & 0xff;
  const g = parseInt(clean.slice(2, 4), 16) & 0xff;
  const b = parseInt(clean.slice(4, 6), 16) & 0xff;
  const packed = ((alpha & 0xff) << 24) | (b << 16) | (g << 8) | r;
  hexPackCache.set(key, packed >>> 0);
  return packed >>> 0;
}

export function mixHex(hexA: string, hexB: string, t: number): string {
  const ca = hexA.charCodeAt(0) === 35 ? hexA.slice(1) : hexA;
  const cb = hexB.charCodeAt(0) === 35 ? hexB.slice(1) : hexB;
  const r1 = parseInt(ca.slice(0, 2), 16);
  const g1 = parseInt(ca.slice(2, 4), 16);
  const b1 = parseInt(ca.slice(4, 6), 16);
  const r2 = parseInt(cb.slice(0, 2), 16);
  const g2 = parseInt(cb.slice(2, 4), 16);
  const b2 = parseInt(cb.slice(4, 6), 16);
  const r = Math.round(r1 + (r2 - r1) * t);
  const g = Math.round(g1 + (g2 - g1) * t);
  const b = Math.round(b1 + (b2 - b1) * t);
  return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
}
