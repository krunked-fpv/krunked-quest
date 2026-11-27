import type {
  HeroFormId,
  InputFrame,
  RoomDef,
  SimEvent,
  SimState,
} from '../contracts/index';
import { linecastSafeTeleport } from './collision';
import {
  FORM_PARAMS,
  HERO_FORMS,
  PHYSICS,
  SIM_RULES,
  computeMaxAirJumps,
  getUpgradeLevel,
} from './constants';

export interface VoltLockTarget {
  id: string;
  x: number;
  y: number;
  kind: 'node' | 'enemy' | 'boss';
}

export interface ShadowLockTarget {
  id: string;
  x: number;
  y: number;
  kind: 'enemy' | 'boss';
}

export interface FormAbilityTickResult {
  handledMovement: boolean;
  allowHorizontalSteer: boolean;
  gravityScale: number;
  applyGravity: boolean;
  completedVoltTargetId: string | null;
  completedShadowTargetId: string | null;
  clearedShadowProjectiles: boolean;
}

export function handleFormSwitchInput(
  state: SimState,
  input: InputFrame,
  events: SimEvent[],
): void {
  const unlocked = state.progress.unlockedForms;
  if (unlocked.length === 0) return;

  let nextForm: HeroFormId | null = null;

  if (input.directFormIndex >= 0 && input.directFormIndex < HERO_FORMS.length) {
    const requested = HERO_FORMS[input.directFormIndex];
    if (unlocked.includes(requested)) {
      nextForm = requested;
    }
  } else if (input.formNextPressed && unlocked.length > 1) {
    const idx = unlocked.indexOf(state.hero.form);
    nextForm = unlocked[(idx + 1 + unlocked.length) % unlocked.length];
  } else if (input.formPrevPressed && unlocked.length > 1) {
    const idx = unlocked.indexOf(state.hero.form);
    nextForm = unlocked[(idx - 1 + unlocked.length) % unlocked.length];
  }

  if (nextForm && nextForm !== state.hero.form) {
    switchHeroForm(state, nextForm, events);
  }
}

export function switchHeroForm(
  state: SimState,
  newForm: HeroFormId,
  events: SimEvent[],
): void {
  const hero = state.hero;
  const prevMax = hero.maxAirJumps;
  hero.form = newForm;
  hero.maxAirJumps = computeMaxAirJumps(state, newForm);
  if (hero.grounded) {
    hero.jumpsRemaining = hero.maxAirJumps;
  } else if (hero.maxAirJumps > prevMax) {
    hero.jumpsRemaining = Math.min(hero.maxAirJumps, hero.jumpsRemaining + (hero.maxAirJumps - prevMax));
  } else if (hero.jumpsRemaining > hero.maxAirJumps) {
    hero.jumpsRemaining = hero.maxAirJumps;
  }

  // Cancel form-exclusive locked actions cleanly while preserving hero momentum (vx/vy)
  if (
    hero.action === 'fire_dash' ||
    hero.action === 'leaf_glide' ||
    hero.action === 'rock_uppercut' ||
    hero.action === 'volt_dive' ||
    hero.action === 'volt_blink' ||
    hero.action === 'shadow_blink'
  ) {
    hero.action = hero.grounded ? 'idle' : hero.vy > 0 ? 'jump' : 'fall';
    hero.abilityTimer = 0;
    hero.abilityPhase = 0;
    hero.voltTargetId = null;
  }

  events.push({ type: 'form_switch', form: newForm });
}

export function findVoltConeTarget(
  state: SimState,
  room: RoomDef,
  diveVx: number,
  diveVy: number,
): VoltLockTarget | null {
  const hero = state.hero;
  const hx = hero.x + hero.width * 0.5;
  const hy = hero.y + hero.height * 0.5;

  const diveLen = Math.hypot(diveVx, diveVy);
  if (diveLen < 1e-4) return null;
  const dirX = diveVx / diveLen;
  const dirY = diveVy / diveLen;

  const cosEnemyCone = Math.cos((FORM_PARAMS.VOLT_CONE_DEG * Math.PI) / 180);
  const cosNodeCone = Math.cos((SIM_RULES.VOLT_NODE_CONE_DEG * Math.PI) / 180);
  const rangeBonus = getUpgradeLevel(state, 'VoltRange') > 0 ? FORM_PARAMS.VOLT_RANGE_BONUS : 0;
  const nodeRange = FORM_PARAMS.VOLT_NODE_RANGE + rangeBonus;
  const enemyRange = FORM_PARAMS.VOLT_ENEMY_RANGE + rangeBonus;

  let best: VoltLockTarget | null = null;
  let bestDistSq = Infinity;

  // 1. Volt nodes (45 deg cone)
  for (let i = 0; i < room.props.length; i++) {
    const prop = room.props[i];
    if (prop.kind !== 'volt_node') continue;
    const tx = prop.x + (prop.width ?? 1) * 0.5;
    const ty = prop.y + (prop.height ?? 1) * 0.5;
    const dx = tx - hx;
    const dy = ty - hy;
    const distSq = dx * dx + dy * dy;
    if (distSq < 0.01 || distSq > nodeRange * nodeRange) continue;
    const dist = Math.sqrt(distSq);
    const dot = (dx * dirX + dy * dirY) / dist;
    if (dot >= cosNodeCone && distSq < bestDistSq) {
      bestDistSq = distSq;
      best = { id: prop.id, x: tx, y: ty, kind: 'node' };
    }
  }

  // 2. Alive enemies (40 deg cone OR close in front < 1.25u)
  for (let i = 0; i < state.enemies.length; i++) {
    const enemy = state.enemies[i];
    if (!enemy.alive) continue;
    const tx = enemy.x + enemy.width * 0.5;
    const ty = enemy.y + enemy.height * 0.5;
    const dx = tx - hx;
    const dy = ty - hy;
    const distSq = dx * dx + dy * dy;
    if (distSq < 0.01 || distSq > enemyRange * enemyRange) continue;
    const dist = Math.sqrt(distSq);
    const dot = (dx * dirX + dy * dirY) / dist;
    const closeAhead = dist <= SIM_RULES.VOLT_FRONT_AUTO_DIST && dx * hero.facing >= -0.2;
    if ((dot >= cosEnemyCone || closeAhead) && distSq < bestDistSq) {
      bestDistSq = distSq;
      best = { id: enemy.id, x: tx, y: ty, kind: 'enemy' };
    }
  }

  // 3. Active boss
  if (state.boss && !state.boss.defeated) {
    const boss = state.boss;
    const tx = boss.x + boss.width * 0.5;
    const ty = boss.y + boss.height * 0.5;
    const dx = tx - hx;
    const dy = ty - hy;
    const distSq = dx * dx + dy * dy;
    if (distSq >= 0.01 && distSq <= enemyRange * enemyRange) {
      const dist = Math.sqrt(distSq);
      const dot = (dx * dirX + dy * dirY) / dist;
      const closeAhead = dist <= SIM_RULES.VOLT_FRONT_AUTO_DIST && dx * hero.facing >= -0.2;
      if ((dot >= cosEnemyCone || closeAhead) && distSq < bestDistSq) {
        best = { id: boss.id, x: tx, y: ty, kind: 'boss' };
      }
    }
  }

  return best;
}

export function findShadowTarget(state: SimState): ShadowLockTarget | null {
  const hero = state.hero;
  const hx = hero.x + hero.width * 0.5;
  const hy = hero.y + hero.height * 0.5;
  const maxR2 = SIM_RULES.SHADOW_ENEMY_RADIUS * SIM_RULES.SHADOW_ENEMY_RADIUS;

  let best: ShadowLockTarget | null = null;
  let bestDistSq = Infinity;

  for (let i = 0; i < state.enemies.length; i++) {
    const enemy = state.enemies[i];
    if (!enemy.alive) continue;
    const tx = enemy.x + enemy.width * 0.5;
    const ty = enemy.y + enemy.height * 0.5;
    const dx = tx - hx;
    const dy = ty - hy;
    if (Math.abs(dx) > SIM_RULES.SHADOW_MAX_DX || dy < SIM_RULES.SHADOW_MIN_DY) continue;
    const distSq = dx * dx + dy * dy;
    if (distSq <= maxR2 && distSq < bestDistSq) {
      bestDistSq = distSq;
      best = { id: enemy.id, x: tx, y: ty, kind: 'enemy' };
    }
  }

  if (state.boss && !state.boss.defeated) {
    const boss = state.boss;
    const tx = boss.x + boss.width * 0.5;
    const ty = boss.y + boss.height * 0.5;
    const dx = tx - hx;
    const dy = ty - hy;
    if (Math.abs(dx) <= SIM_RULES.SHADOW_MAX_DX + 0.5 && dy >= SIM_RULES.SHADOW_MIN_DY) {
      const distSq = dx * dx + dy * dy;
      if (distSq <= maxR2 && distSq < bestDistSq) {
        best = { id: boss.id, x: tx, y: ty, kind: 'boss' };
      }
    }
  }

  return best;
}

function isVoltSpeedUpgraded(state: SimState): boolean {
  return getUpgradeLevel(state, 'VoltShield') > 0 || getUpgradeLevel(state, 'VoltRange') > 0;
}

function enterVoltBlink(state: SimState, target: VoltLockTarget): void {
  const hero = state.hero;
  hero.action = 'volt_blink';
  hero.abilityTimer = 0;
  hero.voltTargetId = target.id;
  hero.voltTargetX = target.x;
  hero.voltTargetY = target.y;

  const hx = hero.x + hero.width * 0.5;
  const hy = hero.y + hero.height * 0.5;
  const dx = target.x - hx;
  const dy = target.y - hy;
  const dist = Math.max(0.001, Math.hypot(dx, dy));
  const speed = isVoltSpeedUpgraded(state)
    ? FORM_PARAMS.VOLT_BLINK_SPEED_UPGRADED
    : FORM_PARAMS.VOLT_BLINK_SPEED;
  hero.vx = (dx / dist) * speed;
  hero.vy = (dy / dist) * speed;
}

/**
 * Attempts to start a midair form ability when Dash is pressed in the air.
 * Cancels air_stomp / ground_dash / wall_dash cleanly when an ability starts.
 * Basic form does NOTHING unless TripleJump is owned (eliminating the sluggish 0.25s hover freeze!).
 */
export function tryStartAirFormAbility(
  state: SimState,
  input: InputFrame,
  room: RoomDef,
  events: SimEvent[],
): boolean {
  const hero = state.hero;
  const cx = hero.x + hero.width * 0.5;
  const cy = hero.y + hero.height * 0.5;
  const moveDir: -1 | 0 | 1 = input.moveX > 0.1 ? 1 : input.moveX < -0.1 ? -1 : 0;

  switch (hero.form) {
    case 'krunk_basic': {
      // Exact origin: Basic midair Dash does nothing unless Upgrade 12 (TripleJump) is unlocked!
      if (getUpgradeLevel(state, 'TripleJump') > 0 && !hero.abilityUsedInAir && hero.jumpsRemaining > 0) {
        hero.abilityUsedInAir = true;
        hero.jumpsRemaining = Math.max(0, hero.jumpsRemaining - 1);
        hero.vy = PHYSICS.DOUBLE_JUMP_FORCE;
        hero.jumpHoldTimer = 0;
        hero.wallJumpHoldTimer = 0;
        if (hero.action === 'air_stomp') {
          hero.tongueKind = 'none';
          hero.tongueTimer = 0;
        }
        // Preserve horizontal dash momentum if dashing!
        if (hero.groundDashTimer <= 0 && hero.wallDashTimer <= 0) {
          hero.action = 'flip';
        }
        hero.scaleX = 0.84;
        hero.scaleY = 1.2;
        events.push({ type: 'jump', x: cx, y: hero.y, air: true, form: 'krunk_basic' });
        return true;
      }
      return false;
    }

    case 'krunk_fire': {
      if (hero.abilityUsedInAir) return false;
      if (moveDir !== 0) {
        hero.facing = moveDir;
      }
      hero.action = 'fire_dash';
      hero.abilityTimer = 0;
      hero.abilityPhase = 0;
      hero.abilityUsedInAir = true;
      hero.groundDashTimer = 0;
      hero.wallDashTimer = 0;
      hero.jumpHoldTimer = 0;
      hero.wallJumpHoldTimer = 0;
      hero.tongueKind = 'none';
      hero.tongueTimer = 0;
      hero.vx = hero.facing * FORM_PARAMS.FIRE_DASH_SPEED;
      hero.vy = 0;
      hero.scaleX = 1.3;
      hero.scaleY = 0.78;
      events.push({ type: 'dash', x: cx, y: cy, kind: 'fire' });
      return true;
    }

    case 'krunk_leaf': {
      // Pressing Dash in Leaf form immediately glides (cancels Air Stomp cleanly into Glide!).
      // Note: LeafExtraJump is triggered on Jump press (computeMaxAirJumps === 2), matching origin!
      hero.action = 'leaf_glide';
      hero.abilityTimer = 0;
      hero.groundDashTimer = 0;
      hero.wallDashTimer = 0;
      hero.jumpHoldTimer = 0;
      hero.wallJumpHoldTimer = 0;
      hero.tongueKind = 'none';
      hero.tongueTimer = 0;
      return true;
    }

    case 'krunk_rock': {
      if (hero.abilityUsedInAir) return false;
      hero.action = 'rock_uppercut';
      hero.abilityTimer = 0;
      hero.abilityPhase = 0; // 0.05s hit-anticipation pause before vertical smash
      hero.abilityUsedInAir = true;
      hero.groundDashTimer = 0;
      hero.wallDashTimer = 0;
      hero.jumpHoldTimer = 0;
      hero.wallJumpHoldTimer = 0;
      hero.tongueKind = 'none';
      hero.tongueTimer = 0;
      hero.vx = 0;
      hero.vy = 0;
      return true;
    }

    case 'krunk_electric': {
      if (hero.abilityUsedInAir) return false;
      if (moveDir !== 0) {
        hero.facing = moveDir;
      }
      const upgradedSpeed = isVoltSpeedUpgraded(state);
      const diveVx = hero.facing * (upgradedSpeed ? FORM_PARAMS.VOLT_DIVE_VX_UPGRADED : FORM_PARAMS.VOLT_DIVE_VX);
      const diveVy = upgradedSpeed ? FORM_PARAMS.VOLT_DIVE_VY_UPGRADED : FORM_PARAMS.VOLT_DIVE_VY;

      hero.abilityUsedInAir = true;
      hero.abilityTimer = 0;
      hero.abilityPhase = 0;
      hero.groundDashTimer = 0;
      hero.wallDashTimer = 0;
      hero.jumpHoldTimer = 0;
      hero.wallJumpHoldTimer = 0;
      hero.tongueKind = 'none';
      hero.tongueTimer = 0;
      hero.vx = diveVx;
      hero.vy = diveVy;
      events.push({ type: 'dash', x: cx, y: cy, kind: 'volt' });

      const immediateLock = findVoltConeTarget(state, room, diveVx, diveVy);
      if (immediateLock) {
        enterVoltBlink(state, immediateLock);
      } else {
        hero.action = 'volt_dive';
      }
      return true;
    }

    case 'krunk_shadow': {
      if (hero.abilityUsedInAir) return false;
      // Store directional blink preference (default straight UP (0, +1) per origin teleportUpDistance=2.5!)
      let dirX = input.moveX;
      let dirY = input.moveY;
      const mag = Math.hypot(dirX, dirY);
      if (mag > 0.2) {
        dirX /= mag;
        dirY /= mag;
        if (Math.abs(dirX) > 0.2) {
          hero.facing = dirX > 0 ? 1 : -1;
        }
      } else {
        dirX = 0;
        dirY = 1;
      }

      hero.action = 'shadow_blink';
      hero.abilityTimer = 0;
      hero.abilityPhase = 0; // Phase 0: Vanish (0.08s), Phase 1: Teleport & Show
      hero.abilityUsedInAir = true;
      hero.groundDashTimer = 0;
      hero.wallDashTimer = 0;
      hero.jumpHoldTimer = 0;
      hero.wallJumpHoldTimer = 0;
      hero.tongueKind = 'none';
      hero.tongueTimer = 0;
      hero.voltTargetId = null;
      hero.voltTargetX = dirX;
      hero.voltTargetY = dirY;
      hero.vx = 0;
      hero.vy = 0;
      events.push({ type: 'dash', x: cx, y: cy, kind: 'shadow' });
      return true;
    }
  }
}

/**
 * Updates active form abilities before tile collision movement.
 */
export function updateActiveFormAbility(
  state: SimState,
  input: InputFrame,
  room: RoomDef,
  dt: number,
  events: SimEvent[],
): FormAbilityTickResult {
  const hero = state.hero;
  const cx = hero.x + hero.width * 0.5;
  const cy = hero.y + hero.height * 0.5;
  const moveDir: -1 | 0 | 1 = input.moveX > 0.1 ? 1 : input.moveX < -0.1 ? -1 : 0;

  // DashRoundFire orbiting flame rotation while dashing in fire form
  if (
    hero.form === 'krunk_fire' &&
    getUpgradeLevel(state, 'DashRoundFire') > 0 &&
    (hero.action === 'fire_dash' || hero.action === 'ground_dash' || hero.action === 'wall_dash')
  ) {
    hero.dashRingAngle = (hero.dashRingAngle + SIM_RULES.DASH_ROUND_FIRE_SPEED * dt) % (Math.PI * 2);
  }

  switch (hero.action) {
    case 'fire_dash': {
      hero.abilityTimer += dt;
      hero.vx = hero.facing * FORM_PARAMS.FIRE_DASH_SPEED;
      hero.vy = 0;
      const done =
        hero.abilityTimer >= FORM_PARAMS.FIRE_DASH_MAX_DUR ||
        (hero.abilityTimer >= FORM_PARAMS.FIRE_DASH_MIN_DUR && !input.dashHeld);
      if (done) {
        hero.action = 'fall';
        hero.abilityTimer = 0;
        hero.vx = hero.facing * PHYSICS.MAX_SPEED;
        hero.fireImmunityTimer = Math.max(hero.fireImmunityTimer, SIM_RULES.FIRE_DASH_IMMUNITY_DUR);
      }
      return {
        handledMovement: true,
        allowHorizontalSteer: false,
        gravityScale: 0,
        applyGravity: false,
        completedVoltTargetId: null,
        completedShadowTargetId: null,
        clearedShadowProjectiles: false,
      };
    }

    case 'leaf_glide': {
      // Allow jumping cleanly out of Leaf Glide (e.g. Double Jump / LeafExtraJump)
      if (hero.preJumpTimer > 0 && hero.jumpsRemaining > 0) {
        hero.action = 'fall';
        return {
          handledMovement: false,
          allowHorizontalSteer: true,
          gravityScale: 1,
          applyGravity: true,
          completedVoltTargetId: null,
          completedShadowTargetId: null,
          clearedShadowProjectiles: false,
        };
      }

      if (!input.dashHeld && !input.jumpHeld) {
        hero.action = 'fall';
        return {
          handledMovement: false,
          allowHorizontalSteer: true,
          gravityScale: 1,
          applyGravity: true,
          completedVoltTargetId: null,
          completedShadowTargetId: null,
          clearedShadowProjectiles: false,
        };
      }

      // Full horizontal steering while gliding (exponential Lerp acel=10 / desacel=11)
      const targetMax = PHYSICS.MAX_SPEED * (hero.inQuicksand ? PHYSICS.QUICKSAND_MULT : 1.0);
      const targetVx = moveDir * targetMax;
      const rate = moveDir !== 0 ? PHYSICS.ACCEL : PHYSICS.DECEL;
      hero.vx += (targetVx - hero.vx) * Math.min(1, rate * dt);
      if (moveDir === 0 && Math.abs(hero.vx) < 0.04) {
        hero.vx = 0;
      }
      if (moveDir !== 0) {
        hero.facing = moveDir;
      }

      if (hero.inWindY > 0) {
        // Authentic Leaf updraft wind speed (+5.2 u/s lerped at 5.0 * dt)
        hero.vy += (FORM_PARAMS.LEAF_WIND_VY - hero.vy) * Math.min(1, SIM_RULES.LEAF_WIND_LERP_RATE * dt);
        return {
          handledMovement: true,
          allowHorizontalSteer: false,
          gravityScale: 0,
          applyGravity: false,
          completedVoltTargetId: null,
          completedShadowTargetId: null,
          clearedShadowProjectiles: false,
        };
      }

      const antigravMult = hero.inAntigrav ? SIM_RULES.ANTIGRAV_GRAVITY_SCALE : 1.0;
      if (hero.vy > 0) {
        hero.vy += PHYSICS.G_EFF * FORM_PARAMS.LEAF_GRAVITY_SCALE * antigravMult * dt;
      } else {
        const targetGlideVy = FORM_PARAMS.LEAF_GLIDE_VY * antigravMult;
        hero.vy += (targetGlideVy - hero.vy) * Math.min(1, SIM_RULES.LEAF_GLIDE_LERP_RATE * dt);
        if (hero.vy < targetGlideVy) {
          hero.vy = targetGlideVy;
        }
      }
      return {
        handledMovement: true,
        allowHorizontalSteer: false,
        gravityScale: 0,
        applyGravity: false,
        completedVoltTargetId: null,
        completedShadowTargetId: null,
        clearedShadowProjectiles: false,
      };
    }

    case 'rock_uppercut': {
      hero.abilityTimer += dt;
      if (hero.abilityPhase === 0) {
        // Brief 0.05s hit-anticipation pause before uppercut rise
        hero.vx = 0;
        hero.vy = 0;
        if (hero.abilityTimer >= FORM_PARAMS.ROCK_PAUSE_BEFORE) {
          hero.abilityPhase = 1;
          hero.abilityTimer = 0;
          const baseVy =
            getUpgradeLevel(state, 'RockUppercutPower') > 0
              ? FORM_PARAMS.ROCK_UPPERCUT_VY_UPGRADED
              : FORM_PARAMS.ROCK_UPPERCUT_VY;
          const antigravMult = hero.inAntigrav ? FORM_PARAMS.ROCK_ANTIGRAV_MULT : 1.0;
          hero.vy = baseVy * antigravMult;
          hero.scaleX = 0.78;
          hero.scaleY = 1.32;
          events.push({ type: 'uppercut', x: cx, y: cy });
        }
        return {
          handledMovement: true,
          allowHorizontalSteer: false,
          gravityScale: 0,
          applyGravity: false,
          completedVoltTargetId: null,
          completedShadowTargetId: null,
          clearedShadowProjectiles: false,
        };
      }

      if (hero.abilityPhase === 1) {
        // Rising smash phase (0.175s..0.30s) WITH full horizontal steering!
        const baseVy =
          getUpgradeLevel(state, 'RockUppercutPower') > 0
            ? FORM_PARAMS.ROCK_UPPERCUT_VY_UPGRADED
            : FORM_PARAMS.ROCK_UPPERCUT_VY;
        const antigravMult = hero.inAntigrav ? FORM_PARAMS.ROCK_ANTIGRAV_MULT : 1.0;
        hero.vy = baseVy * antigravMult;

        const targetVx = moveDir * PHYSICS.MAX_SPEED * (hero.inQuicksand ? PHYSICS.QUICKSAND_MULT : 1.0);
        const rate = moveDir !== 0 ? PHYSICS.ACCEL : PHYSICS.DECEL;
        hero.vx += (targetVx - hero.vx) * Math.min(1, rate * dt);
        if (moveDir !== 0) {
          hero.facing = moveDir;
        }

        const endRise =
          hero.abilityTimer >= FORM_PARAMS.ROCK_MAX_DUR ||
          (hero.abilityTimer >= FORM_PARAMS.ROCK_MIN_DUR && !input.dashHeld);
        if (endRise) {
          hero.abilityPhase = 2;
          hero.abilityTimer = 0;
          hero.vy = 0;
        }
        return {
          handledMovement: true,
          allowHorizontalSteer: true,
          gravityScale: 0,
          applyGravity: false,
          completedVoltTargetId: null,
          completedShadowTargetId: null,
          clearedShadowProjectiles: false,
        };
      }

      // Phase 2: 0.075s apex hang before gravity resumes
      hero.vx = 0;
      hero.vy = 0;
      if (hero.abilityTimer >= FORM_PARAMS.ROCK_PAUSE_AFTER) {
        hero.action = 'fall';
        hero.abilityPhase = 0;
        hero.abilityTimer = 0;
      }
      return {
        handledMovement: true,
        allowHorizontalSteer: false,
        gravityScale: 0,
        applyGravity: false,
        completedVoltTargetId: null,
        completedShadowTargetId: null,
        clearedShadowProjectiles: false,
      };
    }

    case 'volt_dive': {
      hero.abilityTimer += dt;
      // Upgrade 9 (VoltRange) allows flipping dive direction mid-dive!
      if (getUpgradeLevel(state, 'VoltRange') > 0 && moveDir !== 0 && moveDir !== hero.facing) {
        hero.facing = moveDir;
      }
      const upgradedSpeed = isVoltSpeedUpgraded(state);
      const diveVx = hero.facing * (upgradedSpeed ? FORM_PARAMS.VOLT_DIVE_VX_UPGRADED : FORM_PARAMS.VOLT_DIVE_VX);
      const diveVy = upgradedSpeed ? FORM_PARAMS.VOLT_DIVE_VY_UPGRADED : FORM_PARAMS.VOLT_DIVE_VY;
      hero.vx = diveVx;
      hero.vy = diveVy;

      const target = findVoltConeTarget(state, room, diveVx, diveVy);
      if (target) {
        enterVoltBlink(state, target);
      } else if (hero.abilityTimer >= SIM_RULES.VOLT_DIVE_MAX_DUR) {
        hero.action = 'fall';
        hero.abilityTimer = 0;
      }
      return {
        handledMovement: true,
        allowHorizontalSteer: false,
        gravityScale: 0,
        applyGravity: false,
        completedVoltTargetId: null,
        completedShadowTargetId: null,
        clearedShadowProjectiles: false,
      };
    }

    case 'volt_blink': {
      hero.abilityTimer += dt;
      // Track moving enemy/boss target position if still alive
      if (hero.voltTargetId) {
        for (let i = 0; i < state.enemies.length; i++) {
          const e = state.enemies[i];
          if (e.id === hero.voltTargetId && e.alive) {
            hero.voltTargetX = e.x + e.width * 0.5;
            hero.voltTargetY = e.y + e.height * 0.5;
            break;
          }
        }
        if (state.boss && !state.boss.defeated && state.boss.id === hero.voltTargetId) {
          hero.voltTargetX = state.boss.x + state.boss.width * 0.5;
          hero.voltTargetY = state.boss.y + state.boss.height * 0.5;
        }
      }

      const dx = hero.voltTargetX - cx;
      const dy = hero.voltTargetY - cy;
      const dist = Math.hypot(dx, dy);
      const speed = isVoltSpeedUpgraded(state)
        ? FORM_PARAMS.VOLT_BLINK_SPEED_UPGRADED
        : FORM_PARAMS.VOLT_BLINK_SPEED;

      if (dist <= Math.max(0.45, speed * dt * 0.9) || hero.abilityTimer >= 0.35) {
        const targetId = hero.voltTargetId;
        // Exit sling at 15.0 u/s + reset midair jumps & ability
        let sx = input.moveX;
        let sy = input.moveY;
        const mag = Math.hypot(sx, sy);
        if (mag > 0.2) {
          sx /= mag;
          sy /= mag;
        } else {
          sx = hero.facing * 0.45;
          sy = 0.893;
        }
        hero.vx = sx * FORM_PARAMS.VOLT_EXIT_SLING;
        hero.vy = sy * FORM_PARAMS.VOLT_EXIT_SLING;
        hero.jumpsRemaining = hero.maxAirJumps;
        hero.abilityUsedInAir = false;
        if (getUpgradeLevel(state, 'VoltShield') > 0) {
          hero.invulnTimer = Math.max(hero.invulnTimer, FORM_PARAMS.VOLT_SHIELD_DUR);
        }
        hero.voltTargetId = null;
        hero.action = 'flip';
        hero.abilityTimer = 0;
        return {
          handledMovement: true,
          allowHorizontalSteer: false,
          gravityScale: 0,
          applyGravity: false,
          completedVoltTargetId: targetId,
          completedShadowTargetId: null,
          clearedShadowProjectiles: false,
        };
      }

      hero.vx = (dx / dist) * speed;
      hero.vy = (dy / dist) * speed;
      return {
        handledMovement: true,
        allowHorizontalSteer: false,
        gravityScale: 0,
        applyGravity: false,
        completedVoltTargetId: null,
        completedShadowTargetId: null,
        clearedShadowProjectiles: false,
      };
    }

    case 'shadow_blink': {
      hero.abilityTimer += dt;
      if (hero.abilityPhase === 0) {
        // Vanish anticipation (0.08s, invulnerable)
        hero.vx = 0;
        hero.vy = 0;
        if (hero.abilityTimer >= SIM_RULES.SHADOW_VANISH_DUR) {
          hero.abilityPhase = 1;
          hero.abilityTimer = 0;

          const target = findShadowTarget(state);
          if (target) {
            // Linecast-clamped instant teleport directly onto enemy/boss + clear nearby projectiles!
            const dest = linecastSafeTeleport(
              state,
              room,
              target.x - hero.width * 0.5,
              target.y - hero.height * 0.5,
            );
            hero.x = dest.x;
            hero.y = dest.y;
            hero.prevX = dest.x;
            hero.prevY = dest.y;
            hero.jumpsRemaining = hero.maxAirJumps;
            hero.abilityUsedInAir = false;
            hero.vy = PHYSICS.ENEMY_JUMP_FORCE;
            hero.vx = hero.facing * 2.5;
            hero.action = 'flip';
            hero.abilityPhase = 0;
            hero.abilityTimer = 0;
            hero.scaleX = 0.78;
            hero.scaleY = 1.28;

            // Clear nearby enemy projectiles with shadow field
            const fx = dest.x + hero.width * 0.5;
            const fy = dest.y + hero.height * 0.5;
            const r2 = SIM_RULES.SHADOW_FIELD_RADIUS * SIM_RULES.SHADOW_FIELD_RADIUS;
            state.projectiles = state.projectiles.filter((p) => {
              if (p.fromHero) return true;
              const pdx = p.x - fx;
              const pdy = p.y - fy;
              return pdx * pdx + pdy * pdy > r2;
            });

            return {
              handledMovement: true,
              allowHorizontalSteer: false,
              gravityScale: 0,
              applyGravity: false,
              completedVoltTargetId: null,
              completedShadowTargetId: target.id,
              clearedShadowProjectiles: true,
            };
          }

          // No enemy target -> directional/upward ceiling-clamped 2.5u blink!
          const dirX = hero.voltTargetX;
          const dirY = hero.voltTargetY;
          const dest = linecastSafeTeleport(
            state,
            room,
            hero.x + dirX * SIM_RULES.SHADOW_TELEPORT_UP_DIST,
            hero.y + dirY * SIM_RULES.SHADOW_TELEPORT_UP_DIST,
          );
          hero.x = dest.x;
          hero.y = dest.y;
          hero.prevX = dest.x;
          hero.prevY = dest.y;
          hero.vx = dirX * PHYSICS.MAX_SPEED * 0.65;
          hero.vy = Math.max(0, dirY * 3.5);
          hero.scaleX = 0.8;
          hero.scaleY = 1.24;
        }
        return {
          handledMovement: true,
          allowHorizontalSteer: false,
          gravityScale: 0,
          applyGravity: false,
          completedVoltTargetId: null,
          completedShadowTargetId: null,
          clearedShadowProjectiles: false,
        };
      }

      // Phase 1: Show phase (brief invuln hang, jump/stomp cancellable)
      if (hero.preJumpTimer > 0 && hero.jumpsRemaining > 0) {
        hero.action = 'fall';
        hero.abilityPhase = 0;
        hero.abilityTimer = 0;
        return {
          handledMovement: false,
          allowHorizontalSteer: true,
          gravityScale: 1,
          applyGravity: true,
          completedVoltTargetId: null,
          completedShadowTargetId: null,
          clearedShadowProjectiles: false,
        };
      }
      if (hero.abilityTimer >= SIM_RULES.SHADOW_SHOW_DUR) {
        hero.action = 'fall';
        hero.abilityPhase = 0;
        hero.abilityTimer = 0;
      }
      return {
        handledMovement: true,
        allowHorizontalSteer: true,
        gravityScale: 0,
        applyGravity: false,
        completedVoltTargetId: null,
        completedShadowTargetId: null,
        clearedShadowProjectiles: false,
      };
    }

    default:
      return {
        handledMovement: false,
        allowHorizontalSteer: true,
        gravityScale: 1,
        applyGravity: true,
        completedVoltTargetId: null,
        completedShadowTargetId: null,
        clearedShadowProjectiles: false,
      };
  }
}

/**
 * Spawns twin ground-hugging fire waves for Fire Form Upgrade 5 (StompFlame).
 */
export function spawnFireStompWaves(state: SimState): void {
  const hero = state.hero;
  const cx = hero.x + hero.width * 0.5;
  const y = hero.y + 0.3;
  const dirs: readonly (-1 | 1)[] = [-1, 1];
  for (let i = 0; i < dirs.length; i++) {
    const dir = dirs[i];
    state.projectiles.push({
      id: state.nextProjectileId++,
      fromHero: true,
      kind: 'fire_wave',
      x: cx + dir * 0.45,
      y,
      prevX: cx + dir * 0.45,
      prevY: y,
      vx: dir * SIM_RULES.FIRE_WAVE_SPEED,
      vy: 0,
      radius: SIM_RULES.FIRE_WAVE_RADIUS,
      ttl: SIM_RULES.FIRE_WAVE_TTL,
      homing: false,
    });
  }
}

export function spawnShadowShockwaves(state: SimState): void {
  const hero = state.hero;
  const cx = hero.x + hero.width * 0.5;
  const y = hero.y + 0.3;
  const dirs: readonly (-1 | 1)[] = [-1, 1];
  for (let i = 0; i < dirs.length; i++) {
    const dir = dirs[i];
    state.projectiles.push({
      id: state.nextProjectileId++,
      fromHero: true,
      kind: 'shockwave',
      x: cx + dir * 0.4,
      y,
      prevX: cx + dir * 0.4,
      prevY: y,
      vx: dir * SIM_RULES.SHADOW_SHOCKWAVE_SPEED,
      vy: 0,
      radius: 0.4,
      ttl: SIM_RULES.SHADOW_SHOCKWAVE_TTL,
      homing: false,
    });
  }
}
