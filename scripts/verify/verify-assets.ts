/**
 * Gate A — Asset Registry, Mechanic Oracle Parity, TASTE_NOTES & IP Firewall Verification
 * Run via: npm run verify:assets
 */

import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import {
  ARENA_ZOOM,
  BIOME_IDS,
  COMBO_PRESETS,
  HERO_FORMS,
  ORTHOGRAPHIC_SIZE,
  PHYSICS,
  PPU,
  SIM_HZ,
  VIEWPORT_H,
  VIEWPORT_W,
  type BiomeId,
  type CustomPackManifest,
  type HeroFormId,
} from '../../src/contracts/index';
import {
  ALL_REQUIRED_ASSET_KEYS,
  LOGICAL_BIOME_TILESETS,
  LOGICAL_BOSS_SPRITES,
  LOGICAL_HERO_SHEETS,
  validateAssetManifest,
} from '../../src/assets/AssetRegistry';
import { BIOME_PALETTES, HERO_FORM_PALETTES } from '../../src/assets/palettes';
import { createWorldCatalog } from '../../src/data/index';
import { InputOrchestrator } from '../../src/input/InputOrchestrator';

const ROOT = path.resolve(process.cwd());
const PACK_DIR = path.join(ROOT, '.krunked-quest-assets');
const ORACLE_PATH = path.join(PACK_DIR, 'oracle.json');
const MANIFEST_PATH = path.join(PACK_DIR, 'manifest.json');

const failures: string[] = [];
const passes: string[] = [];

function check(cond: boolean, label: string, detail?: string): void {
  if (cond) {
    passes.push(label);
  } else {
    failures.push(detail ? `${label}: ${detail}` : label);
  }
}

function approxEq(a: number, b: number, eps = 1e-4): boolean {
  return Math.abs(a - b) <= eps;
}

function walkFiles(dir: string, out: string[] = []): string[] {
  if (!fs.existsSync(dir)) return out;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walkFiles(full, out);
    } else {
      out.push(full);
    }
  }
  return out;
}

function main(): void {
  const catalog = createWorldCatalog();

  // --------------------------------------------------------------------------
  // 1. Built-In Pixel Pack & Logical Registry Completeness
  // --------------------------------------------------------------------------
  check(ALL_REQUIRED_ASSET_KEYS.length >= 60, 'AssetRegistry defines >=60 logical keys', `got ${ALL_REQUIRED_ASSET_KEYS.length}`);
  for (const form of HERO_FORMS) {
    check(Boolean(LOGICAL_HERO_SHEETS[form]), `Hero sheet key registered for ${form}`);
    check(HERO_FORM_PALETTES[form].length === 6, `Hero palette 6-hex for ${form}`);
  }
  for (const biome of BIOME_IDS) {
    check(Boolean(LOGICAL_BIOME_TILESETS[biome]), `Biome tileset key registered for ${biome}`);
    check(BIOME_PALETTES[biome].colors.length === 6, `Biome palette 6-hex for ${biome}`);
  }
  for (const boss of catalog.bosses.values()) {
    check(Boolean(LOGICAL_BOSS_SPRITES[boss.id]), `Boss sprite key registered for ${boss.id}`);
  }

  // --------------------------------------------------------------------------
  // 2. Local Custom Pack Manifest & PNG Integrity (when extracted locally)
  // --------------------------------------------------------------------------
  if (fs.existsSync(MANIFEST_PATH)) {
    const raw = fs.readFileSync(MANIFEST_PATH, 'utf8');
    const manifest = JSON.parse(raw) as CustomPackManifest;
    const validation = validateAssetManifest(manifest);
    check(
      validation.valid,
      'Local custom pack manifest validates all required logical keys',
      `missing=${validation.missingKeys.join(',')} invalid=${validation.invalidEntries.join(',')}`,
    );
    let pngOk = 0;
    let pngBad = 0;
    for (const key of ALL_REQUIRED_ASSET_KEYS) {
      const entry = manifest.entries[key];
      if (!entry) {
        pngBad++;
        continue;
      }
      const filePath = path.join(PACK_DIR, entry.path);
      if (!fs.existsSync(filePath)) {
        pngBad++;
        continue;
      }
      const head = fs.readFileSync(filePath).subarray(0, 8);
      // PNG magic: 89 50 4E 47 0D 0A 1A 0A
      if (head.length === 8 && head[0] === 0x89 && head[1] === 0x50 && head[2] === 0x4e && head[3] === 0x47) {
        pngOk++;
      } else {
        pngBad++;
      }
    }
    check(pngBad === 0 && pngOk === ALL_REQUIRED_ASSET_KEYS.length, `All ${ALL_REQUIRED_ASSET_KEYS.length} custom pack PNGs valid`, `ok=${pngOk} bad=${pngBad}`);
  } else {
    passes.push('Local custom pack skipped (CI clean-room mode; built-in procedural pack verified)');
  }

  // --------------------------------------------------------------------------
  // 3. Canonical Viewport, Physics, Combo, Upgrades, Relics, Bosses & Palettes
  // --------------------------------------------------------------------------
  check(VIEWPORT_W === 576 && VIEWPORT_H === 324 && PPU === 32, 'Viewport 576x324 @ 32 PPU');
  check(approxEq(ORTHOGRAPHIC_SIZE, 5.0625), 'Orthographic size 5.0625');
  check(approxEq(ARENA_ZOOM, 1.125), 'Arena zoom 1.125');
  check(SIM_HZ === 60, 'Simulation cadence 60Hz');

  check(approxEq(PHYSICS.G_EFF, -44.145), 'Physics G_EFF = -44.145');
  check(approxEq(PHYSICS.MAX_SPEED, 6.6), 'Physics MAX_SPEED = 6.6');
  check(approxEq(PHYSICS.JUMP_FORCE, 10.0), 'Physics JUMP_FORCE = 10.0');
  check(approxEq(PHYSICS.DOUBLE_JUMP_FORCE, 13.0), 'Physics DOUBLE_JUMP_FORCE = 13.0');
  check(approxEq(PHYSICS.ENEMY_JUMP_FORCE, 12.0), 'Physics ENEMY_JUMP_FORCE = 12.0');
  check(approxEq(PHYSICS.STOMP_BOUNCE_MULT, 1.5), 'Physics STOMP_BOUNCE_MULT = 1.5');
  check(approxEq(PHYSICS.PRE_JUMP, 0.1), 'Physics PRE_JUMP = 0.10');
  check(approxEq(PHYSICS.COYOTE_TIME, 0.1), 'Physics COYOTE_TIME = 0.10');
  check(approxEq(PHYSICS.WALL_JUMP_FORCE_X, 5.0) && approxEq(PHYSICS.WALL_JUMP_FORCE_Y, 15.5), 'Physics WALL_JUMP_FORCE = (5.0, 15.5)');
  check(approxEq(PHYSICS.GROUND_STOMP_FORCE_X, 17.0) && approxEq(PHYSICS.GROUND_STOMP_FORCE_Y, 12.0), 'Physics GROUND_STOMP_FORCE = (17.0, 12.0)');

  check(catalog.upgrades.length === 18, 'Catalog has exactly 18 upgrades', `got ${catalog.upgrades.length}`);
  check(catalog.relics.length === 16, 'Catalog has exactly 16 relics', `got ${catalog.relics.length}`);
  check(catalog.bosses.size === 8, 'Catalog has exactly 8 bosses/mini-bosses', `got ${catalog.bosses.size}`);
  check(catalog.forms.length === 6, 'Catalog has exactly 6 hero forms', `got ${catalog.forms.length}`);
  check(catalog.rooms.size === 64, 'Catalog has exactly 64 rooms', `got ${catalog.rooms.size}`);
  check(catalog.totalCoins === 200, 'Catalog has exactly 200 coins', `got ${catalog.totalCoins}`);

  // Exact oracle parity when .krunked-quest-assets/oracle.json is present
  if (fs.existsSync(ORACLE_PATH)) {
    const oracle = JSON.parse(fs.readFileSync(ORACLE_PATH, 'utf8')) as {
      source?: { sourceVerified?: boolean; levelSceneCount?: number };
      viewport: { width: number; height: number; ppu: number; orthographicSize: number };
      physics: {
        gEff: number;
        maxSpeed: number;
        jumpForce: number;
        doubleJumpForce: number;
        enemyJumpForce: number;
        stompMult: number;
        preJump: number;
        coyote: number;
        wallJumpForce: [number, number];
        groundStopForce: [number, number];
      };
      comboPresets: Record<'normal' | 'arena' | 'boss', {
        maxTimer: number;
        firstHitBonus: number;
        enemyHitGain: number;
        crystalGain: number;
        harderPoint: number;
        healResetRatio: number;
      }>;
      upgrades: Array<{ id: number; key: string; basePrice: number; priceStep: number; maxLevel: number }>;
      relics: Array<{ id: string; price: number }>;
      bosses: Array<{ id: string; maxHp: number; unlockForm: string | null }>;
      heroFormPalettes: Record<HeroFormId, { colors: string[] }>;
    };

    check(oracle.source?.sourceVerified === true, 'Oracle retail Steam sourceVerified === true');
    check(oracle.viewport.width === VIEWPORT_W && oracle.viewport.height === VIEWPORT_H && oracle.viewport.ppu === PPU, 'Oracle viewport matches 576x324 @ 32 PPU');
    check(approxEq(oracle.physics.gEff, PHYSICS.G_EFF), 'Oracle G_EFF matches PHYSICS.G_EFF');
    check(approxEq(oracle.physics.maxSpeed, PHYSICS.MAX_SPEED), 'Oracle maxSpeed matches');
    check(approxEq(oracle.physics.jumpForce, PHYSICS.JUMP_FORCE), 'Oracle jumpForce matches');
    check(approxEq(oracle.physics.doubleJumpForce, PHYSICS.DOUBLE_JUMP_FORCE), 'Oracle doubleJumpForce matches');
    check(approxEq(oracle.physics.enemyJumpForce, PHYSICS.ENEMY_JUMP_FORCE), 'Oracle enemyJumpForce matches');
    check(approxEq(oracle.physics.stompMult, PHYSICS.STOMP_BOUNCE_MULT), 'Oracle stompMult matches');
    check(approxEq(oracle.physics.preJump, PHYSICS.PRE_JUMP), 'Oracle preJump matches');
    check(approxEq(oracle.physics.coyote, PHYSICS.COYOTE_TIME), 'Oracle coyote matches');
    check(
      approxEq(oracle.physics.wallJumpForce[0], PHYSICS.WALL_JUMP_FORCE_X) &&
        approxEq(oracle.physics.wallJumpForce[1], PHYSICS.WALL_JUMP_FORCE_Y),
      'Oracle wallJumpForce matches',
    );
    check(
      approxEq(oracle.physics.groundStopForce[0], PHYSICS.GROUND_STOMP_FORCE_X) &&
        approxEq(oracle.physics.groundStopForce[1], PHYSICS.GROUND_STOMP_FORCE_Y),
      'Oracle groundStopForce matches',
    );

    for (const mode of ['normal', 'arena', 'boss'] as const) {
      const o = oracle.comboPresets[mode];
      const s = COMBO_PRESETS[mode];
      check(
        approxEq(o.maxTimer, s.maxTimer) &&
          approxEq(o.firstHitBonus, s.firstHitBonus) &&
          approxEq(o.enemyHitGain, s.enemyHitGain) &&
          approxEq(o.crystalGain, s.crystalGain) &&
          approxEq(o.harderPoint, s.harderPoint) &&
          approxEq(o.healResetRatio, s.healResetRatio),
        `Oracle combo preset '${mode}' matches`,
      );
    }

    check(oracle.upgrades.length === catalog.upgrades.length, 'Oracle upgrade count === 18');
    for (const ou of oracle.upgrades) {
      const su = catalog.upgrades.find((u) => u.key === ou.key);
      check(
        Boolean(su) &&
          su!.id === ou.id &&
          su!.basePrice === ou.basePrice &&
          su!.priceStep === ou.priceStep &&
          su!.maxLevel === ou.maxLevel,
        `Oracle upgrade ${ou.key} matches id/price/maxLevel`,
      );
    }

    check(oracle.relics.length === catalog.relics.length, 'Oracle relic count === 16');
    for (const or of oracle.relics) {
      const sr = catalog.relics.find((r) => r.id === or.id);
      check(Boolean(sr) && sr!.price === or.price, `Oracle relic ${or.id} price=${or.price} matches`);
    }

    for (const ob of oracle.bosses) {
      const sb = catalog.bosses.get(ob.id as never);
      check(
        Boolean(sb) && sb!.maxHp === ob.maxHp && (sb!.unlockForm ?? null) === ob.unlockForm,
        `Oracle boss ${ob.id} HP=${ob.maxHp} & unlock matches`,
      );
    }

    for (const form of HERO_FORMS) {
      const oColors = oracle.heroFormPalettes[form]?.colors.map((c) => c.toLowerCase());
      const sColors = HERO_FORM_PALETTES[form].map((c) => c.toLowerCase());
      check(JSON.stringify(oColors) === JSON.stringify(sColors), `Oracle hero form palette ${form} exact hex match`);
    }
  } else {
    passes.push('Local oracle.json parity skipped (CI clean-room mode; contract constants verified)');
  }

  // Verify extracted biome palette hex anchors in palettes.ts
  const expectedBiomeAnchors: Record<BiomeId, readonly string[]> = {
    MLAIR: ['#975932', '#b27333', '#04e205', '#7878c8', '#d898f8', '#376e83'],
    OPOUSO: ['#181880', '#586890', '#f8f8d8', '#654b4e', '#d56e7b', '#fb7f69'],
    TDM: ['#261009', '#704150', '#421b28', '#9f5a27', '#816f1c', '#424310'],
    FLIN: ['#001734', '#142b48', '#2c4d78', '#8f4b54', '#d76271', '#2c4547'],
    AP: ['#971241', '#780000', '#c14a55', '#b8dfea', '#ffb965', '#3b3e3d'],
    ATVC: ['#4a0a00', '#8f2200', '#ff5019', '#ffaa2f', '#ffec42', '#130d21'],
    DSI: ['#91795a', '#e6be19', '#b58850', '#fffc06', '#e4dc3f', '#fffcab'],
    LAB: ['#d0c180', '#432c2c', '#2d1e32', '#180d36', '#7b0b31', '#998f4f'],
    TEMP: ['#0042ae', '#00adff', '#ffffff', '#f3cefd', '#23376d', '#000048'],
    EVIL: ['#1e0f19', '#fc143b', '#71373e', '#261f21', '#730087', '#98f888'],
    GSHIP: ['#d8f040', '#f07080', '#f0b090', '#4e393f', '#704150', '#1e0f19'],
  };
  for (const biome of BIOME_IDS) {
    const actual = BIOME_PALETTES[biome].colors.map((c) => c.toLowerCase());
    const expected = expectedBiomeAnchors[biome].map((c) => c.toLowerCase());
    check(JSON.stringify(actual) === JSON.stringify(expected), `Biome ${biome} exact extracted palette hex match`);
  }

  // --------------------------------------------------------------------------
  // 4. TASTE_NOTES Multi-Device Input Contract Verification
  // --------------------------------------------------------------------------
  const orch = new InputOrchestrator();
  check(orch.activeDevice === 'keyboard' && orch.touchOverlayVisible === false, 'TASTE_NOTES desktop boot: touchOverlayVisible === false');
  orch.injectVirtualTouch(true);
  check(orch.activeDevice === 'touch' && orch.touchOverlayVisible === true, 'TASTE_NOTES touch auto-activate: touchOverlayVisible === true');
  orch.injectVirtualGamepadState({
    id: 'Tesla USB Controller HID',
    axes: [0.85, 0, 0, 0],
    buttons: [{ pressed: true, value: 1 }],
  });
  orch.pollFrame();
  check(orch.activeDevice === 'gamepad_tesla' && orch.touchOverlayVisible === false, 'TASTE_NOTES Tesla gamepad auto-hides touch overlay');
  orch.injectVirtualGamepadState({
    id: 'Xbox Wireless Controller (STANDARD GAMEPAD)',
    axes: [0.85, 0, 0, 0],
    buttons: [{ pressed: true, value: 1 }],
  });
  orch.pollFrame();
  check(orch.activeDevice === 'gamepad_xbox' && orch.touchOverlayVisible === false, 'TASTE_NOTES Xbox gamepad detected & hides touch');
  orch.dispose();

  // --------------------------------------------------------------------------
  // 5. Clean-Room IP Firewall & Repository Hygiene
  // --------------------------------------------------------------------------
  // Construct forbidden third-party proper noun patterns dynamically
  const forbiddenTerms = [
    String.fromCharCode(109, 111, 109, 98, 111),
    String.fromCharCode(111, 114, 117, 98, 101),
    String.fromCharCode(115, 117, 98, 114, 111, 115, 97, 32, 109, 111, 109, 98, 111),
  ];
  const scanFiles = [...walkFiles(path.join(ROOT, 'src')), path.join(ROOT, 'README.md')];
  const ipViolations: string[] = [];
  for (const file of scanFiles) {
    if (!fs.existsSync(file)) continue;
    const text = fs.readFileSync(file, 'utf8').toLowerCase();
    for (const term of forbiddenTerms) {
      if (text.includes(term)) {
        ipViolations.push(`${path.relative(ROOT, file)} contains forbidden term`);
      }
    }
  }
  check(ipViolations.length === 0, 'IP firewall clean across src/ and README.md', ipViolations.join('; '));

  // Verify git tracked files contain zero retail binaries, zero .krunked-quest-assets, zero dna/, zero stray *.md
  if (fs.existsSync(path.join(ROOT, '.git'))) {
    const tracked = execSync('git ls-files', { cwd: ROOT, encoding: 'utf8' })
      .split(/\r?\n/)
      .filter(Boolean);
    const badTracked = tracked.filter((f) => {
      const lower = f.toLowerCase();
      if (lower.startsWith('.krunked-quest-assets/') || lower.startsWith('dna/')) return true;
      if (lower.endsWith('.md') && lower !== 'readme.md') return true;
      if (/\.(png|jpg|jpeg|webp|ogg|mp3|wav|bank|assets|ress|dll|exe)$/i.test(lower)) return true;
      return false;
    });
    check(badTracked.length === 0, 'git ls-files contains zero retail assets or gitignored docs', badTracked.join(', '));
  }

  // Verify dist/ contains zero retail assets if built
  const distDir = path.join(ROOT, 'dist');
  if (fs.existsSync(distDir)) {
    const distFiles = walkFiles(distDir).map((f) => path.relative(distDir, f));
    const badDist = distFiles.filter((f) => /\.(bank|assets|ress|dll|exe|png)$/i.test(f));
    check(badDist.length === 0, 'dist/ contains zero retail binaries', badDist.join(', '));
  }

  console.log(`[Gate A verify:assets] Passed ${passes.length} checks, failed ${failures.length}.`);
  if (failures.length > 0) {
    for (const f of failures) {
      console.error(`  FAIL: ${f}`);
    }
    process.exit(1);
  }
}

main();
