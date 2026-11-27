import type { RoomDef, RoomModeType, SimEvent, SimState } from '../contracts/index';
import { triggerCameraShake } from './camera';
import {
  COMBO_PRESETS,
  COMBO_RULES,
  FIXED_DT,
  FORM_PARAMS,
  SIM_RULES,
  getUpgradeLevel,
  hasRelic,
} from './constants';

interface CurveKey {
  readonly t: number;
  readonly v: number;
}

// Verified origin nonlinear comboLossCurve keyframes (normTimer -> decay rate multiplier)
const COMBO_LOSS_CURVES: Record<RoomModeType, readonly CurveKey[]> = {
  normal: [
    { t: 0.0, v: 0.2 },
    { t: 0.17, v: 0.33 },
    { t: 0.33, v: 1.01 },
    { t: 0.66, v: 1.51 },
    { t: 1.0, v: 1.51 },
  ],
  arena: [
    { t: 0.0, v: 0.21 },
    { t: 0.18, v: 0.4 },
    { t: 0.33, v: 1.01 },
    { t: 0.66, v: 1.51 },
    { t: 1.0, v: 1.51 },
  ],
  boss: [
    { t: 0.0, v: 0.18 },
    { t: 0.17, v: 0.33 },
    { t: 0.33, v: 1.01 },
    { t: 0.66, v: 1.51 },
    { t: 1.0, v: 1.51 },
  ],
};

function evaluateComboLossCurve(preset: RoomModeType, normTimer: number): number {
  const keys = COMBO_LOSS_CURVES[preset];
  const x = Math.max(0, Math.min(1, normTimer));
  for (let i = 0; i < keys.length - 1; i++) {
    const a = keys[i];
    const b = keys[i + 1];
    if (x <= b.t) {
      const span = Math.max(1e-4, b.t - a.t);
      const frac = (x - a.t) / span;
      return a.v + (b.v - a.v) * frac;
    }
  }
  return keys[keys.length - 1].v;
}

export function initRoomCombo(state: SimState, room: RoomDef): void {
  const preset = COMBO_PRESETS[room.mode];
  const enemyCount = state.enemies.length;
  state.combo.preset = room.mode;
  state.combo.count = 0;
  state.combo.maxSceneCombo = enemyCount;
  state.combo.timer = 0;
  state.combo.maxTimer = preset.maxTimer;
  state.combo.decayAccum = 0;
  state.combo.freezeTimer = 0;
  state.combo.miniComboTimer = 0;
  state.combo.miniComboCount = 0;
  state.combo.roomComboCleared = state.progress.clearedComboRooms.includes(room.id);
  state.combo.bannerTimer = 0;
  state.combo.bannerText = '';
}

function checkAutoHeal(state: SimState, events: SimEvent[]): void {
  const combo = state.combo;
  if (combo.maxTimer <= 0) return;
  const ratio = combo.timer / combo.maxTimer;
  if (ratio < COMBO_RULES.HEAL_THRESHOLD) return;

  const hero = state.hero;
  const needsHp = hero.hp < hero.maxHp;
  const needsRockShield = getUpgradeLevel(state, 'RockShield') > 0 && !hero.rockShieldActive;

  if (!needsHp && !needsRockShield) {
    return;
  }

  if (needsHp) {
    hero.hp = Math.min(hero.maxHp, hero.hp + 1);
  }
  if (getUpgradeLevel(state, 'RockShield') > 0) {
    hero.rockShieldActive = true;
  }

  const preset = COMBO_PRESETS[combo.preset];
  combo.timer = preset.healResetRatio * combo.maxTimer;
  events.push({ type: 'heal', x: hero.x + hero.width * 0.5, y: hero.y + hero.height * 0.5, hp: hero.hp });
}

export function registerComboEnemyHit(
  state: SimState,
  x: number,
  y: number,
  killed: boolean,
  events: SimEvent[],
): void {
  const combo = state.combo;
  const preset = COMBO_PRESETS[combo.preset];
  const isFirst = combo.count === 0;
  combo.count += 1;

  const maniac = hasRelic(state, 'maniac_crystal');
  const maniacMult = maniac ? SIM_RULES.MANIAC_CRYSTAL_COMBO_MULT : 1.0;

  const baseGain = isFirst ? preset.firstHitBonus : preset.enemyHitGain;
  const gain = baseGain * maniacMult;
  combo.timer = Math.min(combo.maxTimer, combo.timer + gain);

  if (maniac) {
    combo.freezeTimer = Math.max(combo.freezeTimer, SIM_RULES.MANIAC_CRYSTAL_FREEZE_DUR);
  }

  // Mini-combo rapid-hit crystal bonus (0.15s window)
  if (combo.miniComboTimer > 0) {
    combo.miniComboCount += 1;
    const bonus = COMBO_RULES.CRYSTAL_PER_COMBO_STEP * combo.miniComboCount;
    state.progress.crystals += bonus;
    events.push({ type: 'crystal_pickup', x, y, value: bonus });
  } else {
    combo.miniComboCount = 1;
  }
  combo.miniComboTimer = COMBO_RULES.MINI_COMBO_WINDOW;

  // Check >= 95% auto-heal + RockShield regeneration (even at full HP!)
  checkAutoHeal(state, events);

  // Check max room combo (all enemies in room cleared in one unbroken combo)
  if (
    killed &&
    combo.maxSceneCombo > 0 &&
    !combo.roomComboCleared &&
    combo.count >= combo.maxSceneCombo
  ) {
    const allDead = state.enemies.every((e) => !e.alive);
    if (allDead) {
      triggerMaxRoomCombo(state, x, y, events);
    }
  }
}

function triggerMaxRoomCombo(state: SimState, x: number, y: number, events: SimEvent[]): void {
  const combo = state.combo;
  combo.roomComboCleared = true;
  combo.bannerTimer = 2.5;
  combo.bannerText = 'KRUNKED COMBO!';

  // Celebratory 0.05x slowmo hitstop
  state.slowmoTimer = Math.max(state.slowmoTimer, COMBO_RULES.MAX_COMBO_HITSTOP_TICKS * FIXED_DT);
  state.slowmoScale = COMBO_RULES.MAX_COMBO_HITSTOP_SCALE;
  triggerCameraShake(state, 0.14);

  if (!state.progress.clearedComboRooms.includes(state.roomId)) {
    state.progress.clearedComboRooms.push(state.roomId);
  }

  // Award room combo coin
  let awardedCoinId: string | null = null;
  for (let i = 0; i < state.coins.length; i++) {
    const c = state.coins[i];
    if (c.kind === 'combo' && !c.collected) {
      c.collected = true;
      awardedCoinId = c.id;
      break;
    }
  }
  if (!awardedCoinId) {
    awardedCoinId = `combo_${state.roomId}`;
  }
  if (!state.progress.collectedCoinIds.includes(awardedCoinId)) {
    state.progress.collectedCoinIds.push(awardedCoinId);
    events.push({
      type: 'coin_pickup',
      x,
      y,
      coinId: awardedCoinId,
      totalCoins: state.progress.collectedCoinIds.length,
    });
  }

  // Bonus crystals (amplified by extra_coin / arenaBonus)
  const preset = COMBO_PRESETS[combo.preset];
  const bonusCrystals =
    COMBO_RULES.CRYSTAL_PER_COMBO_STEP * combo.count +
    Math.round(preset.arenaBonus * 25) +
    (hasRelic(state, 'extra_coin') ? SIM_RULES.EXTRA_COIN_CRYSTAL_BONUS : 0);
  state.progress.crystals += bonusCrystals;

  // Vampiric Amulet heals +1 HP on max room combo
  if (hasRelic(state, 'vampiric_amulet') && state.hero.hp < state.hero.maxHp) {
    state.hero.hp = Math.min(state.hero.maxHp, state.hero.hp + 1);
    events.push({
      type: 'heal',
      x: state.hero.x + state.hero.width * 0.5,
      y: state.hero.y + state.hero.height * 0.5,
      hp: state.hero.hp,
    });
  }

  events.push({ type: 'combo_max', x, y, roomId: state.roomId });
}

export function registerComboCrystal(state: SimState, events: SimEvent[]): void {
  const combo = state.combo;
  if (combo.count <= 0) return;

  const preset = COMBO_PRESETS[combo.preset];
  const maniacMult = hasRelic(state, 'maniac_crystal') ? SIM_RULES.MANIAC_CRYSTAL_COMBO_MULT : 1.0;
  combo.timer = Math.min(combo.maxTimer, combo.timer + preset.crystalGain * maniacMult);
  checkAutoHeal(state, events);
}

export function breakCombo(state: SimState): void {
  if (hasRelic(state, 'platinum_medal')) {
    return;
  }
  state.combo.count = 0;
  state.combo.timer = 0;
  state.combo.decayAccum = 0;
  state.combo.miniComboTimer = 0;
  state.combo.miniComboCount = 0;
}

export function tickCombo(state: SimState, dt: number): void {
  const combo = state.combo;
  if (combo.bannerTimer > 0) {
    combo.bannerTimer = Math.max(0, combo.bannerTimer - dt);
  }
  if (combo.miniComboTimer > 0) {
    combo.miniComboTimer = Math.max(0, combo.miniComboTimer - dt);
    if (combo.miniComboTimer === 0) {
      combo.miniComboCount = 0;
    }
  }

  if (combo.count <= 0) {
    combo.timer = 0;
    combo.decayAccum = 0;
    return;
  }

  // Freeze timer (Maniac Crystal) or recoil pauses decay
  if (combo.freezeTimer > 0) {
    combo.freezeTimer = Math.max(0, combo.freezeTimer - dt);
    return;
  }
  if (state.hero.recoilTimer > 0) {
    return;
  }

  // Decay every 0.05s (3 ticks at 60Hz) using exact nonlinear comboLossCurve
  combo.decayAccum += dt;
  const interval = COMBO_RULES.DECAY_TICK_INTERVAL;

  while (combo.decayAccum >= interval) {
    combo.decayAccum -= interval;
    const norm = combo.maxTimer > 0 ? combo.timer / combo.maxTimer : 0;
    let decayAmount = interval * evaluateComboLossCurve(combo.preset, norm);

    if (state.hero.form === 'krunk_leaf' && getUpgradeLevel(state, 'LeafCombo') > 0) {
      decayAmount *= FORM_PARAMS.LEAF_COMBO_LOSS_UPGRADED;
    }

    combo.timer = Math.max(0, combo.timer - decayAmount);
    if (combo.timer <= 0) {
      combo.count = 0;
      combo.decayAccum = 0;
      combo.miniComboTimer = 0;
      combo.miniComboCount = 0;
      break;
    }
  }
}
