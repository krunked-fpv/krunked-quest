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
    colors: ['#975932', '#b27333', '#04e205', '#7878c8', '#d898f8', '#376e83'],
    skyTop: '#24244a',
    skyMid: '#376e83',
    skyBot: '#7878c8',
    skyGlow: '#d898f8',
    farSil: '#2b3d57',
    farHighlight: '#4a6885',
    midSil: '#39396b',
    midHighlight: '#5c5ca3',
    nearSil: '#261f3d',
    capLight: '#58ff59',
    capMid: '#04e205',
    capDark: '#0a8a20',
    earthLight: '#b27333',
    earthMid: '#975932',
    earthDark: '#63371e',
    earthDeep: '#3d1f14',
    accent: '#d898f8',
    accentAlt: '#04e205',
    outline: OUTLINE_DARK,
    ambientMote: '#d898f8',
    celestialColor: '#f4e0ff',
    celestialRing: '#7878c8',
  },
  OPOUSO: {
    id: 'OPOUSO',
    label: 'SUBROSA HAVEN',
    style: 'village_meadow',
    colors: ['#181880', '#586890', '#f8f8d8', '#654b4e', '#d56e7b', '#fb7f69'],
    skyTop: '#181880',
    skyMid: '#586890',
    skyBot: '#d6d8c4',
    skyGlow: '#f8f8d8',
    farSil: '#4a5580',
    farHighlight: '#7c8cb3',
    midSil: '#654b4e',
    midHighlight: '#9c6e73',
    nearSil: '#473338',
    capLight: '#8ef052',
    capMid: '#4ac238',
    capDark: '#267829',
    earthLight: '#d56e7b',
    earthMid: '#9c565e',
    earthDark: '#654b4e',
    earthDeep: '#3d2a2e',
    accent: '#fb7f69',
    accentAlt: '#ffd5ce',
    outline: OUTLINE_PLUM,
    ambientMote: '#ffd5ce',
    celestialColor: '#f8f8d8',
    celestialRing: '#fb7f69',
  },
  TDM: {
    id: 'TDM',
    label: "MONSTER'S TRAIL",
    style: 'sunlit_trail',
    colors: ['#261009', '#704150', '#421b28', '#9f5a27', '#816f1c', '#424310'],
    skyTop: '#244b96',
    skyMid: '#4f88d6',
    skyBot: '#9fd8f2',
    skyGlow: '#e8f7d4',
    farSil: '#704150',
    farHighlight: '#965c6e',
    midSil: '#421b28',
    midHighlight: '#6b3242',
    nearSil: '#424310',
    capLight: '#b3a32d',
    capMid: '#816f1c',
    capDark: '#424310',
    earthLight: '#c4763b',
    earthMid: '#9f5a27',
    earthDark: '#613018',
    earthDeep: '#261009',
    accent: '#ff7066',
    accentAlt: '#e6d85a',
    outline: OUTLINE_PLUM,
    ambientMote: '#f0e68c',
    celestialColor: '#fff6c4',
    celestialRing: '#e6b84c',
  },
  FLIN: {
    id: 'FLIN',
    label: 'INFESTED FOREST',
    style: 'infested_canopy',
    colors: ['#001734', '#142b48', '#2c4d78', '#8f4b54', '#d76271', '#2c4547'],
    skyTop: '#001734',
    skyMid: '#142b48',
    skyBot: '#2c4d78',
    skyGlow: '#4776a3',
    farSil: '#0d223d',
    farHighlight: '#214066',
    midSil: '#1e3745',
    midHighlight: '#2c4547',
    nearSil: '#10242e',
    capLight: '#d76271',
    capMid: '#8f4b54',
    capDark: '#522630',
    earthLight: '#3c6166',
    earthMid: '#2c4547',
    earthDark: '#142b48',
    earthDeep: '#001734',
    accent: '#d76271',
    accentAlt: '#5ce6c8',
    outline: OUTLINE_DARK,
    ambientMote: '#ff8f9e',
    celestialColor: '#d9eeff',
    celestialRing: '#d76271',
  },
  AP: {
    id: 'AP',
    label: 'PRIMAL TREE',
    style: 'primal_bark',
    colors: ['#971241', '#780000', '#c14a55', '#b8dfea', '#ffb965', '#3b3e3d'],
    skyTop: '#3d0820',
    skyMid: '#780000',
    skyBot: '#971241',
    skyGlow: '#c14a55',
    farSil: '#520a24',
    farHighlight: '#85183b',
    midSil: '#691229',
    midHighlight: '#a32e42',
    nearSil: '#3b3e3d',
    capLight: '#ffd28c',
    capMid: '#ffb965',
    capDark: '#b8682e',
    earthLight: '#c14a55',
    earthMid: '#971241',
    earthDark: '#5c0c24',
    earthDeep: '#3b3e3d',
    accent: '#b8dfea',
    accentAlt: '#ffb965',
    outline: OUTLINE_PLUM,
    ambientMote: '#b8dfea',
    celestialColor: '#fff2cc',
    celestialRing: '#ffb965',
  },
  ATVC: {
    id: 'ATVC',
    label: 'VOLCANIC ALTAR',
    style: 'volcanic_basalt',
    colors: ['#4a0a00', '#8f2200', '#ff5019', '#ffaa2f', '#ffec42', '#130d21'],
    skyTop: '#130d21',
    skyMid: '#4a0a00',
    skyBot: '#8f2200',
    skyGlow: '#ff5019',
    farSil: '#29070d',
    farHighlight: '#611500',
    midSil: '#4a0a00',
    midHighlight: '#8f2200',
    nearSil: '#24080c',
    capLight: '#ffec42',
    capMid: '#ffaa2f',
    capDark: '#ff5019',
    earthLight: '#8f2200',
    earthMid: '#4a0a00',
    earthDark: '#290a12',
    earthDeep: '#130d21',
    accent: '#ffec42',
    accentAlt: '#ff5019',
    outline: OUTLINE_DARK,
    ambientMote: '#ffaa2f',
    celestialColor: '#ffec42',
    celestialRing: '#ff5019',
  },
  DSI: {
    id: 'DSI',
    label: 'ISOLATED DESERT',
    style: 'desert_sandstone',
    colors: ['#91795a', '#e6be19', '#b58850', '#fffc06', '#e4dc3f', '#fffcab'],
    skyTop: '#6b4738',
    skyMid: '#b58850',
    skyBot: '#e4dc3f',
    skyGlow: '#fffcab',
    farSil: '#91795a',
    farHighlight: '#bfa37a',
    midSil: '#a67b48',
    midHighlight: '#d1a45c',
    nearSil: '#785a3a',
    capLight: '#fffcab',
    capMid: '#e6be19',
    capDark: '#b58850',
    earthLight: '#c99b60',
    earthMid: '#b58850',
    earthDark: '#91795a',
    earthDeep: '#594734',
    accent: '#fffc06',
    accentAlt: '#fffcab',
    outline: OUTLINE_PLUM,
    ambientMote: '#fffcab',
    celestialColor: '#fffc06',
    celestialRing: '#e6be19',
  },
  LAB: {
    id: 'LAB',
    label: 'FORGOTTEN LABYRINTH',
    style: 'arcane_labyrinth',
    colors: ['#d0c180', '#432c2c', '#2d1e32', '#180d36', '#7b0b31', '#998f4f'],
    skyTop: '#180d36',
    skyMid: '#2d1e32',
    skyBot: '#432c2c',
    skyGlow: '#7b0b31',
    farSil: '#211438',
    farHighlight: '#3d284a',
    midSil: '#2d1e32',
    midHighlight: '#543845',
    nearSil: '#241821',
    capLight: '#e6daa3',
    capMid: '#d0c180',
    capDark: '#998f4f',
    earthLight: '#998f4f',
    earthMid: '#665347',
    earthDark: '#432c2c',
    earthDeep: '#180d36',
    accent: '#7b0b31',
    accentAlt: '#d0c180',
    outline: OUTLINE_DARK,
    ambientMote: '#d0c180',
    celestialColor: '#f0e6b8',
    celestialRing: '#7b0b31',
  },
  TEMP: {
    id: 'TEMP',
    label: 'ATOMIC TEMPLE',
    style: 'atomic_temple',
    colors: ['#0042ae', '#00adff', '#ffffff', '#f3cefd', '#23376d', '#000048'],
    skyTop: '#000048',
    skyMid: '#0042ae',
    skyBot: '#00adff',
    skyGlow: '#f3cefd',
    farSil: '#0b1854',
    farHighlight: '#1c4099',
    midSil: '#23376d',
    midHighlight: '#3566ba',
    nearSil: '#14204f',
    capLight: '#ffffff',
    capMid: '#00adff',
    capDark: '#0042ae',
    earthLight: '#3c5ea3',
    earthMid: '#23376d',
    earthDark: '#0f1c52',
    earthDeep: '#000048',
    accent: '#f3cefd',
    accentAlt: '#ffffff',
    outline: OUTLINE_DARK,
    ambientMote: '#f3cefd',
    celestialColor: '#ffffff',
    celestialRing: '#00adff',
  },
  EVIL: {
    id: 'EVIL',
    label: 'NIGHTMARE SPIRE',
    style: 'nightmare_spire',
    colors: ['#1e0f19', '#fc143b', '#71373e', '#261f21', '#730087', '#98f888'],
    skyTop: '#1e0f19',
    skyMid: '#3b123d',
    skyBot: '#730087',
    skyGlow: '#fc143b',
    farSil: '#261f21',
    farHighlight: '#4d1f47',
    midSil: '#3b1a29',
    midHighlight: '#71373e',
    nearSil: '#1e0f19',
    capLight: '#fc143b',
    capMid: '#b8143b',
    capDark: '#71373e',
    earthLight: '#71373e',
    earthMid: '#47252d',
    earthDark: '#261f21',
    earthDeep: '#1e0f19',
    accent: '#98f888',
    accentAlt: '#fc143b',
    outline: OUTLINE_DARK,
    ambientMote: '#98f888',
    celestialColor: '#fc143b',
    celestialRing: '#98f888',
  },
  GSHIP: {
    id: 'GSHIP',
    label: 'GHOST SHIP',
    style: 'ghost_timber',
    colors: ['#d8f040', '#f07080', '#f0b090', '#4e393f', '#704150', '#1e0f19'],
    skyTop: '#4e393f',
    skyMid: '#f07080',
    skyBot: '#f0b090',
    skyGlow: '#d8f040',
    farSil: '#613c47',
    farHighlight: '#965665',
    midSil: '#704150',
    midHighlight: '#a36474',
    nearSil: '#4e393f',
    capLight: '#d8f040',
    capMid: '#a8b832',
    capDark: '#5e6b22',
    earthLight: '#8c5666',
    earthMid: '#704150',
    earthDark: '#4e393f',
    earthDeep: '#1e0f19',
    accent: '#d8f040',
    accentAlt: '#f0b090',
    outline: OUTLINE_DARK,
    ambientMote: '#d8f040',
    celestialColor: '#fff5b8',
    celestialRing: '#f07080',
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
