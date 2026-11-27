import { describe, expect, it } from 'vitest';
import {
  ARENA_ZOOM,
  COMBO_PRESETS,
  FIXED_DT,
  FORM_PARAMS,
  PHYSICS,
  PPU,
  TileCode,
  createEmptyInputFrame,
  type BossDef,
  type BossId,
  type EnemyArchetypeDef,
  type EnemyArchetypeId,
  type HeroFormDef,
  type HeroFormId,
  type InputFrame,
  type IWorldCatalog,
  type RelicDef,
  type RelicId,
  type RoomDef,
  type SimEvent,
  type SimState,
  type UpgradeDef,
  type UpgradeKey,
} from '../src/contracts/index';
import {
  createSimEngine,
  damageHero,
  nextFloat,
  registerComboEnemyHit,
} from '../src/sim/index';

// ============================================================================
// Minimal Self-Contained Test Catalog Builder (Zero External Data Deps)
// ============================================================================

function parseAsciiGrid(rows: string[]): { widthTiles: number; heightTiles: number; tiles: Uint8Array } {
  const heightTiles = rows.length;
  const widthTiles = rows[0].length;
  const tiles = new Uint8Array(widthTiles * heightTiles);
  const legend: Record<string, TileCode> = {
    '.': TileCode.Empty,
    '#': TileCode.Solid,
    '-': TileCode.OneWay,
    '^': TileCode.Spike,
    'B': TileCode.Breakable,
    'S': TileCode.StoneOverhead,
    'O': TileCode.Bounce,
    'V': TileCode.Vine,
    'A': TileCode.Acid,
    'L': TileCode.Lava,
    'Q': TileCode.Quicksand,
    'C': TileCode.Crumble,
    'X': TileCode.Explosive,
    'G': TileCode.Antigrav,
    'W': TileCode.WindUp,
    '<': TileCode.WindLeft,
    '>': TileCode.WindRight,
    '?': TileCode.SecretWall,
  };
  for (let r = 0; r < heightTiles; r++) {
    const ty = heightTiles - 1 - r;
    const line = rows[r];
    for (let tx = 0; tx < widthTiles; tx++) {
      tiles[ty * widthTiles + tx] = legend[line[tx]] ?? TileCode.Empty;
    }
  }
  return { widthTiles, heightTiles, tiles };
}

function makeRoom(
  id: string,
  ascii: string[],
  overrides: Partial<RoomDef> = {},
): RoomDef {
  const grid = parseAsciiGrid(ascii);
  return {
    id,
    name: id,
    biome: 'TDM',
    mode: 'normal',
    mapX: 0,
    mapY: 0,
    widthTiles: grid.widthTiles,
    heightTiles: grid.heightTiles,
    tiles: grid.tiles,
    defaultSpawnX: 2,
    defaultSpawnY: 1,
    exits: [],
    enemies: [],
    coins: [],
    crystals: [],
    props: [],
    ...overrides,
  };
}

function makeTestCatalog(rooms: RoomDef[]): IWorldCatalog {
  const roomMap = new Map<string, RoomDef>();
  for (const r of rooms) roomMap.set(r.id, r);

  const upgrades: UpgradeDef[] = [
    { id: 0, key: 'ExtraLife', name: 'Extra Life', description: '+1 HP', shop: 'vespera', basePrice: 700, priceStep: 700, maxLevel: 5 },
    { id: 1, key: 'ItemSlot', name: 'Item Slot', description: '+1 Relic Slot', shop: 'vespera', basePrice: 2100, priceStep: 3500, maxLevel: 2 },
    { id: 2, key: 'CrystallineHunger', name: 'Crystalline Hunger', description: '+35% crystals', shop: 'orla', basePrice: 1750, priceStep: 0, maxLevel: 1, requiredForm: 'krunk_basic' },
    { id: 3, key: 'LeafCombo', name: 'Leaf Combo', description: '0.25x decay', shop: 'orla', basePrice: 3500, priceStep: 0, maxLevel: 1, requiredForm: 'krunk_leaf' },
    { id: 4, key: 'LeafExtraJump', name: 'Leaf Extra Jump', description: 'Boost', shop: 'orla', basePrice: 3500, priceStep: 0, maxLevel: 1, requiredForm: 'krunk_leaf' },
    { id: 5, key: 'StompFlame', name: 'Stomp Flame', description: 'Flame burst', shop: 'orla', basePrice: 3500, priceStep: 0, maxLevel: 1, requiredForm: 'krunk_fire' },
    { id: 6, key: 'DashFlame', name: 'Dash Flame', description: 'Invuln dash', shop: 'orla', basePrice: 3500, priceStep: 0, maxLevel: 1, requiredForm: 'krunk_fire' },
    { id: 7, key: 'RockShield', name: 'Rock Shield', description: '1-hit shield', shop: 'orla', basePrice: 5250, priceStep: 0, maxLevel: 1, requiredForm: 'krunk_rock' },
    { id: 8, key: 'RockUppercutInvuln', name: 'Rock Invuln', description: 'Uppercut invuln', shop: 'orla', basePrice: 5250, priceStep: 0, maxLevel: 1, requiredForm: 'krunk_rock' },
    { id: 9, key: 'VoltRange', name: 'Volt Range', description: '+2u range & 45u/s blink', shop: 'orla', basePrice: 5250, priceStep: 0, maxLevel: 1, requiredForm: 'krunk_electric' },
    { id: 10, key: 'VoltShield', name: 'Volt Shield', description: '2s post-blink invuln', shop: 'orla', basePrice: 5250, priceStep: 0, maxLevel: 1, requiredForm: 'krunk_electric' },
    { id: 11, key: 'IronSkin', name: 'Iron Skin', description: 'No recoil + 1.25x invuln', shop: 'vespera', basePrice: 1750, priceStep: 0, maxLevel: 1 },
    { id: 12, key: 'TripleJump', name: 'Triple Jump', description: '3rd jump', shop: 'orla', basePrice: 7000, priceStep: 0, maxLevel: 1, requiredForm: 'krunk_basic' },
    { id: 13, key: 'RockUppercutPower', name: 'Rock Power', description: '18u/s uppercut', shop: 'orla', basePrice: 7000, priceStep: 0, maxLevel: 1, requiredForm: 'krunk_rock' },
    { id: 14, key: 'DashRoundFire', name: 'Dash Fire Ring', description: 'Orbiting flames', shop: 'orla', basePrice: 3500, priceStep: 0, maxLevel: 1, requiredForm: 'krunk_fire' },
    { id: 15, key: 'ViewMapExits', name: 'Map Exits', description: 'Map exits', shop: 'orla', basePrice: 3500, priceStep: 0, maxLevel: 1 },
    { id: 16, key: 'ViewSecretAreas', name: 'Secret Areas', description: 'Secrets', shop: 'orla', basePrice: 3500, priceStep: 0, maxLevel: 1 },
    { id: 17, key: 'ViewMapArenas', name: 'Map Arenas', description: 'Arenas', shop: 'orla', basePrice: 3500, priceStep: 0, maxLevel: 1 },
  ];

  const relics: RelicDef[] = [
    { id: 'providential_shield', name: 'Providential Shield', description: 'Blocks 1st room hit', price: 1400, iconColor: '#fff' },
    { id: 'crystal_abundance', name: 'Crystal Abundance', description: '+50% crystals', price: 2100, iconColor: '#0ff' },
    { id: 'maniac_crystal', name: 'Maniac Crystal', description: '1.5x combo + freeze', price: 3000, iconColor: '#f0f' },
    { id: 'old_clock', name: 'Old Clock', description: 'Slowmo on bounce', price: 1400, iconColor: '#ff0' },
    { id: 'evil_ring', name: 'Evil Ring', description: 'Shockwave on hurt', price: 3500, iconColor: '#f00' },
    { id: 'magnet', name: 'Magnet', description: 'Vacuum crystals', price: 3500, iconColor: '#aaa' },
    { id: 'lively_heart', name: 'Lively Heart', description: '+1 Max HP', price: 3000, iconColor: '#f44' },
    { id: 'rebirth_amulet', name: 'Rebirth Amulet', description: 'Revive once', price: 1400, iconColor: '#fa0' },
    { id: 'platinum_medal', name: 'Platinum Medal', description: 'Keep combo', price: 2100, iconColor: '#eee' },
    { id: 'bandit_shorts', name: 'Bandit Shorts', description: '35% dodge', price: 3500, iconColor: '#840' },
    { id: 'turtle_shell', name: 'Turtle Shell', description: 'Spike stomp guard', price: 3000, iconColor: '#0a0' },
    { id: 'extra_coin', name: 'Extra Coin', description: 'Bonus crystals', price: 2100, iconColor: '#fd0' },
    { id: 'magic_feather', name: 'Magic Feather', description: '1.2x bounce', price: 5000, iconColor: '#8cf' },
    { id: 'vampiric_amulet', name: 'Vampiric Amulet', description: 'Heal on max combo', price: 5000, iconColor: '#a06' },
    { id: 'magic_shield', name: 'Magic Shield', description: '3s shield', price: 1750, iconColor: '#48f' },
    { id: 'magic_coin', name: 'Magic Coin', description: 'Keep crystals on death', price: 2100, iconColor: '#fc4' },
  ];

  const forms: HeroFormDef[] = [
    { id: 'krunk_basic', name: 'Basic', abilityName: 'Stomp', description: '', palette: ['#111', '#222', '#333', '#444', '#555', '#666'], wallSlideVelY: -4.0, defaultUnlocked: true },
    { id: 'krunk_fire', name: 'Fire', abilityName: 'Flame Dash', description: '', palette: ['#111', '#222', '#333', '#444', '#555', '#666'], wallSlideVelY: -2.0, defaultUnlocked: false },
    { id: 'krunk_leaf', name: 'Leaf', abilityName: 'Leaf Glide', description: '', palette: ['#111', '#222', '#333', '#444', '#555', '#666'], wallSlideVelY: -2.0, defaultUnlocked: false },
    { id: 'krunk_rock', name: 'Rock', abilityName: 'Stone Uppercut', description: '', palette: ['#111', '#222', '#333', '#444', '#555', '#666'], wallSlideVelY: -2.0, defaultUnlocked: false },
    { id: 'krunk_electric', name: 'Electric', abilityName: 'Volt Blink', description: '', palette: ['#111', '#222', '#333', '#444', '#555', '#666'], wallSlideVelY: -2.0, defaultUnlocked: false },
    { id: 'krunk_shadow', name: 'Shadow', abilityName: 'Shadow Blink', description: '', palette: ['#111', '#222', '#333', '#444', '#555', '#666'], wallSlideVelY: -2.0, defaultUnlocked: false },
  ];

  const enemies = new Map<EnemyArchetypeId, EnemyArchetypeDef>([
    ['goomba', { id: 'goomba', name: 'Goomba', hp: 1, width: 0.8, height: 0.8, speed: 2.0, flying: false, armoredTop: false, shoots: false, shootCooldown: 3, crystalValue: 10, primaryColor: '#a44', accentColor: '#ff0' }],
    ['horned_beetle', { id: 'horned_beetle', name: 'Horned Beetle', hp: 2, width: 0.9, height: 0.8, speed: 1.8, flying: false, armoredTop: true, shoots: false, shootCooldown: 3, crystalValue: 20, primaryColor: '#44a', accentColor: '#fff' }],
    ['bee', { id: 'bee', name: 'Bee', hp: 1, width: 0.8, height: 0.8, speed: 2.5, flying: true, armoredTop: false, shoots: false, shootCooldown: 3, crystalValue: 15, primaryColor: '#fa0', accentColor: '#111' }],
    ['spitter', { id: 'spitter', name: 'Spitter', hp: 2, width: 0.85, height: 0.85, speed: 1.0, flying: false, armoredTop: false, shoots: true, shootCooldown: 1.2, crystalValue: 20, primaryColor: '#4a4', accentColor: '#8f8' }],
  ]);

  const bosses = new Map<BossId, BossDef>([
    [
      'primal_eye',
      {
        id: 'primal_eye',
        name: 'Primal Eye',
        subtitle: 'Guardian of the Canopy',
        biome: 'AP',
        roomId: rooms[rooms.length - 1]?.id ?? 'room_a',
        maxHp: 20,
        isMiniBoss: false,
        unlockForm: 'krunk_leaf',
        width: 2.2,
        height: 2.2,
        crystalReward: 500,
        coinReward: 1,
      },
    ],
  ]);

  return {
    startRoomId: rooms[0].id,
    hubRoomId: rooms[0].id,
    ghostShipRoomId: rooms[0].id,
    rooms: roomMap,
    roomOrder: rooms.map((r) => r.id),
    upgrades,
    relics,
    forms,
    enemies,
    bosses,
    totalCoins: 200,
    getRoom: (id) => {
      const r = roomMap.get(id);
      if (!r) throw new Error(`Missing room ${id}`);
      return r;
    },
    getUpgrade: (key: UpgradeKey) => {
      const u = upgrades.find((item) => item.key === key);
      if (!u) throw new Error(`Missing upgrade ${key}`);
      return u;
    },
    getRelic: (id: RelicId) => {
      const r = relics.find((item) => item.id === id);
      if (!r) throw new Error(`Missing relic ${id}`);
      return r;
    },
    getForm: (id: HeroFormId) => {
      const f = forms.find((item) => item.id === id);
      if (!f) throw new Error(`Missing form ${id}`);
      return f;
    },
  };
}

function stepN(
  engine: ReturnType<typeof createSimEngine>,
  state: SimState,
  catalog: IWorldCatalog,
  n: number,
  makeInput: (tickIndex: number) => Partial<InputFrame> = () => ({}),
): SimEvent[] {
  const all: SimEvent[] = [];
  for (let i = 0; i < n; i++) {
    const inp: InputFrame = { ...createEmptyInputFrame(), ...makeInput(i) };
    all.push(...engine.step(state, inp, catalog));
  }
  return all;
}

const FLAT_ROOM_ASCII = [
  '########################',
  '#......................#',
  '#......................#',
  '#......................#',
  '#......................#',
  '#......................#',
  '#......................#',
  '#......................#',
  '#......................#',
  '#......................#',
  '#......................#',
  '########################',
];

// ============================================================================
// 1. Swept Collision, Zero Tunneling, Corner Nudge & Special Tiles
// ============================================================================

describe('Swept AABB Collision & Special Tiles', () => {
  it('never tunnels through a 1-tile solid wall at 45 u/s Volt Blink speed', () => {
    const room = makeRoom('volt_wall', [
      '####################',
      '#..................#',
      '#..................#',
      '#......#...........#',
      '#......#...........#',
      '#......#...........#',
      '#......#...........#',
      '#......#...........#',
      '####################',
    ], {
      defaultSpawnX: 4.5,
      defaultSpawnY: 3.5,
      props: [{ id: 'node_behind_wall', kind: 'volt_node', x: 9, y: 3.5 }],
    });
    const catalog = makeTestCatalog([room]);
    const engine = createSimEngine();
    const state = engine.createInitialState(catalog, {
      progress: {
        unlockedForms: ['krunk_basic', 'krunk_electric'],
        upgradeLevels: { VoltRange: 1 } as Record<UpgradeKey, number>,
      },
    });

    state.hero.form = 'krunk_electric';
    state.hero.x = 5.5;
    state.hero.y = 4.0;
    state.hero.grounded = false;
    state.hero.action = 'volt_blink';
    state.hero.voltTargetId = 'node_behind_wall';
    state.hero.voltTargetX = 9.5;
    state.hero.voltTargetY = 4.0;
    state.hero.vx = FORM_PARAMS.VOLT_BLINK_SPEED_UPGRADED; // 45 u/s
    state.hero.vy = 0;

    stepN(engine, state, catalog, 8);

    // Wall sits at tx = 7 ([7.0, 8.0]); hero right edge must remain <= 7.0!
    expect(state.hero.x + state.hero.width).toBeLessThanOrEqual(7.001);
  });

  it('never tunnels through a 1-tile floor or OneWay platform during 18 u/s Air Stomp', () => {
    const room = makeRoom('stomp_floor', [
      '##############',
      '#............#',
      '#............#',
      '#............#',
      '#...------...#',
      '#............#',
      '#............#',
      '##############',
    ], { defaultSpawnX: 5, defaultSpawnY: 5.2 });
    const catalog = makeTestCatalog([room]);
    const engine = createSimEngine();
    const state = engine.createInitialState(catalog);

    // Air stomp onto OneWay platform at ty = 3 (top = 4.0)
    stepN(engine, state, catalog, 1, () => ({ stompPressed: true, stompHeld: true }));
    expect(state.hero.action).toBe('air_stomp');
    expect(state.hero.vy).toBe(-PHYSICS.MAX_FALL_SPEED);

    stepN(engine, state, catalog, 15);
    expect(state.hero.grounded).toBe(true);
    expect(state.hero.y).toBeCloseTo(4.0, 3);
  });

  it('performs 0.125u (4px) upward ceiling corner nudge without bonking', () => {
    const room = makeRoom('nudge', [
      '############',
      '#..........#',
      '#..........#',
      '#....##....#',
      '#..........#',
      '#..........#',
      '############',
    ], { defaultSpawnX: 2, defaultSpawnY: 1 });
    const catalog = makeTestCatalog([room]);
    const engine = createSimEngine();
    const state = engine.createInitialState(catalog);

    // Ceiling solid tiles at tx = 5, 6 and ty = 3 (y in [3, 4]).
    // Place hero so right edge overlaps tx = 5 by 0.10u (<= 0.125u corner nudge)
    // Hero width = 0.75 -> x = 4.35 -> right edge = 5.10 (0.10u overlap)
    state.hero.x = 4.35;
    state.hero.y = 2.0;
    state.hero.vy = 12.0;
    state.hero.grounded = false;
    state.hero.action = 'jump';

    stepN(engine, state, catalog, 4);

    // Hero should have nudged left to x = 4.25 and risen PAST y = 3.0 without bonking!
    expect(state.hero.x).toBeCloseTo(4.25, 2);
    expect(state.hero.y + state.hero.height).toBeGreaterThan(3.05);
    expect(state.hero.vy).toBeGreaterThan(0);

    // Now test overlap > 0.125u (0.30u overlap -> x = 4.55 -> right edge = 5.30): MUST bonk!
    state.hero.x = 4.55;
    state.hero.y = 2.05;
    state.hero.vy = 12.0;
    stepN(engine, state, catalog, 2);
    expect(state.hero.vy).toBeLessThanOrEqual(0);
    expect(state.hero.y + state.hero.height).toBeLessThanOrEqual(3.001);
  });

  it('handles Bounce pad (18.0 u/s & 0.75x Antigrav), Quicksand (0.2x), Crumble, Explosive, and Moving Platforms', () => {
    const room = makeRoom('tiles_suite', [
      '########################',
      '#......................#',
      '#......................#',
      '#........GG............#',
      '#........GG............#',
      '#....O...OG...QQQ..C...#',
      '#...................BXB#',
      '########################',
    ], {
      defaultSpawnX: 5.1,
      defaultSpawnY: 3.5,
      props: [
        { id: 'plat1', kind: 'moving_platform', x: 12, y: 4, width: 2, height: 0.5, moveDx: 2, moveDy: 0, periodSec: 2 },
      ],
    });
    const catalog = makeTestCatalog([room]);
    const engine = createSimEngine();
    const state = engine.createInitialState(catalog);

    // 1. Bounce pad normal (18.0 u/s) — tile O at tx=5, ty=2 (top = 3.0)
    const ev1 = stepN(engine, state, catalog, 20);
    expect(ev1.some((e) => e.type === 'bounce_pad')).toBe(true);
    expect(state.hero.y).toBeGreaterThan(4.5);

    // 2. Bounce pad inside Antigrav (0.75x = 13.5 u/s)
    state.hero.x = 9.1;
    state.hero.y = 3.2;
    state.hero.vy = -5;
    state.hero.inAntigrav = true;
    let bouncedVy = 0;
    for (let i = 0; i < 10; i++) {
      const ev = engine.step(state, createEmptyInputFrame(), catalog);
      if (ev.some((e) => e.type === 'bounce_pad')) {
        bouncedVy = state.hero.vy;
        break;
      }
    }
    expect(bouncedVy).toBeCloseTo(18.0 * PHYSICS.ANTIGRAV_BOUNCE_MULT, 1);

    // 3. Quicksand (0.2x speed) — Q at tx=14..16, ty=2
    state.hero.x = 14.5;
    state.hero.y = 2.1;
    state.hero.vx = 0;
    state.hero.vy = 0;
    stepN(engine, state, catalog, 25, () => ({ moveX: 1 }));
    expect(state.hero.inQuicksand).toBe(true);
    expect(Math.abs(state.hero.vx)).toBeLessThanOrEqual(PHYSICS.MAX_SPEED * PHYSICS.QUICKSAND_MULT + 0.1);

    // 4. Crumble tile at tx=19, ty=2 breaks after standing 0.45s
    state.hero.x = 19.1;
    state.hero.y = 3.0;
    state.hero.vx = 0;
    state.hero.vy = 0;
    state.hero.grounded = true;
    const crumbleIdx = 2 * room.widthTiles + 19;
    expect(state.roomTiles[crumbleIdx]).toBe(TileCode.Crumble);
    stepN(engine, state, catalog, 35);
    expect(state.roomTiles[crumbleIdx]).toBe(TileCode.Empty);

    // 5. Explosive tile at tx=21, ty=1 chain-breaks adjacent Breakable at tx=20, 22 when air-stomped
    state.hero.x = 21.1;
    state.hero.y = 3.2;
    state.hero.vx = 0;
    state.hero.vy = 0;
    state.hero.grounded = false;
    const expEvents = stepN(engine, state, catalog, 12, (i) => ({ stompPressed: i === 0, stompHeld: true }));
    expect(expEvents.some((e) => e.type === 'block_break' && e.explosive)).toBe(true);
    expect(state.roomTiles[1 * room.widthTiles + 21]).toBe(TileCode.Empty);
    expect(state.roomTiles[1 * room.widthTiles + 20]).toBe(TileCode.Empty);
    expect(state.roomTiles[1 * room.widthTiles + 22]).toBe(TileCode.Empty);

    // 6. Moving platform carries hero horizontally
    state.hero.x = state.platforms[0].x + 0.5;
    state.hero.y = state.platforms[0].y + state.platforms[0].height;
    state.hero.vx = 0;
    state.hero.vy = 0;
    state.hero.grounded = true;
    const startX = state.hero.x;
    stepN(engine, state, catalog, 15);
    expect(Math.abs(state.hero.x - startX)).toBeGreaterThan(0.5);
    expect(state.hero.grounded).toBe(true);
  });
});

// ============================================================================
// 2. Hero Physics: Variable Jump, Coyote, Pre-Jump, Wall, Ground Dash, Stomp, Vines
// ============================================================================

describe('Hero Core Physics Feel', () => {
  it('supports variable jump height, coyote time, pre-jump buffer, double jump, and TripleJump', () => {
    const room = makeRoom('jump_lab', [
      '########################',
      '#......................#',
      '#......................#',
      '#......................#',
      '#......................#',
      '#......................#',
      '#......................#',
      '#...####...............#',
      '#......................#',
      '########################',
    ], { defaultSpawnX: 5, defaultSpawnY: 3 });
    const catalog = makeTestCatalog([room]);
    const engine = createSimEngine();

    // Short tap vs full hold jump height
    const sTap = engine.createInitialState(catalog);
    sTap.hero.x = 10;
    sTap.hero.y = 1;
    stepN(engine, sTap, catalog, 2); // settle grounded
    let maxTapY = sTap.hero.y;
    for (let i = 0; i < 35; i++) {
      engine.step(sTap, { ...createEmptyInputFrame(), jumpPressed: i === 0, jumpHeld: i === 0 }, catalog);
      maxTapY = Math.max(maxTapY, sTap.hero.y);
    }

    const sHold = engine.createInitialState(catalog);
    sHold.hero.x = 10;
    sHold.hero.y = 1;
    stepN(engine, sHold, catalog, 2);
    let maxHoldY = sHold.hero.y;
    for (let i = 0; i < 45; i++) {
      engine.step(sHold, { ...createEmptyInputFrame(), jumpPressed: i === 0, jumpHeld: i < 15 }, catalog);
      maxHoldY = Math.max(maxHoldY, sHold.hero.y);
    }
    expect(maxHoldY - 1).toBeGreaterThan((maxTapY - 1) + 1.2);

    // Coyote time: step off ledge at tx=7 (x in [4, 8]), jump 3 ticks (0.05s < 0.10s) after leaving ground
    const sCoyote = engine.createInitialState(catalog);
    sCoyote.hero.x = 7.95;
    sCoyote.hero.y = 3.0;
    stepN(engine, sCoyote, catalog, 1); // grounded on ledge
    expect(sCoyote.hero.grounded).toBe(true);
    stepN(engine, sCoyote, catalog, 4, () => ({ moveX: 1 })); // walk off edge past x=8.0
    expect(sCoyote.hero.grounded).toBe(false);
    expect(sCoyote.hero.coyoteTimer).toBeGreaterThan(0);
    const coyoteEv = stepN(engine, sCoyote, catalog, 1, () => ({ jumpPressed: true, jumpHeld: true }));
    expect(coyoteEv.some((e) => e.type === 'jump' && !e.air)).toBe(true);

    // Pre-jump buffer: press jump 3 ticks before touching floor -> jumps on landing
    const sPre = engine.createInitialState(catalog);
    sPre.hero.x = 12;
    sPre.hero.y = 1.25;
    sPre.hero.vy = -8;
    sPre.hero.jumpsRemaining = 0; // force ground jump only
    const preEv = stepN(engine, sPre, catalog, 6, (i) => ({ jumpPressed: i === 0, jumpHeld: true }));
    expect(preEv.some((e) => e.type === 'jump' && !e.air)).toBe(true);

    // TripleJump upgrade adds 2nd midair jump (3rd total jump) in krunk_basic
    const sTriple = engine.createInitialState(catalog, {
      progress: { upgradeLevels: { TripleJump: 1 } as Record<UpgradeKey, number> },
    });
    sTriple.hero.x = 12;
    sTriple.hero.y = 1;
    stepN(engine, sTriple, catalog, 2);
    expect(sTriple.hero.maxAirJumps).toBe(2);
    const j1 = stepN(engine, sTriple, catalog, 1, () => ({ jumpPressed: true }));
    expect(j1.some((e) => e.type === 'jump' && !e.air)).toBe(true);
    stepN(engine, sTriple, catalog, 2);
    const j2 = stepN(engine, sTriple, catalog, 1, () => ({ jumpPressed: true }));
    expect(j2.some((e) => e.type === 'jump' && e.air)).toBe(true);
    expect(sTriple.hero.vy).toBeCloseTo(PHYSICS.DOUBLE_JUMP_FORCE, 1);
    stepN(engine, sTriple, catalog, 2);
    const j3 = stepN(engine, sTriple, catalog, 1, () => ({ jumpPressed: true }));
    expect(j3.some((e) => e.type === 'jump' && e.air)).toBe(true);
    expect(sTriple.hero.jumpsRemaining).toBe(0);
  });

  it('handles press-into wall slide (-4.0 basic vs -2.0 form), 3x wall jump, 0.5x decay wall dash, jump-preserving ground dash, and slippery vines', () => {
    const room = makeRoom('wall_vine', [
      '##################',
      '#................#',
      '#..#..........V..#',
      '#..#..........V..#',
      '#..#..........V..#',
      '#..#..........V..#',
      '#..#..........V..#',
      '#..#.............#',
      '##################',
    ], { defaultSpawnX: 4.02, defaultSpawnY: 5.5 });
    const catalog = makeTestCatalog([room]);
    const engine = createSimEngine();

    // Does NOT auto-stick to wall when not pressing into it
    const sNoStick = engine.createInitialState(catalog);
    sNoStick.hero.vy = -4;
    stepN(engine, sNoStick, catalog, 4);
    expect(sNoStick.hero.action).not.toBe('wall_slide');

    // Wall slide basic (pressing INTO left wall -> arrests fall, lerps toward -4.0, saliva active)
    const sBasic = engine.createInitialState(catalog);
    sBasic.hero.vy = -10;
    stepN(engine, sBasic, catalog, 12, () => ({ moveX: -1 }));
    expect(sBasic.hero.action).toBe('wall_slide');
    expect(sBasic.hero.wallSalivaActive).toBe(true);
    expect(sBasic.hero.tongueKind).toBe('wall_slide');
    expect(sBasic.hero.vy).toBeLessThan(0);
    expect(sBasic.hero.vy).toBeGreaterThanOrEqual(PHYSICS.WALL_SLIDE_BASIC - 0.1);

    // Wall jump (15.0 = 3x wallJumpForce.x, vy = 10.0 jumpForce) away from left wall (onWall = -1 -> dir = +1)
    const wjEv = stepN(engine, sBasic, catalog, 1, () => ({ jumpPressed: true, jumpHeld: true, moveX: -1 }));
    expect(wjEv.some((e) => e.type === 'wall_jump' && e.dir === 1)).toBe(true);
    expect(sBasic.hero.vx).toBeCloseTo(PHYSICS.WALL_JUMP_FORCE_X * 3, 1);
    expect(sBasic.hero.vy).toBeCloseTo(PHYSICS.JUMP_FORCE, 1);

    // Wall slide form (lerps gently toward -2.0) + Wall dash (17.0, 8.0 with 0.5x decay rate!)
    const sForm = engine.createInitialState(catalog, {
      progress: { unlockedForms: ['krunk_basic', 'krunk_fire'] },
    });
    sForm.hero.form = 'krunk_fire';
    sForm.hero.vy = -10;
    stepN(engine, sForm, catalog, 25, () => ({ moveX: -1 }));
    expect(sForm.hero.action).toBe('wall_slide');
    expect(sForm.hero.vy).toBeGreaterThanOrEqual(PHYSICS.WALL_SLIDE_FORM - 0.1);

    const wdEv = stepN(engine, sForm, catalog, 1, () => ({ dashPressed: true, moveX: -1 }));
    expect(wdEv.some((e) => e.type === 'dash' && e.kind === 'wall')).toBe(true);
    expect(wdEv.some((e) => e.type === 'tongue_lash' && e.kind === 'wall_dash')).toBe(true);
    expect(sForm.hero.tongueKind).toBe('wall_dash');
    expect(sForm.hero.vx).toBeCloseTo(PHYSICS.WALL_STOMP_FORCE_X, 1);
    expect(sForm.hero.vy).toBeCloseTo(PHYSICS.WALL_STOMP_FORCE_Y, 1);
    // 0.5x decay rate over 15 ticks (0.25s): vx loses ~2.6 u/s -> stays > 13.5 u/s!
    stepN(engine, sForm, catalog, 15);
    expect(sForm.hero.vx).toBeGreaterThan(13.0);

    // Ground dash (17.0, 12.0) decaying smoothly over 0.55s AND preserving horizontal burst across mid-dash jump!
    const sDash = engine.createInitialState(catalog);
    sDash.hero.x = 5;
    sDash.hero.y = 1;
    stepN(engine, sDash, catalog, 2);
    const gdEv = stepN(engine, sDash, catalog, 1, () => ({ dashPressed: true }));
    expect(gdEv.some((e) => e.type === 'tongue_lash' && e.kind === 'ground_dash')).toBe(true);
    expect(sDash.hero.action).toBe('ground_dash');
    expect(sDash.hero.tongueKind).toBe('ground_dash');
    expect(sDash.hero.vx).toBeCloseTo(PHYSICS.GROUND_STOMP_FORCE_X, 1);
    expect(sDash.hero.vy).toBeCloseTo(PHYSICS.GROUND_STOMP_FORCE_Y, 1);
    // Double jump 5 ticks into ground dash MUST NOT cancel groundDashTimer or kill vx!
    stepN(engine, sDash, catalog, 5);
    const vxBeforeJump = sDash.hero.vx;
    stepN(engine, sDash, catalog, 1, () => ({ jumpPressed: true }));
    expect(sDash.hero.groundDashTimer).toBeGreaterThan(0.35);
    expect(sDash.hero.vx).toBeGreaterThan(vxBeforeJump - 0.8);
    expect(sDash.hero.vy).toBeCloseTo(PHYSICS.DOUBLE_JUMP_FORCE, 1);
    stepN(engine, sDash, catalog, 35);
    expect(Math.abs(sDash.hero.vx)).toBeLessThanOrEqual(PHYSICS.MAX_SPEED + 0.2);

    // Slippery vines: slides 3.0 -> 10.0 u/s, jump adds +-12.0 X + 13.0 Y
    const sVine = engine.createInitialState(catalog);
    sVine.hero.x = 14.0;
    sVine.hero.y = 5.5;
    sVine.hero.vy = -1.0;
    stepN(engine, sVine, catalog, 6);
    expect(sVine.hero.action).toBe('vine_slide');
    expect(sVine.hero.vy).toBeLessThanOrEqual(-PHYSICS.VINE_SLIDE_MIN);
    expect(sVine.hero.vy).toBeGreaterThanOrEqual(-PHYSICS.VINE_SLIDE_MAX);
    stepN(engine, sVine, catalog, 1, () => ({ jumpPressed: true, moveX: -1 }));
    expect(sVine.hero.vx).toBeCloseTo(-PHYSICS.VINE_JUMP_IMPULSE_X, 1);
    expect(sVine.hero.vy).toBeCloseTo(PHYSICS.DOUBLE_JUMP_FORCE, 1);
  });

  it('executes Air Stomp enemy bounce (18.0 u/s, x1.2 Magic Feather, x0.75 Antigrav)', () => {
    const room = makeRoom('stomp_enemy', FLAT_ROOM_ASCII, {
      defaultSpawnX: 8,
      defaultSpawnY: 3.5,
      enemies: [{ id: 'e1', archetype: 'horned_beetle', x: 8, y: 1, patrolMinX: 7, patrolMaxX: 9 }],
    });
    const catalog = makeTestCatalog([room]);
    const engine = createSimEngine();

    // Base stomp bounce = 18.0 u/s (also pierces armoredTop!)
    const s1 = engine.createInitialState(catalog);
    stepN(engine, s1, catalog, 1, () => ({ stompPressed: true }));
    let peakVy = 0;
    for (let i = 0; i < 20; i++) {
      const ev = engine.step(s1, createEmptyInputFrame(), catalog);
      if (ev.some((e) => e.type === 'enemy_hit')) {
        peakVy = s1.hero.vy;
        break;
      }
    }
    expect(peakVy).toBeCloseTo(PHYSICS.ENEMY_JUMP_FORCE * PHYSICS.STOMP_BOUNCE_MULT, 1);
    expect(s1.enemies[0].alive).toBe(false);

    // With Magic Feather -> 18.0 * 1.2 = 21.6 u/s
    const s2 = engine.createInitialState(catalog, {
      progress: { ownedRelics: ['magic_feather'], equippedRelics: ['magic_feather'] },
    });
    stepN(engine, s2, catalog, 1, () => ({ stompPressed: true }));
    let featherVy = 0;
    for (let i = 0; i < 20; i++) {
      const ev = engine.step(s2, createEmptyInputFrame(), catalog);
      if (ev.some((e) => e.type === 'enemy_hit')) {
        featherVy = s2.hero.vy;
        break;
      }
    }
    expect(featherVy).toBeCloseTo(18.0 * PHYSICS.MAGIC_FEATHER_MULT, 1);
  });
});

// ============================================================================
// 3. All 6 Elemental Forms & Upgrades
// ============================================================================

describe('All 6 Hero Forms & Upgrades', () => {
  it('krunk_fire: Flame Rocket Dash kills enemies & refreshes midair, StompFlame, DashFlame, DashRoundFire', () => {
    const room = makeRoom('fire_lab', [
      '####################',
      '#..................#',
      '#..................#',
      '#..................#',
      '#..................#',
      '#.........B........#',
      '####################',
    ], {
      defaultSpawnX: 4,
      defaultSpawnY: 3.5,
      enemies: [{ id: 'bee1', archetype: 'bee', x: 7.2, y: 3.5, patrolMinX: 6.5, patrolMaxX: 8.5 }],
    });
    const catalog = makeTestCatalog([room]);
    const engine = createSimEngine();
    const state = engine.createInitialState(catalog, {
      progress: {
        unlockedForms: ['krunk_basic', 'krunk_fire'],
        upgradeLevels: {
          DashFlame: 1,
          StompFlame: 1,
          DashRoundFire: 1,
        } as Record<UpgradeKey, number>,
      },
    });
    state.hero.form = 'krunk_fire';
    state.hero.jumpsRemaining = 0;

    // Trigger Flame Rocket Dash
    stepN(engine, state, catalog, 1, () => ({ dashPressed: true, dashHeld: true, moveX: 1 }));
    expect(state.hero.action).toBe('fire_dash');
    expect(state.hero.vx).toBeCloseTo(FORM_PARAMS.FIRE_DASH_SPEED, 1);
    expect(state.hero.vy).toBe(0);

    // DashFlame makes hero invulnerable during fire_dash
    const dmgRes = damageHero(state, 1, state.hero.x, [], 'enemy');
    expect(dmgRes.tookDamage).toBe(false);

    // Dash through bee -> kills bee and refreshes air ability + double jump!
    stepN(engine, state, catalog, 18, () => ({ dashHeld: true, moveX: 1 }));
    expect(state.enemies[0].alive).toBe(false);
    expect(state.hero.abilityUsedInAir).toBe(false);
    expect(state.hero.jumpsRemaining).toBe(state.hero.maxAirJumps);

    // StompFlame breaks nearby Breakable block at (10, 1) when landing nearby
    // (Clear celebratory max-combo slowmo from killing the room's sole enemy before testing stomp timing)
    state.slowmoTimer = 0;
    state.slowmoScale = 1.0;
    state.hitstopTicks = 0;
    state.hero.x = 9.0;
    state.hero.y = 3.0;
    state.hero.grounded = false;
    const stompEv = stepN(engine, state, catalog, 15, (i) => ({ stompPressed: i === 0 }));
    expect(stompEv.some((e) => e.type === 'stomp_impact' && e.explosive)).toBe(true);
    expect(state.roomTiles[1 * room.widthTiles + 10]).toBe(TileCode.Empty);
  });

  it('krunk_leaf: Leaf Glide (-1.0 vy, +5.2 wind updraft, cancels air_stomp), LeafExtraJump on Jump (+13.0), LeafCombo (0.25x decay)', () => {
    const room = makeRoom('leaf_lab', [
      '################',
      '#..............#',
      '#.........WW...#',
      '#.........WW...#',
      '#.........WW...#',
      '#.........WW...#',
      '#.........WW...#',
      '################',
    ], { defaultSpawnX: 3, defaultSpawnY: 5.5 });
    const catalog = makeTestCatalog([room]);
    const engine = createSimEngine();
    const state = engine.createInitialState(catalog, {
      progress: {
        unlockedForms: ['krunk_basic', 'krunk_leaf'],
        upgradeLevels: { LeafExtraJump: 1, LeafCombo: 1 } as Record<UpgradeKey, number>,
      },
    });
    state.hero.form = 'krunk_leaf';
    state.hero.maxAirJumps = 2;
    state.hero.jumpsRemaining = 2;

    // LeafExtraJump grants 3rd jump (2 air jumps) on Jump button!
    stepN(engine, state, catalog, 1, () => ({ jumpPressed: true, jumpHeld: true }));
    expect(state.hero.vy).toBeCloseTo(FORM_PARAMS.LEAF_EXTRA_JUMP_VY, 1);
    expect(state.hero.jumpsRemaining).toBe(1);
    stepN(engine, state, catalog, 1, () => ({ jumpPressed: true, jumpHeld: true }));
    expect(state.hero.vy).toBeCloseTo(FORM_PARAMS.LEAF_EXTRA_JUMP_VY, 1);
    expect(state.hero.jumpsRemaining).toBe(0);

    // Holding Dash cancels AirStomp straight into Leaf Glide (-1.0 vy)
    stepN(engine, state, catalog, 1, () => ({ stompPressed: true }));
    expect(state.hero.action).toBe('air_stomp');
    stepN(engine, state, catalog, 1, () => ({ dashPressed: true, dashHeld: true }));
    expect(state.hero.action).toBe('leaf_glide');
    stepN(engine, state, catalog, 45, () => ({ dashHeld: true }));
    expect(state.hero.vy).toBeCloseTo(FORM_PARAMS.LEAF_GLIDE_VY, 1);

    // Enter WindUp zone at tx=10..11 -> rises smoothly toward +5.2
    state.hero.x = 10.2;
    state.hero.y = 2.5;
    state.hero.vy = -1.0;
    stepN(engine, state, catalog, 35, () => ({ dashHeld: true }));
    expect(state.hero.vy).toBeGreaterThan(3.5);
    expect(state.hero.vy).toBeLessThanOrEqual(FORM_PARAMS.LEAF_WIND_VY + 0.1);

    // LeafCombo decays at 0.25x rate
    state.combo.count = 1;
    state.combo.timer = 2.0;
    state.hero.action = 'idle';
    stepN(engine, state, catalog, 60); // 1.0s at 0.25x curve
    expect(state.combo.timer).toBeGreaterThan(1.65);
  });

  it('krunk_rock: Stone Uppercut smashes StoneOverhead (13.0 -> 18.0 w/ Power, 0.5x Antigrav), RockShield & UppercutInvuln', () => {
    const room = makeRoom('rock_lab', [
      '################',
      '#..............#',
      '#...SSS........#',
      '#..............#',
      '#..............#',
      '################',
    ], { defaultSpawnX: 4.5, defaultSpawnY: 1.5 });
    const catalog = makeTestCatalog([room]);
    const engine = createSimEngine();
    const state = engine.createInitialState(catalog, {
      progress: {
        unlockedForms: ['krunk_basic', 'krunk_rock'],
        upgradeLevels: {
          RockShield: 1,
          RockUppercutPower: 1,
          RockUppercutInvuln: 1,
        } as Record<UpgradeKey, number>,
      },
    });
    state.hero.form = 'krunk_rock';
    state.hero.grounded = false;

    // Trigger Stone Uppercut
    stepN(engine, state, catalog, 1, () => ({ dashPressed: true, dashHeld: true }));
    expect(state.hero.action).toBe('rock_uppercut');
    expect(state.hero.abilityPhase).toBe(0); // pauseBefore 0.05s

    // Invuln during uppercut
    expect(damageHero(state, 1, state.hero.x, [], 'enemy').tookDamage).toBe(false);

    // After 0.05s (3 ticks), rises at 18.0 u/s and smashes StoneOverhead at ty = 3
    let peakUppercutVy = 0;
    for (let i = 0; i < 18; i++) {
      engine.step(state, { ...createEmptyInputFrame(), dashHeld: true }, catalog);
      peakUppercutVy = Math.max(peakUppercutVy, state.hero.vy);
    }
    expect(peakUppercutVy).toBeCloseTo(FORM_PARAMS.ROCK_UPPERCUT_VY_UPGRADED, 1);
    expect(state.roomTiles[3 * room.widthTiles + 4]).toBe(TileCode.Empty);

    // RockShield absorbs 1 hit cleanly when not in uppercut
    state.hero.action = 'idle';
    state.hero.invulnTimer = 0;
    expect(state.hero.rockShieldActive).toBe(true);
    const hpBefore = state.hero.hp;
    const shieldEv: SimEvent[] = [];
    damageHero(state, 1, 0, shieldEv, 'enemy');
    expect(state.hero.hp).toBe(hpBefore);
    expect(state.hero.rockShieldActive).toBe(false);
    expect(shieldEv.some((e) => e.type === 'hero_hurt' && e.shieldBlocked)).toBe(true);
  });

  it('krunk_electric: Volt Dive 40deg cone lock -> 45u/s Volt Blink -> 15u/s exit sling + midair reset + VoltShield', () => {
    const room = makeRoom('volt_lab', FLAT_ROOM_ASCII, {
      defaultSpawnX: 4,
      defaultSpawnY: 6.5,
      props: [{ id: 'vnode_1', kind: 'volt_node', x: 7.5, y: 4.5 }],
    });
    const catalog = makeTestCatalog([room]);
    const engine = createSimEngine();
    const state = engine.createInitialState(catalog, {
      progress: {
        unlockedForms: ['krunk_basic', 'krunk_electric'],
        upgradeLevels: { VoltRange: 1, VoltShield: 1 } as Record<UpgradeKey, number>,
      },
    });
    state.hero.form = 'krunk_electric';
    state.hero.jumpsRemaining = 0;
    state.hero.grounded = false;

    // Dive right-down toward volt_node inside 40deg cone & 4.5u upgraded range
    stepN(engine, state, catalog, 1, () => ({ dashPressed: true, moveX: 1 }));
    expect(state.hero.action).toBe('volt_blink');
    expect(Math.hypot(state.hero.vx, state.hero.vy)).toBeCloseTo(FORM_PARAMS.VOLT_BLINK_SPEED_UPGRADED, 1);

    // Complete blink -> exit sling at 15.0 u/s, midair reset, VoltShield 2.0s invuln!
    stepN(engine, state, catalog, 10, () => ({ moveY: 1 }));
    expect(state.hero.action).not.toBe('volt_blink');
    expect(state.hero.jumpsRemaining).toBe(state.hero.maxAirJumps);
    expect(state.hero.abilityUsedInAir).toBe(false);
    expect(state.hero.invulnTimer).toBeGreaterThan(1.5);
  });

  it('krunk_shadow: vanish-strike enemy teleport + projectile clear, upward 2.5u ceiling-clamped blink & stomp shockwaves', () => {
    const room = makeRoom('shadow_lab', FLAT_ROOM_ASCII, {
      defaultSpawnX: 8,
      defaultSpawnY: 4,
      enemies: [{ id: 'g1', archetype: 'goomba', x: 11.0, y: 1, patrolMinX: 10.5, patrolMaxX: 11.5 }],
    });
    const catalog = makeTestCatalog([room]);
    const engine = createSimEngine();
    const state = engine.createInitialState(catalog, {
      progress: { unlockedForms: ['krunk_basic', 'krunk_shadow'] },
    });
    state.hero.form = 'krunk_shadow';
    state.hero.grounded = false;

    // 1. Upward 2.5u blink when no enemy is in range (g1 is at dy = -3.0 < -1.5 minDy)
    const startY = state.hero.y;
    stepN(engine, state, catalog, 1, () => ({ dashPressed: true, moveX: 0, moveY: 1 }));
    expect(state.hero.action).toBe('shadow_blink');
    stepN(engine, state, catalog, 7); // past 0.08s vanish -> teleports +2.5u upward!
    expect(state.hero.y).toBeGreaterThan(startY + 2.0);

    // 2. Enemy lock-on vanish-strike teleports onto enemy within 4.5u, strikes it, clears enemy projectiles & resets air ability!
    state.hero.x = 8.5;
    state.hero.y = 1.5;
    state.hero.grounded = false;
    state.hero.abilityUsedInAir = false;
    state.hero.action = 'fall';
    state.projectiles.push({
      id: 999,
      fromHero: false,
      kind: 'spit',
      x: 11.0,
      y: 1.5,
      prevX: 11.0,
      prevY: 1.5,
      vx: 0,
      vy: 0,
      radius: 0.2,
      ttl: 2.0,
      homing: false,
    });
    stepN(engine, state, catalog, 1, () => ({ dashPressed: true }));
    stepN(engine, state, catalog, 7);
    expect(state.enemies[0].alive).toBe(false);
    expect(state.projectiles.some((p) => p.id === 999)).toBe(false);
    expect(state.hero.abilityUsedInAir).toBe(false);

    // 3. Air Stomp in shadow form spawns dual ground shockwaves
    state.slowmoTimer = 0;
    state.slowmoScale = 1.0;
    state.hitstopTicks = 0;
    state.hero.x = 8.0;
    state.hero.y = 3.5;
    state.hero.grounded = false;
    stepN(engine, state, catalog, 1, () => ({ stompPressed: true }));
    stepN(engine, state, catalog, 15);
    expect(state.projectiles.some((p) => p.fromHero && p.kind === 'shockwave')).toBe(true);
  });
});

// ============================================================================
// 4. Combo System, Relics, Upgrades, Economy, Camera, Boss & Determinism
// ============================================================================

describe('Combo System, Relics, Economy, Boss & Determinism', () => {
  it('handles combo decay, freeze, >=95% auto-heal + RockShield restore, max room combo coin & Vampiric Amulet', () => {
    const room = makeRoom('combo_room', FLAT_ROOM_ASCII, {
      mode: 'normal',
      enemies: [
        { id: 'e1', archetype: 'goomba', x: 10, y: 1 },
        { id: 'e2', archetype: 'goomba', x: 12, y: 1 },
        { id: 'e3', archetype: 'goomba', x: 14, y: 1 },
      ],
      coins: [{ id: 'coin_combo_1', x: 12, y: 5, kind: 'combo' }],
    });
    const catalog = makeTestCatalog([room]);
    const engine = createSimEngine();
    const state = engine.createInitialState(catalog, {
      progress: {
        ownedRelics: ['maniac_crystal', 'vampiric_amulet'],
        equippedRelics: ['maniac_crystal', 'vampiric_amulet'],
        upgradeLevels: { ExtraLife: 1, RockShield: 1 } as Record<UpgradeKey, number>,
      },
    });

    // Injure hero & break rockShield to test >= 95% auto-heal + restore
    state.hero.hp = 1;
    state.hero.rockShieldActive = false;
    const events: SimEvent[] = [];

    // Hit 1 with Maniac Crystal (1.5x): 1.5 * 1.5 = 2.25 + 0.35s freezeTimer
    state.enemies[0].alive = false;
    registerComboEnemyHit(state, 10, 1, true, events);
    expect(state.combo.timer).toBeCloseTo(2.25, 2);
    expect(state.combo.freezeTimer).toBeCloseTo(0.35, 2);

    // During freezeTimer, combo does NOT decay
    const timerBefore = state.combo.timer;
    stepN(engine, state, catalog, 10);
    expect(state.combo.timer).toBeCloseTo(timerBefore, 3);

    // Hit 2 pushes timer >= 95% of 4.0 -> triggers auto-heal +1 HP, restores RockShield, resets to 0.30 * 4.0 = 1.20!
    state.enemies[1].alive = false;
    registerComboEnemyHit(state, 12, 1, true, events);
    expect(state.hero.hp).toBe(2);
    expect(state.hero.rockShieldActive).toBe(true);
    expect(state.combo.timer).toBeCloseTo(COMBO_PRESETS.normal.healResetRatio * COMBO_PRESETS.normal.maxTimer, 2);
    expect(events.some((e) => e.type === 'heal')).toBe(true);

    // Hit 3 kills final enemy -> Max Room Combo! Awards combo coin, slowmo 0.05x, and Vampiric Amulet heals to 3!
    state.enemies[2].alive = false;
    registerComboEnemyHit(state, 14, 1, true, events);
    expect(state.combo.roomComboCleared).toBe(true);
    expect(state.slowmoScale).toBe(0.05);
    expect(state.progress.collectedCoinIds).toContain('coin_combo_1');
    expect(state.hero.hp).toBe(3);
    expect(events.some((e) => e.type === 'combo_max')).toBe(true);
  });

  it('verifies defense relics (IronSkin, Providential Shield, Magic Shield, Rebirth, Magic Coin, Bandit Shorts, Evil Ring, Old Clock, Magnet)', () => {
    const room = makeRoom('relic_lab', FLAT_ROOM_ASCII, {
      crystals: [{ id: 'cr1', x: 6.5, y: 1.5, value: 10 }],
      enemies: [{ id: 'e1', archetype: 'goomba', x: 4.5, y: 1 }],
    });
    const catalog = makeTestCatalog([room]);
    const engine = createSimEngine();

    // 1. IronSkin negates recoil & increases invuln 1.25x
    const sIron = engine.createInitialState(catalog, {
      progress: { upgradeLevels: { IronSkin: 1 } as Record<UpgradeKey, number> },
    });
    damageHero(sIron, 1, 0, [], 'enemy');
    expect(sIron.hero.recoilTimer).toBe(0);
    expect(sIron.hero.invulnTimer).toBeCloseTo(PHYSICS.INVULN_TIME * PHYSICS.IRON_SKIN_INVULN_MULT, 2);

    // 2. Providential Shield blocks first hit in room; Magic Shield grants 3.0s post-hit barrier; Evil Ring blasts nearby enemy
    const sShield = engine.createInitialState(catalog, {
      progress: {
        ownedRelics: ['providential_shield', 'magic_shield', 'evil_ring'],
        equippedRelics: ['providential_shield', 'magic_shield', 'evil_ring'],
      },
    });
    const ev1: SimEvent[] = [];
    damageHero(sShield, 1, 0, ev1, 'enemy');
    expect(sShield.hero.hp).toBe(2);
    expect(sShield.hero.platinumShieldUsed).toBe(true);
    sShield.hero.invulnTimer = 0;
    const ev2: SimEvent[] = [];
    const dmg2 = damageHero(sShield, 1, 0, ev2, 'enemy');
    expect(dmg2.tookDamage).toBe(true);
    expect(dmg2.evilRingTriggered).toBe(true);
    expect(sShield.hero.hp).toBe(1);
    expect(sShield.hero.magicShieldTimer).toBeCloseTo(3.0, 2);

    // 3. Rebirth Amulet revives once; Magic Coin prevents 5% death crystal loss
    const sRebirth = engine.createInitialState(catalog, {
      progress: {
        crystals: 1000,
        ownedRelics: ['rebirth_amulet', 'magic_coin'],
        equippedRelics: ['rebirth_amulet', 'magic_coin'],
      },
    });
    damageHero(sRebirth, 5, 0, [], 'enemy');
    expect(sRebirth.hero.rebirthUsed).toBe(true);
    expect(sRebirth.hero.hp).toBeGreaterThan(0);
    expect(sRebirth.gameOverTriggered).toBe(false);

    // Second fatal hit kills hero, but Magic Coin preserves 1000 crystals
    sRebirth.hero.invulnTimer = 0;
    damageHero(sRebirth, 5, 0, [], 'enemy');
    expect(sRebirth.hero.action).toBe('dead');
    expect(sRebirth.gameOverTriggered).toBe(true);
    expect(sRebirth.progress.crystals).toBe(1000);

    // Without Magic Coin, loses 5% crystals on death
    const sLoss = engine.createInitialState(catalog, { progress: { crystals: 1000 } });
    damageHero(sLoss, 5, 0, [], 'enemy');
    expect(sLoss.progress.crystals).toBe(950);

    // 4. Magnet pulls crystal from 4.5u away + CrystallineHunger gives 2x crystals in Basic form
    const sMag = engine.createInitialState(catalog, {
      progress: {
        ownedRelics: ['magnet'],
        equippedRelics: ['magnet'],
        upgradeLevels: { CrystallineHunger: 1 } as Record<UpgradeKey, number>,
      },
    });
    sMag.enemies = [];
    stepN(engine, sMag, catalog, 30);
    expect(sMag.crystals[0].collected).toBe(true);
    expect(sMag.progress.crystals).toBe(20); // 10 * 2.0 = 20

    // 5. Bandit Shorts deterministic dodge fires ~35% across trials
    const sBandit = engine.createInitialState(catalog, {
      seed: 12345,
      progress: { ownedRelics: ['bandit_shorts'], equippedRelics: ['bandit_shorts'] },
    });
    let dodges = 0;
    for (let i = 0; i < 40; i++) {
      sBandit.hero.hp = 2;
      sBandit.hero.invulnTimer = 0;
      const res = damageHero(sBandit, 1, 0, [], 'enemy');
      if (!res.tookDamage) dodges++;
    }
    expect(dodges).toBeGreaterThan(5);
    expect(dodges).toBeLessThan(28);
  });

  it('handles buyUpgrade, buyRelic, toggleEquipRelic, camera pixel snap + arena zoom, exits, boss defeat, and modes', () => {
    const roomA = makeRoom('room_a', FLAT_ROOM_ASCII, {
      mode: 'arena',
      exits: [
        { dir: 'right', x: 21, y: 1, width: 2, height: 3, targetRoomId: 'room_boss', targetSpawnX: 2, targetSpawnY: 1 },
      ],
      props: [
        { id: 'npc_v', kind: 'shop_npc', x: 3, y: 1, shopId: 'vespera' },
        { id: 'sign_1', kind: 'signpost', x: 6, y: 1, label: 'Welcome to Krunked Quest!' },
      ],
    });
    const roomBoss = makeRoom('room_boss', FLAT_ROOM_ASCII, {
      mode: 'boss',
      bossId: 'primal_eye',
    });
    const catalog = makeTestCatalog([roomA, roomBoss]);
    const engine = createSimEngine();
    const state = engine.createInitialState(catalog, { progress: { crystals: 15000 } });

    // Shop economy & relic slots
    expect(engine.buyUpgrade(state, catalog, 'ExtraLife')).toBe(true);
    expect(state.hero.maxHp).toBe(3);
    expect(engine.buyUpgrade(state, catalog, 'StompFlame')).toBe(false); // requires krunk_fire!
    expect(engine.buyRelic(state, catalog, 'old_clock')).toBe(true);
    expect(engine.buyRelic(state, catalog, 'magnet')).toBe(true);
    expect(engine.buyRelic(state, catalog, 'lively_heart')).toBe(true);
    // Base slots = 2, so 3rd relic stays unequipped until ItemSlot bought
    expect(state.progress.equippedRelics.length).toBe(2);
    expect(engine.toggleEquipRelic(state, catalog, 'lively_heart')).toBe(false);
    expect(engine.buyUpgrade(state, catalog, 'ItemSlot')).toBe(true);
    expect(engine.toggleEquipRelic(state, catalog, 'lively_heart')).toBe(true);
    expect(state.hero.maxHp).toBe(4);

    // Camera arena zoom (1.125x) & pixel snap (multiples of 1/32)
    stepN(engine, state, catalog, 2);
    expect(state.camera.zoom).toBeCloseTo(ARENA_ZOOM, 2);
    expect(Math.abs(state.camera.snappedX * PPU - Math.round(state.camera.snappedX * PPU))).toBeLessThan(1e-6);
    expect(Math.abs(state.camera.snappedY * PPU - Math.round(state.camera.snappedY * PPU))).toBeLessThan(1e-6);

    // NPC shop prompt & signpost
    state.hero.x = 3;
    stepN(engine, state, catalog, 1);
    expect(state.activeShopPrompt).toBe('vespera');
    state.hero.x = 6;
    stepN(engine, state, catalog, 1);
    expect(state.activeSignText).toBe('Welcome to Krunked Quest!');

    // Exit transition -> room_boss spawns Primal Eye (20 HP)
    state.hero.x = 21.2;
    const exitEv = stepN(engine, state, catalog, 1);
    expect(exitEv.some((e) => e.type === 'room_change' && e.toRoomId === 'room_boss')).toBe(true);
    expect(state.boss).not.toBeNull();
    expect(state.boss?.id).toBe('primal_eye');
    expect(state.boss?.maxHp).toBe(20);

    // Defeat Primal Eye -> unlocks krunk_leaf
    state.boss!.hp = 1;
    state.hero.x = state.boss!.x + 0.4;
    state.hero.y = state.boss!.y + state.boss!.height + 0.1;
    state.hero.grounded = false;
    const bossEv = stepN(engine, state, catalog, 6, (i) => ({ stompPressed: i === 0 }));
    expect(bossEv.some((e) => e.type === 'boss_defeated' && e.unlockForm === 'krunk_leaf')).toBe(true);
    expect(state.progress.unlockedForms).toContain('krunk_leaf');

    // Modes: Ghost Ship, Boss Rush, Time Attack
    engine.startGhostShip(state, catalog);
    expect(state.ghostShip.active).toBe(true);
    expect(state.enemies.length).toBeGreaterThanOrEqual(3);

    engine.startBossRush(state, catalog, 'primal_eye');
    expect(state.mode).toBe('boss_rush');
    expect(state.boss?.hp).toBe(20);

    engine.startTimeAttack(state, catalog);
    expect(state.mode).toBe('time_attack');
    stepN(engine, state, catalog, 10);
    expect(state.timeAttackTicks).toBe(10);
  });

  it('maintains 100% bit-for-bit hashState determinism across identical seeded replays', () => {
    const room = makeRoom('det_room', FLAT_ROOM_ASCII, {
      enemies: [
        { id: 'e1', archetype: 'goomba', x: 8, y: 1, patrolMinX: 5, patrolMaxX: 14 },
        { id: 'e2', archetype: 'spitter', x: 15, y: 1, patrolMinX: 13, patrolMaxX: 19 },
        { id: 'e3', archetype: 'bee', x: 12, y: 5, patrolMinX: 8, patrolMaxX: 18 },
      ],
      crystals: [
        { id: 'c1', x: 5, y: 1.5, value: 10 },
        { id: 'c2', x: 10, y: 2.5, value: 10 },
      ],
      coins: [{ id: 'cn1', x: 14, y: 3.5, kind: 'world' }],
    });
    const catalog = makeTestCatalog([room]);
    const engine = createSimEngine();

    const runReplay = () => {
      const state = engine.createInitialState(catalog, {
        seed: 0xdecafbad,
        progress: { unlockedForms: ['krunk_basic', 'krunk_fire', 'krunk_leaf', 'krunk_rock'] },
      });
      const hashes: number[] = [];
      for (let t = 0; t < 240; t++) {
        const input: InputFrame = {
          ...createEmptyInputFrame(),
          moveX: t < 80 ? 1 : t < 150 ? -1 : 1,
          jumpPressed: t === 10 || t === 25 || t === 95 || t === 170,
          jumpHeld: (t >= 10 && t < 22) || (t >= 95 && t < 110),
          dashPressed: t === 40 || t === 120 || t === 185,
          dashHeld: (t >= 40 && t < 55) || (t >= 185 && t < 200),
          stompPressed: t === 65 || t === 205,
          formNextPressed: t === 35 || t === 115,
        };
        engine.step(state, input, catalog);
        hashes.push(engine.hashState(state));
      }
      return { hashes, rngSample: nextFloat(state) };
    };

    const run1 = runReplay();
    const run2 = runReplay();
    expect(run1.hashes).toEqual(run2.hashes);
    expect(run1.rngSample).toBe(run2.rngSample);
    // Sanity: hashes actually change over time as simulation progresses
    expect(new Set(run1.hashes).size).toBeGreaterThan(100);
    // Sanity: fixed timestep constant matches 1/60
    expect(FIXED_DT).toBeCloseTo(1 / 60, 8);
  });

  it('verifies Ground Stomp (vx=0, vy=12, tongue slam, anti-spam 0.25s, fire waves), zero Basic midair Dash freeze, retroactive super-bounce, hitstop input buffering, camera deadzone, Old Clock, Antigrav Rock & props', () => {
    const room = makeRoom('extra_mechanics', [
      '####################',
      '#..................#',
      '#....GGG...........#',
      '#....GGG...........#',
      '#....GGG...........#',
      '#..................#',
      '##########B#########',
    ], {
      defaultSpawnX: 12,
      defaultSpawnY: 4.5,
      enemies: [
        { id: 'e1', archetype: 'goomba', x: 12, y: 1, patrolMinX: 11.9, patrolMaxX: 12.1 },
        { id: 'e2', archetype: 'goomba', x: 14, y: 1, patrolMinX: 13.9, patrolMaxX: 14.1 },
      ],
      props: [
        { id: 'chest_1', kind: 'chest', x: 2, y: 1, coinId: 'coin_chest_1' },
        { id: 'totem_fire', kind: 'form_totem', x: 4, y: 1, formId: 'krunk_fire' },
        { id: 'tp_1', kind: 'teleporter', x: 7, y: 1 },
      ],
    });
    const catalog = makeTestCatalog([room]);
    const engine = createSimEngine();

    // 1. Midair Basic Dash does NOT freeze hero for 0.25s; Air Stomp on stompPressed is IMMEDIATE and preserves vx!
    const sAir = engine.createInitialState(catalog, {
      progress: { ownedRelics: ['old_clock'], equippedRelics: ['old_clock'] },
    });
    sAir.hero.grounded = false;
    sAir.hero.vx = 5.5;
    stepN(engine, sAir, catalog, 1, () => ({ dashPressed: true, moveX: 1 }));
    expect(sAir.hero.stompDelayTimer).toBe(0);
    expect(sAir.hero.action).not.toBe('air_stomp');
    expect(sAir.hero.vx).toBeGreaterThan(4.5);

    const airEv = stepN(engine, sAir, catalog, 1, () => ({ stompPressed: true, moveX: 1 }));
    expect(sAir.hero.action).toBe('air_stomp');
    expect(sAir.hero.vy).toBe(-PHYSICS.MAX_FALL_SPEED);
    expect(sAir.hero.vx).toBeGreaterThan(4.5); // 100% horizontal vx preserved!
    expect(sAir.hero.tongueKind).toBe('air_stomp');
    expect(airEv.some((e) => e.type === 'tongue_lash' && e.kind === 'air_stomp')).toBe(true);

    // 2. Old Clock activates 0.35s slowmo at 0.25x on enemy stomp bounce
    sAir.hero.x = 12;
    sAir.hero.y = 2.6;
    sAir.hero.vx = 0;
    stepN(engine, sAir, catalog, 12);
    expect(sAir.enemies[0].alive).toBe(false);
    expect(sAir.slowmoTimer).toBeGreaterThan(0);
    expect(sAir.slowmoScale).toBe(0.25);

    // 2b. Ground Stomp: grounded stompPressed -> vx=0, vy=12.0, tongueKind='ground_stomp', anti-spam 0.25s, breaks floor block, Fire waves!
    const sGs = engine.createInitialState(catalog, {
      progress: {
        unlockedForms: ['krunk_basic', 'krunk_fire'],
        upgradeLevels: { StompFlame: 1 } as Record<UpgradeKey, number>,
      },
    });
    sGs.enemies = [];
    sGs.hero.form = 'krunk_fire';
    sGs.hero.x = 10.1; // Directly above Breakable 'B' at tx=10, ty=0
    sGs.hero.y = 1.0;
    stepN(engine, sGs, catalog, 2); // settle grounded
    expect(sGs.hero.grounded).toBe(true);
    const gsEv = stepN(engine, sGs, catalog, 1, () => ({ stompPressed: true }));
    expect(sGs.hero.action).toBe('ground_stomp');
    expect(sGs.hero.vx).toBe(0);
    expect(sGs.hero.vy).toBeCloseTo(PHYSICS.GROUND_STOMP_FORCE_Y, 1);
    expect(sGs.hero.tongueKind).toBe('ground_stomp');
    expect(gsEv.some((e) => e.type === 'ground_stomp' && e.fiery)).toBe(true);
    expect(gsEv.some((e) => e.type === 'tongue_lash' && e.kind === 'ground_stomp')).toBe(true);
    expect(sGs.roomTiles[0 * room.widthTiles + 10]).toBe(TileCode.Empty); // floor block smashed!
    expect(sGs.projectiles.filter((p) => p.kind === 'fire_wave').length).toBe(2); // twin ground fire waves!

    // Ground Stomp on plain solid floor sets 0.25s anti-spam stompSpamTimer
    sGs.hero.x = 5.0;
    sGs.hero.y = 1.0;
    sGs.hero.vy = 0;
    sGs.hero.grounded = true;
    stepN(engine, sGs, catalog, 1, () => ({ stompPressed: true }));
    expect(sGs.hero.stompSpamTimer).toBeCloseTo(PHYSICS.STOMP_DELAY, 2);

    // 2c. Retroactive super-bounce forgiveness: tapping Stomp within lastEnemyHitTimer upgrades to 18.0 u/s!
    const sRetro = engine.createInitialState(catalog);
    sRetro.hero.x = 5.0;
    sRetro.hero.y = 3.0;
    sRetro.hero.grounded = false;
    sRetro.hero.vy = 12.0;
    sRetro.hero.lastEnemyHitTimer = 0.04;
    stepN(engine, sRetro, catalog, 1, () => ({ stompPressed: true }));
    expect(sRetro.hero.action).toBe('flip'); // upgraded bounce, NOT downward dive!
    expect(sRetro.hero.vy).toBeCloseTo(18.0, 1);

    // 2d. Hitstop input buffering: Jump pressed during hitstopTicks > 0 is NEVER dropped!
    const sBuf = engine.createInitialState(catalog);
    sBuf.enemies = [];
    sBuf.hero.x = 5.0;
    sBuf.hero.y = 1.0;
    stepN(engine, sBuf, catalog, 2);
    sBuf.hitstopTicks = 2;
    stepN(engine, sBuf, catalog, 1, () => ({ jumpPressed: true, jumpHeld: true }));
    expect(sBuf.hero.preJumpTimer).toBeGreaterThan(0);
    const postHitstopEv = stepN(engine, sBuf, catalog, 2, () => ({ jumpHeld: true }));
    expect(postHitstopEv.some((e) => e.type === 'jump' && !e.air)).toBe(true);

    // 2e. Camera +-1.0u deadzone: turning in place does NOT whip camera X!
    const camRoom = makeRoom('cam_deadzone', FLAT_ROOM_ASCII, { defaultSpawnX: 12, defaultSpawnY: 1 });
    const camCat = makeTestCatalog([camRoom]);
    const sCam = engine.createInitialState(camCat);
    stepN(engine, sCam, camCat, 3);
    const camXBeforeTurn = sCam.camera.x;
    stepN(engine, sCam, camCat, 2, () => ({ moveX: -1 }));
    stepN(engine, sCam, camCat, 2, () => ({ moveX: 1 }));
    expect(Math.abs(sCam.camera.x - camXBeforeTurn)).toBeLessThan(0.15);

    // 3. Mini-combo rapid hit bonus within 0.15s window awards extra crystals
    const cBefore = sAir.progress.crystals;
    const evMini: SimEvent[] = [];
    registerComboEnemyHit(sAir, 14, 1, false, evMini);
    expect(sAir.combo.miniComboTimer).toBeCloseTo(0.15, 2);
    registerComboEnemyHit(sAir, 14, 1, false, evMini);
    expect(sAir.progress.crystals).toBeGreaterThan(cBefore);

    // 4. Antigrav halves Rock Uppercut velocity (13.0 * 0.5 = 6.5 u/s) AND allows horizontal steering during ascent
    const sRock = engine.createInitialState(catalog, {
      progress: { unlockedForms: ['krunk_basic', 'krunk_rock'] },
    });
    sRock.hero.form = 'krunk_rock';
    sRock.hero.x = 6.0;
    sRock.hero.y = 2.5;
    sRock.hero.grounded = false;
    sRock.hero.inAntigrav = true;
    stepN(engine, sRock, catalog, 1, () => ({ dashPressed: true, dashHeld: true, moveX: 1 }));
    let peakVy = 0;
    for (let i = 0; i < 8; i++) {
      engine.step(sRock, { ...createEmptyInputFrame(), dashHeld: true, moveX: 1 }, catalog);
      peakVy = Math.max(peakVy, sRock.hero.vy);
    }
    expect(peakVy).toBeCloseTo(FORM_PARAMS.ROCK_UPPERCUT_VY * FORM_PARAMS.ROCK_ANTIGRAV_MULT, 1);
    expect(sRock.hero.vx).toBeGreaterThan(1.0); // Horizontal steering works during rock uppercut!

    // 5. Chest, Form Totem, and Teleporter interactions
    const sProps = engine.createInitialState(catalog);
    sProps.hero.x = 2.0;
    sProps.hero.y = 1.0;
    const chEv = stepN(engine, sProps, catalog, 1);
    expect(sProps.progress.openedChests).toContain('chest_1');
    expect(sProps.progress.collectedCoinIds).toContain('coin_chest_1');
    expect(chEv.some((e) => e.type === 'coin_pickup' && e.coinId === 'coin_chest_1')).toBe(true);

    sProps.hero.x = 4.0;
    const totEv = stepN(engine, sProps, catalog, 1);
    expect(sProps.progress.unlockedForms).toContain('krunk_fire');
    expect(sProps.hero.form).toBe('krunk_fire');
    expect(totEv.some((e) => e.type === 'form_switch' && e.form === 'krunk_fire')).toBe(true);

    sProps.hero.x = 7.0;
    const tpEv = stepN(engine, sProps, catalog, 1);
    expect(sProps.progress.unlockedTeleporters).toContain('extra_mechanics');
    expect(tpEv.some((e) => e.type === 'teleporter_unlock')).toBe(true);
  });
});
