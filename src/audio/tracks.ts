/**
 * Procedural 16-bit Chiptune Track Definitions
 * Pure data + frequency utilities (DOM-free, zero external dependencies).
 * Every BiomeId and special gameplay context has a complete 64-step (4-bar) loop.
 */

import type { BiomeId } from '../contracts/index';

export type MusicContextId =
  | BiomeId
  | 'TITLE'
  | 'BOSS'
  | 'MINIBOSS'
  | 'SHADOW_DUEL'
  | 'FINAL_BOSS'
  | 'VICTORY';

/**
 * Step value in a melodic/harmonic lane:
 * - positive integer: MIDI note number (60 = C4)
 * - 0: sustain/hold previous note
 * - null: rest
 */
export type StepNote = number | null;

/**
 * Percussion hit token per 16th-note step:
 * '.' rest | 'K' kick | 'S' snare | 'H' closed hat | 'O' open hat
 * 'T' low tom | 'M' mid/high tom | 'C' crash | 'P' rim/wood | 'B' kick+hat | 'X' kick+snare
 */
export type DrumHit = '.' | 'K' | 'S' | 'H' | 'O' | 'T' | 'M' | 'C' | 'P' | 'B' | 'X';

export interface TrackChannelConfig {
  readonly wave: OscillatorType;
  readonly volume: number;
  readonly filterHz: number;
  readonly attackSec: number;
  readonly releaseSec: number;
  readonly gateRatio: number;
  readonly detuneCents?: number;
  readonly vibratoHz?: number;
  readonly vibratoCents?: number;
  readonly pan?: number;
}

export interface TrackDef {
  readonly id: MusicContextId;
  readonly title: string;
  readonly bpm: number;
  readonly swing: number; // 0..0.25 subtle 16th swing
  readonly fadeInSec: number;
  readonly leadConfig: TrackChannelConfig;
  readonly bassConfig: TrackChannelConfig;
  readonly arpConfig: TrackChannelConfig;
  readonly drumVolume: number;
  readonly lead: readonly StepNote[];
  readonly bass: readonly StepNote[];
  readonly arp: readonly StepNote[];
  readonly drums: readonly DrumHit[];
}

export function midiToFreq(midi: number): number {
  return 440 * Math.pow(2, (midi - 69) / 12);
}

// Rest & Hold markers for readable 64-step compositions
const R: StepNote = null;
const H: StepNote = 0;

// MIDI Note Reference Table (C2..C7)
const N = {
  C2: 36, Cs2: 37, D2: 38, Ds2: 39, E2: 40, F2: 41, Fs2: 42, G2: 43, Gs2: 44, A2: 45, As2: 46, B2: 47,
  C3: 48, Cs3: 49, D3: 50, Ds3: 51, E3: 52, F3: 53, Fs3: 54, G3: 55, Gs3: 56, A3: 57, As3: 58, B3: 59,
  C4: 60, Cs4: 61, D4: 62, Ds4: 63, E4: 64, F4: 65, Fs4: 66, G4: 67, Gs4: 68, A4: 69, As4: 70, B4: 71,
  C5: 72, Cs5: 73, D5: 74, Ds5: 75, E5: 76, F5: 77, Fs5: 78, G5: 79, Gs5: 80, A5: 81, As5: 82, B5: 83,
  C6: 84, Cs6: 85, D6: 86, Ds6: 87, E6: 88, F6: 89, Fs6: 90, G6: 91, A6: 93,
} as const;

function parseDrums(pattern: string): readonly DrumHit[] {
  const tokens: DrumHit[] = [];
  for (let i = 0; i < pattern.length; i++) {
    const ch = pattern[i];
    if (ch === ' ' || ch === '|' || ch === '\n' || ch === '\r' || ch === '\t') {
      continue;
    }
    tokens.push(ch as DrumHit);
  }
  return tokens;
}

/**
 * Build a 16-step split-chord bar: first 8 steps cycle chord A, last 8 steps cycle chord B.
 */
function splitBar(a: readonly StepNote[], b: readonly StepNote[]): readonly StepNote[] {
  const out: StepNote[] = [];
  for (let i = 0; i < 8; i++) out.push(a[i % a.length] ?? R);
  for (let i = 0; i < 8; i++) out.push(b[i % b.length] ?? R);
  return out;
}

/**
 * Expand four 16-step bar chord arpeggios into a 64-step sequence cleanly.
 */
function buildArpBars(bars: readonly [readonly StepNote[], readonly StepNote[], readonly StepNote[], readonly StepNote[]]): readonly StepNote[] {
  const out: StepNote[] = [];
  for (const bar of bars) {
    for (let i = 0; i < 16; i++) {
      out.push(bar[i % bar.length] ?? R);
    }
  }
  return out;
}

/**
 * Build a driving 4-bar octave bassline from 4 bar root notes and a 16-step octave/fifth mask.
 * Mask values: 0 = rest, 1 = root, 2 = root+12, 3 = root+7, 4 = root-5, -1 = hold
 */
function buildBassPattern(
  roots: readonly [number, number, number, number],
  mask: readonly number[],
): readonly StepNote[] {
  const out: StepNote[] = [];
  for (let b = 0; b < 4; b++) {
    const root = roots[b];
    for (let s = 0; s < 16; s++) {
      const m = mask[s % mask.length];
      if (m === 0) out.push(R);
      else if (m === -1) out.push(H);
      else if (m === 1) out.push(root);
      else if (m === 2) out.push(root + 12);
      else if (m === 3) out.push(root + 7);
      else if (m === 4) out.push(root - 5);
      else out.push(root + m);
    }
  }
  return out;
}

export const MUSIC_TRACKS: Readonly<Record<MusicContextId, TrackDef>> = {
  // --------------------------------------------------------------------------
  // TITLE — Heroic Shimmering Overture (D Major, 128 BPM)
  // --------------------------------------------------------------------------
  TITLE: {
    id: 'TITLE',
    title: 'Overture of the Shattered Realm',
    bpm: 128,
    swing: 0.0,
    fadeInSec: 0.35,
    leadConfig: {
      wave: 'square',
      volume: 0.13,
      filterHz: 3400,
      attackSec: 0.008,
      releaseSec: 0.08,
      gateRatio: 0.86,
      vibratoHz: 5.5,
      vibratoCents: 10,
      pan: -0.06,
    },
    bassConfig: {
      wave: 'triangle',
      volume: 0.2,
      filterHz: 900,
      attackSec: 0.006,
      releaseSec: 0.06,
      gateRatio: 0.82,
    },
    arpConfig: {
      wave: 'square',
      volume: 0.065,
      filterHz: 2600,
      attackSec: 0.005,
      releaseSec: 0.04,
      gateRatio: 0.65,
      pan: 0.16,
    },
    drumVolume: 0.14,
    lead: [
      // Bar 1 (D)
      N.D5, H, N.Fs5, H, N.A5, H, H, N.G5, N.Fs5, H, N.E5, H, N.D5, H, N.A4, H,
      // Bar 2 (Bm)
      N.B4, H, N.D5, H, N.Fs5, H, H, N.E5, N.D5, H, N.Cs5, H, N.B4, H, R, R,
      // Bar 3 (G)
      N.G4, H, N.B4, H, N.D5, H, N.G5, H, N.Fs5, H, N.E5, H, N.D5, H, N.B4, H,
      // Bar 4 (A -> D lift)
      N.A4, H, N.Cs5, H, N.E5, H, N.A5, H, N.G5, H, N.Fs5, H, N.E5, H, H, R,
    ],
    bass: buildBassPattern([N.D3, N.B2, N.G2, N.A2], [1, 0, 2, 0, 1, 0, 3, 0, 1, 0, 2, 0, 3, 0, 2, 0]),
    arp: buildArpBars([
      [N.D4, N.Fs4, N.A4, N.D5],
      [N.B3, N.D4, N.Fs4, N.B4],
      [N.G3, N.B3, N.D4, N.G4],
      [N.A3, N.Cs4, N.E4, N.A4],
    ]),
    drums: parseDrums(
      'B.H.S.H.B.H.S.H. | B.H.S.H.B.B.S.O. | B.H.S.H.B.H.S.H. | B.H.S.H.B.T.M.S.',
    ),
  },

  // --------------------------------------------------------------------------
  // MLAIR — Subterranean Lair (D Minor / Phrygian Echo, 108 BPM)
  // --------------------------------------------------------------------------
  MLAIR: {
    id: 'MLAIR',
    title: 'Subterranean Lair',
    bpm: 108,
    swing: 0.04,
    fadeInSec: 0.4,
    leadConfig: {
      wave: 'triangle',
      volume: 0.16,
      filterHz: 2200,
      attackSec: 0.012,
      releaseSec: 0.12,
      gateRatio: 0.85,
      vibratoHz: 4.5,
      vibratoCents: 8,
      pan: -0.08,
    },
    bassConfig: {
      wave: 'sawtooth',
      volume: 0.14,
      filterHz: 620,
      attackSec: 0.01,
      releaseSec: 0.09,
      gateRatio: 0.78,
    },
    arpConfig: {
      wave: 'sine',
      volume: 0.075,
      filterHz: 2000,
      attackSec: 0.01,
      releaseSec: 0.08,
      gateRatio: 0.6,
      pan: 0.2,
    },
    drumVolume: 0.11,
    lead: [
      // Bar 1 (Dm)
      N.D5, H, H, N.F5, N.E5, H, N.D5, H, N.A4, H, H, R, N.C5, H, N.D5, H,
      // Bar 2 (Bb)
      N.As4, H, H, N.D5, N.C5, H, N.As4, H, N.F4, H, H, R, N.G4, H, N.A4, H,
      // Bar 3 (Gm)
      N.G4, H, N.As4, H, N.D5, H, N.C5, H, N.As4, H, N.A4, H, N.G4, H, R, R,
      // Bar 4 (A7/Dm)
      N.A4, H, N.Cs5, H, N.E5, H, N.F5, H, N.E5, H, N.Cs5, H, N.A4, H, R, R,
    ],
    bass: buildBassPattern([N.D2, N.As2, N.G2, N.A2], [1, -1, 0, 1, 0, 3, 1, 0, 1, -1, 0, 2, 0, 3, 1, 0]),
    arp: buildArpBars([
      [N.D4, R, N.F4, R, N.A4, R, N.F4, R],
      [N.As3, R, N.D4, R, N.F4, R, N.D4, R],
      [N.G3, R, N.As3, R, N.D4, R, N.As3, R],
      [N.A3, R, N.Cs4, R, N.E4, R, N.G4, R],
    ]),
    drums: parseDrums(
      'K...P.H.K..T..H. | K...P.H.K.T.M.H. | K...P.H.K..T..H. | K..TP.H.K.T.P.O.',
    ),
  },

  // --------------------------------------------------------------------------
  // OPOUSO — Warm Village Hub (G Major Cozy Town, 114 BPM)
  // --------------------------------------------------------------------------
  OPOUSO: {
    id: 'OPOUSO',
    title: 'Lanterns of Opouso',
    bpm: 114,
    swing: 0.08,
    fadeInSec: 0.45,
    leadConfig: {
      wave: 'triangle',
      volume: 0.17,
      filterHz: 2800,
      attackSec: 0.01,
      releaseSec: 0.1,
      gateRatio: 0.82,
      vibratoHz: 5.0,
      vibratoCents: 6,
      pan: -0.05,
    },
    bassConfig: {
      wave: 'triangle',
      volume: 0.2,
      filterHz: 850,
      attackSec: 0.008,
      releaseSec: 0.07,
      gateRatio: 0.75,
    },
    arpConfig: {
      wave: 'sine',
      volume: 0.085,
      filterHz: 3000,
      attackSec: 0.006,
      releaseSec: 0.09,
      gateRatio: 0.7,
      pan: 0.18,
    },
    drumVolume: 0.09,
    lead: [
      // Bar 1 (G)
      N.B4, H, N.D5, H, N.G5, H, N.Fs5, H, N.E5, H, N.D5, H, N.B4, H, R, R,
      // Bar 2 (C)
      N.C5, H, N.E5, H, N.G5, H, N.E5, H, N.D5, H, N.C5, H, N.B4, H, N.A4, H,
      // Bar 3 (Em -> Am)
      N.G4, H, N.B4, H, N.E5, H, N.D5, H, N.C5, H, N.B4, H, N.A4, H, N.C5, H,
      // Bar 4 (D7 -> G)
      N.B4, H, N.A4, H, N.G4, H, N.A4, H, N.D5, H, H, R, N.Fs4, H, N.A4, H,
    ],
    bass: buildBassPattern([N.G2, N.C3, N.E2, N.D2], [1, 0, 0, 3, 1, 0, 2, 0, 1, 0, 0, 3, 2, 0, 3, 0]),
    arp: buildArpBars([
      [N.G4, R, N.B4, N.D5, N.G4, R, N.D5, N.B4],
      [N.C4, R, N.E4, N.G4, N.C4, R, N.G4, N.E4],
      splitBar([N.E4, R, N.G4, N.B4], [N.A3, R, N.C4, N.E4]),
      [N.D4, R, N.Fs4, N.A4, N.D4, R, N.A4, N.Fs4],
    ]),
    drums: parseDrums(
      'K...P..HK...P.H. | K...P..HK..KP.H. | K...P..HK...P.H. | K...P..HK.P.T.P.',
    ),
  },

  // --------------------------------------------------------------------------
  // TDM — Adventurous Heroic Trail (C Major Action Groove, 138 BPM)
  // --------------------------------------------------------------------------
  TDM: {
    id: 'TDM',
    title: 'Trail of the Sunlit Ridge',
    bpm: 138,
    swing: 0.0,
    fadeInSec: 0.3,
    leadConfig: {
      wave: 'square',
      volume: 0.135,
      filterHz: 3600,
      attackSec: 0.005,
      releaseSec: 0.06,
      gateRatio: 0.84,
      vibratoHz: 6.0,
      vibratoCents: 9,
      pan: -0.05,
    },
    bassConfig: {
      wave: 'triangle',
      volume: 0.21,
      filterHz: 950,
      attackSec: 0.004,
      releaseSec: 0.05,
      gateRatio: 0.8,
    },
    arpConfig: {
      wave: 'square',
      volume: 0.065,
      filterHz: 2500,
      attackSec: 0.004,
      releaseSec: 0.035,
      gateRatio: 0.62,
      pan: 0.16,
    },
    drumVolume: 0.15,
    lead: [
      // Bar 1 (C)
      N.E5, H, N.G5, N.A5, N.G5, H, N.E5, H, N.C5, H, N.D5, N.E5, N.G5, H, R, R,
      // Bar 2 (G)
      N.D5, H, N.G5, N.A5, N.B5, H, N.A5, H, N.G5, H, N.E5, H, N.D5, H, R, R,
      // Bar 3 (Am -> F)
      N.C5, H, N.E5, N.G5, N.A5, H, N.G5, H, N.F5, H, N.E5, N.D5, N.C5, H, N.A4, H,
      // Bar 4 (G -> turnaround)
      N.B4, H, N.D5, H, N.G5, H, N.F5, N.E5, N.D5, H, N.E5, N.D5, N.B4, H, R, R,
    ],
    bass: buildBassPattern([N.C3, N.G2, N.A2, N.G2], [1, 0, 2, 1, 0, 3, 2, 0, 1, 0, 2, 1, 3, 0, 2, 0]),
    arp: buildArpBars([
      [N.C4, N.E4, N.G4, N.C5],
      [N.G3, N.B3, N.D4, N.G4],
      splitBar([N.A3, N.C4, N.E4, N.A4], [N.F3, N.A3, N.C4, N.F4]),
      [N.G3, N.B3, N.D4, N.F4],
    ]),
    drums: parseDrums(
      'B.H.S.H.B.B.S.H. | B.H.S.H.B.H.S.O. | B.H.S.H.B.B.S.H. | B.H.S.B.S.M.T.S.',
    ),
  },

  // --------------------------------------------------------------------------
  // FLIN — Mysterious Forest Groove (E Dorian, 122 BPM)
  // --------------------------------------------------------------------------
  FLIN: {
    id: 'FLIN',
    title: 'Whispering Canopy',
    bpm: 122,
    swing: 0.1,
    fadeInSec: 0.35,
    leadConfig: {
      wave: 'triangle',
      volume: 0.16,
      filterHz: 2500,
      attackSec: 0.008,
      releaseSec: 0.08,
      gateRatio: 0.78,
      vibratoHz: 5.2,
      vibratoCents: 10,
      pan: -0.07,
    },
    bassConfig: {
      wave: 'triangle',
      volume: 0.2,
      filterHz: 800,
      attackSec: 0.005,
      releaseSec: 0.06,
      gateRatio: 0.76,
    },
    arpConfig: {
      wave: 'square',
      volume: 0.06,
      filterHz: 1900,
      attackSec: 0.005,
      releaseSec: 0.05,
      gateRatio: 0.55,
      pan: 0.2,
    },
    drumVolume: 0.14,
    lead: [
      // Bar 1 (Em)
      N.E5, H, N.G5, R, N.Fs5, H, N.E5, N.D5, N.B4, H, N.D5, H, N.E5, H, R, R,
      // Bar 2 (A -> Em Dorian color with C#)
      N.Cs5, H, N.E5, R, N.G5, H, N.Fs5, N.E5, N.D5, H, N.B4, H, N.A4, H, R, R,
      // Bar 3 (C -> D)
      N.G4, H, N.B4, N.D5, N.E5, H, N.D5, H, N.Fs5, H, N.E5, N.D5, N.A4, H, R, R,
      // Bar 4 (Bm -> Em)
      N.B4, H, N.D5, R, N.Fs5, H, N.E5, N.D5, N.Cs5, H, N.B4, H, N.E5, H, R, R,
    ],
    bass: buildBassPattern([N.E2, N.A2, N.C3, N.B2], [1, 0, 1, 0, 3, 0, 2, 0, 1, 0, 3, 1, 0, 2, 3, 0]),
    arp: buildArpBars([
      [N.E4, R, N.G4, N.B4, N.E4, N.B4, R, N.G4],
      [N.A3, R, N.Cs4, N.E4, N.A3, N.E4, R, N.Cs4],
      splitBar([N.C4, R, N.E4, N.G4], [N.D4, R, N.Fs4, N.A4]),
      splitBar([N.B3, R, N.D4, N.Fs4], [N.E4, R, N.G4, N.B4]),
    ]),
    drums: parseDrums(
      'K.H.P.H.K.T.P.H. | K.H.P.M.K.T.P.O. | K.H.P.H.K.T.P.H. | K.T.P.M.K.M.T.P.',
    ),
  },

  // --------------------------------------------------------------------------
  // AP — Primal Drums (A Minor Pentatonic / Phrygian Tribal, 142 BPM)
  // --------------------------------------------------------------------------
  AP: {
    id: 'AP',
    title: 'Primal Basin Drums',
    bpm: 142,
    swing: 0.05,
    fadeInSec: 0.28,
    leadConfig: {
      wave: 'sawtooth',
      volume: 0.125,
      filterHz: 2400,
      attackSec: 0.006,
      releaseSec: 0.06,
      gateRatio: 0.8,
      detuneCents: 4,
      pan: -0.04,
    },
    bassConfig: {
      wave: 'sawtooth',
      volume: 0.16,
      filterHz: 750,
      attackSec: 0.005,
      releaseSec: 0.05,
      gateRatio: 0.78,
    },
    arpConfig: {
      wave: 'triangle',
      volume: 0.07,
      filterHz: 2100,
      attackSec: 0.004,
      releaseSec: 0.04,
      gateRatio: 0.58,
      pan: 0.18,
    },
    drumVolume: 0.18,
    lead: [
      // Bar 1 (Am)
      N.A4, H, N.C5, R, N.D5, H, N.E5, H, N.G5, H, N.E5, N.D5, N.C5, H, R, R,
      // Bar 2 (G -> F)
      N.G4, H, N.A4, R, N.C5, H, N.D5, H, N.E5, H, N.D5, N.C5, N.A4, H, R, R,
      // Bar 3 (F -> E Phrygian accent)
      N.F4, H, N.A4, R, N.C5, H, N.D5, H, N.E5, H, N.F5, N.E5, N.D5, H, N.C5, H,
      // Bar 4 (E7 -> Am slam)
      N.E5, H, N.D5, N.C5, N.B4, H, N.As4, H, N.A4, H, H, R, N.E4, H, N.G4, H,
    ],
    bass: buildBassPattern([N.A2, N.G2, N.F2, N.E2], [1, 1, 0, 1, 3, 0, 1, 0, 1, 1, 0, 2, 1, 0, 3, 0]),
    arp: buildArpBars([
      [N.A3, N.E4, N.A4, N.C5],
      [N.G3, N.D4, N.G4, N.B4],
      [N.F3, N.C4, N.F4, N.A4],
      [N.E3, N.B3, N.E4, N.Gs4],
    ]),
    drums: parseDrums(
      'K.T.M.T.K.T.S.T. | K.T.M.K.S.T.M.O. | K.T.M.T.K.T.S.T. | K.K.T.M.S.M.T.X.',
    ),
  },

  // --------------------------------------------------------------------------
  // ATVC — Sky Cliffs & Windy Ridges (F Lydian Soaring, 134 BPM)
  // --------------------------------------------------------------------------
  ATVC: {
    id: 'ATVC',
    title: 'Windward Spires',
    bpm: 134,
    swing: 0.0,
    fadeInSec: 0.35,
    leadConfig: {
      wave: 'square',
      volume: 0.125,
      filterHz: 3500,
      attackSec: 0.007,
      releaseSec: 0.08,
      gateRatio: 0.85,
      vibratoHz: 5.8,
      vibratoCents: 9,
      pan: -0.06,
    },
    bassConfig: {
      wave: 'triangle',
      volume: 0.19,
      filterHz: 920,
      attackSec: 0.005,
      releaseSec: 0.06,
      gateRatio: 0.8,
    },
    arpConfig: {
      wave: 'sine',
      volume: 0.08,
      filterHz: 3200,
      attackSec: 0.005,
      releaseSec: 0.06,
      gateRatio: 0.68,
      pan: 0.2,
    },
    drumVolume: 0.13,
    lead: [
      // Bar 1 (F Lydian: B natural!)
      N.F5, H, N.A5, H, N.C6, H, N.B5, N.A5, N.G5, H, N.A5, H, N.F5, H, R, R,
      // Bar 2 (G)
      N.G5, H, N.B5, H, N.D6, H, N.C6, N.B5, N.A5, H, N.G5, H, N.D5, H, R, R,
      // Bar 3 (Em -> Am)
      N.E5, H, N.G5, H, N.B5, H, N.A5, H, N.C6, H, N.B5, N.A5, N.G5, H, N.E5, H,
      // Bar 4 (G -> C -> F lift)
      N.D5, H, N.G5, H, N.B5, H, N.A5, H, N.G5, H, N.E5, H, N.C5, H, R, R,
    ],
    bass: buildBassPattern([N.F2, N.G2, N.E2, N.C3], [1, 0, 2, 0, 3, 0, 2, 0, 1, 0, 2, 0, 3, 0, 1, 0]),
    arp: buildArpBars([
      [N.F4, N.A4, N.C5, N.E5],
      [N.G4, N.B4, N.D5, N.G5],
      splitBar([N.E4, N.G4, N.B4, N.E5], [N.A4, N.C5, N.E5, N.A5]),
      [N.G4, N.B4, N.D5, N.C5],
    ]),
    drums: parseDrums(
      'B.H.S.H.B.H.S.H. | B.H.S.H.B.B.S.O. | B.H.S.H.B.H.S.H. | B.H.S.M.B.T.S.H.',
    ),
  },

  // --------------------------------------------------------------------------
  // DSI — Scorching Dunes & Oasis Ruins (E Phrygian Dominant, 130 BPM)
  // --------------------------------------------------------------------------
  DSI: {
    id: 'DSI',
    title: 'Mirage of the Sun Dunes',
    bpm: 130,
    swing: 0.04,
    fadeInSec: 0.35,
    leadConfig: {
      wave: 'sawtooth',
      volume: 0.12,
      filterHz: 2700,
      attackSec: 0.006,
      releaseSec: 0.07,
      gateRatio: 0.8,
      vibratoHz: 6.2,
      vibratoCents: 12,
      pan: -0.05,
    },
    bassConfig: {
      wave: 'triangle',
      volume: 0.2,
      filterHz: 850,
      attackSec: 0.005,
      releaseSec: 0.06,
      gateRatio: 0.8,
    },
    arpConfig: {
      wave: 'square',
      volume: 0.06,
      filterHz: 2200,
      attackSec: 0.004,
      releaseSec: 0.04,
      gateRatio: 0.56,
      pan: 0.18,
    },
    drumVolume: 0.15,
    lead: [
      // Bar 1 (E Phrygian Dom: E F G# A B C D)
      N.E5, H, N.Gs5, N.A5, N.B5, H, N.A5, N.Gs5, N.F5, H, N.Gs5, N.F5, N.E5, H, R, R,
      // Bar 2 (F)
      N.F5, H, N.A5, N.B5, N.C6, H, N.B5, N.A5, N.Gs5, H, N.F5, H, N.E5, H, R, R,
      // Bar 3 (Dm -> E)
      N.D5, H, N.F5, N.A5, N.Gs5, H, N.F5, H, N.E5, H, N.F5, N.Gs5, N.B5, H, R, R,
      // Bar 4 (F -> E cadence)
      N.C6, H, N.B5, N.A5, N.Gs5, H, N.F5, N.E5, N.F5, H, N.Gs5, H, N.E5, H, R, R,
    ],
    bass: buildBassPattern([N.E2, N.F2, N.D2, N.E2], [1, 0, 1, 2, 1, 0, 3, 0, 1, 0, 2, 1, 3, 0, 1, 0]),
    arp: buildArpBars([
      [N.E4, N.Gs4, N.B4, N.E5],
      [N.F4, N.A4, N.C5, N.F5],
      [N.D4, N.F4, N.A4, N.D5],
      [N.F4, N.Gs4, N.B4, N.E5],
    ]),
    drums: parseDrums(
      'K.H.P.H.K.T.S.H. | K.H.P.T.K.M.S.O. | K.H.P.H.K.T.S.H. | K.T.S.P.K.M.T.S.',
    ),
  },

  // --------------------------------------------------------------------------
  // LAB — Mechanized Research Lab (C Minor Electro-Chiptune, 140 BPM)
  // --------------------------------------------------------------------------
  LAB: {
    id: 'LAB',
    title: 'Circuit Foundry',
    bpm: 140,
    swing: 0.0,
    fadeInSec: 0.25,
    leadConfig: {
      wave: 'square',
      volume: 0.125,
      filterHz: 3200,
      attackSec: 0.003,
      releaseSec: 0.045,
      gateRatio: 0.72,
      detuneCents: -3,
      pan: -0.05,
    },
    bassConfig: {
      wave: 'sawtooth',
      volume: 0.155,
      filterHz: 900,
      attackSec: 0.003,
      releaseSec: 0.04,
      gateRatio: 0.7,
    },
    arpConfig: {
      wave: 'square',
      volume: 0.065,
      filterHz: 2900,
      attackSec: 0.003,
      releaseSec: 0.03,
      gateRatio: 0.52,
      pan: 0.18,
    },
    drumVolume: 0.15,
    lead: [
      // Bar 1 (Cm)
      N.C5, R, N.Ds5, N.G5, N.C6, R, N.As5, N.G5, N.F5, R, N.G5, N.Ds5, N.C5, H, R, R,
      // Bar 2 (Ab)
      N.Gs4, R, N.C5, N.Ds5, N.G5, R, N.F5, N.Ds5, N.D5, R, N.Ds5, N.C5, N.Gs4, H, R, R,
      // Bar 3 (Fm -> Bb)
      N.F5, R, N.Gs5, N.C6, N.As5, R, N.G5, N.F5, N.D5, R, N.F5, N.As5, N.G5, H, R, R,
      // Bar 4 (G7 -> Cm)
      N.G5, N.Fs5, N.G5, N.B5, N.D6, R, N.C6, N.B5, N.G5, R, N.F5, N.D5, N.G5, H, R, R,
    ],
    bass: buildBassPattern([N.C2, N.Gs2, N.F2, N.G2], [1, 2, 1, 2, 1, 2, 3, 2, 1, 2, 1, 2, 3, 2, 1, 0]),
    arp: buildArpBars([
      [N.C4, N.Ds4, N.G4, N.C5],
      [N.Gs3, N.C4, N.Ds4, N.Gs4],
      splitBar([N.F3, N.Gs3, N.C4, N.F4], [N.As3, N.D4, N.F4, N.As4]),
      [N.G3, N.B3, N.D4, N.G4],
    ]),
    drums: parseDrums(
      'B.H.S.H.B.H.S.H. | B.H.S.H.B.B.S.O. | B.H.S.H.B.H.S.H. | B.B.S.H.B.S.H.S.',
    ),
  },

  // --------------------------------------------------------------------------
  // TEMP — Ancient Sanctuary Temple (D Dorian / Ceremonial, 118 BPM)
  // --------------------------------------------------------------------------
  TEMP: {
    id: 'TEMP',
    title: 'Sanctuary of Relics',
    bpm: 118,
    swing: 0.0,
    fadeInSec: 0.45,
    leadConfig: {
      wave: 'triangle',
      volume: 0.16,
      filterHz: 2600,
      attackSec: 0.012,
      releaseSec: 0.14,
      gateRatio: 0.9,
      vibratoHz: 4.8,
      vibratoCents: 8,
      pan: -0.06,
    },
    bassConfig: {
      wave: 'triangle',
      volume: 0.2,
      filterHz: 780,
      attackSec: 0.01,
      releaseSec: 0.1,
      gateRatio: 0.85,
    },
    arpConfig: {
      wave: 'sine',
      volume: 0.085,
      filterHz: 2800,
      attackSec: 0.008,
      releaseSec: 0.12,
      gateRatio: 0.78,
      pan: 0.2,
    },
    drumVolume: 0.12,
    lead: [
      // Bar 1 (Dm)
      N.D5, H, H, N.E5, N.F5, H, N.A5, H, N.G5, H, N.F5, H, N.E5, H, N.D5, H,
      // Bar 2 (G Dorian)
      N.B4, H, H, N.D5, N.G5, H, N.Fs5, H, N.E5, H, N.D5, H, N.B4, H, R, R,
      // Bar 3 (C -> Am)
      N.C5, H, N.E5, H, N.G5, H, N.E5, H, N.A4, H, N.C5, H, N.E5, H, N.D5, H,
      // Bar 4 (Am -> Dm)
      N.C5, H, N.B4, H, N.A4, H, N.G4, H, N.A4, H, N.Cs5, H, N.D5, H, R, R,
    ],
    bass: buildBassPattern([N.D2, N.G2, N.C3, N.A2], [1, -1, 0, 3, 1, -1, 2, 0, 1, -1, 0, 3, 1, 0, 2, 0]),
    arp: buildArpBars([
      [N.D4, N.F4, N.A4, N.D5, N.A4, N.F4, N.D4, R],
      [N.G3, N.B3, N.D4, N.G4, N.D4, N.B3, N.G3, R],
      splitBar([N.C4, N.E4, N.G4, N.C5], [N.A3, N.C4, N.E4, N.A4]),
      [N.A3, N.E4, N.A4, N.Cs5, N.A4, N.E4, N.Cs4, R],
    ]),
    drums: parseDrums(
      'K...T...S...T.H. | K...T...S..KT.O. | K...T...S...T.H. | K...T.M.S.T.M.C.',
    ),
  },

  // --------------------------------------------------------------------------
  // EVIL — Nightmare Citadel (C# Harmonic Minor Gothic Drive, 148 BPM)
  // --------------------------------------------------------------------------
  EVIL: {
    id: 'EVIL',
    title: 'Citadel of Echoes',
    bpm: 148,
    swing: 0.0,
    fadeInSec: 0.25,
    leadConfig: {
      wave: 'sawtooth',
      volume: 0.13,
      filterHz: 3000,
      attackSec: 0.004,
      releaseSec: 0.055,
      gateRatio: 0.82,
      detuneCents: 5,
      vibratoHz: 6.5,
      vibratoCents: 11,
      pan: -0.05,
    },
    bassConfig: {
      wave: 'sawtooth',
      volume: 0.16,
      filterHz: 780,
      attackSec: 0.004,
      releaseSec: 0.045,
      gateRatio: 0.78,
    },
    arpConfig: {
      wave: 'square',
      volume: 0.07,
      filterHz: 2600,
      attackSec: 0.003,
      releaseSec: 0.03,
      gateRatio: 0.58,
      pan: 0.18,
    },
    drumVolume: 0.16,
    lead: [
      // Bar 1 (C#m)
      N.Cs5, H, N.E5, N.Gs5, N.A5, H, N.Gs5, H, N.Fs5, H, N.E5, N.Ds5, N.Cs5, H, R, R,
      // Bar 2 (A)
      N.A4, H, N.Cs5, N.E5, N.A5, H, N.Gs5, N.Fs5, N.E5, H, N.Ds5, H, N.C5, H, R, R,
      // Bar 3 (F#m -> G#7)
      N.Fs5, H, N.A5, N.Gs5, N.Fs5, H, N.E5, H, N.Ds5, H, N.Fs5, N.Gs5, N.C6, H, N.Gs5, H,
      // Bar 4 (G#7 -> C#m descent)
      N.Gs5, N.Fs5, N.E5, N.Ds5, N.C5, H, N.Ds5, H, N.E5, H, N.Ds5, N.C5, N.Cs5, H, R, R,
    ],
    bass: buildBassPattern([N.Cs2, N.A2, N.Fs2, N.Gs2], [1, 1, 2, 1, 1, 3, 2, 1, 1, 1, 2, 1, 3, 2, 1, 0]),
    arp: buildArpBars([
      [N.Cs4, N.E4, N.Gs4, N.Cs5],
      [N.A3, N.Cs4, N.E4, N.A4],
      [N.Fs3, N.A3, N.Cs4, N.Fs4],
      [N.Gs3, N.C4, N.Ds4, N.Gs4],
    ]),
    drums: parseDrums(
      'B.H.S.H.B.B.S.H. | B.H.S.B.B.H.S.O. | B.H.S.H.B.B.S.H. | B.B.S.M.B.T.S.X.',
    ),
  },

  // --------------------------------------------------------------------------
  // GSHIP — Phantom Galleon (G Minor Swashbuckling Shanty, 132 BPM)
  // --------------------------------------------------------------------------
  GSHIP: {
    id: 'GSHIP',
    title: 'Deck of the Phantom Hull',
    bpm: 132,
    swing: 0.1,
    fadeInSec: 0.32,
    leadConfig: {
      wave: 'square',
      volume: 0.13,
      filterHz: 2900,
      attackSec: 0.006,
      releaseSec: 0.07,
      gateRatio: 0.82,
      detuneCents: -6,
      vibratoHz: 5.5,
      vibratoCents: 13,
      pan: -0.06,
    },
    bassConfig: {
      wave: 'triangle',
      volume: 0.2,
      filterHz: 860,
      attackSec: 0.005,
      releaseSec: 0.06,
      gateRatio: 0.8,
    },
    arpConfig: {
      wave: 'triangle',
      volume: 0.075,
      filterHz: 2400,
      attackSec: 0.005,
      releaseSec: 0.05,
      gateRatio: 0.65,
      pan: 0.18,
    },
    drumVolume: 0.145,
    lead: [
      // Bar 1 (Gm)
      N.D5, H, N.G5, N.A5, N.As5, H, N.A5, N.G5, N.F5, H, N.D5, H, N.G5, H, R, R,
      // Bar 2 (Eb -> F)
      N.Ds5, H, N.G5, N.As5, N.A5, H, N.G5, N.F5, N.D5, H, N.C5, H, N.D5, H, R, R,
      // Bar 3 (Cm -> Gm)
      N.C5, H, N.Ds5, N.G5, N.As5, H, N.A5, H, N.G5, H, N.F5, N.Ds5, N.D5, H, R, R,
      // Bar 4 (D7 -> Gm)
      N.D5, H, N.Fs5, N.A5, N.C6, H, N.As5, N.A5, N.G5, H, N.Fs5, H, N.G5, H, R, R,
    ],
    bass: buildBassPattern([N.G2, N.Ds2, N.C3, N.D2], [1, 0, 3, 0, 1, 0, 2, 0, 1, 0, 3, 0, 2, 0, 3, 0]),
    arp: buildArpBars([
      [N.G3, N.As3, N.D4, N.G4],
      [N.Ds3, N.G3, N.As3, N.F4],
      [N.C4, N.Ds4, N.G4, N.C5],
      [N.D4, N.Fs4, N.A4, N.C5],
    ]),
    drums: parseDrums(
      'K.H.S.H.K.T.S.H. | K.H.S.H.K.M.S.O. | K.H.S.H.K.T.S.H. | K.T.S.M.K.T.S.C.',
    ),
  },

  // --------------------------------------------------------------------------
  // BOSS — High-Energy Driving Boss Theme (E Minor, 156 BPM)
  // --------------------------------------------------------------------------
  BOSS: {
    id: 'BOSS',
    title: 'Colossus Clash',
    bpm: 156,
    swing: 0.0,
    fadeInSec: 0.14,
    leadConfig: {
      wave: 'square',
      volume: 0.145,
      filterHz: 3900,
      attackSec: 0.003,
      releaseSec: 0.05,
      gateRatio: 0.85,
      detuneCents: 4,
      vibratoHz: 6.8,
      vibratoCents: 11,
      pan: -0.04,
    },
    bassConfig: {
      wave: 'sawtooth',
      volume: 0.175,
      filterHz: 950,
      attackSec: 0.003,
      releaseSec: 0.04,
      gateRatio: 0.8,
    },
    arpConfig: {
      wave: 'square',
      volume: 0.072,
      filterHz: 3100,
      attackSec: 0.002,
      releaseSec: 0.028,
      gateRatio: 0.56,
      pan: 0.16,
    },
    drumVolume: 0.175,
    lead: [
      // Bar 1 (Em aggressive hook)
      N.E5, H, N.G5, N.Fs5, N.E5, N.B4, N.E5, N.G5, N.As5, H, N.A5, N.G5, N.Fs5, H, N.E5, H,
      // Bar 2 (C -> D lift)
      N.G5, H, N.B5, N.A5, N.G5, N.E5, N.G5, N.A5, N.B5, H, N.A5, N.G5, N.Fs5, H, N.D5, H,
      // Bar 3 (Am -> Em)
      N.C6, H, N.B5, N.A5, N.G5, H, N.Fs5, N.E5, N.G5, H, N.Fs5, N.E5, N.Ds5, H, N.E5, H,
      // Bar 4 (B7 chromatic shred)
      N.Fs5, N.G5, N.Fs5, N.Ds5, N.B4, H, N.Ds5, N.Fs5, N.A5, H, N.G5, N.Fs5, N.Ds5, H, N.B4, H,
    ],
    bass: buildBassPattern([N.E2, N.C2, N.A2, N.B2], [1, 1, 2, 1, 1, 2, 3, 1, 1, 1, 2, 1, 3, 2, 1, 2]),
    arp: buildArpBars([
      [N.E4, N.G4, N.B4, N.E5],
      splitBar([N.C4, N.E4, N.G4, N.C5], [N.D4, N.Fs4, N.A4, N.D5]),
      splitBar([N.A3, N.C4, N.E4, N.A4], [N.E4, N.G4, N.B4, N.E5]),
      [N.B3, N.Ds4, N.Fs4, N.B4],
    ]),
    drums: parseDrums(
      'B.H.S.B.B.B.S.H. | B.H.S.B.B.H.S.C. | B.H.S.B.B.B.S.H. | B.B.S.M.B.T.S.X.',
    ),
  },

  // --------------------------------------------------------------------------
  // MINIBOSS — Urgent Mini-Boss Clash (D Minor, 148 BPM)
  // --------------------------------------------------------------------------
  MINIBOSS: {
    id: 'MINIBOSS',
    title: 'Guardian Gauntlet',
    bpm: 148,
    swing: 0.0,
    fadeInSec: 0.14,
    leadConfig: {
      wave: 'sawtooth',
      volume: 0.135,
      filterHz: 3300,
      attackSec: 0.003,
      releaseSec: 0.045,
      gateRatio: 0.8,
      pan: -0.04,
    },
    bassConfig: {
      wave: 'square',
      volume: 0.16,
      filterHz: 850,
      attackSec: 0.003,
      releaseSec: 0.04,
      gateRatio: 0.76,
    },
    arpConfig: {
      wave: 'square',
      volume: 0.068,
      filterHz: 2700,
      attackSec: 0.003,
      releaseSec: 0.03,
      gateRatio: 0.55,
      pan: 0.16,
    },
    drumVolume: 0.17,
    lead: [
      // Bar 1 (Dm)
      N.D5, R, N.F5, N.G5, N.Gs5, H, N.G5, N.F5, N.D5, H, N.A4, H, N.C5, N.D5, R, R,
      // Bar 2 (Bb)
      N.As4, R, N.D5, N.F5, N.G5, H, N.F5, N.D5, N.C5, H, N.As4, H, N.A4, H, R, R,
      // Bar 3 (Gm -> C)
      N.G5, R, N.F5, N.D5, N.C5, H, N.As4, N.A4, N.G4, H, N.A4, N.C5, N.E5, H, R, R,
      // Bar 4 (A7)
      N.A5, H, N.G5, N.F5, N.E5, H, N.Cs5, N.A4, N.Cs5, N.E5, N.G5, N.A5, N.E5, H, R, R,
    ],
    bass: buildBassPattern([N.D2, N.As2, N.G2, N.A2], [1, 0, 1, 2, 1, 0, 3, 1, 1, 2, 1, 0, 3, 2, 1, 0]),
    arp: buildArpBars([
      [N.D4, N.F4, N.A4, N.D5],
      [N.As3, N.D4, N.F4, N.As4],
      [N.G3, N.As3, N.D4, N.G4],
      [N.A3, N.Cs4, N.E4, N.A4],
    ]),
    drums: parseDrums(
      'B.H.S.H.B.B.S.H. | B.H.S.B.B.H.S.O. | B.H.S.H.B.B.S.H. | B.B.S.T.B.M.S.X.',
    ),
  },

  // --------------------------------------------------------------------------
  // SHADOW_DUEL — Mirror Rival Duel (F# Minor High-Speed, 164 BPM)
  // --------------------------------------------------------------------------
  SHADOW_DUEL: {
    id: 'SHADOW_DUEL',
    title: 'Mirror of the Shadow',
    bpm: 164,
    swing: 0.0,
    fadeInSec: 0.12,
    leadConfig: {
      wave: 'square',
      volume: 0.14,
      filterHz: 4000,
      attackSec: 0.002,
      releaseSec: 0.04,
      gateRatio: 0.8,
      detuneCents: -5,
      vibratoHz: 7.0,
      vibratoCents: 10,
      pan: -0.06,
    },
    bassConfig: {
      wave: 'sawtooth',
      volume: 0.17,
      filterHz: 1050,
      attackSec: 0.002,
      releaseSec: 0.035,
      gateRatio: 0.76,
    },
    arpConfig: {
      wave: 'square',
      volume: 0.072,
      filterHz: 3400,
      attackSec: 0.002,
      releaseSec: 0.025,
      gateRatio: 0.52,
      pan: 0.2,
    },
    drumVolume: 0.175,
    lead: [
      // Bar 1 (F#m)
      N.Fs5, N.A5, N.Cs6, H, N.B5, N.A5, N.Gs5, H, N.Fs5, N.E5, N.Cs5, H, N.E5, N.Fs5, R, R,
      // Bar 2 (D -> E)
      N.D5, N.Fs5, N.A5, H, N.Gs5, N.Fs5, N.E5, H, N.B5, N.A5, N.Gs5, H, N.E5, H, R, R,
      // Bar 3 (Bm -> C#m)
      N.B5, H, N.A5, N.Gs5, N.Fs5, H, N.E5, N.Ds5, N.Cs5, H, N.E5, N.Gs5, N.Cs6, H, R, R,
      // Bar 4 (C#7 -> F#m blitz)
      N.Cs6, N.B5, N.A5, N.Gs5, N.F5, N.Gs5, N.B5, N.Cs6, N.Gs5, H, N.F5, H, N.Cs5, H, R, R,
    ],
    bass: buildBassPattern([N.Fs2, N.D2, N.B2, N.Cs2], [1, 2, 1, 2, 1, 2, 3, 2, 1, 2, 1, 2, 3, 2, 1, 2]),
    arp: buildArpBars([
      [N.Fs4, N.A4, N.Cs5, N.Fs5],
      splitBar([N.D4, N.Fs4, N.A4, N.D5], [N.E4, N.Gs4, N.B4, N.E5]),
      splitBar([N.B3, N.D4, N.Fs4, N.B4], [N.Cs4, N.E4, N.Gs4, N.Cs5]),
      [N.Cs4, N.F4, N.Gs4, N.Cs5],
    ]),
    drums: parseDrums(
      'B.H.S.B.B.B.S.H. | B.B.S.H.B.H.S.C. | B.H.S.B.B.B.S.H. | B.B.S.B.S.M.T.X.',
    ),
  },

  // --------------------------------------------------------------------------
  // FINAL_BOSS — Sovereign Finale (C Minor Epic Climax, 168 BPM)
  // --------------------------------------------------------------------------
  FINAL_BOSS: {
    id: 'FINAL_BOSS',
    title: 'Crown of the Nightmare Sovereign',
    bpm: 168,
    swing: 0.0,
    fadeInSec: 0.12,
    leadConfig: {
      wave: 'sawtooth',
      volume: 0.145,
      filterHz: 4200,
      attackSec: 0.003,
      releaseSec: 0.055,
      gateRatio: 0.88,
      detuneCents: 6,
      vibratoHz: 6.8,
      vibratoCents: 13,
      pan: -0.03,
    },
    bassConfig: {
      wave: 'sawtooth',
      volume: 0.18,
      filterHz: 1000,
      attackSec: 0.003,
      releaseSec: 0.04,
      gateRatio: 0.82,
    },
    arpConfig: {
      wave: 'square',
      volume: 0.078,
      filterHz: 3500,
      attackSec: 0.002,
      releaseSec: 0.028,
      gateRatio: 0.58,
      pan: 0.18,
    },
    drumVolume: 0.185,
    lead: [
      // Bar 1 (Cm towering theme)
      N.C6, H, N.G5, H, N.Ds5, H, N.G5, N.As5, N.C6, H, N.D6, N.Ds6, N.D6, H, N.C6, H,
      // Bar 2 (Ab -> Bb)
      N.Gs5, H, N.C6, H, N.Ds6, H, N.D6, N.C6, N.As5, H, N.D6, H, N.F6, H, N.Ds6, H,
      // Bar 3 (Fm -> Cm/G)
      N.F6, H, N.Ds6, N.D6, N.C6, H, N.Gs5, N.F5, N.G5, H, N.C6, H, N.Ds6, H, N.D6, H,
      // Bar 4 (G7 diminished surge -> C)
      N.B5, N.D6, N.F6, N.Gs5, N.B5, N.D6, N.G6, H, N.F6, N.Ds6, N.D6, N.B5, N.G5, H, R, R,
    ],
    bass: buildBassPattern([N.C2, N.Gs2, N.F2, N.G2], [1, 1, 2, 1, 1, 2, 3, 2, 1, 1, 2, 1, 3, 2, 1, 2]),
    arp: buildArpBars([
      [N.C4, N.Ds4, N.G4, N.C5],
      splitBar([N.Gs3, N.C4, N.Ds4, N.Gs4], [N.As3, N.D4, N.F4, N.As4]),
      splitBar([N.F3, N.Gs3, N.C4, N.F4], [N.G3, N.C4, N.Ds4, N.G4]),
      [N.G3, N.B3, N.D4, N.F4],
    ]),
    drums: parseDrums(
      'C.B.S.B.B.B.S.H. | B.B.S.B.B.H.S.C. | B.H.S.B.B.B.S.H. | B.B.S.M.B.T.X.C.',
    ),
  },

  // --------------------------------------------------------------------------
  // VICTORY — Triumphant Heroic Anthem (D Major, 132 BPM)
  // --------------------------------------------------------------------------
  VICTORY: {
    id: 'VICTORY',
    title: 'Dawn of Victory',
    bpm: 132,
    swing: 0.0,
    fadeInSec: 0.12,
    leadConfig: {
      wave: 'square',
      volume: 0.14,
      filterHz: 3800,
      attackSec: 0.005,
      releaseSec: 0.08,
      gateRatio: 0.88,
      vibratoHz: 5.5,
      vibratoCents: 10,
      pan: -0.04,
    },
    bassConfig: {
      wave: 'triangle',
      volume: 0.21,
      filterHz: 950,
      attackSec: 0.005,
      releaseSec: 0.06,
      gateRatio: 0.82,
    },
    arpConfig: {
      wave: 'triangle',
      volume: 0.085,
      filterHz: 3400,
      attackSec: 0.004,
      releaseSec: 0.06,
      gateRatio: 0.72,
      pan: 0.16,
    },
    drumVolume: 0.15,
    lead: [
      // Bar 1 (D fanfare)
      N.D5, N.D5, N.Fs5, N.A5, N.D6, H, H, N.Cs6, N.B5, H, N.A5, H, N.Fs5, H, N.A5, H,
      // Bar 2 (G -> A)
      N.G5, H, N.B5, H, N.D6, H, N.Cs6, N.B5, N.A5, H, H, R, N.E5, H, N.Fs5, H,
      // Bar 3 (Bm -> G)
      N.B5, H, N.A5, N.Fs5, N.D5, H, N.Fs5, H, N.G5, H, N.A5, N.B5, N.D6, H, N.B5, H,
      // Bar 4 (A -> D triumphant resolve)
      N.Cs6, H, N.B5, N.A5, N.E6, H, N.Cs6, H, N.D6, H, H, H, H, H, R, R,
    ],
    bass: buildBassPattern([N.D3, N.G2, N.B2, N.A2], [1, 0, 2, 0, 1, 0, 3, 0, 1, 0, 2, 0, 3, 0, 2, 0]),
    arp: buildArpBars([
      [N.D4, N.Fs4, N.A4, N.D5],
      splitBar([N.G4, N.B4, N.D5, N.G5], [N.A4, N.Cs5, N.E5, N.A5]),
      splitBar([N.B3, N.D4, N.Fs4, N.B4], [N.G3, N.B3, N.D4, N.G4]),
      splitBar([N.A3, N.Cs4, N.E4, N.A4], [N.D4, N.Fs4, N.A4, N.D5]),
    ]),
    drums: parseDrums(
      'C.H.S.H.B.B.S.H. | B.H.S.H.B.T.M.S. | C.H.S.H.B.B.S.H. | B.H.S.M.C.H.B.S.',
    ),
  },
};

export function getTrack(context: MusicContextId): TrackDef {
  return MUSIC_TRACKS[context];
}
