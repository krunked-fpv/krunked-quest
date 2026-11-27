/**
 * AudioEngine — Implements IAudioEngine
 * - Lazy AudioContext unlock on first user gesture
 * - Drift-free Web Audio lookahead step sequencer for procedural 16-bit chiptune tracks
 * - Smooth crossfade switching between biome, boss, title, and victory contexts
 * - Spatial stereo panning from simulation event X coordinates
 * - Full headless / Node safety and complete timer/node teardown on dispose()
 */

import {
  DEFAULT_SETTINGS,
  VIEWPORT_TILES_W,
  type AudioSettings,
  type BiomeId,
  type BossId,
  type IAudioEngine,
  type SimEvent,
} from '../contracts/index';
import { ProceduralSynth } from './ProceduralSynth';
import { getTrack, midiToFreq, type MusicContextId, type StepNote, type TrackDef } from './tracks';

const SCHEDULER_INTERVAL_MS = 25;
const LOOKAHEAD_SEC = 0.11;
const HALF_VIEWPORT_TILES = VIEWPORT_TILES_W * 0.5;

function clamp(v: number, min: number, max: number): number {
  return v < min ? min : v > max ? max : v;
}

function isBossContext(ctx: MusicContextId | null): boolean {
  return ctx === 'BOSS' || ctx === 'MINIBOSS' || ctx === 'SHADOW_DUEL' || ctx === 'FINAL_BOSS';
}

function bossIdToContext(bossId: BossId): MusicContextId {
  switch (bossId) {
    case 'shadow_doppelganger':
      return 'SHADOW_DUEL';
    case 'nightmare_sovereign':
      return 'FINAL_BOSS';
    case 'dino_behemoth':
    case 'bone_colossus':
      return 'MINIBOSS';
    default:
      return 'BOSS';
  }
}

function countNoteSpanSteps(lane: readonly StepNote[], startIndex: number): number {
  const len = lane.length;
  if (len === 0) return 1;
  let span = 1;
  const maxSpan = Math.min(len, 16);
  while (span < maxSpan) {
    const next = lane[(startIndex + span) % len];
    if (next === 0) {
      span++;
    } else {
      break;
    }
  }
  return span;
}

export class AudioEngine implements IAudioEngine {
  private readonly synth: ProceduralSynth;
  private desiredContext: MusicContextId | null = null;
  private activeContext: MusicContextId | null = null;
  private activeTrack: TrackDef | null = null;
  private activeTrackGain: GainNode | null = null;

  private schedulerTimer: ReturnType<typeof setInterval> | null = null;
  private cleanupTimers = new Set<ReturnType<typeof setTimeout>>();

  private stepIndex = 0;
  private nextStepTime = 0;
  private schedulerPaused = true;

  private listenerX: number | null = null;
  private disposed = false;

  constructor(initialSettings: AudioSettings = DEFAULT_SETTINGS.audio) {
    this.synth = new ProceduralSynth(initialSettings);
  }

  public unlock(): void {
    if (this.disposed) return;
    const ok = this.synth.unlock();
    if (!ok) return;

    this.ensureSchedulerRunning();
    if (this.desiredContext !== null && this.activeContext !== this.desiredContext) {
      this.transitionToTrack(this.desiredContext);
    }
  }

  public consumeEvents(events: readonly SimEvent[], biome: BiomeId, inBoss: boolean): void {
    if (this.disposed) return;

    this.resolveContextFromEvents(events, biome, inBoss);

    for (let i = 0; i < events.length; i++) {
      const ev = events[i];
      const pan = this.computeEventPan(ev);
      this.synth.playEvent(ev, pan);
    }
  }

  public setMusicContext(context: MusicContextId): void {
    if (this.disposed) return;
    this.desiredContext = context;

    if (this.activeContext === context && this.activeTrackGain !== null) {
      return;
    }

    if (this.synth.getContext() !== null) {
      this.ensureSchedulerRunning();
      this.transitionToTrack(context);
    }
  }

  public updateSettings(settings: AudioSettings): void {
    if (this.disposed) return;
    this.synth.updateSettings(settings);
  }

  public getSettings(): AudioSettings {
    return this.synth.getSettings();
  }

  public dispose(): void {
    if (this.disposed) return;
    this.disposed = true;

    if (this.schedulerTimer !== null) {
      clearInterval(this.schedulerTimer);
      this.schedulerTimer = null;
    }

    for (const timer of this.cleanupTimers) {
      clearTimeout(timer);
    }
    this.cleanupTimers.clear();

    if (this.activeTrackGain) {
      try {
        this.activeTrackGain.disconnect();
      } catch {
        // Ignore already-disconnected gain node.
      }
      this.activeTrackGain = null;
    }

    this.activeTrack = null;
    this.activeContext = null;
    this.desiredContext = null;
    this.listenerX = null;

    this.synth.dispose();
  }

  // ==========================================================================
  // Context Auto-Resolution & Spatial Panning
  // ==========================================================================

  private resolveContextFromEvents(
    events: readonly SimEvent[],
    biome: BiomeId,
    inBoss: boolean,
  ): void {
    let sawVictory = false;
    let roomChangeBiome: BiomeId | null = null;
    let detectedBossId: BossId | null = null;
    let sawActiveGameplay = false;

    for (let i = 0; i < events.length; i++) {
      const ev = events[i];
      if (ev.type === 'victory') {
        sawVictory = true;
      } else if (ev.type === 'room_change') {
        roomChangeBiome = ev.biome;
      } else if (ev.type === 'boss_hit' || ev.type === 'boss_defeated') {
        detectedBossId = ev.bossId;
      } else if (
        ev.type === 'jump' ||
        ev.type === 'dash' ||
        ev.type === 'ground_stomp' ||
        ev.type === 'tongue_lash' ||
        ev.type === 'enemy_hit' ||
        ev.type === 'stomp_impact'
      ) {
        sawActiveGameplay = true;
      }
    }

    if (sawVictory) {
      this.setMusicContext('VICTORY');
      return;
    }

    if (inBoss) {
      if (detectedBossId !== null) {
        this.setMusicContext(bossIdToContext(detectedBossId));
      } else if (!isBossContext(this.desiredContext)) {
        this.setMusicContext('BOSS');
      }
      return;
    }

    if (roomChangeBiome !== null) {
      this.setMusicContext(roomChangeBiome);
      return;
    }

    const current = this.desiredContext;
    if (current === null || isBossContext(current)) {
      this.setMusicContext(biome);
    } else if (current === 'TITLE') {
      if (sawActiveGameplay) {
        this.setMusicContext(biome);
      }
    } else if (current !== 'VICTORY' && current !== biome) {
      this.setMusicContext(biome);
    }
  }

  private computeEventPan(ev: SimEvent): number {
    switch (ev.type) {
      case 'room_change':
        this.listenerX = null;
        return 0;
      case 'jump':
      case 'land':
      case 'wall_jump':
      case 'dash':
      case 'ground_stomp':
      case 'tongue_lash':
      case 'stomp_start':
      case 'stomp_impact':
      case 'uppercut':
      case 'hero_hurt':
      case 'hero_dead':
      case 'heal':
        this.listenerX = ev.x;
        return 0;
      case 'enemy_hit':
      case 'boss_hit':
      case 'boss_defeated':
      case 'crystal_pickup':
      case 'coin_pickup':
      case 'combo_max':
      case 'block_break':
      case 'bounce_pad': {
        if (this.listenerX === null) return 0;
        const dx = ev.x - this.listenerX;
        return clamp((dx / HALF_VIEWPORT_TILES) * 0.72, -0.72, 0.72);
      }
      case 'form_switch':
      case 'shop_interact':
      case 'teleporter_unlock':
      case 'victory':
        return 0;
      default: {
        const exhaustive: never = ev;
        void exhaustive;
        return 0;
      }
    }
  }

  // ==========================================================================
  // Music Crossfading & Lookahead Step Sequencer
  // ==========================================================================

  private ensureSchedulerRunning(): void {
    if (this.schedulerTimer !== null || this.disposed) return;
    this.schedulerTimer = setInterval(() => {
      this.scheduleTick();
    }, SCHEDULER_INTERVAL_MS);
  }

  private transitionToTrack(context: MusicContextId): void {
    const ctx = this.synth.getContext();
    const musicBus = this.synth.getMusicBus();
    if (!ctx || !musicBus) return;

    const nextTrack = getTrack(context);
    const now = ctx.currentTime;

    // Crossfade out the previous track gain node smoothly
    if (this.activeTrackGain !== null) {
      const oldGain = this.activeTrackGain;
      const fadeOutSec = isBossContext(context) || context === 'VICTORY' ? 0.16 : 0.34;
      try {
        oldGain.gain.cancelScheduledValues(now);
        oldGain.gain.setValueAtTime(Math.max(0.0001, oldGain.gain.value), now);
        oldGain.gain.exponentialRampToValueAtTime(0.0001, now + fadeOutSec);
      } catch {
        oldGain.gain.value = 0;
      }

      const timer = setTimeout(() => {
        this.cleanupTimers.delete(timer);
        try {
          oldGain.disconnect();
        } catch {
          // Ignore already-disconnected node.
        }
      }, Math.ceil((fadeOutSec + 0.08) * 1000));
      this.cleanupTimers.add(timer);
    }

    // Create fresh gain node for the incoming track and fade it in
    const nextGain = ctx.createGain();
    nextGain.gain.setValueAtTime(0.0001, now);
    nextGain.gain.linearRampToValueAtTime(1.0, now + Math.max(0.04, nextTrack.fadeInSec));
    nextGain.connect(musicBus);

    this.activeContext = context;
    this.activeTrack = nextTrack;
    this.activeTrackGain = nextGain;
    this.stepIndex = 0;
    this.nextStepTime = now + 0.03;
    this.schedulerPaused = false;
  }

  private scheduleTick(): void {
    if (this.disposed) return;
    const ctx = this.synth.getContext();
    if (!ctx) return;

    // If a context was queued before audio unlocked, materialize it as soon as context runs
    if (this.desiredContext !== null && this.activeContext !== this.desiredContext) {
      this.transitionToTrack(this.desiredContext);
    }

    const track = this.activeTrack;
    const trackGain = this.activeTrackGain;
    if (!track || !trackGain) return;

    const settings = this.synth.getSettings();
    if (
      !this.synth.isRunning ||
      settings.muted ||
      settings.masterVolume <= 0 ||
      settings.musicVolume <= 0
    ) {
      this.schedulerPaused = true;
      return;
    }

    const now = ctx.currentTime;
    if (this.schedulerPaused || this.nextStepTime < now - 0.15) {
      this.nextStepTime = now + 0.03;
      this.schedulerPaused = false;
    }

    const stepDur = 60 / track.bpm / 4; // 16th-note step duration
    const loopLen = Math.max(
      1,
      track.lead.length,
      track.bass.length,
      track.arp.length,
      track.drums.length,
    );

    const horizon = now + LOOKAHEAD_SEC;
    let safetyGuard = 0;
    while (this.nextStepTime < horizon && safetyGuard < 16) {
      const idx = this.stepIndex % loopLen;
      const swingOffset = idx % 2 === 1 ? stepDur * track.swing : 0;
      const noteTime = this.nextStepTime + swingOffset;

      this.scheduleStep(track, idx, noteTime, stepDur, trackGain);

      this.nextStepTime += stepDur;
      this.stepIndex = (this.stepIndex + 1) % loopLen;
      safetyGuard++;
    }
  }

  private scheduleStep(
    track: TrackDef,
    idx: number,
    noteTime: number,
    stepDur: number,
    dest: GainNode,
  ): void {
    // Melody lead
    const leadNote = track.lead[idx % track.lead.length];
    if (leadNote !== null && leadNote > 0) {
      const span = countNoteSpanSteps(track.lead, idx % track.lead.length);
      this.synth.playMusicNote(
        midiToFreq(leadNote),
        noteTime,
        span * stepDur,
        track.leadConfig,
        dest,
      );
    }

    // Bassline
    const bassNote = track.bass[idx % track.bass.length];
    if (bassNote !== null && bassNote > 0) {
      const span = countNoteSpanSteps(track.bass, idx % track.bass.length);
      this.synth.playMusicNote(
        midiToFreq(bassNote),
        noteTime,
        span * stepDur,
        track.bassConfig,
        dest,
      );
    }

    // Arpeggio / Harmony
    const arpNote = track.arp[idx % track.arp.length];
    if (arpNote !== null && arpNote > 0) {
      const span = countNoteSpanSteps(track.arp, idx % track.arp.length);
      this.synth.playMusicNote(
        midiToFreq(arpNote),
        noteTime,
        span * stepDur,
        track.arpConfig,
        dest,
      );
    }

    // Percussion pulse
    const drumHit = track.drums[idx % track.drums.length];
    if (drumHit && drumHit !== '.') {
      this.synth.playMusicDrum(drumHit, noteTime, track.drumVolume, dest);
    }
  }
}

export function createAudioEngine(): IAudioEngine {
  return new AudioEngine();
}
