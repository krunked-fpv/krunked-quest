import {
  TileCode,
  type BossId,
  type CoinRuntime,
  type CrystalDropRuntime,
  type EnemyRuntime,
  type GameMode,
  type HeroState,
  type InputFrame,
  type ISimEngine,
  type IWorldCatalog,
  type MovingPlatformRuntime,
  type ProgressState,
  type RelicId,
  type RoomDef,
  type SimEvent,
  type SimState,
  type UpgradeKey,
} from '../contracts/index';
import { createBossRuntime, damageBoss, updateBossAndCombat } from './bosses';
import { snapCameraToHero, updateCamera } from './camera';
import {
  aabbOverlap,
  getTileAt,
  isSolidTile,
  isTileSolidOrOneWayAt,
} from './collision';
import { initRoomCombo, registerComboCrystal, tickCombo } from './combo';
import {
  FIXED_DT,
  PHYSICS,
  SIM_RULES,
  computeMaxAirJumps,
  computeMaxHp,
  computeMaxRelicSlots,
  createEmptyUpgradeLevels,
  getUpgradeLevel,
  hasRelic,
} from './constants';
import {
  awardCrystals,
  damageEnemy,
  getEnemyDef,
  spawnCrystalDrops,
  updateEnemiesAndCombat,
} from './enemies';
import { switchHeroForm } from './forms';
import { hashState } from './hash';
import {
  spawnGhostShipWave,
  startBossRush as startBossRushMode,
  startGhostShip as startGhostShipMode,
  startTimeAttack as startTimeAttackMode,
  tickGhostShipMode,
  tickTimeAttack,
} from './modes';
import { damageHero, stepHeroPhysics } from './physics';

function createDefaultProgress(partial?: Partial<ProgressState>): ProgressState {
  const upgradeLevels = createEmptyUpgradeLevels();
  if (partial?.upgradeLevels) {
    const keys = Object.keys(partial.upgradeLevels) as UpgradeKey[];
    for (let i = 0; i < keys.length; i++) {
      const k = keys[i];
      const val = partial.upgradeLevels[k];
      if (typeof val === 'number') {
        upgradeLevels[k] = val;
      }
    }
  }

  return {
    crystals: partial?.crystals ?? 0,
    collectedCoinIds: partial?.collectedCoinIds ? [...partial.collectedCoinIds] : [],
    unlockedForms:
      partial?.unlockedForms && partial.unlockedForms.length > 0
        ? [...partial.unlockedForms]
        : ['krunk_basic'],
    upgradeLevels,
    ownedRelics: partial?.ownedRelics ? [...partial.ownedRelics] : [],
    equippedRelics: partial?.equippedRelics ? [...partial.equippedRelics] : [],
    defeatedBosses: partial?.defeatedBosses ? [...partial.defeatedBosses] : [],
    visitedRooms: partial?.visitedRooms ? [...partial.visitedRooms] : [],
    unlockedTeleporters: partial?.unlockedTeleporters ? [...partial.unlockedTeleporters] : [],
    rescuedAnimals: partial?.rescuedAnimals ? [...partial.rescuedAnimals] : [],
    clearedComboRooms: partial?.clearedComboRooms ? [...partial.clearedComboRooms] : [],
    openedChests: partial?.openedChests ? [...partial.openedChests] : [],
    ghostShipBestWave: partial?.ghostShipBestWave ?? 0,
    ghostShipHighScore: partial?.ghostShipHighScore ?? 0,
    bestTimeAttackTicks: partial?.bestTimeAttackTicks ?? null,
  };
}

function createInitialHero(
  x: number,
  y: number,
  maxHp: number,
  maxAirJumps: number,
  hasRockShield: boolean,
): HeroState {
  return {
    x,
    y,
    prevX: x,
    prevY: y,
    vx: 0,
    vy: 0,
    width: PHYSICS.HERO_W,
    height: PHYSICS.HERO_H,
    facing: 1,
    form: 'krunk_basic',
    action: 'idle',
    hp: maxHp,
    maxHp,
    grounded: false,
    onWall: 0,
    onVine: false,
    inQuicksand: false,
    inAntigrav: false,
    inWindY: 0,
    inWindX: 0,
    jumpsRemaining: maxAirJumps,
    maxAirJumps,
    coyoteTimer: 0,
    preJumpTimer: 0,
    jumpHoldTimer: 0,
    wallJumpTimer: 0,
    wallJumpHoldTimer: 0,
    wallStickLockTimer: 0,
    wallReleaseTimer: 0,
    wallRestickTimer: 0,
    preDashTimer: 0,
    groundDashTimer: 0,
    wallDashTimer: 0,
    stompDelayTimer: 0,
    lastEnemyHitTimer: 0,
    invulnTimer: 0,
    recoilTimer: 0,
    abilityTimer: 0,
    abilityPhase: 0,
    abilityUsedInAir: false,
    voltTargetX: 0,
    voltTargetY: 0,
    voltTargetId: null,
    rockShieldActive: hasRockShield,
    magicShieldTimer: 0,
    rebirthUsed: false,
    platinumShieldUsed: false,
    scaleX: 1,
    scaleY: 1,
    hitFlashTimer: 0,
    animTimer: 0,
    dashRingAngle: 0,
    tongueKind: 'none',
    tongueTimer: 0,
    tongueDuration: 0,
    tongueOriginX: x,
    tongueOriginY: y,
    tongueDirX: 0,
    tongueDirY: -1,
    stompSpamTimer: 0,
    wallSalivaActive: false,
    wallSalivaTopY: y,
  };
}

function spawnRoomEntities(
  state: SimState,
  room: RoomDef,
  catalog: IWorldCatalog,
  forceBossId?: BossId,
): void {
  state.roomTiles = new Uint8Array(room.tiles);
  state.crumbleTimers = {};
  state.openedDoors = [];
  state.projectiles = [];
  state.lavaY = room.risingLava ? 0.5 : -10;
  state.activeShopPrompt = null;
  state.activeSignText = null;

  // Enemies
  const enemies: EnemyRuntime[] = [];
  for (let i = 0; i < room.enemies.length; i++) {
    const sp = room.enemies[i];
    const def = getEnemyDef(catalog, sp.archetype);
    const minX = sp.patrolMinX ?? Math.max(1, sp.x - 3);
    const maxX = sp.patrolMaxX ?? Math.min(room.widthTiles - 1 - def.width, sp.x + 3);
    enemies.push({
      id: sp.id,
      archetype: sp.archetype,
      x: sp.x,
      y: sp.y,
      prevX: sp.x,
      prevY: sp.y,
      vx: 0,
      vy: 0,
      width: def.width,
      height: def.height,
      facing: -1,
      hp: def.hp,
      maxHp: def.hp,
      alive: true,
      patrolMinX: minX,
      patrolMaxX: maxX,
      aiTimer: 0,
      shootTimer: def.shoots ? def.shootCooldown * 0.6 : 99,
      hitFlashTimer: 0,
      stunTimer: 0,
      grounded: false,
    });
  }
  state.enemies = enemies;

  // Coins
  const coins: CoinRuntime[] = [];
  for (let i = 0; i < room.coins.length; i++) {
    const c = room.coins[i];
    coins.push({
      id: c.id,
      x: c.x,
      y: c.y,
      kind: c.kind,
      collected: state.progress.collectedCoinIds.includes(c.id),
    });
  }
  state.coins = coins;

  // Crystals
  const crystals: CrystalDropRuntime[] = [];
  for (let i = 0; i < room.crystals.length; i++) {
    const cr = room.crystals[i];
    crystals.push({
      id: cr.id,
      x: cr.x,
      y: cr.y,
      vx: 0,
      vy: 0,
      value: cr.value,
      collected: false,
      ttl: -1,
    });
  }
  state.crystals = crystals;

  // Moving platforms / crushers / spinning platforms (spawn before boss so Nightmare Sovereign morphs them)
  const platforms: MovingPlatformRuntime[] = [];
  for (let i = 0; i < room.props.length; i++) {
    const p = room.props[i];
    if (p.kind === 'moving_platform' || p.kind === 'crusher' || p.kind === 'spinning_platform') {
      platforms.push({
        id: p.id,
        kind: p.kind,
        baseX: p.x,
        baseY: p.y,
        x: p.x,
        y: p.y,
        prevX: p.x,
        prevY: p.y,
        width: p.width ?? 2,
        height: p.height ?? 0.5,
        moveDx: p.moveDx ?? 0,
        moveDy: p.moveDy ?? 0,
        periodSec: Math.max(0.5, p.periodSec ?? 3.0),
        phase: 0,
        solid: true,
      });
    }
  }
  state.platforms = platforms;

  // Boss
  const bossId = forceBossId ?? room.bossId;
  if (
    bossId &&
    (forceBossId !== undefined ||
      state.mode === 'boss_rush' ||
      state.mode === 'time_attack' ||
      !state.progress.defeatedBosses.includes(bossId))
  ) {
    const bossDef = catalog.bosses.get(bossId);
    state.boss = bossDef ? createBossRuntime(bossDef, room, state) : null;
  } else {
    state.boss = null;
  }

  initRoomCombo(state, room);
}

function loadRoomIntoState(
  state: SimState,
  catalog: IWorldCatalog,
  roomId: string,
  spawnX?: number,
  spawnY?: number,
  forceBossId?: BossId,
): SimEvent[] {
  const fromRoomId = state.roomId;
  const room = catalog.rooms.get(roomId) ?? catalog.getRoom(catalog.startRoomId);

  state.roomId = room.id;
  state.biome = room.biome;

  const sx = spawnX ?? room.defaultSpawnX;
  const sy = spawnY ?? room.defaultSpawnY;

  const hero = state.hero;
  hero.x = sx;
  hero.y = sy;
  hero.prevX = sx;
  hero.prevY = sy;
  hero.vx = 0;
  hero.vy = 0;
  hero.grounded = false;
  hero.onWall = 0;
  hero.onVine = false;
  hero.jumpHoldTimer = 0;
  hero.wallJumpHoldTimer = 0;
  hero.groundDashTimer = 0;
  hero.wallDashTimer = 0;
  hero.stompDelayTimer = 0;
  hero.recoilTimer = 0;
  hero.abilityTimer = 0;
  hero.abilityPhase = 0;
  hero.abilityUsedInAir = false;
  hero.voltTargetId = null;
  hero.platinumShieldUsed = false;
  hero.maxHp = computeMaxHp(state);
  hero.maxAirJumps = computeMaxAirJumps(state);
  hero.jumpsRemaining = hero.maxAirJumps;

  if (getUpgradeLevel(state, 'RockShield') > 0) {
    hero.rockShieldActive = true;
  }

  if (hero.action === 'dead' || hero.hp <= 0) {
    hero.hp = hero.maxHp;
    hero.action = 'idle';
    hero.rebirthUsed = false;
    state.gameOverTriggered = false;
  } else {
    hero.action = 'idle';
  }

  if (!state.progress.visitedRooms.includes(room.id)) {
    state.progress.visitedRooms.push(room.id);
  }

  spawnRoomEntities(state, room, catalog, forceBossId);
  snapCameraToHero(state, room);

  return [{ type: 'room_change', fromRoomId, toRoomId: room.id, biome: room.biome }];
}

function updateCrumbleTiles(state: SimState, room: RoomDef, dt: number, events: SimEvent[]): void {
  const keys = Object.keys(state.crumbleTimers);
  for (let i = 0; i < keys.length; i++) {
    const idx = Number(keys[i]);
    const timer = state.crumbleTimers[idx];
    if (timer === undefined) continue;

    if (timer > 0) {
      const next = timer - dt;
      if (next <= 0) {
        state.roomTiles[idx] = TileCode.Empty;
        state.crumbleTimers[idx] = -SIM_RULES.CRUMBLE_RESPAWN_TIME;
        const tx = idx % room.widthTiles;
        const ty = Math.floor(idx / room.widthTiles);
        events.push({ type: 'block_break', x: tx + 0.5, y: ty + 0.5, explosive: false });
      } else {
        state.crumbleTimers[idx] = next;
      }
    } else {
      const next = timer + dt;
      if (next >= 0) {
        const tx = idx % room.widthTiles;
        const ty = Math.floor(idx / room.widthTiles);
        const hero = state.hero;
        if (!aabbOverlap(hero.x, hero.y, hero.width, hero.height, tx, ty, 1, 1)) {
          state.roomTiles[idx] = TileCode.Crumble;
          delete state.crumbleTimers[idx];
        }
      } else {
        state.crumbleTimers[idx] = next;
      }
    }
  }
}

function updateMovingPlatforms(state: SimState, dt: number): void {
  for (let i = 0; i < state.platforms.length; i++) {
    const p = state.platforms[i];
    p.prevX = p.x;
    p.prevY = p.y;
    p.phase = (p.phase + (Math.PI * 2 * dt) / p.periodSec) % (Math.PI * 2);

    if (p.kind === 'spinning_platform') {
      p.x = p.baseX + Math.cos(p.phase) * p.moveDx;
      p.y = p.baseY + Math.sin(p.phase) * p.moveDy;
    } else {
      const s = Math.sin(p.phase);
      p.x = p.baseX + s * p.moveDx;
      p.y = p.baseY + s * p.moveDy;
    }
  }
}

function updateProjectiles(
  state: SimState,
  room: RoomDef,
  catalog: IWorldCatalog,
  dt: number,
  events: SimEvent[],
): void {
  const hero = state.hero;
  const hx = hero.x + hero.width * 0.5;
  const hy = hero.y + hero.height * 0.5;
  const remaining = [];

  for (let i = 0; i < state.projectiles.length; i++) {
    const p = state.projectiles[i];
    p.prevX = p.x;
    p.prevY = p.y;

    // 1. Homing missiles steer smoothly toward hero
    if (p.homing && !p.fromHero && hero.action !== 'dead') {
      const spd = Math.max(3.5, Math.hypot(p.vx, p.vy));
      const curAng = Math.atan2(p.vy, p.vx);
      const wantAng = Math.atan2(hy - p.y, hx - p.x);
      let diff = wantAng - curAng;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      const maxTurn = 4.0 * dt;
      const nextAng = curAng + Math.max(-maxTurn, Math.min(maxTurn, diff));
      p.vx = Math.cos(nextAng) * spd;
      p.vy = Math.sin(nextAng) * spd;
    }

    // 2. Ballistic arc gravity for lobbed acid / mortar / barrage fireballs & bombs
    if (
      !p.fromHero &&
      ((p.kind === 'fireball' && p.radius >= 0.25) || (p.kind === 'spit' && Math.abs(p.radius - 0.24) < 0.005))
    ) {
      p.vy = Math.max(-14.0, p.vy - 13.5 * dt);
    }

    // 3. Boomerang gear curve (botmerang throws radius <= 0.22 gears that return mid-flight)
    if (!p.fromHero && p.kind === 'gear' && p.radius <= 0.22) {
      if (p.ttl > 1.25) {
        const damp = Math.max(0.2, 1 - 2.1 * dt);
        p.vx *= damp;
        p.vy *= damp;
      } else {
        // Steer back toward nearest alive botmerang (or drift smoothly back)
        let targetX = p.x - Math.sign(p.vx || 1) * 5.0;
        let targetY = p.y;
        let bestD2 = Infinity;
        for (let k = 0; k < state.enemies.length; k++) {
          const e = state.enemies[k];
          if (!e.alive || e.archetype !== 'botmerang') continue;
          const ex = e.x + e.width * 0.5;
          const ey = e.y + e.height * 0.5;
          const d2 = (ex - p.x) * (ex - p.x) + (ey - p.y) * (ey - p.y);
          if (d2 < bestD2) {
            bestD2 = d2;
            targetX = ex;
            targetY = ey;
          }
        }
        const dx = targetX - p.x;
        const dy = targetY - p.y;
        const d = Math.max(0.2, Math.hypot(dx, dy));
        p.vx += ((dx / d) * 9.0 - p.vx) * Math.min(1, 5.0 * dt);
        p.vy += ((dy / d) * 9.0 - p.vy) * Math.min(1, 5.0 * dt);
      }
    }

    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.ttl -= dt;

    if (p.ttl <= 0) continue;

    // Out of room bounds
    if (p.x < -1 || p.x > room.widthTiles + 1 || p.y < -1 || p.y > room.heightTiles + 1) {
      continue;
    }

    // Solid tile stop (shockwaves glide along ground)
    if (p.kind !== 'shockwave') {
      const tx = Math.floor(p.x);
      const ty = Math.floor(p.y);
      if (isSolidTile(getTileAt(state.roomTiles, room.widthTiles, room.heightTiles, tx, ty))) {
        continue;
      }
    }

    let consumed = false;
    if (p.fromHero) {
      const enemyCount = state.enemies.length;
      for (let j = 0; j < enemyCount; j++) {
        const e = state.enemies[j];
        if (!e.alive) continue;
        if (
          aabbOverlap(
            p.x - p.radius,
            p.y - p.radius,
            p.radius * 2,
            p.radius * 2,
            e.x,
            e.y,
            e.width,
            e.height,
          )
        ) {
          damageEnemy(state, e, 2, catalog, room, events);
          if (p.kind !== 'shockwave') {
            consumed = true;
            break;
          }
        }
      }
      if (!consumed && state.boss && !state.boss.defeated) {
        const b = state.boss;
        if (
          aabbOverlap(
            p.x - p.radius,
            p.y - p.radius,
            p.radius * 2,
            p.radius * 2,
            b.x,
            b.y,
            b.width,
            b.height,
          )
        ) {
          damageBoss(state, b, 1, catalog, room, events, true);
          if (p.kind !== 'shockwave') {
            consumed = true;
          }
        }
      }
    } else if (hero.action !== 'dead') {
      if (
        aabbOverlap(
          p.x - p.radius,
          p.y - p.radius,
          p.radius * 2,
          p.radius * 2,
          hero.x,
          hero.y,
          hero.width,
          hero.height,
        )
      ) {
        damageHero(state, 1, p.x, events, 'projectile');
        consumed = true;
      }
    }

    if (!consumed) {
      remaining.push(p);
    }
  }

  state.projectiles = remaining;
}

function updateCrystalsAndCoins(
  state: SimState,
  room: RoomDef,
  dt: number,
  events: SimEvent[],
): void {
  const hero = state.hero;
  const hx = hero.x + hero.width * 0.5;
  const hy = hero.y + hero.height * 0.5;
  const magnetRadius = hasRelic(state, 'magnet')
    ? SIM_RULES.MAGNET_RELIC_RADIUS
    : SIM_RULES.MAGNET_BASE_RADIUS;
  const magnetR2 = magnetRadius * magnetRadius;
  const pickupR2 = SIM_RULES.CRYSTAL_PICKUP_RADIUS * SIM_RULES.CRYSTAL_PICKUP_RADIUS;

  for (let i = 0; i < state.crystals.length; i++) {
    const cr = state.crystals[i];
    if (cr.collected) continue;

    // Dynamic dropped crystals experience gravity & TTL
    if (cr.ttl > 0) {
      cr.ttl -= dt;
      if (cr.ttl <= 0) {
        cr.collected = true;
        continue;
      }
      cr.vy = Math.max(-12, cr.vy + PHYSICS.G_EFF * 0.45 * dt);
      const nextX = cr.x + cr.vx * dt;
      const nextY = cr.y + cr.vy * dt;
      const tx = Math.floor(nextX);
      const ty = Math.floor(nextY);
      if (isTileSolidOrOneWayAt(state.roomTiles, room.widthTiles, room.heightTiles, tx, ty) && cr.vy < 0) {
        cr.y = ty + 1.05;
        cr.vy = -cr.vy * 0.35;
        cr.vx *= 0.7;
      } else {
        cr.x = nextX;
        cr.y = nextY;
      }
    }

    // Magnet vacuum pull
    const dx = hx - cr.x;
    const dy = hy - cr.y;
    const distSq = dx * dx + dy * dy;

    if (distSq <= pickupR2) {
      cr.collected = true;
      const value = awardCrystals(state, cr.value);
      registerComboCrystal(state, events);
      events.push({ type: 'crystal_pickup', x: cr.x, y: cr.y, value });
      continue;
    }

    if (distSq <= magnetR2 && distSq > 1e-4) {
      const dist = Math.sqrt(distSq);
      const pull = SIM_RULES.MAGNET_PULL_SPEED * dt;
      cr.x += (dx / dist) * pull;
      cr.y += (dy / dist) * pull;
      const ndx = hx - cr.x;
      const ndy = hy - cr.y;
      if (ndx * ndx + ndy * ndy <= pickupR2) {
        cr.collected = true;
        const value = awardCrystals(state, cr.value);
        registerComboCrystal(state, events);
        events.push({ type: 'crystal_pickup', x: cr.x, y: cr.y, value });
      }
    }
  }

  // Coins
  const coinR2 = SIM_RULES.COIN_PICKUP_RADIUS * SIM_RULES.COIN_PICKUP_RADIUS;
  for (let i = 0; i < state.coins.length; i++) {
    const c = state.coins[i];
    if (c.collected) continue;
    const dx = hx - c.x;
    const dy = hy - c.y;
    const overlaps =
      dx * dx + dy * dy <= coinR2 ||
      aabbOverlap(hero.x, hero.y, hero.width, hero.height, c.x - 0.3, c.y - 0.3, 0.6, 0.6);
    if (overlaps) {
      c.collected = true;
      if (!state.progress.collectedCoinIds.includes(c.id)) {
        state.progress.collectedCoinIds.push(c.id);
      }
      if (hasRelic(state, 'extra_coin')) {
        state.progress.crystals += SIM_RULES.EXTRA_COIN_CRYSTAL_BONUS;
      }
      events.push({
        type: 'coin_pickup',
        x: c.x,
        y: c.y,
        coinId: c.id,
        totalCoins: state.progress.collectedCoinIds.length,
      });
    }
  }
}

function updateInteractiveProps(
  state: SimState,
  room: RoomDef,
  input: InputFrame,
  events: SimEvent[],
): void {
  const hero = state.hero;
  const hx = hero.x + hero.width * 0.5;
  const hy = hero.y + hero.height * 0.5;

  state.activeShopPrompt = null;
  state.activeSignText = null;

  for (let i = 0; i < room.props.length; i++) {
    const prop = room.props[i];
    const pw = prop.width ?? 1;
    const ph = prop.height ?? 1;
    const px = prop.x + pw * 0.5;
    const py = prop.y + ph * 0.5;
    const dist = Math.hypot(hx - px, hy - py);

    switch (prop.kind) {
      case 'shop_npc': {
        if (dist <= SIM_RULES.PROP_INTERACT_RADIUS && prop.shopId) {
          state.activeShopPrompt = prop.shopId;
          if (input.interactPressed) {
            events.push({ type: 'shop_interact', shopId: prop.shopId });
          }
        }
        break;
      }

      case 'signpost': {
        if (dist <= SIM_RULES.PROP_INTERACT_RADIUS && prop.label) {
          state.activeSignText = prop.label;
        }
        break;
      }

      case 'teleporter': {
        if (dist <= 1.6 && !state.progress.unlockedTeleporters.includes(room.id)) {
          state.progress.unlockedTeleporters.push(room.id);
          events.push({ type: 'teleporter_unlock', roomId: room.id });
        }
        break;
      }

      case 'save_shrine': {
        if (dist <= 1.6 && input.interactPressed) {
          hero.hp = hero.maxHp;
          if (getUpgradeLevel(state, 'RockShield') > 0) {
            hero.rockShieldActive = true;
          }
          events.push({ type: 'heal', x: hx, y: hy, hp: hero.hp });
        }
        break;
      }

      case 'form_totem': {
        if (dist <= 1.5 && prop.formId) {
          const alreadyUnlocked = state.progress.unlockedForms.includes(prop.formId);
          if (!alreadyUnlocked) {
            state.progress.unlockedForms.push(prop.formId);
            switchHeroForm(state, prop.formId, events);
          } else if (input.interactPressed && hero.form !== prop.formId) {
            switchHeroForm(state, prop.formId, events);
          }
        }
        break;
      }

      case 'chest': {
        if (dist <= 1.35 && !state.progress.openedChests.includes(prop.id)) {
          state.progress.openedChests.push(prop.id);
          if (prop.coinId && !state.progress.collectedCoinIds.includes(prop.coinId)) {
            state.progress.collectedCoinIds.push(prop.coinId);
            events.push({
              type: 'coin_pickup',
              x: px,
              y: py,
              coinId: prop.coinId,
              totalCoins: state.progress.collectedCoinIds.length,
            });
          }
          spawnCrystalDrops(state, px, py + 0.4, 45, 3);
        }
        break;
      }

      case 'animal_house': {
        if (dist <= 1.5 && prop.animalName && !state.progress.rescuedAnimals.includes(prop.animalName)) {
          state.progress.rescuedAnimals.push(prop.animalName);
          awardCrystals(state, 50);
        }
        break;
      }

      case 'target_switch': {
        if (dist <= 1.25 && prop.targetId && !state.openedDoors.includes(prop.targetId)) {
          state.openedDoors.push(prop.targetId);
        }
        break;
      }

      case 'coin_door': {
        const req = prop.requiredCoins ?? 0;
        if (
          dist <= 1.8 &&
          !state.openedDoors.includes(prop.id) &&
          state.progress.collectedCoinIds.length >= req
        ) {
          state.openedDoors.push(prop.id);
        }
        break;
      }

      default:
        break;
    }
  }
}

function checkRoomExits(
  state: SimState,
  room: RoomDef,
  input: InputFrame,
  catalog: IWorldCatalog,
  events: SimEvent[],
): boolean {
  const hero = state.hero;
  for (let i = 0; i < room.exits.length; i++) {
    const exit = room.exits[i];
    if (!aabbOverlap(hero.x, hero.y, hero.width, hero.height, exit.x, exit.y, exit.width, exit.height)) {
      continue;
    }
    if (exit.dir === 'door' && !input.interactPressed && input.moveY <= 0.5) {
      if (exit.label) {
        state.activeSignText = exit.label;
      }
      continue;
    }
    if (exit.requiredForm && !state.progress.unlockedForms.includes(exit.requiredForm)) {
      state.activeSignText = `Requires ${exit.requiredForm}`;
      continue;
    }
    if (exit.requiredCoins && state.progress.collectedCoinIds.length < exit.requiredCoins) {
      state.activeSignText = `Requires ${exit.requiredCoins} coins`;
      continue;
    }
    if (!catalog.rooms.has(exit.targetRoomId)) {
      continue;
    }

    const changeEvents = loadRoomIntoState(
      state,
      catalog,
      exit.targetRoomId,
      exit.targetSpawnX,
      exit.targetSpawnY,
    );
    events.push(...changeEvents);
    return true;
  }
  return false;
}

export function createSimEngine(): ISimEngine {
  return {
    createInitialState(
      catalog: IWorldCatalog,
      options?: {
        seed?: number;
        mode?: GameMode;
        roomId?: string;
        progress?: Partial<ProgressState>;
      },
    ): SimState {
      const seed = (options?.seed ?? SIM_RULES.DEFAULT_SEED) >>> 0;
      const mode: GameMode = options?.mode ?? 'story';
      const roomId = options?.roomId ?? catalog.startRoomId;
      const room = catalog.rooms.get(roomId) ?? catalog.getRoom(catalog.startRoomId);
      const progress = createDefaultProgress(options?.progress);

      const state: SimState = {
        tick: 0,
        seed,
        rngState: seed,
        mode,
        roomId: room.id,
        biome: room.biome,
        roomTiles: new Uint8Array(room.tiles),
        crumbleTimers: {},
        openedDoors: [],
        lavaY: room.risingLava ? 0.5 : -10,
        hitstopTicks: 0,
        slowmoTimer: 0,
        slowmoScale: 1.0,
        timeAttackTicks: 0,
        hero: createInitialHero(room.defaultSpawnX, room.defaultSpawnY, PHYSICS.START_HP, 1, false),
        enemies: [],
        boss: null,
        projectiles: [],
        crystals: [],
        coins: [],
        platforms: [],
        combo: {
          preset: room.mode,
          count: 0,
          maxSceneCombo: 0,
          timer: 0,
          maxTimer: 4.0,
          decayAccum: 0,
          freezeTimer: 0,
          miniComboTimer: 0,
          miniComboCount: 0,
          roomComboCleared: false,
          bannerTimer: 0,
          bannerText: '',
        },
        camera: {
          x: room.defaultSpawnX,
          y: room.defaultSpawnY,
          prevX: room.defaultSpawnX,
          prevY: room.defaultSpawnY,
          snappedX: room.defaultSpawnX,
          snappedY: room.defaultSpawnY,
          zoom: 1.0,
          shakeTimer: 0,
          shakeIntensity: 0,
        },
        ghostShip: {
          active: mode === 'ghost_ship',
          wave: mode === 'ghost_ship' ? 1 : 0,
          score: 0,
          highScore: progress.ghostShipHighScore,
          waveClearTimer: 0,
          hazardTier: 0,
          spikeTimer: 0,
        },
        progress,
        nextProjectileId: 1,
        victoryTriggered: false,
        gameOverTriggered: false,
        activeShopPrompt: null,
        activeSignText: null,
      };

      state.hero.maxHp = computeMaxHp(state);
      state.hero.hp = state.hero.maxHp;
      state.hero.maxAirJumps = computeMaxAirJumps(state);
      state.hero.jumpsRemaining = state.hero.maxAirJumps;
      state.hero.rockShieldActive = getUpgradeLevel(state, 'RockShield') > 0;

      if (!state.progress.visitedRooms.includes(room.id)) {
        state.progress.visitedRooms.push(room.id);
      }

      spawnRoomEntities(state, room, catalog);
      if (mode === 'ghost_ship') {
        spawnGhostShipWave(state, room, catalog);
      }
      snapCameraToHero(state, room);

      return state;
    },

    step(state: SimState, input: InputFrame, catalog: IWorldCatalog): SimEvent[] {
      const events: SimEvent[] = [];
      state.tick += 1;

      tickTimeAttack(state);

      const room = catalog.rooms.get(state.roomId) ?? catalog.getRoom(catalog.startRoomId);

      // Hitstop freeze frames
      if (state.hitstopTicks > 0) {
        state.hitstopTicks -= 1;
        updateCamera(state, room, FIXED_DT);
        return events;
      }

      // Slowmo time dilation (Old Clock / Max Room Combo)
      let dt = FIXED_DT;
      if (state.slowmoTimer > 0) {
        state.slowmoTimer = Math.max(0, state.slowmoTimer - FIXED_DT);
        dt = FIXED_DT * state.slowmoScale;
        if (state.slowmoTimer === 0) {
          state.slowmoScale = 1.0;
        }
      }

      if (state.hero.action === 'dead') {
        updateCamera(state, room, dt);
        return events;
      }

      // 1. World environment updates
      updateCrumbleTiles(state, room, dt, events);
      updateMovingPlatforms(state, dt);

      // 2. Hero physics, form abilities, and swept AABB collision
      state.hero.prevX = state.hero.x;
      state.hero.prevY = state.hero.y;
      const heroOut = stepHeroPhysics(state, input, room, dt, events);

      // Rising lava hazard
      if (room.risingLava) {
        state.lavaY = Math.min(room.heightTiles - 2, state.lavaY + 0.35 * dt);
        if (state.hero.y < state.lavaY) {
          damageHero(state, 1, state.hero.x + state.hero.width * 0.5, events, 'lava');
        }
      }

      // 3. Check room exits before clamping room X bounds
      const transitioned = checkRoomExits(state, room, input, catalog, events);
      if (transitioned) {
        return events;
      }

      // Keep hero within horizontal room bounds if not exiting
      if (state.hero.x < 0) {
        state.hero.x = 0;
        if (state.hero.vx < 0) state.hero.vx = 0;
      } else if (state.hero.x + state.hero.width > room.widthTiles) {
        state.hero.x = Math.max(0, room.widthTiles - state.hero.width);
        if (state.hero.vx > 0) state.hero.vx = 0;
      }

      // Bottomless pit safety check
      if (state.hero.y < -2.0) {
        damageHero(state, 1, state.hero.x + state.hero.width * 0.5, events, 'lava');
        if (state.hero.hp > 0 && !state.gameOverTriggered) {
          state.hero.x = room.defaultSpawnX;
          state.hero.y = room.defaultSpawnY;
          state.hero.vx = 0;
          state.hero.vy = 0;
        }
      }

      // 4. Enemies, boss, projectiles
      updateEnemiesAndCombat(
        state,
        room,
        catalog,
        input,
        dt,
        heroOut.explosions,
        heroOut.completedVoltTargetId,
        heroOut.evilRingTriggered,
        events,
      );
      updateBossAndCombat(
        state,
        room,
        catalog,
        input,
        dt,
        heroOut.explosions,
        heroOut.completedVoltTargetId,
        events,
      );
      updateProjectiles(state, room, catalog, dt, events);

      // 5. Crystals, coins, props
      updateCrystalsAndCoins(state, room, dt, events);
      updateInteractiveProps(state, room, input, events);

      // 6. Ghost Ship endless progression & 3-tier dynamic hazards
      tickGhostShipMode(state, room, catalog, dt, events);

      // 7. Combo decay
      tickCombo(state, dt);

      // 8. Smooth pixel-snapped camera
      updateCamera(state, room, dt);

      return events;
    },

    warpToRoom(
      state: SimState,
      catalog: IWorldCatalog,
      roomId: string,
      spawnX?: number,
      spawnY?: number,
    ): SimEvent[] {
      return loadRoomIntoState(state, catalog, roomId, spawnX, spawnY);
    },

    hashState(state: SimState): number {
      return hashState(state);
    },

    buyUpgrade(state: SimState, catalog: IWorldCatalog, key: UpgradeKey): boolean {
      const def = catalog.getUpgrade(key);
      if (!def) return false;
      const currentLevel = state.progress.upgradeLevels[key] ?? 0;
      if (currentLevel >= def.maxLevel) return false;
      if (def.requiredForm && !state.progress.unlockedForms.includes(def.requiredForm)) {
        return false;
      }
      const price = def.basePrice + currentLevel * def.priceStep;
      if (state.progress.crystals < price) return false;

      state.progress.crystals -= price;
      state.progress.upgradeLevels[key] = currentLevel + 1;

      if (key === 'ExtraLife') {
        state.hero.maxHp = computeMaxHp(state);
        state.hero.hp = Math.min(state.hero.maxHp, state.hero.hp + 1);
      } else if (key === 'TripleJump') {
        state.hero.maxAirJumps = computeMaxAirJumps(state);
        state.hero.jumpsRemaining = Math.max(state.hero.jumpsRemaining, state.hero.maxAirJumps);
      } else if (key === 'RockShield') {
        state.hero.rockShieldActive = true;
      }

      return true;
    },

    buyRelic(state: SimState, catalog: IWorldCatalog, id: RelicId): boolean {
      if (state.progress.ownedRelics.includes(id)) return false;
      const def = catalog.getRelic(id);
      if (!def) return false;
      if (state.progress.crystals < def.price) return false;

      state.progress.crystals -= def.price;
      state.progress.ownedRelics.push(id);

      if (state.progress.equippedRelics.length < computeMaxRelicSlots(state)) {
        state.progress.equippedRelics.push(id);
        if (id === 'lively_heart') {
          state.hero.maxHp = computeMaxHp(state);
          state.hero.hp = Math.min(state.hero.maxHp, state.hero.hp + 1);
        }
      }

      return true;
    },

    toggleEquipRelic(state: SimState, _catalog: IWorldCatalog, id: RelicId): boolean {
      if (!state.progress.ownedRelics.includes(id)) return false;
      const idx = state.progress.equippedRelics.indexOf(id);
      if (idx >= 0) {
        state.progress.equippedRelics.splice(idx, 1);
        state.hero.maxHp = computeMaxHp(state);
        state.hero.hp = Math.min(state.hero.hp, state.hero.maxHp);
        return true;
      }

      if (state.progress.equippedRelics.length >= computeMaxRelicSlots(state)) {
        return false;
      }

      state.progress.equippedRelics.push(id);
      state.hero.maxHp = computeMaxHp(state);
      if (id === 'lively_heart') {
        state.hero.hp = Math.min(state.hero.maxHp, state.hero.hp + 1);
      }
      return true;
    },

    startGhostShip(state: SimState, catalog: IWorldCatalog): SimEvent[] {
      return startGhostShipMode(state, catalog, loadRoomIntoState);
    },

    startBossRush(state: SimState, catalog: IWorldCatalog, bossId: BossId): SimEvent[] {
      return startBossRushMode(state, catalog, bossId, loadRoomIntoState);
    },

    startTimeAttack(state: SimState, catalog: IWorldCatalog): SimEvent[] {
      return startTimeAttackMode(state, catalog, loadRoomIntoState);
    },
  };
}
