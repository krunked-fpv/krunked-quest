import type {
  InputFrame,
  RoomDef,
  SimEvent,
  SimState,
} from '../contracts/index';
import { triggerCameraShake } from './camera';
import {
  breakTilesInRadius,
  carryHeroOnMovingPlatforms,
  detectAdjacentWall,
  isAdjacentWallCrumble,
  moveHeroWithCollision,
  smashFloorUnderHero,
  sweepStompBlockDestroyer,
  type BlastCircle,
} from './collision';
import { breakCombo } from './combo';
import {
  FORM_PARAMS,
  PHYSICS,
  SIM_RULES,
  getUpgradeLevel,
  getWallSlideSpeed,
  hasRelic,
} from './constants';
import {
  handleFormSwitchInput,
  spawnFireStompWaves,
  spawnShadowShockwaves,
  tryStartAirFormAbility,
  updateActiveFormAbility,
} from './forms';
import { nextFloat } from './prng';

export interface HeroStepOutput {
  explosions: BlastCircle[];
  completedVoltTargetId: string | null;
  completedShadowTargetId: string | null;
  stompFlameTriggered: boolean;
  evilRingTriggered: boolean;
  groundStompHitbox: { x: number; y: number; w: number; h: number } | null;
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
    hazardKind === 'lava' &&
    (hero.action === 'fire_dash' || hero.fireImmunityTimer > 0)
  ) {
    return true;
  }
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
    (getUpgradeLevel(state, 'RockUppercutInvuln') > 0 ||
      (hazardKind === 'spike' && getUpgradeLevel(state, 'RockUppercutPower') > 0))
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
  hero.wallSlideCoyoteTimer = 0;
  hero.wallSalivaActive = false;
  hero.tongueKind = 'none';
  hero.tongueTimer = 0;

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
    hero.onWall = 0;
  } else if (hazardKind === 'acid' || hazardKind === 'lava') {
    hero.vy = Math.max(hero.vy, 7.0);
  }

  breakCombo(state);

  triggerCameraShake(state, 0.14);
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

/**
 * Buffers jump, dash, stomp, and form switches during hitstop freeze frames
 * so tactile hitstop NEVER drops player inputs!
 */
export function bufferInputsDuringHitstop(
  state: SimState,
  input: InputFrame,
  events: SimEvent[],
): void {
  const hero = state.hero;
  if (hero.action === 'dead') return;
  if (input.jumpPressed) {
    hero.preJumpTimer = PHYSICS.PRE_JUMP;
  }
  if (input.dashPressed) {
    hero.preDashTimer = Math.max(hero.preDashTimer, PHYSICS.PRE_JUMP);
  }
  if (input.stompPressed) {
    hero.preStompTimer = SIM_RULES.PRE_STOMP;
  }
  handleFormSwitchInput(state, input, events);
}

function startGroundStomp(
  state: SimState,
  room: RoomDef,
  events: SimEvent[],
  output: HeroStepOutput,
): void {
  const hero = state.hero;
  const cx = hero.x + hero.width * 0.5;

  hero.action = 'ground_stomp';
  hero.vx = 0;
  hero.vy = PHYSICS.GROUND_STOMP_FORCE_Y; // +12.0 straight UP tongue-slam pop!
  hero.grounded = false;
  hero.coyoteTimer = 0;
  hero.preStompTimer = 0;
  hero.jumpHoldTimer = 0;
  hero.wallJumpHoldTimer = 0;
  hero.groundDashTimer = 0;
  hero.wallDashTimer = 0;
  hero.abilityTimer = 0;
  hero.abilityPhase = 0;
  hero.jumpsRemaining = hero.maxAirJumps;
  hero.abilityUsedInAir = false;
  hero.onWall = 0;
  hero.wallSlideCoyoteTimer = 0;
  hero.wallSalivaActive = false;

  // Authentic tongue-slam geometry & animation timer
  hero.tongueKind = 'ground_stomp';
  hero.tongueTimer = SIM_RULES.TONGUE_GROUND_STOMP_DUR;
  hero.tongueDuration = SIM_RULES.TONGUE_GROUND_STOMP_DUR;
  hero.tongueOriginX = cx;
  hero.tongueOriginY = hero.y;
  hero.tongueDirX = 0;
  hero.tongueDirY = -1;
  hero.scaleX = 1.32;
  hero.scaleY = 0.68;

  // Dual downward floor smash rays (breakable, explosive, crumble, switches)
  const hitFloorObj = smashFloorUnderHero(state, room, events, output.explosions);
  if (!hitFloorObj) {
    hero.stompSpamTimer = PHYSICS.STOMP_DELAY; // 0.25s anti-spam cooldown when no interactable hit
  }

  // Expose active tongue-slam foot hitbox to enemy & boss combat
  output.groundStompHitbox = {
    x: cx - SIM_RULES.GROUND_STOMP_REACH_X,
    y: hero.y - SIM_RULES.GROUND_STOMP_REACH_DOWN,
    w: SIM_RULES.GROUND_STOMP_REACH_X * 2,
    h: SIM_RULES.GROUND_STOMP_REACH_DOWN + 0.45,
  };

  const isStompFlame = hero.form === 'krunk_fire' && getUpgradeLevel(state, 'StompFlame') > 0;
  const isShadow = hero.form === 'krunk_shadow';

  if (isStompFlame) {
    output.stompFlameTriggered = true;
    spawnFireStompWaves(state);
  }
  if (isShadow) {
    spawnShadowShockwaves(state);
  }

  triggerCameraShake(state, SIM_RULES.CAM_SHAKE_STRENGTH);
  events.push({ type: 'ground_stomp', x: cx, y: hero.y, fiery: isStompFlame });
  events.push({
    type: 'tongue_lash',
    x: cx,
    y: hero.y,
    kind: 'ground_stomp',
    dirX: 0,
    dirY: -1,
  });
  events.push({ type: 'stomp_impact', x: cx, y: hero.y, explosive: isStompFlame || isShadow });
}

function startAirStompImmediate(state: SimState, events: SimEvent[]): void {
  const hero = state.hero;
  const cx = hero.x + hero.width * 0.5;
  const cy = hero.y + hero.height * 0.5;

  // Retroactive super-bounce forgiveness: tapping Stomp within 0.05s (0.10s Elec/Shadow) after enemy contact!
  if (hero.lastEnemyHitTimer > 0) {
    hero.vy = computeEnemyBounceVy(state, true);
    hero.lastEnemyHitTimer = 0;
    hero.preStompTimer = 0;
    hero.action = 'flip';
    hero.scaleX = 0.78;
    hero.scaleY = 1.32;
    hero.tongueKind = 'air_stomp';
    hero.tongueTimer = 0.14;
    hero.tongueDuration = 0.14;
    hero.tongueOriginX = cx;
    hero.tongueOriginY = hero.y;
    hero.tongueDirX = 0;
    hero.tongueDirY = -1;
    events.push({ type: 'stomp_start', x: cx, y: hero.y });
    events.push({ type: 'tongue_lash', x: cx, y: hero.y, kind: 'air_stomp', dirX: 0, dirY: -1 });
    return;
  }

  // Immediate downward tongue dive — ZERO hover delay, preserves 100% horizontal vx!
  hero.action = 'air_stomp';
  hero.stompDelayTimer = 0;
  hero.preStompTimer = 0;
  hero.jumpHoldTimer = 0;
  hero.wallJumpHoldTimer = 0;
  hero.wallJumpTimer = 0;
  hero.groundDashTimer = 0;
  hero.wallDashTimer = 0;
  hero.abilityTimer = 0;
  hero.abilityPhase = 0;
  hero.voltTargetId = null;
  hero.onWall = 0;
  hero.wallSlideCoyoteTimer = 0;
  hero.wallSlideDir = 0;
  hero.wallSalivaActive = false;
  // Horizontal vx is preserved 100% (no vx *= 0.25 brake!)
  hero.vy = -PHYSICS.MAX_FALL_SPEED;
  hero.scaleX = 0.74;
  hero.scaleY = 1.32;

  hero.tongueKind = 'air_stomp';
  hero.tongueTimer = SIM_RULES.TONGUE_AIR_STOMP_DUR;
  hero.tongueDuration = SIM_RULES.TONGUE_AIR_STOMP_DUR;
  hero.tongueOriginX = cx;
  hero.tongueOriginY = hero.y;
  hero.tongueDirX = 0;
  hero.tongueDirY = -1;

  events.push({ type: 'stomp_start', x: cx, y: cy });
  events.push({ type: 'tongue_lash', x: cx, y: cy, kind: 'air_stomp', dirX: 0, dirY: -1 });
}

function startGroundDash(
  state: SimState,
  moveDir: -1 | 0 | 1,
  events: SimEvent[],
): void {
  const hero = state.hero;
  if (moveDir !== 0) {
    hero.facing = moveDir;
  }
  const cx = hero.x + hero.width * 0.5;
  const cy = hero.y + hero.height * 0.5;

  hero.vx = hero.facing * PHYSICS.GROUND_STOMP_FORCE_X; // 17.0 * dir
  hero.vy = PHYSICS.GROUND_STOMP_FORCE_Y; // 12.0 tongue-vault arc
  hero.groundDashTimer = PHYSICS.GROUND_STOMP_TIMER; // 0.55s
  hero.wallDashTimer = 0;
  hero.grounded = false;
  hero.coyoteTimer = 0;
  hero.preDashTimer = 0;
  hero.jumpHoldTimer = 0;
  hero.wallJumpHoldTimer = 0;
  hero.jumpsRemaining = hero.maxAirJumps;
  hero.abilityUsedInAir = false;
  hero.action = 'ground_dash';
  hero.scaleX = 1.3;
  hero.scaleY = 0.76;

  // Tongue plants down-back at launch anchor point
  hero.tongueKind = 'ground_dash';
  hero.tongueTimer = SIM_RULES.TONGUE_GROUND_DASH_DUR;
  hero.tongueDuration = SIM_RULES.TONGUE_GROUND_DASH_DUR;
  hero.tongueOriginX = cx;
  hero.tongueOriginY = hero.y;
  hero.tongueDirX = -hero.facing;
  hero.tongueDirY = -1;

  events.push({ type: 'dash', x: cx, y: cy, kind: 'ground' });
  events.push({
    type: 'tongue_lash',
    x: cx,
    y: hero.y,
    kind: 'ground_dash',
    dirX: -hero.facing,
    dirY: -1,
  });
}

function startWallDash(
  state: SimState,
  dashDir: -1 | 1,
  events: SimEvent[],
): void {
  const hero = state.hero;
  const cx = hero.x + hero.width * 0.5;
  const cy = hero.y + hero.height * 0.5;
  const wallAnchorX = dashDir > 0 ? hero.x : hero.x + hero.width;

  hero.facing = dashDir;
  hero.vx = dashDir * PHYSICS.WALL_STOMP_FORCE_X; // 17.0 * awayDir
  hero.vy = PHYSICS.WALL_STOMP_FORCE_Y; // 8.0
  hero.wallDashTimer = PHYSICS.WALL_STOMP_TIMER; // 0.50s (decays at 0.5x rate!)
  hero.groundDashTimer = 0;
  hero.wallRestickTimer = PHYSICS.WALL_RESTICK_COOLDOWN;
  hero.onWall = 0;
  hero.wallSlideCoyoteTimer = 0;
  hero.wallSlideDir = 0;
  hero.wallSalivaActive = false;
  hero.preDashTimer = 0;
  hero.jumpHoldTimer = 0;
  hero.wallJumpHoldTimer = 0;
  hero.jumpsRemaining = hero.maxAirJumps;
  hero.abilityUsedInAir = false;
  hero.action = 'wall_dash';
  hero.scaleX = 1.28;
  hero.scaleY = 0.78;

  // Tongue pushes horizontally against the wall behind launch
  hero.tongueKind = 'wall_dash';
  hero.tongueTimer = SIM_RULES.TONGUE_WALL_DASH_DUR;
  hero.tongueDuration = SIM_RULES.TONGUE_WALL_DASH_DUR;
  hero.tongueOriginX = wallAnchorX;
  hero.tongueOriginY = cy;
  hero.tongueDirX = -dashDir;
  hero.tongueDirY = 0;

  events.push({ type: 'dash', x: cx, y: cy, kind: 'wall' });
  events.push({
    type: 'tongue_lash',
    x: wallAnchorX,
    y: cy,
    kind: 'wall_dash',
    dirX: -dashDir,
    dirY: 0,
  });
}

function startWallJump(
  state: SimState,
  jumpDir: -1 | 1,
  events: SimEvent[],
): void {
  const hero = state.hero;
  hero.facing = jumpDir;
  // Exact origin: vx = wallJumpForce.x * 3 = 15.0 * awayDir, vy = jumpForce = 10.0!
  hero.vx = jumpDir * PHYSICS.WALL_JUMP_FORCE_X * SIM_RULES.WALL_JUMP_X_MULT;
  hero.vy = PHYSICS.JUMP_FORCE;
  hero.wallJumpTimer = PHYSICS.WALL_JUMP_TIMER; // 0.06s
  hero.wallJumpHoldTimer = PHYSICS.WALL_JUMP_HOLD_TIME; // 0.20s quadratic hold (10 + 15*rem^2)
  hero.wallRestickTimer = PHYSICS.WALL_RESTICK_COOLDOWN;
  hero.onWall = 0;
  hero.wallSlideCoyoteTimer = 0;
  hero.wallSlideDir = 0;
  hero.wallSalivaActive = false;
  hero.preJumpTimer = 0;
  hero.groundDashTimer = 0;
  hero.wallDashTimer = 0;
  hero.jumpsRemaining = hero.maxAirJumps;
  hero.abilityUsedInAir = false;
  hero.action = 'jump';
  hero.scaleX = 0.8;
  hero.scaleY = 1.25;
  events.push({ type: 'wall_jump', x: hero.x + hero.width * 0.5, y: hero.y, dir: jumpDir });
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
    completedShadowTargetId: null,
    stompFlameTriggered: false,
    evilRingTriggered: false,
    groundStompHitbox: null,
  };

  // Digital horizontal direction (-1 | 0 | 1) per origin _normalizeHorizontalSpeed
  const moveDir: -1 | 0 | 1 = input.moveX > 0.1 ? 1 : input.moveX < -0.1 ? -1 : 0;

  // 1. Carry hero with any moving platform before movement
  carryHeroOnMovingPlatforms(state, room);

  // 2. Form switching (preserves momentum cleanly!)
  handleFormSwitchInput(state, input, events);

  // 3. Decrement timers
  hero.animTimer += dt;
  hero.scaleX += (1 - hero.scaleX) * Math.min(1, 14 * dt);
  hero.scaleY += (1 - hero.scaleY) * Math.min(1, 14 * dt);
  hero.stompDelayTimer = 0;
  if (hero.hitFlashTimer > 0) hero.hitFlashTimer = Math.max(0, hero.hitFlashTimer - dt);
  if (hero.invulnTimer > 0) hero.invulnTimer = Math.max(0, hero.invulnTimer - dt);
  if (hero.magicShieldTimer > 0) hero.magicShieldTimer = Math.max(0, hero.magicShieldTimer - dt);
  if (hero.fireImmunityTimer > 0) hero.fireImmunityTimer = Math.max(0, hero.fireImmunityTimer - dt);
  if (hero.lastEnemyHitTimer > 0) hero.lastEnemyHitTimer = Math.max(0, hero.lastEnemyHitTimer - dt);
  if (hero.stompSpamTimer > 0) hero.stompSpamTimer = Math.max(0, hero.stompSpamTimer - dt);
  if (hero.wallJumpTimer > 0) hero.wallJumpTimer = Math.max(0, hero.wallJumpTimer - dt);
  if (hero.wallStickLockTimer > 0) hero.wallStickLockTimer = Math.max(0, hero.wallStickLockTimer - dt);
  if (hero.wallRestickTimer > 0) hero.wallRestickTimer = Math.max(0, hero.wallRestickTimer - dt);

  if (hero.action !== 'wall_slide' && hero.wallSlideCoyoteTimer > 0) {
    hero.wallSlideCoyoteTimer = Math.max(0, hero.wallSlideCoyoteTimer - dt);
    if (hero.wallSlideCoyoteTimer === 0) {
      hero.wallSlideDir = 0;
    }
  }

  if (hero.recoilTimer > 0) {
    hero.recoilTimer = Math.max(0, hero.recoilTimer - dt);
    if (hero.recoilTimer === 0 && hero.action === 'hurt') {
      hero.action = hero.grounded ? 'idle' : 'fall';
    }
  }

  // Update active tongue timer & continuous states
  if (hero.action === 'air_stomp') {
    hero.tongueKind = 'air_stomp';
    hero.tongueTimer = SIM_RULES.TONGUE_AIR_STOMP_DUR;
    hero.tongueDuration = SIM_RULES.TONGUE_AIR_STOMP_DUR;
    hero.tongueOriginX = hero.x + hero.width * 0.5;
    hero.tongueOriginY = hero.y;
    hero.tongueDirX = 0;
    hero.tongueDirY = -1;
  } else if (hero.action === 'wall_slide') {
    hero.tongueKind = 'wall_slide';
    hero.tongueTimer = 0.1;
    hero.tongueDuration = 0.1;
    hero.tongueOriginX = hero.onWall > 0 ? hero.x + hero.width : hero.x;
    hero.tongueOriginY = hero.y + hero.height * 0.5;
    hero.tongueDirX = hero.onWall;
    hero.tongueDirY = 0;
  } else if (hero.tongueTimer > 0) {
    hero.tongueTimer = Math.max(0, hero.tongueTimer - dt);
    if (hero.tongueTimer === 0) {
      hero.tongueKind = 'none';
      hero.tongueDuration = 0;
    }
  }

  // Input buffers: coyote, pre-jump, pre-dash, pre-stomp
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

  if (input.stompPressed) {
    hero.preStompTimer = SIM_RULES.PRE_STOMP;
  } else if (hero.preStompTimer > 0) {
    hero.preStompTimer = Math.max(0, hero.preStompTimer - dt);
  }

  let applyGravity = true;
  let gravityScale = hero.inAntigrav ? SIM_RULES.ANTIGRAV_GRAVITY_SCALE : 1.0;
  let skipGravityThisTick = false;

  // 4. Update active form ability if any
  const abilityTick = updateActiveFormAbility(state, input, room, dt, events);
  if (abilityTick.completedVoltTargetId) {
    output.completedVoltTargetId = abilityTick.completedVoltTargetId;
  }
  if (abilityTick.completedShadowTargetId) {
    output.completedShadowTargetId = abilityTick.completedShadowTargetId;
  }

  let inLockedAbility = abilityTick.handledMovement;
  if (inLockedAbility) {
    applyGravity = abilityTick.applyGravity;
    gravityScale *= abilityTick.gravityScale;
  }

  // Detect adjacent walls early
  const adjacentWall = detectAdjacentWall(state, room, moveDir || hero.facing);
  if (hero.action === 'wall_slide' && (adjacentWall !== hero.onWall || hero.grounded)) {
    hero.onWall = 0;
    hero.wallSalivaActive = false;
    hero.action = hero.grounded ? 'idle' : 'fall';
  }

  // 5. Dedicated Stomp Routing (SEPARATE from Dash!) — GroundStomp vs Wall/AirStomp
  if (
    hero.preStompTimer > 0 &&
    hero.recoilTimer <= 0 &&
    hero.action !== 'vine_slide' &&
    hero.action !== 'volt_blink' &&
    hero.action !== 'shadow_blink'
  ) {
    if (hero.action === 'wall_slide' || hero.wallSlideCoyoteTimer > 0) {
      // Pressing Stomp while wall-sliding (or within wall grace) immediately dives!
      startAirStompImmediate(state, events);
      inLockedAbility = false;
      applyGravity = false;
      skipGravityThisTick = true;
    } else if (hero.grounded) {
      if (hero.stompSpamTimer <= 0) {
        startGroundStomp(state, room, events, output);
        inLockedAbility = false;
        skipGravityThisTick = true;
      } else {
        hero.preStompTimer = 0;
      }
    } else if (hero.action !== 'air_stomp') {
      // Airborne: immediate Air Stomp or retroactive super-bounce (never dropped during coyote!)
      startAirStompImmediate(state, events);
      inLockedAbility = false;
      applyGravity = false;
      skipGravityThisTick = true;
    }
  }

  // 6. Standard movement, wall slide, vine slide, jumping, dashing, air stomp
  if (!inLockedAbility && hero.recoilTimer <= 0) {
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
      hero.wallSlideCoyoteTimer = 0;
      hero.wallSalivaActive = false;
      hero.groundDashTimer = 0;
      hero.wallDashTimer = 0;
      hero.jumpsRemaining = hero.maxAirJumps;
      hero.abilityUsedInAir = false;
      hero.vy = Math.min(hero.vy, -PHYSICS.VINE_SLIDE_MIN);
    }

    // Wall slide attachment — ONLY when pressing INTO the wall (exact origin!)
    if (
      hero.action !== 'vine_slide' &&
      hero.action !== 'air_stomp' &&
      hero.action !== 'leaf_glide' &&
      !hero.grounded &&
      hero.wallRestickTimer <= 0 &&
      adjacentWall !== 0 &&
      moveDir === adjacentWall &&
      hero.vy <= PHYSICS.VEL_Y_WALL_JUMP &&
      hero.action !== 'wall_slide'
    ) {
      hero.action = 'wall_slide';
      hero.onWall = adjacentWall;
      hero.facing = adjacentWall;
      hero.wallSlideDir = (-adjacentWall) as -1 | 1;
      hero.wallSlideCoyoteTimer = PHYSICS.WALL_STICK_LOCK; // 0.20s initial wall grace
      hero.wallStickLockTimer = PHYSICS.WALL_STICK_LOCK;
      hero.wallReleaseTimer = 0;
      hero.jumpsRemaining = hero.maxAirJumps;
      hero.abilityUsedInAir = false;
      hero.groundDashTimer = 0;
      hero.wallDashTimer = 0;
      hero.jumpHoldTimer = 0;
      hero.wallJumpHoldTimer = 0;
      hero.vy = 0;
      hero.wallSalivaActive = !isAdjacentWallCrumble(state, room, adjacentWall);
      hero.wallSalivaTopY = hero.y + 0.42;
      hero.tongueKind = 'wall_slide';
      hero.tongueTimer = 0.1;
      hero.tongueDuration = 0.1;
      hero.tongueDirX = adjacentWall;
      hero.tongueDirY = 0;

      // Buffered Wall Dash fires immediately upon wall contact!
      if (hero.preDashTimer > 0) {
        startWallDash(state, hero.wallSlideDir, events);
        skipGravityThisTick = true;
      }
    }

    // ---- Vine Slide State ----
    if (hero.action === 'vine_slide') {
      if (!hero.onVine || hero.grounded) {
        hero.action = hero.grounded ? 'idle' : 'fall';
      } else {
        hero.vx *= 0.5;
        hero.vy = Math.min(hero.vy, -PHYSICS.VINE_SLIDE_MIN);
        hero.vy = Math.max(-PHYSICS.VINE_SLIDE_MAX, hero.vy - 14.0 * dt);
        applyGravity = false;

        if (hero.preJumpTimer > 0) {
          const jumpDir: -1 | 1 = moveDir !== 0 ? moveDir : hero.facing;
          hero.facing = jumpDir;
          hero.vx = jumpDir * PHYSICS.VINE_JUMP_IMPULSE_X;
          hero.vy = PHYSICS.DOUBLE_JUMP_FORCE;
          hero.preJumpTimer = 0;
          hero.wallRestickTimer = PHYSICS.WALL_RESTICK_COOLDOWN;
          hero.action = 'jump';
          skipGravityThisTick = true;
          events.push({ type: 'jump', x: hero.x + hero.width * 0.5, y: hero.y, air: true, form: hero.form });
        } else if (hero.preDashTimer > 0) {
          const dashDir: -1 | 1 = moveDir !== 0 ? moveDir : hero.facing;
          startWallDash(state, dashDir, events);
          skipGravityThisTick = true;
        }
      }
    }
    // ---- Wall Slide State ----
    else if (hero.action === 'wall_slide') {
      if (adjacentWall !== hero.onWall || hero.grounded || moveDir !== hero.onWall) {
        // Immediate release when letting go of wall direction, preserving 0.05s coyote grace!
        hero.onWall = 0;
        hero.wallSalivaActive = false;
        hero.tongueKind = 'none';
        hero.tongueTimer = 0;
        hero.wallSlideCoyoteTimer = Math.max(hero.wallSlideCoyoteTimer, PHYSICS.WALL_RELEASE_BUFFER);
        hero.action = hero.grounded ? 'idle' : 'fall';
      } else {
        const slideCap = getWallSlideSpeed(hero.form); // -4.0 Basic, -2.0 all 5 elemental forms
        hero.vx = 0;
        hero.vy += (slideCap - hero.vy) * Math.min(1, SIM_RULES.WALL_SLIDE_LERP_RATE * dt);
        if (hero.vy < slideCap) {
          hero.vy = slideCap;
        }
        applyGravity = false;
        hero.wallSlideCoyoteTimer = Math.max(hero.wallSlideCoyoteTimer, PHYSICS.WALL_RELEASE_BUFFER);

        if (hero.preJumpTimer > 0) {
          startWallJump(state, (-hero.onWall) as -1 | 1, events);
          skipGravityThisTick = true;
        } else if (hero.preDashTimer > 0) {
          startWallDash(state, (-hero.onWall) as -1 | 1, events);
          skipGravityThisTick = true;
        }
      }
    }
    // ---- Wall-Slide Grace (50ms coyote window — also fires on same-frame wall-release + Jump/Dash!) ----
    if (
      hero.action !== 'vine_slide' &&
      hero.action !== 'wall_slide' &&
      hero.wallSlideCoyoteTimer > 0 &&
      hero.wallSlideDir !== 0 &&
      !hero.grounded
    ) {
      if (hero.preJumpTimer > 0) {
        startWallJump(state, hero.wallSlideDir, events);
        skipGravityThisTick = true;
      } else if (hero.preDashTimer > 0) {
        startWallDash(state, hero.wallSlideDir, events);
        skipGravityThisTick = true;
      }
    }

    // ---- Ground / Midair Dash, Air Stomp, Jump & Horizontal Control ----
    if (hero.action !== 'vine_slide' && hero.action !== 'wall_slide') {
      // 6a. Dash button routing (Ground Dash vs Midair Form Ability — NEVER Basic 0.25s hover!)
      if (!skipGravityThisTick && hero.preDashTimer > 0) {
        if (hero.grounded) {
          startGroundDash(state, moveDir, events);
          skipGravityThisTick = true;
        } else {
          const startedForm = tryStartAirFormAbility(state, input, room, events);
          if (startedForm) {
            hero.preDashTimer = 0;
            skipGravityThisTick = true;
            if (hero.form !== 'krunk_basic') {
              applyGravity = false;
            }
          } else if (hero.form === 'krunk_basic' && hero.preDashTimer < PHYSICS.PRE_DASH - dt * 1.5) {
            // Keep preDashTimer alive up to 0.05s so pressing Dash just before landing buffers Ground Dash!
          }
        }
      }

      // 6b. Seamless Leaf Glide resume when holding Dash or Jump while falling in Leaf form
      if (
        !skipGravityThisTick &&
        hero.form === 'krunk_leaf' &&
        !hero.grounded &&
        hero.action !== 'air_stomp' &&
        hero.vy <= 0 &&
        hero.jumpHoldTimer <= 0 &&
        hero.wallJumpHoldTimer <= 0 &&
        (input.dashHeld || input.jumpHeld)
      ) {
        hero.action = 'leaf_glide';
        hero.groundDashTimer = 0;
        hero.wallDashTimer = 0;
        const targetGlideVy =
          hero.inWindY > 0
            ? FORM_PARAMS.LEAF_WIND_VY
            : FORM_PARAMS.LEAF_GLIDE_VY * (hero.inAntigrav ? SIM_RULES.ANTIGRAV_GRAVITY_SCALE : 1.0);
        const lerpRate = hero.inWindY > 0 ? SIM_RULES.LEAF_WIND_LERP_RATE : SIM_RULES.LEAF_GLIDE_LERP_RATE;
        hero.vy += (targetGlideVy - hero.vy) * Math.min(1, lerpRate * dt);
        applyGravity = false;
      }

      // 6c. Air Stomp descent velocity + downward StompBlockDestroyer scoop
      if (hero.action === 'air_stomp') {
        hero.vy = -PHYSICS.MAX_FALL_SPEED;
        applyGravity = false;
        sweepStompBlockDestroyer(state, room, events, output.explosions);
      }

      // 6d. Horizontal velocity update:
      // Ground Dash decay (preserves horizontal burst even if player jumps mid-dash!)
      if (!skipGravityThisTick && hero.groundDashTimer > 0) {
        hero.groundDashTimer = Math.max(0, hero.groundDashTimer - dt);
        const decayStep =
          ((PHYSICS.GROUND_STOMP_FORCE_X - PHYSICS.MAX_SPEED) / PHYSICS.GROUND_STOMP_TIMER) * dt;
        const dir = hero.vx !== 0 ? Math.sign(hero.vx) : hero.facing;
        const nextMag = Math.max(0, Math.abs(hero.vx) - decayStep);
        hero.vx = dir * nextMag;
        if (hero.groundDashTimer === 0 || Math.abs(hero.vx) < SIM_RULES.GROUND_DASH_MIN_VX) {
          hero.groundDashTimer = 0;
          if (hero.action === 'ground_dash') {
            hero.action = hero.grounded ? 'run' : 'fall';
          }
        }
      }
      // Wall Dash decay (0.5x decay rate = 10.4 u/s^2 — stays fast across wide rooms!)
      else if (!skipGravityThisTick && hero.wallDashTimer > 0) {
        hero.wallDashTimer = Math.max(0, hero.wallDashTimer - dt);
        const decayStep =
          ((PHYSICS.WALL_STOMP_FORCE_X - PHYSICS.MAX_SPEED) / PHYSICS.WALL_STOMP_TIMER) *
          dt *
          SIM_RULES.WALL_DASH_DECAY_MULT;
        const dir = hero.vx !== 0 ? Math.sign(hero.vx) : hero.facing;
        const nextMag = Math.max(0, Math.abs(hero.vx) - decayStep);
        hero.vx = dir * nextMag;
        if (hero.wallDashTimer === 0 || hero.grounded || Math.abs(hero.vx) < SIM_RULES.WALL_DASH_MIN_VX) {
          hero.wallDashTimer = 0;
          if (hero.action === 'wall_dash') {
            hero.action = hero.grounded ? 'run' : 'fall';
          }
        }
      }
      // Normal exponential Horizontal Accel/Decel (identical crisp feel on ground, air & Air Stomp!)
      else if (hero.wallJumpTimer <= 0 && !skipGravityThisTick) {
        const speedMult = hero.inQuicksand ? PHYSICS.QUICKSAND_MULT : 1.0;
        const maxSpd = PHYSICS.MAX_SPEED * speedMult;
        const targetVx = moveDir * maxSpd;
        const rate = moveDir !== 0 ? PHYSICS.ACCEL : PHYSICS.DECEL;
        hero.vx += (targetVx - hero.vx) * Math.min(1, rate * dt);
        if (moveDir === 0 && Math.abs(hero.vx) < 0.04) {
          hero.vx = 0;
        }
        if (moveDir !== 0) {
          hero.facing = moveDir;
        }
      }

      // 6e. Ground Jump (with Coyote & Pre-Jump buffer — preserves Ground Dash momentum!)
      if (!skipGravityThisTick && hero.preJumpTimer > 0 && (hero.grounded || hero.coyoteTimer > 0)) {
        hero.vy = PHYSICS.JUMP_FORCE;
        hero.jumpHoldTimer = PHYSICS.JUMP_HOLD_TIME;
        hero.grounded = false;
        hero.coyoteTimer = 0;
        hero.preJumpTimer = 0;
        if (hero.groundDashTimer <= 0) {
          hero.action = 'jump';
        }
        hero.scaleX = 0.82;
        hero.scaleY = 1.22;
        skipGravityThisTick = true;
        events.push({ type: 'jump', x: hero.x + hero.width * 0.5, y: hero.y, air: false, form: hero.form });
      }
      // 6f. Midair Double / Triple / Leaf Extra Jump
      // Cancels Air Stomp cleanly, and PRESERVES groundDashTimer / wallDashTimer burst!
      else if (
        !skipGravityThisTick &&
        hero.preJumpTimer > 0 &&
        !hero.grounded &&
        hero.coyoteTimer <= 0 &&
        hero.jumpsRemaining > 0
      ) {
        hero.vy = PHYSICS.DOUBLE_JUMP_FORCE;
        hero.jumpsRemaining -= 1;
        if (hero.form === 'krunk_basic' && hero.jumpsRemaining === 0 && hero.maxAirJumps > 1) {
          hero.abilityUsedInAir = true; // Consumes TripleJump so Basic Dash cannot grant a 4th jump
        }
        hero.jumpHoldTimer = 0;
        hero.wallJumpHoldTimer = 0;
        hero.wallJumpTimer = 0;
        hero.preJumpTimer = 0;
        if (hero.action === 'air_stomp') {
          hero.tongueKind = 'none';
          hero.tongueTimer = 0;
          applyGravity = true;
        }
        // Preserve groundDashTimer & wallDashTimer for authentic jump-cancelled dash bursts!
        if (hero.groundDashTimer <= 0 && hero.wallDashTimer <= 0) {
          hero.action = 'flip';
        }
        hero.scaleX = 0.84;
        hero.scaleY = 1.2;
        skipGravityThisTick = true;
        events.push({ type: 'jump', x: hero.x + hero.width * 0.5, y: hero.y, air: true, form: hero.form });
      }

      // 6g. Quadratic Variable Jump Hold (vy = 10.0 + 8.0 * rem^2 over 0.20s)
      if (!skipGravityThisTick && hero.jumpHoldTimer > 0) {
        if (input.jumpHeld) {
          hero.jumpHoldTimer = Math.max(0, hero.jumpHoldTimer - dt);
          const rem = hero.jumpHoldTimer;
          hero.vy = PHYSICS.JUMP_FORCE + PHYSICS.JUMP_HOLD_BOOST * rem * rem;
          skipGravityThisTick = true;
        } else {
          hero.jumpHoldTimer = 0;
        }
      }

      // 6h. Quadratic Wall Jump Hold (vy = 10.0 + 15.0 * rem^2 over 0.20s)
      if (!skipGravityThisTick && hero.wallJumpHoldTimer > 0) {
        if (input.jumpHeld) {
          hero.wallJumpHoldTimer = Math.max(0, hero.wallJumpHoldTimer - dt);
          const rem = hero.wallJumpHoldTimer;
          hero.vy = PHYSICS.JUMP_FORCE + PHYSICS.WALL_JUMP_HOLD_BOOST * rem * rem;
          skipGravityThisTick = true;
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

    const fallCap = hero.inQuicksand
      ? SIM_RULES.QUICKSAND_MAX_FALL
      : PHYSICS.MAX_FALL_SPEED * (hero.inAntigrav ? SIM_RULES.ANTIGRAV_GRAVITY_SCALE : 1.0);
    if (hero.vy < -fallCap) {
      hero.vy = -fallCap;
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
    if (hero.action === 'fire_dash') {
      hero.action = hero.grounded ? 'idle' : 'fall';
      hero.abilityTimer = 0;
      hero.fireImmunityTimer = Math.max(hero.fireImmunityTimer, SIM_RULES.FIRE_DASH_IMMUNITY_DUR);
    } else if (hero.action === 'volt_dive' || hero.action === 'volt_blink' || hero.action === 'shadow_blink') {
      hero.action = hero.grounded ? 'idle' : 'fall';
      hero.abilityTimer = 0;
      hero.voltTargetId = null;
    } else if (hero.groundDashTimer > 0 || hero.wallDashTimer > 0) {
      hero.groundDashTimer = 0;
      hero.wallDashTimer = 0;
      if (hero.action === 'ground_dash' || hero.action === 'wall_dash') {
        hero.action = hero.grounded ? 'idle' : 'fall';
      }
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
    hero.wallSlideCoyoteTimer = 0;
    hero.wallSalivaActive = false;
    hero.action = 'flip';
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
    hero.wallSlideCoyoteTimer = 0;
    hero.wallSlideDir = 0;
    hero.wallSalivaActive = false;
    hero.jumpHoldTimer = 0;
    hero.wallJumpHoldTimer = 0;
    hero.wallDashTimer = 0;
    hero.voltTargetId = null;

    if (heavy) {
      const cx = hero.x + hero.width * 0.5;
      const isStompFlame = hero.form === 'krunk_fire' && getUpgradeLevel(state, 'StompFlame') > 0;
      const isShadow = hero.form === 'krunk_shadow';

      // Keep active tongue-slam landing FX visible for 0.16s after impact
      hero.tongueKind = 'air_stomp';
      hero.tongueTimer = 0.16;
      hero.tongueDuration = 0.16;
      hero.tongueOriginX = cx;
      hero.tongueOriginY = hero.y;
      hero.tongueDirX = 0;
      hero.tongueDirY = -1;

      const smashedFloor = smashFloorUnderHero(state, room, events, output.explosions);

      events.push({ type: 'stomp_impact', x: cx, y: hero.y, explosive: isStompFlame || isShadow });
      events.push({ type: 'land', x: cx, y: hero.y, heavy: true });
      triggerCameraShake(state, isStompFlame || isShadow ? 0.14 : SIM_RULES.CAM_SHAKE_STRENGTH);
      hero.scaleX = 1.35;
      hero.scaleY = 0.65;

      if (isStompFlame) {
        output.stompFlameTriggered = true;
        spawnFireStompWaves(state);
        output.explosions.push({ x: cx, y: hero.y + 0.3, radius: SIM_RULES.STOMP_FLAME_RADIUS });
        breakTilesInRadius(state, room, cx, hero.y + 0.3, SIM_RULES.STOMP_FLAME_RADIUS, events, output.explosions);
      }
      if (isShadow) {
        spawnShadowShockwaves(state);
      }

      if (smashedFloor) {
        // BrakeBoxJump bounce off smashed breakable/button!
        hero.vy = PHYSICS.ENEMY_JUMP_FORCE;
        hero.grounded = false;
        hero.action = 'flip';
      } else {
        hero.action = Math.abs(hero.vx) > 0.2 ? 'run' : 'idle';
      }
    } else {
      hero.scaleX = 1.18;
      hero.scaleY = 0.84;
      events.push({ type: 'land', x: hero.x + hero.width * 0.5, y: hero.y, heavy: false });

      // Buffered pre-jump or pre-dash fires crisply on landing!
      if (hero.action !== 'hurt') {
        if (hero.groundDashTimer > 0) {
          hero.action = 'ground_dash';
        } else {
          hero.action = Math.abs(hero.vx) > 0.2 ? 'run' : 'idle';
        }
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
  } else if ((hero.action === 'jump' || hero.action === 'ground_stomp') && hero.vy < 0) {
    hero.action = 'fall';
  } else if (hero.action === 'flip' && hero.vy < -2.0) {
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
