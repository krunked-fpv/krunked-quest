import {
  ARENA_ZOOM,
  COMBO_PRESETS,
  COMBO_RULES,
  FIXED_DT,
  FORM_PARAMS,
  HERO_FORMS,
  ORTHOGRAPHIC_SIZE,
  PHYSICS,
  PPU,
  SIM_HZ,
  VIEWPORT_H,
  VIEWPORT_TILES_H,
  VIEWPORT_TILES_W,
  VIEWPORT_W,
  type HeroFormId,
  type RelicId,
  type SimState,
  type UpgradeKey,
} from '../contracts/index';

export {
  ARENA_ZOOM,
  COMBO_PRESETS,
  COMBO_RULES,
  FIXED_DT,
  FORM_PARAMS,
  HERO_FORMS,
  ORTHOGRAPHIC_SIZE,
  PHYSICS,
  PPU,
  SIM_HZ,
  VIEWPORT_H,
  VIEWPORT_TILES_H,
  VIEWPORT_TILES_W,
  VIEWPORT_W,
};

export const ALL_UPGRADE_KEYS: readonly UpgradeKey[] = [
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
] as const;

export const SIM_RULES = {
  DEFAULT_SEED: 0x51a7c0de,
  BOUNCE_TILE_VY: 18.0,
  CRUMBLE_BREAK_TIME: 0.45,
  CRUMBLE_RESPAWN_TIME: 3.0,
  EXPLOSIVE_RADIUS: 2.25,
  STOMP_FLAME_RADIUS: 2.25,
  DASH_ROUND_FIRE_RADIUS: 1.4,
  DASH_ROUND_FIRE_SPEED: 8.5,
  FIRE_ROUND_OFFSET_Y: 0.7,
  FIRE_ROUND_HALF_W: 0.55,
  FIRE_ROUND_HALF_H: 0.55,
  FIRE_WAVE_SPEED: 3.0,
  FIRE_WAVE_TTL: 1.6,
  FIRE_WAVE_RADIUS: 0.36,
  FIRE_DASH_IMMUNITY_DUR: 1.0,
  QUICKSAND_MAX_FALL: 1.8,
  ANTIGRAV_GRAVITY_SCALE: 0.55,
  WIND_UP_ACCEL: 54.0,
  WIND_UP_MAX_VY: 8.5,
  WIND_SIDE_ACCEL: 24.0,
  WIND_SIDE_MAX_DELTA: 3.2,
  MAGNET_BASE_RADIUS: 1.6,
  MAGNET_RELIC_RADIUS: 5.0,
  MAGNET_PULL_SPEED: 14.0,
  CRYSTAL_PICKUP_RADIUS: 0.78,
  COIN_PICKUP_RADIUS: 0.85,
  PROP_INTERACT_RADIUS: 1.8,
  EVIL_RING_RADIUS: 3.5,
  EVIL_RING_DAMAGE: 3,
  BANDIT_SHORTS_DODGE_CHANCE: 0.35,
  MAGIC_SHIELD_DUR: 3.0,
  MANIAC_CRYSTAL_COMBO_MULT: 1.5,
  MANIAC_CRYSTAL_FREEZE_DUR: 0.35,
  OLD_CLOCK_SLOWMO_DUR: 0.35,
  OLD_CLOCK_SLOWMO_SCALE: 0.25,
  CRYSTALLINE_HUNGER_MULT: 2.0,
  CRYSTAL_ABUNDANCE_MULT: 1.5,
  PLATINUM_MEDAL_CRYSTAL_MULT: 1.25,
  EXTRA_COIN_CRYSTAL_BONUS: 50,
  LIVELY_HEART_HP_BONUS: 1,
  BASE_RELIC_SLOTS: 2,
  VOLT_DIVE_MAX_DUR: 0.45,
  VOLT_NODE_CONE_DEG: 45,
  VOLT_FRONT_AUTO_DIST: 1.25,
  SHADOW_SHOCKWAVE_SPEED: 14.0,
  SHADOW_SHOCKWAVE_TTL: 0.45,
  SHADOW_ENEMY_RADIUS: 4.5,
  SHADOW_MAX_DX: 4.0,
  SHADOW_MIN_DY: -1.5,
  SHADOW_TELEPORT_UP_DIST: 2.5,
  SHADOW_VANISH_DUR: 0.08,
  SHADOW_SHOW_DUR: 0.16,
  SHADOW_FIELD_RADIUS: 1.6,
  HARDER_COMBO_DECAY_MULT: 1.25,
  TILE_SKIN: 0.002,
  ONE_WAY_SNAP_TOLERANCE: 0.1,
  // Authentic movement, tongue, stomp, wall & camera tuning
  PRE_STOMP: 0.1,
  TONGUE_GROUND_STOMP_DUR: 0.22,
  TONGUE_GROUND_DASH_DUR: 0.2,
  TONGUE_WALL_DASH_DUR: 0.2,
  TONGUE_AIR_STOMP_DUR: 0.2,
  GROUND_STOMP_REACH_X: 0.55,
  GROUND_STOMP_REACH_DOWN: 0.4,
  STOMP_BLOCK_DESTROYER_HALF_W: 0.3,
  STOMP_BLOCK_DESTROYER_DEPTH: 0.72,
  LEAF_GLIDE_LERP_RATE: 10.0,
  LEAF_WIND_LERP_RATE: 5.0,
  WALL_SLIDE_LERP_RATE: 2.0,
  WALL_JUMP_X_MULT: 3.0,
  WALL_DASH_DECAY_MULT: 0.5,
  WALL_DASH_MIN_VX: 5.0,
  GROUND_DASH_MIN_VX: 2.0,
  LAST_ENEMY_HIT_EXTENDED: 0.1,
  CAM_DEADZONE_X: 1.0,
  CAM_STOP_DIST: 0.1,
  CAM_SHAKE_STRENGTH: 0.1,
  CAM_SHAKE_DECAY_RATE: 0.36,
} as const;

export function createEmptyUpgradeLevels(): Record<UpgradeKey, number> {
  return {
    ExtraLife: 0,
    ItemSlot: 0,
    CrystallineHunger: 0,
    LeafCombo: 0,
    LeafExtraJump: 0,
    StompFlame: 0,
    DashFlame: 0,
    RockShield: 0,
    RockUppercutInvuln: 0,
    VoltRange: 0,
    VoltShield: 0,
    IronSkin: 0,
    TripleJump: 0,
    RockUppercutPower: 0,
    DashRoundFire: 0,
    ViewMapExits: 0,
    ViewSecretAreas: 0,
    ViewMapArenas: 0,
  };
}

export function hasRelic(state: SimState, id: RelicId): boolean {
  return state.progress.equippedRelics.includes(id);
}

export function getUpgradeLevel(state: SimState, key: UpgradeKey): number {
  return state.progress.upgradeLevels[key] ?? 0;
}

export function computeMaxHp(state: SimState): number {
  const extraLife = Math.min(PHYSICS.MAX_EXTRA_LIFE, getUpgradeLevel(state, 'ExtraLife'));
  const heartBonus = hasRelic(state, 'lively_heart') ? SIM_RULES.LIVELY_HEART_HP_BONUS : 0;
  return PHYSICS.START_HP + extraLife + heartBonus;
}

export function computeMaxRelicSlots(state: SimState): number {
  return SIM_RULES.BASE_RELIC_SLOTS + getUpgradeLevel(state, 'ItemSlot');
}

export function computeMaxAirJumps(state: SimState, form: HeroFormId = state.hero.form): number {
  if (form === 'krunk_basic' && getUpgradeLevel(state, 'TripleJump') > 0) {
    return 2;
  }
  if (form === 'krunk_leaf' && getUpgradeLevel(state, 'LeafExtraJump') > 0) {
    return 2;
  }
  return 1;
}

export function getWallSlideSpeed(form: HeroFormId): number {
  return form === 'krunk_basic' ? PHYSICS.WALL_SLIDE_BASIC : PHYSICS.WALL_SLIDE_FORM;
}
