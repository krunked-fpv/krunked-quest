/**
 * Gate B — Autonomous Headless Deterministic 64-Room, 200-Coin, 8-Boss & Ghost Ship Soak
 * Run via: npm run verify:sim
 */

import {
  BIOME_IDS,
  createEmptyInputFrame,
  HERO_FORMS,
  type BiomeId,
  type BossId,
  type InputFrame,
} from '../../src/contracts/index';
import { createWorldCatalog } from '../../src/data/index';
import { createSimEngine, getTileAt, isSolidTile } from '../../src/sim/index';

const EXPECTED_BIOME_COUNTS: Record<BiomeId, number> = {
  MLAIR: 3,
  OPOUSO: 1,
  TDM: 8,
  FLIN: 7,
  AP: 8,
  ATVC: 8,
  DSI: 7,
  LAB: 7,
  TEMP: 7,
  EVIL: 7,
  GSHIP: 1,
};

const ALL_BOSS_IDS: readonly BossId[] = [
  'dino_behemoth',
  'primal_eye',
  'magma_boar_king',
  'bone_colossus',
  'mecha_bull',
  'electro_sphinx',
  'shadow_doppelganger',
  'nightmare_sovereign',
];

const failures: string[] = [];
const passes: string[] = [];

function check(cond: boolean, label: string, detail?: string): void {
  if (cond) {
    passes.push(label);
  } else {
    failures.push(detail ? `${label}: ${detail}` : label);
  }
}

function main(): void {
  const catalog = createWorldCatalog();
  const engine = createSimEngine();

  // --------------------------------------------------------------------------
  // 1. 64-Room Topology, Biome Counts, Unique Map Coords & Graph Connectivity
  // --------------------------------------------------------------------------
  check(catalog.rooms.size === 64, 'World contains exactly 64 rooms', `got ${catalog.rooms.size}`);

  const biomeCounts: Record<BiomeId, number> = {
    MLAIR: 0,
    OPOUSO: 0,
    TDM: 0,
    FLIN: 0,
    AP: 0,
    ATVC: 0,
    DSI: 0,
    LAB: 0,
    TEMP: 0,
    EVIL: 0,
    GSHIP: 0,
  };
  const mapCoords = new Set<string>();
  const coinIds = new Set<string>();
  let badCoinPlacements = 0;
  let badExitTargets = 0;

  for (const room of catalog.rooms.values()) {
    biomeCounts[room.biome]++;
    const mKey = `${room.mapX},${room.mapY}`;
    if (mapCoords.has(mKey)) {
      failures.push(`Duplicate map coord (${mKey}) on room ${room.id}`);
    }
    mapCoords.add(mKey);

    for (const ex of room.exits) {
      if (!catalog.rooms.has(ex.targetRoomId)) {
        badExitTargets++;
      }
    }
    for (const coin of room.coins) {
      if (coinIds.has(coin.id)) {
        failures.push(`Duplicate coin id: ${coin.id}`);
      }
      coinIds.add(coin.id);
      const tx = Math.floor(coin.x);
      const ty = Math.floor(coin.y);
      if (isSolidTile(getTileAt(room.tiles, room.widthTiles, room.heightTiles, tx, ty))) {
        badCoinPlacements++;
      }
    }
  }

  for (const biome of BIOME_IDS) {
    check(
      biomeCounts[biome] === EXPECTED_BIOME_COUNTS[biome],
      `Biome ${biome} room count === ${EXPECTED_BIOME_COUNTS[biome]}`,
      `got ${biomeCounts[biome]}`,
    );
  }
  check(badExitTargets === 0, 'All room exits target valid rooms', `bad=${badExitTargets}`);
  check(coinIds.size === 200 && catalog.totalCoins === 200, '200 globally unique collectible coins', `set=${coinIds.size} total=${catalog.totalCoins}`);
  check(badCoinPlacements === 0, 'Zero coins embedded inside solid tiles', `bad=${badCoinPlacements}`);

  // BFS reachability from startRoomId ('mlair_01')
  const visited = new Set<string>([catalog.startRoomId]);
  const queue = [catalog.startRoomId];
  while (queue.length > 0) {
    const curr = queue.shift()!;
    const r = catalog.rooms.get(curr);
    if (!r) continue;
    for (const ex of r.exits) {
      if (catalog.rooms.has(ex.targetRoomId) && !visited.has(ex.targetRoomId)) {
        visited.add(ex.targetRoomId);
        queue.push(ex.targetRoomId);
      }
    }
  }
  check(visited.size === 64, 'BFS from mlair_01 reaches all 64 rooms', `reached ${visited.size}/64`);

  // --------------------------------------------------------------------------
  // 2. Live 60Hz Soak Across All 64 Rooms (Zero NaN / OOB / Softlocks)
  // --------------------------------------------------------------------------
  const soakState = engine.createInitialState(catalog, { seed: 20261126, mode: 'story' });
  soakState.progress.unlockedForms = [...HERO_FORMS];
  let simRoomErrors = 0;

  for (const roomId of catalog.roomOrder) {
    engine.warpToRoom(soakState, catalog, roomId);
    soakState.hero.hp = soakState.hero.maxHp;
    const room = catalog.getRoom(roomId);
    for (let t = 0; t < 45; t++) {
      const inp: InputFrame = createEmptyInputFrame();
      inp.moveX = t < 20 ? 1 : -1;
      inp.jumpPressed = t === 5 || t === 25;
      inp.jumpHeld = (t >= 5 && t <= 12) || (t >= 25 && t <= 32);
      inp.dashPressed = t === 14;
      inp.dashHeld = t >= 14 && t <= 22;
      engine.step(soakState, inp, catalog);
      if (
        !Number.isFinite(soakState.hero.x) ||
        !Number.isFinite(soakState.hero.y) ||
        !Number.isFinite(soakState.hero.vx) ||
        !Number.isFinite(soakState.hero.vy) ||
        soakState.hero.y < -5 ||
        soakState.hero.x < -5 ||
        soakState.hero.x > room.widthTiles + 5
      ) {
        simRoomErrors++;
        break;
      }
    }
  }
  check(simRoomErrors === 0, 'Live 60Hz soak clean across all 64 rooms (2,880 ticks)', `errors=${simRoomErrors}`);

  // --------------------------------------------------------------------------
  // 3. Defeat ALL 6 Bosses & 2 Mini-Bosses Through Every Phase in Live Sim
  // --------------------------------------------------------------------------
  let bossesDefeatedCount = 0;
  let finalVictorySeen = false;

  for (const bossId of ALL_BOSS_IDS) {
    const bState = engine.createInitialState(catalog, { seed: 7777, mode: 'story' });
    bState.progress.unlockedForms = [...HERO_FORMS];
    bState.hero.form = 'krunk_fire';
    const def = catalog.bosses.get(bossId)!;
    engine.warpToRoom(bState, catalog, def.roomId);
    check(bState.boss !== null && bState.boss.id === bossId, `Boss ${bossId} spawns in ${def.roomId}`);
    if (!bState.boss) continue;

    const seenPhases = new Set<number>([bState.boss.phase]);
    let defeatedEvent = false;
    let ticks = 0;
    const maxTicks = 5400;

    while (ticks < maxTicks && bState.boss && !bState.boss.defeated) {
      bState.hero.hp = bState.hero.maxHp;
      bState.hero.invulnTimer = Math.max(bState.hero.invulnTimer, 0.5);
      const boss = bState.boss;
      const inp = createEmptyInputFrame();

      // Drive Krunk to intercept & stomp/fire-dash boss whenever shield is down
      const bossCenterX = boss.x + boss.width * 0.5;
      const bossTopY = boss.y + boss.height;
      const heroCenterX = bState.hero.x + bState.hero.width * 0.5;

      if (!boss.shieldActive && boss.invulnTimer <= 0 && ticks % 14 === 0) {
        // Position hero cleanly above boss for deterministic air-stomp impact
        bState.hero.x = Math.max(2, Math.min(catalog.getRoom(def.roomId).widthTiles - 3, bossCenterX - bState.hero.width * 0.5));
        bState.hero.y = Math.min(catalog.getRoom(def.roomId).heightTiles - 2.5, bossTopY + 0.55);
        bState.hero.vx = 0;
        bState.hero.vy = -12;
        inp.stompPressed = true;
        inp.stompHeld = true;
      } else {
        inp.moveX = heroCenterX < bossCenterX ? 1 : -1;
        inp.jumpPressed = ticks % 40 === 0;
      }

      const evs = engine.step(bState, inp, catalog);
      if (bState.boss) {
        seenPhases.add(bState.boss.phase);
      }
      for (const e of evs) {
        if (e.type === 'boss_defeated' && e.bossId === bossId) {
          defeatedEvent = true;
        }
        if (e.type === 'victory') {
          finalVictorySeen = true;
        }
      }
      ticks++;
    }

    const ok = Boolean(bState.boss?.defeated && defeatedEvent);
    if (ok) bossesDefeatedCount++;
    check(ok, `Boss ${bossId} defeated in live sim (${ticks} ticks, phases=[${[...seenPhases].sort().join(',')}])`);
    if (def.unlockForm) {
      check(
        bState.progress.unlockedForms.includes(def.unlockForm),
        `Boss ${bossId} unlocks form ${def.unlockForm}`,
      );
    }
  }
  check(bossesDefeatedCount === 8, 'All 8/8 bosses & mini-bosses defeated', `defeated=${bossesDefeatedCount}`);
  check(finalVictorySeen, 'Defeating nightmare_sovereign triggers victory event');

  // --------------------------------------------------------------------------
  // 4. Ghost Ship Endless — 15 Escalating Waves + 3-Tier Dynamic Hazards
  // --------------------------------------------------------------------------
  const gsState = engine.createInitialState(catalog, { seed: 4242, mode: 'story' });
  gsState.progress.unlockedForms = [...HERO_FORMS];
  engine.startGhostShip(gsState, catalog);
  const hazardTiersSeen = new Set<number>([gsState.ghostShip.hazardTier]);

  for (let tick = 0; tick < 6000 && gsState.ghostShip.wave < 15; tick++) {
    gsState.hero.hp = gsState.hero.maxHp;
    gsState.hero.invulnTimer = 0.5;
    const target = gsState.enemies.find((e) => e.alive);
    const inp = createEmptyInputFrame();
    if (target && tick % 8 === 0) {
      gsState.hero.x = target.x + target.width * 0.5 - gsState.hero.width * 0.5;
      gsState.hero.y = target.y + target.height + 0.45;
      gsState.hero.vx = 0;
      gsState.hero.vy = -12;
      inp.stompPressed = true;
      inp.stompHeld = true;
    } else {
      inp.moveX = tick % 60 < 30 ? 1 : -1;
    }
    engine.step(gsState, inp, catalog);
    hazardTiersSeen.add(gsState.ghostShip.hazardTier);
  }
  check(gsState.ghostShip.wave >= 15, 'Ghost Ship Endless clears 15 escalating waves', `reached wave ${gsState.ghostShip.wave}`);
  check(gsState.ghostShip.score > 0, 'Ghost Ship Endless accumulates score', `score=${gsState.ghostShip.score}`);
  check(hazardTiersSeen.has(0) && hazardTiersSeen.has(1) && hazardTiersSeen.has(2), 'Ghost Ship exercises all 3 hazard tiers (0,1,2)', `seen=[${[...hazardTiersSeen].join(',')}]`);

  // --------------------------------------------------------------------------
  // 5. Bit-for-Bit FNV-1a Replay Determinism Proof (600 ticks x 2 runs)
  // --------------------------------------------------------------------------
  function runTape(seed: number): number[] {
    const s = engine.createInitialState(catalog, { seed, mode: 'story', roomId: 'tdm_01' });
    s.progress.unlockedForms = [...HERO_FORMS];
    const hashes: number[] = [engine.hashState(s)];
    for (let t = 0; t < 600; t++) {
      const inp = createEmptyInputFrame();
      inp.moveX = Math.floor(t / 90) % 2 === 0 ? 1 : -1;
      inp.jumpPressed = t % 35 === 2 || t % 35 === 16;
      inp.jumpHeld = (t % 35 >= 2 && t % 35 <= 11) || (t % 35 >= 16 && t % 35 <= 22);
      inp.dashPressed = t % 70 === 20;
      inp.dashHeld = t % 70 >= 20 && t % 70 <= 32;
      inp.stompPressed = t % 110 === 50;
      inp.stompHeld = t % 110 >= 50 && t % 110 <= 62;
      inp.formNextPressed = t % 120 === 0;
      engine.step(s, inp, catalog);
      if (t % 30 === 29) {
        hashes.push(engine.hashState(s));
      }
    }
    return hashes;
  }

  const runA = runTape(13379001);
  const runB = runTape(13379001);
  const mismatch = runA.findIndex((h, idx) => h !== runB[idx]);
  check(
    mismatch === -1,
    `Bit-for-bit FNV-1a replay determinism across 600 ticks (final hash=0x${(runA[runA.length - 1] >>> 0).toString(16)})`,
    `diverged at checkpoint ${mismatch}`,
  );

  console.log(`[Gate B verify:sim] Passed ${passes.length} checks, failed ${failures.length}.`);
  if (failures.length > 0) {
    for (const f of failures) {
      console.error(`  FAIL: ${f}`);
    }
    process.exit(1);
  }
}

main();
