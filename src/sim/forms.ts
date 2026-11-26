import type {
  HeroFormId,
  InputFrame,
  RoomDef,
  SimEvent,
  SimState,
} from '../contracts/index';
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

export interface FormAbilityTickResult {
  handledMovement: boolean;
  gravityScale: number;
  applyGravity: boolean;
  completedVoltTargetId: string | null;
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
  hero.form = newForm;
  hero.maxAirJumps = computeMaxAirJumps(state, newForm);
  if (hero.jumpsRemaining > hero.maxAirJumps) {
    hero.jumpsRemaining = hero.maxAirJumps;
  }

  // Cancel form-specific air actions cleanly if switching mid-ability
  if (
    hero.action === 'fire_dash' ||
    hero.action === 'leaf_glide' ||
    hero.action === 'rock_uppercut' ||
    hero.action === 'volt_dive' ||
    hero.action === 'volt_blink' ||
    hero.action === 'shadow_blink'
  ) {
    hero.action = hero.grounded ? 'idle' : 'fall';
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

  const cosCone = Math.cos((FORM_PARAMS.VOLT_CONE_DEG * Math.PI) / 180);
  const rangeBonus = getUpgradeLevel(state, 'VoltRange') > 0 ? FORM_PARAMS.VOLT_RANGE_BONUS : 0;
  const nodeRange = FORM_PARAMS.VOLT_NODE_RANGE + rangeBonus;
  const enemyRange = FORM_PARAMS.VOLT_ENEMY_RANGE + rangeBonus;

  let best: VoltLockTarget | null = null;
  let bestDistSq = Infinity;

  // 1. Volt nodes
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
    if (dot >= cosCone && distSq < bestDistSq) {
      bestDistSq = distSq;
      best = { id: prop.id, x: tx, y: ty, kind: 'node' };
    }
  }

  // 2. Alive enemies
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
    if (dot >= cosCone && distSq < bestDistSq) {
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
      if (dot >= cosCone && distSq < bestDistSq) {
        best = { id: boss.id, x: tx, y: ty, kind: 'boss' };
      }
    }
  }

  return best;
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
  const speed =
    getUpgradeLevel(state, 'VoltRange') > 0
      ? FORM_PARAMS.VOLT_BLINK_SPEED_UPGRADED
      : FORM_PARAMS.VOLT_BLINK_SPEED;
  hero.vx = (dx / dist) * speed;
  hero.vy = (dy / dist) * speed;
}

/**
 * Attempts to start a midair form ability when Dash is pressed in the air.
 * Returns true if a form ability was initiated.
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

  switch (hero.form) {
    case 'krunk_basic':
      return false;

    case 'krunk_fire': {
      if (hero.abilityUsedInAir) return false;
      if (Math.abs(input.moveX) > 0.2) {
        hero.facing = input.moveX > 0 ? 1 : -1;
      }
      hero.action = 'fire_dash';
      hero.abilityTimer = 0;
      hero.abilityPhase = 0;
      hero.abilityUsedInAir = true;
      hero.vx = hero.facing * FORM_PARAMS.FIRE_DASH_SPEED;
      hero.vy = 0;
      hero.scaleX = 1.3;
      hero.scaleY = 0.78;
      events.push({ type: 'dash', x: cx, y: cy, kind: 'fire' });
      return true;
    }

    case 'krunk_leaf': {
      if (getUpgradeLevel(state, 'LeafExtraJump') > 0 && !hero.abilityUsedInAir) {
        hero.abilityUsedInAir = true;
        hero.vy = FORM_PARAMS.LEAF_EXTRA_JUMP_VY;
        events.push({ type: 'jump', x: cx, y: hero.y, air: true, form: 'krunk_leaf' });
      }
      hero.action = 'leaf_glide';
      hero.abilityTimer = 0;
      return true;
    }

    case 'krunk_rock': {
      if (hero.abilityUsedInAir) return false;
      hero.action = 'rock_uppercut';
      hero.abilityTimer = 0;
      hero.abilityPhase = 0; // Pause before rise
      hero.abilityUsedInAir = true;
      hero.vx = 0;
      hero.vy = 0;
      return true;
    }

    case 'krunk_electric': {
      if (hero.abilityUsedInAir) return false;
      if (Math.abs(input.moveX) > 0.2) {
        hero.facing = input.moveX > 0 ? 1 : -1;
      }
      const upgraded = getUpgradeLevel(state, 'VoltRange') > 0;
      const diveVx = hero.facing * (upgraded ? FORM_PARAMS.VOLT_DIVE_VX_UPGRADED : FORM_PARAMS.VOLT_DIVE_VX);
      const diveVy = upgraded ? FORM_PARAMS.VOLT_DIVE_VY_UPGRADED : FORM_PARAMS.VOLT_DIVE_VY;

      hero.abilityUsedInAir = true;
      hero.abilityTimer = 0;
      hero.abilityPhase = 0;
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
        dirX = hero.facing;
        dirY = 0;
      }
      hero.action = 'shadow_blink';
      hero.abilityTimer = 0;
      hero.abilityPhase = 0;
      hero.abilityUsedInAir = true;
      hero.vx = dirX * FORM_PARAMS.SHADOW_BLINK_SPEED;
      hero.vy = dirY * FORM_PARAMS.SHADOW_BLINK_SPEED;
      events.push({ type: 'dash', x: cx, y: cy, kind: 'shadow' });
      return true;
    }
  }
}

/**
 * Updates active form abilities before collision movement.
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
      }
      return { handledMovement: true, gravityScale: 0, applyGravity: false, completedVoltTargetId: null };
    }

    case 'leaf_glide': {
      if (!input.dashHeld && !input.jumpHeld) {
        hero.action = 'fall';
        return { handledMovement: false, gravityScale: 1, applyGravity: true, completedVoltTargetId: null };
      }

      // Horizontal steering while gliding
      const targetMax = PHYSICS.MAX_SPEED * (hero.inQuicksand ? PHYSICS.QUICKSAND_MULT : 1.0);
      const targetVx = Math.abs(input.moveX) > 0.05 ? Math.sign(input.moveX) * Math.min(1, Math.abs(input.moveX)) * targetMax : 0;
      const rate = targetVx !== 0 ? PHYSICS.ACCEL : PHYSICS.DECEL;
      hero.vx += (targetVx - hero.vx) * Math.min(1, rate * dt);
      if (targetVx !== 0) {
        hero.facing = targetVx > 0 ? 1 : -1;
      }

      if (hero.inWindY > 0) {
        hero.vy += (FORM_PARAMS.LEAF_WIND_VY - hero.vy) * Math.min(1, 10.0 * dt);
        return { handledMovement: true, gravityScale: 0, applyGravity: false, completedVoltTargetId: null };
      }

      const antigravMult = hero.inAntigrav ? SIM_RULES.ANTIGRAV_GRAVITY_SCALE : 1.0;
      hero.vy += PHYSICS.G_EFF * FORM_PARAMS.LEAF_GRAVITY_SCALE * antigravMult * dt;
      if (hero.vy < FORM_PARAMS.LEAF_GLIDE_VY) {
        hero.vy = FORM_PARAMS.LEAF_GLIDE_VY;
      }
      return { handledMovement: true, gravityScale: 0, applyGravity: false, completedVoltTargetId: null };
    }

    case 'rock_uppercut': {
      hero.abilityTimer += dt;
      if (hero.abilityPhase === 0) {
        // Brief pause before uppercut rise (0.05s)
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
      } else if (hero.abilityPhase === 1) {
        // Rising smash phase (min 0.175s, max 0.30s)
        const baseVy =
          getUpgradeLevel(state, 'RockUppercutPower') > 0
            ? FORM_PARAMS.ROCK_UPPERCUT_VY_UPGRADED
            : FORM_PARAMS.ROCK_UPPERCUT_VY;
        const antigravMult = hero.inAntigrav ? FORM_PARAMS.ROCK_ANTIGRAV_MULT : 1.0;
        hero.vy = baseVy * antigravMult;
        hero.vx *= 0.85;
        const endRise =
          hero.abilityTimer >= FORM_PARAMS.ROCK_MAX_DUR ||
          (hero.abilityTimer >= FORM_PARAMS.ROCK_MIN_DUR && !input.dashHeld);
        if (endRise) {
          hero.abilityPhase = 2;
          hero.abilityTimer = 0;
          hero.vy = 0;
        }
      } else {
        // Pause after rise (0.075s)
        hero.vx = 0;
        hero.vy = 0;
        if (hero.abilityTimer >= FORM_PARAMS.ROCK_PAUSE_AFTER) {
          hero.action = 'fall';
          hero.abilityPhase = 0;
          hero.abilityTimer = 0;
        }
      }
      return { handledMovement: true, gravityScale: 0, applyGravity: false, completedVoltTargetId: null };
    }

    case 'volt_dive': {
      hero.abilityTimer += dt;
      const upgraded = getUpgradeLevel(state, 'VoltRange') > 0;
      const diveVx = hero.facing * (upgraded ? FORM_PARAMS.VOLT_DIVE_VX_UPGRADED : FORM_PARAMS.VOLT_DIVE_VX);
      const diveVy = upgraded ? FORM_PARAMS.VOLT_DIVE_VY_UPGRADED : FORM_PARAMS.VOLT_DIVE_VY;
      hero.vx = diveVx;
      hero.vy = diveVy;

      const target = findVoltConeTarget(state, room, diveVx, diveVy);
      if (target) {
        enterVoltBlink(state, target);
      } else if (hero.abilityTimer >= SIM_RULES.VOLT_DIVE_MAX_DUR) {
        hero.action = 'fall';
        hero.abilityTimer = 0;
      }
      return { handledMovement: true, gravityScale: 0, applyGravity: false, completedVoltTargetId: null };
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
      const speed =
        getUpgradeLevel(state, 'VoltRange') > 0
          ? FORM_PARAMS.VOLT_BLINK_SPEED_UPGRADED
          : FORM_PARAMS.VOLT_BLINK_SPEED;

      if (dist <= Math.max(0.45, speed * dt * 0.9) || hero.abilityTimer >= 0.35) {
        const targetId = hero.voltTargetId;
        // Exit sling at 15.0 u/s + reset midair
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
        hero.action = 'jump';
        hero.abilityTimer = 0;
        return {
          handledMovement: true,
          gravityScale: 0,
          applyGravity: false,
          completedVoltTargetId: targetId,
        };
      }

      hero.vx = (dx / dist) * speed;
      hero.vy = (dy / dist) * speed;
      return { handledMovement: true, gravityScale: 0, applyGravity: false, completedVoltTargetId: null };
    }

    case 'shadow_blink': {
      hero.abilityTimer += dt;
      if (hero.abilityTimer >= FORM_PARAMS.SHADOW_BLINK_DUR) {
        hero.action = 'fall';
        hero.abilityTimer = 0;
        hero.vx *= 0.35;
        hero.vy *= 0.35;
      }
      return { handledMovement: true, gravityScale: 0, applyGravity: false, completedVoltTargetId: null };
    }

    default:
      return { handledMovement: false, gravityScale: 1, applyGravity: true, completedVoltTargetId: null };
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
