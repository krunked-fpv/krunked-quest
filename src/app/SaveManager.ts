import {
  DEFAULT_KEY_BINDINGS,
  DEFAULT_SETTINGS,
  DEFAULT_TOUCH_LAYOUT,
  HERO_FORMS,
  SAVE_STORAGE_KEY,
  type BossId,
  type FpsLimitOption,
  type GameSettings,
  type HeroFormId,
  type KeyBindings,
  type ProgressState,
  type RelicId,
  type SaveData,
  type TouchVisibilitySetting,
  type UpgradeKey,
} from '../contracts/index.js';

export const SETTINGS_STORAGE_KEY = 'krunked_quest_settings_v1';

export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

const VALID_FORMS = new Set<string>(HERO_FORMS);

const ALL_UPGRADE_KEYS: readonly UpgradeKey[] = [
  'ExtraLife',
  'ItemSlot',
  'CrystallineHunger',
  'LeafCombo',
  'LeafExtraJump',
  'StompFlame',
  'DashFlame',
  'RockShield',
  'RockUppercutInvuln',
  'VoltRange',
  'VoltShield',
  'IronSkin',
  'TripleJump',
  'RockUppercutPower',
  'DashRoundFire',
  'ViewMapExits',
  'ViewSecretAreas',
  'ViewMapArenas',
];

const VALID_RELIC_IDS = new Set<string>([
  'providential_shield',
  'crystal_abundance',
  'maniac_crystal',
  'old_clock',
  'evil_ring',
  'magnet',
  'lively_heart',
  'rebirth_amulet',
  'platinum_medal',
  'bandit_shorts',
  'turtle_shell',
  'extra_coin',
  'magic_feather',
  'vampiric_amulet',
  'magic_shield',
  'magic_coin',
]);

const VALID_BOSS_IDS = new Set<string>([
  'dino_behemoth',
  'primal_eye',
  'magma_boar_king',
  'bone_colossus',
  'mecha_bull',
  'electro_sphinx',
  'shadow_doppelganger',
  'nightmare_sovereign',
]);

class MemoryStorage implements StorageLike {
  private readonly _map = new Map<string, string>();
  getItem(key: string): string | null {
    return this._map.has(key) ? (this._map.get(key) as string) : null;
  }
  setItem(key: string, value: string): void {
    this._map.set(key, value);
  }
  removeItem(key: string): void {
    this._map.delete(key);
  }
}

function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function sanitizeStringArray(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const item of raw) {
    if (typeof item === 'string' && item.length > 0 && !seen.has(item)) {
      seen.add(item);
      out.push(item);
    }
  }
  return out;
}

function sanitizeFiniteNumber(raw: unknown, fallback: number, min?: number, max?: number): number {
  if (typeof raw !== 'number' || !Number.isFinite(raw)) return fallback;
  let val = raw;
  if (min !== undefined && val < min) val = min;
  if (max !== undefined && val > max) val = max;
  return val;
}

export function createDefaultUpgradeLevels(): Record<UpgradeKey, number> {
  const levels = {} as Record<UpgradeKey, number>;
  for (const key of ALL_UPGRADE_KEYS) {
    levels[key] = 0;
  }
  return levels;
}

export function createDefaultProgress(): ProgressState {
  return {
    crystals: 0,
    collectedCoinIds: [],
    unlockedForms: ['krunk_basic'],
    upgradeLevels: createDefaultUpgradeLevels(),
    ownedRelics: [],
    equippedRelics: [],
    defeatedBosses: [],
    visitedRooms: [],
    unlockedTeleporters: [],
    rescuedAnimals: [],
    clearedComboRooms: [],
    openedChests: [],
    ghostShipBestWave: 0,
    ghostShipHighScore: 0,
    bestTimeAttackTicks: null,
  };
}

export function cloneGameSettings(settings: GameSettings = DEFAULT_SETTINGS): GameSettings {
  return {
    render: { ...settings.render },
    audio: { ...settings.audio },
    input: {
      touchMode: settings.input.touchMode,
      touchLayout: { ...settings.input.touchLayout },
      hapticsEnabled: settings.input.hapticsEnabled,
      deadzone: settings.input.deadzone,
      bindings: { ...settings.input.bindings },
    },
  };
}

export function sanitizeSettings(raw: unknown): GameSettings {
  const defaults = cloneGameSettings(DEFAULT_SETTINGS);
  if (!isRecord(raw)) return defaults;

  if (isRecord(raw.render)) {
    const r = raw.render;
    const fps = r.fpsLimit;
    defaults.render.fpsLimit = (fps === 30 || fps === 60 || fps === 120 ? fps : 120) as FpsLimitOption;
    defaults.render.classicSnap = typeof r.classicSnap === 'boolean' ? r.classicSnap : defaults.render.classicSnap;
    defaults.render.screenShake = typeof r.screenShake === 'boolean' ? r.screenShake : defaults.render.screenShake;
    defaults.render.useCustomPack =
      typeof r.useCustomPack === 'boolean' ? r.useCustomPack : defaults.render.useCustomPack;
  }

  if (isRecord(raw.audio)) {
    const a = raw.audio;
    defaults.audio.masterVolume = sanitizeFiniteNumber(a.masterVolume, defaults.audio.masterVolume, 0, 1);
    defaults.audio.sfxVolume = sanitizeFiniteNumber(a.sfxVolume, defaults.audio.sfxVolume, 0, 1);
    defaults.audio.musicVolume = sanitizeFiniteNumber(a.musicVolume, defaults.audio.musicVolume, 0, 1);
    defaults.audio.muted = typeof a.muted === 'boolean' ? a.muted : defaults.audio.muted;
  }

  if (isRecord(raw.input)) {
    const inp = raw.input;
    const tm = inp.touchMode;
    defaults.input.touchMode = (
      tm === 'auto' || tm === 'always_on' || tm === 'off' ? tm : 'auto'
    ) as TouchVisibilitySetting;
    defaults.input.hapticsEnabled =
      typeof inp.hapticsEnabled === 'boolean' ? inp.hapticsEnabled : defaults.input.hapticsEnabled;
    defaults.input.deadzone = sanitizeFiniteNumber(inp.deadzone, defaults.input.deadzone, 0.05, 0.5);

    if (isRecord(inp.touchLayout)) {
      const tl = inp.touchLayout;
      defaults.input.touchLayout = {
        opacity: sanitizeFiniteNumber(tl.opacity, DEFAULT_TOUCH_LAYOUT.opacity, 0.2, 0.65),
        scale: sanitizeFiniteNumber(tl.scale, DEFAULT_TOUCH_LAYOUT.scale, 0.75, 1.35),
        dpadOffsetX: clamp(sanitizeFiniteNumber(tl.dpadOffsetX, 0), -200, 200),
        dpadOffsetY: clamp(sanitizeFiniteNumber(tl.dpadOffsetY, 0), -200, 200),
        actionOffsetX: clamp(sanitizeFiniteNumber(tl.actionOffsetX, 0), -200, 200),
        actionOffsetY: clamp(sanitizeFiniteNumber(tl.actionOffsetY, 0), -200, 200),
      };
    }

    if (isRecord(inp.bindings)) {
      const bindings: KeyBindings = { ...DEFAULT_KEY_BINDINGS };
      (Object.keys(DEFAULT_KEY_BINDINGS) as Array<keyof KeyBindings>).forEach((k) => {
        const val = inp.bindings && (inp.bindings as Record<string, unknown>)[k];
        if (typeof val === 'string' && val.trim().length > 0 && val.length <= 32) {
          bindings[k] = val;
        }
      });
      defaults.input.bindings = bindings;
    }
  }

  return defaults;
}

export function sanitizeProgress(raw: unknown): ProgressState {
  const base = createDefaultProgress();
  if (!isRecord(raw)) return base;

  base.crystals = Math.floor(sanitizeFiniteNumber(raw.crystals, 0, 0, 999999999));
  base.collectedCoinIds = sanitizeStringArray(raw.collectedCoinIds);

  const rawForms = sanitizeStringArray(raw.unlockedForms).filter((f): f is HeroFormId => VALID_FORMS.has(f));
  if (!rawForms.includes('krunk_basic')) {
    rawForms.unshift('krunk_basic');
  }
  base.unlockedForms = rawForms;

  if (isRecord(raw.upgradeLevels)) {
    for (const key of ALL_UPGRADE_KEYS) {
      base.upgradeLevels[key] = Math.floor(sanitizeFiniteNumber(raw.upgradeLevels[key], 0, 0, 10));
    }
  }

  base.ownedRelics = sanitizeStringArray(raw.ownedRelics).filter((r): r is RelicId => VALID_RELIC_IDS.has(r));
  const ownedSet = new Set<string>(base.ownedRelics);
  const maxSlots = 1 + (base.upgradeLevels.ItemSlot ?? 0);
  base.equippedRelics = sanitizeStringArray(raw.equippedRelics)
    .filter((r): r is RelicId => ownedSet.has(r))
    .slice(0, maxSlots);

  base.defeatedBosses = sanitizeStringArray(raw.defeatedBosses).filter((b): b is BossId => VALID_BOSS_IDS.has(b));
  base.visitedRooms = sanitizeStringArray(raw.visitedRooms);
  base.unlockedTeleporters = sanitizeStringArray(raw.unlockedTeleporters);
  base.rescuedAnimals = sanitizeStringArray(raw.rescuedAnimals);
  base.clearedComboRooms = sanitizeStringArray(raw.clearedComboRooms);
  base.openedChests = sanitizeStringArray(raw.openedChests);
  base.ghostShipBestWave = Math.floor(sanitizeFiniteNumber(raw.ghostShipBestWave, 0, 0, 99999));
  base.ghostShipHighScore = Math.floor(sanitizeFiniteNumber(raw.ghostShipHighScore, 0, 0, 999999999));
  base.bestTimeAttackTicks =
    typeof raw.bestTimeAttackTicks === 'number' && Number.isFinite(raw.bestTimeAttackTicks) && raw.bestTimeAttackTicks > 0
      ? Math.floor(raw.bestTimeAttackTicks)
      : null;

  return base;
}

export function sanitizeSaveData(raw: unknown): SaveData | null {
  if (!isRecord(raw)) return null;
  if (raw.version !== 1) return null;
  if (typeof raw.roomId !== 'string' || raw.roomId.trim().length === 0) return null;

  const progress = sanitizeProgress(raw.progress);
  const rawForm = typeof raw.activeForm === 'string' && VALID_FORMS.has(raw.activeForm)
    ? (raw.activeForm as HeroFormId)
    : 'krunk_basic';
  const activeForm: HeroFormId = progress.unlockedForms.includes(rawForm) ? rawForm : 'krunk_basic';

  return {
    version: 1,
    savedAt: Math.floor(sanitizeFiniteNumber(raw.savedAt, Date.now(), 0)),
    roomId: raw.roomId,
    spawnX: sanitizeFiniteNumber(raw.spawnX, 2, -1000, 10000),
    spawnY: sanitizeFiniteNumber(raw.spawnY, 2, -1000, 10000),
    activeForm,
    progress,
    settings: sanitizeSettings(raw.settings),
  };
}

function resolveDefaultStorage(): StorageLike {
  try {
    if (typeof globalThis !== 'undefined' && 'localStorage' in globalThis && globalThis.localStorage) {
      const testKey = '__krunked_storage_probe__';
      globalThis.localStorage.setItem(testKey, '1');
      globalThis.localStorage.removeItem(testKey);
      return globalThis.localStorage;
    }
  } catch {
    // Fallback to memory storage when localStorage is unavailable or blocked
  }
  return new MemoryStorage();
}

export class SaveManager {
  private readonly _storage: StorageLike;
  private readonly _saveKey: string;
  private readonly _settingsKey: string;

  constructor(storage?: StorageLike, saveKey = SAVE_STORAGE_KEY, settingsKey = SETTINGS_STORAGE_KEY) {
    this._storage = storage ?? resolveDefaultStorage();
    this._saveKey = saveKey;
    this._settingsKey = settingsKey;
  }

  hasSave(): boolean {
    return this.load() !== null;
  }

  load(): SaveData | null {
    try {
      const rawText = this._storage.getItem(this._saveKey);
      if (!rawText) return null;
      const parsed: unknown = JSON.parse(rawText);
      return sanitizeSaveData(parsed);
    } catch {
      // Malformed JSON or inaccessible storage -> recover cleanly without crashing
      return null;
    }
  }

  save(data: SaveData): boolean {
    try {
      const clean = sanitizeSaveData(data);
      if (!clean) return false;
      this._storage.setItem(this._saveKey, JSON.stringify(clean));
      this.saveSettings(clean.settings);
      return true;
    } catch {
      return false;
    }
  }

  clear(): void {
    try {
      this._storage.removeItem(this._saveKey);
    } catch {
      // Ignore storage errors
    }
  }

  loadSettings(): GameSettings {
    try {
      const rawText = this._storage.getItem(this._settingsKey);
      if (rawText) {
        return sanitizeSettings(JSON.parse(rawText));
      }
    } catch {
      // Fallback to SaveData or defaults
    }
    const save = this.load();
    if (save) {
      return cloneGameSettings(save.settings);
    }
    return cloneGameSettings(DEFAULT_SETTINGS);
  }

  saveSettings(settings: GameSettings): boolean {
    try {
      const clean = sanitizeSettings(settings);
      this._storage.setItem(this._settingsKey, JSON.stringify(clean));
      return true;
    } catch {
      return false;
    }
  }
}

export function createSaveManager(storage?: StorageLike): SaveManager {
  return new SaveManager(storage);
}
