/**
 * Krunked Quest — Colossal 16-Bit Pixel-Art Boss Baker (All 8 Bosses & Mini-Bosses)
 * Clean-room procedural SNES/GBA pixel art baked on integer PixelCanvas buffers:
 * 4-frame 112x112 spritesheets (0=idleA, 1=idleB, 2=telegraph/windup, 3=attack/slam)
 * with hue-shifted color ramps, selective colored outlines, rim lighting, pixel rivets,
 * glowing energy cores, expressive faces, and silhouette-accurate white hit-flash copies.
 * Zero per-frame allocations; headless-safe; zero third-party proper nouns.
 */

import type { BossId } from '../contracts/index.js';
import { HIGHLIGHT_CREAM, OUTLINE_DARK, hexToAbgr } from './palettes.js';
import { PixelCanvas } from './PixelCraft.js';

export interface BakedBossSpriteSet {
  readonly sheet: HTMLCanvasElement;
  readonly flash: HTMLCanvasElement;
  readonly frameW: number;
  readonly frameH: number;
  readonly frameCount: number;
}

export interface BakedBossBundle {
  readonly bosses: Map<BossId, BakedBossSpriteSet>;
  readonly primalEyeIris: HTMLCanvasElement;
  readonly primalEyeTendril: HTMLCanvasElement;
}

const FW = 112;
const FH = 112;
const FRAMES = 4;

export function bakeAllBossSprites(): BakedBossBundle {
  const bosses = new Map<BossId, BakedBossSpriteSet>();
  bosses.set('dino_behemoth', bakeDinoBehemoth());
  bosses.set('primal_eye', bakePrimalEye());
  bosses.set('magma_boar_king', bakeMagmaBoarKing());
  bosses.set('bone_colossus', bakeBoneColossus());
  bosses.set('mecha_bull', bakeMechaBull());
  bosses.set('electro_sphinx', bakeElectroSphinx());
  bosses.set('shadow_doppelganger', bakeShadowDoppelganger());
  bosses.set('nightmare_sovereign', bakeNightmareSovereign());

  return {
    bosses,
    primalEyeIris: bakePrimalEyeIris(),
    primalEyeTendril: bakePrimalEyeTendril(),
  };
}

function finalizeBoss(sheet: PixelCanvas): BakedBossSpriteSet {
  return {
    sheet: sheet.toCanvas(),
    flash: sheet.toWhiteFlashCanvas(),
    frameW: FW,
    frameH: FH,
    frameCount: FRAMES,
  };
}

// ============================================================================
// 1. DINO BEHEMOTH — Armored Emerald Primal Saurian with Sunlit Plates & Jaws
// ============================================================================

function bakeDinoBehemoth(): BakedBossSpriteSet {
  const sheet = new PixelCanvas(FW * FRAMES, FH);
  const b = new PixelCanvas(FW, FH);
  const cOut = hexToAbgr('#0c2918');
  const cWhite = hexToAbgr(HIGHLIGHT_CREAM);
  const sSpec = hexToAbgr('#c8ff78');
  const sHi = hexToAbgr('#66e04c');
  const sMid = hexToAbgr('#229638');
  const sDark = hexToAbgr('#12542b');
  const sDeep = hexToAbgr('#0b3321');
  const bellyHi = hexToAbgr('#fff5b8');
  const bellyMid = hexToAbgr('#e6be5c');
  const plateHi = hexToAbgr('#ffe659');
  const plateMid = hexToAbgr('#d9801c');
  const mouthRed = hexToAbgr('#a81436');
  const eyeRed = hexToAbgr('#ff3858');

  for (let f = 0; f < FRAMES; f++) {
    b.clear();
    const bob = f === 1 ? 2 : f === 2 ? -3 : f === 3 ? 4 : 0;
    const stride = f === 1 ? 3 : f === 3 ? -4 : 0;
    const jawOpen = f === 2 ? 10 : f === 3 ? 6 : 2;
    const cx = 54;
    const baseY = 104;

    // Sweeping thick armored tail behind left
    b.poly(
      [
        [cx - 18, baseY - 26 + bob],
        [cx - 48, baseY - 16 + bob],
        [cx - 44, baseY - 4 + bob],
        [cx - 12, baseY - 8 + bob],
      ],
      sDark,
    );
    b.poly(
      [
        [cx - 18, baseY - 26 + bob],
        [cx - 46, baseY - 16 + bob],
        [cx - 20, baseY - 14 + bob],
      ],
      sMid,
    );
    // Tail ridge plates
    b.tri(cx - 42, baseY - 17 + bob, cx - 44, baseY - 25 + bob, cx - 35, baseY - 19 + bob, plateHi);
    b.tri(cx - 32, baseY - 21 + bob, cx - 34, baseY - 31 + bob, cx - 24, baseY - 23 + bob, plateHi);

    // Back leg
    b.roundedRect(cx - 18 + stride, baseY - 24, 16, 22, sDark, 3);
    b.rect(cx - 16 + stride, baseY - 5, 4, 4, cWhite);
    b.rect(cx - 10 + stride, baseY - 5, 4, 4, cWhite);

    // Massive muscular torso + sunlit armored back scales + ridged cream belly
    b.ellipseShaded(cx - 4, baseY - 38 + bob, 28, 25, sHi, sMid, sDark, sSpec, sDeep);
    // Cream ribbed belly plating
    b.ellipseShaded(cx + 8, baseY - 30 + bob, 16, 17, bellyHi, bellyMid, sDark);
    for (let ry = -10; ry <= 10; ry += 5) {
      b.line(cx - 2, baseY - 30 + ry + bob, cx + 20, baseY - 29 + ry + bob, sDark);
    }

    // Back golden-amber dorsal crests
    const spines: readonly [number, number][] = [
      [cx - 28, baseY - 48],
      [cx - 22, baseY - 60],
      [cx - 12, baseY - 68],
      [cx, baseY - 72],
    ];
    for (const [sx, sy] of spines) {
      b.tri(sx - 5, sy + 8 + bob, sx - 2, sy - 6 + bob, sx + 6, sy + 6 + bob, plateMid);
      b.tri(sx - 4, sy + 7 + bob, sx - 2, sy - 5 + bob, sx + 2, sy + 5 + bob, plateHi);
    }

    // Front heavy stomping leg + tiny fierce clawed fore-arm
    b.roundedRect(cx + 2 - stride, baseY - 24, 18, 23, sMid, 3);
    b.rect(cx + 4 - stride, baseY - 22, 5, 16, sHi);
    b.rect(cx + 6 - stride, baseY - 5, 4, 4, cWhite);
    b.rect(cx + 12 - stride, baseY - 5, 4, 4, cWhite);
    b.rect(cx + 17 - stride, baseY - 5, 3, 4, cWhite);
    b.ellipseShaded(cx + 22, baseY - 38 + bob, 8, 5, sHi, sMid, sDark);

    // Colossal horned Tyrannosaur head & articulated snapping jaws!
    const hx = cx + 18;
    const hy = baseY - 66 + bob;
    // Lower hinged jaw
    b.roundedRect(hx - 4, hy + 8 + jawOpen, 32, 11, sDark, 3);
    b.rect(hx - 2, hy + 10 + jawOpen, 28, 4, sMid);
    // Mouth interior
    if (jawOpen > 2) {
      b.rect(hx + 2, hy + 5, 24, jawOpen + 4, mouthRed);
    }
    // Upper armored cranium & snout
    b.roundedRect(hx - 14, hy - 14, 44, 22, sMid, 5);
    b.roundedRect(hx - 12, hy - 13, 38, 10, sHi, 4);
    b.rect(hx - 10, hy - 13, 28, 3, sSpec);
    // Prominent brow ridge & fierce glowing red eye
    b.roundedRect(hx - 2, hy - 17, 15, 8, plateMid, 2);
    b.rect(hx, hy - 16, 11, 3, plateHi);
    b.rect(hx + 2, hy - 9, 8, 7, cOut);
    b.rect(hx + 4, hy - 8, 5, 5, eyeRed);
    b.rect(hx + 5, hy - 7, 2, 2, cWhite);
    // Nostril & twin nasal crest horns
    b.rect(hx + 22, hy - 7, 3, 3, sDeep);
    b.tri(hx + 18, hy - 13, hx + 24, hy - 22, hx + 27, hy - 13, plateHi);
    // Razor white upper & lower fangs
    for (let tx = 0; tx < 4; tx++) {
      b.tri(hx + 4 + tx * 6, hy + 7, hx + 6 + tx * 6, hy + 13, hx + 8 + tx * 6, hy + 7, cWhite);
      b.tri(
        hx + 6 + tx * 6,
        hy + 9 + jawOpen,
        hx + 8 + tx * 6,
        hy + 4 + jawOpen,
        hx + 10 + tx * 6,
        hy + 9 + jawOpen,
        cWhite,
      );
    }

    b.selectiveOutline(cOut, 0.55, 0.9);
    sheet.blit(b, f * FW, 0);
  }
  return finalizeBoss(sheet);
}

// ============================================================================
// 2. PRIMAL EYE — Ancient Bark & Bioluminescent Moss Forest Guardian Eye
// ============================================================================

function bakePrimalEye(): BakedBossSpriteSet {
  const sheet = new PixelCanvas(FW * FRAMES, FH);
  const b = new PixelCanvas(FW, FH);
  const cOut = hexToAbgr('#1f0d18');
  const cWhite = hexToAbgr(HIGHLIGHT_CREAM);
  const barkSpec = hexToAbgr('#e6a266');
  const barkHi = hexToAbgr('#ba703c');
  const barkMid = hexToAbgr('#7d3e24');
  const barkDark = hexToAbgr('#451c1a');
  const mossSpec = hexToAbgr('#d8ff78');
  const mossHi = hexToAbgr('#78e838');
  const mossMid = hexToAbgr('#2ca629');
  const mossDark = hexToAbgr('#145928');
  const scleraHi = hexToAbgr('#fff8e6');
  const scleraMid = hexToAbgr('#ebd4b8');
  const scleraSh = hexToAbgr('#c49e91');
  const vein = hexToAbgr('#cc336b');
  const petal = hexToAbgr('#ff427a');

  for (let f = 0; f < FRAMES; f++) {
    b.clear();
    const cx = 56;
    const cy = 56;
    const pulse = f === 1 ? 2 : f === 2 ? -2 : f === 3 ? 3 : 0;

    // 12 Gnarled root horns & crimson thorny petals radiating symmetrically
    for (let a = 0; a < 12; a++) {
      const th = (a / 12) * Math.PI * 2 + f * 0.06;
      const rIn = 34;
      const rOut = 48 + (a % 2) * 5;
      const x1 = cx + Math.round(Math.cos(th - 0.16) * rIn);
      const y1 = cy + Math.round(Math.sin(th - 0.16) * rIn);
      const x2 = cx + Math.round(Math.cos(th + 0.16) * rIn);
      const y2 = cy + Math.round(Math.sin(th + 0.16) * rIn);
      const tx = cx + Math.round(Math.cos(th) * rOut);
      const ty = cy + Math.round(Math.sin(th) * rOut);
      b.tri(x1, y1, tx, ty, x2, y2, a % 3 === 0 ? petal : a % 2 === 0 ? barkMid : mossMid);
      b.line(x1, y1, tx, ty, a % 3 === 0 ? cWhite : a % 2 === 0 ? barkHi : mossHi);
    }

    // Thick ancient carved bark orb shell
    b.ellipseShaded(cx, cy, 40 + pulse, 38 - pulse * 0.4, barkHi, barkMid, barkDark, barkSpec);
    // Lush hanging moss crown draping across upper brow
    b.ellipseShaded(cx, cy - 26, 30, 12, mossHi, mossMid, mossDark, mossSpec);
    b.ellipseShaded(cx - 18, cy - 20, 10, 8, mossHi, mossMid, mossDark);
    b.ellipseShaded(cx + 18, cy - 20, 10, 8, mossMid, mossDark, barkDark);

    // Wide organic veined sclera eyeball socket
    const openY = f === 2 ? 20 : 27;
    b.ellipseShaded(cx, cy, 30, openY, scleraHi, scleraMid, scleraSh, cWhite);
    // Organic pulsing crimson veins
    b.line(cx - 27, cy - 8, cx - 16, cy - 3, vein);
    b.line(cx - 25, cy + 9, cx - 15, cy + 5, vein);
    b.line(cx + 27, cy - 6, cx + 16, cy - 2, vein);
    b.line(cx + 24, cy + 10, cx + 15, cy + 6, vein);

    // Sculpted bark eyelids
    b.ellipseShaded(cx, cy - openY + 1, 26, 6, barkHi, barkDark, cOut);
    b.ellipseShaded(cx, cy + openY - 1, 24, 5, barkMid, barkDark, cOut);

    b.selectiveOutline(cOut, 0.52, 0.88);
    sheet.blit(b, f * FW, 0);
  }
  return finalizeBoss(sheet);
}

function bakePrimalEyeIris(): HTMLCanvasElement {
  const b = new PixelCanvas(32, 32);
  const cOut = hexToAbgr(OUTLINE_DARK);
  const cWhite = hexToAbgr(HIGHLIGHT_CREAM);
  b.ellipseShaded(16, 16, 13, 13, hexToAbgr('#d8ff66'), hexToAbgr('#38cc38'), hexToAbgr('#125930'));
  b.ellipseShaded(16, 16, 9, 9, hexToAbgr('#ffe84d'), hexToAbgr('#ff991a'), hexToAbgr('#a83214'));
  b.ellipse(16, 16, 3.2, 10, cOut);
  b.rect(11, 9, 4, 4, cWhite);
  b.rect(19, 19, 2, 2, cWhite);
  b.selectiveOutline(cOut, 0.5, 0.88);
  return b.toCanvas();
}

function bakePrimalEyeTendril(): HTMLCanvasElement {
  const b = new PixelCanvas(28, 28);
  const cOut = hexToAbgr(OUTLINE_DARK);
  const cWhite = hexToAbgr(HIGHLIGHT_CREAM);
  b.tri(14, 1, 10, 8, 18, 8, hexToAbgr('#ff427a'));
  b.tri(14, 27, 10, 20, 18, 20, hexToAbgr('#ff427a'));
  b.tri(1, 14, 8, 10, 8, 18, hexToAbgr('#ff427a'));
  b.tri(27, 14, 20, 10, 20, 18, hexToAbgr('#ff427a'));
  b.ellipseShaded(14, 14, 8.5, 8.5, hexToAbgr('#b8ff59'), hexToAbgr('#38b82c'), hexToAbgr('#145926'), cWhite);
  b.ellipse(14, 14, 3, 3, hexToAbgr('#ff427a'));
  b.px(13, 13, cWhite);
  b.selectiveOutline(cOut, 0.5, 0.88);
  return b.toCanvas();
}

// ============================================================================
// 3. MAGMA BOAR KING — Hulking Volcanic Tusked War-Chief with Blazing War-Club!
// ============================================================================

function bakeMagmaBoarKing(): BakedBossSpriteSet {
  const sheet = new PixelCanvas(FW * FRAMES, FH);
  const b = new PixelCanvas(FW, FH);
  const cOut = hexToAbgr('#1f0a14');
  const cWhite = hexToAbgr(HIGHLIGHT_CREAM);
  const skinHi = hexToAbgr('#ff94c2');
  const skinMid = hexToAbgr('#bd3880');
  const skinDark = hexToAbgr('#661852');
  const jadeHi = hexToAbgr('#8cffd4');
  const jadeMid = hexToAbgr('#22a88c');
  const jadeDark = hexToAbgr('#124a52');
  const goldHi = hexToAbgr('#fff48c');
  const goldMid = hexToAbgr('#ffad16');
  const magmaHot = hexToAbgr('#fff799');
  const magmaMid = hexToAbgr('#ff3838');
  const magmaDark = hexToAbgr('#8f0d24');

  for (let f = 0; f < FRAMES; f++) {
    b.clear();
    const bob = f === 1 ? 2 : f === 2 ? -3 : f === 3 ? 3 : 0;
    const cx = 62;
    const baseY = 104;
    const clubLift = f === 2 ? -22 : f === 3 ? 12 : f === 1 ? -3 : 0;

    // 1. Massive studded volcanic magma war-club held on the left (dramatic iconic silhouette!)
    const clubX = 14;
    const clubY = baseY - 38 + clubLift + bob;
    b.poly(
      [
        [clubX + 26, clubY + 14],
        [clubX, clubY - 12],
        [clubX - 6, clubY + 4],
        [clubX + 20, clubY + 24],
      ],
      magmaDark,
    );
    b.poly(
      [
        [clubX + 24, clubY + 12],
        [clubX + 1, clubY - 10],
        [clubX - 3, clubY + 2],
        [clubX + 19, clubY + 20],
      ],
      magmaMid,
    );
    b.line(clubX + 2, clubY - 8, clubX + 22, clubY + 11, magmaHot, 2);
    // Glowing obsidian-gold rivets/studs along war-club
    const studs: readonly [number, number][] = [
      [clubX + 5, clubY - 11],
      [clubX + 13, clubY - 4],
      [clubX + 20, clubY + 3],
      [clubX + 2, clubY + 11],
      [clubX + 10, clubY + 18],
    ];
    for (const [sx, sy] of studs) {
      b.ellipse(sx, sy, 3, 3, goldMid);
      b.px(sx - 1, sy - 1, goldHi);
    }

    // 2. Flowing royal crimson cape & sturdy warrior legs/kilt
    b.tri(cx - 26, baseY - 56 + bob, cx + 32, baseY - 52 + bob, cx + 38, baseY - 10, magmaDark);
    b.roundedRect(cx - 22, baseY - 18, 16, 16, skinDark, 3);
    b.roundedRect(cx + 6, baseY - 18, 16, 16, skinDark, 3);
    // Jade warrior sash & golden belt buckle
    b.roundedRect(cx - 24, baseY - 26 + bob, 48, 14, jadeMid, 3);
    b.rect(cx - 22, baseY - 26 + bob, 44, 4, jadeHi);
    b.roundedRect(cx - 8, baseY - 28 + bob, 16, 10, goldMid, 2);
    b.rect(cx - 6, baseY - 27 + bob, 12, 3, goldHi);

    // 3. Broad muscular war-chief torso with glowing volcanic war-paint & golden armlets
    b.ellipseShaded(cx, baseY - 44 + bob, 28, 22, skinHi, skinMid, skinDark);
    // Sculpted pectorals & warm rim light
    b.line(cx - 16, baseY - 40 + bob, cx - 2, baseY - 38 + bob, goldHi, 2);
    b.line(cx + 2, baseY - 38 + bob, cx + 16, baseY - 40 + bob, goldHi, 2);
    // Heavy fists + gold gauntlets
    b.ellipseShaded(cx - 28, baseY - 32 + bob + (clubLift >> 2), 11, 10, skinHi, skinMid, skinDark);
    b.rect(cx - 33, baseY - 37 + bob + (clubLift >> 2), 10, 4, goldHi);
    b.ellipseShaded(cx + 28, baseY - 28 + bob, 12, 11, skinHi, skinMid, skinDark);
    b.rect(cx + 22, baseY - 35 + bob, 12, 4, goldHi);

    // 4. Ornate Horned Jade-Beast Helmet framing fierce Boar Snout & Ivory Tusks!
    const hy = baseY - 72 + bob;
    // Giant jade beast-skull helm crest
    b.ellipseShaded(cx, hy - 4, 27, 22, jadeHi, jadeMid, jadeDark, cWhite);
    // Fiery Mohawk crest jewel on top of helmet
    b.ellipse(cx, hy - 22, 10, 5, magmaMid);
    b.ellipse(cx, hy - 23, 6, 3, goldHi);
    // Helmet beast-eyes + nose emblem
    b.ellipse(cx - 18, hy - 14, 3.5, 3.5, cWhite);
    b.px(cx - 18, hy - 14, cOut);
    b.ellipse(cx + 18, hy - 14, 3.5, 3.5, cWhite);
    b.px(cx + 18, hy - 14, cOut);
    b.tri(cx - 7, hy - 15, cx + 7, hy - 15, cx, hy - 7, magmaMid);
    // Open helmet jaw revealing Boar King's fierce face & snout!
    b.roundedRect(cx - 17, hy - 3, 34, 21, skinDark, 3);
    b.roundedRect(cx - 15, hy - 1, 30, 17, skinMid, 3);
    // Glowing fierce golden eyes under helmet brow
    b.rect(cx - 12, hy + 1, 6, 4, goldHi);
    b.rect(cx + 6, hy + 1, 6, 4, goldHi);
    b.px(cx - 9, hy + 2, cOut);
    b.px(cx + 9, hy + 2, cOut);
    // Broad boar snout
    b.ellipseShaded(cx, hy + 10, 9, 6, skinHi, skinMid, skinDark);
    b.rect(cx - 4, hy + 9, 2, 3, cOut);
    b.rect(cx + 2, hy + 9, 2, 3, cOut);
    // Huge curved ivory boar tusks!
    b.tri(cx - 16, hy + 14, cx - 22, hy - 2, cx - 10, hy + 12, cWhite);
    b.tri(cx + 16, hy + 14, cx + 22, hy - 2, cx + 10, hy + 12, cWhite);
    // Upper helmet fangs
    b.tri(cx - 14, hy - 3, cx - 11, hy + 4, cx - 8, hy - 3, cWhite);
    b.tri(cx + 8, hy - 3, cx + 11, hy + 4, cx + 14, hy - 3, cWhite);

    b.selectiveOutline(cOut, 0.5, 0.9);
    sheet.blit(b, f * FW, 0);
  }
  return finalizeBoss(sheet);
}

// ============================================================================
// 4. BONE COLOSSUS — Horned Skeletal Desert Titan with Soulfire Core & Gauntlets
// ============================================================================

function bakeBoneColossus(): BakedBossSpriteSet {
  const sheet = new PixelCanvas(FW * FRAMES, FH);
  const b = new PixelCanvas(FW, FH);
  const cOut = hexToAbgr('#1a1224');
  const cWhite = hexToAbgr(HIGHLIGHT_CREAM);
  const boneSpec = hexToAbgr('#fff8e6');
  const boneHi = hexToAbgr('#e8d6b8');
  const boneMid = hexToAbgr('#baa07d');
  const boneDark = hexToAbgr('#735b49');
  const shroudMid = hexToAbgr('#352954');
  const shroudDark = hexToAbgr('#1c1433');
  const soulHi = hexToAbgr('#d8ffff');
  const soulMid = hexToAbgr('#38f2e6');
  const soulDark = hexToAbgr('#147899');

  for (let f = 0; f < FRAMES; f++) {
    b.clear();
    const hover = f === 1 ? -3 : f === 2 ? -6 : f === 3 ? 4 : 0;
    const cx = 56;
    const cy = 54 + hover;

    // Tattered midnight spectral shroud draping beneath ribcage
    b.poly(
      [
        [cx - 24, cy + 4],
        [cx + 24, cy + 4],
        [cx + 28, cy + 42],
        [cx + 14, cy + 32],
        [cx, cy + 46],
        [cx - 14, cy + 32],
        [cx - 28, cy + 42],
      ],
      shroudDark,
    );
    b.poly(
      [
        [cx - 20, cy + 6],
        [cx + 20, cy + 6],
        [cx + 22, cy + 32],
        [cx, cy + 38],
        [cx - 22, cy + 32],
      ],
      shroudMid,
    );

    // Glowing cyan soulfire heart core inside ribcage!
    b.ellipseShaded(cx, cy + 16, 12, 14, soulHi, soulMid, soulDark, cWhite);

    // Curved armored ivory skeletal ribs embracing the soulfire core
    for (let r = 0; r < 3; r++) {
      const ry = cy + 6 + r * 8;
      const rw = 22 - r * 3;
      b.roundedRect(cx - rw, ry, rw - 5, 5, boneMid, 2);
      b.rect(cx - rw + 1, ry, rw - 7, 2, boneHi);
      b.roundedRect(cx + 6, ry, rw - 5, 5, boneMid, 2);
      b.rect(cx + 7, ry, rw - 7, 2, boneHi);
    }

    // Spiked bone pauldrons
    b.ellipseShaded(cx - 28, cy + 2, 12, 10, boneHi, boneMid, boneDark, boneSpec);
    b.tri(cx - 34, cy - 2, cx - 44, cy - 14, cx - 26, cy - 7, boneSpec);
    b.ellipseShaded(cx + 28, cy + 2, 12, 10, boneHi, boneMid, boneDark, boneSpec);
    b.tri(cx + 34, cy - 2, cx + 44, cy - 14, cx + 26, cy - 7, boneSpec);

    // Massive floating bone-club smash gauntlets!
    const armLift = f === 2 ? -14 : f === 3 ? 16 : f === 1 ? -3 : 0;
    b.ellipseShaded(cx - 38, cy + 24 + armLift, 11, 13, boneHi, boneMid, boneDark, boneSpec);
    b.rect(cx - 43, cy + 20 + armLift, 10, 3, soulMid);
    b.ellipseShaded(cx + 38, cy + 24 - (armLift >> 1), 11, 13, boneHi, boneMid, boneDark, boneSpec);
    b.rect(cx + 33, cy + 20 - (armLift >> 1), 10, 3, soulMid);

    // Towering Horned Ancient Skull Crown!
    // Sweeping curved devil-bull horns
    b.poly(
      [
        [cx - 18, cy - 22],
        [cx - 36, cy - 44],
        [cx - 24, cy - 42],
        [cx - 10, cy - 26],
      ],
      boneMid,
    );
    b.line(cx - 17, cy - 23, cx - 34, cy - 43, boneSpec, 2);
    b.poly(
      [
        [cx + 18, cy - 22],
        [cx + 36, cy - 44],
        [cx + 24, cy - 42],
        [cx + 10, cy - 26],
      ],
      boneMid,
    );
    b.line(cx + 17, cy - 23, cx + 34, cy - 43, boneSpec, 2);

    // Sculpted cranium + jaw
    b.ellipseShaded(cx, cy - 18, 21, 18, boneHi, boneMid, boneDark, boneSpec);
    b.roundedRect(cx - 14, cy - 5, 28, 12, boneMid, 2);
    for (let tx = -10; tx <= 10; tx += 5) {
      b.rect(cx + tx - 1, cy - 4, 3, 9, boneSpec);
      b.rect(cx + tx + 2, cy - 4, 1, 9, boneDark);
    }
    // Deep sockets with blazing cyan soulfire flames!
    b.ellipse(cx - 8, cy - 18, 6, 6.5, cOut);
    b.ellipse(cx + 8, cy - 18, 6, 6.5, cOut);
    b.ellipse(cx - 8, cy - 18, 3.5, 4, soulMid);
    b.ellipse(cx + 8, cy - 18, 3.5, 4, soulMid);
    b.tri(cx - 10, cy - 20, cx - 8, cy - 29, cx - 5, cy - 20, soulHi);
    b.tri(cx + 5, cy - 20, cx + 8, cy - 29, cx + 10, cy - 20, soulHi);
    b.px(cx - 8, cy - 18, cWhite);
    b.px(cx + 8, cy - 18, cWhite);
    // Nasal cavity
    b.tri(cx - 3, cy - 9, cx, cy - 14, cx + 3, cy - 9, cOut);

    b.selectiveOutline(cOut, 0.5, 0.9);
    sheet.blit(b, f * FW, 0);
  }
  return finalizeBoss(sheet);
}

// ============================================================================
// 5. MECHA BULL — Steampunk Copper & Iron Armored Bulldozer-Bull on Tank Treads!
// ============================================================================

function bakeMechaBull(): BakedBossSpriteSet {
  const sheet = new PixelCanvas(FW * FRAMES, FH);
  const b = new PixelCanvas(FW, FH);
  const cOut = hexToAbgr('#1a121f');
  const cWhite = hexToAbgr(HIGHLIGHT_CREAM);
  const brSpec = hexToAbgr('#ffe680');
  const brHi = hexToAbgr('#e69d38');
  const brMid = hexToAbgr('#ad5c24');
  const brDark = hexToAbgr('#662e18');
  const stlHi = hexToAbgr('#b8c4d9');
  const stlMid = hexToAbgr('#6c768c');
  const stlDark = hexToAbgr('#353b4d');
  const lampGlow = hexToAbgr('#fff799');
  const lampMid = hexToAbgr('#ffd238');
  const redHot = hexToAbgr('#ff3848');

  for (let f = 0; f < FRAMES; f++) {
    b.clear();
    const chug = f === 1 ? -2 : f === 2 ? 2 : f === 3 ? -1 : 0;
    const treadShift = (f & 1) * 4;
    const cx = 56;
    const baseY = 104;

    // 1. Heavy dual caterpillar tank treads churning along bottom!
    b.roundedRect(cx - 38, baseY - 22, 34, 20, stlDark, 6);
    b.roundedRect(cx + 4, baseY - 22, 34, 20, stlDark, 6);
    b.roundedRect(cx - 34, baseY - 19, 26, 14, stlMid, 4);
    b.roundedRect(cx + 8, baseY - 19, 26, 14, stlMid, 4);
    // Spinning bronze drive wheels & tread cleats
    for (let wx = 0; wx < 3; wx++) {
      b.ellipseShaded(cx - 30 + wx * 9, baseY - 12, 4, 4, brHi, brMid, brDark);
      b.ellipseShaded(cx + 12 + wx * 9, baseY - 12, 4, 4, brHi, brMid, brDark);
    }
    for (let tx = -34 + treadShift; tx <= 34; tx += 7) {
      b.rect(cx + tx, baseY - 23, 3, 2, stlHi);
      b.rect(cx + tx, baseY - 3, 3, 2, cOut);
    }

    // 2. Heavy riveted copper-and-iron bulldozer chassis with angled armored brow & steam exhaust!
    b.rect(cx - 38, baseY - 66 + chug, 9, 30, stlMid);
    b.rect(cx - 37, baseY - 66 + chug, 3, 30, stlHi);
    b.rect(cx - 40, baseY - 70 + chug, 13, 5, brHi);
    // Main armored boiler cabin with angled bevel shoulders (zero flat rectangle!)
    b.poly(
      [
        [cx - 26, baseY - 70 + chug],
        [cx + 22, baseY - 70 + chug],
        [cx + 32, baseY - 58 + chug],
        [cx + 32, baseY - 22 + chug],
        [cx - 32, baseY - 22 + chug],
        [cx - 32, baseY - 56 + chug],
      ],
      brMid,
    );
    b.poly(
      [
        [cx - 24, baseY - 68 + chug],
        [cx + 16, baseY - 68 + chug],
        [cx + 16, baseY - 26 + chug],
        [cx - 28, baseY - 26 + chug],
        [cx - 28, baseY - 55 + chug],
      ],
      brHi,
    );
    b.rect(cx - 22, baseY - 68 + chug, 34, 4, brSpec);
    // Riveted curved shoulder cowlings & armor plate seams
    b.rect(cx - 31, baseY - 46 + chug, 62, 3, brDark);
    b.rect(cx - 31, baseY - 43 + chug, 62, 1, brSpec);
    for (let ry = baseY - 60; ry <= baseY - 28; ry += 8) {
      b.px(cx - 26, ry + chug, brSpec);
      b.px(cx + 26, ry + chug, stlHi);
    }
    // Glowing golden triangular foundry insignia on upper brow plate
    b.tri(cx - 8, baseY - 48 + chug, cx, baseY - 62 + chug, cx + 8, baseY - 48 + chug, brDark);
    b.tri(cx - 6, baseY - 49 + chug, cx, baseY - 59 + chug, cx + 6, baseY - 49 + chug, brSpec);

    // 3. Roaring furnace grille + twin blazing incandescent headlights (pointing forward-right!)
    b.roundedRect(cx - 4, baseY - 40 + chug, 28, 18, stlDark, 3);
    for (let gx = 0; gx < 5; gx++) {
      b.rect(cx + gx * 5, baseY - 38 + chug, 2, 14, f === 2 ? redHot : stlHi);
    }
    // Glowing golden locomotive headlights
    b.ellipseShaded(cx - 12, baseY - 32 + chug, 8, 8, cWhite, lampGlow, lampMid);
    b.ellipseShaded(cx + 28, baseY - 32 + chug, 8, 8, cWhite, lampGlow, lampMid);
    // Armored nose-ring emblem
    b.ellipse(cx + 10, baseY - 22 + chug, 6, 4, brSpec);
    b.ellipse(cx + 10, baseY - 22 + chug, 3, 2, stlDark);

    // 4. Twin spinning golden spiral DRILL HORNS mounted atop armored crown!
    const drillSpin = (f & 1) * 3;
    const horns: readonly [number, number][] = [
      [cx - 20, baseY - 68 + chug],
      [cx + 18, baseY - 68 + chug],
    ];
    for (const [hx, hy] of horns) {
      b.rect(hx - 10, hy - 3, 20, 5, stlHi);
      b.tri(hx - 9, hy - 3, hx, hy - 34, hx + 9, hy - 3, brMid);
      b.tri(hx - 7, hy - 3, hx, hy - 32, hx + 2, hy - 3, brHi);
      // Fluted golden spiral threads
      for (let sy = 6; sy < 28; sy += 6) {
        const hw = Math.max(1, Math.round((1 - sy / 32) * 8));
        b.line(hx - hw, hy - sy + drillSpin, hx + hw, hy - sy - 2 + drillSpin, brSpec, 2);
      }
      b.px(hx, hy - 34, cWhite);
    }
    // Glowing red cyclops scanner visor between drill horns
    b.rect(cx - 10, baseY - 56 + chug, 22, 6, cOut);
    b.rect(cx - 8 + (f % 3) * 3, baseY - 55 + chug, 10, 4, redHot);
    b.rect(cx - 6 + (f % 3) * 3, baseY - 55 + chug, 4, 2, cWhite);

    b.selectiveOutline(cOut, 0.5, 0.9);
    sheet.blit(b, f * FW, 0);
  }
  return finalizeBoss(sheet);
}

// ============================================================================
// 6. ELECTRO SPHINX — Gilded Celestial Pharaoh Guardian with Winged Headdress
// ============================================================================

function bakeElectroSphinx(): BakedBossSpriteSet {
  const sheet = new PixelCanvas(FW * FRAMES, FH);
  const b = new PixelCanvas(FW, FH);
  const cOut = hexToAbgr('#120c2b');
  const cWhite = hexToAbgr(HIGHLIGHT_CREAM);
  const gSpec = hexToAbgr('#fff7a6');
  const gHi = hexToAbgr('#ffd238');
  const gMid = hexToAbgr('#c78318');
  const gDark = hexToAbgr('#6e3b10');
  const lapisHi = hexToAbgr('#42a8ff');
  const lapisMid = hexToAbgr('#1848b8');
  const lapisDark = hexToAbgr('#0c2066');
  const cyanHi = hexToAbgr('#d8ffff');
  const cyanMid = hexToAbgr('#38f2ff');

  for (let f = 0; f < FRAMES; f++) {
    b.clear();
    const hover = f === 1 ? -3 : f === 2 ? -5 : f === 3 ? 2 : 0;
    const cx = 56;
    const cy = 54 + hover;
    const wingFlare = f === 2 ? 4 : f === 3 ? -3 : 0;

    // 1. Sweeping 6-bladed gilded energy wings radiating behind headdress!
    for (let w = 0; w < 3; w++) {
      const wy = cy - 16 + w * 13;
      const span = 48 - w * 4 + wingFlare;
      // Left wing blade
      b.poly(
        [
          [cx - 16, wy],
          [cx - span, wy - 8 + w * 4],
          [cx - span + 6, wy + 5 + w * 2],
          [cx - 16, wy + 8],
        ],
        w === 1 ? cyanMid : gMid,
      );
      b.line(cx - 16, wy + 1, cx - span + 2, wy - 6 + w * 4, w === 1 ? cyanHi : gSpec, 2);
      // Right wing blade
      b.poly(
        [
          [cx + 16, wy],
          [cx + span, wy - 8 + w * 4],
          [cx + span - 6, wy + 5 + w * 2],
          [cx + 16, wy + 8],
        ],
        w === 1 ? cyanMid : gMid,
      );
      b.line(cx + 16, wy + 1, cx + span - 2, wy - 6 + w * 4, w === 1 ? cyanHi : gSpec, 2);
    }

    // 2. Royal Striped Lapis & Gold Nemes Pharaoh Headdress
    b.poly(
      [
        [cx - 24, cy - 24],
        [cx + 24, cy - 24],
        [cx + 32, cy + 16],
        [cx + 14, cy + 24],
        [cx - 14, cy + 24],
        [cx - 32, cy + 16],
      ],
      gMid,
    );
    b.poly(
      [
        [cx - 22, cy - 22],
        [cx + 22, cy - 22],
        [cx + 26, cy + 14],
        [cx - 26, cy + 14],
      ],
      gHi,
    );
    // Royal horizontal lapis blue stripes across nemes
    for (let sy = cy - 16; sy <= cy + 14; sy += 6) {
      b.rect(cx - 26, sy, 52, 2, lapisMid);
      b.rect(cx - 24, sy, 20, 1, lapisHi);
    }

    // 3. Sculpted Golden Pharaoh War-Mask Face + Diamond Astral Chest Core
    b.poly(
      [
        [cx - 14, cy - 18],
        [cx + 14, cy - 18],
        [cx + 11, cy + 6],
        [cx, cy + 14],
        [cx - 11, cy + 6],
      ],
      gSpec,
    );
    b.poly(
      [
        [cx, cy - 18],
        [cx + 14, cy - 18],
        [cx + 11, cy + 6],
        [cx, cy + 14],
      ],
      gHi,
    );
    // Fierce glowing cyan pharaoh eyes
    b.tri(cx - 11, cy - 8, cx - 3, cy - 4, cx - 9, cy - 2, lapisDark);
    b.tri(cx + 11, cy - 8, cx + 3, cy - 4, cx + 9, cy - 2, lapisDark);
    b.rect(cx - 9, cy - 6, 4, 3, cyanHi);
    b.rect(cx + 5, cy - 6, 4, 3, cyanHi);
    // Forehead plasma diamond & floating astral beard/core
    b.tri(cx, cy - 34, cx - 8, cy - 22, cx + 8, cy - 22, cyanMid);
    b.tri(cx, cy - 32, cx - 4, cy - 22, cx + 4, cy - 22, cWhite);
    // Lower tapered golden plinth core
    b.poly(
      [
        [cx - 14, cy + 20],
        [cx + 14, cy + 20],
        [cx, cy + 40],
      ],
      gMid,
    );
    b.tri(cx - 7, cy + 22, cx + 7, cy + 22, cx, cy + 34, cyanMid);
    b.px(cx, cy + 26, cWhite);

    // 4. Twin Floating Clawed Plasma Gauntlets!
    const pawOff = f === 2 ? -8 : f === 3 ? 10 : 0;
    const paws = [cx - 34, cx + 34];
    for (const px of paws) {
      const py = cy + 24 + pawOff;
      b.roundedRect(px - 10, py - 9, 20, 16, gMid, 4);
      b.rect(px - 8, py - 8, 16, 4, gSpec);
      b.ellipseShaded(px, py - 1, 6, 6, cWhite, cyanHi, lapisMid);
      // 3 razor metallic claws
      b.tri(px - 8, py + 7, px - 6, py + 15, px - 3, py + 7, gDark);
      b.tri(px - 2, py + 7, px, py + 16, px + 2, py + 7, gDark);
      b.tri(px + 3, py + 7, px + 6, py + 15, px + 8, py + 7, gDark);
    }

    b.selectiveOutline(cOut, 0.5, 0.9);
    sheet.blit(b, f * FW, 0);
  }
  return finalizeBoss(sheet);
}

// ============================================================================
// 7. SHADOW DOPPELGANGER — Menacing Neon-Rimmed Dark Mirror Rival!
// ============================================================================

function bakeShadowDoppelganger(): BakedBossSpriteSet {
  const sheet = new PixelCanvas(FW * FRAMES, FH);
  const b = new PixelCanvas(FW, FH);
  const cWhite = hexToAbgr(HIGHLIGHT_CREAM);
  const rimPink = hexToAbgr('#ff1c78');
  const rimGlow = hexToAbgr('#ff8ac4');
  const vHi = hexToAbgr('#8f24b8');
  const vMid = hexToAbgr('#471066');
  const vDark = hexToAbgr('#1a0826');
  const acidHi = hexToAbgr('#c8ff80');
  const acidMid = hexToAbgr('#24e848');
  const acidDark = hexToAbgr('#0c6e26');

  for (let f = 0; f < FRAMES; f++) {
    b.clear();
    const bob = f === 1 ? 2 : f === 2 ? -4 : f === 3 ? 3 : 0;
    const cx = 56;
    const baseY = 98;

    // Swirling tattered neon-rimmed shadow cloak behind
    b.poly(
      [
        [cx - 26, baseY - 52 + bob],
        [cx - 44, baseY - 22 + bob],
        [cx - 32, baseY - 8],
        [cx + 32, baseY - 8],
        [cx + 44, baseY - 22 + bob],
        [cx + 26, baseY - 52 + bob],
      ],
      vDark,
    );
    b.line(cx - 26, baseY - 52 + bob, cx - 44, baseY - 22 + bob, rimPink, 2);
    b.line(cx + 26, baseY - 52 + bob, cx + 44, baseY - 22 + bob, rimPink, 2);

    // Massive dark blocky mirror-Krunk torso with jagged demon crown!
    b.roundedRect(cx - 26, baseY - 58 + bob, 52, 48, vMid, 6);
    b.roundedRect(cx - 22, baseY - 54 + bob, 32, 34, vHi, 4);
    b.roundedRect(cx - 24, baseY - 22 + bob, 48, 12, vDark, 3);
    // Razor twin demon ear-horns
    b.tri(cx - 24, baseY - 54 + bob, cx - 32, baseY - 82 + bob, cx - 6, baseY - 56 + bob, vMid);
    b.tri(cx - 21, baseY - 54 + bob, cx - 28, baseY - 76 + bob, cx - 10, baseY - 56 + bob, rimPink);
    b.tri(cx + 24, baseY - 54 + bob, cx + 32, baseY - 82 + bob, cx + 6, baseY - 56 + bob, vMid);
    b.tri(cx + 21, baseY - 54 + bob, cx + 28, baseY - 76 + bob, cx + 10, baseY - 56 + bob, rimPink);

    // Fierce glowing neon-emerald eyes + wide grinning fangs + dripping toxic tongue!
    b.poly(
      [
        [cx - 18, baseY - 44 + bob],
        [cx - 4, baseY - 38 + bob],
        [cx - 16, baseY - 32 + bob],
      ],
      acidMid,
    );
    b.poly(
      [
        [cx + 18, baseY - 44 + bob],
        [cx + 4, baseY - 38 + bob],
        [cx + 16, baseY - 32 + bob],
      ],
      acidMid,
    );
    b.rect(cx - 14, baseY - 40 + bob, 4, 3, acidHi);
    b.rect(cx + 10, baseY - 40 + bob, 4, 3, acidHi);
    // Snarling jaw & huge toxic green protruding tongue
    b.roundedRect(cx - 16, baseY - 26 + bob, 32, 12, vDark, 2);
    b.tri(cx - 13, baseY - 26 + bob, cx - 10, baseY - 19 + bob, cx - 7, baseY - 26 + bob, cWhite);
    b.tri(cx + 7, baseY - 26 + bob, cx + 10, baseY - 19 + bob, cx + 13, baseY - 26 + bob, cWhite);
    b.ellipseShaded(cx, baseY - 14 + bob, 14, 9, acidHi, acidMid, acidDark, cWhite);

    // Feet
    b.ellipse(cx - 14, baseY - 4, 9, 5, vDark);
    b.ellipse(cx + 14, baseY - 4, 9, 5, vDark);

    // Iconic blazing neon-magenta outer silhouette rim!
    b.outline(rimPink);
    // Subtle top specular pink edge
    b.line(cx - 20, baseY - 58 + bob, cx + 20, baseY - 58 + bob, rimGlow);
    sheet.blit(b, f * FW, 0);
  }
  return finalizeBoss(sheet);
}

// ============================================================================
// 8. NIGHTMARE SOVEREIGN — Towering Eldritch Cloaked Final Boss Monarch!
// ============================================================================

function bakeNightmareSovereign(): BakedBossSpriteSet {
  const sheet = new PixelCanvas(FW * FRAMES, FH);
  const b = new PixelCanvas(FW, FH);
  const cOut = hexToAbgr('#12061c');
  const cWhite = hexToAbgr(HIGHLIGHT_CREAM);
  const magSpec = hexToAbgr('#ff94d4');
  const magHi = hexToAbgr('#ff2488');
  const magMid = hexToAbgr('#94146b');
  const magDark = hexToAbgr('#3b0a3d');
  const voidDeep = hexToAbgr('#12061c');
  const neonHi = hexToAbgr('#c8ff9e');
  const neonMid = hexToAbgr('#38ff66');
  const goldHi = hexToAbgr('#fff280');
  const goldMid = hexToAbgr('#e69d1c');
  const gemHi = hexToAbgr('#b8ffff');
  const gemMid = hexToAbgr('#42d8ff');

  for (let f = 0; f < FRAMES; f++) {
    b.clear();
    const hover = f === 1 ? -3 : f === 2 ? -5 : f === 3 ? 2 : 0;
    const cx = 56;
    const cy = 54 + hover;
    const capeWave = f === 1 ? 4 : f === 2 ? -5 : f === 3 ? 6 : 0;

    // 1. Towering tattered eldritch royal cloak billowing dramatically with glowing green rim!
    b.poly(
      [
        [cx - 16, cy - 34],
        [cx - 48, cy - 26 + capeWave],
        [cx - 32, cy - 4],
        [cx - 38, cy + 40],
        [cx - 14, cy + 48],
        [cx + 14, cy + 48],
        [cx + 38, cy + 40],
        [cx + 32, cy - 4],
        [cx + 48, cy - 26 - capeWave],
        [cx + 16, cy - 34],
      ],
      magDark,
    );
    // Glowing neon-green inner cloak flare along tattered edges
    b.line(cx - 46, cy - 26 + capeWave, cx - 32, cy - 4, neonMid, 2);
    b.line(cx - 36, cy + 38, cx - 22, cy + 4, neonHi, 2);
    b.line(cx + 46, cy - 26 - capeWave, cx + 32, cy - 4, neonMid, 2);

    // Swirling abyssal void clouds at bottom of robes
    b.ellipse(cx - 14, cy + 44, 14, 10, voidDeep);
    b.ellipse(cx + 10, cy + 46, 15, 10, voidDeep);
    b.ellipse(cx, cy + 40, 18, 12, voidDeep);

    // 2. Regal Hourglass Crimson-Violet Royal Mantle, Armored Pauldrons & Floating Astral Core!
    b.poly(
      [
        [cx - 26, cy - 16],
        [cx + 26, cy - 16],
        [cx + 16, cy + 4],
        [cx + 26, cy + 36],
        [cx, cy + 42],
        [cx - 26, cy + 36],
        [cx - 16, cy + 4],
      ],
      magMid,
    );
    b.poly(
      [
        [cx - 20, cy - 14],
        [cx + 20, cy - 14],
        [cx + 12, cy + 4],
        [cx + 20, cy + 32],
        [cx, cy + 38],
        [cx - 20, cy + 32],
        [cx - 12, cy + 4],
      ],
      voidDeep,
    );
    // Gilded royal collar & flared shoulder pauldrons
    b.poly(
      [
        [cx - 28, cy - 16],
        [cx - 12, cy - 18],
        [cx - 16, cy - 6],
        [cx - 32, cy - 8],
      ],
      magHi,
    );
    b.poly(
      [
        [cx + 28, cy - 16],
        [cx + 12, cy - 18],
        [cx + 16, cy - 6],
        [cx + 32, cy - 8],
      ],
      magHi,
    );
    b.line(cx - 28, cy - 16, cx - 12, cy - 18, goldHi, 2);
    b.line(cx + 12, cy - 18, cx + 28, cy - 16, goldHi, 2);
    // Flowing gilded royal robe trim down center & glowing cyan-emerald chest diamond!
    b.line(cx, cy + 2, cx, cy + 34, magHi, 3);
    b.line(cx - 1, cy + 4, cx - 1, cy + 32, goldHi, 1);
    b.tri(cx, cy - 18, cx - 10, cy - 5, cx + 10, cy - 5, gemMid);
    b.tri(cx, cy + 8, cx - 10, cy - 5, cx + 10, cy - 5, magHi);
    b.tri(cx, cy - 15, cx - 5, cy - 5, cx + 5, cy - 5, gemHi);
    b.px(cx, cy - 9, cWhite);

    // Wicked sweeping arcane crescent claws framing the waist!
    b.poly(
      [
        [cx - 30, cy - 4],
        [cx - 26, cy + 14],
        [cx - 12, cy + 22],
        [cx - 18, cy + 10],
      ],
      magHi,
    );
    b.line(cx - 28, cy - 2, cx - 14, cy + 20, magSpec);
    b.poly(
      [
        [cx + 30, cy - 4],
        [cx + 26, cy + 14],
        [cx + 12, cy + 22],
        [cx + 18, cy + 10],
      ],
      magHi,
    );
    b.line(cx + 28, cy - 2, cx + 14, cy + 20, magSpec);

    // 3. Tall Hooded Eldritch Sovereign Crown with 4 Glowing Neon-Green Eyes & Golden Mask Grille!
    b.poly(
      [
        [cx - 16, cy - 14],
        [cx - 12, cy - 46],
        [cx + 12, cy - 46],
        [cx + 16, cy - 14],
      ],
      magMid,
    );
    b.poly(
      [
        [cx - 12, cy - 16],
        [cx - 9, cy - 42],
        [cx + 9, cy - 42],
        [cx + 12, cy - 16],
      ],
      magHi,
    );
    // Royal crown horns
    b.tri(cx - 13, cy - 42, cx - 16, cy - 52, cx - 6, cy - 44, magSpec);
    b.tri(cx + 13, cy - 42, cx + 16, cy - 52, cx + 6, cy - 44, magSpec);
    // Ornate golden vertical mask grille at center of face
    b.roundedRect(cx - 6, cy - 34, 12, 18, goldMid, 3);
    b.rect(cx - 4, cy - 32, 8, 14, goldHi);
    b.rect(cx - 1, cy - 32, 2, 14, cOut);
    b.rect(cx - 4, cy - 26, 8, 2, cOut);
    // 4 Blazing eldritch neon-green eyes flanking the golden mask!
    const eyes: readonly [number, number][] = [
      [cx - 10, cy - 35],
      [cx + 10, cy - 35],
      [cx - 11, cy - 25],
      [cx + 11, cy - 25],
    ];
    for (const [ex, ey] of eyes) {
      b.ellipse(ex, ey, 4, 4, neonMid);
      b.ellipse(ex, ey, 2, 2, neonHi);
      b.px(ex - 1, ey - 1, cWhite);
    }

    b.selectiveOutline(cOut, 0.5, 0.92);
    sheet.blit(b, f * FW, 0);
  }
  return finalizeBoss(sheet);
}
