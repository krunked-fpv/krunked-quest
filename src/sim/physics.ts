import type {
  InputFrame,
  RoomDef,
  SimEvent,
  SimState,
} from '../contracts/index';
import {
  breakTilesInRadius,
  carryHeroOnMovingPlatforms,
  detectAdjacentWall,
  moveHeroWithCollision,
  type BlastCircle,
} from './collision';
import { breakCombo } from './combo';
import {
  PHYSICS,
  SIM_RULES,
  getUpgradeLevel,
  getWallSlideSpeed,
  hasRelic,
} from './constants';
import {
  handleFormSwitchInput,
  spawnShadowShockwaves,
  tryStartAirFormAbility,
  updateActiveFormAbility,
} from './forms';
import { nextFloat } from './prng';

export interface HeroStepOutput {
  explosions: BlastCircle[];
  completedVoltTargetId: string | null;
  stompFlameTriggered: boolean;
  evilRingTriggered: boolean;
}

export function computeEnemyBounceVy(state: SimState, isStomp: boolean): number {
  let vy = PHYSICS.ENEMY_JUMP_FORCE * (isStomp ? PHYSICS.STOMP_BOUNCE_MULT : 1.0);
  if (hasRelic(state, 'magic_feather')) {
    vy *= PHYSICS.MAGIC_FEATHER_MULT;
  }
  if (state.hero.inAntigrav) {
    vy *= PHYSICS.ANTIGRAV_BOUNCE_MULT;
  }
  return vy;
}

export function isHeroInvulnerable(
  state: SimState,
  hazardKind?: 'spike' | 'acid' | 'lava' | 'enemy' | 'projectile',
): boolean {
  const hero = state.hero;
  if (hero.invulnTimer > 0 || hero.magicShieldTimer > 0) return true;
  if (hero.action === 'volt_blink' || hero.action === 'shadow_blink') return true;
  if (
    hero.form === 'krunk_fire' &&
    getUpgradeLevel(state, 'DashFlame') > 0 &&
    (hero.action === 'fire_dash' || hero.action === 'ground_dash' || hero.action === 'wall_dash')
  ) {
    return true;
  }
  if (
    hero.form === 'krunk_rock' &&
    hero.action === 'rock_uppercut' &&
    getUpgradeLevel(state, 'RockUppercutInvuln') > 0
  ) {
    return true;
  }
  if (hazardKind === 'spike' && hero.action === 'air_stomp' && hasRelic(state, 'turtle_shell')) {
    return true;
  }
  return false;
}

export function damageHero(
  state: SimState,
  amount: number,
  sourceX: number,
  events: SimEvent[],
  hazardKind: 'spike' | 'acid' | 'lava' | 'enemy' | 'projectile' = 'enemy',
): { tookDamage: boolean; evilRingTriggered: boolean } {
  const hero = state.hero;
  if (hero.action === 'dead' || amount <= 0) {
    return { tookDamage: false, evilRingTriggered: false };
  }
  if (isHeroInvulnerable(state, hazardKind)) {
    return { tookDamage: false, evilRingTriggered: false };
  }

  const cx = hero.x + hero.width * 0.5;
  const cy = hero.y + hero.height * 0.5;
  const invulnBase =
    PHYSICS.INVULN_TIME *
    (getUpgradeLevel(state, 'IronSkin') > 0 ? PHYSICS.IRON_SKIN_INVULN_MULT : 1.0) *
    (hasRelic(state, 'turtle_shell') ? 1.25 : 1.0);

  // 1. Bandit Shorts 35% dodge
  if (hasRelic(state, 'bandit_shorts') && nextFloat(state) < SIM_RULES.BANDIT_SHORTS_DODGE_CHANCE) {
    hero.invulnTimer = 0.6;
    events.push({ type: 'hero_hurt', x: cx, y: cy, hp: hero.hp, shieldBlocked: true });
    return { tookDamage: false, evilRingTriggered: false };
  }

  // 2. Providential Shield blocks first hit in each room
  if (hasRelic(state, 'providential_shield') && !hero.platinumShieldUsed) {
    hero.platinumShieldUsed = true;
    hero.invulnTimer = invulnBase;
    events.push({ type: 'hero_hurt', x: cx, y: cy, hp: hero.hp, shieldBlocked: true });
    return { tookDamage: false, evilRingTriggered: false };
  }

  // 3. RockShield absorbs 1 hit
  if (hero.rockShieldActive) {
    hero.rockShieldActive = false;
    hero.invulnTimer = invulnBase;
    events.push({ type: 'hero_hurt', x: cx, y: cy, hp: hero.hp, shieldBlocked: true });
    return { tookDamage: false, evilRingTriggered: false };
  }

  // Apply HP damage
  hero.hp = Math.max(0, hero.hp - amount);
  hero.invulnTimer = invulnBase;
  hero.hitFlashTimer = 0.25;
  hero.jumpHoldTimer = 0;
  hero.wallJumpHoldTimer = 0;
  hero.groundDashTimer = 0;
  hero.wallDashTimer = 0;
  hero.stompDelayTimer = 0;

  // Magic Shield relic activates 3.0s post-hit barrier
  if (hasRelic(state, 'magic_shield')) {
    hero.magicShieldTimer = SIM_RULES.MAGIC_SHIELD_DUR;
  }

  // Evil Ring emits damage shockwave
  let evilRingTriggered = false;
  if (hasRelic(state, 'evil_ring')) {
    evilRingTriggered = true;
    spawnShadowShockwaves(state);
  }

  // Recoil (+-5.0, 5.0) for 0.30s — negated by IronSkin
  if (getUpgradeLevel(state, 'IronSkin') === 0) {
    const dir = cx >= sourceX ? 1 : -1;
    const turtleScale = hasRelic(state, 'turtle_shell') ? 0.5 : 1.0;
    hero.vx = dir * PHYSICS.RECOIL_X * turtleScale;
    hero.vy = PHYSICS.RECOIL_Y * (hazardKind === 'acid' || hazardKind === 'lava' ? 1.4 : turtleScale);
    hero.recoilTimer = PHYSICS.RECOIL_TIME;
    hero.action = 'hurt';
    hero.grounded = false;
  } else if (hazardKind === 'acid' || hazardKind === 'lava') {
    hero.vy = Math.max(hero.vy, 7.0);
  }

  breakCombo(state);

  state.camera.shakeTimer = Math.max(state.camera.shakeTimer, 0.22);
  state.camera.shakeIntensity = Math.max(state.camera.shakeIntensity, 0.24);
  events.push({ type: 'hero_hurt', x: cx, y: cy, hp: hero.hp, shieldBlocked: false });

  // Death & Rebirth Amulet check
  if (hero.hp <= 0) {
    if (hasRelic(state, 'rebirth_amulet') && !hero.rebirthUsed) {
      hero.rebirthUsed = true;
      hero.hp = Math.max(1, Math.ceil(hero.maxHp * 0.5));
      hero.invulnTimer = 2.5;
      hero.recoilTimer = 0;
      hero.action = 'jump';
      hero.vy = 10.0;
      events.push({ type: 'heal', x: cx, y: cy, hp: hero.hp });
      return { tookDamage: true, evilRingTriggered };
    }

    hero.action = 'dead';
    hero.vx = 0;
    hero.vy = 0;
    if (!hasRelic(state, 'magic_coin')) {
      const loss = Math.floor(state.progress.crystals * PHYSICS.CRYSTAL_LOSS_DEATH_PCT);
      state.progress.crystals = Math.max(0, state.progress.crystals - loss);
    }
    state.gameOverTriggered = true;
    events.push({ type: 'hero_dead', x: cx, y: cy });
  }

  return { tookDamage: true, evilRingTriggered };
}

function startAirStompImmediate(state: SimState, events: SimEvent[]): void {
  const hero = state.hero;
  hero.action = 'air_stomp';
  hero.stompDelayTimer = 0;
  hero.jumpHoldTimer = 0;
  hero.wallJumpHoldTimer = 0;
  hero.groundDashTimer = 0;
  hero.wallDashTimer = 0;
  hero.onWall = 0;
  hero.vx *= 0.25;
  hero.vy = -PHYSICS.MAX_FALL_SPEED;
  hero.scaleX = 0.72;
  hero.scaleY = 1.35;
  events.push({ type: 'stomp_start', x: hero.x + hero.width * 0.5, y: hero.y + hero.height * 0.5 });
}

export function stepHeroPhysics(
  state: SimState,
  input: InputFrame,
  room: RoomDef,
  dt: number,
  events: SimEvent[],
): HeroStepOutput {
  const hero = state.hero;
  const output: HeroStepOutput = {
    explosions: [],
    completedVoltTargetId: null,
    stompFlameTriggered: false,
    evilRingTriggered: false,
  };

  // 1. Carry hero with any moving platform before movement
  carryHeroOnMovingPlatforms(state, room);

  // 2. Form switching
  handleFormSwitchInput(state, input, events);

  // 3. Decrement timers
  hero.animTimer += dt;
  hero.scaleX += (1 - hero.scaleX) * Math.min(1, 14 * dt);
  hero.scaleY += (1 - hero.scaleY) * Math.min(1, 14 * dt);
  if (hero.hitFlashTimer > 0) hero.hitFlashTimer = Math.max(0, hero.hitFlashTimer - dt);
  if (hero.invulnTimer > 0) hero.invulnTimer = Math.max(0, hero.invulnTimer - dt);
  if (hero.magicShieldTimer > 0) hero.magicShieldTimer = Math.max(0, hero.magicShieldTimer - dt);
  if (hero.lastEnemyHitTimer > 0) hero.lastEnemyHitTimer = Math.max(0, hero.lastEnemyHitTimer - dt);
  if (hero.wallJumpTimer > 0) hero.wallJumpTimer = Math.max(0, hero.wallJumpTimer - dt);
  if (hero.wallStickLockTimer > 0) hero.wallStickLockTimer = Math.max(0, hero.wallStickLockTimer - dt);
  if (hero.wallRestickTimer > 0) hero.wallRestickTimer = Math.max(0, hero.wallRestickTimer - dt);
  if (hero.recoilTimer > 0) {
    hero.recoilTimer = Math.max(0, hero.recoilTimer - dt);
    if (hero.recoilTimer === 0 && hero.action === 'hurt') {
      hero.action = hero.grounded ? 'idle' : 'fall';
    }
  }

  // Input buffers: coyote, pre-jump, pre-dash
  if (hero.grounded) {
    hero.coyoteTimer = PHYSICS.COYOTE_TIME;
    hero.jumpsRemaining = hero.maxAirJumps;
    hero.abilityUsedInAir = false;
  } else if (hero.coyoteTimer > 0) {
    hero.coyoteTimer = Math.max(0, hero.coyoteTimer - dt);
  }

  if (input.jumpPressed) {
    hero.preJumpTimer = PHYSICS.PRE_JUMP;
  } else if (hero.preJumpTimer > 0) {
    hero.preJumpTimer = Math.max(0, hero.preJumpTimer - dt);
  }

  if (input.dashPressed) {
    hero.preDashTimer = PHYSICS.PRE_DASH;
  } else if (hero.preDashTimer > 0) {
    hero.preDashTimer = Math.max(0, hero.preDashTimer - dt);
  }

  let applyGravity = true;
  let gravityScale = hero.inAntigrav ? SIM_RULES.ANTIGRAV_GRAVITY_SCALE : 1.0;
  let skipGravityThisTick = false;

  // 4. Update active form ability if any
  const abilityTick = updateActiveFormAbility(state, input, room, dt, events);
  if (abilityTick.completedVoltTargetId) {
    output.completedVoltTargetId = abilityTick.completedVoltTargetId;
  }

  const inLockedAbility = abilityTick.handledMovement;
  if (inLockedAbility) {
    applyGravity = abilityTick.applyGravity;
    gravityScale *= abilityTick.gravityScale;
  }

  // Detect adjacent walls early so leaving a wall doesn't drop a same-tick Air Stomp
  const adjacentWall = detectAdjacentWall(state, room, input.moveX || hero.facing);
  if (hero.action === 'wall_slide' && (adjacentWall !== hero.onWall || hero.grounded)) {
    hero.onWall = 0;
    hero.action = hero.grounded ? 'idle' : 'fall';
  }

  // Allow Air Stomp cancel out of Leaf Glide or normal air states
  if (
    !hero.grounded &&
    hero.recoilTimer <= 0 &&
    hero.action !== 'air_stomp' &&
    hero.action !== 'wall_slide' &&
    hero.action !== 'vine_slide' &&
    hero.action !== 'volt_blink' &&
    hero.action !== 'shadow_blink' &&
    (input.stompPressed || (input.dashPressed && input.moveY < -0.5))
  ) {
    startAirStompImmediate(state, events);
    hero.preDashTimer = 0;
    skipGravityThisTick = true;
  }

  // 5. Pending stomp delay countdown (0.25s brief hover before snapping vy = -18.0)
  if (hero.stompDelayTimer > 0 && hero.action !== 'air_stomp') {
    hero.stompDelayTimer = Math.max(0, hero.stompDelayTimer - dt);
    hero.vx *= 0.85;
    hero.vy = 0;
    applyGravity = false;
    if (hero.stompDelayTimer === 0) {
      startAirStompImmediate(state, events);
      skipGravityThisTick = true;
    }
  } else if (!inLockedAbility && hero.recoilTimer <= 0) {
    // 6. Standard movement, wall slide, vine slide, jumping, dashing, stomping

    // Slippery Vine attachment
    if (
      hero.onVine &&
      !hero.grounded &&
      hero.action !== 'air_stomp' &&
      hero.action !== 'vine_slide' &&
      hero.wallRestickTimer <= 0 &&
      hero.vy <= PHYSICS.VEL_Y_WALL_JUMP
    ) {
      hero.action = 'vine_slide';
      hero.onWall = 0;
      hero.jumpsRemaining = hero.maxAirJumps;
      hero.abilityUsedInAir = false;
      hero.vy = Math.min(hero.vy, -PHYSICS.VINE_SLIDE_MIN);
    }

    // Wall slide attachment
    if (
      hero.action !== 'vine_slide' &&
      hero.action !== 'air_stomp' &&
      !hero.grounded &&
      hero.wallRestickTimer <= 0 &&
      adjacentWall !== 0 &&
      hero.vy <= PHYSICS.VEL_Y_WALL_JUMP &&
      hero.action !== 'wall_slide'
    ) {
      hero.action = 'wall_slide';
      hero.onWall = adjacentWall;
      hero.wallStickLockTimer = PHYSICS.WALL_STICK_LOCK;
      hero.wallReleaseTimer = 0;
      hero.jumpsRemaining = hero.maxAirJumps;
      hero.abilityUsedInAir = false;
      hero.groundDashTimer = 0;
      hero.wallDashTimer = 0;
    }

    // ---- Vine Slide State ----
    if (hero.action === 'vine_slide') {
      if (!hero.onVine || hero.grounded) {
        hero.action = hero.grounded ? 'idle' : 'fall';
      } else {
        // Slide smoothly 3.0 -> 10.0 u/s downward
        hero.vx *= 0.5;
        hero.vy = Math.min(hero.vy, -PHYSICS.VINE_SLIDE_MIN);
        hero.vy = Math.max(-PHYSICS.VINE_SLIDE_MAX, hero.vy - 14.0 * dt);
        applyGravity = false;

        if (hero.preJumpTimer > 0) {
          const jumpDir: -1 | 1 =
            Math.abs(input.moveX) > 0.2 ? (input.moveX > 0 ? 1 : -1) : hero.facing;
          hero.facing = jumpDir;
          hero.vx = jumpDir * PHYSICS.VINE_JUMP_IMPULSE_X;
          hero.vy = PHYSICS.DOUBLE_JUMP_FORCE;
          hero.preJumpTimer = 0;
          hero.wallRestickTimer = PHYSICS.WALL_RESTICK_COOLDOWN;
          hero.action = 'jump';
          skipGravityThisTick = true;
          events.push({ type: 'jump', x: hero.x + hero.width * 0.5, y: hero.y, air: true, form: hero.form });
        }
      }
    }
    // ---- Wall Slide State ----
    else if (hero.action === 'wall_slide') {
      if (adjacentWall !== hero.onWall || hero.grounded) {
        hero.onWall = 0;
        hero.action = hero.grounded ? 'idle' : 'fall';
      } else {
        const slideCap = getWallSlideSpeed(hero.form);
        hero.vx = 0;
        if (hero.vy < slideCap) {
          hero.vy = slideCap;
        }

        // Release buffer when pressing away from wall
        if (input.moveX * hero.onWall < -0.2) {
          if (hero.wallStickLockTimer <= 0) {
            hero.wallReleaseTimer += dt;
            if (hero.wallReleaseTimer >= PHYSICS.WALL_RELEASE_BUFFER) {
              hero.onWall = 0;
              hero.wallReleaseTimer = 0;
              hero.wallRestickTimer = PHYSICS.WALL_RESTICK_COOLDOWN;
              hero.action = 'fall';
            }
          }
        } else {
          hero.wallReleaseTimer = 0;
        }

        // Wall Jump
        if (hero.action === 'wall_slide' && hero.preJumpTimer > 0) {
          const jumpDir = (-hero.onWall) as -1 | 1;
          hero.facing = jumpDir;
          hero.vx = jumpDir * PHYSICS.WALL_JUMP_FORCE_X;
          hero.vy = PHYSICS.WALL_JUMP_FORCE_Y;
          hero.wallJumpTimer = PHYSICS.WALL_JUMP_TIMER;
          hero.wallJumpHoldTimer = PHYSICS.WALL_JUMP_HOLD_TIME;
          hero.wallRestickTimer = PHYSICS.WALL_RESTICK_COOLDOWN;
          hero.onWall = 0;
          hero.preJumpTimer = 0;
          hero.action = 'jump';
          hero.scaleX = 0.8;
          hero.scaleY = 1.25;
          skipGravityThisTick = true;
          events.push({ type: 'wall_jump', x: hero.x + hero.width * 0.5, y: hero.y, dir: jumpDir });
        }
        // Wall Dash (17.0, 8.0 for 0.50s)
        else if (hero.action === 'wall_slide' && (hero.preDashTimer > 0 || input.stompPressed)) {
          const dashDir = (-hero.onWall) as -1 | 1;
          hero.facing = dashDir;
          hero.vx = dashDir * PHYSICS.WALL_STOMP_FORCE_X;
          hero.vy = PHYSICS.WALL_STOMP_FORCE_Y;
          hero.wallDashTimer = PHYSICS.WALL_STOMP_TIMER;
          hero.wallRestickTimer = PHYSICS.WALL_RESTICK_COOLDOWN;
          hero.onWall = 0;
          hero.preDashTimer = 0;
          hero.action = 'wall_dash';
          hero.scaleX = 1.28;
          hero.scaleY = 0.78;
          skipGravityThisTick = true;
          events.push({ type: 'dash', x: hero.x + hero.width * 0.5, y: hero.y + hero.height * 0.5, kind: 'wall' });
        }
      }
    }
    // ---- Air Stomp State ----
    else if (hero.action === 'air_stomp') {
      hero.vy = -PHYSICS.MAX_FALL_SPEED;
      const driftMax = PHYSICS.MAX_SPEED * 0.35;
      const targetVx = input.moveX * driftMax;
      hero.vx += (targetVx - hero.vx) * Math.min(1, 8 * dt);
      applyGravity = false;
    }
    // ---- Standard Ground / Air Movement ----
    else {
      // Ground Dash / Ground Stomp (17.0, 12.0 decaying linearly to maxSpeed over 0.55s)
      if (
        (hero.grounded || hero.coyoteTimer > 0) &&
        (hero.preDashTimer > 0 || input.stompPressed)
      ) {
        if (Math.abs(input.moveX) > 0.2) {
          hero.facing = input.moveX > 0 ? 1 : -1;
        }
        hero.vx = hero.facing * PHYSICS.GROUND_STOMP_FORCE_X;
        hero.vy = PHYSICS.GROUND_STOMP_FORCE_Y;
        hero.groundDashTimer = PHYSICS.GROUND_STOMP_TIMER;
        hero.grounded = false;
        hero.coyoteTimer = 0;
        hero.preDashTimer = 0;
        hero.action = 'ground_dash';
        hero.scaleX = 1.3;
        hero.scaleY = 0.76;
        skipGravityThisTick = true;
        events.push({ type: 'dash', x: hero.x + hero.width * 0.5, y: hero.y + hero.height * 0.5, kind: 'ground' });
      }
      // Midair Dash -> Form Ability or Delayed Air Stomp (for krunk_basic)
      else if (!hero.grounded && hero.coyoteTimer <= 0 && hero.preDashTimer > 0) {
        hero.preDashTimer = 0;
        const startedForm = tryStartAirFormAbility(state, input, room, events);
        if (startedForm) {
          skipGravityThisTick = true;
          applyGravity = false;
        } else if (hero.form === 'krunk_basic') {
          if (input.moveY < -0.5) {
            startAirStompImmediate(state, events);
            skipGravityThisTick = true;
          } else {
            hero.stompDelayTimer = PHYSICS.STOMP_DELAY;
            hero.vx *= 0.3;
            hero.vy = 0;
            applyGravity = false;
          }
        }
      }
      // Leaf Glide by holding jump while falling in leaf form
      else if (
        hero.form === 'krunk_leaf' &&
        !hero.grounded &&
        hero.vy < 0 &&
        hero.jumpHoldTimer <= 0 &&
        hero.wallJumpHoldTimer <= 0 &&
        (input.dashHeld || input.jumpHeld)
      ) {
        hero.action = 'leaf_glide';
      }

      // Ground Dash linear speed decay back to MAX_SPEED over 0.55s
      if (!skipGravityThisTick && hero.groundDashTimer > 0 && hero.action === 'ground_dash') {
        hero.groundDashTimer = Math.max(0, hero.groundDashTimer - dt);
        const frac = hero.groundDashTimer / PHYSICS.GROUND_STOMP_TIMER;
        const targetSpeed =
          PHYSICS.MAX_SPEED + (PHYSICS.GROUND_STOMP_FORCE_X - PHYSICS.MAX_SPEED) * frac;
        const dir = hero.vx !== 0 ? Math.sign(hero.vx) : hero.facing;
        hero.vx = dir * targetSpeed;
        if (hero.groundDashTimer === 0) {
          hero.action = hero.grounded ? 'run' : 'fall';
        }
      }
      // Wall Dash linear speed decay back to MAX_SPEED over 0.50s
      else if (!skipGravityThisTick && hero.wallDashTimer > 0 && hero.action === 'wall_dash') {
        hero.wallDashTimer = Math.max(0, hero.wallDashTimer - dt);
        const frac = hero.wallDashTimer / PHYSICS.WALL_STOMP_TIMER;
        const targetSpeed =
          PHYSICS.MAX_SPEED + (PHYSICS.WALL_STOMP_FORCE_X - PHYSICS.MAX_SPEED) * frac;
        const dir = hero.vx !== 0 ? Math.sign(hero.vx) : hero.facing;
        hero.vx = dir * targetSpeed;
        if (hero.wallDashTimer === 0) {
          hero.action = hero.grounded ? 'run' : 'fall';
        }
      }
      // Normal Horizontal Accel / Decel (when not in wallJumpTimer lock or newly launched form ability)
      else if (hero.wallJumpTimer <= 0 && hero.stompDelayTimer <= 0 && !skipGravityThisTick) {
        const speedMult = hero.inQuicksand ? PHYSICS.QUICKSAND_MULT : 1.0;
        const maxSpd = PHYSICS.MAX_SPEED * speedMult;
        const hasInput = Math.abs(input.moveX) > 0.05;
        const targetVx = hasInput
          ? Math.sign(input.moveX) * Math.min(1, Math.abs(input.moveX)) * maxSpd
          : 0;
        const rate = hasInput ? PHYSICS.ACCEL : PHYSICS.DECEL;
        hero.vx += (targetVx - hero.vx) * Math.min(1, rate * dt);
        if (!hasInput && Math.abs(hero.vx) < 0.04) {
          hero.vx = 0;
        }
        if (hasInput) {
          hero.facing = input.moveX > 0 ? 1 : -1;
        }
      }

      // ---- Ground Jump (with Coyote & Pre-Jump buffer) ----
      if (hero.preJumpTimer > 0 && (hero.grounded || hero.coyoteTimer > 0)) {
        hero.vy = PHYSICS.JUMP_FORCE;
        hero.jumpHoldTimer = PHYSICS.JUMP_HOLD_TIME;
        hero.grounded = false;
        hero.coyoteTimer = 0;
        hero.preJumpTimer = 0;
        hero.groundDashTimer = 0;
        hero.action = 'jump';
        hero.scaleX = 0.82;
        hero.scaleY = 1.22;
        skipGravityThisTick = true;
        events.push({ type: 'jump', x: hero.x + hero.width * 0.5, y: hero.y, air: false, form: hero.form });
      }
      // ---- Midair Double / Triple Jump ----
      else if (
        hero.preJumpTimer > 0 &&
        !hero.grounded &&
        hero.coyoteTimer <= 0 &&
        hero.jumpsRemaining > 0
      ) {
        hero.vy = PHYSICS.DOUBLE_JUMP_FORCE;
        hero.jumpsRemaining -= 1;
        hero.jumpHoldTimer = 0;
        hero.wallJumpHoldTimer = 0;
        hero.preJumpTimer = 0;
        hero.groundDashTimer = 0;
        hero.wallDashTimer = 0;
        hero.action = 'jump';
        hero.scaleX = 0.84;
        hero.scaleY = 1.2;
        skipGravityThisTick = true;
        events.push({ type: 'jump', x: hero.x + hero.width * 0.5, y: hero.y, air: true, form: hero.form });
      }

      // ---- Variable Jump Hold Boost (8.0 * remTime over 0.20s) ----
      if (!skipGravityThisTick && hero.jumpHoldTimer > 0) {
        if (input.jumpHeld) {
          hero.jumpHoldTimer = Math.max(0, hero.jumpHoldTimer - dt);
          const boosted = PHYSICS.JUMP_FORCE + PHYSICS.JUMP_HOLD_BOOST * hero.jumpHoldTimer;
          if (hero.vy < boosted) {
            hero.vy = boosted;
          }
          skipGravityThisTick = true;
        } else {
          hero.jumpHoldTimer = 0;
        }
      }

      // ---- Wall Jump Hold Boost (15.0 * remTime over 0.20s) ----
      if (!skipGravityThisTick && hero.wallJumpHoldTimer > 0) {
        if (input.jumpHeld) {
          hero.wallJumpHoldTimer = Math.max(0, hero.wallJumpHoldTimer - dt);
          hero.vy += PHYSICS.WALL_JUMP_HOLD_BOOST * hero.wallJumpHoldTimer * dt;
          const sustained = PHYSICS.JUMP_FORCE + PHYSICS.WALL_JUMP_HOLD_BOOST * hero.wallJumpHoldTimer;
          if (hero.vy < sustained) {
            hero.vy = sustained;
          }
        } else {
          hero.wallJumpHoldTimer = 0;
        }
      }
    }
  }

  // 7. Wind zones & Gravity
  if (hero.inWindX !== 0 && !inLockedAbility) {
    hero.vx += hero.inWindX * SIM_RULES.WIND_SIDE_ACCEL * dt;
  }

  if (applyGravity && !skipGravityThisTick) {
    if (hero.inWindY > 0 && hero.action !== 'air_stomp') {
      hero.vy = Math.min(SIM_RULES.WIND_UP_MAX_VY, hero.vy + SIM_RULES.WIND_UP_ACCEL * dt);
    } else {
      hero.vy += PHYSICS.G_EFF * gravityScale * dt;
    }

    const fallCap = hero.inQuicksand ? SIM_RULES.QUICKSAND_MAX_FALL : PHYSICS.MAX_FALL_SPEED;
    if (hero.vy < -fallCap) {
      hero.vy = -fallCap;
    }
    if (hero.action === 'wall_slide') {
      const slideCap = getWallSlideSpeed(hero.form);
      if (hero.vy < slideCap) {
        hero.vy = slideCap;
      }
    }
  }

  // 8. Swept Sub-Stepped AABB Tile Collision
  const preMoveAction = hero.action;
  const moveRes = moveHeroWithCollision(state, room, hero.vx * dt, hero.vy * dt, events);
  if (moveRes.explosions.length > 0) {
    output.explosions.push(...moveRes.explosions);
  }

  // Cancel ceiling-blocked jump hold / uppercut
  if (moveRes.hitCeiling) {
    hero.jumpHoldTimer = 0;
    hero.wallJumpHoldTimer = 0;
    if (hero.action === 'rock_uppercut' && hero.abilityPhase === 1) {
      hero.abilityPhase = 2;
      hero.abilityTimer = 0;
      hero.vy = 0;
    }
  }

  // Cancel horizontal form dashes on non-breakable wall hit
  if (moveRes.hitWall !== 0) {
    if (hero.action === 'fire_dash' || hero.action === 'volt_dive' || hero.action === 'volt_blink' || hero.action === 'shadow_blink') {
      hero.action = hero.grounded ? 'idle' : 'fall';
      hero.abilityTimer = 0;
      hero.voltTargetId = null;
    } else if (hero.action === 'ground_dash' || hero.action === 'wall_dash') {
      hero.groundDashTimer = 0;
      hero.wallDashTimer = 0;
      hero.action = hero.grounded ? 'idle' : 'fall';
    }
  }

  // Start crumble timers for stepped crumble tiles
  for (let i = 0; i < moveRes.steppedCrumbleIndices.length; i++) {
    const idx = moveRes.steppedCrumbleIndices[i];
    if (state.crumbleTimers[idx] === undefined) {
      state.crumbleTimers[idx] = SIM_RULES.CRUMBLE_BREAK_TIME;
    }
  }

  // Bounce tile spring (18.0 u/s, 0.75x in antigrav)
  if (moveRes.hitBounce) {
    const bounceVy = SIM_RULES.BOUNCE_TILE_VY * (hero.inAntigrav ? PHYSICS.ANTIGRAV_BOUNCE_MULT : 1.0);
    hero.vy = bounceVy;
    hero.grounded = false;
    hero.jumpsRemaining = hero.maxAirJumps;
    hero.abilityUsedInAir = false;
    hero.jumpHoldTimer = 0;
    hero.wallJumpHoldTimer = 0;
    hero.groundDashTimer = 0;
    hero.wallDashTimer = 0;
    hero.stompDelayTimer = 0;
    hero.action = 'jump';
    hero.scaleX = 0.78;
    hero.scaleY = 1.3;
    events.push({ type: 'bounce_pad', x: hero.x + hero.width * 0.5, y: hero.y });
  }
  // Landing resolution
  else if (moveRes.landed) {
    const heavy = preMoveAction === 'air_stomp';
    hero.jumpsRemaining = hero.maxAirJumps;
    hero.abilityUsedInAir = false;
    hero.onWall = 0;
    hero.jumpHoldTimer = 0;
    hero.wallJumpHoldTimer = 0;
    hero.voltTargetId = null;

    if (heavy) {
      const cx = hero.x + hero.width * 0.5;
      const isStompFlame = hero.form === 'krunk_fire' && getUpgradeLevel(state, 'StompFlame') > 0;
      const isShadow = hero.form === 'krunk_shadow';
      events.push({ type: 'stomp_impact', x: cx, y: hero.y, explosive: isStompFlame || isShadow });
      events.push({ type: 'land', x: cx, y: hero.y, heavy: true });
      state.camera.shakeTimer = Math.max(state.camera.shakeTimer, 0.18);
      state.camera.shakeIntensity = Math.max(state.camera.shakeIntensity, 0.22);
      hero.scaleX = 1.35;
      hero.scaleY = 0.65;

      if (isStompFlame) {
        output.stompFlameTriggered = true;
        output.explosions.push({ x: cx, y: hero.y + 0.3, radius: SIM_RULES.STOMP_FLAME_RADIUS });
        breakTilesInRadius(state, room, cx, hero.y + 0.3, SIM_RULES.STOMP_FLAME_RADIUS, events, output.explosions);
      }
      if (isShadow) {
        spawnShadowShockwaves(state);
      }
      hero.action = Math.abs(hero.vx) > 0.2 ? 'run' : 'idle';
    } else {
      hero.scaleX = 1.18;
      hero.scaleY = 0.84;
      events.push({ type: 'land', x: hero.x + hero.width * 0.5, y: hero.y, heavy: false });
      if (hero.action !== 'ground_dash' && hero.action !== 'hurt') {
        hero.action = Math.abs(hero.vx) > 0.2 ? 'run' : 'idle';
      }
    }
  } else if (
    hero.grounded &&
    hero.action !== 'ground_dash' &&
    hero.action !== 'hurt' &&
    hero.action !== 'dead'
  ) {
    hero.action = Math.abs(hero.vx) > 0.2 ? 'run' : 'idle';
  } else if (
    !hero.grounded &&
    (hero.action === 'idle' || hero.action === 'run')
  ) {
    hero.action = hero.vy > 0 ? 'jump' : 'fall';
  } else if (hero.action === 'jump' && hero.vy < 0) {
    hero.action = 'fall';
  }

  // 9. Tile hazard damage (Spike / Acid / Lava)
  if (moveRes.hitHazard) {
    const dmgRes = damageHero(state, 1, hero.x + hero.width * 0.5, events, moveRes.hitHazard);
    if (dmgRes.evilRingTriggered) {
      output.evilRingTriggered = true;
    }
  }

  return output;
}
