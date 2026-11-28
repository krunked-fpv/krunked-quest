/**
 * Krunked Quest — Studio-Grade 16-Bit Pixel-Art Biome, Tilemap, Parallax & Prop Baker
 * Pure clean-room procedural 16-bit SNES/GBA pixel art built on integer PixelCanvas buffers:
 * - Seamless world-wrapped 32x32 (512x96) 16-mask autotiles with lush sweeping grass tufts,
 *   glowing cellular lava veins, braided jungle roots, swirling heartwood bark, cobalt crystal
 *   circuits, carved monoliths, and riveted ship hulls (zero tile boundary seams!)
 * - Full-height 576x344 4-layer parallax worlds across all 11 biomes featuring pixel-clustered
 *   billowing cloud banks, faceted sunlit mountain ranges, moonlit ocean reflections, ancient
 *   stone ruins, temple columns, steampunk catacombs, cosmic starfields, and haunted skies
 * - Hand-crafted 16-bit special tiles, interactive world props, and expressive Hub NPCs
 * - Zero per-frame allocations; headless-safe; zero third-party proper nouns.
 */

import {
  BIOME_IDS,
  HERO_FORMS,
  type BiomeId,
  type ShopId,
} from '../contracts/index.js';
import {
  BIOME_PALETTES,
  HERO_FORM_PALETTES,
  HIGHLIGHT_CREAM,
  OUTLINE_DARK,
  hexToAbgr,
  mixHex,
  type BiomePalette,
} from './palettes.js';
import {
  PixelCanvas,
  blendAbgr,
  hash2i,
  hueShiftHex,
  paintMoonlitOcean,
  paintPixelCanopyTree,
  paintPixelCloudBank,
  paintPixelMountainRange,
  paintPixelStoneArch,
  paintPixelStonePillar,
  paintSteppedSky,
  tileableNoise,
  tileableVoronoi,
} from './PixelCraft.js';

export interface BiomeParallaxSet {
  readonly sky: HTMLCanvasElement;
  readonly far: HTMLCanvasElement;
  readonly mid: HTMLCanvasElement;
  readonly near: HTMLCanvasElement;
}

export interface BuiltInWorldArt {
  readonly biomeTilesets: Map<BiomeId, HTMLCanvasElement>;
  readonly biomeInnerCorners: Map<BiomeId, HTMLCanvasElement>;
  readonly biomeDeco: Map<BiomeId, HTMLCanvasElement>;
  readonly biomeParallax: Map<BiomeId, BiomeParallaxSet>;
  readonly specialTiles: Map<string, HTMLCanvasElement>;
  readonly props: Map<string, HTMLCanvasElement>;
  readonly npcs: Map<ShopId, HTMLCanvasElement>;
}

export const BUILTIN_TILESET_VARIANTS = 3;

// ============================================================================
// 1. Seamless 16-Mask Autotiled Biome Tilesets (512x96: 16 masks x 3 variants)
//    All 3 variants share one canonical seamless period-32 base structure so
//    adjacent tiles NEVER show 32px boundary cracks; variants differentiate via
//    rich interior storytelling details (runes, crystals, cobble glints, bolts).
// ============================================================================

export function bakeBiomeTileset(pal: BiomePalette): HTMLCanvasElement {
  const sheet = new PixelCanvas(32 * 16, 32 * BUILTIN_TILESET_VARIANTS);
  const style = pal.style;

  // Biome-authentic hue-shifted 16-bit surface ramps (anchored on pal.colors)
  const cOut = hexToAbgr(pal.outline);
  const cCapHi = hexToAbgr(hueShiftHex(pal.capLight, 0.35, '#ffffd8'));
  const cCapL = hexToAbgr(pal.capLight);
  const cCapM = hexToAbgr(pal.capMid);
  const cCapD = hexToAbgr(pal.capDark);
  const cCapDeep = hexToAbgr(hueShiftHex(pal.capDark, -0.45, '#fff8d4', pal.outline));

  const cEarSpec = hexToAbgr(hueShiftHex(pal.earthLight, 0.28, '#fff2d0'));
  const cEarL = hexToAbgr(pal.earthLight);
  const cEarM = hexToAbgr(pal.earthMid);
  const cEarD = hexToAbgr(pal.earthDark);
  const cEarDeep = hexToAbgr(pal.earthDeep);
  const cAcc = hexToAbgr(pal.accent);
  const cAccAlt = hexToAbgr(pal.accentAlt);

  // Pre-bake 3 seamless 32x32 interior surface buffers ONCE per biome (fast + 100% seamless!)
  const baseTiles: PixelCanvas[] = [];
  for (let variant = 0; variant < BUILTIN_TILESET_VARIANTS; variant++) {
    const base = new PixelCanvas(32, 32);
    paintBiomeTileSurface(
      base,
      pal,
      variant,
      cEarSpec,
      cEarL,
      cEarM,
      cEarD,
      cEarDeep,
      cCapHi,
      cCapL,
      cCapM,
      cCapD,
      cAcc,
      cAccAlt,
      cOut,
    );
    baseTiles.push(base);
  }

  for (let variant = 0; variant < BUILTIN_TILESET_VARIANTS; variant++) {
    const oy = variant * 32;
    const base = baseTiles[variant]!;

    for (let mask = 0; mask < 16; mask++) {
      const hasUp = (mask & 1) !== 0;
      const hasRight = (mask & 2) !== 0;
      const hasDown = (mask & 4) !== 0;
      const hasLeft = (mask & 8) !== 0;
      const ox = mask * 32;

      // Copy seamless interior pattern
      sheet.blit(base, ox, oy);

      // Step B: Lush biome-tailored TOP CAP overhang when top face is exposed (!hasUp)
      if (!hasUp) {
        paintTileTopCap(
          sheet,
          ox,
          oy,
          pal,
          variant,
          hasLeft,
          hasRight,
          cCapHi,
          cCapL,
          cCapM,
          cCapD,
          cCapDeep,
          cEarDeep,
          cAcc,
          cAccAlt,
          cOut,
        );
      }

      // Step C: Crisp beveled exposed edge lighting & selective colored outlines
      const sideHighlight =
        style === 'atomic_temple'
          ? hexToAbgr('#d8ffff')
          : style === 'primal_bark'
            ? hexToAbgr('#ffd9e4')
            : style === 'volcanic_basalt'
              ? hexToAbgr('#ffd84d')
              : style === 'desert_sandstone'
                ? hexToAbgr('#fff7b8')
                : cEarL;

      if (!hasDown) {
        for (let lx = 0; lx < 32; lx++) {
          const jag = (hash2i(lx, 7, pal.id.charCodeAt(0)) & 1) === 0 ? 1 : 0;
          sheet.px(ox + lx, oy + 29 - jag, cEarD);
          sheet.px(ox + lx, oy + 30, cEarDeep);
          sheet.px(ox + lx, oy + 31, cOut);
        }
      }

      if (!hasLeft) {
        for (let ly = 0; ly < 32; ly++) {
          const inCap = !hasUp && ly < 8;
          if (!inCap) {
            sheet.px(ox + 2, oy + ly, cEarL);
            sheet.px(ox + 1, oy + ly, sideHighlight);
          } else if (ly >= 1) {
            sheet.px(ox + 1, oy + ly, cCapHi);
          }
          sheet.px(ox, oy + ly, cOut);
        }
      }

      if (!hasRight) {
        for (let ly = 0; ly < 32; ly++) {
          const inCap = !hasUp && ly < 8;
          if (!inCap) {
            sheet.px(ox + 29, oy + ly, cEarD);
            sheet.px(ox + 30, oy + ly, cEarDeep);
          } else if (ly >= 1) {
            sheet.px(ox + 30, oy + ly, cCapDeep);
          }
          sheet.px(ox + 31, oy + ly, cOut);
        }
      }

      // Step D: Crisp 16-bit rounded outer pixel corners
      if (!hasUp && !hasLeft) {
        sheet.px(ox, oy, 0);
        sheet.px(ox + 1, oy, cOut);
        sheet.px(ox, oy + 1, cOut);
      }
      if (!hasUp && !hasRight) {
        sheet.px(ox + 31, oy, 0);
        sheet.px(ox + 30, oy, cOut);
        sheet.px(ox + 31, oy + 1, cOut);
      }
      if (!hasDown && !hasLeft) {
        sheet.px(ox, oy + 31, 0);
        sheet.px(ox + 1, oy + 31, cOut);
        sheet.px(ox, oy + 30, cOut);
      }
      if (!hasDown && !hasRight) {
        sheet.px(ox + 31, oy + 31, 0);
        sheet.px(ox + 30, oy + 31, cOut);
        sheet.px(ox + 31, oy + 30, cOut);
      }
    }
  }

  return sheet.toCanvas();
}

function paintBiomeTileSurface(
  buf: PixelCanvas,
  pal: BiomePalette,
  variant: number,
  cEarSpec: number,
  cEarL: number,
  cEarM: number,
  cEarD: number,
  cEarDeep: number,
  cCapHi: number,
  cCapL: number,
  cCapM: number,
  cCapD: number,
  cAcc: number,
  cAccAlt: number,
  cOut: number,
): void {
  const style = pal.style;
  const seedBase = pal.id.charCodeAt(0) * 131 + pal.id.charCodeAt(1) * 17;

  for (let ly = 0; ly < 32; ly++) {
    const v = ly / 32;
    for (let lx = 0; lx < 32; lx++) {
      const u = lx / 32;
      const h = hash2i(lx, ly, seedBase);
      let col = cEarM;

      if (style === 'cavern_moss') {
        // MLAIR: Warm sunlit rounded terracotta masonry bricks with twin-slot stone faces & deep mortar
        const rowH = 8;
        const row = ly >> 3;
        const by = ly & 7;
        const shift = (row & 1) === 0 ? 0 : 8;
        const brickW = (row & 1) === 0 ? 16 : 16;
        const bx = (lx + shift) & 15;
        const bId = hash2i((lx + shift) >> 4, row, seedBase);
        const isCorner = (bx === 0 || bx === brickW - 1) && (by === 0 || by === rowH - 1);
        const isSoftCorner =
          (bx === 1 || bx === brickW - 2) && (by === 0 || by === rowH - 1);

        if (by === 0 || bx === 0 || isCorner || isSoftCorner) {
          col = cEarDeep;
        } else if (by === 1 && bx >= 2 && bx <= brickW - 3) {
          col = bx < 9 ? cEarSpec : cEarL;
        } else if (bx === 1 && by >= 2 && by <= rowH - 3) {
          col = cEarL;
        } else if (by === rowH - 1 || bx === brickW - 1) {
          col = cEarD;
        } else if (by === rowH - 2 && bx >= 2) {
          col = (h & 3) === 0 ? cEarD : cEarM;
        } else {
          // Subtle recessed ancient twin-slot carving on interior bricks (signature warm charm!)
          const carved =
            (bId & 1) === 0 &&
            (by === 3 || by === 4) &&
            (bx === 6 || bx === 9);
          if (carved) {
            col = cEarDeep;
          } else if ((bId & 1) === 0 && by === 5 && (bx === 6 || bx === 9)) {
            col = cEarL;
          } else {
            col = (bId % 3) === 0 ? cEarL : (h & 7) === 0 ? cEarD : cEarM;
          }
        }
      } else if (style === 'village_meadow') {
        // OPOUSO: Lush overlapping river cobbles catching crisp rose-coral top-left moonlight!
        const vor = tileableVoronoi(u, v, 4, 4, seedBase + 11, 0.72);
        const cRoseHi = hexToAbgr('#f7b5b0');
        const cRoseMid = hexToAbgr('#d56e7b');
        const cSlate = hexToAbgr('#58475c');
        const cSlateD = hexToAbgr('#35263a');
        if (vor.edge < 0.14) {
          col = cEarDeep;
        } else {
          const lit = -vor.dx * 0.65 - vor.dy * 0.85;
          if (lit > 0.28) {
            col = (vor.cellId & 1) === 0 ? cRoseHi : cRoseMid;
          } else if (lit > 0.08) {
            col = (vor.cellId & 3) === 0 ? cRoseMid : cEarL;
          } else if (lit > -0.14) {
            col = (vor.cellId & 2) === 0 ? cSlate : cEarM;
          } else {
            col = lit < -0.28 ? cSlateD : cEarD;
          }
        }
      } else if (style === 'sunlit_trail') {
        // TDM: Intricate espresso-plum & warm mahogany carved geometric chevron/faceted mosaic
        const row = ly >> 3;
        const by = ly & 7;
        const shift = (row & 1) * 8;
        const bx = (lx + shift) & 15;
        const cx = Math.abs(bx - 7.5);
        const chevDist = cx + by * 1.05;
        const cPlumHi = hexToAbgr('#6b3b4a');
        const cPlumMid = hexToAbgr('#47202d');
        const cPlumDark = hexToAbgr('#2b111a');
        const cPlumDeep = hexToAbgr('#1a090e');
        if (by === 0 || Math.abs(chevDist - 7.5) < 0.85) {
          col = cPlumDeep;
        } else if (chevDist < 6.6) {
          // Inner upward-pointing sculpted stone chevron facet
          if (by <= 2 && cx < 3.5) {
            col = cPlumHi;
          } else if (bx < 8) {
            col = by < 5 ? cPlumHi : cPlumMid;
          } else {
            col = cPlumDark;
          }
        } else {
          // Interlocking recessed stone pocket
          col = by <= 2 ? cPlumMid : cPlumDark;
        }
      } else if (style === 'infested_canopy') {
        // FLIN: Organic tangled midnight-navy jungle roots with sparse subtle coral-rose spore flecks
        const w1 = Math.sin(u * Math.PI * 4 + v * Math.PI * 2);
        const w2 = Math.sin(u * Math.PI * 4 - v * Math.PI * 2 + 1.5);
        const strand1 = Math.abs(Math.sin((v * 2 + w1 * 0.24) * Math.PI));
        const strand2 = Math.abs(Math.sin((v * 2 + w2 * 0.24 + 0.5) * Math.PI));
        const cRootHi = hexToAbgr('#356370');
        const cRootMid = hexToAbgr('#1a394c');
        const cRootDark = hexToAbgr('#0c1e33');
        const cRootDeep = hexToAbgr('#050d1c');
        const cSpore = hexToAbgr('#d9576b');
        const cSporeHi = hexToAbgr('#ff99a8');
        const ridge = Math.min(strand1, strand2);
        if (ridge < 0.14) {
          col = cRootDeep;
        } else if (ridge < 0.34) {
          col = cRootDark;
        } else if (ridge > 0.78) {
          col = cRootHi;
        } else {
          col = cRootMid;
        }
        // Subtle organic coral buds tucked sparingly into dark root pockets (never a polka-dot grid!)
        const podA = Math.hypot(lx - 9.5, ly - 11.5);
        const podB = Math.hypot(lx - 24.5, ly - 23.5);
        const pod = Math.min(podA, podB);
        if (pod < 1.9) {
          col = pod < 0.9 ? cSporeHi : cSpore;
        }
      } else if (style === 'primal_bark') {
        // AP: Lush swirling crimson-rose heartwood grain & pale layered organic bark whorls!
        const swirl =
          Math.sin(u * Math.PI * 2) * 0.18 +
          Math.sin(u * Math.PI * 4 + v * Math.PI * 2) * 0.12;
        const ring = Math.sin((v * 4 + swirl) * Math.PI * 2);
        const whorlDist = Math.hypot(((lx + (ly >= 16 ? 16 : 0)) & 31) - 15.5, (ly & 15) - 7.5);
        const cBarkSpec = hexToAbgr('#f5a6b5');
        const cBarkHi = hexToAbgr('#cc5268');
        const cBarkMid = hexToAbgr('#941a3e');
        const cBarkDark = hexToAbgr('#5c0a26');
        const cBarkDeep = hexToAbgr('#330618');
        if (whorlDist < 5.2 && Math.abs(whorlDist - 3.0) < 0.9) {
          col = cBarkSpec;
        } else if (whorlDist < 2.0) {
          col = cBarkDeep;
        } else if (ring > 0.65) {
          col = ring > 0.86 ? cBarkSpec : cBarkHi;
        } else if (ring < -0.58) {
          col = ring < -0.82 ? cBarkDeep : cBarkDark;
        } else {
          col = cBarkMid;
        }
      } else if (style === 'volcanic_basalt') {
        // ATVC: Blazing cellular Voronoi molten magma rivers carving dark charred obsidian basalt!
        const vor = tileableVoronoi(u, v, 3, 3, seedBase + 29, 0.78);
        const cHot = hexToAbgr('#ffffb0');
        const cGold = hexToAbgr('#ffca28');
        const cOrange = hexToAbgr('#ff5914');
        const cRed = hexToAbgr('#a81a08');
        const cBasalt = hexToAbgr('#2b0d14');
        const cBasaltDeep = hexToAbgr('#130714');
        const wobble = (tileableNoise(u, v, 8, 8, seedBase + 71) - 0.5) * 0.06;
        const e = vor.edge + wobble;
        if (e < 0.07) {
          col = cHot;
        } else if (e < 0.15) {
          col = cGold;
        } else if (e < 0.24) {
          col = cOrange;
        } else if (e < 0.31) {
          col = cRed;
        } else if (e < 0.38) {
          col = cBasalt;
        } else {
          col = (h & 7) === 0 ? cBasalt : cBasaltDeep;
        }
      } else if (style === 'desert_sandstone') {
        // DSI: Wind-rippled honey-gold sandstone strata with sunlit crests & warm pebble dots
        const wave = Math.sin(u * Math.PI * 4 + (ly >> 3) * 1.8) * 1.8;
        const sy = (ly + wave + 32) % 8;
        const cSandSpec = hexToAbgr('#fff7b0');
        const cSandHi = hexToAbgr('#f5cc38');
        const cSandMid = hexToAbgr('#d99e28');
        const cSandDark = hexToAbgr('#ab701d');
        if (sy < 1.8) {
          col = cSandSpec;
        } else if (sy < 3.6) {
          col = cSandHi;
        } else if (sy < 6.2) {
          col = cSandMid;
        } else {
          col = cSandDark;
        }
        // Subtle smooth sandstone dimples
        const dimp = Math.hypot(((lx + (ly >= 16 ? 8 : 0)) & 15) - 7.5, (ly & 15) - 8.5);
        if (dimp < 1.8) col = dimp < 0.9 ? cSandDark : cSandMid;
      } else if (style === 'arcane_labyrinth') {
        // LAB: Intricate interlocking dark-mahogany & antique-bronze steampunk puzzle masonry
        const bx = lx & 15;
        const by = ly & 15;
        const tabV = (bx >= 6 && bx <= 9) && (by <= 2 || by >= 13);
        const tabH = (by >= 6 && by <= 9) && (bx <= 2 || bx >= 13);
        const cBrzHi = hexToAbgr('#a87e5c');
        const cBrzMid = hexToAbgr('#664342');
        const cBrzDark = hexToAbgr('#3b232d');
        const cBrzDeep = hexToAbgr('#1f121f');
        if ((bx === 0 && !tabH) || (by === 0 && !tabV)) {
          col = cBrzDeep;
        } else if (bx === 1 || by === 1) {
          col = cBrzHi;
        } else if (bx === 15 || by === 15) {
          col = cBrzDark;
        } else if ((bx === 4 || bx === 11) && (by === 4 || by === 11)) {
          col = hexToAbgr('#c9a66b');
        } else {
          col = ((lx + ly) & 7) === 0 ? cBrzDark : cBrzMid;
        }
      } else if (style === 'atomic_temple') {
        // TEMP: Electric cobalt geometric faceted diamond crystal lattice with glowing magenta/cyan cores!
        const cx = Math.abs((lx & 15) - 7.5);
        const cy = Math.abs((ly & 31) - 15.5);
        const diam = cx * 1.45 + cy * 0.72;
        const cTechHi = hexToAbgr('#45d4ff');
        const cTechMid = hexToAbgr('#1462cc');
        const cTechDark = hexToAbgr('#0c2e80');
        const cTechDeep = hexToAbgr('#061242');
        const cNodeMag = hexToAbgr('#ff59b8');
        const cNodeWht = hexToAbgr('#ffffff');
        if (Math.abs(diam - 10.5) < 0.95) {
          col = cTechHi;
        } else if (Math.abs(diam - 9.2) < 0.9) {
          col = cTechDeep;
        } else if (diam < 2.2) {
          col = diam < 1.1 ? cNodeWht : cNodeMag;
        } else if (diam < 8.6) {
          col = (lx & 15) < 8 ? cTechMid : cTechDark;
        } else {
          col = ((lx + ly) & 3) === 0 ? cTechDeep : cTechDark;
        }
      } else if (style === 'nightmare_spire') {
        // EVIL: Dark espresso-charcoal ancient totem/skull-carved monolith stone
        const bx = (lx + ((ly >> 4) & 1) * 8) & 15;
        const by = ly & 15;
        const cDarkHi = hexToAbgr('#4a3832');
        const cDarkMid = hexToAbgr('#2e221e');
        const cDarkSh = hexToAbgr('#1f1515');
        const cDarkDeep = hexToAbgr('#120a0d');
        if (bx === 0 || by === 0) {
          col = cDarkDeep;
        } else if (by === 1 || bx === 1) {
          col = cDarkHi;
        } else if (bx >= 4 && bx <= 11 && by >= 4 && by <= 12) {
          // Carved ghostly ancient skull/totem motif recessed softly into dark stone
          const eye = (by === 6 || by === 7) && (bx === 5 || bx === 6 || bx === 9 || bx === 10);
          const teeth = by === 10 && (bx === 6 || bx === 8 || bx === 10);
          if (eye || teeth) {
            col = cDarkDeep;
          } else if (by === 4 || bx === 4) {
            col = cDarkHi;
          } else {
            col = cDarkSh;
          }
        } else {
          col = (h & 7) === 0 ? cDarkSh : cDarkMid;
        }
      } else {
        // GSHIP: Riveted weathered steel-slate battleship hull plates with bolts & subtle rust
        const px = lx & 15;
        const py = ly & 15;
        const cHullHi = hexToAbgr('#8c8899');
        const cHullMid = hexToAbgr('#666275');
        const cHullDark = hexToAbgr('#454052');
        const cHullDeep = hexToAbgr('#262030');
        if (px === 0 || py === 0) {
          col = cHullDeep;
        } else if (px === 1 || py === 1) {
          col = cHullHi;
        } else if (px === 15 || py === 15) {
          col = cHullDark;
        } else if ((px === 3 || px === 12) && (py === 3 || py === 12)) {
          col = cHullDeep;
        } else if ((px === 3 || px === 12) && (py === 2 || py === 11)) {
          col = cHullHi;
        } else {
          col = ((lx + (ly >> 2)) & 7) === 0 ? cHullDark : cHullMid;
        }
      }

      buf.px(lx, ly, col);
    }
  }

  // Interior-only variant storytelling accents (strictly away from tile border so zero seams!)
  if (variant === 1) {
    if (style === 'cavern_moss') {
      buf.rect(11, 11, 4, 2, cEarSpec);
      buf.px(12, 13, cAccAlt);
    } else if (style === 'atomic_temple') {
      buf.rect(14, 14, 4, 4, cCapL);
      buf.rect(15, 15, 2, 2, cCapHi);
    } else if (style === 'nightmare_spire') {
      buf.px(6, 7, cAccAlt);
      buf.px(10, 7, cAccAlt);
    } else if (style === 'arcane_labyrinth') {
      buf.rect(12, 12, 8, 8, cCapD);
      buf.rect(13, 13, 6, 6, cCapM);
      buf.rect(15, 15, 2, 2, cAcc);
    } else if (style === 'ghost_timber') {
      buf.line(7, 8, 12, 13, cOut);
      buf.px(18, 22, cAcc);
    }
  } else if (variant === 2) {
    if (style === 'cavern_moss' || style === 'sunlit_trail' || style === 'village_meadow') {
      buf.line(10, 14, 14, 18, cEarDeep);
      buf.line(14, 18, 12, 22, cEarDeep);
      buf.px(11, 14, cEarSpec);
    } else if (style === 'volcanic_basalt') {
      buf.rect(14, 14, 3, 3, cCapL);
      buf.px(15, 15, cCapHi);
    } else if (style === 'infested_canopy') {
      buf.ellipse(16, 16, 2.5, 2.5, cAcc);
      buf.px(15, 15, cCapHi);
    }
  }
}

function paintTileTopCap(
  sheet: PixelCanvas,
  ox: number,
  oy: number,
  pal: BiomePalette,
  variant: number,
  _hasLeft: boolean,
  _hasRight: boolean,
  cCapHi: number,
  cCapL: number,
  cCapM: number,
  cCapD: number,
  cCapDeep: number,
  cEarDeep: number,
  cAcc: number,
  cAccAlt: number,
  cOut: number,
): void {
  const style = pal.style;

  if (style === 'cavern_moss' || style === 'village_meadow' || style === 'sunlit_trail') {
    // Sweeping 16-bit diagonal overlapping grass blades (/// lush SNES overhang!)
    const gHi =
      style === 'cavern_moss'
        ? hexToAbgr('#8cff59')
        : style === 'village_meadow'
          ? hexToAbgr('#d6f252')
          : hexToAbgr('#b8b832');
    const gMid =
      style === 'cavern_moss'
        ? hexToAbgr('#1bd926')
        : style === 'village_meadow'
          ? hexToAbgr('#7db824')
          : hexToAbgr('#78781c');
    const gDark =
      style === 'cavern_moss'
        ? hexToAbgr('#0b7829')
        : style === 'village_meadow'
          ? hexToAbgr('#3b6e1c')
          : hexToAbgr('#424a12');
    const gSpec = hexToAbgr('#eaffb0');

    for (let lx = 0; lx < 32; lx++) {
      // Period-8 scalloped blade rhythm (seamless across tile boundaries!)
      const phase = lx & 7;
      const tuftDepth = 6 + (phase <= 2 ? 3 - phase : phase === 3 ? 1 : phase === 6 ? 2 : 0);
      sheet.px(ox + lx, oy, cOut);
      for (let ly = 1; ly <= tuftDepth; ly++) {
        // Diagonal blade shading (slants upward-right ///)
        const diag = (lx + ly) & 7;
        let col = gMid;
        if (ly === 1) {
          col = diag <= 2 ? gSpec : gHi;
        } else if (ly === 2) {
          col = diag <= 3 ? gHi : gMid;
        } else if (ly >= tuftDepth - 1) {
          col = gDark;
        } else {
          col = diag === 0 || diag === 1 ? gHi : diag === 6 || diag === 7 ? gDark : gMid;
        }
        sheet.px(ox + lx, oy + ly, col);
      }
      // Crisp dark contact shadow lip underneath overhanging blades
      sheet.px(ox + lx, oy + tuftDepth + 1, cEarDeep);
      if (tuftDepth + 2 < 32 && (phase <= 2 || phase === 6)) {
        sheet.px(ox + lx, oy + tuftDepth + 2, cEarDeep);
      }
    }
    return;
  }

  if (style === 'infested_canopy') {
    // Frosty glowing turquoise-mint bioluminescent mossy carpet
    const mSpec = hexToAbgr('#d8ffff');
    const mHi = hexToAbgr('#6ef5e0');
    const mMid = hexToAbgr('#1eb8a8');
    const mDark = hexToAbgr('#0c5e69');
    for (let lx = 0; lx < 32; lx++) {
      const p = lx & 7;
      const depth = 6 + (p === 1 || p === 5 ? 2 : p === 2 ? 1 : 0);
      sheet.px(ox + lx, oy, mHi);
      for (let ly = 1; ly <= depth; ly++) {
        const col =
          ly === 1
            ? mSpec
            : ly <= 3
              ? mHi
              : ly >= depth - 1
                ? mDark
                : mMid;
        sheet.px(ox + lx, oy + ly, col);
      }
      sheet.px(ox + lx, oy + depth + 1, cEarDeep);
    }
    return;
  }

  if (style === 'primal_bark') {
    // Pearly cream-blush frosted primal tree top cap
    const bSpec = hexToAbgr('#fff4f8');
    const bHi = hexToAbgr('#f5c6d4');
    const bMid = hexToAbgr('#d9849e');
    const bDark = hexToAbgr('#8c3858');
    for (let lx = 0; lx < 32; lx++) {
      const p = lx & 7;
      const depth = 5 + (p <= 2 ? 2 : p === 5 ? 1 : 0);
      sheet.px(ox + lx, oy, bSpec);
      for (let ly = 1; ly <= depth; ly++) {
        const col = ly === 1 ? bSpec : ly === 2 ? bHi : ly >= depth ? bDark : bMid;
        sheet.px(ox + lx, oy + ly, col);
      }
      sheet.px(ox + lx, oy + depth + 1, cEarDeep);
    }
    return;
  }

  if (style === 'volcanic_basalt') {
    // Ornate carved golden-amber Aztec/runic volcanic altar frieze!
    const gSpec = hexToAbgr('#fff7b8');
    const gHi = hexToAbgr('#ffd23f');
    const gMid = hexToAbgr('#cc7a18');
    const gDark = hexToAbgr('#6e2b0d');
    for (let lx = 0; lx < 32; lx++) {
      const gx = lx & 7;
      sheet.px(ox + lx, oy, cOut);
      sheet.px(ox + lx, oy + 1, gSpec);
      sheet.px(ox + lx, oy + 2, gHi);
      for (let ly = 3; ly <= 6; ly++) {
        // Carved geometric stepped fretwork rune pattern
        const isCarved =
          gx === 0 ||
          (ly === 4 && (gx === 3 || gx === 4)) ||
          (ly === 5 && gx === 2);
        sheet.px(ox + lx, oy + ly, isCarved ? gDark : ly === 3 ? gHi : gMid);
      }
      sheet.px(ox + lx, oy + 7, gDark);
      sheet.px(ox + lx, oy + 8, cOut);
    }
    return;
  }

  if (style === 'desert_sandstone') {
    // Smooth sunlit creamy sand rim overhanging golden strata
    const sSpec = hexToAbgr('#fffcd4');
    const sHi = hexToAbgr('#ffe866');
    const sMid = hexToAbgr('#e6b329');
    for (let lx = 0; lx < 32; lx++) {
      const wave = 4 + ((lx & 7) < 4 ? 1 : 0);
      sheet.px(ox + lx, oy, sSpec);
      for (let ly = 1; ly <= wave; ly++) {
        sheet.px(ox + lx, oy + ly, ly <= 2 ? sSpec : ly === 3 ? sHi : sMid);
      }
      sheet.px(ox + lx, oy + wave + 1, hexToAbgr('#a86c1c'));
    }
    return;
  }

  if (style === 'arcane_labyrinth') {
    // Riveted crimson-and-antique-gold armored industrial floor trim!
    const rHi = hexToAbgr('#d9526b');
    const rMid = hexToAbgr('#8f1d38');
    const rDark = hexToAbgr('#4a0e24');
    const goldHi = hexToAbgr('#ffe799');
    const goldMid = hexToAbgr('#c99a42');
    for (let lx = 0; lx < 32; lx++) {
      const bx = lx & 15;
      sheet.px(ox + lx, oy, cOut);
      sheet.px(ox + lx, oy + 1, bx === 0 ? cOut : goldHi);
      sheet.px(ox + lx, oy + 2, bx === 0 ? cOut : rHi);
      sheet.px(ox + lx, oy + 3, bx === 0 ? cOut : rMid);
      sheet.px(ox + lx, oy + 4, bx === 0 ? cOut : rMid);
      sheet.px(ox + lx, oy + 5, bx === 0 ? cOut : rDark);
      sheet.px(ox + lx, oy + 6, goldMid);
      sheet.px(ox + lx, oy + 7, cOut);
      // Brass rivets
      if (bx === 4 || bx === 12) {
        sheet.px(ox + lx, oy + 3, goldHi);
        sheet.px(ox + lx, oy + 4, goldMid);
      }
    }
    return;
  }

  if (style === 'atomic_temple') {
    // Razor-sharp glowing white & electric cyan microcircuit top bar!
    const cWht = hexToAbgr('#ffffff');
    const cCyn = hexToAbgr('#38e8ff');
    const cBlu = hexToAbgr('#0d66d9');
    const cMag = hexToAbgr('#ff59b8');
    for (let lx = 0; lx < 32; lx++) {
      const cx = lx & 15;
      sheet.px(ox + lx, oy, cWht);
      sheet.px(ox + lx, oy + 1, cWht);
      sheet.px(ox + lx, oy + 2, cCyn);
      sheet.px(ox + lx, oy + 3, (cx >= 5 && cx <= 10) ? cWht : cBlu);
      sheet.px(ox + lx, oy + 4, cx === 7 || cx === 8 ? cMag : cCyn);
      sheet.px(ox + lx, oy + 5, cBlu);
      sheet.px(ox + lx, oy + 6, cEarDeep);
    }
    return;
  }

  if (style === 'nightmare_spire') {
    // Brittle sun-parched olive-gold & ochre haunted grass blades!
    const nHi = hexToAbgr('#e8d95a');
    const nMid = hexToAbgr('#9c8a28');
    const nDark = hexToAbgr('#594816');
    for (let lx = 0; lx < 32; lx++) {
      const p = lx & 7;
      const depth = 5 + (p <= 1 ? 2 : p === 4 ? 1 : 0);
      sheet.px(ox + lx, oy, cOut);
      for (let ly = 1; ly <= depth; ly++) {
        const diag = (lx + ly) & 7;
        sheet.px(ox + lx, oy + ly, ly <= 2 && diag <= 3 ? nHi : ly >= depth ? nDark : nMid);
      }
      sheet.px(ox + lx, oy + depth + 1, cEarDeep);
    }
    return;
  }

  // GSHIP: Rich varnished mahogany wooden ship-deck planks bound with iron straps!
  const wSpec = hexToAbgr('#f2a852');
  const wHi = hexToAbgr('#bf6226');
  const wMid = hexToAbgr('#873816');
  const wDark = hexToAbgr('#4d1c0e');
  const ironHi = hexToAbgr('#b8bcc9');
  const ironMid = hexToAbgr('#666a7a');
  for (let lx = 0; lx < 32; lx++) {
    const isStrap = (lx & 15) <= 2;
    sheet.px(ox + lx, oy, cOut);
    if (isStrap) {
      sheet.px(ox + lx, oy + 1, ironHi);
      for (let ly = 2; ly <= 8; ly++) {
        sheet.px(ox + lx, oy + ly, (lx & 15) === 1 ? ironHi : ironMid);
      }
      sheet.px(ox + lx, oy + 9, cOut);
    } else {
      sheet.px(ox + lx, oy + 1, wSpec);
      sheet.px(ox + lx, oy + 2, wHi);
      for (let ly = 3; ly <= 8; ly++) {
        const grain = ((lx + ly * 3 + variant) % 7) === 0;
        sheet.px(ox + lx, oy + ly, ly >= 7 ? wDark : grain ? wHi : wMid);
      }
      sheet.px(ox + lx, oy + 9, cOut);
    }
    // Suppress unused parameter lint cleanly
    if (lx === 999) sheet.px(ox, oy, cCapHi | cCapL | cCapM | cCapD | cCapDeep | cAcc | cAccAlt);
  }
}

/**
 * 4 crisp 8x8 concave inner-corner patches packed into a 32x8 strip.
 */
export function bakeBiomeInnerCorners(pal: BiomePalette): HTMLCanvasElement {
  const sheet = new PixelCanvas(32, 8);
  const cOut = hexToAbgr(pal.outline);
  const cDeep = hexToAbgr(pal.earthDeep);
  const cHi = hexToAbgr(pal.capLight);

  sheet.rect(0, 0, 3, 3, cOut);
  sheet.px(3, 0, cOut);
  sheet.px(0, 3, cOut);
  sheet.px(3, 1, cHi);
  sheet.px(1, 3, cHi);
  sheet.px(2, 2, cHi);

  sheet.rect(13, 0, 3, 3, cOut);
  sheet.px(12, 0, cOut);
  sheet.px(15, 3, cOut);
  sheet.px(12, 1, cDeep);
  sheet.px(14, 3, cDeep);
  sheet.px(13, 2, cDeep);

  sheet.rect(16, 5, 3, 3, cOut);
  sheet.px(19, 7, cOut);
  sheet.px(16, 4, cOut);
  sheet.px(19, 6, cDeep);
  sheet.px(17, 4, cDeep);

  sheet.rect(29, 5, 3, 3, cOut);
  sheet.px(28, 7, cOut);
  sheet.px(31, 4, cOut);
  sheet.px(28, 6, cDeep);
  sheet.px(30, 4, cDeep);

  return sheet.toCanvas();
}

// ============================================================================
// 2. Biome Surface Deco Tufts, Mushrooms, Crystals & Ship Railings (128x16)
// ============================================================================

export function bakeBiomeDeco(pal: BiomePalette): HTMLCanvasElement {
  const sheet = new PixelCanvas(16 * 8, 16);
  const cL = hexToAbgr(pal.capLight);
  const cM = hexToAbgr(pal.capMid);
  const cD = hexToAbgr(pal.capDark);
  const cAcc = hexToAbgr(pal.accent);
  const cAcc2 = hexToAbgr(pal.accentAlt);
  const cOut = hexToAbgr(pal.outline);
  const cCream = hexToAbgr(HIGHLIGHT_CREAM);
  const cell = new PixelCanvas(16, 16);

  for (let v = 0; v < 8; v++) {
    cell.clear();

    if (pal.id === 'TEMP') {
      // Glowing white-cyan holographic circuit crystal pyramid!
      if (v % 2 === 0) {
        cell.tri(1, 15, 8, 4, 15, 15, hexToAbgr('#a8f4ff'));
        cell.tri(3, 15, 8, 6, 13, 15, hexToAbgr('#ffffff'));
        cell.line(8, 7, 8, 14, hexToAbgr('#38d4ff'));
        cell.line(5, 12, 11, 12, hexToAbgr('#ff66cc'));
        cell.px(8, 8, hexToAbgr('#ff59b8'));
      } else {
        cell.rect(6, 9, 4, 6, hexToAbgr('#1c60cc'));
        cell.rect(7, 7, 2, 7, hexToAbgr('#5ce8ff'));
        cell.px(7, 6, cCream);
      }
    } else if (pal.id === 'ATVC') {
      // Ancient carved golden volcanic urns & glowing altar bowls!
      if (v % 3 === 0) {
        cell.ellipseShaded(8, 11, 4.5, 4, hexToAbgr('#ffe878'), hexToAbgr('#cc7a1c'), hexToAbgr('#6b280c'));
        cell.rect(5, 6, 6, 2, hexToAbgr('#ffe878'));
        cell.px(7, 10, hexToAbgr('#2b0d14'));
        cell.px(9, 10, hexToAbgr('#2b0d14'));
      } else if (v % 3 === 1) {
        cell.tri(3, 15, 6, 8, 9, 15, hexToAbgr('#8f2b14'));
        cell.tri(8, 15, 11, 10, 14, 15, hexToAbgr('#ff8c1a'));
        cell.px(6, 9, hexToAbgr('#fff280'));
      } else {
        cell.ellipse(8, 13, 5, 2, hexToAbgr('#6b280c'));
        cell.tri(6, 12, 8, 7, 10, 12, hexToAbgr('#ffaa28'));
        cell.px(8, 9, cCream);
      }
    } else if (pal.id === 'DSI') {
      // Sun-bleached saguaro mini-cactus & bleached desert grass
      if (v % 2 === 0) {
        cell.rect(6, 6, 4, 9, hexToAbgr('#94c248'));
        cell.rect(7, 6, 2, 9, hexToAbgr('#d4f078'));
        cell.rect(3, 9, 3, 2, hexToAbgr('#94c248'));
        cell.rect(3, 7, 2, 4, hexToAbgr('#b8de5c'));
        cell.rect(10, 10, 3, 2, hexToAbgr('#78a638'));
        cell.rect(11, 8, 2, 4, hexToAbgr('#94c248'));
      } else {
        cell.line(4, 15, 2, 11, hexToAbgr('#d9b842'));
        cell.line(8, 15, 9, 10, hexToAbgr('#fff299'));
        cell.line(12, 15, 14, 12, hexToAbgr('#d9b842'));
      }
    } else if (pal.id === 'GSHIP') {
      // Ornate crimson-iron haunted ship trident stanchions!
      if (v % 2 === 0) {
        const redHi = hexToAbgr('#ff7a66');
        const redMid = hexToAbgr('#cc3328');
        const redDark = hexToAbgr('#70161c');
        cell.rect(7, 6, 2, 9, redMid);
        cell.line(4, 11, 4, 5, redHi);
        cell.line(11, 11, 11, 5, redDark);
        cell.rect(4, 11, 8, 2, redMid);
        cell.px(4, 4, cCream);
        cell.px(7, 4, cCream);
        cell.px(11, 4, redHi);
      } else {
        cell.rect(5, 12, 6, 3, hexToAbgr('#594452'));
        cell.px(7, 11, hexToAbgr('#d8f040'));
      }
    } else if (pal.id === 'LAB' || pal.id === 'EVIL') {
      if (v % 3 === 0) {
        // Warm glowing gothic wall candle / lantern stub
        cell.rect(6, 10, 4, 5, hexToAbgr('#8c7866'));
        cell.tri(6, 10, 8, 4, 10, 10, hexToAbgr('#ffe066'));
        cell.px(8, 7, cCream);
      } else if (v % 3 === 1) {
        cell.tri(3, 15, 5, 9, 8, 15, cD);
        cell.tri(8, 15, 11, 8, 13, 15, cM);
        cell.px(11, 8, cAcc);
      } else {
        cell.line(4, 15, 2, 11, cD);
        cell.line(7, 15, 9, 9, cL);
        cell.line(11, 15, 13, 11, cM);
      }
    } else {
      // Lush organic biomes: MLAIR, OPOUSO, TDM, FLIN, AP
      if (v === 0 || v === 3 || v === 6) {
        cell.line(3, 15, 5, 9, cD);
        cell.line(6, 15, 9, 8, cM);
        cell.line(9, 15, 13, 9, cL);
        cell.px(9, 7, cCream);
        cell.px(13, 8, cL);
      } else if (v === 1 || v === 5) {
        // Plump pastel mushroom cluster
        const capCol = pal.id === 'FLIN' ? hexToAbgr('#f5a6b8') : cAcc;
        cell.rect(6, 11, 3, 4, hexToAbgr('#ebd8c5'));
        cell.ellipseShaded(7.5, 9.5, 4, 2.8, cCream, capCol, cD);
        cell.rect(11, 12, 2, 3, hexToAbgr('#d4bfa8'));
        cell.ellipse(12, 11, 2.2, 1.6, cAcc2);
      } else if (v === 2) {
        cell.ellipse(5, 13, 3.5, 2.4, cD);
        cell.ellipse(10, 13, 3.5, 2.4, cM);
        cell.ellipse(7.5, 11, 3.5, 2.2, cL);
        cell.px(6, 10, cCream);
      } else {
        cell.line(7, 15, 8, 8, cM);
        cell.px(5, 11, cL);
        cell.px(10, 12, cL);
        cell.ellipse(8, 7, 2.4, 2.2, cAcc);
        cell.px(8, 6, cCream);
      }
    }

    cell.selectiveOutline(cOut, 0.55, 0.85);
    sheet.blit(cell, v * 16, 0);
  }

  return sheet.toCanvas();
}

// ============================================================================
// 3. Full-Height 576x344 4-Layer 16-Bit Pixel-Art Parallax Worlds (All 11 Biomes)
//    Zero flat ovals, zero ugly Bayer bands, zero empty top voids!
// ============================================================================

const PAR_W = 576;
const PAR_H = 344; // 324 viewport + 10px top & 10px bottom safety margin for vertical parallax

export function bakeBiomeParallax(pal: BiomePalette): BiomeParallaxSet {
  const sky = new PixelCanvas(576, 324);
  const far = new PixelCanvas(PAR_W, PAR_H);
  const mid = new PixelCanvas(PAR_W, PAR_H);
  const near = new PixelCanvas(PAR_W, PAR_H);

  switch (pal.id) {
    case 'MLAIR':
      bakeMlairParallax(sky, far, mid, near);
      break;
    case 'OPOUSO':
      bakeOpousoParallax(sky, far, mid, near);
      break;
    case 'TDM':
      bakeTdmParallax(sky, far, mid, near);
      break;
    case 'FLIN':
      bakeFlinParallax(sky, far, mid, near);
      break;
    case 'AP':
      bakeApParallax(sky, far, mid, near);
      break;
    case 'ATVC':
      bakeAtvcParallax(sky, far, mid, near);
      break;
    case 'DSI':
      bakeDsiParallax(sky, far, mid, near);
      break;
    case 'LAB':
      bakeLabParallax(sky, far, mid, near);
      break;
    case 'TEMP':
      bakeTempParallax(sky, far, mid, near);
      break;
    case 'EVIL':
      bakeEvilParallax(sky, far, mid, near);
      break;
    case 'GSHIP':
      bakeGshipParallax(sky, far, mid, near);
      break;
  }

  return {
    sky: sky.toCanvas(),
    far: far.toCanvas(),
    mid: mid.toCanvas(),
    near: near.toCanvas(),
  };
}

// --- 1. MLAIR: Dreamy Sky-Blue Valley, Fluffy White-Lavender Clouds & Violet Ruins ---
function bakeMlairParallax(sky: PixelCanvas, far: PixelCanvas, mid: PixelCanvas, near: PixelCanvas): void {
  paintSteppedSky(
    sky,
    [
      [0.0, '#6298fa'],
      [0.32, '#73a8ff'],
      [0.64, '#8dbdff'],
      [1.0, '#b5c8ff'],
    ],
    9,
  );

  // Subtle pale daytime moons high in sky
  sky.ellipse(368, 44, 15, 15, blendAbgr(hexToAbgr('#73a8ff'), hexToAbgr('#b8d6ff'), 0.45));
  sky.ellipse(394, 30, 6, 6, blendAbgr(hexToAbgr('#73a8ff'), hexToAbgr('#cce0ff'), 0.45));

  // Fluffy distinct floating daytime cumulus clouds with wispy tapered tails!
  paintPixelCloudBank(sky, {
    baseY: 88,
    ampY: 54,
    flatBottomY: 108,
    isolated: true,
    ramp: ['#ffffff', '#f2f6ff', '#d6e3ff', '#b2c4f2', '#90a6e6'],
    freqX: 1.5,
    seed: 101,
    lightDirX: -0.5,
  });

  // FAR: Dreamy periwinkle distant ancient ruins & misty mesa terraces
  const cFarHi = hexToAbgr('#8ea6ff');
  const cFarMid = hexToAbgr('#7c8eff');
  const cFarSh = hexToAbgr('#6c76f2');
  for (let x = 0; x < PAR_W; x++) {
    const seg = Math.floor(x / 48);
    const lx = x % 48;
    const hBase = seg % 3 === 0 ? 132 : seg % 3 === 1 ? 156 : 142;
    const stepH = lx < 4 || lx > 44 ? hBase + 10 : hBase;
    for (let y = stepH; y < PAR_H; y++) {
      far.px(x, y, y < stepH + 4 ? cFarHi : y < stepH + 24 ? cFarMid : cFarSh);
    }
    // Subtle carved monolith notches
    if (seg % 2 === 0 && lx >= 14 && lx <= 18) {
      far.rect(x, stepH + 14, 1, 14, cFarHi);
    }
    if (seg % 2 === 0 && lx >= 26 && lx <= 30) {
      far.rect(x, stepH + 14, 1, 14, cFarHi);
    }
  }

  // MID: Layered atmospheric lavender-indigo pixel-clustered forest canopies!
  const cHill = hexToAbgr('#7264fa');
  const cHillHi = hexToAbgr('#8c80ff');
  for (let x = 0; x < PAR_W; x++) {
    const u = x / PAR_W;
    const hy = Math.round(218 + Math.sin(u * Math.PI * 4) * 14 + Math.cos(u * Math.PI * 6) * 8);
    for (let y = hy; y < PAR_H; y++) {
      mid.px(x, y, y < hy + 3 ? cHillHi : cHill);
    }
  }
  const treeSpecs: readonly [number, number, number, number, number][] = [
    [48, 224, 14, 58, 26],
    [132, 232, 16, 68, 32],
    [224, 226, 12, 52, 24],
    [322, 236, 16, 64, 30],
    [416, 224, 14, 56, 26],
    [512, 230, 15, 62, 28],
  ];
  for (let i = 0; i < treeSpecs.length; i++) {
    const [tx, ty, tw, th, cr] = treeSpecs[i]!;
    paintPixelCanopyTree(
      mid,
      tx,
      ty,
      tw,
      th,
      cr,
      Math.round(cr * 0.62),
      {
        leafHi: '#9678ff',
        leafMid: '#7858f2',
        leafDark: '#5b42d9',
        trunkHi: '#856cf5',
        trunkMid: '#6b52e0',
        trunkDark: '#523cc4',
      },
      200 + i * 31,
    );
  }

  // NEAR: Rich twilight-violet foreground hillocks & low grove silhouettes
  const cNear = hexToAbgr('#5844d4');
  const cNearHi = hexToAbgr('#6e58e8');
  for (let x = 0; x < PAR_W; x++) {
    const u = x / PAR_W;
    const ny = Math.round(274 + Math.sin(u * Math.PI * 6 + 1.2) * 10 + Math.cos(u * Math.PI * 10) * 5);
    for (let y = ny; y < PAR_H; y++) {
      near.px(x, y, y < ny + 3 ? cNearHi : cNear);
    }
  }
}

// --- 2. OPOUSO (Subrosa Haven): Moonlit Harvest Ocean, Painted Cloud Banks & Coastal Stone Arches ---
function bakeOpousoParallax(sky: PixelCanvas, far: PixelCanvas, mid: PixelCanvas, near: PixelCanvas): void {
  paintSteppedSky(
    sky,
    [
      [0.0, '#10146e'],
      [0.35, '#19228c'],
      [0.65, '#2b38a6'],
      [0.85, '#4854b0'],
      [1.0, '#6e6ea8'],
    ],
    8,
  );

  // Crisp twilight stars
  for (let i = 0; i < 64; i++) {
    const sx = hash2i(i, 3, 77) % 572 + 2;
    const sy = hash2i(i, 9, 77) % 165 + 4;
    sky.px(sx, sy, hexToAbgr(i % 4 === 0 ? '#fff6d4' : '#9eb8ff'));
    if (i % 9 === 0) {
      sky.px(sx - 1, sy, hexToAbgr('#b8ccff'));
      sky.px(sx + 1, sy, hexToAbgr('#b8ccff'));
      sky.px(sx, sy - 1, hexToAbgr('#b8ccff'));
      sky.px(sx, sy + 1, hexToAbgr('#b8ccff'));
    }
  }

  // Iconic giant luminous cream harvest moon!
  const moonX = 412;
  const moonY = 58;
  const haloRadii = [96, 80, 66, 54, 44];
  for (let i = 0; i < haloRadii.length; i++) {
    const t = (i + 1) / (haloRadii.length + 1);
    sky.ellipse(moonX, moonY, haloRadii[i]!, haloRadii[i]!, hexToAbgr(mixHex('#222e99', '#ffeab8', t * 0.62)));
  }
  sky.ellipse(moonX, moonY, 36, 36, hexToAbgr('#fff8d6'));

  // Massive lush golden-peach & twilight-slate painted cumulus cloud bank (framed so harvest moon shines grandly above!)
  paintPixelCloudBank(sky, {
    baseY: 146,
    ampY: 50,
    flatBottomY: 164,
    ramp: ['#fff4bf', '#f2ba7a', '#b58496', '#5e65a3', '#353978'],
    freqX: 2.0,
    seed: 202,
    lightDirX: 0.35,
  });

  // FAR: Distant twilight peninsula + shimmering moonlit ocean bay!
  const cCoast = hexToAbgr('#4a4a82');
  const cCoastHi = hexToAbgr('#78709e');
  for (let x = 0; x < PAR_W; x++) {
    const u = x / PAR_W;
    const cy = Math.round(218 + Math.sin(u * Math.PI * 4) * 6 + Math.cos(u * Math.PI * 2 + 1) * 4);
    for (let y = cy; y < 236; y++) {
      far.px(x, y, y <= cy + 2 ? cCoastHi : cCoast);
    }
  }
  paintMoonlitOcean(
    far,
    234,
    PAR_H,
    305,
    {
      horizon: '#a89eb8',
      deep: '#474299',
      mid: '#645ab8',
      shimmerA: '#fff5e0',
      shimmerB: '#e6b8e8',
    },
    303,
  );

  // MID: Monumental weathered coastal limestone stone arches framing Subrosa Haven!
  for (let i = 0; i < 4; i++) {
    paintPixelStoneArch(
      mid,
      72 + i * 144,
      PAR_H - 12,
      146,
      192,
      36,
      {
        hi: '#ffe6d9',
        light: '#d9b5b8',
        mid: '#a68294',
        dark: '#6b4f69',
        mortar: '#3b253d',
      },
      400 + i * 29,
    );
  }

  // NEAR: Low dark-plum foreground shore silhouettes
  const cShore = hexToAbgr('#3b283d');
  for (let x = 0; x < PAR_W; x++) {
    const u = x / PAR_W;
    const sy = Math.round(316 + Math.sin(u * Math.PI * 8) * 5);
    for (let y = sy; y < PAR_H; y++) {
      near.px(x, y, cShore);
    }
  }
}

// --- 3. TDM (Monster's Trail & Title Vista): Glorious Golden-Peach Sunset & Towering Cloud Mountains ---
function bakeTdmParallax(sky: PixelCanvas, far: PixelCanvas, mid: PixelCanvas, near: PixelCanvas): void {
  paintSteppedSky(
    sky,
    [
      [0.0, '#f29e38'],
      [0.24, '#f07c3c'],
      [0.52, '#e35d42'],
      [0.78, '#d45a4c'],
      [1.0, '#b8685c'],
    ],
    9,
  );

  // High hazy warm cloud silhouettes drifting across upper sunset sky
  paintPixelCloudBank(sky, {
    baseY: 118,
    ampY: 56,
    flatBottomY: 160,
    ramp: ['#f08c48', '#e67244', '#d95c44', '#c75044', '#b84942'],
    freqX: 2.0,
    seed: 301,
    lightDirX: -0.45,
  });

  // FAR: Iconic soaring ochre & terracotta sunlit jagged alpine peaks!
  paintPixelMountainRange(far, {
    baseY: 254,
    peaks: [
      [112, 58, 108],
      [252, 128, 86],
      [388, 34, 124],
      [496, 118, 92],
    ],
    litRim: '#ffe099',
    litFace: '#e39e64',
    midFace: '#c77d56',
    shadowFace: '#a65c4a',
    deepShadow: '#87463e',
    seed: 311,
  });

  // MID: Massive lush multi-tiered golden-amber & terracotta cumulus cloud sea framing the alpine peaks!
  paintPixelCloudBank(mid, {
    baseY: 238,
    ampY: 74,
    ramp: ['#ffe7a6', '#eda662', '#cf744a', '#b0543e', '#913e38'],
    freqX: 1.5,
    seed: 325,
    lightDirX: -0.5,
    fadeBottomPx: 72,
    hazeHex: '#b86858',
  });

  // NEAR: Secondary lower rolling sunlit sunset cloud billows melting into warm valley mist!
  paintPixelCloudBank(near, {
    baseY: 286,
    ampY: 54,
    ramp: ['#ffe094', '#e39454', '#c46646', '#a64d3d', '#91423a'],
    freqX: 2.0,
    seed: 349,
    lightDirX: -0.45,
    fadeBottomPx: 64,
    hazeHex: '#b3665a',
  });
}

// --- 4. FLIN (Infested Forest): Bioluminescent Misty Teal-Cyan Jungle Canopy ---
function bakeFlinParallax(sky: PixelCanvas, far: PixelCanvas, mid: PixelCanvas, near: PixelCanvas): void {
  paintSteppedSky(
    sky,
    [
      [0.0, '#07889e'],
      [0.35, '#12a8b8'],
      [0.7, '#2cc9c9'],
      [1.0, '#5ee6d4'],
    ],
    8,
  );

  // FAR: Pale luminous misty forest monoliths & hanging canopy moss curtains
  const cFarTrunk = hexToAbgr('#1aaeb8');
  const cFarLit = hexToAbgr('#42d9d4');
  const cFarCanopy = hexToAbgr('#1099ab');
  for (let i = 0; i < 9; i++) {
    const tx = 18 + i * 64 + ((i * 19) % 18);
    const tw = 22 + (i % 3) * 10;
    far.rect(tx, 16, tw, PAR_H - 16, cFarTrunk);
    far.rect(tx, 16, 4, PAR_H - 16, cFarLit);
    // Hanging mossy vine strands from canopy
    for (let s = 0; s < 6; s++) {
      const sx = tx - 14 + s * 9;
      const sh = 38 + (hash2i(i, s, 404) % 52);
      far.rect(sx, 0, 2, sh, cFarCanopy);
    }
  }
  // Glowing teal-mint forest mist shelf across lower valley
  for (let y = 174; y < PAR_H; y++) {
    const col = y < 182 ? hexToAbgr('#78f5de') : y < 224 ? hexToAbgr('#42d4c9') : hexToAbgr('#22a8b0');
    for (let x = 0; x < PAR_W; x++) {
      if (far.get(x, y) === 0 || y > 186) {
        const mossWave = Math.sin(x * 0.08) * 3;
        if (y > 176 + mossWave) far.px(x, y, col);
      }
    }
  }

  // MID: Towering layered deep-teal ancient jungle tree trunks with glowing cyan moss banks!
  const cMidTrunk = hexToAbgr('#0b5c7d');
  const cMidHi = hexToAbgr('#1882a3');
  const cMidDark = hexToAbgr('#073d59');
  const cMossTop = hexToAbgr('#78f2e6');
  const cMossMid = hexToAbgr('#2cc2c4');

  // Midground organic irregular mossy jungle ridge bank (zero mechanical sine waves!)
  for (let x = 0; x < PAR_W; x++) {
    const u = x / PAR_W;
    const tuft = (tileableNoise(u, 0.3, 32, 4, 412) - 0.5) * 10;
    const hill = Math.sin(u * Math.PI * 4) * 5 + Math.cos(u * Math.PI * 6 + 1.1) * 4;
    const topY = Math.round(172 + hill + tuft);
    for (let y = topY; y < 276; y++) {
      const col = y < topY + 4 ? cMossTop : y < topY + 10 ? cMossMid : cMidTrunk;
      mid.px(x, y, col);
    }
  }

  // Massive full-height jungle trunks & gnarled buttresses
  const trunks = [24, 114, 212, 318, 412, 504];
  for (let i = 0; i < trunks.length; i++) {
    const tx = trunks[i]!;
    const tw = 34 + (i % 3) * 10;
    for (let y = 0; y < PAR_H; y++) {
      const sway = Math.round(Math.sin(y * 0.015 + i) * 3);
      const flare = y > 240 ? Math.round(((y - 240) / 104) * 10) : 0;
      const wHalf = (tw >> 1) + flare;
      for (let dx = -wHalf; dx <= wHalf; dx++) {
        const col =
          dx < -wHalf + 5
            ? cMidHi
            : dx > wHalf - 6
              ? cMidDark
              : cMidTrunk;
        mid.pxWrapX(tx + sway + dx, y, col);
      }
    }
    // Dripping mossy curtain at upper canopy
    for (let d = 0; d < 10; d++) {
      const dx = tx - 26 + d * 6;
      const dh = 42 + (hash2i(i, d, 419) % 58);
      mid.rect(dx, 0, 2, dh, cMidHi);
    }
  }

  // NEAR: Deep shadowy foreground silhouetted buttress & misted lower canopy
  const cNear = hexToAbgr('#062a42');
  for (let x = 0; x < PAR_W; x++) {
    const h = 304 + Math.round(Math.sin(x * 0.04) * 8);
    for (let y = h; y < PAR_H; y++) near.px(x, y, cNear);
  }
}

// --- 5. AP (Primal Tree): Cosmic Deep-Plum Starfield, Glowing Rim Moon & Bioluminescent Root Canopy ---
function bakeApParallax(sky: PixelCanvas, far: PixelCanvas, mid: PixelCanvas, near: PixelCanvas): void {
  paintSteppedSky(
    sky,
    [
      [0.0, '#1e0e38'],
      [0.28, '#2d124d'],
      [0.58, '#45145e'],
      [0.82, '#5e1a5e'],
      [1.0, '#78265c'],
    ],
    10,
  );

  // Dense multi-layered crisp twinkling pixel starfield!
  for (let i = 0; i < 220; i++) {
    const sx = hash2i(i, 5, 505) % 574 + 1;
    const sy = hash2i(i, 11, 505) % 240 + 2;
    const bright = (i % 7) === 0;
    const col = hexToAbgr(bright ? '#ffffff' : i % 3 === 0 ? '#e3b8ff' : '#9c6bc9');
    sky.px(sx, sy, col);
    if (bright && i % 14 === 0) {
      sky.px(sx - 1, sy, hexToAbgr('#b88ae6'));
      sky.px(sx + 1, sy, hexToAbgr('#b88ae6'));
      sky.px(sx, sy - 1, hexToAbgr('#b88ae6'));
      sky.px(sx, sy + 1, hexToAbgr('#b88ae6'));
    }
  }

  // Ethereal dark cosmic moon with glowing mint-emerald crescent rim!
  const mx = 148;
  const my = 62;
  sky.ellipse(mx, my, 24, 24, hexToAbgr('#66f5b8'));
  sky.ellipse(mx - 4, my + 3, 22, 22, hexToAbgr('#351452'));

  // FAR: Distant luminous twilight horizon glow band & faint canopy haze
  for (let y = 264; y < PAR_H; y++) {
    const col =
      y < 270
        ? hexToAbgr('#9472a8')
        : y < 278
          ? hexToAbgr('#6e4a82')
          : hexToAbgr('#421d4f');
    far.rect(0, y, PAR_W, 1, col);
  }

  // MID: Gnarled dark-indigo arched ancient tree roots studded with glowing cyan blossoms!
  const cRootD = hexToAbgr('#12242e');
  const cRootM = hexToAbgr('#1f424a');
  const cRootH = hexToAbgr('#387570');
  const cBud = hexToAbgr('#4ce8ff');
  const cBudHi = hexToAbgr('#d4ffff');

  for (let i = 0; i < 5; i++) {
    const ax = 48 + i * 116;
    // Sweeping arched root bridge
    for (let dx = -38; dx <= 38; dx++) {
      const norm = dx / 38;
      const archY = Math.round(284 - (1 - norm * norm) * 30);
      for (let t = 0; t < 7; t++) {
        const col = t <= 1 ? cRootH : t <= 3 ? cRootM : cRootD;
        mid.pxWrapX(ax + dx, archY + t, col);
      }
    }
    // Delicate branching bioluminescent shrub beside each root
    const bx = ax + 46;
    mid.line(bx, 290, bx - 12, 266, cRootM, 2);
    mid.line(bx, 290, bx + 14, 268, cRootM, 2);
    mid.line(bx, 290, bx + 2, 258, cRootH, 2);
    const buds: readonly [number, number][] = [
      [bx - 13, 264],
      [bx - 8, 272],
      [bx + 2, 256],
      [bx + 14, 266],
      [bx + 9, 275],
    ];
    for (const [px, py] of buds) {
      mid.ellipse(px, py, 2, 2, cBud);
      mid.px(px, py, cBudHi);
    }
  }

  // NEAR: Low thorny silhouette anchoring foreground floor
  const cNear = hexToAbgr('#290e38');
  for (let x = 0; x < PAR_W; x++) {
    const ny = 308 + Math.round(Math.sin(x * 0.08) * 4);
    for (let y = ny; y < PAR_H; y++) near.px(x, y, cNear);
  }
}

// --- 6. ATVC (Volcanic Altar): Blazing Sunlit Temple Columns & Billowing Volcanic Plumes ---
function bakeAtvcParallax(sky: PixelCanvas, far: PixelCanvas, mid: PixelCanvas, near: PixelCanvas): void {
  paintSteppedSky(
    sky,
    [
      [0.0, '#f29088'],
      [0.28, '#f7ab7c'],
      [0.58, '#fcc972'],
      [0.84, '#ffe88a'],
      [1.0, '#fff7bd'],
    ],
    9,
  );

  // FAR: Colossal billowing dusty-rose & golden-lit volcanic smoke clouds rising behind temple pillars!
  paintPixelCloudBank(far, {
    baseY: 224,
    ampY: 112,
    ramp: ['#fff0a6', '#f7be84', '#e38d84', '#c96b73', '#a64d5e'],
    freqX: 1.5,
    seed: 601,
    lightDirX: 0.45,
    curlSweep: -0.22,
  });

  // Distant jagged volcanic ruined city/caldera silhouette along lower horizon
  const cCald = hexToAbgr('#d97a73');
  const cCaldHi = hexToAbgr('#f2a684');
  for (let x = 0; x < PAR_W; x++) {
    const b = Math.floor(x / 24);
    const h = 236 + ((hash2i(b, 3, 606) % 28) - 10);
    for (let y = h; y < PAR_H; y++) {
      far.px(x, y, y < h + 3 ? cCaldHi : cCald);
    }
  }

  // MID: Monumental sunlit carved sandstone & gold ancient temple columns rising full-height!
  const pillars = [64, 354];
  for (let i = 0; i < pillars.length; i++) {
    const px = pillars[i]!;
    paintPixelStonePillar(
      mid,
      px,
      0,
      96,
      PAR_H,
      {
        hi: '#fff5bf',
        light: '#f7ca78',
        mid: '#de9152',
        dark: '#b3613c',
        mortar: '#7d3a2c',
      },
      610 + i * 37,
      14,
    );
    // Molded horizontal temple capital band
    mid.rect(px - 6, 114, 108, 6, hexToAbgr('#fff2b0'));
    mid.rect(px - 6, 120, 108, 4, hexToAbgr('#b3613c'));
    mid.rect(px - 8, 258, 112, 8, hexToAbgr('#f5be6e'));
    mid.rect(px - 8, 266, 112, 5, hexToAbgr('#8f4030'));
  }

  // NEAR: Warm glowing golden volcanic hearth haze along base
  for (let x = 0; x < PAR_W; x++) {
    const hy = 296 + Math.round(Math.sin(x * 0.05) * 4);
    for (let y = hy; y < PAR_H; y++) {
      near.px(x, y, y < hy + 3 ? hexToAbgr('#ffe88a') : hexToAbgr('#e89964'));
    }
  }
}

// --- 7. DSI (Isolated Desert): Scorching Golden-Chartreuse Mirage, Sunken Ruins & Saguaro Dunes ---
function bakeDsiParallax(sky: PixelCanvas, far: PixelCanvas, mid: PixelCanvas, near: PixelCanvas): void {
  paintSteppedSky(
    sky,
    [
      [0.0, '#78563c'],
      [0.34, '#8f6944'],
      [0.68, '#b58e4c'],
      [1.0, '#e8d84a'],
    ],
    8,
  );

  // Warm blazing desert sun & shimmering mirage haze (soft golden rings, never harsh neon green)
  const sunX = 288;
  const sunY = 122;
  const rings: readonly [number, string][] = [
    [102, '#a38042'],
    [82, '#c7a644'],
    [64, '#e6cc52'],
    [46, '#f7eb78'],
    [30, '#fffcd4'],
  ];
  for (const [r, hex] of rings) {
    sky.ellipse(sunX, sunY, r * 1.18, r * 0.84, hexToAbgr(hex));
  }

  // FAR: Sun-washed distant desert dunes & weathered masonry sunken ruin towers!
  const cFarDune = hexToAbgr('#b8cc5e');
  const cFarHi = hexToAbgr('#d9e870');
  // Left weathered carved sunken tower with crumbling battlements & window slits
  paintPixelStonePillar(
    far,
    144,
    138,
    46,
    98,
    {
      hi: '#b5d478',
      light: '#94bf6c',
      mid: '#78ab64',
      dark: '#5e8c54',
      mortar: '#4a7048',
    },
    707,
    10,
  );
  far.rect(144, 134, 14, 8, hexToAbgr('#78ab64'));
  far.rect(176, 136, 14, 6, hexToAbgr('#5e8c54'));
  for (let wy = 154; wy < 210; wy += 12) {
    far.rect(152, wy, 5, 7, cFarHi);
    far.rect(168, wy, 5, 7, cFarDune);
  }
  // Right crumbling sunken obelisk & weathered desert ruin arch
  paintPixelStonePillar(
    far,
    404,
    166,
    38,
    72,
    {
      hi: '#b5d478',
      light: '#94bf6c',
      mid: '#78ab64',
      dark: '#5e8c54',
      mortar: '#4a7048',
    },
    719,
    9,
  );
  far.tri(404, 166, 423, 146, 442, 166, hexToAbgr('#94bf6c'));
  for (let x = 0; x < PAR_W; x++) {
    const u = x / PAR_W;
    const dy = Math.round(214 + Math.sin(u * Math.PI * 4) * 10 + Math.cos(u * Math.PI * 8) * 5);
    for (let y = dy; y < PAR_H; y++) {
      far.px(x, y, y < dy + 3 ? cFarHi : cFarDune);
    }
  }

  // MID: Rolling sunlit golden-chartreuse desert dunes + pixel saguaro cacti & broken ruin posts!
  const cMidHi = hexToAbgr('#e8f278');
  const cMid = hexToAbgr('#cde36b');
  const cMidSh = hexToAbgr('#b4cf5b');
  for (let x = 0; x < PAR_W; x++) {
    const u = x / PAR_W;
    const dy = Math.round(234 + Math.sin(u * Math.PI * 2 + 0.8) * 14 + Math.cos(u * Math.PI * 6) * 6);
    for (let y = dy; y < PAR_H; y++) {
      mid.px(x, y, y < dy + 4 ? cMidHi : y < dy + 22 ? cMid : cMidSh);
    }
  }
  const cacti: readonly [number, number, number][] = [
    [76, 246, 24],
    [194, 242, 32],
    [348, 250, 22],
    [474, 236, 36],
  ];
  for (const [cx, cy, ch] of cacti) {
    const cCac = hexToAbgr('#a8c958');
    const cCacHi = hexToAbgr('#d8f078');
    mid.rect(cx - 2, cy - ch, 5, ch, cCac);
    mid.rect(cx - 2, cy - ch, 2, ch, cCacHi);
    mid.rect(cx - 10, cy - Math.round(ch * 0.62), 8, 4, cCac);
    mid.rect(cx - 10, cy - Math.round(ch * 0.86), 4, Math.round(ch * 0.28), cCacHi);
    mid.rect(cx + 3, cy - Math.round(ch * 0.48), 8, 4, cCac);
    mid.rect(cx + 7, cy - Math.round(ch * 0.72), 4, Math.round(ch * 0.28), cCac);
  }

  // NEAR: Bright sunlit foreground dune rim
  for (let x = 0; x < PAR_W; x++) {
    const ny = 292 + Math.round(Math.sin(x * 0.03) * 7);
    for (let y = ny; y < PAR_H; y++) {
      near.px(x, y, y < ny + 3 ? hexToAbgr('#f5f794') : hexToAbgr('#dce678'));
    }
  }
}

// --- 8. LAB (Forgotten Labyrinth): Moody Steampunk Clockwork Catacomb & Glowing Oil Lamps ---
function bakeLabParallax(sky: PixelCanvas, far: PixelCanvas, mid: PixelCanvas, near: PixelCanvas): void {
  paintSteppedSky(
    sky,
    [
      [0.0, '#16111c'],
      [0.45, '#211926'],
      [0.85, '#2b222e'],
      [1.0, '#362a36'],
    ],
    6,
  );

  // Subtle dark stone brick wall texture across catacomb background
  const cBrick = hexToAbgr('#261e2b');
  const cMor = hexToAbgr('#17111c');
  for (let y = 0; y < 324; y++) {
    const row = y >> 4;
    const ly = y & 15;
    for (let x = 0; x < 576; x++) {
      const bx = (x + (row & 1) * 16) & 31;
      if (ly === 0 || bx === 0) sky.px(x, y, cMor);
      else if (ly === 1 && (row & 1) === 0) sky.px(x, y, cBrick);
    }
  }

  // FAR: Vaulted subterranean stone arches, iron bars & shadowy ascending stone stairs!
  for (let i = 0; i < 3; i++) {
    paintPixelStoneArch(
      far,
      96 + i * 192,
      PAR_H - 16,
      194,
      276,
      26,
      {
        hi: '#453b45',
        light: '#382f3a',
        mid: '#2c2430',
        dark: '#211b26',
        mortar: '#15101a',
      },
      800 + i * 19,
    );
  }
  // Subtle diagonal stone staircase silhouette in far depth
  for (let s = 0; s < 18; s++) {
    far.rect(320 + s * 8, 220 - s * 8, 12, 10, hexToAbgr('#322936'));
  }

  // MID: Ornate fluted stone pillars, heavy hanging iron chains & warm glowing Edison oil lamps!
  const pillars = [126, 336, 512];
  for (let i = 0; i < pillars.length; i++) {
    const px = pillars[i]!;
    paintPixelStonePillar(
      mid,
      px,
      20,
      36,
      PAR_H - 20,
      {
        hi: '#615459',
        light: '#4d4248',
        mid: '#3b3138',
        dark: '#2a2229',
        mortar: '#1a141c',
      },
      820 + i * 41,
      16,
    );
    // Carved pillar capital & central collar ring
    mid.rect(px - 6, 48, 48, 12, hexToAbgr('#4d4248'));
    mid.rect(px - 4, 152, 44, 18, hexToAbgr('#54484d'));
    mid.rect(px - 4, 152, 44, 2, hexToAbgr('#706163'));
  }

  // Heavy hanging iron chains
  const chains = [24, 54, 208, 464];
  for (let i = 0; i < chains.length; i++) {
    const cx = chains[i]!;
    const len = 120 + (i % 3) * 58;
    for (let y = 0; y < len; y += 10) {
      mid.rect(cx - 4, y, 8, 8, hexToAbgr('#3b474d'));
      mid.rect(cx - 2, y + 2, 4, 4, 0);
      mid.px(cx - 3, y + 1, hexToAbgr('#66787d'));
      mid.rect(cx - 1, y + 6, 2, 5, hexToAbgr('#526166'));
    }
  }

  // Warm glowing hanging glass oil lamps along the walkway!
  const lamps = [22, 186, 422, 548];
  for (const lx of lamps) {
    const ly = 248;
    // Soft stepped warm glow halo
    mid.ellipse(lx, ly + 8, 18, 16, hexToAbgr('#3d3228'));
    mid.ellipse(lx, ly + 8, 11, 10, hexToAbgr('#6b5832'));
    // Iron bracket & shade
    mid.rect(lx - 1, ly - 18, 2, 16, hexToAbgr('#4a3832'));
    mid.rect(lx - 8, ly - 2, 16, 3, hexToAbgr('#78563c'));
    // Glowing golden bulb
    mid.ellipseShaded(lx, ly + 8, 6, 7.5, hexToAbgr('#ffffff'), hexToAbgr('#fff094'), hexToAbgr('#d9a838'));
  }

  // NEAR: Subtle iron catwalk girder shadow along base
  near.rect(0, PAR_H - 18, PAR_W, 18, hexToAbgr('#1c1521'));
}

// --- 9. TEMP (Atomic Temple): Celestial Indigo Cloud-Sea & Glowing Circuit Pyramids ---
function bakeTempParallax(sky: PixelCanvas, far: PixelCanvas, mid: PixelCanvas, near: PixelCanvas): void {
  paintSteppedSky(
    sky,
    [
      [0.0, '#442cd4'],
      [0.35, '#5942eb'],
      [0.7, '#735cf5'],
      [1.0, '#8c7aff'],
    ],
    7,
  );

  // Subtle celestial stars in upper stratosphere
  for (let i = 0; i < 48; i++) {
    const sx = hash2i(i, 7, 909) % 572 + 2;
    const sy = hash2i(i, 13, 909) % 105 + 4;
    sky.px(sx, sy, hexToAbgr(i % 3 === 0 ? '#ffffff' : '#b8e0ff'));
  }

  // FAR: Towering pearly periwinkle & lavender billowing cumulus cloud sea!
  paintPixelCloudBank(far, {
    baseY: 168,
    ampY: 66,
    ramp: ['#eef5ff', '#c8daf8', '#9eb4e8', '#7d92d8', '#6374c7'],
    freqX: 2.0,
    seed: 911,
    lightDirX: -0.45,
  });

  // MID: Rich cobalt-violet lower puffy cloud-sea layer billowing across the temple horizon!
  paintPixelCloudBank(mid, {
    baseY: 222,
    ampY: 56,
    ramp: ['#b0adff', '#8d85f5', '#6e63e8', '#564ad1', '#4237ba'],
    freqX: 2.0,
    seed: 937,
    lightDirX: -0.4,
  });

  // NEAR: Glowing white-and-cyan circuit-etched crystal pyramids along the temple skyline!
  const pyrs: readonly [number, number, number][] = [
    [48, 258, 34],
    [262, 260, 32],
    [354, 266, 26],
    [442, 256, 36],
    [482, 264, 28],
  ];
  for (const [px, py, ph] of pyrs) {
    near.tri(px - ph, py + ph, px, py, px + ph, py + ph, hexToAbgr('#78e8ff'));
    near.tri(px - ph + 4, py + ph, px, py + 4, px + ph - 4, py + ph, hexToAbgr('#eefaff'));
    // Neon magenta & cyan circuit traces etched on pyramid face
    near.line(px, py + 8, px, py + ph - 4, hexToAbgr('#38c8ff'));
    near.line(px - 10, py + ph - 12, px + 10, py + ph - 12, hexToAbgr('#ff70d4'));
    near.line(px - 6, py + ph - 20, px + 6, py + ph - 20, hexToAbgr('#38c8ff'));
    near.ellipse(px, py + 11, 2.5, 2.5, hexToAbgr('#ff8ae0'));
  }
}

// --- 10. EVIL (Nightmare Spire): Blood-Crimson Orb Sky, Toxic Green Storm Canopy & Underlit Dead Forest ---
function bakeEvilParallax(sky: PixelCanvas, far: PixelCanvas, mid: PixelCanvas, near: PixelCanvas): void {
  paintSteppedSky(
    sky,
    [
      [0.0, '#6e0428'],
      [0.35, '#8c0832'],
      [0.68, '#9e0c36'],
      [0.86, '#7a1c38'],
      [1.0, '#3b4a3c'],
    ],
    8,
  );

  // Colossal ominous blood-crimson moon/orb brooding behind the mist (NO duplicate in BiomeRenderer!)
  const ox = 206;
  const oy = 148;
  sky.ellipse(ox, oy, 98, 98, hexToAbgr('#7d052a'));
  sky.ellipse(ox - 6, oy - 4, 86, 86, hexToAbgr('#660322'));
  // Subtle eerie crater blotches inside the crimson orb
  sky.ellipse(ox - 24, oy - 18, 14, 10, hexToAbgr('#54021c'));
  sky.ellipse(ox + 18, oy + 12, 18, 12, hexToAbgr('#54021c'));

  // FAR: Eerie silhouetted dead-forest canopy & ruined spires UNDER-LIT by radioactive lime-green mist!
  const cFogHi = hexToAbgr('#94e85e');
  const cFogMid = hexToAbgr('#5e9e4a');
  const cFogDeep = hexToAbgr('#354a36');
  const cDeadDark = hexToAbgr('#361436');
  const cDeadMid = hexToAbgr('#4d1c45');

  // Glowing toxic green ground-fog glow band
  for (let y = 248; y < PAR_H; y++) {
    const col = y < 262 ? cFogHi : y < 284 ? cFogMid : cFogDeep;
    far.rect(0, y, PAR_W, 1, col);
  }
  // Haunted twisted dead trees & shattered spires silhouetted against the green fog
  const deadTrees = [52, 138, 248, 368, 468, 536];
  for (let i = 0; i < deadTrees.length; i++) {
    const tx = deadTrees[i]!;
    paintPixelCanopyTree(
      far,
      tx,
      272,
      14,
      58 + (i % 3) * 14,
      28 + (i % 2) * 8,
      18,
      {
        leafHi: '#4d1c45',
        leafMid: '#361436',
        leafDark: '#70c44e', // under-lit eerie lime rim on underside of canopy!
        trunkHi: '#4d1c45',
        trunkMid: '#361436',
        trunkDark: '#260d29',
      },
      1000 + i * 29,
    );
  }
  // Low jagged dark silhouette ridge over the green fog
  for (let x = 0; x < PAR_W; x++) {
    const hy = 266 + Math.round(Math.sin(x * 0.05) * 10 + Math.cos(x * 0.14) * 5);
    for (let y = hy; y < 276; y++) {
      far.px(x, y, y === hy ? cDeadMid : cDeadDark);
    }
  }

  // MID: Iconic overhanging coiled GLOWING NEON-GREEN STORM CLOUD pillows along top of viewport!
  paintPixelCloudBank(mid, {
    baseY: 14,
    ampY: 44,
    topDown: true,
    ramp: ['#c8ffa6', '#88f570', '#48bd58', '#226b42', '#14382b'],
    freqX: 2.5,
    seed: 1051,
    lightDirX: 0.3,
  });

  // NEAR: Low misty dark olive horizon bar
  near.rect(0, PAR_H - 22, PAR_W, 22, hexToAbgr('#2b382c'));
}

// --- 11. GSHIP (Ghost Ship): Surreal Acid-Chartreuse Sky & Swirling Rose-Pink Wind Clouds ---
function bakeGshipParallax(sky: PixelCanvas, far: PixelCanvas, mid: PixelCanvas, near: PixelCanvas): void {
  paintSteppedSky(
    sky,
    [
      [0.0, '#d8f038'],
      [0.24, '#e3f54c'],
      [0.44, '#c77088'],
      [0.72, '#ab788f'],
      [1.0, '#8f6b80'],
    ],
    7,
  );

  // FAR: Distant jagged dusty-rose volcanic islands & lone ghostly skyline tree
  const cIsl = hexToAbgr('#bf667e');
  const cIslHi = hexToAbgr('#d97d8e');
  for (let x = 0; x < PAR_W; x++) {
    const u = x / PAR_W;
    const ridge = Math.round(
      92 +
        Math.sin(u * Math.PI * 4) * 12 +
        Math.cos(u * Math.PI * 10) * 6 +
        (tileableNoise(u, 0.2, 24, 2, 1101) - 0.5) * 10,
    );
    for (let y = ridge; y < 142; y++) {
      far.px(x, y, y < ridge + 3 ? cIslHi : cIsl);
    }
  }
  paintPixelCanopyTree(
    far,
    370,
    98,
    5,
    18,
    12,
    9,
    {
      leafHi: '#d97d8e',
      leafMid: '#bf667e',
      leafDark: '#9e4c68',
      trunkHi: '#bf667e',
      trunkMid: '#9e4c68',
      trunkDark: '#7d3952',
    },
    1111,
  );

  // MID: Sweeping, wind-sheared painterly cream & dusty-rose haunted cumulus cloud sea!
  paintPixelCloudBank(mid, {
    baseY: 236,
    ampY: 66,
    ramp: ['#fff5bd', '#f5cca0', '#e09692', '#bf768c', '#9c667e'],
    freqX: 1.5,
    seed: 1125,
    lightDirX: -0.55,
    curlSweep: 0.42,
  });

  // Delicate high wind-swept rose-cream cloud wisp above the horizon
  paintPixelCloudBank(mid, {
    baseY: 74,
    ampY: 18,
    flatBottomY: 86,
    isolated: true,
    ramp: ['#fff7c4', '#f7cfa0', '#e69d96', '#c9788c', '#ad627a'],
    freqX: 1.0,
    seed: 1144,
    lightDirX: -0.6,
    curlSweep: 0.5,
  });

  // NEAR: Faint misty twilight wave horizon at deck bottom
  for (let x = 0; x < PAR_W; x++) {
    const ny = 304 + Math.round(Math.sin(x * 0.06) * 4);
    for (let y = ny; y < PAR_H; y++) {
      near.px(x, y, hexToAbgr('#826378'));
    }
  }
}

// ============================================================================
// 4. Special Tiles (32x32 Single & Animated Multi-Frame 16-Bit Strips)
// ============================================================================

export function bakeSpecialTiles(): Map<string, HTMLCanvasElement> {
  const map = new Map<string, HTMLCanvasElement>();
  const cOut = hexToAbgr(OUTLINE_DARK);
  const cWhite = hexToAbgr(HIGHLIGHT_CREAM);

  // OneWay: Iconic lush intertwined knotted vine-and-branch platform!
  {
    const b = new PixelCanvas(32, 32);
    const vSpec = hexToAbgr('#ffa842');
    const vHi = hexToAbgr('#d96e1c');
    const vMid = hexToAbgr('#8f380e');
    const vDark = hexToAbgr('#4a1908');
    // Intertwined figure-8 horizontal wooden vine strands wrapping seamlessly across x=0..31
    for (let x = 0; x < 32; x++) {
      const ang = (x / 32) * Math.PI * 2;
      const yA = 6 + Math.round(Math.sin(ang) * 3.5);
      const yB = 6 + Math.round(Math.sin(ang + Math.PI) * 3.5);
      // Back strand
      b.rect(x, yB - 1, 1, 4, vDark);
      b.px(x, yB, vMid);
      // Front lit strand
      b.rect(x, yA - 2, 1, 5, vMid);
      b.px(x, yA - 2, vSpec);
      b.px(x, yA - 1, vHi);
      b.px(x, yA + 2, vDark);
    }
    // Delicate curling hanging vine tendrils underneath
    const curls: readonly [number, number][] = [
      [5, 11],
      [6, 12],
      [8, 12],
      [9, 11],
      [15, 11],
      [16, 13],
      [18, 13],
      [19, 11],
      [25, 11],
      [26, 12],
      [28, 12],
    ];
    for (const [cx, cy] of curls) {
      b.px(cx, cy, vMid);
      b.px(cx, cy + 1, vDark);
    }
    b.selectiveOutline(cOut, 0.55, 0.88);
    map.set('oneway', b.toCanvas());
  }

  // Spikes: Razor-sharp vivid crimson crystal-petal thorns (high-contrast danger readability!)
  {
    const b = new PixelCanvas(32, 32);
    const cSpec = hexToAbgr('#ffffff');
    const cHi = hexToAbgr('#ff5c8a');
    const cMid = hexToAbgr('#d41448');
    const cDark = hexToAbgr('#6e0a2c');
    b.rect(1, 27, 30, 4, cDark);
    b.rect(2, 26, 28, 2, cMid);
    const centers = [6, 16, 26];
    for (const sx of centers) {
      // Side petal blades
      b.tri(sx - 5, 26, sx - 4, 15, sx - 1, 26, cDark);
      b.tri(sx - 4, 26, sx - 4, 16, sx - 2, 26, cHi);
      b.tri(sx + 1, 26, sx + 4, 15, sx + 5, 26, cDark);
      b.tri(sx + 2, 26, sx + 4, 16, sx + 4, 26, cMid);
      // Tall center crystal spike
      b.tri(sx - 4, 26, sx, 8, sx + 4, 26, cDark);
      b.tri(sx - 3, 26, sx, 9, sx, 26, cHi);
      b.tri(sx, 26, sx, 9, sx + 3, 26, cMid);
      b.line(sx - 1, 12, sx, 8, cSpec);
      b.px(sx, 7, cSpec);
    }
    b.selectiveOutline(cOut, 0.5, 0.88);
    map.set('spike', b.toCanvas());
  }

  // Breakable cracked wooden/stone crate
  {
    const b = new PixelCanvas(32, 32);
    const hi = hexToAbgr('#ffd280');
    const mid = hexToAbgr('#cc7d33');
    const dark = hexToAbgr('#783c18');
    const deep = hexToAbgr('#421d0c');
    b.roundedRect(1, 1, 30, 30, mid, 2);
    b.rect(2, 2, 28, 3, hi);
    b.rect(2, 2, 3, 28, hi);
    b.rect(2, 27, 28, 3, dark);
    b.rect(27, 2, 3, 28, dark);
    b.rect(5, 5, 22, 22, deep);
    b.rect(6, 6, 20, 20, mid);
    b.line(6, 6, 25, 25, hi, 2);
    b.line(6, 8, 23, 25, dark);
    b.line(25, 6, 6, 25, hi, 2);
    // Tell-tale fracture crack
    b.line(15, 6, 13, 14, deep);
    b.line(13, 14, 18, 21, deep);
    b.line(18, 21, 16, 26, deep);
    b.selectiveOutline(cOut, 0.5, 0.9);
    map.set('breakable', b.toCanvas());
  }

  // StoneOverhead (Heavy gilded rune boulder smashable by Rock Uppercut)
  {
    const b = new PixelCanvas(32, 32);
    const sHi = hexToAbgr('#cfc9e6');
    const sMid = hexToAbgr('#7d769e');
    const sDark = hexToAbgr('#4a4369');
    const goldHi = hexToAbgr('#fff2a6');
    const gold = hexToAbgr('#ffad16');
    b.roundedRect(1, 1, 30, 30, sMid, 3);
    b.rect(3, 2, 26, 3, sHi);
    b.rect(2, 4, 3, 24, sHi);
    b.rect(3, 27, 26, 3, sDark);
    b.rect(27, 4, 3, 24, sDark);
    b.line(9, 21, 16, 10, gold, 2);
    b.line(16, 10, 23, 21, gold, 2);
    b.line(10, 19, 16, 9, goldHi);
    b.line(16, 9, 22, 19, goldHi);
    b.line(4, 12, 10, 15, cOut);
    b.line(27, 18, 21, 22, cOut);
    b.selectiveOutline(cOut, 0.5, 0.9);
    map.set('stone_overhead', b.toCanvas());
  }

  // Bounce Pad: Iconic vivid emerald lotus-leaf spring pad over a glowing cyan crystal bulb!
  {
    const sheet = new PixelCanvas(64, 32);
    const fBuf = new PixelCanvas(32, 32);
    const lSpec = hexToAbgr('#b8ff66');
    const lHi = hexToAbgr('#42f238');
    const lMid = hexToAbgr('#12b838');
    const lDark = hexToAbgr('#0a6636');
    const calMid = hexToAbgr('#2e8c78');
    const calDark = hexToAbgr('#185259');
    const orbHi = hexToAbgr('#d8ffff');
    const orbMid = hexToAbgr('#38d8ff');
    const orbDark = hexToAbgr('#1466d9');

    for (let f = 0; f < 2; f++) {
      fBuf.clear();
      const sq = f === 1 ? 3 : 0;
      // Glowing cyan crystal orb nestled in base
      fBuf.ellipseShaded(16, 24 + (sq >> 1), 6.5, 6, orbHi, orbMid, orbDark, cWhite);
      // Leafy calyx petals cradling the glowing orb
      fBuf.tri(9, 24, 13, 15 + sq, 16, 21 + sq, calMid);
      fBuf.tri(23, 24, 19, 15 + sq, 16, 21 + sq, calDark);
      fBuf.tri(12, 25, 16, 16 + sq, 20, 25, calMid);
      fBuf.rect(14, 14 + sq, 4, 5, calDark);
      // Lush wide overhanging spring-pad emerald lotus leaf!
      fBuf.ellipseShaded(10, 11 + sq, 9, 3.8, lSpec, lHi, lMid);
      fBuf.ellipseShaded(22, 10 + sq, 9, 3.5, lSpec, lHi, lDark);
      fBuf.ellipseShaded(16, 12 + sq, 11, 3.8, lSpec, lHi, lDark);
      fBuf.line(6, 10 + sq, 25, 9 + sq, lSpec);
      fBuf.selectiveOutline(hexToAbgr('#083329'), 0.45, 0.85);
      sheet.blit(fBuf, f * 32, 0);
    }
    map.set('bounce', sheet.toCanvas());
  }

  // Slippery Climbing Vine rail: Lush spiraling emerald thorny vine
  {
    const b = new PixelCanvas(32, 32);
    const vSpec = hexToAbgr('#c8ff78');
    const vHi = hexToAbgr('#42e848');
    const vMid = hexToAbgr('#189e42');
    const vDark = hexToAbgr('#0c5230');
    const thorn = hexToAbgr('#ffe88a');
    for (let y = 0; y < 32; y++) {
      const ang = (y / 32) * Math.PI * 2;
      const x1 = 15 + Math.round(Math.sin(ang) * 2.5);
      const x2 = 15 + Math.round(Math.sin(ang + Math.PI) * 2.5);
      b.rect(x2 - 1, y, 4, 1, vDark);
      b.rect(x1 - 2, y, 5, 1, vMid);
      b.px(x1 - 1, y, vHi);
      if ((y & 3) === 0) b.px(x1 - 2, y, vSpec);
    }
    // Diagonal sunlit leaves & golden thorns
    b.tri(13, 8, 6, 4, 10, 11, vHi);
    b.px(7, 5, vSpec);
    b.tri(18, 20, 25, 16, 21, 23, vHi);
    b.px(24, 17, vSpec);
    b.px(11, 15, thorn);
    b.px(20, 27, thorn);
    b.selectiveOutline(hexToAbgr('#07291c'), 0.5, 0.88);
    map.set('vine', b.toCanvas());
  }

  // Acid (4 frames bubbling toxic neon-lime waves)
  {
    const sheet = new PixelCanvas(128, 32);
    const fBuf = new PixelCanvas(32, 32);
    const foam = hexToAbgr('#e8ff99');
    const hi = hexToAbgr('#8aff38');
    const mid = hexToAbgr('#32c424');
    const dark = hexToAbgr('#167524');
    for (let f = 0; f < 4; f++) {
      fBuf.clear();
      for (let x = 0; x < 32; x++) {
        const wave = 4 + Math.round(Math.sin(((x + f * 8) / 32) * Math.PI * 2) * 2.2);
        fBuf.px(x, wave - 1, foam);
        fBuf.px(x, wave, hi);
        for (let y = wave + 1; y < 32; y++) {
          fBuf.px(x, y, y < 14 ? mid : dark);
        }
      }
      const bx = ((6 + f * 7) % 24) + 4;
      const by = 24 - f * 4;
      fBuf.ellipse(bx, by, 2.5, 2.5, foam);
      fBuf.px(bx, by, hi);
      sheet.blit(fBuf, f * 32, 0);
    }
    map.set('acid', sheet.toCanvas());
  }

  // Lava (4 frames glowing molten gold-orange waves)
  {
    const sheet = new PixelCanvas(128, 32);
    const fBuf = new PixelCanvas(32, 32);
    const hot = hexToAbgr('#fffcd4');
    const gold = hexToAbgr('#ffd438');
    const orange = hexToAbgr('#ff6614');
    const crimson = hexToAbgr('#ba1c18');
    for (let f = 0; f < 4; f++) {
      fBuf.clear();
      for (let x = 0; x < 32; x++) {
        const wave = 3 + Math.round(Math.sin(((x + f * 8) / 32) * Math.PI * 2) * 2.0);
        fBuf.px(x, wave - 1, hot);
        fBuf.px(x, wave, hot);
        fBuf.px(x, wave + 1, gold);
        for (let y = wave + 2; y < 32; y++) {
          fBuf.px(x, y, y < 12 ? gold : y < 22 ? orange : crimson);
        }
      }
      const bx = ((10 + f * 6) % 24) + 4;
      const by = 20 - f * 3;
      fBuf.ellipse(bx, by, 3.2, 2, hot);
      sheet.blit(fBuf, f * 32, 0);
    }
    map.set('lava', sheet.toCanvas());
  }

  // Quicksand (2 frames smooth layered caramel-gold waves)
  {
    const sheet = new PixelCanvas(64, 32);
    const fBuf = new PixelCanvas(32, 32);
    const spec = hexToAbgr('#ffef99');
    const hi = hexToAbgr('#e8aa38');
    const mid = hexToAbgr('#bd7624');
    const dark = hexToAbgr('#8c4c18');
    for (let f = 0; f < 2; f++) {
      fBuf.clear();
      for (let y = 0; y < 32; y++) {
        for (let x = 0; x < 32; x++) {
          const sx = (x + f * 16) % 32;
          const wv = Math.sin((sx / 32) * Math.PI * 2) * 2.2;
          const band = (y + wv + 32) % 8;
          fBuf.px(x, y, y < 2 ? spec : band < 2.2 ? hi : band < 5.2 ? mid : dark);
        }
      }
      sheet.blit(fBuf, f * 32, 0);
    }
    map.set('quicksand', sheet.toCanvas());
  }

  // Crumble fragile sandstone platform
  {
    const b = new PixelCanvas(32, 32);
    const hi = hexToAbgr('#f2dfb8');
    const mid = hexToAbgr('#bd9666');
    const dark = hexToAbgr('#785233');
    b.roundedRect(2, 2, 28, 22, mid, 2);
    b.rect(3, 2, 26, 3, hi);
    b.rect(3, 21, 26, 3, dark);
    b.line(9, 2, 13, 12, cOut);
    b.line(13, 12, 10, 23, cOut);
    b.line(22, 3, 18, 15, cOut);
    b.line(18, 15, 24, 22, cOut);
    b.rect(7, 27, 3, 3, dark);
    b.rect(18, 28, 2, 2, mid);
    b.rect(24, 26, 3, 2, dark);
    b.selectiveOutline(cOut, 0.5, 0.88);
    map.set('crumble', b.toCanvas());
  }

  // Explosive bomb block (2 pulsing frames)
  {
    const sheet = new PixelCanvas(64, 32);
    const fBuf = new PixelCanvas(32, 32);
    const rHi = hexToAbgr('#ff7878');
    const rMid = hexToAbgr('#d91c38');
    const rDark = hexToAbgr('#7a0c24');
    const yel = hexToAbgr('#ffe640');
    for (let f = 0; f < 2; f++) {
      fBuf.clear();
      fBuf.roundedRect(2, 2, 28, 28, rMid, 3);
      fBuf.rect(4, 2, 24, 3, rHi);
      fBuf.rect(4, 27, 24, 3, rDark);
      fBuf.rect(2, 11, 28, 10, f === 0 ? yel : cWhite);
      fBuf.roundedRect(12, 12, 8, 8, rDark, 1);
      fBuf.px(16, 14, yel);
      fBuf.px(15, 16, yel);
      fBuf.px(17, 16, yel);
      fBuf.selectiveOutline(cOut, 0.55, 0.9);
      sheet.blit(fBuf, f * 32, 0);
    }
    map.set('explosive', sheet.toCanvas());
  }

  // Antigrav Field: Translucent rising cyan & indigo crystal diamond particles (ZERO blocky purple blobs!)
  {
    const sheet = new PixelCanvas(64, 32);
    const fBuf = new PixelCanvas(32, 32);
    const cBg = hexToAbgr('#3899ff', 28);
    const cCyan = hexToAbgr('#6ef5ff', 190);
    const cWht = hexToAbgr('#ffffff', 210);
    const cBlue = hexToAbgr('#5978ff', 150);
    const dots: readonly [number, number, number][] = [
      [6, 6, 3],
      [16, 18, 4],
      [25, 10, 3],
      [11, 26, 2],
      [22, 24, 2],
    ];
    for (let f = 0; f < 2; f++) {
      fBuf.clear();
      fBuf.fill(cBg);
      const oy = f === 0 ? 0 : -16;
      for (let i = 0; i < dots.length; i++) {
        const [dx, baseY, sz] = dots[i]!;
        const dy = ((baseY + oy) % 32 + 32) % 32;
        const col = i % 2 === 0 ? cCyan : cBlue;
        // Elongated crystal diamond mote + vertical shimmer tail
        for (let k = -sz; k <= sz; k++) {
          const hw = Math.max(0, (sz - Math.abs(k)) >> 1);
          for (let ox = -hw; ox <= hw; ox++) {
            fBuf.px(dx + ox, (dy + k + 32) % 32, k === 0 && ox === 0 ? cWht : col);
          }
        }
        fBuf.px(dx, (dy + sz + 2) % 32, col);
      }
      sheet.blit(fBuf, f * 32, 0);
    }
    map.set('antigrav', sheet.toCanvas());
  }

  // Wind streams (up / left / right, 4 frames — wispy curling pixel air ribbons!)
  const windHi = hexToAbgr('#e6ffff', 175);
  const windMid = hexToAbgr('#94e0ff', 110);
  for (const dir of ['wind_up', 'wind_left', 'wind_right'] as const) {
    const sheet = new PixelCanvas(128, 32);
    const fBuf = new PixelCanvas(32, 32);
    for (let f = 0; f < 4; f++) {
      fBuf.clear();
      const off = f * 8;
      if (dir === 'wind_up') {
        for (let s = 0; s < 3; s++) {
          const sx = 6 + s * 10;
          const sy = (32 - ((off + s * 11) % 32)) % 32;
          for (let k = 0; k < 12; k++) {
            const curve = Math.round(Math.sin((k / 12) * Math.PI) * 2);
            fBuf.px(sx + curve, (sy + k) % 32, k < 5 ? windHi : windMid);
          }
        }
      } else {
        const sign = dir === 'wind_right' ? 1 : -1;
        for (let s = 0; s < 3; s++) {
          const sy = 6 + s * 10;
          const sx = (32 + sign * ((off + s * 11) % 32)) % 32;
          for (let k = 0; k < 12; k++) {
            const curve = Math.round(Math.sin((k / 12) * Math.PI) * 1.5);
            fBuf.px((sx + k) % 32, sy + curve, k < 5 ? windHi : windMid);
          }
        }
      }
      sheet.blit(fBuf, f * 32, 0);
    }
    map.set(dir, sheet.toCanvas());
  }

  // Secret wall telltale shimmer crack overlay
  {
    const b = new PixelCanvas(32, 32);
    const crack = hexToAbgr('#ffe6ff', 165);
    b.line(12, 4, 16, 13, crack);
    b.line(16, 13, 13, 20, crack);
    b.line(13, 20, 19, 27, crack);
    map.set('secret_crack', b.toCanvas());
  }

  // Moving platform: Ice-crystal & gilded arcane floating slab (32x16)
  {
    const b = new PixelCanvas(32, 16);
    const hi = hexToAbgr('#d8ffff');
    const mid = hexToAbgr('#38b8ff');
    const dark = hexToAbgr('#1859b8');
    const under = hexToAbgr('#8f6bd9');
    b.roundedRect(1, 1, 30, 10, mid, 2);
    b.rect(2, 1, 28, 3, hi);
    b.rect(2, 8, 28, 3, dark);
    // Crystalline serrated underside
    b.tri(4, 11, 8, 15, 12, 11, under);
    b.tri(12, 11, 16, 15, 20, 11, hi);
    b.tri(20, 11, 24, 15, 28, 11, under);
    b.rect(7, 4, 3, 3, cWhite);
    b.rect(22, 4, 3, 3, cWhite);
    b.selectiveOutline(cOut, 0.5, 0.85);
    map.set('moving_platform', b.toCanvas());
  }

  // Crusher block (32x32 forged dark-iron block with glowing eyes & jagged underside teeth)
  {
    const b = new PixelCanvas(32, 32);
    const hi = hexToAbgr('#a8b4d4');
    const mid = hexToAbgr('#586280');
    const dark = hexToAbgr('#2e334a');
    const eye = hexToAbgr('#ff3858');
    b.roundedRect(2, 2, 28, 24, mid, 2);
    b.rect(3, 2, 26, 3, hi);
    b.rect(3, 23, 26, 3, dark);
    b.rect(8, 10, 5, 4, eye);
    b.px(9, 11, cWhite);
    b.rect(19, 10, 5, 4, eye);
    b.px(20, 11, cWhite);
    b.tri(4, 26, 8, 31, 12, 26, hi);
    b.tri(12, 26, 16, 31, 20, 26, hi);
    b.tri(20, 26, 24, 31, 28, 26, hi);
    b.selectiveOutline(cOut, 0.55, 0.9);
    map.set('crusher', b.toCanvas());
  }

  return map;
}

// ============================================================================
// 5. Hand-Crafted 16-Bit Interactive World Props & Form Totems
// ============================================================================

export function bakeWorldProps(): Map<string, HTMLCanvasElement> {
  const map = new Map<string, HTMLCanvasElement>();
  const cOut = hexToAbgr(OUTLINE_DARK);
  const cWhite = hexToAbgr(HIGHLIGHT_CREAM);

  // Volt Node (2 frames, 32x32)
  {
    const sheet = new PixelCanvas(64, 32);
    const fBuf = new PixelCanvas(32, 32);
    const vHi = hexToAbgr('#d4ffff');
    const vMid = hexToAbgr('#2be8ff');
    const vYel = hexToAbgr('#f5ff42');
    const metal = hexToAbgr('#4a5b78');
    for (let f = 0; f < 2; f++) {
      fBuf.clear();
      const rot = f === 0 ? 0 : 1;
      fBuf.ellipse(16, 16, 12, 12, vMid);
      fBuf.ellipse(16, 16, 10, 10, 0);
      fBuf.ellipseShaded(16, 16, 7.5, 7.5, vHi, vMid, metal, cWhite);
      fBuf.line(17, 11, 14, 16, vYel);
      fBuf.line(14, 16, 18, 16, vYel);
      fBuf.line(18, 16, 15, 21, vYel);
      fBuf.rect(15, 2 + rot, 2, 3, vYel);
      fBuf.rect(15, 27 - rot, 2, 3, vYel);
      fBuf.rect(2 + rot, 15, 3, 2, vYel);
      fBuf.rect(27 - rot, 15, 3, 2, vYel);
      fBuf.selectiveOutline(cOut, 0.5, 0.88);
      sheet.blit(fBuf, f * 32, 0);
    }
    map.set('volt_node', sheet.toCanvas());
  }

  // Ornate Treasure Chest (closed & open, 32x28)
  {
    const crimsonHi = hexToAbgr('#ff6670');
    const crimsonMid = hexToAbgr('#c72838');
    const slate = hexToAbgr('#58638a');
    const goldHi = hexToAbgr('#fff494');
    const goldMid = hexToAbgr('#ebba24');
    const goldDark = hexToAbgr('#8f5c14');
    const ruby = hexToAbgr('#ff2e98');

    const closed = new PixelCanvas(32, 28);
    closed.roundedRect(3, 7, 26, 19, slate, 2);
    closed.roundedRect(4, 6, 24, 10, crimsonMid, 2);
    closed.rect(5, 7, 22, 3, crimsonHi);
    closed.rect(3, 15, 26, 3, goldMid);
    closed.rect(3, 15, 26, 1, goldHi);
    closed.rect(6, 6, 3, 20, goldMid);
    closed.rect(23, 6, 3, 20, goldMid);
    closed.rect(6, 24, 20, 2, goldDark);
    closed.roundedRect(12, 11, 8, 9, goldHi, 1);
    closed.rect(14, 13, 4, 5, cOut);
    closed.rect(15, 13, 2, 2, ruby);
    closed.selectiveOutline(cOut, 0.5, 0.9);
    map.set('chest_closed', closed.toCanvas());

    const open = new PixelCanvas(32, 28);
    open.roundedRect(3, 14, 26, 12, slate, 2);
    open.rect(4, 3, 24, 10, crimsonMid);
    open.rect(5, 4, 22, 3, crimsonHi);
    open.rect(4, 12, 24, 3, goldMid);
    open.rect(6, 14, 3, 12, goldMid);
    open.rect(23, 14, 3, 12, goldMid);
    open.rect(12, 14, 8, 5, goldHi);
    open.selectiveOutline(cOut, 0.5, 0.9);
    map.set('chest_open', open.toCanvas());
  }

  // Teleporter Gate: Carved Ancient Stone Obelisk with Glowing Crimson-Magenta Portal Core (2 frames, 40x48)
  {
    const sheet = new PixelCanvas(80, 48);
    const fBuf = new PixelCanvas(40, 48);
    const stHi = hexToAbgr('#e0cfe6');
    const stMid = hexToAbgr('#9c88a8');
    const stDark = hexToAbgr('#58486b');
    const pCore = hexToAbgr('#ff3878');
    const pGlow = hexToAbgr('#ff94c8');
    const pCyan = hexToAbgr('#78f5ff');
    for (let f = 0; f < 2; f++) {
      fBuf.clear();
      // Tiered carved pedestal & pointed obelisk crown
      fBuf.roundedRect(5, 40, 30, 7, stDark, 1);
      fBuf.rect(6, 40, 28, 2, stHi);
      fBuf.roundedRect(8, 12, 24, 29, stMid, 3);
      fBuf.tri(12, 13, 20, 3, 28, 13, stHi);
      fBuf.tri(16, 13, 20, 5, 27, 13, stMid);
      // Stone masonry joints
      fBuf.rect(9, 18, 22, 1, stDark);
      fBuf.rect(9, 28, 22, 1, stDark);
      fBuf.rect(9, 13, 2, 27, stHi);
      fBuf.rect(29, 13, 2, 27, stDark);
      // Recessed glowing keyhole portal vortex
      fBuf.roundedRect(14, 19, 12, 18, hexToAbgr('#260a2e'), 3);
      fBuf.ellipse(20, 25, 5, 5, f === 0 ? pCore : pCyan);
      fBuf.tri(15, 36, 20, 25, 25, 36, f === 0 ? pCore : pGlow);
      fBuf.ellipse(20, 25, 2.5, 2.5, cWhite);
      fBuf.selectiveOutline(cOut, 0.5, 0.88);
      sheet.blit(fBuf, f * 40, 0);
    }
    map.set('teleporter', sheet.toCanvas());
  }

  // Save Shrine: Ancient Mossy Carved Stone Totem with Glowing Spirit Flame (2 frames, 32x40)
  {
    const sheet = new PixelCanvas(64, 40);
    const fBuf = new PixelCanvas(32, 40);
    const stHi = hexToAbgr('#d8c8de');
    const stMid = hexToAbgr('#9484a6');
    const stDark = hexToAbgr('#544466');
    const flameHi = hexToAbgr('#b8ff9e');
    const flameMid = hexToAbgr('#38e878');
    for (let f = 0; f < 2; f++) {
      fBuf.clear();
      // Carved smiling stone shrine block
      fBuf.roundedRect(5, 32, 22, 7, stDark, 1);
      fBuf.roundedRect(7, 15, 18, 18, stMid, 2);
      fBuf.rect(8, 15, 16, 3, stHi);
      fBuf.rect(8, 15, 2, 17, stHi);
      fBuf.rect(23, 16, 2, 16, stDark);
      // Carved eyes on shrine stone
      fBuf.rect(11, 21, 3, 3, stDark);
      fBuf.rect(18, 21, 3, 3, stDark);
      fBuf.rect(12, 27, 8, 2, stDark);
      // Dancing emerald-gold spirit flame floating beside/above shrine
      const oy = f === 0 ? 0 : -2;
      fBuf.tri(11, 14 + oy, 16, 3 + oy, 21, 14 + oy, flameMid);
      fBuf.tri(13, 13 + oy, 16, 6 + oy, 19, 13 + oy, flameHi);
      fBuf.px(16, 10 + oy, cWhite);
      fBuf.selectiveOutline(cOut, 0.5, 0.88);
      sheet.blit(fBuf, f * 32, 0);
    }
    map.set('save_shrine', sheet.toCanvas());
  }

  // Signpost: Weathered Carved Wooden Signboard (24x28)
  {
    const b = new PixelCanvas(24, 28);
    const wHi = hexToAbgr('#d4a370');
    const wMid = hexToAbgr('#9e6b42');
    const wDark = hexToAbgr('#5e3922');
    b.rect(10, 14, 4, 13, wDark);
    b.rect(11, 14, 2, 13, wMid);
    b.roundedRect(2, 4, 20, 12, wMid, 1);
    b.rect(3, 4, 18, 2, wHi);
    b.rect(3, 14, 18, 2, wDark);
    // Carved pixel arrow & face icons on wooden board
    b.rect(5, 8, 5, 2, wDark);
    b.px(7, 7, wDark);
    b.rect(13, 7, 5, 5, wDark);
    b.px(14, 8, wMid);
    b.px(16, 8, wMid);
    b.selectiveOutline(cOut, 0.5, 0.88);
    map.set('signpost', b.toCanvas());
  }

  // Animal House: Cozy Domed Stone-and-Timber Storybook Village Cottage (48x44)
  {
    const b = new PixelCanvas(48, 44);
    const stSpec = hexToAbgr('#e6dfd5');
    const stHi = hexToAbgr('#c2b8aa');
    const stMid = hexToAbgr('#8c8278');
    const stDark = hexToAbgr('#544c47');
    const woodHi = hexToAbgr('#a87246');
    const woodMid = hexToAbgr('#6e4228');
    const woodDark = hexToAbgr('#3d2218');
    const win = hexToAbgr('#ffe678');

    // Stone chimney on right shoulder
    b.rect(36, 12, 5, 10, stMid);
    b.rect(35, 11, 7, 2, stHi);

    // Upper stone lookout cupola dome
    b.roundedRect(14, 5, 20, 11, stMid, 4);
    b.rect(16, 6, 16, 3, stHi);
    b.roundedRect(21, 9, 6, 5, woodDark, 2);
    b.rect(22, 10, 4, 3, win);

    // Main curved stone cottage hall with individual carved courses!
    b.roundedRect(6, 15, 36, 27, stMid, 5);
    for (let y = 16; y < 41; y++) {
      const ly = (y - 16) % 5;
      const shift = ((y - 16) / 5 | 0) & 1 ? 4 : 0;
      for (let x = 7; x < 41; x++) {
        if (b.get(x, y) === 0) continue;
        const bx = (x + shift) % 8;
        if (ly === 0 || bx === 0) b.px(x, y, stDark);
        else if (ly === 1 && x < 24) b.px(x, y, stSpec);
        else if (ly === 1) b.px(x, y, stHi);
        else if (x > 34) b.px(x, y, stDark);
      }
    }
    // Horizontal stone cornice trim & plinth base
    b.rect(5, 16, 38, 2, stSpec);
    b.rect(5, 18, 38, 1, stDark);
    b.rect(4, 39, 40, 3, stDark);
    b.rect(5, 39, 38, 1, stHi);

    // Arched carved wooden front door
    b.roundedRect(19, 25, 10, 16, woodDark, 3);
    b.roundedRect(20, 26, 8, 15, woodMid, 2);
    b.rect(21, 27, 2, 13, woodHi);
    b.px(26, 33, win);

    // Side glowing paned windows
    b.rect(10, 26, 5, 6, woodDark);
    b.rect(11, 27, 3, 4, win);
    b.rect(33, 26, 5, 6, woodDark);
    b.rect(34, 27, 3, 4, win);

    b.selectiveOutline(cOut, 0.5, 0.88);
    map.set('animal_house', b.toCanvas());
  }

  // Target Switch (2 frames, 24x24)
  {
    const sheet = new PixelCanvas(48, 24);
    const fBuf = new PixelCanvas(24, 24);
    for (let f = 0; f < 2; f++) {
      fBuf.clear();
      fBuf.ellipseShaded(
        12,
        12,
        9,
        9,
        hexToAbgr(f === 0 ? '#ff6b85' : '#80ff88'),
        hexToAbgr(f === 0 ? '#cc1f3d' : '#2db84c'),
        hexToAbgr('#4a1428'),
      );
      fBuf.ellipse(12, 12, 4, 4, cWhite);
      fBuf.ellipse(12, 12, 2, 2, hexToAbgr(f === 0 ? '#ff3355' : '#26e659'));
      fBuf.selectiveOutline(cOut, 0.5, 0.9);
      sheet.blit(fBuf, f * 24, 0);
    }
    map.set('target_switch', sheet.toCanvas());
  }

  // Locked Target Door & Coin Door (32x64)
  for (const kind of ['door_locked', 'coin_door'] as const) {
    const b = new PixelCanvas(32, 64);
    const metal = hexToAbgr(kind === 'coin_door' ? '#bd8024' : '#585c78');
    const hi = hexToAbgr(kind === 'coin_door' ? '#ffe059' : '#9ca6cf');
    const dark = hexToAbgr(kind === 'coin_door' ? '#6e3f0e' : '#2e3047');
    b.roundedRect(3, 2, 26, 60, metal, 2);
    b.rect(4, 2, 24, 4, hi);
    b.rect(4, 58, 24, 4, dark);
    b.rect(7, 8, 18, 48, dark);
    b.rect(9, 10, 14, 44, metal);
    b.ellipseShaded(16, 32, 6, 6, hi, metal, dark, cWhite);
    b.ellipse(16, 32, 2.5, 2.5, dark);
    b.selectiveOutline(cOut, 0.5, 0.9);
    map.set(kind, b.toCanvas());
  }

  // Form Totems (all 6 forms, 36x44)
  for (let i = 0; i < HERO_FORMS.length; i++) {
    const form = HERO_FORMS[i]!;
    const pal = HERO_FORM_PALETTES[form];
    const b = new PixelCanvas(36, 44);
    const stHi = hexToAbgr('#c8c0e6');
    const stMid = hexToAbgr('#787099');
    const stDark = hexToAbgr('#423a5e');
    b.roundedRect(6, 36, 24, 6, stDark, 1);
    b.roundedRect(9, 20, 18, 17, stMid, 2);
    b.rect(10, 20, 16, 3, stHi);
    b.ellipseShaded(18, 12, 9, 9, hexToAbgr(pal[4]), hexToAbgr(pal[0]), hexToAbgr(pal[2]), cWhite);
    b.selectiveOutline(cOut, 0.5, 0.88);
    map.set(`totem_${form}`, b.toCanvas());
  }

  return map;
}

// ============================================================================
// 6. Expressive 16-Bit Animated Hub Guardians (2-Frame 36x40 Sheets)
// ============================================================================

export function bakeHubNpcs(): Map<ShopId, HTMLCanvasElement> {
  const map = new Map<ShopId, HTMLCanvasElement>();
  const cOut = hexToAbgr(OUTLINE_DARK);
  const cWhite = hexToAbgr(HIGHLIGHT_CREAM);

  const npcSpecs: ReadonlyArray<{
    id: ShopId;
    cloakHi: string;
    cloakMid: string;
    cloakDark: string;
    skin: string;
    skinSh: string;
    accent: string;
    hat: 'hood' | 'sage' | 'goggles' | 'helm' | 'tricorn' | 'tome';
  }> = [
    {
      id: 'vespera',
      cloakHi: '#ff6678',
      cloakMid: '#cc2b47',
      cloakDark: '#6e142c',
      skin: '#ffe0cc',
      skinSh: '#d49a7c',
      accent: '#78e8ff',
      hat: 'hood',
    },
    {
      id: 'orla',
      cloakHi: '#6eff94',
      cloakMid: '#24a85c',
      cloakDark: '#125438',
      skin: '#ffe6c4',
      skinSh: '#cfa078',
      accent: '#ffe059',
      hat: 'sage',
    },
    {
      id: 'barnaby',
      cloakHi: '#ffb859',
      cloakMid: '#cc7224',
      cloakDark: '#733512',
      skin: '#ffd8bc',
      skinSh: '#c98e6e',
      accent: '#59f2ff',
      hat: 'goggles',
    },
    {
      id: 'garron',
      cloakHi: '#ff5c70',
      cloakMid: '#bd1e38',
      cloakDark: '#690d22',
      skin: '#ecc0a0',
      skinSh: '#b88264',
      accent: '#ffe059',
      hat: 'helm',
    },
    {
      id: 'barnacle',
      cloakHi: '#6effd6',
      cloakMid: '#24ab94',
      cloakDark: '#12545c',
      skin: '#a6ffec',
      skinSh: '#59bfa8',
      accent: '#ffe059',
      hat: 'tricorn',
    },
    {
      id: 'codex',
      cloakHi: '#ffe470',
      cloakMid: '#d9981f',
      cloakDark: '#7d440c',
      skin: '#fff7db',
      skinSh: '#d9c496',
      accent: '#59f2ff',
      hat: 'tome',
    },
  ];

  for (let i = 0; i < npcSpecs.length; i++) {
    const spec = npcSpecs[i]!;
    const sheet = new PixelCanvas(72, 40);
    const b = new PixelCanvas(36, 40);
    const hi = hexToAbgr(spec.cloakHi);
    const mid = hexToAbgr(spec.cloakMid);
    const dark = hexToAbgr(spec.cloakDark);
    const skin = hexToAbgr(spec.skin);
    const skinSh = hexToAbgr(spec.skinSh);
    const acc = hexToAbgr(spec.accent);

    for (let f = 0; f < 2; f++) {
      b.clear();
      const bob = f === 1 ? 1 : 0;

      if (spec.hat === 'tome') {
        const hover = f === 0 ? 0 : -2;
        b.roundedRect(7, 11 + hover, 22, 22, dark, 2);
        b.roundedRect(8, 12 + hover, 20, 20, mid, 2);
        b.rect(10, 14 + hover, 16, 16, skin);
        b.rect(8, 12 + hover, 4, 20, dark);
        b.rect(9, 12 + hover, 18, 2, hi);
        b.rect(25, 20 + hover, 3, 4, hi);
        b.rect(13, 18 + hover, 3, 5, acc);
        b.rect(20, 18 + hover, 3, 5, acc);
        b.px(14, 19 + hover, cWhite);
        b.px(21, 19 + hover, cWhite);
        b.tri(18, 32 + hover, 14 + f, 38, 22 + f, 36, hexToAbgr('#ff3868'));
      } else {
        // Plump storybook RPG guardian silhouette with layered cloak, sash & bright expressive eyes
        b.roundedRect(11, 35, 6, 3, dark, 1);
        b.roundedRect(19, 35, 6, 3, dark, 1);
        b.roundedRect(9, 21 + bob, 18, 14, mid, 3);
        b.rect(10, 22 + bob, 6, 12, hi);
        b.rect(22, 22 + bob, 4, 12, dark);
        b.rect(9, 28 + bob, 18, 2, acc);
        b.rect(16, 28 + bob, 4, 3, hi);
        b.roundedRect(6, 23 + bob, 4, 8, hi, 1);
        b.roundedRect(26, 23 + bob, 4, 8, mid, 1);
        b.ellipseShaded(18, 15 + bob, 7.6, 7.0, cWhite, skin, skinSh);
        b.rect(13, 14 + bob, 3, 4, cWhite);
        b.rect(20, 14 + bob, 3, 4, cWhite);
        b.rect(14, 15 + bob, 2, 3, cOut);
        b.rect(21, 15 + bob, 2, 3, cOut);
        b.px(14, 15 + bob, cWhite);
        b.px(21, 15 + bob, cWhite);
        b.px(12, 18 + bob, hexToAbgr('#ff8599'));
        b.px(23, 18 + bob, hexToAbgr('#ff8599'));

        if (spec.hat === 'hood') {
          // Friendly mystic scholar hood + open glowing spellbook in hand
          b.tri(8, 14 + bob, 18, 2 + bob, 28, 14 + bob, dark);
          b.tri(10, 13 + bob, 18, 4 + bob, 25, 13 + bob, mid);
          b.line(12, 12 + bob, 18, 5 + bob, hi);
          b.rect(9, 13 + bob, 18, 2, acc);
          // Open luminous tome in right hand
          b.rect(25, 25 + bob, 9, 6, hexToAbgr('#d9b8ff'));
          b.rect(26, 26 + bob, 7, 4, cWhite);
          b.rect(29, 25 + bob, 1, 6, dark);
        } else if (spec.hat === 'sage') {
          b.rect(6, 11 + bob, 24, 3, dark);
          b.tri(10, 11 + bob, 18, 3 + bob, 26, 11 + bob, mid);
          b.rect(11, 10 + bob, 14, 2, acc);
          b.ellipseShaded(29, 20 + bob, 4, 4, cWhite, acc, dark);
        } else if (spec.hat === 'goggles') {
          b.roundedRect(3, 18 + bob, 8, 14, dark, 2);
          b.rect(4, 19 + bob, 6, 10, hi);
          b.rect(4, 24 + bob, 6, 2, acc);
          b.rect(11, 9 + bob, 14, 5, dark);
          b.rect(12, 10 + bob, 5, 3, acc);
          b.rect(19, 10 + bob, 5, 3, acc);
          b.px(13, 10 + bob, cWhite);
          b.px(20, 10 + bob, cWhite);
        } else if (spec.hat === 'helm') {
          b.rect(11, 7 + bob, 14, 7, mid);
          b.rect(12, 8 + bob, 12, 2, hi);
          b.tri(11, 10 + bob, 5, 3 + bob, 13, 8 + bob, acc);
          b.tri(25, 10 + bob, 31, 3 + bob, 23, 8 + bob, acc);
          b.rect(28, 10, 3, 27, dark);
          b.tri(27, 9, 35, 14, 27, 20, hi);
        } else if (spec.hat === 'tricorn') {
          b.tri(5, 12 + bob, 18, 4 + bob, 31, 12 + bob, dark);
          b.rect(8, 10 + bob, 20, 3, mid);
          b.rect(16, 7 + bob, 4, 3, acc);
          b.tri(12, 20 + bob, 18, 29 + bob, 24, 20 + bob, hi);
        }
      }

      b.selectiveOutline(cOut, 0.5, 0.88);
      sheet.blit(b, f * 36, 0);
    }
    map.set(spec.id, sheet.toCanvas());
  }

  return map;
}

// ============================================================================
// Lazy Headless-Safe World Art Cache (Zero Per-Frame Allocations)
// ============================================================================

let cachedWorldArt: BuiltInWorldArt | null = null;

export function getBuiltInWorldArt(): BuiltInWorldArt | null {
  if (typeof document === 'undefined') return null;
  if (cachedWorldArt) return cachedWorldArt;

  const biomeTilesets = new Map<BiomeId, HTMLCanvasElement>();
  const biomeInnerCorners = new Map<BiomeId, HTMLCanvasElement>();
  const biomeDeco = new Map<BiomeId, HTMLCanvasElement>();
  const biomeParallax = new Map<BiomeId, BiomeParallaxSet>();

  for (let i = 0; i < BIOME_IDS.length; i++) {
    const id = BIOME_IDS[i]!;
    const pal = BIOME_PALETTES[id];
    biomeTilesets.set(id, bakeBiomeTileset(pal));
    biomeInnerCorners.set(id, bakeBiomeInnerCorners(pal));
    biomeDeco.set(id, bakeBiomeDeco(pal));
    biomeParallax.set(id, bakeBiomeParallax(pal));
  }

  cachedWorldArt = {
    biomeTilesets,
    biomeInnerCorners,
    biomeDeco,
    biomeParallax,
    specialTiles: bakeSpecialTiles(),
    props: bakeWorldProps(),
    npcs: bakeHubNpcs(),
  };

  return cachedWorldArt;
}
