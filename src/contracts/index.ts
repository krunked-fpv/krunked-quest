/**
 * Krunked Quest — Authoritative Shared Contracts
 * Single compile-time source of truth across sim, data, assets, render, audio, input, UI, and app.
 */

// ============================================================================
// 1. Core Simulation & Viewport Constants
// ============================================================================

export const SIM_HZ = 60;
export const FIXED_DT = 1 / SIM_HZ;
export const MAX_FRAME_DT = 0.1;

export const PPU = 32;
export const VIEWPORT_W = 576;
export const VIEWPORT_H = 324;
export const VIEWPORT_TILES_W = VIEWPORT_W / PPU; // 18.0
export const VIEWPORT_TILES_H = VIEWPORT_H / PPU; // 10.125
export const ORTHOGRAPHIC_SIZE = VIEWPORT_TILES_H / 2; // 5.0625
export const ARENA_ZOOM = 1.125;

export const PHYSICS = {
  GRAVITY: -9.81,
  INITIAL_GRAVITY_SCALE: 4.5,
  G_EFF: -44.145, // -9.81 * 4.5
  MAX_SPEED: 6.6,
  ACCEL: 10.0,
  DECEL: 11.0,
  QUICKSAND_MULT: 0.2,
  JUMP_FORCE: 10.0,
  JUMP_HOLD_TIME: 0.2,
  JUMP_HOLD_BOOST: 8.0,
  DOUBLE_JUMP_FORCE: 13.0,
  ENEMY_JUMP_FORCE: 12.0,
  STOMP_BOUNCE_MULT: 1.5, // 18.0 u/s
  MAGIC_FEATHER_MULT: 1.2,
  ANTIGRAV_BOUNCE_MULT: 0.75,
  MAX_FALL_SPEED: 18.0,
  PRE_JUMP: 0.1,
  COYOTE_TIME: 0.1,
  PRE_DASH: 0.05,
  STOMP_DELAY: 0.25,
  LAST_ENEMY_HIT_TIMER: 0.05,
  WALL_SLIDE_BASIC: -4.0,
  WALL_SLIDE_FORM: -2.0,
  VEL_Y_WALL_JUMP: 3.0,
  WALL_STICK_LOCK: 0.2,
  WALL_RELEASE_BUFFER: 0.05,
  WALL_RESTICK_COOLDOWN: 0.25,
  WALL_JUMP_FORCE_X: 5.0,
  WALL_JUMP_FORCE_Y: 15.5,
  WALL_JUMP_TIMER: 0.06,
  WALL_JUMP_HOLD_TIME: 0.2,
  WALL_JUMP_HOLD_BOOST: 15.0,
  WALL_STOMP_FORCE_X: 17.0,
  WALL_STOMP_FORCE_Y: 8.0,
  WALL_STOMP_TIMER: 0.5,
  GROUND_STOMP_FORCE_X: 17.0,
  GROUND_STOMP_FORCE_Y: 12.0,
  GROUND_STOMP_TIMER: 0.55,
  VINE_SLIDE_MIN: 3.0,
  VINE_SLIDE_MAX: 10.0,
  VINE_JUMP_IMPULSE_X: 12.0,
  INVULN_TIME: 1.75,
  IRON_SKIN_INVULN_MULT: 1.25,
  RECOIL_X: 5.0,
  RECOIL_Y: 5.0,
  RECOIL_TIME: 0.3,
  START_HP: 2,
  MAX_EXTRA_LIFE: 5,
  CRYSTAL_LOSS_DEATH_PCT: 0.05,
  CAM_VEL: 6.0,
  CAM_LOOK_AHEAD: 1.0,
  MAX_SUBSTEP_DIST: 0.2,
  CORNER_NUDGE: 0.125, // 4px
  HERO_W: 0.75, // 24px
  HERO_H: 0.875, // 28px
} as const;

export const FORM_PARAMS = {
  FIRE_DASH_SPEED: 14.0,
  FIRE_DASH_MIN_DUR: 0.2,
  FIRE_DASH_MAX_DUR: 0.4,
  LEAF_GRAVITY_SCALE: 0.5,
  LEAF_GLIDE_VY: -1.0,
  LEAF_WIND_VY: 5.2,
  LEAF_COMBO_LOSS_UPGRADED: 0.25,
  LEAF_EXTRA_JUMP_VY: 13.0,
  ROCK_PAUSE_BEFORE: 0.05,
  ROCK_UPPERCUT_VY: 13.0,
  ROCK_UPPERCUT_VY_UPGRADED: 18.0,
  ROCK_MIN_DUR: 0.175,
  ROCK_MAX_DUR: 0.3,
  ROCK_PAUSE_AFTER: 0.075,
  ROCK_ANTIGRAV_MULT: 0.5,
  VOLT_DIVE_VX: 14.0,
  VOLT_DIVE_VY: -8.0,
  VOLT_DIVE_VX_UPGRADED: 17.5,
  VOLT_DIVE_VY_UPGRADED: -10.0,
  VOLT_CONE_DEG: 40,
  VOLT_NODE_RANGE: 2.5,
  VOLT_ENEMY_RANGE: 3.5,
  VOLT_RANGE_BONUS: 2.0,
  VOLT_BLINK_SPEED: 27.0,
  VOLT_BLINK_SPEED_UPGRADED: 45.0,
  VOLT_EXIT_SLING: 15.0,
  VOLT_SHIELD_DUR: 2.0,
  SHADOW_BLINK_SPEED: 32.0,
  SHADOW_BLINK_DUR: 0.18,
} as const;

export interface ComboPreset {
  readonly maxTimer: number;
  readonly firstHitBonus: number;
  readonly enemyHitGain: number;
  readonly crystalGain: number;
  readonly harderPoint: number;
  readonly healResetRatio: number;
  readonly arenaBonus: number;
}

export const COMBO_PRESETS: Record<RoomModeType, ComboPreset> = {
  normal: {
    maxTimer: 4.0,
    firstHitBonus: 1.5,
    enemyHitGain: 1.25,
    crystalGain: 0.18,
    harderPoint: 0.75,
    healResetRatio: 0.3,
    arenaBonus: 0,
  },
  arena: {
    maxTimer: 5.0,
    firstHitBonus: 1.5,
    enemyHitGain: 1.75,
    crystalGain: 0.17,
    harderPoint: 0.7,
    healResetRatio: 0.35,
    arenaBonus: 1.0,
  },
  boss: {
    maxTimer: 6.0,
    firstHitBonus: 1.5,
    enemyHitGain: 2.0,
    crystalGain: 0.17,
    harderPoint: 0.7,
    healResetRatio: 0.4,
    arenaBonus: 0,
  },
};

export const COMBO_RULES = {
  DECAY_TICK_INTERVAL: 0.05, // 3 ticks at 60Hz
  HEAL_THRESHOLD: 0.95,
  MAX_COMBO_HITSTOP_SCALE: 0.05,
  MAX_COMBO_HITSTOP_TICKS: 24,
  MINI_COMBO_WINDOW: 0.15,
  CRYSTAL_PER_COMBO_STEP: 5,
} as const;

// ============================================================================
// 2. Identifiers, Enums & Palettes
// ============================================================================

export type HeroFormId =
  | 'krunk_basic'
  | 'krunk_fire'
  | 'krunk_leaf'
  | 'krunk_rock'
  | 'krunk_electric'
  | 'krunk_shadow';

export const HERO_FORMS: readonly HeroFormId[] = [
  'krunk_basic',
  'krunk_fire',
  'krunk_leaf',
  'krunk_rock',
  'krunk_electric',
  'krunk_shadow',
] as const;

export type BiomeId =
  | 'MLAIR'
  | 'OPOUSO'
  | 'TDM'
  | 'FLIN'
  | 'AP'
  | 'ATVC'
  | 'DSI'
  | 'LAB'
  | 'TEMP'
  | 'EVIL'
  | 'GSHIP';

export const BIOME_IDS: readonly BiomeId[] = [
  'MLAIR',
  'OPOUSO',
  'TDM',
  'FLIN',
  'AP',
  'ATVC',
  'DSI',
  'LAB',
  'TEMP',
  'EVIL',
  'GSHIP',
] as const;

export type RoomModeType = 'normal' | 'arena' | 'boss';

export type GameMode = 'story' | 'ghost_ship' | 'boss_rush' | 'time_attack';

export type ScreenMode =
  | 'title'
  | 'playing'
  | 'paused'
  | 'options'
  | 'shop'
  | 'map'
  | 'victory'
  | 'gameover'
  | 'credits';

export type ShopId = 'vespera' | 'orla' | 'barnaby' | 'garron' | 'barnacle' | 'codex';

export type UpgradeKey =
  | 'ExtraLife'
  | 'ItemSlot'
  | 'CrystallineHunger'
  | 'LeafCombo'
  | 'LeafExtraJump'
  | 'StompFlame'
  | 'DashFlame'
  | 'RockShield'
  | 'RockUppercutInvuln'
  | 'VoltRange'
  | 'VoltShield'
  | 'IronSkin'
  | 'TripleJump'
  | 'RockUppercutPower'
  | 'DashRoundFire'
  | 'ViewMapExits'
  | 'ViewSecretAreas'
  | 'ViewMapArenas';

export type RelicId =
  | 'providential_shield'
  | 'crystal_abundance'
  | 'maniac_crystal'
  | 'old_clock'
  | 'evil_ring'
  | 'magnet'
  | 'lively_heart'
  | 'rebirth_amulet'
  | 'platinum_medal'
  | 'bandit_shorts'
  | 'turtle_shell'
  | 'extra_coin'
  | 'magic_feather'
  | 'vampiric_amulet'
  | 'magic_shield'
  | 'magic_coin';

export type BossId =
  | 'dino_behemoth'
  | 'primal_eye'
  | 'magma_boar_king'
  | 'bone_colossus'
  | 'mecha_bull'
  | 'electro_sphinx'
  | 'shadow_doppelganger'
  | 'nightmare_sovereign';

export type EnemyArchetypeId =
  | 'goomba'
  | 'air_goomba'
  | 'spitter'
  | 'horned_beetle'
  | 'guilhofly'
  | 'spikeball'
  | 'bee'
  | 'frog'
  | 'ladybug'
  | 'carnivorous_plant'
  | 'mushroom_warrior'
  | 'toxic_slug'
  | 'neural_spider'
  | 'salamander'
  | 'big_jelly'
  | 'mini_jelly'
  | 'bombalon'
  | 'mystic_wheel'
  | 'puncher_pig'
  | 'launcher_pig'
  | 'eagle_cannon'
  | 'vulture'
  | 'spike_turtle'
  | 'fire_lizard'
  | 'sand_worm'
  | 'botmerang'
  | 'floating_sword'
  | 'zeppelin'
  | 'atom_eye'
  | 'mummy'
  | 'scavenger'
  | 'ghost_crow'
  | 'ghost_owl'
  | 'ghost_pig';

// Numeric tile codes for compact Uint8Array grids
export const enum TileCode {
  Empty = 0,
  Solid = 1,
  OneWay = 2,
  Spike = 3,
  Breakable = 4,
  StoneOverhead = 5, // Smashable by Rock Uppercut
  Bounce = 6,
  Vine = 7,
  Acid = 8,
  Lava = 9,
  Quicksand = 10,
  Crumble = 11,
  Explosive = 12,
  Antigrav = 13,
  WindUp = 14,
  WindLeft = 15,
  WindRight = 16,
  SecretWall = 17,
}

export interface Palette6 {
  readonly colors: readonly [string, string, string, string, string, string];
}

// ============================================================================
// 3. Static Catalog Definitions (src/data/**)
// ============================================================================

export interface UpgradeDef {
  readonly id: number; // 0..17
  readonly key: UpgradeKey;
  readonly name: string;
  readonly description: string;
  readonly shop: 'vespera' | 'orla';
  readonly basePrice: number;
  readonly priceStep: number;
  readonly maxLevel: number;
  readonly requiredForm?: HeroFormId;
}

export interface RelicDef {
  readonly id: RelicId;
  readonly name: string;
  readonly description: string;
  readonly price: number;
  readonly iconColor: string;
}

export interface HeroFormDef {
  readonly id: HeroFormId;
  readonly name: string;
  readonly abilityName: string;
  readonly description: string;
  readonly palette: readonly [string, string, string, string, string, string];
  readonly wallSlideVelY: number;
  readonly defaultUnlocked: boolean;
}

export interface EnemyArchetypeDef {
  readonly id: EnemyArchetypeId;
  readonly name: string;
  readonly hp: number;
  readonly width: number;
  readonly height: number;
  readonly speed: number;
  readonly flying: boolean;
  readonly armoredTop: boolean; // Cannot be stomped unless air-stomp/fire/rock
  readonly shoots: boolean;
  readonly shootCooldown: number;
  readonly crystalValue: number;
  readonly primaryColor: string;
  readonly accentColor: string;
}

export interface BossDef {
  readonly id: BossId;
  readonly name: string;
  readonly subtitle: string;
  readonly biome: BiomeId;
  readonly roomId: string;
  readonly maxHp: number;
  readonly isMiniBoss: boolean;
  readonly unlockForm?: HeroFormId;
  readonly width: number;
  readonly height: number;
  readonly crystalReward: number;
  readonly coinReward: number;
}

export interface RoomExitDef {
  readonly dir: 'left' | 'right' | 'up' | 'down' | 'door';
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
  readonly targetRoomId: string;
  readonly targetSpawnX: number;
  readonly targetSpawnY: number;
  readonly requiredForm?: HeroFormId;
  readonly requiredCoins?: number;
  readonly label?: string;
}

export interface EnemySpawnDef {
  readonly id: string;
  readonly archetype: EnemyArchetypeId;
  readonly x: number;
  readonly y: number;
  readonly patrolMinX?: number;
  readonly patrolMaxX?: number;
}

export interface CoinSpawnDef {
  readonly id: string; // Globally unique across 200 coins
  readonly x: number;
  readonly y: number;
  readonly kind: 'world' | 'combo' | 'chest' | 'quest' | 'boss';
}

export interface CrystalSpawnDef {
  readonly id: string;
  readonly x: number;
  readonly y: number;
  readonly value: number;
}

export interface InteractivePropDef {
  readonly id: string;
  readonly kind:
    | 'shop_npc'
    | 'teleporter'
    | 'volt_node'
    | 'form_totem'
    | 'chest'
    | 'moving_platform'
    | 'crusher'
    | 'spinning_platform'
    | 'target_switch'
    | 'target_door'
    | 'coin_door'
    | 'animal_house'
    | 'signpost'
    | 'save_shrine';
  readonly x: number;
  readonly y: number;
  readonly width?: number;
  readonly height?: number;
  readonly shopId?: ShopId;
  readonly formId?: HeroFormId;
  readonly label?: string;
  readonly coinId?: string;
  readonly requiredCoins?: number;
  readonly moveDx?: number;
  readonly moveDy?: number;
  readonly periodSec?: number;
  readonly targetId?: string;
  readonly animalName?: string;
}

export interface RoomDef {
  readonly id: string;
  readonly name: string;
  readonly biome: BiomeId;
  readonly mode: RoomModeType;
  readonly mapX: number;
  readonly mapY: number;
  readonly widthTiles: number;
  readonly heightTiles: number;
  readonly tiles: Uint8Array;
  readonly defaultSpawnX: number;
  readonly defaultSpawnY: number;
  readonly exits: readonly RoomExitDef[];
  readonly enemies: readonly EnemySpawnDef[];
  readonly coins: readonly CoinSpawnDef[];
  readonly crystals: readonly CrystalSpawnDef[];
  readonly props: readonly InteractivePropDef[];
  readonly bossId?: BossId;
  readonly isSecret?: boolean;
  readonly hasTeleporter?: boolean;
  readonly risingLava?: boolean;
  readonly sandstormDir?: -1 | 0 | 1;
}

export interface IWorldCatalog {
  readonly startRoomId: string;
  readonly hubRoomId: string;
  readonly ghostShipRoomId: string;
  readonly rooms: ReadonlyMap<string, RoomDef>;
  readonly roomOrder: readonly string[];
  readonly upgrades: readonly UpgradeDef[];
  readonly relics: readonly RelicDef[];
  readonly forms: readonly HeroFormDef[];
  readonly enemies: ReadonlyMap<EnemyArchetypeId, EnemyArchetypeDef>;
  readonly bosses: ReadonlyMap<BossId, BossDef>;
  readonly totalCoins: number;
  getRoom(id: string): RoomDef;
  getUpgrade(key: UpgradeKey): UpgradeDef;
  getRelic(id: RelicId): RelicDef;
  getForm(id: HeroFormId): HeroFormDef;
}

// ============================================================================
// 4. Live Simulation State (Pure DOM-Free)
// ============================================================================

export type HeroActionState =
  | 'idle'
  | 'run'
  | 'jump'
  | 'fall'
  | 'flip'
  | 'wall_slide'
  | 'vine_slide'
  | 'ground_stomp'
  | 'ground_dash'
  | 'wall_dash'
  | 'air_stomp'
  | 'fire_dash'
  | 'leaf_glide'
  | 'rock_uppercut'
  | 'volt_dive'
  | 'volt_blink'
  | 'shadow_blink'
  | 'hurt'
  | 'dead';

export type HeroTongueKind =
  | 'none'
  | 'ground_stomp'
  | 'air_stomp'
  | 'ground_dash'
  | 'wall_dash'
  | 'wall_slide';

export interface HeroState {
  x: number;
  y: number;
  prevX: number;
  prevY: number;
  vx: number;
  vy: number;
  width: number;
  height: number;
  facing: -1 | 1;
  form: HeroFormId;
  action: HeroActionState;
  hp: number;
  maxHp: number;
  grounded: boolean;
  onWall: -1 | 0 | 1;
  onVine: boolean;
  inQuicksand: boolean;
  inAntigrav: boolean;
  inWindY: number;
  inWindX: number;
  jumpsRemaining: number;
  maxAirJumps: number;
  // Timers (seconds)
  coyoteTimer: number;
  preJumpTimer: number;
  jumpHoldTimer: number;
  wallJumpTimer: number;
  wallJumpHoldTimer: number;
  wallStickLockTimer: number;
  wallReleaseTimer: number;
  wallRestickTimer: number;
  preDashTimer: number;
  groundDashTimer: number;
  wallDashTimer: number;
  stompDelayTimer: number;
  lastEnemyHitTimer: number;
  invulnTimer: number;
  recoilTimer: number;
  // Form ability state
  abilityTimer: number;
  abilityPhase: number;
  abilityUsedInAir: boolean;
  voltTargetX: number;
  voltTargetY: number;
  voltTargetId: string | null;
  rockShieldActive: boolean;
  magicShieldTimer: number;
  rebirthUsed: boolean;
  platinumShieldUsed: boolean;
  // Visual squash/flash state (pure numeric)
  scaleX: number;
  scaleY: number;
  hitFlashTimer: number;
  animTimer: number;
  dashRingAngle: number;
  // Tongue, stomp & wall-saliva mechanical/visual state
  tongueKind: HeroTongueKind;
  tongueTimer: number;
  tongueDuration: number;
  tongueOriginX: number;
  tongueOriginY: number;
  tongueDirX: number;
  tongueDirY: number;
  stompSpamTimer: number;
  preStompTimer: number;
  wallSlideCoyoteTimer: number;
  wallSlideDir: -1 | 0 | 1;
  wallSalivaActive: boolean;
  wallSalivaTopY: number;
  fireImmunityTimer: number;
  oneWayDropTimer: number;
}

export interface EnemyRuntime {
  id: string;
  archetype: EnemyArchetypeId;
  x: number;
  y: number;
  prevX: number;
  prevY: number;
  vx: number;
  vy: number;
  width: number;
  height: number;
  facing: -1 | 1;
  hp: number;
  maxHp: number;
  alive: boolean;
  patrolMinX: number;
  patrolMaxX: number;
  aiTimer: number;
  shootTimer: number;
  hitFlashTimer: number;
  stunTimer: number;
  grounded: boolean;
}

export interface BossRuntime {
  id: BossId;
  x: number;
  y: number;
  prevX: number;
  prevY: number;
  vx: number;
  vy: number;
  width: number;
  height: number;
  facing: -1 | 1;
  hp: number;
  maxHp: number;
  phase: 1 | 2 | 3;
  state: string;
  stateTimer: number;
  attackIndex: number;
  invulnTimer: number;
  hitFlashTimer: number;
  shieldActive: boolean;
  laserAngle: number;
  defeated: boolean;
  arenaMorphPhase: number;
}

export interface ProjectileRuntime {
  id: number;
  fromHero: boolean;
  kind: 'spit' | 'fireball' | 'fire_wave' | 'gear' | 'plasma' | 'dark_orb' | 'missile' | 'shockwave' | 'thorn';
  x: number;
  y: number;
  prevX: number;
  prevY: number;
  vx: number;
  vy: number;
  radius: number;
  ttl: number;
  homing: boolean;
}

export interface CrystalDropRuntime {
  id: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  value: number;
  collected: boolean;
  ttl: number; // -1 for static room crystal
}

export interface CoinRuntime {
  id: string;
  x: number;
  y: number;
  kind: CoinSpawnDef['kind'];
  collected: boolean;
}

export interface MovingPlatformRuntime {
  id: string;
  kind: 'moving_platform' | 'crusher' | 'spinning_platform';
  baseX: number;
  baseY: number;
  x: number;
  y: number;
  prevX: number;
  prevY: number;
  width: number;
  height: number;
  moveDx: number;
  moveDy: number;
  periodSec: number;
  phase: number;
  solid: boolean;
}

export interface ComboState {
  preset: RoomModeType;
  count: number;
  maxSceneCombo: number;
  timer: number;
  maxTimer: number;
  decayAccum: number;
  freezeTimer: number;
  miniComboTimer: number;
  miniComboCount: number;
  roomComboCleared: boolean;
  bannerTimer: number;
  bannerText: string;
}

export interface CameraState {
  x: number;
  y: number;
  prevX: number;
  prevY: number;
  snappedX: number;
  snappedY: number;
  zoom: number;
  shakeTimer: number;
  shakeIntensity: number;
}

export interface GhostShipState {
  active: boolean;
  wave: number;
  score: number;
  highScore: number;
  waveClearTimer: number;
  hazardTier: 0 | 1 | 2;
  spikeTimer: number;
}

export interface ProgressState {
  crystals: number;
  collectedCoinIds: string[];
  unlockedForms: HeroFormId[];
  upgradeLevels: Record<UpgradeKey, number>;
  ownedRelics: RelicId[];
  equippedRelics: RelicId[];
  defeatedBosses: BossId[];
  visitedRooms: string[];
  unlockedTeleporters: string[];
  rescuedAnimals: string[];
  clearedComboRooms: string[];
  openedChests: string[];
  ghostShipBestWave: number;
  ghostShipHighScore: number;
  bestTimeAttackTicks: number | null;
}

export interface SimState {
  tick: number;
  seed: number;
  rngState: number;
  mode: GameMode;
  roomId: string;
  biome: BiomeId;
  roomTiles: Uint8Array; // Mutable copy for breakables / crumbles / explosive blocks
  crumbleTimers: Record<number, number>;
  openedDoors: string[];
  lavaY: number;
  hitstopTicks: number;
  slowmoTimer: number;
  slowmoScale: number;
  timeAttackTicks: number;
  hero: HeroState;
  enemies: EnemyRuntime[];
  boss: BossRuntime | null;
  projectiles: ProjectileRuntime[];
  crystals: CrystalDropRuntime[];
  coins: CoinRuntime[];
  platforms: MovingPlatformRuntime[];
  combo: ComboState;
  camera: CameraState;
  ghostShip: GhostShipState;
  progress: ProgressState;
  nextProjectileId: number;
  victoryTriggered: boolean;
  gameOverTriggered: boolean;
  activeShopPrompt: ShopId | null;
  activeSignText: string | null;
}

// ============================================================================
// 5. Simulation Events (Audio, VFX, Haptics, UI Hooks)
// ============================================================================

export type SimEvent =
  | { type: 'jump'; x: number; y: number; air: boolean; form: HeroFormId }
  | { type: 'land'; x: number; y: number; heavy: boolean }
  | { type: 'wall_jump'; x: number; y: number; dir: -1 | 1 }
  | { type: 'dash'; x: number; y: number; kind: 'ground' | 'wall' | 'fire' | 'volt' | 'shadow' }
  | { type: 'ground_stomp'; x: number; y: number; fiery: boolean }
  | {
      type: 'tongue_lash';
      x: number;
      y: number;
      kind: 'ground_stomp' | 'ground_dash' | 'wall_dash' | 'air_stomp';
      dirX: number;
      dirY: number;
    }
  | { type: 'stomp_start'; x: number; y: number }
  | { type: 'stomp_impact'; x: number; y: number; explosive: boolean }
  | { type: 'uppercut'; x: number; y: number }
  | { type: 'enemy_hit'; x: number; y: number; killed: boolean; combo: number }
  | { type: 'boss_hit'; x: number; y: number; bossId: BossId; hp: number; maxHp: number }
  | { type: 'boss_defeated'; x: number; y: number; bossId: BossId; unlockForm?: HeroFormId }
  | { type: 'hero_hurt'; x: number; y: number; hp: number; shieldBlocked: boolean }
  | { type: 'hero_dead'; x: number; y: number }
  | { type: 'heal'; x: number; y: number; hp: number }
  | { type: 'crystal_pickup'; x: number; y: number; value: number }
  | { type: 'coin_pickup'; x: number; y: number; coinId: string; totalCoins: number }
  | { type: 'combo_max'; x: number; y: number; roomId: string }
  | { type: 'form_switch'; form: HeroFormId }
  | { type: 'block_break'; x: number; y: number; explosive: boolean }
  | { type: 'bounce_pad'; x: number; y: number }
  | { type: 'room_change'; fromRoomId: string; toRoomId: string; biome: BiomeId }
  | { type: 'shop_interact'; shopId: ShopId }
  | { type: 'teleporter_unlock'; roomId: string }
  | { type: 'victory'; mode: GameMode; ticks: number };

// ============================================================================
// 6. Multi-Device Input, Touch & Settings Contracts
// ============================================================================

export type InputDeviceMode = 'keyboard' | 'gamepad_xbox' | 'gamepad_ps' | 'gamepad_switch' | 'gamepad_tesla' | 'touch';

export type TouchVisibilitySetting = 'auto' | 'always_on' | 'off';

export type FpsLimitOption = 30 | 60 | 120;

export interface TouchLayoutConfig {
  opacity: number; // 0.20..0.65 (default 0.38 idle; active press scales up to 0.68)
  scale: number; // 0.75..1.35 (default 1.0)
  dpadOffsetX: number; // px offset
  dpadOffsetY: number;
  actionOffsetX: number;
  actionOffsetY: number;
}

export interface KeyBindings {
  left: string;
  right: string;
  up: string;
  down: string;
  jump: string;
  dash: string;
  stomp: string;
  formNext: string;
  formPrev: string;
  interact: string;
  map: string;
  pause: string;
}

export interface RenderSettings {
  fpsLimit: FpsLimitOption;
  classicSnap: boolean;
  screenShake: boolean;
  useCustomPack: boolean;
}

export interface AudioSettings {
  masterVolume: number; // 0..1
  sfxVolume: number; // 0..1
  musicVolume: number; // 0..1
  muted: boolean;
}

export interface InputSettings {
  touchMode: TouchVisibilitySetting;
  touchLayout: TouchLayoutConfig;
  hapticsEnabled: boolean;
  deadzone: number; // default 0.20
  bindings: KeyBindings;
}

export interface GameSettings {
  render: RenderSettings;
  audio: AudioSettings;
  input: InputSettings;
}

export interface InputFrame {
  moveX: number; // -1..1
  moveY: number; // -1..1 (down = -1, up = +1)
  jumpHeld: boolean;
  jumpPressed: boolean;
  dashHeld: boolean;
  dashPressed: boolean;
  stompHeld: boolean;
  stompPressed: boolean;
  formNextPressed: boolean;
  formPrevPressed: boolean;
  directFormIndex: number; // -1 or 0..5
  interactPressed: boolean;
  mapPressed: boolean;
  pausePressed: boolean;
}

export interface DeviceGlyphMap {
  readonly device: InputDeviceMode;
  readonly jump: string;
  readonly dash: string;
  readonly stomp: string;
  readonly form: string;
  readonly interact: string;
  readonly map: string;
  readonly pause: string;
}

export interface IInputOrchestrator {
  readonly activeDevice: InputDeviceMode;
  readonly touchOverlayVisible: boolean;
  readonly settings: InputSettings;
  pollFrame(): InputFrame;
  getGlyphs(): DeviceGlyphMap;
  updateSettings(patch: Partial<InputSettings>): void;
  setTouchLayout(layout: Partial<TouchLayoutConfig>): void;
  triggerHaptic(kind: 'light' | 'stomp' | 'hit' | 'death' | 'heal'): void;
  injectVirtualTouch(active: boolean): void;
  injectVirtualGamepadState(pad: VirtualGamepadSnapshot | null): void;
  dispose(): void;
}

export interface VirtualGamepadSnapshot {
  id: string;
  axes: number[];
  buttons: Array<{ pressed: boolean; value: number }>;
  mapping?: string;
}

// ============================================================================
// 7. Save Schema & Asset Pack Contracts
// ============================================================================

export const SAVE_STORAGE_KEY = 'krunked_quest_save_v1';

export interface SaveData {
  version: 1;
  savedAt: number;
  roomId: string;
  spawnX: number;
  spawnY: number;
  activeForm: HeroFormId;
  progress: ProgressState;
  settings: GameSettings;
}

export interface SpriteFrameRect {
  readonly x: number; // Top-left pixel X in PNG
  readonly y: number; // Top-left pixel Y in PNG
  readonly w: number;
  readonly h: number;
  readonly pivotX: number; // Normalized [0..1] (0.5 = center)
  readonly pivotY: number; // Normalized [0..1] TOP-DOWN (1.0 = bottom/feet)
}

export interface SpriteAnimClip {
  readonly frames: readonly number[]; // Indices into CustomPackEntry.frames
  readonly fps: number;
  readonly loop: boolean;
}

export interface TileLayoutMeta {
  readonly tileSize: number; // 32
  readonly format: 'strip16' | 'grid4x4';
  readonly rows: number; // 2: row0 = 16-mask solid, row1 = extras
  readonly hasInnerCorners?: boolean; // row1 cols 0..3: [TR-inner, TL-inner, BR-inner, BL-inner]
  readonly innerCornerRow?: number; // 1
  readonly variantCols?: readonly number[]; // row1 cols 4..7
  readonly bgWallCols?: readonly number[]; // row1 cols 8..11
}

export interface ParallaxLayerMeta {
  readonly scrollX: number;
  readonly scrollY: number;
  readonly anchorY: 'top' | 'center' | 'bottom';
  readonly offsetY?: number;
  readonly tileX: boolean;
  readonly fillViewport?: boolean;
}

export interface CustomPackEntry {
  readonly key: string;
  readonly path: string;
  readonly width: number;
  readonly height: number;
  readonly category: 'hero' | 'tile' | 'enemy' | 'boss' | 'ui' | 'bg' | 'fx';
  readonly frames?: readonly SpriteFrameRect[];
  readonly clips?: Readonly<Record<string, SpriteAnimClip>>;
  readonly tileLayout?: TileLayoutMeta;
  readonly parallax?: ParallaxLayerMeta;
}

export interface CustomPackManifest {
  readonly version: number;
  readonly generatedAt: string;
  readonly sourceVerified: boolean;
  readonly entries: Record<string, CustomPackEntry>;
}

export interface IAssetPackManager {
  readonly customPackAvailable: boolean;
  readonly customPackEnabled: boolean;
  readonly manifest: CustomPackManifest | null;
  init(): Promise<void>;
  setUseCustomPack(enabled: boolean): void;
  loadFromDirectoryPicker(): Promise<{ ok: boolean; count: number; message: string }>;
  getSprite(key: string): HTMLCanvasElement | HTMLImageElement | null;
  getEntry(key: string): CustomPackEntry | null;
  getBiomeTileset(biome: BiomeId): HTMLCanvasElement | HTMLImageElement | null;
  getHeroSheet(form: HeroFormId): HTMLCanvasElement | HTMLImageElement | null;
  getAllRegisteredKeys(): string[];
}

// ============================================================================
// 8. Core Subsystem Interfaces (Dependency Injection Boundaries)
// ============================================================================

export interface ISimEngine {
  createInitialState(catalog: IWorldCatalog, options?: { seed?: number; mode?: GameMode; roomId?: string; progress?: Partial<ProgressState> }): SimState;
  step(state: SimState, input: InputFrame, catalog: IWorldCatalog): SimEvent[];
  warpToRoom(state: SimState, catalog: IWorldCatalog, roomId: string, spawnX?: number, spawnY?: number): SimEvent[];
  hashState(state: SimState): number;
  buyUpgrade(state: SimState, catalog: IWorldCatalog, key: UpgradeKey): boolean;
  buyRelic(state: SimState, catalog: IWorldCatalog, id: RelicId): boolean;
  toggleEquipRelic(state: SimState, catalog: IWorldCatalog, id: RelicId): boolean;
  startGhostShip(state: SimState, catalog: IWorldCatalog): SimEvent[];
  startBossRush(state: SimState, catalog: IWorldCatalog, bossId: BossId): SimEvent[];
  startTimeAttack(state: SimState, catalog: IWorldCatalog): SimEvent[];
}

export interface IPixelRenderer {
  attach(canvas: HTMLCanvasElement): void;
  render(
    state: SimState,
    catalog: IWorldCatalog,
    interpAlpha: number,
    settings: RenderSettings,
    glyphs: DeviceGlyphMap,
    screenMode: ScreenMode,
    timeSec: number,
  ): void;
  consumeEvents(events: readonly SimEvent[]): void;
  setPackManager(packs: IAssetPackManager): void;
  dispose(): void;
}

export interface IAudioEngine {
  unlock(): void;
  consumeEvents(events: readonly SimEvent[], biome: BiomeId, inBoss: boolean): void;
  setMusicContext(context: BiomeId | 'TITLE' | 'BOSS' | 'MINIBOSS' | 'SHADOW_DUEL' | 'FINAL_BOSS' | 'VICTORY'): void;
  playUiSfx?(kind: 'move' | 'confirm' | 'back' | 'tab' | 'error'): void;
  updateSettings(settings: AudioSettings): void;
  getSettings(): AudioSettings;
  dispose(): void;
}

// ============================================================================
// 9. Global Debug & Playtest Bridge (`window.__KRUNKED_DEBUG__`)
// ============================================================================

export interface KrunkedDebugBridge {
  getState(): SimState;
  getHash(): number;
  getScreenMode(): ScreenMode;
  setScreenMode(mode: ScreenMode): void;
  getDeviceState(): {
    activeDevice: InputDeviceMode;
    touchOverlayVisible: boolean;
    touchMode: TouchVisibilitySetting;
    glyphs: DeviceGlyphMap;
  };
  warpRoom(roomId: string): boolean;
  unlockAllForms(): void;
  setForm(form: HeroFormId): void;
  grantCrystals(amount: number): void;
  healFull(): void;
  damageHero(amount?: number): void;
  killRoomEnemies(): void;
  spawnBoss(bossId: BossId): boolean;
  startMode(mode: GameMode): void;
  setFpsLimit(fps: FpsLimitOption): void;
  setTouchMode(mode: TouchVisibilitySetting): void;
  simulateTouchEvent(): void;
  simulateKeyEvent(code?: string): void;
  injectGamepad(pad: VirtualGamepadSnapshot | null): void;
  getRoomIds(): string[];
  getFpsMetrics(): { targetFps: FpsLimitOption; measuredFps: number; tick: number };
  toggleCustomPack(enabled: boolean): boolean;
  forceSave(): void;
  resetSave(): void;
}

declare global {
  interface Window {
    __KRUNKED_DEBUG__?: KrunkedDebugBridge;
  }
}

export const DEFAULT_KEY_BINDINGS: KeyBindings = {
  left: 'ArrowLeft',
  right: 'ArrowRight',
  up: 'ArrowUp',
  down: 'ArrowDown',
  jump: 'KeyZ',
  dash: 'KeyC',
  stomp: 'KeyX',
  formNext: 'KeyE',
  formPrev: 'KeyQ',
  interact: 'KeyF',
  map: 'KeyM',
  pause: 'Escape',
};

export const DEFAULT_TOUCH_LAYOUT: TouchLayoutConfig = {
  opacity: 0.38,
  scale: 1.0,
  dpadOffsetX: 0,
  dpadOffsetY: 0,
  actionOffsetX: 0,
  actionOffsetY: 0,
};

export const DEFAULT_SETTINGS: GameSettings = {
  render: {
    fpsLimit: 120,
    classicSnap: false,
    screenShake: true,
    useCustomPack: false,
  },
  audio: {
    masterVolume: 0.75,
    sfxVolume: 0.85,
    musicVolume: 0.55,
    muted: false,
  },
  input: {
    touchMode: 'auto',
    touchLayout: { ...DEFAULT_TOUCH_LAYOUT },
    hapticsEnabled: true,
    deadzone: 0.2,
    bindings: { ...DEFAULT_KEY_BINDINGS },
  },
};

export function createEmptyInputFrame(): InputFrame {
  return {
    moveX: 0,
    moveY: 0,
    jumpHeld: false,
    jumpPressed: false,
    dashHeld: false,
    dashPressed: false,
    stompHeld: false,
    stompPressed: false,
    formNextPressed: false,
    formPrevPressed: false,
    directFormIndex: -1,
    interactPressed: false,
    mapPressed: false,
    pausePressed: false,
  };
}
