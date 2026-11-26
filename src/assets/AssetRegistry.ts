/**
 * Krunked Quest — Logical Asset Registry & Manifest Validator
 * Maps all hero forms, biome tilesets, backgrounds, bosses, enemies, NPCs, props, UI, and FX
 * to clean logical asset keys with strict schema validation.
 */

import {
  BIOME_IDS,
  HERO_FORMS,
  type BiomeId,
  type BossId,
  type CustomPackEntry,
  type CustomPackManifest,
  type HeroFormId,
} from '../contracts/index';

export type AssetCategory = CustomPackEntry['category'];

export interface AssetSpec {
  readonly key: string;
  readonly defaultPath: string;
  readonly width: number;
  readonly height: number;
  readonly category: AssetCategory;
}

export const LOGICAL_HERO_SHEETS: Readonly<Record<HeroFormId, string>> = {
  krunk_basic: 'hero/krunk_basic',
  krunk_fire: 'hero/krunk_fire',
  krunk_leaf: 'hero/krunk_leaf',
  krunk_rock: 'hero/krunk_rock',
  krunk_electric: 'hero/krunk_electric',
  krunk_shadow: 'hero/krunk_shadow',
} as const;

export const LOGICAL_BIOME_TILESETS: Readonly<Record<BiomeId, string>> = {
  MLAIR: 'tiles/MLAIR',
  OPOUSO: 'tiles/OPOUSO',
  TDM: 'tiles/TDM',
  FLIN: 'tiles/FLIN',
  AP: 'tiles/AP',
  ATVC: 'tiles/ATVC',
  DSI: 'tiles/DSI',
  LAB: 'tiles/LAB',
  TEMP: 'tiles/TEMP',
  EVIL: 'tiles/EVIL',
  GSHIP: 'tiles/GSHIP',
} as const;

export const LOGICAL_BIOME_BACKGROUNDS: Readonly<Record<BiomeId, string>> = {
  MLAIR: 'bg/MLAIR',
  OPOUSO: 'bg/OPOUSO',
  TDM: 'bg/TDM',
  FLIN: 'bg/FLIN',
  AP: 'bg/AP',
  ATVC: 'bg/ATVC',
  DSI: 'bg/DSI',
  LAB: 'bg/LAB',
  TEMP: 'bg/TEMP',
  EVIL: 'bg/EVIL',
  GSHIP: 'bg/GSHIP',
} as const;

export const LOGICAL_BOSS_SPRITES: Readonly<Record<BossId, string>> = {
  dino_behemoth: 'boss/dino_behemoth',
  primal_eye: 'boss/primal_eye',
  magma_boar_king: 'boss/magma_boar_king',
  bone_colossus: 'boss/bone_colossus',
  mecha_bull: 'boss/mecha_bull',
  electro_sphinx: 'boss/electro_sphinx',
  shadow_doppelganger: 'boss/shadow_doppelganger',
  nightmare_sovereign: 'boss/nightmare_sovereign',
} as const;

export const LOGICAL_SPRITE_KEYS: readonly string[] = [
  // Special tiles & world interactables
  'tile/special_tiles',
  'tile/chest',
  'tile/teleporter',
  'tile/volt_node',
  'tile/form_totem',
  'tile/save_shrine',

  // Hub NPCs
  'npc/vespera',
  'npc/orla',
  'npc/barnaby',
  'npc/garron',
  'npc/barnacle',
  'npc/codex',

  // UI, HUD & collectibles
  'ui/heart',
  'ui/combo_wheel',
  'ui/crystal',
  'ui/coin',
  'ui/shield_icon',
  'ui/title_logo',

  // Visual effects
  'fx/stomp_ring',
  'fx/fire_blast',
  'fx/volt_arc',
  'fx/particles',

  // Flagship & Endless enemies
  'enemy/goomba',
  'enemy/air_goomba',
  'enemy/spitter',
  'enemy/horned_beetle',
  'enemy/bee',
  'enemy/frog',
  'enemy/carnivorous_plant',
  'enemy/mushroom_warrior',
  'enemy/ghost_crow',
  'enemy/ghost_owl',
  'enemy/ghost_pig',

  // All 8 bosses & mini-bosses
  LOGICAL_BOSS_SPRITES.dino_behemoth,
  LOGICAL_BOSS_SPRITES.primal_eye,
  LOGICAL_BOSS_SPRITES.magma_boar_king,
  LOGICAL_BOSS_SPRITES.bone_colossus,
  LOGICAL_BOSS_SPRITES.mecha_bull,
  LOGICAL_BOSS_SPRITES.electro_sphinx,
  LOGICAL_BOSS_SPRITES.shadow_doppelganger,
  LOGICAL_BOSS_SPRITES.nightmare_sovereign,

  // All 11 biome parallax sky/backdrop sheets
  ...BIOME_IDS.map((biome) => LOGICAL_BIOME_BACKGROUNDS[biome]),
] as const;

export const ALL_REQUIRED_ASSET_KEYS: readonly string[] = [
  ...HERO_FORMS.map((form) => LOGICAL_HERO_SHEETS[form]),
  ...BIOME_IDS.map((biome) => LOGICAL_BIOME_TILESETS[biome]),
  ...LOGICAL_SPRITE_KEYS,
] as const;

const VALID_CATEGORIES = new Set<AssetCategory>([
  'hero',
  'tile',
  'enemy',
  'boss',
  'ui',
  'bg',
  'fx',
]);

function inferCategory(key: string): AssetCategory {
  if (key.startsWith('hero/') || key.startsWith('npc/')) return 'hero';
  if (key.startsWith('tiles/') || key.startsWith('tile/')) return 'tile';
  if (key.startsWith('enemy/')) return 'enemy';
  if (key.startsWith('boss/')) return 'boss';
  if (key.startsWith('bg/')) return 'bg';
  if (key.startsWith('fx/')) return 'fx';
  return 'ui';
}

function inferDefaultDimensions(key: string): { width: number; height: number } {
  if (key.startsWith('hero/')) return { width: 288, height: 36 };
  if (key.startsWith('tiles/')) return { width: 128, height: 128 };
  if (key.startsWith('bg/')) return { width: 576, height: 324 };
  if (key.startsWith('boss/')) return { width: 128, height: 128 };
  if (key.startsWith('enemy/')) return { width: 128, height: 32 };
  if (key.startsWith('npc/')) return { width: 64, height: 48 };
  if (key === 'tile/special_tiles') return { width: 256, height: 64 };
  if (key.startsWith('tile/')) return { width: 64, height: 32 };
  if (key === 'ui/title_logo') return { width: 320, height: 96 };
  if (key === 'ui/combo_wheel') return { width: 64, height: 64 };
  if (key.startsWith('fx/')) return { width: 128, height: 32 };
  return { width: 32, height: 32 };
}

export function keyToDefaultPath(key: string): string {
  const safeName = key.replace(/[^a-zA-Z0-9_-]+/g, '_');
  return `sprites/${safeName}.png`;
}

export const ASSET_REGISTRY_SPECS: Readonly<Record<string, AssetSpec>> = Object.freeze(
  ALL_REQUIRED_ASSET_KEYS.reduce<Record<string, AssetSpec>>((acc, key) => {
    const dims = inferDefaultDimensions(key);
    acc[key] = Object.freeze({
      key,
      defaultPath: keyToDefaultPath(key),
      width: dims.width,
      height: dims.height,
      category: inferCategory(key),
    });
    return acc;
  }, {}),
);

const ALIAS_LOOKUP: ReadonlyMap<string, string> = (() => {
  const map = new Map<string, string>();
  for (const key of ALL_REQUIRED_ASSET_KEYS) {
    map.set(key, key);
    map.set(key.toLowerCase(), key);
    const slashIdx = key.indexOf('/');
    if (slashIdx >= 0) {
      const shortName = key.slice(slashIdx + 1);
      if (!map.has(shortName)) {
        map.set(shortName, key);
      }
      const lowerShort = shortName.toLowerCase();
      if (!map.has(lowerShort)) {
        map.set(lowerShort, key);
      }
    }
  }
  return map;
})();

export function resolveLogicalAssetKey(rawKey: string): string | null {
  if (!rawKey) return null;
  const trimmed = rawKey.trim();
  return ALIAS_LOOKUP.get(trimmed) ?? ALIAS_LOOKUP.get(trimmed.toLowerCase()) ?? null;
}

export interface ManifestValidationResult {
  readonly valid: boolean;
  readonly missingKeys: readonly string[];
  readonly invalidEntries: readonly string[];
  readonly extraKeys: readonly string[];
  readonly totalEntries: number;
  readonly errors: readonly string[];
}

function isSafeRelativeAssetPath(assetPath: string): boolean {
  if (!assetPath || assetPath.length > 260) return false;
  if (assetPath.startsWith('/') || assetPath.startsWith('\\')) return false;
  if (/^[a-zA-Z]:/.test(assetPath)) return false;
  const segments = assetPath.split(/[\\/]+/);
  return segments.every((seg) => seg.length > 0 && seg !== '..' && seg !== '.');
}

function isValidEntry(entryKey: string, value: unknown): value is CustomPackEntry {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Record<string, unknown>;
  if (typeof candidate.key !== 'string' || candidate.key !== entryKey) return false;
  if (typeof candidate.path !== 'string' || !isSafeRelativeAssetPath(candidate.path)) return false;
  if (
    typeof candidate.width !== 'number' ||
    !Number.isInteger(candidate.width) ||
    candidate.width <= 0
  ) {
    return false;
  }
  if (
    typeof candidate.height !== 'number' ||
    !Number.isInteger(candidate.height) ||
    candidate.height <= 0
  ) {
    return false;
  }
  if (
    typeof candidate.category !== 'string' ||
    !VALID_CATEGORIES.has(candidate.category as AssetCategory)
  ) {
    return false;
  }
  return true;
}

export function validateAssetManifest(manifest: unknown): ManifestValidationResult {
  const errors: string[] = [];
  if (!manifest || typeof manifest !== 'object') {
    return {
      valid: false,
      missingKeys: [...ALL_REQUIRED_ASSET_KEYS],
      invalidEntries: [],
      extraKeys: [],
      totalEntries: 0,
      errors: ['Manifest must be a non-null JSON object.'],
    };
  }

  const raw = manifest as Record<string, unknown>;
  if (typeof raw.version !== 'number' || !Number.isInteger(raw.version) || raw.version < 1) {
    errors.push('Manifest "version" must be a positive integer.');
  }
  if (typeof raw.generatedAt !== 'string' || raw.generatedAt.trim().length === 0) {
    errors.push('Manifest "generatedAt" must be a non-empty ISO timestamp string.');
  }
  if (typeof raw.sourceVerified !== 'boolean') {
    errors.push('Manifest "sourceVerified" must be a boolean.');
  }
  if (!raw.entries || typeof raw.entries !== 'object' || Array.isArray(raw.entries)) {
    errors.push('Manifest "entries" must be an object map of CustomPackEntry records.');
    return {
      valid: false,
      missingKeys: [...ALL_REQUIRED_ASSET_KEYS],
      invalidEntries: [],
      extraKeys: [],
      totalEntries: 0,
      errors,
    };
  }

  const entriesObj = raw.entries as Record<string, unknown>;
  const entryKeys = Object.keys(entriesObj);
  const requiredSet = new Set<string>(ALL_REQUIRED_ASSET_KEYS);
  const missingKeys: string[] = [];
  const invalidEntries: string[] = [];
  const extraKeys: string[] = [];

  for (const requiredKey of ALL_REQUIRED_ASSET_KEYS) {
    if (!Object.prototype.hasOwnProperty.call(entriesObj, requiredKey)) {
      missingKeys.push(requiredKey);
    }
  }

  for (const key of entryKeys) {
    if (!requiredSet.has(key)) {
      extraKeys.push(key);
    }
    if (!isValidEntry(key, entriesObj[key])) {
      invalidEntries.push(key);
    }
  }

  if (missingKeys.length > 0) {
    errors.push(`Manifest is missing ${missingKeys.length} required asset key(s).`);
  }
  if (invalidEntries.length > 0) {
    errors.push(`Manifest has ${invalidEntries.length} malformed entry record(s).`);
  }

  return {
    valid: errors.length === 0 && missingKeys.length === 0 && invalidEntries.length === 0,
    missingKeys,
    invalidEntries,
    extraKeys,
    totalEntries: entryKeys.length,
    errors,
  };
}

export function isValidCustomPackManifest(manifest: unknown): manifest is CustomPackManifest {
  return validateAssetManifest(manifest).valid;
}
