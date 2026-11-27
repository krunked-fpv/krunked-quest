import {
  type EnemyArchetypeDef,
  type EnemyArchetypeId,
  type EnemyRuntime,
  type InputFrame,
  type IWorldCatalog,
  type ProjectileRuntime,
  type RoomDef,
  type SimEvent,
  type SimState,
} from '../contracts/index';
import {
  aabbOverlap,
  breakTilesInRadius,
  getTileAt,
  isSolidTile,
  isTileSolidOrOneWayAt,
  type BlastCircle,
} from './collision';
import { registerComboEnemyHit } from './combo';
import {
  FORM_PARAMS,
  PHYSICS,
  SIM_RULES,
  getUpgradeLevel,
  hasRelic,
} from './constants';
import { computeEnemyBounceVy, damageHero } from './physics';
import { nextRange } from './prng';

const FALLBACK_ENEMY_DEF: EnemyArchetypeDef = {
  id: 'goomba',
  name: 'Bramble Stomper',
  hp: 1,
  width: 0.85,
  height: 0.85,
  speed: 2.2,
  flying: false,
  armoredTop: false,
  shoots: false,
  shootCooldown: 2.5,
  crystalValue: 15,
  primaryColor: '#d95763',
  accentColor: '#fbf236',
};

export function getEnemyDef(catalog: IWorldCatalog, id: EnemyArchetypeId): EnemyArchetypeDef {
  return catalog.enemies.get(id) ?? FALLBACK_ENEMY_DEF;
}

export function spawnCrystalDrops(
  state: SimState,
  x: number,
  y: number,
  totalValue: number,
  count = 2,
): void {
  const perDrop = Math.max(1, Math.round(totalValue / Math.max(1, count)));
  for (let i = 0; i < count; i++) {
    state.crystals.push({
      id: `drop_${state.tick}_${state.nextProjectileId++}`,
      x,
      y,
      vx: nextRange(state, -3.2, 3.2),
      vy: nextRange(state, 4.5, 8.0),
      value: perDrop,
      collected: false,
      ttl: 12.0,
    });
  }
}

export function awardCrystals(state: SimState, rawAmount: number): number {
  let mult = 1.0;
  if (state.hero.form === 'krunk_basic' && getUpgradeLevel(state, 'CrystallineHunger') > 0) {
    mult *= SIM_RULES.CRYSTALLINE_HUNGER_MULT;
  }
  if (hasRelic(state, 'crystal_abundance')) {
    mult *= SIM_RULES.CRYSTAL_ABUNDANCE_MULT;
  }
  if (state.combo.count > 0 && hasRelic(state, 'platinum_medal')) {
    mult *= SIM_RULES.PLATINUM_MEDAL_CRYSTAL_MULT;
  }
  const finalAmount = Math.max(1, Math.round(rawAmount * mult));
  state.progress.crystals += finalAmount;
  return finalAmount;
}

export function applyHeroAttackBounce(
  state: SimState,
  isStomp: boolean,
  isFireDash: boolean,
  isVoltBlink: boolean,
  input: InputFrame,
): void {
  const hero = state.hero;
  hero.jumpsRemaining = hero.maxAirJumps;
  hero.abilityUsedInAir = false;

  if (hasRelic(state, 'old_clock')) {
    state.slowmoTimer = Math.max(state.slowmoTimer, SIM_RULES.OLD_CLOCK_SLOWMO_DUR);
    state.slowmoScale = SIM_RULES.OLD_CLOCK_SLOWMO_SCALE;
  }

  if (isFireDash) {
    // Flame Rocket Dash kills enemy, extends dash timer (+0.40s chain!) & refreshes air ability + jumps
    hero.abilityTimer = 0;
    hero.lastEnemyHitTimer = 0;
    return;
  }

  if (hero.action === 'rock_uppercut') {
    // Stone Uppercut extends rise window & refreshes air jumps on enemy hit
    hero.abilityTimer = 0;
    hero.lastEnemyHitTimer = 0;
    return;
  }

  if (isVoltBlink) {
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
    hero.voltTargetId = null;
    hero.action = 'flip';
    hero.abilityTimer = 0;
    hero.lastEnemyHitTimer = 0;
    if (getUpgradeLevel(state, 'VoltShield') > 0) {
      hero.invulnTimer = Math.max(hero.invulnTimer, FORM_PARAMS.VOLT_SHIELD_DUR);
    }
    return;
  }

  // Retroactive super-bounce forgiveness: ONLY set on normal non-stomp head bounces (0.05s / 0.10s Elec+Shadow)
  if (!isStomp) {
    hero.lastEnemyHitTimer =
      hero.form === 'krunk_electric' || hero.form === 'krunk_shadow'
        ? SIM_RULES.LAST_ENEMY_HIT_EXTENDED
        : PHYSICS.LAST_ENEMY_HIT_TIMER;
  } else {
    hero.lastEnemyHitTimer = 0;
  }

  hero.vy = computeEnemyBounceVy(state, isStomp);
  hero.grounded = false;
  hero.jumpHoldTimer = 0;
  hero.wallJumpHoldTimer = 0;
  hero.stompDelayTimer = 0;
  hero.groundDashTimer = 0;
  hero.wallDashTimer = 0;
  if (isStomp) {
    hero.tongueKind = 'air_stomp';
    hero.tongueTimer = 0.12;
    hero.tongueDuration = 0.12;
    hero.tongueOriginX = hero.x + hero.width * 0.5;
    hero.tongueOriginY = hero.y;
    hero.tongueDirX = 0;
    hero.tongueDirY = -1;
  }
  hero.action = 'flip';
  hero.scaleX = 0.8;
  hero.scaleY = 1.28;
}

function spawnEnemyProjectile(
  state: SimState,
  kind: ProjectileRuntime['kind'],
  x: number,
  y: number,
  vx: number,
  vy: number,
  radius: number,
  ttl: number,
  homing = false,
): void {
  state.projectiles.push({
    id: state.nextProjectileId++,
    fromHero: false,
    kind,
    x,
    y,
    prevX: x,
    prevY: y,
    vx,
    vy,
    radius,
    ttl,
    homing,
  });
}

function splitBigJelly(
  state: SimState,
  parent: EnemyRuntime,
  catalog: IWorldCatalog,
  room: RoomDef,
): void {
  const miniDef = getEnemyDef(catalog, 'mini_jelly');
  const cx = parent.x + parent.width * 0.5;
  const cy = parent.y + parent.height * 0.5;
  const minX = Math.max(1.0, parent.patrolMinX - 1.5);
  const maxX = Math.min(room.widthTiles - 1.0 - miniDef.width, parent.patrolMaxX + 1.5);
  const spawnY = Math.max(1.2, Math.min(room.heightTiles - 1.5 - miniDef.height, cy));

  const offsets: readonly [-1 | 1, number][] = [
    [-1, Math.max(1.0, cx - miniDef.width - 0.15)],
    [1, Math.min(room.widthTiles - 1.0 - miniDef.width, cx + 0.15)],
  ];

  for (let i = 0; i < offsets.length; i++) {
    const [dir, sx] = offsets[i];
    state.enemies.push({
      id: `${parent.id}_split_${i}`,
      archetype: 'mini_jelly',
      x: sx,
      y: spawnY,
      prevX: sx,
      prevY: spawnY,
      vx: dir * 3.2,
      vy: 3.0,
      width: miniDef.width,
      height: miniDef.height,
      facing: dir,
      hp: miniDef.hp,
      maxHp: miniDef.hp,
      alive: true,
      patrolMinX: minX,
      patrolMaxX: Math.max(minX + 1.0, maxX),
      aiTimer: i * 1.1,
      shootTimer: 99,
      hitFlashTimer: 0.12,
      stunTimer: 0.24,
      grounded: false,
    });
  }

  // Room combo now includes the 2 spawned mini jellies
  if (state.combo.maxSceneCombo > 0) {
    state.combo.maxSceneCombo += 2;
  }
}

export function damageEnemy(
  state: SimState,
  enemy: EnemyRuntime,
  damage: number,
  catalog: IWorldCatalog,
  room: RoomDef,
  events: SimEvent[],
): boolean {
  if (!enemy.alive || damage <= 0) return false;
  enemy.hp -= damage;
  enemy.hitFlashTimer = 0.16;
  enemy.stunTimer = 0.2;
  const cx = enemy.x + enemy.width * 0.5;
  const cy = enemy.y + enemy.height * 0.5;

  const killed = enemy.hp <= 0;
  if (killed) {
    enemy.alive = false;
    enemy.hp = 0;
    const def = getEnemyDef(catalog, enemy.archetype);

    // Crystal payout with combo scaling
    const comboScale = 1.0 + Math.min(1.5, state.combo.count * 0.1);
    const totalValue = Math.max(1, Math.round(def.crystalValue * comboScale));
    spawnCrystalDrops(state, cx, cy, totalValue, 2);

    // Big Jelly splits into 2 Mini Jellies on death!
    if (enemy.archetype === 'big_jelly') {
      splitBigJelly(state, enemy, catalog, room);
    }

    // Bombalon pops safely with visual explosion when killed by hero
    if (enemy.archetype === 'bombalon') {
      events.push({ type: 'block_break', x: cx, y: cy, explosive: true });
      state.camera.shakeTimer = Math.max(state.camera.shakeTimer, 0.14);
      state.camera.shakeIntensity = Math.max(state.camera.shakeIntensity, 0.16);
    }

    if (state.ghostShip.active) {
      state.ghostShip.score += 50 * Math.max(1, state.combo.count + 1);
      if (state.ghostShip.score > state.ghostShip.highScore) {
        state.ghostShip.highScore = state.ghostShip.score;
        state.progress.ghostShipHighScore = state.ghostShip.score;
      }
    }
  }

  registerComboEnemyHit(state, cx, cy, killed, events);
  events.push({ type: 'enemy_hit', x: cx, y: cy, killed, combo: state.combo.count });
  state.hitstopTicks = Math.max(state.hitstopTicks, killed ? 3 : 2);
  return killed;
}

// ============================================================================
// Ground & Flight Movement Helpers (Deterministic, Tile-Safe)
// ============================================================================

function stepGroundEnemy(
  state: SimState,
  room: RoomDef,
  e: EnemyRuntime,
  dt: number,
  options: {
    stopAtLedge?: boolean;
    respectPatrol?: boolean;
    gravityScale?: number;
    bounceRestitution?: number;
  } = {},
): { hitWall: boolean; hitLedge: boolean; landed: boolean } {
  const stopAtLedge = options.stopAtLedge ?? true;
  const respectPatrol = options.respectPatrol ?? true;
  const gravityScale = options.gravityScale ?? 0.5;
  const bounceRestitution = options.bounceRestitution ?? 0;

  let hitWall = false;
  let hitLedge = false;
  let landed = false;

  const nextX = e.x + e.vx * dt;
  const dir = e.vx !== 0 ? (e.vx > 0 ? 1 : -1) : e.facing;
  const leadTx = dir > 0 ? Math.floor(nextX + e.width) : Math.floor(nextX);
  const bodyTy = Math.floor(e.y + 0.15);
  const headTy = Math.floor(e.y + Math.max(0.2, e.height - 0.1));
  const floorTy = Math.floor(e.y - 0.1);

  const wallAhead =
    leadTx < 0 ||
    leadTx >= room.widthTiles ||
    isSolidTile(getTileAt(state.roomTiles, room.widthTiles, room.heightTiles, leadTx, bodyTy)) ||
    isSolidTile(getTileAt(state.roomTiles, room.widthTiles, room.heightTiles, leadTx, headTy));

  const hasFloorAhead = isTileSolidOrOneWayAt(
    state.roomTiles,
    room.widthTiles,
    room.heightTiles,
    leadTx,
    floorTy,
  );

  const outOfPatrol = respectPatrol && (nextX < e.patrolMinX || nextX > e.patrolMaxX);

  if (wallAhead || outOfPatrol) {
    hitWall = true;
    e.facing = (dir * -1) as -1 | 1;
    e.vx = -e.vx;
  } else if (stopAtLedge && e.grounded && !hasFloorAhead) {
    hitLedge = true;
    e.facing = (dir * -1) as -1 | 1;
    e.vx = -e.vx;
  } else {
    e.x = Math.max(0.5, Math.min(room.widthTiles - 0.5 - e.width, nextX));
  }

  // Gravity & vertical floor/ceiling landing
  const prevGrounded = e.grounded;
  e.vy = Math.max(-14, e.vy + PHYSICS.G_EFF * gravityScale * dt);
  const nextY = e.y + e.vy * dt;
  const midTx = Math.floor(e.x + e.width * 0.5);

  if (e.vy > 0) {
    const ceilTy = Math.floor(nextY + e.height);
    if (isSolidTile(getTileAt(state.roomTiles, room.widthTiles, room.heightTiles, midTx, ceilTy))) {
      e.y = ceilTy - e.height;
      e.vy = 0;
    } else {
      e.y = Math.min(room.heightTiles - 1.0 - e.height, nextY);
    }
    e.grounded = false;
  } else {
    const footTy = Math.floor(nextY);
    if (isTileSolidOrOneWayAt(state.roomTiles, room.widthTiles, room.heightTiles, midTx, footTy)) {
      e.y = footTy + 1;
      if (bounceRestitution > 0 && Math.abs(e.vy) > 1.5) {
        e.vy = Math.abs(e.vy) * bounceRestitution;
        e.grounded = false;
      } else {
        e.vy = 0;
        e.grounded = true;
      }
      landed = !prevGrounded;
    } else {
      e.y = Math.max(0.5, nextY);
      e.grounded = false;
    }
  }

  return { hitWall, hitLedge, landed };
}

function stepFlyingEnemy(
  state: SimState,
  room: RoomDef,
  e: EnemyRuntime,
  dt: number,
  respectPatrol = true,
): { hitWall: boolean; hitVert: boolean } {
  let hitWall = false;
  let hitVert = false;

  const nextX = e.x + e.vx * dt;
  const dir = e.vx >= 0 ? 1 : -1;
  const probeTx = dir > 0 ? Math.floor(nextX + e.width) : Math.floor(nextX);
  const midTy = Math.floor(e.y + e.height * 0.5);
  const wallHit =
    probeTx < 1 ||
    probeTx >= room.widthTiles - 1 ||
    isSolidTile(getTileAt(state.roomTiles, room.widthTiles, room.heightTiles, probeTx, midTy));

  if (wallHit) {
    hitWall = true;
    e.facing = (dir * -1) as -1 | 1;
    e.vx = -e.vx;
  } else if (respectPatrol && nextX <= e.patrolMinX) {
    e.x = e.patrolMinX;
    e.facing = 1;
    hitWall = true;
  } else if (respectPatrol && nextX >= e.patrolMaxX) {
    e.x = e.patrolMaxX;
    e.facing = -1;
    hitWall = true;
  } else {
    e.x = Math.max(1.0, Math.min(room.widthTiles - 1.0 - e.width, nextX));
  }

  const nextY = e.y + e.vy * dt;
  const midTx = Math.floor(e.x + e.width * 0.5);
  const vTy = e.vy >= 0 ? Math.floor(nextY + e.height) : Math.floor(nextY);
  const vertHit =
    nextY < 1.1 ||
    nextY + e.height > room.heightTiles - 1.1 ||
    isSolidTile(getTileAt(state.roomTiles, room.widthTiles, room.heightTiles, midTx, vTy));

  if (vertHit) {
    hitVert = true;
    e.vy = -e.vy * 0.5;
  } else {
    e.y = nextY;
  }
  e.grounded = false;

  return { hitWall, hitVert };
}

// ============================================================================
// Bespoke Deterministic AI for ALL 34 EnemyArchetypeIds
// ============================================================================

function stepSingleEnemyAI(
  state: SimState,
  room: RoomDef,
  e: EnemyRuntime,
  def: EnemyArchetypeDef,
  hx: number,
  hy: number,
  dt: number,
  explosions: BlastCircle[],
  events: SimEvent[],
): void {
  const ex = e.x + e.width * 0.5;
  const ey = e.y + e.height * 0.5;
  const dx = hx - ex;
  const dy = hy - ey;
  const dist = Math.hypot(dx, dy);
  const toHeroDir: -1 | 1 = dx >= 0 ? 1 : -1;

  switch (e.archetype) {
    // ------------------------------------------------------------------
    // A. Ground Patrollers & Chargers (7)
    // ------------------------------------------------------------------
    case 'goomba': {
      e.vx = e.facing * def.speed;
      stepGroundEnemy(state, room, e, dt);
      break;
    }

    case 'horned_beetle': {
      // Armored patroller with telegraphed horizontal lunge when hero is on same level
      if (e.shootTimer > 10) e.shootTimer = 0.6;
      if (e.shootTimer > 0) e.shootTimer = Math.max(0, e.shootTimer - dt);

      const sameLevel = Math.abs(dy) < 1.5 && Math.abs(dx) > 0.7 && Math.abs(dx) < 5.5;
      if (e.shootTimer === 0 && sameLevel) {
        e.facing = toHeroDir;
        e.shootTimer = 2.1; // First 0.55s = active lunge (timer in 1.55..2.1), rest = cooldown
      }

      const lunging = e.shootTimer > 1.55;
      e.vx = e.facing * def.speed * (lunging ? 2.1 : 1.0);
      stepGroundEnemy(state, room, e, dt);
      break;
    }

    case 'mushroom_warrior': {
      // Shield rush cadence: steady patrol -> aggressive shield rush -> brief recovery
      const cycle = e.aiTimer % 2.4;
      if (Math.abs(dx) < 6.5 && Math.abs(dy) < 2.0 && cycle < 0.2) {
        e.facing = toHeroDir;
      }
      const mult = cycle < 0.65 && Math.abs(dx) < 7.0 ? 1.85 : cycle < 1.1 ? 0.4 : 1.0;
      e.vx = e.facing * def.speed * mult;
      stepGroundEnemy(state, room, e, dt);
      break;
    }

    case 'mummy': {
      // Relentless march toward hero when in range
      if (Math.abs(dx) < 8.5 && Math.abs(dx) > 0.35) {
        e.facing = toHeroDir;
      }
      const mult = Math.abs(dx) < 3.5 ? 1.25 : 1.0;
      e.vx = e.facing * def.speed * mult;
      stepGroundEnemy(state, room, e, dt, { stopAtLedge: true, respectPatrol: true });
      break;
    }

    case 'scavenger': {
      // Darting thief: burst sprints + nimble repositioning hops
      const phase = e.aiTimer % 1.8;
      if (phase < 0.75) {
        if (Math.abs(dx) < 7.5 && Math.abs(dx) > 0.5) {
          e.facing = toHeroDir;
        }
        e.vx = e.facing * def.speed * 1.55;
      } else if (phase < 1.05) {
        e.vx = e.facing * def.speed * 0.35;
        if (e.grounded && Math.abs(dx) < 4.5) {
          e.vy = 5.4;
          e.grounded = false;
        }
      } else {
        e.vx = e.facing * def.speed * 0.9;
      }
      stepGroundEnemy(state, room, e, dt, { stopAtLedge: true });
      break;
    }

    case 'spike_turtle': {
      // Armored shell slide: slow walk -> rapid ricocheting shell slide
      const cycle = e.aiTimer % 3.2;
      const sliding = cycle >= 1.6 && cycle < 2.8;
      if (cycle >= 1.55 && cycle < 1.65 && Math.abs(dx) < 7.5) {
        e.facing = toHeroDir;
      }
      e.vx = e.facing * def.speed * (sliding ? 2.45 : 0.75);
      stepGroundEnemy(state, room, e, dt, { stopAtLedge: !sliding });
      break;
    }

    case 'puncher_pig': {
      // Melee brawler: patrols -> brief windup -> fierce melee dash with mini-hop
      if (e.shootTimer > 10) e.shootTimer = 0.5;
      if (e.shootTimer > 0) e.shootTimer = Math.max(0, e.shootTimer - dt);

      if (e.shootTimer === 0 && Math.abs(dx) < 5.5 && Math.abs(dy) < 1.8) {
        e.facing = toHeroDir;
        e.shootTimer = 2.1; // 1.85..2.1 windup, 1.4..1.85 dash, 0..1.4 cooldown
      }

      if (e.shootTimer > 1.85) {
        e.vx = 0; // windup telegraph
      } else if (e.shootTimer > 1.4) {
        e.vx = e.facing * def.speed * 2.25;
        if (e.grounded && e.shootTimer > 1.78) {
          e.vy = 2.8;
          e.grounded = false;
        }
      } else {
        e.vx = e.facing * def.speed;
      }
      stepGroundEnemy(state, room, e, dt);
      break;
    }

    // ------------------------------------------------------------------
    // B. Flyers & Swoopers (9)
    // ------------------------------------------------------------------
    case 'air_goomba': {
      e.vx = e.facing * def.speed;
      e.vy = Math.sin(e.aiTimer * 3.2) * 1.35;
      stepFlyingEnemy(state, room, e, dt, true);
      break;
    }

    case 'guilhofly': {
      // Figure-8 dive swooper
      const diveCycle = e.aiTimer % 3.0;
      if (diveCycle > 2.0 && dist < 6.5 && dy < 0.5) {
        e.facing = toHeroDir;
        e.vx = toHeroDir * def.speed * 1.3;
        e.vy = diveCycle < 2.5 ? -3.8 : 3.6;
      } else {
        e.vx = Math.cos(e.aiTimer * 2.2) * def.speed;
        e.vy = Math.sin(e.aiTimer * 4.4) * 1.85;
        if (Math.abs(e.vx) > 0.2) {
          e.facing = e.vx > 0 ? 1 : -1;
        }
      }
      stepFlyingEnemy(state, room, e, dt, true);
      break;
    }

    case 'bee': {
      // Hero-tracking swarm hornet
      if (dist <= 8.5 && dist > 0.25) {
        e.facing = toHeroDir;
        const targetVx = (dx / dist) * def.speed;
        const targetVy = (dy / dist) * def.speed + Math.sin(e.aiTimer * 14.0) * 0.55;
        e.vx += (targetVx - e.vx) * Math.min(1, 6.0 * dt);
        e.vy += (targetVy - e.vy) * Math.min(1, 6.0 * dt);
        stepFlyingEnemy(state, room, e, dt, false);
      } else {
        e.vx = e.facing * def.speed * 0.85;
        e.vy = Math.sin(e.aiTimer * 5.0) * 1.1;
        stepFlyingEnemy(state, room, e, dt, true);
      }
      break;
    }

    case 'ladybug': {
      // Sine-float flutter hopper (bobs smoothly along sine wave above floor)
      e.vx = e.facing * def.speed;
      e.vy = Math.sin(e.aiTimer * 4.2) * 1.9;
      stepFlyingEnemy(state, room, e, dt, true);
      break;
    }

    case 'vulture': {
      // High-altitude swoop: cruises high, dives fast when hero passes below, pulls up
      if (e.shootTimer > 10) e.shootTimer = 0.6;
      if (e.shootTimer > 0) e.shootTimer = Math.max(0, e.shootTimer - dt);

      if (e.shootTimer === 0 && dist < 8.0 && dy < -0.8) {
        e.facing = toHeroDir;
        e.shootTimer = 2.6; // 1.9..2.6 dive, 1.2..1.9 pullup, 0..1.2 cruise
      }

      if (e.shootTimer > 1.9) {
        e.vx = e.facing * def.speed * 1.45;
        e.vy = -5.2;
      } else if (e.shootTimer > 1.2) {
        e.vx = e.facing * def.speed * 1.15;
        e.vy = 4.2;
      } else {
        e.vx = e.facing * def.speed;
        e.vy = Math.sin(e.aiTimer * 2.4) * 0.65;
      }
      stepFlyingEnemy(state, room, e, dt, e.shootTimer <= 1.2);
      break;
    }

    case 'zeppelin': {
      // Heavy aerial bomb dropper
      e.vx = e.facing * def.speed;
      e.vy = Math.sin(e.aiTimer * 1.6) * 0.5;
      stepFlyingEnemy(state, room, e, dt, true);

      e.shootTimer -= dt;
      if (e.shootTimer <= 0) {
        if (dist <= 11.0) {
          e.shootTimer = def.shootCooldown || 2.4;
          spawnEnemyProjectile(
            state,
            'fireball',
            ex,
            e.y - 0.15,
            e.facing * 1.3,
            -1.2,
            0.3, // radius >= 0.25 -> gravity bomb arc
            2.8,
          );
        } else {
          e.shootTimer = 0.5;
        }
      }
      break;
    }

    case 'ghost_crow': {
      // Fast spectral wave swooper
      if (dist < 9.0 && Math.abs(dx) > 0.6) {
        e.facing = toHeroDir;
      }
      e.vx = e.facing * def.speed;
      e.vy = Math.sin(e.aiTimer * 4.8) * 2.4;
      stepFlyingEnemy(state, room, e, dt, false);
      break;
    }

    case 'ghost_owl': {
      // Spectral wave swooper + aimed dark orb caster
      if (dist < 10.0) {
        e.facing = toHeroDir;
      }
      const desiredXSpeed = Math.abs(dx) < 3.0 ? -toHeroDir * def.speed * 0.6 : e.facing * def.speed * 0.85;
      e.vx += (desiredXSpeed - e.vx) * Math.min(1, 3.5 * dt);
      e.vy = Math.cos(e.aiTimer * 2.6) * 1.7;
      stepFlyingEnemy(state, room, e, dt, false);

      e.shootTimer -= dt;
      if (e.shootTimer <= 0) {
        if (dist <= 11.5 && dist > 0.5) {
          e.shootTimer = def.shootCooldown || 2.1;
          const spd = 6.8;
          spawnEnemyProjectile(
            state,
            'dark_orb',
            ex,
            ey,
            (dx / dist) * spd,
            (dy / dist) * spd,
            0.24,
            2.8,
          );
        } else {
          e.shootTimer = 0.5;
        }
      }
      break;
    }

    case 'ghost_pig': {
      // Armored spectral wave swooper
      if (dist < 9.5 && Math.abs(dx) > 0.5) {
        e.facing = toHeroDir;
      }
      const swoopBoost = Math.sin(e.aiTimer * 2.2) > 0.5 ? 1.35 : 0.9;
      e.vx = e.facing * def.speed * swoopBoost;
      e.vy = Math.sin(e.aiTimer * 3.1) * 1.65;
      stepFlyingEnemy(state, room, e, dt, false);
      break;
    }

    // ------------------------------------------------------------------
    // C. Ranged & Ambushers (9)
    // ------------------------------------------------------------------
    case 'spitter': {
      e.vx = e.facing * def.speed;
      stepGroundEnemy(state, room, e, dt);

      e.shootTimer -= dt;
      if (e.shootTimer <= 0) {
        if (dist <= 11.0 && dist > 0.5) {
          e.shootTimer = def.shootCooldown || 2.4;
          e.facing = toHeroDir;
          const speed = 6.5;
          spawnEnemyProjectile(
            state,
            'spit',
            ex,
            ey,
            (dx / dist) * speed,
            (dy / dist) * speed,
            0.22,
            2.5,
          );
        } else {
          e.shootTimer = 0.5;
        }
      }
      break;
    }

    case 'carnivorous_plant': {
      // Ambush lunge when hero is close + aimed spit at mid-range
      if (dist < 2.7 && Math.abs(dy) < 2.2) {
        e.facing = toHeroDir;
        e.vx = toHeroDir * 4.5;
        if (e.grounded) {
          e.vy = 3.8;
          e.grounded = false;
        }
      } else {
        e.vx = e.facing * def.speed;
      }
      stepGroundEnemy(state, room, e, dt);

      e.shootTimer -= dt;
      if (e.shootTimer <= 0) {
        if (dist <= 11.0 && dist > 0.5) {
          e.shootTimer = def.shootCooldown || 2.6;
          e.facing = toHeroDir;
          const speed = 6.8;
          spawnEnemyProjectile(
            state,
            'spit',
            ex,
            ey + 0.15,
            (dx / dist) * speed,
            (dy / dist) * speed,
            0.22,
            2.5,
          );
        } else {
          e.shootTimer = 0.5;
        }
      }
      break;
    }

    case 'toxic_slug': {
      // Slow floor creeper that lobs arching acid globs
      if (e.shootTimer > 10) e.shootTimer = 1.4;
      e.vx = e.facing * def.speed;
      stepGroundEnemy(state, room, e, dt);

      e.shootTimer -= dt;
      if (e.shootTimer <= 0) {
        if (dist <= 9.5 && dist > 0.5) {
          e.shootTimer = 2.6;
          e.facing = toHeroDir;
          const lobVx = Math.max(-6.0, Math.min(6.0, dx * 0.9));
          spawnEnemyProjectile(
            state,
            'spit',
            ex,
            ey + 0.25,
            lobVx,
            5.8,
            0.24, // radius === 0.24 -> ballistic lobbed acid arc
            2.6,
          );
        } else {
          e.shootTimer = 0.6;
        }
      }
      break;
    }

    case 'launcher_pig': {
      // Ground mortar boar firing high-arc fireball shells
      e.vx = e.facing * def.speed;
      stepGroundEnemy(state, room, e, dt);

      e.shootTimer -= dt;
      if (e.shootTimer <= 0) {
        if (dist <= 12.0 && dist > 0.6) {
          e.shootTimer = def.shootCooldown || 2.3;
          e.facing = toHeroDir;
          const arcVx = Math.max(-7.0, Math.min(7.0, dx * 0.85));
          spawnEnemyProjectile(
            state,
            'fireball',
            ex,
            ey + 0.35,
            arcVx,
            7.2,
            0.26, // radius >= 0.25 -> gravity mortar arc
            3.0,
          );
        } else {
          e.shootTimer = 0.5;
        }
      }
      break;
    }

    case 'eagle_cannon': {
      // High-precision aerial sniper firing fast aimed plasma bolts
      e.vx = e.facing * def.speed;
      e.vy = Math.sin(e.aiTimer * 2.2) * 0.8;
      stepFlyingEnemy(state, room, e, dt, true);

      e.shootTimer -= dt;
      if (e.shootTimer <= 0) {
        if (dist <= 13.5 && dist > 0.5) {
          e.shootTimer = def.shootCooldown || 2.5;
          e.facing = toHeroDir;
          const sniperSpeed = 10.5;
          spawnEnemyProjectile(
            state,
            'plasma',
            ex,
            ey,
            (dx / dist) * sniperSpeed,
            (dy / dist) * sniperSpeed,
            0.22,
            2.4,
          );
        } else {
          e.shootTimer = 0.5;
        }
      }
      break;
    }

    case 'botmerang': {
      // Hovering drone throwing returning boomerang gears
      e.vx = e.facing * def.speed;
      e.vy = Math.sin(e.aiTimer * 3.0) * 1.0;
      stepFlyingEnemy(state, room, e, dt, true);

      e.shootTimer -= dt;
      if (e.shootTimer <= 0) {
        if (dist <= 10.5 && dist > 0.5) {
          e.shootTimer = def.shootCooldown || 2.2;
          e.facing = toHeroDir;
          const spd = 8.6;
          spawnEnemyProjectile(
            state,
            'gear',
            ex,
            ey,
            (dx / dist) * spd,
            (dy / dist) * spd * 0.5,
            0.21, // radius <= 0.22 -> boomerang return curve
            2.4,
          );
        } else {
          e.shootTimer = 0.5;
        }
      }
      break;
    }

    case 'atom_eye': {
      // Reactor orb orbiting smoothly & emitting 4-way radial plasma pulses
      e.vx = Math.cos(e.aiTimer * 2.1) * def.speed;
      e.vy = Math.sin(e.aiTimer * 2.1) * def.speed * 0.7;
      e.facing = e.vx >= 0 ? 1 : -1;
      stepFlyingEnemy(state, room, e, dt, true);

      e.shootTimer -= dt;
      if (e.shootTimer <= 0) {
        if (dist <= 11.5) {
          e.shootTimer = def.shootCooldown || 2.0;
          const baseAng = (e.aiTimer % 4.0) > 2.0 ? Math.PI * 0.25 : 0;
          const spd = 5.8;
          for (let k = 0; k < 4; k++) {
            const ang = baseAng + (k * Math.PI) * 0.5;
            spawnEnemyProjectile(
              state,
              'plasma',
              ex,
              ey,
              Math.cos(ang) * spd,
              Math.sin(ang) * spd,
              0.21,
              2.2,
            );
          }
        } else {
          e.shootTimer = 0.5;
        }
      }
      break;
    }

    case 'fire_lizard': {
      // Fast floor sprinter firing twin straight flame bursts
      e.vx = e.facing * def.speed;
      stepGroundEnemy(state, room, e, dt);

      e.shootTimer -= dt;
      if (e.shootTimer <= 0) {
        if (dist <= 10.0 && dist > 0.5) {
          e.shootTimer = def.shootCooldown || 2.1;
          e.facing = toHeroDir;
          const baseAng = Math.atan2(dy, dx);
          const spd = 7.8;
          for (let k = 0; k < 2; k++) {
            const ang = baseAng + (k === 0 ? -0.09 : 0.09);
            spawnEnemyProjectile(
              state,
              'fireball',
              ex,
              ey,
              Math.cos(ang) * spd,
              Math.sin(ang) * spd,
              0.2, // straight fast flame burst
              2.2,
            );
          }
        } else {
          e.shootTimer = 0.5;
        }
      }
      break;
    }

    case 'salamander': {
      // Wall-patrolling ember newt: climbs nearby walls & spits straight fire
      const probeRight = Math.floor(e.x + e.width + 0.15);
      const probeLeft = Math.floor(e.x - 0.15);
      const bodyTy = Math.floor(e.y + 0.3);
      const wallAdj =
        isSolidTile(getTileAt(state.roomTiles, room.widthTiles, room.heightTiles, probeRight, bodyTy)) ||
        isSolidTile(getTileAt(state.roomTiles, room.widthTiles, room.heightTiles, probeLeft, bodyTy));

      if (wallAdj && Math.sin(e.aiTimer * 2.0) > 0.15) {
        e.vx = 0;
        e.vy = def.speed * 0.85;
        stepFlyingEnemy(state, room, e, dt, false);
      } else {
        e.vx = e.facing * def.speed;
        stepGroundEnemy(state, room, e, dt);
      }

      e.shootTimer -= dt;
      if (e.shootTimer <= 0) {
        if (dist <= 10.5 && dist > 0.5) {
          e.shootTimer = def.shootCooldown || 2.2;
          e.facing = toHeroDir;
          const spd = 7.4;
          spawnEnemyProjectile(
            state,
            'fireball',
            ex,
            ey,
            (dx / dist) * spd,
            (dy / dist) * spd,
            0.2,
            2.3,
          );
        } else {
          e.shootTimer = 0.5;
        }
      }
      break;
    }

    // ------------------------------------------------------------------
    // D. Specialty Physics (9)
    // ------------------------------------------------------------------
    case 'frog': {
      // Rhythmic crouched pause -> strong parabolic leap
      const cycle = e.aiTimer % 1.6;
      if (e.grounded) {
        if (cycle < 0.75) {
          e.vx = 0;
          if (Math.abs(dx) < 8.0) {
            e.facing = toHeroDir;
          }
        } else {
          e.vx = e.facing * def.speed * 1.45;
          e.vy = 9.0;
          e.grounded = false;
        }
      }
      stepGroundEnemy(state, room, e, dt, { stopAtLedge: false, gravityScale: 0.65 });
      break;
    }

    case 'spikeball': {
      // Armored bouncy ricochet pinball
      if (Math.abs(e.vx) < def.speed * 0.5) {
        e.vx = e.facing * def.speed;
      }
      const res = stepGroundEnemy(state, room, e, dt, {
        stopAtLedge: false,
        respectPatrol: true,
        gravityScale: 0.6,
        bounceRestitution: 0.92,
      });
      if (e.grounded || res.landed) {
        e.vy = 6.8;
        e.grounded = false;
      }
      break;
    }

    case 'neural_spider': {
      // Ceiling drop ambush + silk bolt + reel back up
      if (e.shootTimer > 0) e.shootTimer = Math.max(0, e.shootTimer - dt);

      if (e.vy < -2.0) {
        // Active ambush drop
        const res = stepFlyingEnemy(state, room, e, dt, false);
        if (res.hitVert || ey <= hy + 0.5) {
          if (dist <= 10.0 && dist > 0.4) {
            const spd = 6.5;
            spawnEnemyProjectile(
              state,
              'plasma',
              ex,
              ey,
              (dx / dist) * spd,
              (dy / dist) * spd,
              0.2,
              2.2,
            );
          }
          e.vy = 3.5; // Reel back up
        }
      } else if (e.vy > 1.5) {
        // Reeling back to ceiling perch
        e.vx = 0;
        const res = stepFlyingEnemy(state, room, e, dt, false);
        if (res.hitVert || e.y >= room.heightTiles - 2.6) {
          e.vy = 0;
        }
      } else {
        // Patrol near ceiling waiting for ambush
        e.vx = e.facing * def.speed * 0.7;
        e.vy = Math.sin(e.aiTimer * 2.5) * 0.4;
        stepFlyingEnemy(state, room, e, dt, true);

        if (e.shootTimer <= 0 && Math.abs(dx) < 3.0 && dy < -0.5) {
          e.shootTimer = def.shootCooldown || 2.8;
          e.vx = 0;
          e.vy = -9.2;
        }
      }
      break;
    }

    case 'big_jelly': {
      // Pulsing gelatinous float (splits into 2 mini_jelly on death!)
      if (dist < 7.5 && Math.abs(dx) > 0.6) {
        e.facing = toHeroDir;
      }
      e.vx = e.facing * def.speed * (0.7 + 0.45 * Math.abs(Math.sin(e.aiTimer * 2.5)));
      e.vy = Math.sin(e.aiTimer * 2.5) * 1.25;
      stepFlyingEnemy(state, room, e, dt, true);
      break;
    }

    case 'mini_jelly': {
      // Snappy nimble split jelly
      if (dist < 7.0 && dist > 0.3) {
        e.facing = toHeroDir;
        e.vx += ((dx / dist) * def.speed - e.vx) * Math.min(1, 4.5 * dt);
        e.vy = (dy / dist) * def.speed * 0.75 + Math.sin(e.aiTimer * 5.2) * 1.7;
        stepFlyingEnemy(state, room, e, dt, false);
      } else {
        e.vx = e.facing * def.speed;
        e.vy = Math.sin(e.aiTimer * 5.2) * 1.8;
        stepFlyingEnemy(state, room, e, dt, true);
      }
      break;
    }

    case 'bombalon': {
      // Fuse divebomb + explosion
      const fuseLit = e.shootTimer <= 10.0;
      if (!fuseLit) {
        e.vx = e.facing * def.speed;
        e.vy = Math.sin(e.aiTimer * 2.8) * 0.9;
        stepFlyingEnemy(state, room, e, dt, true);
        if (dist <= 5.2 || e.hitFlashTimer > 0) {
          e.shootTimer = 1.25; // Light fuse!
        }
      } else {
        e.shootTimer -= dt;
        e.hitFlashTimer = ((e.aiTimer * 18) | 0) % 2 === 0 ? 0.08 : 0;
        const diveSpeed = def.speed * 1.85;
        if (dist > 0.2) {
          e.facing = toHeroDir;
          e.vx = (dx / dist) * diveSpeed;
          e.vy = (dy / dist) * diveSpeed;
        }
        const res = stepFlyingEnemy(state, room, e, dt, false);
        if (e.shootTimer <= 0 || res.hitWall || res.hitVert) {
          // Detonate!
          e.alive = false;
          e.hp = 0;
          events.push({ type: 'block_break', x: ex, y: ey, explosive: true });
          breakTilesInRadius(state, room, ex, ey, 1.8, events, explosions);
          state.camera.shakeTimer = Math.max(state.camera.shakeTimer, 0.22);
          state.camera.shakeIntensity = Math.max(state.camera.shakeIntensity, 0.24);
          if (dist <= 1.75 && state.hero.action !== 'dead') {
            damageHero(state, 1, ex, events, 'enemy');
          }
        }
      }
      break;
    }

    case 'mystic_wheel': {
      // Fast armored cinder wheel rolling briskly with quick acceleration
      const targetVx = e.facing * def.speed * 1.35;
      e.vx += (targetVx - e.vx) * Math.min(1, 5.5 * dt);
      stepGroundEnemy(state, room, e, dt, { stopAtLedge: true, respectPatrol: true });
      break;
    }

    case 'sand_worm': {
      // Burrow slide along sand -> high-arc erupt lunge!
      const cycle = e.aiTimer % 2.4;
      if (cycle < 1.35) {
        // Burrowing glide toward hero X
        if (Math.abs(dx) < 8.5 && Math.abs(dx) > 0.4) {
          e.facing = toHeroDir;
        }
        e.vx = e.facing * def.speed * 1.3;
        stepGroundEnemy(state, room, e, dt, { stopAtLedge: true, respectPatrol: true });
      } else if (cycle < 1.45 && e.grounded) {
        // Erupt!
        e.facing = toHeroDir;
        e.vy = 8.8;
        e.vx = e.facing * def.speed * 0.9;
        e.grounded = false;
        stepGroundEnemy(state, room, e, dt, { stopAtLedge: false, gravityScale: 0.65 });
      } else {
        stepGroundEnemy(state, room, e, dt, { stopAtLedge: false, gravityScale: 0.65 });
      }
      break;
    }

    case 'floating_sword': {
      // Hover & aim -> telegraph freeze -> blistering lunge!
      const cycle = e.aiTimer % 2.4;
      if (cycle < 1.3) {
        // Hover & align above/beside hero
        e.facing = toHeroDir;
        const aimX = Math.max(e.patrolMinX, Math.min(e.patrolMaxX, hx - toHeroDir * 2.8));
        const aimY = Math.min(room.heightTiles - 2.2, Math.max(2.0, hy + 1.6));
        e.vx = (aimX - e.x) * 2.2;
        e.vy = (aimY - e.y) * 2.2 + Math.sin(e.aiTimer * 4.0) * 0.7;
        stepFlyingEnemy(state, room, e, dt, false);
      } else if (cycle < 1.65) {
        // Telegraph lock
        e.facing = toHeroDir;
        e.vx = -toHeroDir * 0.9;
        e.vy = 0.4;
        if (cycle < 1.38) e.hitFlashTimer = 0.08;
        stepFlyingEnemy(state, room, e, dt, false);
      } else if (cycle < 2.15) {
        // High-speed lunge (lock vector at start of lunge phase)
        if (cycle < 1.72) {
          const lungeSpd = def.speed * 2.4;
          const d = Math.max(0.4, dist);
          e.vx = (dx / d) * lungeSpd;
          e.vy = (dy / d) * lungeSpd;
        }
        stepFlyingEnemy(state, room, e, dt, false);
      } else {
        // Decelerate cleanly
        e.vx *= 0.85;
        e.vy *= 0.85;
        stepFlyingEnemy(state, room, e, dt, false);
      }
      break;
    }

    default: {
      // Exhaustiveness check guaranteeing all 34 EnemyArchetypeIds are implemented
      const _exhaustive: never = e.archetype;
      void _exhaustive;
      break;
    }
  }
}

// ============================================================================
// Main Enemy AI + Stomp-First Hero Combat Step
// ============================================================================

export function updateEnemiesAndCombat(
  state: SimState,
  room: RoomDef,
  catalog: IWorldCatalog,
  input: InputFrame,
  dt: number,
  explosions: BlastCircle[],
  completedVoltTargetId: string | null,
  completedShadowTargetId: string | null,
  groundStompHitbox: { x: number; y: number; w: number; h: number } | null,
  evilRingTriggered: boolean,
  events: SimEvent[],
): void {
  const hero = state.hero;
  const hx = hero.x + hero.width * 0.5;
  const hy = hero.y + hero.height * 0.5;

  // Apply blast / evil ring damage to enemies
  if (evilRingTriggered) {
    explosions.push({ x: hx, y: hy, radius: SIM_RULES.EVIL_RING_RADIUS });
  }

  for (let b = 0; b < explosions.length; b++) {
    const blast = explosions[b];
    const r2 = blast.radius * blast.radius;
    const count = state.enemies.length;
    for (let i = 0; i < count; i++) {
      const e = state.enemies[i];
      if (!e.alive) continue;
      const ex = e.x + e.width * 0.5;
      const ey = e.y + e.height * 0.5;
      if ((ex - blast.x) * (ex - blast.x) + (ey - blast.y) * (ey - blast.y) <= r2) {
        damageEnemy(state, e, SIM_RULES.EVIL_RING_DAMAGE, catalog, room, events);
      }
    }
  }

  // Volt blink target completion hit on enemies
  if (completedVoltTargetId) {
    const count = state.enemies.length;
    for (let i = 0; i < count; i++) {
      const e = state.enemies[i];
      if (e.alive && e.id === completedVoltTargetId) {
        damageEnemy(state, e, 2, catalog, room, events);
      }
    }
  }

  // Shadow vanish-strike target hit on enemies
  if (completedShadowTargetId) {
    const count = state.enemies.length;
    for (let i = 0; i < count; i++) {
      const e = state.enemies[i];
      if (e.alive && e.id === completedShadowTargetId) {
        damageEnemy(state, e, 2, catalog, room, events);
      }
    }
  }

  // Ground Stomp tongue-slam foot hitbox check against ground enemies underfoot
  if (groundStompHitbox) {
    const count = state.enemies.length;
    for (let i = 0; i < count; i++) {
      const e = state.enemies[i];
      if (!e.alive) continue;
      if (
        aabbOverlap(
          groundStompHitbox.x,
          groundStompHitbox.y,
          groundStompHitbox.w,
          groundStompHitbox.h,
          e.x,
          e.y,
          e.width,
          e.height,
        )
      ) {
        damageEnemy(state, e, 2, catalog, room, events);
      }
    }
  }

  const dashRoundFireActive =
    hero.form === 'krunk_fire' &&
    getUpgradeLevel(state, 'DashRoundFire') > 0 &&
    (hero.action === 'fire_dash' || hero.action === 'ground_dash' || hero.action === 'wall_dash');

  // Snapshot initial count so split mini_jellies born this tick get 1-frame grace
  const activeCount = state.enemies.length;

  for (let i = 0; i < activeCount; i++) {
    const e = state.enemies[i];
    if (!e.alive) continue;

    e.prevX = e.x;
    e.prevY = e.y;
    e.aiTimer += dt;
    if (e.hitFlashTimer > 0) e.hitFlashTimer = Math.max(0, e.hitFlashTimer - dt);
    if (e.stunTimer > 0) e.stunTimer = Math.max(0, e.stunTimer - dt);

    const def = getEnemyDef(catalog, e.archetype);

    if (e.stunTimer <= 0) {
      stepSingleEnemyAI(state, room, e, def, hx, hy, dt, explosions, events);
    } else {
      // Gentle airborne drift while stunned (e.g. freshly split mini_jelly)
      e.x = Math.max(1.0, Math.min(room.widthTiles - 1.0 - e.width, e.x + e.vx * dt));
      e.y = Math.max(1.0, Math.min(room.heightTiles - 1.0 - e.height, e.y + e.vy * dt));
      e.vx *= 0.92;
      e.vy *= 0.92;
    }

    if (!e.alive) continue;

    // DashRoundFire orbiting flame + FireUp/FireDown (y +- 0.7) hit check
    if (dashRoundFireActive) {
      const ex = e.x + e.width * 0.5;
      const ey = e.y + e.height * 0.5;
      const r = SIM_RULES.DASH_ROUND_FIRE_RADIUS;
      const upHit = aabbOverlap(
        hx - SIM_RULES.FIRE_ROUND_HALF_W,
        hy + SIM_RULES.FIRE_ROUND_OFFSET_Y - SIM_RULES.FIRE_ROUND_HALF_H,
        SIM_RULES.FIRE_ROUND_HALF_W * 2,
        SIM_RULES.FIRE_ROUND_HALF_H * 2,
        e.x,
        e.y,
        e.width,
        e.height,
      );
      const downHit = aabbOverlap(
        hx - SIM_RULES.FIRE_ROUND_HALF_W,
        hy - SIM_RULES.FIRE_ROUND_OFFSET_Y - SIM_RULES.FIRE_ROUND_HALF_H,
        SIM_RULES.FIRE_ROUND_HALF_W * 2,
        SIM_RULES.FIRE_ROUND_HALF_H * 2,
        e.x,
        e.y,
        e.width,
        e.height,
      );
      const radialHit = (ex - hx) * (ex - hx) + (ey - hy) * (ey - hy) <= r * r;
      if (upHit || downHit || radialHit) {
        damageEnemy(state, e, 2, catalog, room, events);
        if (hero.action === 'fire_dash') {
          hero.abilityTimer = 0; // Extend Fire Dash chain!
          hero.abilityUsedInAir = false;
          hero.jumpsRemaining = hero.maxAirJumps;
        }
        if (!e.alive) continue;
      }
    }

    // Active tongue / form-ability expanded attack hitboxes + Hero body AABB
    if (hero.action !== 'dead') {
      const isAirStomp = hero.action === 'air_stomp';
      const isFireDash = hero.action === 'fire_dash';
      const isRockUppercut = hero.action === 'rock_uppercut';
      const isVoltDive = hero.action === 'volt_dive';
      const isVoltBlink = hero.action === 'volt_blink';
      const isShadowBlink = hero.action === 'shadow_blink';
      const isDashTackle = hero.action === 'ground_dash' || hero.action === 'wall_dash';

      const bodyOverlap = aabbOverlap(hero.x, hero.y, hero.width, hero.height, e.x, e.y, e.width, e.height);
      const stompTongueOverlap =
        isAirStomp &&
        aabbOverlap(hero.x - 0.14, hero.y - 0.42, hero.width + 0.28, hero.height + 0.42, e.x, e.y, e.width, e.height);
      const fireDashOverlap =
        isFireDash &&
        aabbOverlap(
          hero.facing > 0 ? hero.x : hero.x - 0.48,
          hero.y - 0.04,
          hero.width + 0.48,
          hero.height + 0.08,
          e.x,
          e.y,
          e.width,
          e.height,
        );
      const rockUppercutOverlap =
        isRockUppercut &&
        hero.abilityPhase === 1 &&
        aabbOverlap(hero.x - 0.08, hero.y, hero.width + 0.16, hero.height + 0.35, e.x, e.y, e.width, e.height);
      const voltDiveOverlap =
        isVoltDive &&
        aabbOverlap(
          hero.facing > 0 ? hero.x : hero.x - 0.3,
          hero.y - 0.12,
          hero.width + 0.3,
          hero.height + 0.12,
          e.x,
          e.y,
          e.width,
          e.height,
        );

      if (!bodyOverlap && !stompTongueOverlap && !fireDashOverlap && !rockUppercutOverlap && !voltDiveOverlap) {
        continue;
      }

      // Generous origin JumpOnTopOfObject stomp-first priority (+0.2u fall margin & post-hit air grace)
      const invulnGrace = hero.invulnTimer > 0 && !hero.grounded ? 0.2 : 0;
      const fallMargin = hero.vy < -0.5 ? 0.2 : 0;
      const isTopBounce =
        hero.vy <= 1.0 &&
        !def.armoredTop &&
        (hero.y + fallMargin >= e.y + e.height * 0.5 - hero.height * 0.25 - invulnGrace ||
          hero.prevY >= e.y + e.height * 0.3 - invulnGrace);

      if (isAirStomp || isFireDash || isRockUppercut || isVoltDive || isVoltBlink || isShadowBlink) {
        const dmg = 2;
        damageEnemy(state, e, dmg, catalog, room, events);
        applyHeroAttackBounce(state, isAirStomp, isFireDash, isVoltBlink, input);

        if (isAirStomp && hero.form === 'krunk_fire' && getUpgradeLevel(state, 'StompFlame') > 0) {
          const blastX = e.x + e.width * 0.5;
          const blastY = e.y + e.height * 0.5;
          events.push({ type: 'stomp_impact', x: blastX, y: blastY, explosive: true });
          const chainBlasts: BlastCircle[] = [{ x: blastX, y: blastY, radius: SIM_RULES.STOMP_FLAME_RADIUS }];
          breakTilesInRadius(state, room, blastX, blastY, SIM_RULES.STOMP_FLAME_RADIUS, events, chainBlasts);
          // Splash StompFlame damage to adjacent enemies
          const r2 = SIM_RULES.STOMP_FLAME_RADIUS * SIM_RULES.STOMP_FLAME_RADIUS;
          for (let k = 0; k < activeCount; k++) {
            const other = state.enemies[k];
            if (!other.alive || other.id === e.id) continue;
            const ox = other.x + other.width * 0.5;
            const oy = other.y + other.height * 0.5;
            if ((ox - blastX) * (ox - blastX) + (oy - blastY) * (oy - blastY) <= r2) {
              damageEnemy(state, other, 2, catalog, room, events);
            }
          }
        }
      } else if (isDashTackle && !def.armoredTop) {
        damageEnemy(state, e, 1, catalog, room, events);
        applyHeroAttackBounce(state, false, false, false, input);
      } else if (isTopBounce) {
        damageEnemy(state, e, 1, catalog, room, events);
        applyHeroAttackBounce(state, false, false, false, input);
      } else if (bodyOverlap && hero.lastEnemyHitTimer <= 0 && e.stunTimer <= 0) {
        const res = damageHero(state, 1, e.x + e.width * 0.5, events, 'enemy');
        if (res.evilRingTriggered) {
          damageEnemy(state, e, SIM_RULES.EVIL_RING_DAMAGE, catalog, room, events);
        }
      }
    }
  }
}
