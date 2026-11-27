/**
 * Krunked Quest — Logical Asset Registry & Manifest Validator
 * Maps all hero forms, biome tilesets, multi-layer parallax backdrops, biome deco,
 * special tiles, world props, Hub NPCs, all 34 enemies, all 8 bosses + parts, UI, and FX
 * to clean logical asset keys with strict schema validation.
 */

import {
  BIOME_IDS,
  HERO_FORMS,
  type BiomeId,
  type BossId,
  type CustomPackEntry,
  type CustomPackManifest,
  type EnemyArchetypeId,
  type HeroFormId,
  type ParallaxLayerMeta,
  type ShopId,
  type SpriteAnimClip,
  type SpriteFrameRect,
  type TileLayoutMeta,
} from '../contracts/index';

export type AssetCategory = CustomPackEntry['category'];

export interface AssetSpec {
  readonly key: string;
  readonly defaultPath: string;
  readonly width: number;
  readonly height: number;
  readonly category: AssetCategory;
}

export const ENEMY_ARCHETYPE_IDS: readonly EnemyArchetypeId[] = [
  'goomba',
  'air_goomba',
  'spitter',
  'horned_beetle',
  'guilhofly',
  'spikeball',
  'bee',
  'frog',
  'ladybug',
  'carnivorous_plant',
  'mushroom_warrior',
  'toxic_slug',
  'neural_spider',
  'salamander',
  'big_jelly',
  'mini_jelly',
  'bombalon',
  'mystic_wheel',
  'puncher_pig',
  'launcher_pig',
  'eagle_cannon',
  'vulture',
  'spike_turtle',
  'fire_lizard',
  'sand_worm',
  'botmerang',
  'floating_sword',
  'zeppelin',
  'atom_eye',
  'mummy',
  'scavenger',
  'ghost_crow',
  'ghost_owl',
  'ghost_pig',
] as const;

export const SHOP_NPC_IDS: readonly ShopId[] = [
  'vespera',
  'orla',
  'barnaby',
  'garron',
  'barnacle',
  'codex',
] as const;

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

export const LOGICAL_BIOME_PARALLAX: Readonly<
  Record<BiomeId, { readonly sky: string; readonly far: string; readonly mid: string; readonly near: string }>
> = Object.freeze(
  BIOME_IDS.reduce<
    Record<BiomeId, { readonly sky: string; readonly far: string; readonly mid: string; readonly near: string }>
  >((acc, biome) => {
    acc[biome] = Object.freeze({
      sky: `bg/${biome}`,
      far: `bg/${biome}_far`,
      mid: `bg/${biome}_mid`,
      near: `bg/${biome}_near`,
    });
    return acc;
  }, {} as Record<BiomeId, { readonly sky: string; readonly far: string; readonly mid: string; readonly near: string }>),
);

export const LOGICAL_BIOME_DECO: Readonly<Record<BiomeId, string>> = Object.freeze(
  BIOME_IDS.reduce<Record<BiomeId, string>>((acc, biome) => {
    acc[biome] = `deco/${biome}`;
    return acc;
  }, {} as Record<BiomeId, string>),
);

export const LOGICAL_ENEMY_SPRITES: Readonly<Record<EnemyArchetypeId, string>> = Object.freeze(
  ENEMY_ARCHETYPE_IDS.reduce<Record<EnemyArchetypeId, string>>((acc, id) => {
    acc[id] = `enemy/${id}`;
    return acc;
  }, {} as Record<EnemyArchetypeId, string>),
);

export const LOGICAL_NPC_SPRITES: Readonly<Record<ShopId, string>> = Object.freeze(
  SHOP_NPC_IDS.reduce<Record<ShopId, string>>((acc, id) => {
    acc[id] = `npc/${id}`;
    return acc;
  }, {} as Record<ShopId, string>),
);

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

export const LOGICAL_BOSS_PART_KEYS: readonly string[] = [
  'boss/primal_eye_iris',
  'boss/primal_eye_spike',
  'boss/magma_boar_fireball',
  'boss/mecha_bull_gear',
  'boss/electro_sphinx_head',
  'boss/electro_sphinx_laser',
  'boss/electro_sphinx_shield',
  'boss/nightmare_orb',
] as const;

export const LOGICAL_SPECIAL_TILE_KEYS: readonly string[] = [
  'tile/special_tiles',
  'tile/oneway',
  'tile/spike',
  'tile/breakable',
  'tile/stone_overhead',
  'tile/bounce',
  'tile/vine',
  'tile/acid',
  'tile/lava',
  'tile/quicksand',
  'tile/crumble',
  'tile/explosive',
  'tile/antigrav',
  'tile/wind_up',
  'tile/wind_left',
  'tile/wind_right',
] as const;

export const LOGICAL_WORLD_PROP_KEYS: readonly string[] = [
  'tile/chest',
  'tile/teleporter',
  'tile/volt_node',
  'tile/form_totem',
  'tile/form_totem_fire',
  'tile/form_totem_leaf',
  'tile/form_totem_rock',
  'tile/form_totem_electric',
  'tile/save_shrine',
  'tile/signpost',
  'tile/animal_house',
  'tile/target_switch',
  'tile/door_locked',
  'tile/coin_door',
  'tile/moving_platform',
  'tile/crusher',
] as const;

export const LOGICAL_UI_KEYS: readonly string[] = [
  'ui/heart',
  'ui/combo_wheel',
  'ui/combo_bar',
  'ui/combo_badge',
  'ui/crystal',
  'ui/coin',
  'ui/shield_icon',
  'ui/title_logo',
  'ui/form_icons',
] as const;

export const LOGICAL_FX_KEYS: readonly string[] = [
  'fx/stomp_ring',
  'fx/stomp_hit',
  'fx/wall_stomp',
  'fx/stomp_jump',
  'fx/fire_blast',
  'fx/volt_arc',
  'fx/particles',
  'fx/hit_spark',
  'fx/jump_dust',
  'fx/land_dust',
  'fx/rock_shield',
  'fx/magic_shield',
  'fx/electric_aim',
  'fx/evil_stomp',
] as const;

export const LOGICAL_SPRITE_KEYS: readonly string[] = [
  // Special tiles & world interactables
  ...LOGICAL_SPECIAL_TILE_KEYS,
  ...LOGICAL_WORLD_PROP_KEYS,

  // Hub NPCs
  ...SHOP_NPC_IDS.map((id) => LOGICAL_NPC_SPRITES[id]),

  // UI, HUD & collectibles
  ...LOGICAL_UI_KEYS,

  // Visual effects
  ...LOGICAL_FX_KEYS,

  // All 34 Enemies
  ...ENEMY_ARCHETYPE_IDS.map((id) => LOGICAL_ENEMY_SPRITES[id]),

  // All 8 bosses & mini-bosses + parts
  LOGICAL_BOSS_SPRITES.dino_behemoth,
  LOGICAL_BOSS_SPRITES.primal_eye,
  LOGICAL_BOSS_SPRITES.magma_boar_king,
  LOGICAL_BOSS_SPRITES.bone_colossus,
  LOGICAL_BOSS_SPRITES.mecha_bull,
  LOGICAL_BOSS_SPRITES.electro_sphinx,
  LOGICAL_BOSS_SPRITES.shadow_doppelganger,
  LOGICAL_BOSS_SPRITES.nightmare_sovereign,
  ...LOGICAL_BOSS_PART_KEYS,

  // All 11 biome parallax layers (sky + far + mid + near) & surface deco
  ...BIOME_IDS.map((biome) => LOGICAL_BIOME_BACKGROUNDS[biome]),
  ...BIOME_IDS.flatMap((biome) => [
    LOGICAL_BIOME_PARALLAX[biome].far,
    LOGICAL_BIOME_PARALLAX[biome].mid,
    LOGICAL_BIOME_PARALLAX[biome].near,
  ]),
  ...BIOME_IDS.map((biome) => LOGICAL_BIOME_DECO[biome]),
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
  if (key.startsWith('tiles/') || key.startsWith('tile/') || key.startsWith('deco/')) return 'tile';
  if (key.startsWith('enemy/')) return 'enemy';
  if (key.startsWith('boss/')) return 'boss';
  if (key.startsWith('bg/')) return 'bg';
  if (key.startsWith('fx/')) return 'fx';
  return 'ui';
}

function inferDefaultDimensions(key: string): { width: number; height: number } {
  if (key.startsWith('hero/')) return { width: 288, height: 72 };
  if (key.startsWith('tiles/')) return { width: 512, height: 64 };
  if (key.startsWith('deco/')) return { width: 128, height: 32 };
  if (key.startsWith('bg/')) {
    if (key.endsWith('_far') || key.endsWith('_mid') || key.endsWith('_near')) {
      return { width: 576, height: 192 };
    }
    return { width: 576, height: 324 };
  }
  if (key.startsWith('boss/')) return { width: 256, height: 128 };
  if (key.startsWith('enemy/')) return { width: 128, height: 36 };
  if (key.startsWith('npc/')) return { width: 128, height: 64 };
  if (key === 'tile/special_tiles') return { width: 256, height: 64 };
  if (key === 'tile/spike') return { width: 128, height: 32 };
  if (key.startsWith('tile/')) return { width: 128, height: 32 };
  if (key === 'ui/title_logo') return { width: 320, height: 96 };
  if (key === 'ui/combo_bar') return { width: 212, height: 96 };
  if (key === 'ui/combo_wheel') return { width: 64, height: 48 };
  if (key === 'ui/combo_badge') return { width: 138, height: 66 };
  if (key === 'ui/form_icons') return { width: 192, height: 32 };
  if (key.startsWith('fx/')) return { width: 192, height: 48 };
  return { width: 64, height: 32 };
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
      // Underscore alias (e.g. enemy_goomba -> enemy/goomba, npc_barnaby -> npc/barnaby, ui_crystal -> ui/crystal)
      const underscoreKey = `${key.slice(0, slashIdx)}_${key.slice(slashIdx + 1)}`;
      if (!map.has(underscoreKey)) {
        map.set(underscoreKey, key);
      }
      const lowerUnderscore = underscoreKey.toLowerCase();
      if (!map.has(lowerUnderscore)) {
        map.set(lowerUnderscore, key);
      }

      // Bare short name alias
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

function isValidFrameRect(value: unknown, sheetW: number, sheetH: number): value is SpriteFrameRect {
  if (!value || typeof value !== 'object') return false;
  const r = value as Record<string, unknown>;
  if (
    typeof r.x !== 'number' ||
    typeof r.y !== 'number' ||
    typeof r.w !== 'number' ||
    typeof r.h !== 'number' ||
    typeof r.pivotX !== 'number' ||
    typeof r.pivotY !== 'number'
  ) {
    return false;
  }
  if (!Number.isInteger(r.x) || !Number.isInteger(r.y) || !Number.isInteger(r.w) || !Number.isInteger(r.h)) {
    return false;
  }
  if (r.x < 0 || r.y < 0 || r.w <= 0 || r.h <= 0) return false;
  if (r.x + r.w > sheetW || r.y + r.h > sheetH) return false;
  if (!Number.isFinite(r.pivotX) || !Number.isFinite(r.pivotY)) return false;
  return true;
}

function isValidAnimClip(value: unknown, frameCount: number): value is SpriteAnimClip {
  if (!value || typeof value !== 'object') return false;
  const c = value as Record<string, unknown>;
  if (!Array.isArray(c.frames) || c.frames.length === 0) return false;
  for (const idx of c.frames) {
    if (typeof idx !== 'number' || !Number.isInteger(idx) || idx < 0 || idx >= frameCount) {
      return false;
    }
  }
  if (typeof c.fps !== 'number' || !Number.isFinite(c.fps) || c.fps <= 0) return false;
  if (typeof c.loop !== 'boolean') return false;
  return true;
}

function isValidTileLayout(value: unknown): value is TileLayoutMeta {
  if (!value || typeof value !== 'object') return false;
  const t = value as Record<string, unknown>;
  if (typeof t.tileSize !== 'number' || !Number.isInteger(t.tileSize) || t.tileSize <= 0) return false;
  if (t.format !== 'strip16' && t.format !== 'grid4x4') return false;
  if (typeof t.rows !== 'number' || !Number.isInteger(t.rows) || t.rows < 1) return false;
  if (t.hasInnerCorners !== undefined && typeof t.hasInnerCorners !== 'boolean') return false;
  if (t.innerCornerRow !== undefined && (typeof t.innerCornerRow !== 'number' || !Number.isInteger(t.innerCornerRow) || t.innerCornerRow < 0)) {
    return false;
  }
  if (t.variantCols !== undefined && (!Array.isArray(t.variantCols) || !t.variantCols.every((c) => typeof c === 'number' && Number.isInteger(c) && c >= 0))) {
    return false;
  }
  if (t.bgWallCols !== undefined && (!Array.isArray(t.bgWallCols) || !t.bgWallCols.every((c) => typeof c === 'number' && Number.isInteger(c) && c >= 0))) {
    return false;
  }
  return true;
}

function isValidParallaxMeta(value: unknown): value is ParallaxLayerMeta {
  if (!value || typeof value !== 'object') return false;
  const p = value as Record<string, unknown>;
  if (typeof p.scrollX !== 'number' || !Number.isFinite(p.scrollX)) return false;
  if (typeof p.scrollY !== 'number' || !Number.isFinite(p.scrollY)) return false;
  if (p.anchorY !== 'top' && p.anchorY !== 'center' && p.anchorY !== 'bottom') return false;
  if (p.offsetY !== undefined && (typeof p.offsetY !== 'number' || !Number.isFinite(p.offsetY))) return false;
  if (typeof p.tileX !== 'boolean') return false;
  if (p.fillViewport !== undefined && typeof p.fillViewport !== 'boolean') return false;
  return true;
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

  let frameCount = 0;
  if (candidate.frames !== undefined) {
    if (!Array.isArray(candidate.frames) || candidate.frames.length === 0) return false;
    for (const f of candidate.frames) {
      if (!isValidFrameRect(f, candidate.width, candidate.height)) return false;
    }
    frameCount = candidate.frames.length;
  }

  if (candidate.clips !== undefined) {
    if (!candidate.clips || typeof candidate.clips !== 'object' || Array.isArray(candidate.clips)) {
      return false;
    }
    if (frameCount === 0) return false;
    for (const clip of Object.values(candidate.clips as Record<string, unknown>)) {
      if (!isValidAnimClip(clip, frameCount)) return false;
    }
  }

  if (candidate.tileLayout !== undefined && !isValidTileLayout(candidate.tileLayout)) {
    return false;
  }

  if (candidate.parallax !== undefined && !isValidParallaxMeta(candidate.parallax)) {
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
