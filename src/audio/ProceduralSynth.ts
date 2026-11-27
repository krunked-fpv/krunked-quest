/**
 * Tactile 16-bit Chiptune / Action Web Audio Synthesizer
 * - Master bus -> Compressor/Limiter -> MasterGain -> Destination (zero clipping!)
 * - Dedicated SFX & Music gain buses + gentle dynamic ducking for fanfares
 * - Polyphony cap (max 12 concurrent SFX voices with priority eviction)
 * - Per-event micro-cooldowns (25..45ms), subtle ±4% pitch jitter, optional stereo panning
 * - Completely safe in headless / Node environments when AudioContext is undefined
 */

import type { AudioSettings, HeroFormId, SimEvent } from '../contracts/index';
import type { DrumHit, TrackChannelConfig } from './tracks';

const MAX_SFX_VOICES = 12;

type SfxPriority = 1 | 2 | 3; // 1 = ambient/repeated, 2 = gameplay action, 3 = critical/fanfare

interface ActiveVoice {
  readonly id: number;
  readonly priority: SfxPriority;
  readonly endTime: number;
  readonly stop: () => void;
}

const EVENT_COOLDOWNS_MS: Readonly<Record<SimEvent['type'], number>> = {
  jump: 35,
  land: 40,
  wall_jump: 35,
  dash: 40,
  ground_stomp: 35,
  tongue_lash: 30,
  stomp_start: 40,
  stomp_impact: 35,
  uppercut: 40,
  enemy_hit: 30,
  boss_hit: 35,
  boss_defeated: 25,
  hero_hurt: 25,
  hero_dead: 25,
  heal: 25,
  crystal_pickup: 30,
  coin_pickup: 25,
  combo_max: 25,
  form_switch: 45,
  block_break: 35,
  bounce_pad: 40,
  room_change: 45,
  shop_interact: 45,
  teleporter_unlock: 25,
  victory: 25,
};

const CRYSTAL_PENTATONIC_SEMITONES = [0, 2, 4, 7, 9, 12, 14, 16] as const;

type AudioContextCtor = typeof AudioContext;

function getAudioContextCtor(): AudioContextCtor | null {
  const g = globalThis as unknown as {
    AudioContext?: AudioContextCtor;
    webkitAudioContext?: AudioContextCtor;
  };
  return g.AudioContext ?? g.webkitAudioContext ?? null;
}

function clamp(v: number, min: number, max: number): number {
  return v < min ? min : v > max ? max : v;
}

function nowMs(): number {
  if (typeof performance !== 'undefined' && typeof performance.now === 'function') {
    return performance.now();
  }
  return Date.now();
}

export class ProceduralSynth {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private compressor: DynamicsCompressorNode | null = null;
  private sfxGain: GainNode | null = null;
  private musicGain: GainNode | null = null;
  private musicDuckGain: GainNode | null = null;

  private whiteNoiseBuffer: AudioBuffer | null = null;
  private retroNoiseBuffer: AudioBuffer | null = null;

  private activeVoices: ActiveVoice[] = [];
  private nextVoiceId = 1;
  private lastEventTimeMs = new Map<string, number>();

  private crystalStreak = 0;
  private lastCrystalMs = 0;

  private settings: AudioSettings;
  private disposed = false;

  constructor(initialSettings: AudioSettings) {
    this.settings = { ...initialSettings };
  }

  public get isSupported(): boolean {
    return getAudioContextCtor() !== null;
  }

  public get isRunning(): boolean {
    return this.ctx !== null && this.ctx.state === 'running';
  }

  public getContext(): AudioContext | null {
    return this.ctx;
  }

  public getMusicBus(): GainNode | null {
    return this.musicDuckGain;
  }

  /**
   * Lazily initializes and resumes the Web Audio context on user gesture.
   * Safe no-op in headless/Node environments.
   */
  public unlock(): boolean {
    if (this.disposed) return false;
    const ctx = this.ensureContext();
    if (!ctx) return false;
    if (ctx.state === 'suspended' && typeof ctx.resume === 'function') {
      void ctx.resume().catch(() => {
        // Ignore browser autoplay rejection until a real gesture triggers unlock again.
      });
    }
    this.applyVolumes();
    return true;
  }

  public updateSettings(next: AudioSettings): void {
    this.settings = {
      masterVolume: clamp(next.masterVolume, 0, 1),
      sfxVolume: clamp(next.sfxVolume, 0, 1),
      musicVolume: clamp(next.musicVolume, 0, 1),
      muted: Boolean(next.muted),
    };
    this.applyVolumes();
  }

  public getSettings(): AudioSettings {
    return { ...this.settings };
  }

  /**
   * Temporarily ducks background music for dramatic fanfares (boss defeated, victory, etc.).
   */
  public duckMusic(duckLevel = 0.28, holdSec = 0.75, recoverSec = 0.45): void {
    if (!this.ctx || !this.musicDuckGain) return;
    const t = this.ctx.currentTime;
    const gain = this.musicDuckGain.gain;
    try {
      gain.cancelScheduledValues(t);
      gain.setValueAtTime(Math.max(0.01, gain.value), t);
      gain.linearRampToValueAtTime(clamp(duckLevel, 0.05, 1), t + 0.04);
      gain.setValueAtTime(clamp(duckLevel, 0.05, 1), t + 0.04 + holdSec);
      gain.linearRampToValueAtTime(1.0, t + 0.04 + holdSec + recoverSec);
    } catch {
      gain.value = 1.0;
    }
  }

  /**
   * Main dispatcher for all SimEvents with cooldown throttling and optional stereo pan.
   */
  public playEvent(event: SimEvent, pan = 0): void {
    if (this.disposed) return;
    if (this.settings.muted || this.settings.masterVolume <= 0 || this.settings.sfxVolume <= 0) {
      return;
    }
    const ctx = this.ctx;
    if (!ctx || ctx.state !== 'running') {
      return;
    }

    const tMs = nowMs();
    const cooldown = EVENT_COOLDOWNS_MS[event.type];
    const lastMs = this.lastEventTimeMs.get(event.type) ?? -Infinity;
    if (tMs - lastMs < cooldown) {
      return;
    }
    this.lastEventTimeMs.set(event.type, tMs);

    const clampedPan = clamp(pan, -0.8, 0.8);

    switch (event.type) {
      case 'jump':
        this.sfxJump(event.air, event.form, clampedPan);
        break;
      case 'land':
        this.sfxLand(event.heavy, clampedPan);
        break;
      case 'wall_jump':
        this.sfxWallJump(event.dir, clampedPan);
        break;
      case 'dash':
        this.sfxDash(event.kind, clampedPan);
        break;
      case 'ground_stomp':
        this.sfxGroundStomp(event.fiery, clampedPan);
        break;
      case 'tongue_lash':
        this.sfxTongueLash(event.kind, clampedPan);
        break;
      case 'stomp_start':
        this.sfxStompStart(clampedPan);
        break;
      case 'stomp_impact':
        this.sfxStompImpact(event.explosive, clampedPan);
        break;
      case 'uppercut':
        this.sfxUppercut(clampedPan);
        break;
      case 'enemy_hit':
        this.sfxEnemyHit(event.killed, event.combo, clampedPan);
        break;
      case 'boss_hit':
        this.sfxBossHit(event.hp, event.maxHp, clampedPan);
        break;
      case 'boss_defeated':
        this.sfxBossDefeated(clampedPan);
        break;
      case 'hero_hurt':
        this.sfxHeroHurt(event.shieldBlocked, clampedPan);
        break;
      case 'hero_dead':
        this.sfxHeroDead();
        break;
      case 'heal':
        this.sfxHeal();
        break;
      case 'crystal_pickup':
        this.sfxCrystalPickup(event.value, tMs, clampedPan);
        break;
      case 'coin_pickup':
        this.sfxCoinPickup(clampedPan);
        break;
      case 'combo_max':
        this.sfxComboMax();
        break;
      case 'form_switch':
        this.sfxFormSwitch(event.form);
        break;
      case 'block_break':
        this.sfxBlockBreak(event.explosive, clampedPan);
        break;
      case 'bounce_pad':
        this.sfxBouncePad(clampedPan);
        break;
      case 'room_change':
        this.sfxRoomChange();
        break;
      case 'shop_interact':
        this.sfxShopInteract();
        break;
      case 'teleporter_unlock':
        this.sfxTeleporterUnlock();
        break;
      case 'victory':
        this.sfxVictory();
        break;
      default: {
        const exhaustive: never = event;
        void exhaustive;
        break;
      }
    }
  }

  // ==========================================================================
  // Music Sequencer Voice Synthesis (Scheduled on Web Audio Clock)
  // ==========================================================================

  public playMusicNote(
    freq: number,
    startTime: number,
    durationSec: number,
    config: TrackChannelConfig,
    destination: AudioNode,
  ): void {
    const ctx = this.ctx;
    if (!ctx || this.disposed || freq <= 0 || durationSec <= 0.005) return;

    const osc = ctx.createOscillator();
    osc.type = config.wave;
    osc.frequency.setValueAtTime(freq, startTime);
    if (config.detuneCents) {
      osc.detune.setValueAtTime(config.detuneCents, startTime);
    }

    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(config.filterHz, startTime);
    filter.Q.setValueAtTime(0.8, startTime);

    const env = ctx.createGain();
    const atk = Math.min(config.attackSec, durationSec * 0.35);
    const rel = Math.min(config.releaseSec, Math.max(0.02, durationSec * 0.5));
    const gateEnd = startTime + Math.max(atk + 0.01, durationSec * config.gateRatio);
    const stopTime = gateEnd + rel + 0.015;

    env.gain.setValueAtTime(0.0001, startTime);
    env.gain.linearRampToValueAtTime(config.volume, startTime + atk);
    env.gain.setValueAtTime(config.volume * 0.86, gateEnd);
    env.gain.exponentialRampToValueAtTime(0.0001, gateEnd + rel);

    let lfo: OscillatorNode | null = null;
    let lfoGain: GainNode | null = null;
    if (config.vibratoHz && config.vibratoCents && durationSec > 0.2) {
      lfo = ctx.createOscillator();
      lfoGain = ctx.createGain();
      lfo.frequency.setValueAtTime(config.vibratoHz, startTime);
      lfoGain.gain.setValueAtTime(0, startTime);
      lfoGain.gain.linearRampToValueAtTime(config.vibratoCents, startTime + 0.14);
      lfo.connect(lfoGain);
      lfoGain.connect(osc.detune);
      lfo.start(startTime);
      lfo.stop(stopTime);
    }

    osc.connect(filter);
    filter.connect(env);
    const panner = this.connectWithPan(env, destination, config.pan ?? 0);

    osc.onended = () => {
      osc.disconnect();
      filter.disconnect();
      env.disconnect();
      if (panner) panner.disconnect();
      if (lfo) lfo.disconnect();
      if (lfoGain) lfoGain.disconnect();
    };

    osc.start(startTime);
    osc.stop(stopTime);
  }

  public playMusicDrum(
    hit: DrumHit,
    startTime: number,
    volume: number,
    destination: AudioNode,
  ): void {
    const ctx = this.ctx;
    if (!ctx || this.disposed || hit === '.' || volume <= 0) return;

    if (hit === 'B') {
      this.scheduleKick(startTime, volume, destination);
      this.scheduleHat(startTime, volume * 0.45, 0.032, destination);
      return;
    }
    if (hit === 'X') {
      this.scheduleKick(startTime, volume, destination);
      this.scheduleSnare(startTime, volume * 0.85, destination);
      return;
    }

    switch (hit) {
      case 'K':
        this.scheduleKick(startTime, volume, destination);
        break;
      case 'S':
        this.scheduleSnare(startTime, volume * 0.85, destination);
        break;
      case 'H':
        this.scheduleHat(startTime, volume * 0.42, 0.03, destination);
        break;
      case 'O':
        this.scheduleHat(startTime, volume * 0.48, 0.125, destination);
        break;
      case 'T':
        this.scheduleTom(startTime, volume * 0.85, 165, 72, 0.135, destination);
        break;
      case 'M':
        this.scheduleTom(startTime, volume * 0.78, 255, 128, 0.105, destination);
        break;
      case 'C':
        this.scheduleHat(startTime, volume * 0.56, 0.28, destination);
        break;
      case 'P':
        this.scheduleTom(startTime, volume * 0.55, 740, 560, 0.038, destination);
        break;
    }
  }

  public dispose(): void {
    if (this.disposed) return;
    this.disposed = true;

    for (const voice of this.activeVoices) {
      try {
        voice.stop();
      } catch {
        // Ignore already-stopped nodes.
      }
    }
    this.activeVoices = [];
    this.lastEventTimeMs.clear();

    if (this.ctx) {
      const ctxToClose = this.ctx;
      const busNodes: Array<AudioNode | null> = [
        this.sfxGain,
        this.musicDuckGain,
        this.musicGain,
        this.compressor,
        this.masterGain,
      ];
      for (const node of busNodes) {
        if (node) {
          try {
            node.disconnect();
          } catch {
            // Ignore already-disconnected bus nodes.
          }
        }
      }
      this.ctx = null;
      this.masterGain = null;
      this.compressor = null;
      this.sfxGain = null;
      this.musicGain = null;
      this.musicDuckGain = null;
      this.whiteNoiseBuffer = null;
      this.retroNoiseBuffer = null;

      if (typeof ctxToClose.close === 'function') {
        void ctxToClose.close().catch(() => {
          // Ignore close errors in restricted environments.
        });
      }
    }
  }

  // ==========================================================================
  // Internal Audio Graph & Polyphony Helpers
  // ==========================================================================

  private ensureContext(): AudioContext | null {
    if (this.ctx) return this.ctx;
    const Ctor = getAudioContextCtor();
    if (!Ctor) return null;

    try {
      const ctx = new Ctor();
      const masterGain = ctx.createGain();
      const compressor = ctx.createDynamicsCompressor();
      const sfxGain = ctx.createGain();
      const musicGain = ctx.createGain();
      const musicDuckGain = ctx.createGain();

      // Tight transparent bus limiter so rapid stomps & crystal trails never clip
      compressor.threshold.setValueAtTime(-12, ctx.currentTime);
      compressor.knee.setValueAtTime(10, ctx.currentTime);
      compressor.ratio.setValueAtTime(12, ctx.currentTime);
      compressor.attack.setValueAtTime(0.002, ctx.currentTime);
      compressor.release.setValueAtTime(0.1, ctx.currentTime);

      musicDuckGain.gain.setValueAtTime(1.0, ctx.currentTime);

      sfxGain.connect(compressor);
      musicDuckGain.connect(musicGain);
      musicGain.connect(compressor);
      compressor.connect(masterGain);
      masterGain.connect(ctx.destination);

      this.ctx = ctx;
      this.masterGain = masterGain;
      this.compressor = compressor;
      this.sfxGain = sfxGain;
      this.musicGain = musicGain;
      this.musicDuckGain = musicDuckGain;

      this.whiteNoiseBuffer = this.createWhiteNoiseBuffer(ctx, 1.0);
      this.retroNoiseBuffer = this.createRetroNoiseBuffer(ctx, 0.5);
      this.applyVolumes();
      return ctx;
    } catch {
      return null;
    }
  }

  private applyVolumes(): void {
    if (!this.ctx || !this.masterGain || !this.sfxGain || !this.musicGain) return;
    const t = this.ctx.currentTime;
    const masterTarget = this.settings.muted ? 0 : this.settings.masterVolume;
    const sfxTarget = this.settings.sfxVolume;
    const musicTarget = this.settings.musicVolume;

    this.setGainSmooth(this.masterGain, masterTarget, t);
    this.setGainSmooth(this.sfxGain, sfxTarget, t);
    this.setGainSmooth(this.musicGain, musicTarget, t);
  }

  private setGainSmooth(node: GainNode, value: number, time: number): void {
    try {
      node.gain.setTargetAtTime(value, time, 0.015);
    } catch {
      node.gain.value = value;
    }
  }

  private createWhiteNoiseBuffer(ctx: AudioContext, durationSec: number): AudioBuffer {
    const length = Math.max(1, Math.floor(ctx.sampleRate * durationSec));
    const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    // Deterministic xorshift32 noise so audio buffers build fast with uniform spectrum
    let seed = 0x51a7c3d9;
    for (let i = 0; i < length; i++) {
      seed ^= seed << 13;
      seed ^= seed >>> 17;
      seed ^= seed << 5;
      data[i] = ((seed >>> 0) / 0xffffffff) * 2 - 1;
    }
    return buffer;
  }

  private createRetroNoiseBuffer(ctx: AudioContext, durationSec: number): AudioBuffer {
    // 15-bit LFSR stepped retro noise for crunchy 16-bit impacts and explosions
    const length = Math.max(1, Math.floor(ctx.sampleRate * durationSec));
    const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    let lfsr = 0x7fff;
    const holdSamples = Math.max(2, Math.floor(ctx.sampleRate / 11025));
    let held = 1;
    for (let i = 0; i < length; i++) {
      if (i % holdSamples === 0) {
        const bit = ((lfsr >> 0) ^ (lfsr >> 1)) & 1;
        lfsr = (lfsr >> 1) | (bit << 14);
        held = (lfsr & 1) ? 0.9 : -0.9;
      }
      data[i] = held;
    }
    return buffer;
  }

  private jitter(range = 0.04): number {
    return 1 + (Math.random() * 2 - 1) * range;
  }

  private connectWithPan(
    source: AudioNode,
    destination: AudioNode,
    pan: number,
  ): StereoPannerNode | null {
    const ctx = this.ctx;
    if (ctx && Math.abs(pan) > 0.01 && typeof ctx.createStereoPanner === 'function') {
      const panner = ctx.createStereoPanner();
      panner.pan.setValueAtTime(clamp(pan, -1, 1), ctx.currentTime);
      source.connect(panner);
      panner.connect(destination);
      return panner;
    }
    source.connect(destination);
    return null;
  }

  private acquireVoiceSlot(priority: SfxPriority, endTime: number, stopFn: () => void): boolean {
    const now = this.ctx?.currentTime ?? 0;
    this.activeVoices = this.activeVoices.filter((v) => v.endTime > now);

    if (this.activeVoices.length >= MAX_SFX_VOICES) {
      let evictIndex = -1;
      for (let i = 0; i < this.activeVoices.length; i++) {
        const candidate = this.activeVoices[i];
        if (candidate.priority <= priority) {
          if (
            evictIndex === -1 ||
            candidate.priority < this.activeVoices[evictIndex].priority ||
            (candidate.priority === this.activeVoices[evictIndex].priority &&
              candidate.endTime < this.activeVoices[evictIndex].endTime)
          ) {
            evictIndex = i;
          }
        }
      }

      if (evictIndex === -1) {
        return false;
      }
      const [evicted] = this.activeVoices.splice(evictIndex, 1);
      try {
        evicted.stop();
      } catch {
        // Ignore stop errors.
      }
    }

    const id = this.nextVoiceId++;
    this.activeVoices.push({ id, priority, endTime, stop: stopFn });
    return true;
  }

  private spawnTone(opts: {
    wave: OscillatorType;
    startFreq: number;
    endFreq?: number;
    startTime: number;
    duration: number;
    gain: number;
    attack?: number;
    filterHz?: number;
    pan?: number;
    priority?: SfxPriority;
    exponentialFreq?: boolean;
  }): void {
    const ctx = this.ctx;
    const dest = this.sfxGain;
    if (!ctx || !dest) return;

    const endTime = opts.startTime + opts.duration + 0.02;
    const osc = ctx.createOscillator();
    const env = ctx.createGain();
    let filter: BiquadFilterNode | null = null;

    const stopNow = () => {
      try {
        const t = ctx.currentTime;
        env.gain.cancelScheduledValues(t);
        env.gain.setTargetAtTime(0.0001, t, 0.004);
        osc.stop(t + 0.015);
      } catch {
        // Ignore already-stopped oscillator.
      }
    };

    if (!this.acquireVoiceSlot(opts.priority ?? 2, endTime, stopNow)) {
      return;
    }

    osc.type = opts.wave;
    const f0 = Math.max(20, opts.startFreq);
    osc.frequency.setValueAtTime(f0, opts.startTime);
    if (opts.endFreq !== undefined) {
      const f1 = Math.max(20, opts.endFreq);
      if (opts.exponentialFreq !== false) {
        osc.frequency.exponentialRampToValueAtTime(f1, opts.startTime + opts.duration);
      } else {
        osc.frequency.linearRampToValueAtTime(f1, opts.startTime + opts.duration);
      }
    }

    const atk = Math.min(opts.attack ?? 0.004, opts.duration * 0.4);
    env.gain.setValueAtTime(0.0001, opts.startTime);
    env.gain.linearRampToValueAtTime(opts.gain, opts.startTime + atk);
    env.gain.exponentialRampToValueAtTime(0.0001, opts.startTime + opts.duration);

    if (opts.filterHz !== undefined) {
      filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(opts.filterHz, opts.startTime);
      osc.connect(filter);
      filter.connect(env);
    } else {
      osc.connect(env);
    }

    const panner = this.connectWithPan(env, dest, opts.pan ?? 0);

    osc.onended = () => {
      osc.disconnect();
      if (filter) filter.disconnect();
      env.disconnect();
      if (panner) panner.disconnect();
    };

    osc.start(opts.startTime);
    osc.stop(endTime);
  }

  private spawnNoise(opts: {
    startTime: number;
    duration: number;
    gain: number;
    filterType: BiquadFilterType;
    startHz: number;
    endHz?: number;
    q?: number;
    retro?: boolean;
    pan?: number;
    priority?: SfxPriority;
  }): void {
    const ctx = this.ctx;
    const dest = this.sfxGain;
    const buffer = opts.retro ? this.retroNoiseBuffer : this.whiteNoiseBuffer;
    if (!ctx || !dest || !buffer) return;

    const endTime = opts.startTime + opts.duration + 0.02;
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    src.loop = true;

    const filter = ctx.createBiquadFilter();
    filter.type = opts.filterType;
    filter.frequency.setValueAtTime(Math.max(40, opts.startHz), opts.startTime);
    if (opts.endHz !== undefined) {
      filter.frequency.exponentialRampToValueAtTime(
        Math.max(40, opts.endHz),
        opts.startTime + opts.duration,
      );
    }
    if (opts.q !== undefined) {
      filter.Q.setValueAtTime(opts.q, opts.startTime);
    }

    const env = ctx.createGain();
    const atk = Math.min(0.004, opts.duration * 0.25);
    env.gain.setValueAtTime(0.0001, opts.startTime);
    env.gain.linearRampToValueAtTime(opts.gain, opts.startTime + atk);
    env.gain.exponentialRampToValueAtTime(0.0001, opts.startTime + opts.duration);

    const stopNow = () => {
      try {
        const t = ctx.currentTime;
        env.gain.cancelScheduledValues(t);
        env.gain.setTargetAtTime(0.0001, t, 0.004);
        src.stop(t + 0.015);
      } catch {
        // Ignore already-stopped source.
      }
    };

    if (!this.acquireVoiceSlot(opts.priority ?? 2, endTime, stopNow)) {
      return;
    }

    src.connect(filter);
    filter.connect(env);
    const panner = this.connectWithPan(env, dest, opts.pan ?? 0);

    src.onended = () => {
      src.disconnect();
      filter.disconnect();
      env.disconnect();
      if (panner) panner.disconnect();
    };

    const offset = Math.random() * Math.max(0.01, buffer.duration - 0.05);
    src.start(opts.startTime, offset);
    src.stop(endTime);
  }

  // ==========================================================================
  // Music Drum Helpers
  // ==========================================================================

  private scheduleKick(t: number, vol: number, dest: AudioNode): void {
    const ctx = this.ctx;
    if (!ctx) return;
    const osc = ctx.createOscillator();
    const env = ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(145, t);
    osc.frequency.exponentialRampToValueAtTime(44, t + 0.085);
    env.gain.setValueAtTime(vol, t);
    env.gain.exponentialRampToValueAtTime(0.0001, t + 0.095);
    osc.connect(env);
    env.connect(dest);
    osc.onended = () => {
      osc.disconnect();
      env.disconnect();
    };
    osc.start(t);
    osc.stop(t + 0.11);
  }

  private scheduleSnare(t: number, vol: number, dest: AudioNode): void {
    const ctx = this.ctx;
    if (!ctx || !this.retroNoiseBuffer) return;

    const src = ctx.createBufferSource();
    src.buffer = this.retroNoiseBuffer;
    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(1950, t);
    filter.Q.setValueAtTime(0.9, t);
    const env = ctx.createGain();
    env.gain.setValueAtTime(vol * 0.78, t);
    env.gain.exponentialRampToValueAtTime(0.0001, t + 0.105);
    src.connect(filter);
    filter.connect(env);
    env.connect(dest);
    src.onended = () => {
      src.disconnect();
      filter.disconnect();
      env.disconnect();
    };
    src.start(t);
    src.stop(t + 0.12);

    // Snare body snap
    const osc = ctx.createOscillator();
    const bEnv = ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(210, t);
    osc.frequency.exponentialRampToValueAtTime(110, t + 0.045);
    bEnv.gain.setValueAtTime(vol * 0.45, t);
    bEnv.gain.exponentialRampToValueAtTime(0.0001, t + 0.055);
    osc.connect(bEnv);
    bEnv.connect(dest);
    osc.onended = () => {
      osc.disconnect();
      bEnv.disconnect();
    };
    osc.start(t);
    osc.stop(t + 0.065);
  }

  private scheduleHat(t: number, vol: number, dur: number, dest: AudioNode): void {
    const ctx = this.ctx;
    if (!ctx || !this.whiteNoiseBuffer) return;
    const src = ctx.createBufferSource();
    src.buffer = this.whiteNoiseBuffer;
    const filter = ctx.createBiquadFilter();
    filter.type = 'highpass';
    filter.frequency.setValueAtTime(6500, t);
    const env = ctx.createGain();
    env.gain.setValueAtTime(vol, t);
    env.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(filter);
    filter.connect(env);
    env.connect(dest);
    src.onended = () => {
      src.disconnect();
      filter.disconnect();
      env.disconnect();
    };
    src.start(t);
    src.stop(t + dur + 0.015);
  }

  private scheduleTom(
    t: number,
    vol: number,
    startHz: number,
    endHz: number,
    dur: number,
    dest: AudioNode,
  ): void {
    const ctx = this.ctx;
    if (!ctx) return;
    const osc = ctx.createOscillator();
    const env = ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(startHz, t);
    osc.frequency.exponentialRampToValueAtTime(endHz, t + dur);
    env.gain.setValueAtTime(vol, t);
    env.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(env);
    env.connect(dest);
    osc.onended = () => {
      osc.disconnect();
      env.disconnect();
    };
    osc.start(t);
    osc.stop(t + dur + 0.015);
  }

  // ==========================================================================
  // Tactile 16-bit SFX Implementations (All 23 SimEvent Variants)
  // ==========================================================================

  private sfxJump(air: boolean, form: HeroFormId, pan: number): void {
    const t = this.ctx!.currentTime;
    const j = this.jitter(0.04);
    const formPitch =
      form === 'krunk_rock'
        ? 0.86
        : form === 'krunk_leaf'
          ? 1.12
          : form === 'krunk_electric'
            ? 1.18
            : form === 'krunk_shadow'
              ? 0.94
              : 1.0;

    if (air) {
      // Crisp double/air jump dual-blip
      this.spawnTone({
        wave: 'square',
        startFreq: 350 * formPitch * j,
        endFreq: 760 * formPitch * j,
        startTime: t,
        duration: 0.085,
        gain: 0.16,
        filterHz: 3200,
        pan,
        priority: 2,
      });
      this.spawnTone({
        wave: 'triangle',
        startFreq: 520 * formPitch * j,
        endFreq: 980 * formPitch * j,
        startTime: t + 0.032,
        duration: 0.085,
        gain: 0.14,
        pan,
        priority: 2,
      });
    } else {
      // Snappy rising square/triangle ground jump blip
      this.spawnTone({
        wave: 'square',
        startFreq: 225 * formPitch * j,
        endFreq: 560 * formPitch * j,
        startTime: t,
        duration: 0.105,
        gain: 0.15,
        filterHz: 2900,
        pan,
        priority: 2,
      });
      this.spawnTone({
        wave: 'triangle',
        startFreq: 185 * formPitch * j,
        endFreq: 420 * formPitch * j,
        startTime: t,
        duration: 0.09,
        gain: 0.14,
        pan,
        priority: 1,
      });
    }
  }

  private sfxLand(heavy: boolean, pan: number): void {
    const t = this.ctx!.currentTime;
    const j = this.jitter(0.04);
    if (heavy) {
      this.spawnTone({
        wave: 'triangle',
        startFreq: 120 * j,
        endFreq: 38 * j,
        startTime: t,
        duration: 0.14,
        gain: 0.28,
        pan,
        priority: 2,
      });
      this.spawnNoise({
        startTime: t,
        duration: 0.095,
        gain: 0.18,
        filterType: 'lowpass',
        startHz: 920,
        endHz: 220,
        retro: true,
        pan,
        priority: 1,
      });
    } else {
      this.spawnTone({
        wave: 'triangle',
        startFreq: 138 * j,
        endFreq: 56 * j,
        startTime: t,
        duration: 0.055,
        gain: 0.12,
        pan,
        priority: 1,
      });
      this.spawnNoise({
        startTime: t,
        duration: 0.032,
        gain: 0.06,
        filterType: 'bandpass',
        startHz: 650,
        q: 1.2,
        pan,
        priority: 1,
      });
    }
  }

  private sfxWallJump(dir: -1 | 1, pan: number): void {
    const t = this.ctx!.currentTime;
    const j = this.jitter(0.035);
    const wallPan = clamp(pan - dir * 0.22, -0.8, 0.8);
    // Snappy dual-tone spring kick
    this.spawnTone({
      wave: 'square',
      startFreq: 270 * j,
      endFreq: 490 * j,
      startTime: t,
      duration: 0.055,
      gain: 0.15,
      filterHz: 3000,
      pan: wallPan,
      priority: 2,
    });
    this.spawnTone({
      wave: 'triangle',
      startFreq: 480 * j,
      endFreq: 860 * j,
      startTime: t + 0.035,
      duration: 0.085,
      gain: 0.16,
      pan: wallPan,
      priority: 2,
    });
  }

  private sfxGroundStomp(fiery: boolean, pan: number): void {
    const t = this.ctx!.currentTime;
    const j = this.jitter(0.04);
    // Elastic downward tongue slam + upward spring pop
    this.spawnTone({
      wave: 'triangle',
      startFreq: 195 * j,
      endFreq: 52 * j,
      startTime: t,
      duration: 0.11,
      gain: 0.25,
      pan,
      priority: 2,
    });
    this.spawnTone({
      wave: 'square',
      startFreq: 210 * j,
      endFreq: 640 * j,
      startTime: t + 0.02,
      duration: 0.12,
      gain: 0.15,
      filterHz: 2800,
      pan,
      priority: 2,
    });
    if (fiery) {
      this.spawnNoise({
        startTime: t,
        duration: 0.18,
        gain: 0.2,
        filterType: 'bandpass',
        startHz: 1500,
        endHz: 320,
        q: 1.1,
        retro: true,
        pan,
        priority: 2,
      });
    }
  }

  private sfxTongueLash(
    kind: 'ground_stomp' | 'ground_dash' | 'wall_dash' | 'air_stomp',
    pan: number,
  ): void {
    const t = this.ctx!.currentTime;
    const j = this.jitter(0.045);
    const startHz = kind === 'air_stomp' ? 520 : kind === 'wall_dash' ? 440 : 360;
    const endHz = kind === 'air_stomp' ? 160 : 880;
    this.spawnTone({
      wave: 'triangle',
      startFreq: startHz * j,
      endFreq: endHz * j,
      startTime: t,
      duration: 0.08,
      gain: 0.16,
      pan,
      priority: 2,
    });
    this.spawnNoise({
      startTime: t,
      duration: 0.055,
      gain: 0.11,
      filterType: 'bandpass',
      startHz: 1450,
      endHz: 620,
      q: 1.8,
      pan,
      priority: 1,
    });
  }

  private sfxDash(kind: 'ground' | 'wall' | 'fire' | 'volt' | 'shadow', pan: number): void {
    const t = this.ctx!.currentTime;
    const j = this.jitter(0.04);

    if (kind === 'fire') {
      // Roaring flame whoosh + blazing sawtooth surge
      this.spawnNoise({
        startTime: t,
        duration: 0.22,
        gain: 0.22,
        filterType: 'bandpass',
        startHz: 1600,
        endHz: 360,
        q: 1.1,
        retro: true,
        pan,
        priority: 2,
      });
      this.spawnTone({
        wave: 'sawtooth',
        startFreq: 185 * j,
        endFreq: 540 * j,
        startTime: t,
        duration: 0.16,
        gain: 0.16,
        filterHz: 2200,
        pan,
        priority: 2,
      });
    } else if (kind === 'volt') {
      // Crackling electric blitz zip
      this.spawnTone({
        wave: 'sawtooth',
        startFreq: 980 * j,
        endFreq: 2100 * j,
        startTime: t,
        duration: 0.06,
        gain: 0.15,
        filterHz: 4600,
        pan,
        priority: 2,
      });
      this.spawnTone({
        wave: 'square',
        startFreq: 1680 * j,
        endFreq: 620 * j,
        startTime: t + 0.045,
        duration: 0.09,
        gain: 0.14,
        filterHz: 4200,
        pan,
        priority: 2,
      });
      this.spawnNoise({
        startTime: t,
        duration: 0.11,
        gain: 0.15,
        filterType: 'highpass',
        startHz: 3400,
        pan,
        priority: 2,
      });
    } else if (kind === 'shadow') {
      // Phase-shift dark warp shimmer
      this.spawnNoise({
        startTime: t,
        duration: 0.18,
        gain: 0.16,
        filterType: 'bandpass',
        startHz: 2600,
        endHz: 280,
        q: 2.6,
        pan,
        priority: 2,
      });
      this.spawnTone({
        wave: 'triangle',
        startFreq: 520 * j,
        endFreq: 135 * j,
        startTime: t,
        duration: 0.17,
        gain: 0.18,
        pan,
        priority: 2,
      });
    } else {
      // Classic ground / wall dash air whoosh + zip
      const pitch = kind === 'wall' ? 1.18 : 1.0;
      this.spawnNoise({
        startTime: t,
        duration: 0.14,
        gain: 0.16,
        filterType: 'bandpass',
        startHz: 2200 * pitch,
        endHz: 520 * pitch,
        q: 1.4,
        pan,
        priority: 2,
      });
      this.spawnTone({
        wave: 'triangle',
        startFreq: 380 * pitch * j,
        endFreq: 150 * pitch * j,
        startTime: t,
        duration: 0.12,
        gain: 0.14,
        pan,
        priority: 2,
      });
    }
  }

  private sfxStompStart(pan: number): void {
    const t = this.ctx!.currentTime;
    const j = this.jitter(0.03);
    // Descending dive whistle
    this.spawnTone({
      wave: 'triangle',
      startFreq: 780 * j,
      endFreq: 210 * j,
      startTime: t,
      duration: 0.14,
      gain: 0.17,
      pan,
      priority: 2,
    });
    this.spawnTone({
      wave: 'square',
      startFreq: 860 * j,
      endFreq: 260 * j,
      startTime: t,
      duration: 0.11,
      gain: 0.08,
      filterHz: 2400,
      pan,
      priority: 1,
    });
  }

  private sfxStompImpact(explosive: boolean, pan: number): void {
    const t = this.ctx!.currentTime;
    const j = this.jitter(0.04);
    // Punchy bass slam
    this.spawnTone({
      wave: 'triangle',
      startFreq: 155 * j,
      endFreq: 34 * j,
      startTime: t,
      duration: 0.19,
      gain: 0.3,
      pan,
      priority: 2,
    });
    this.spawnNoise({
      startTime: t,
      duration: 0.12,
      gain: 0.21,
      filterType: 'lowpass',
      startHz: 1200,
      endHz: 180,
      retro: true,
      pan,
      priority: 2,
    });

    if (explosive) {
      // StompFlame blast layer
      this.spawnNoise({
        startTime: t + 0.015,
        duration: 0.28,
        gain: 0.24,
        filterType: 'bandpass',
        startHz: 950,
        endHz: 160,
        q: 0.9,
        retro: true,
        pan,
        priority: 3,
      });
      this.spawnTone({
        wave: 'sawtooth',
        startFreq: 220 * j,
        endFreq: 52 * j,
        startTime: t + 0.01,
        duration: 0.24,
        gain: 0.16,
        filterHz: 1300,
        pan,
        priority: 2,
      });
    }
  }

  private sfxUppercut(pan: number): void {
    const t = this.ctx!.currentTime;
    const j = this.jitter(0.035);
    // Metallic rising rock crunch
    this.spawnTone({
      wave: 'sawtooth',
      startFreq: 135 * j,
      endFreq: 640 * j,
      startTime: t,
      duration: 0.18,
      gain: 0.19,
      filterHz: 2600,
      pan,
      priority: 2,
    });
    this.spawnTone({
      wave: 'square',
      startFreq: 280 * j,
      endFreq: 960 * j,
      startTime: t + 0.02,
      duration: 0.15,
      gain: 0.12,
      filterHz: 3200,
      pan,
      priority: 2,
    });
    this.spawnNoise({
      startTime: t,
      duration: 0.15,
      gain: 0.19,
      filterType: 'bandpass',
      startHz: 750,
      endHz: 2200,
      q: 1.5,
      retro: true,
      pan,
      priority: 2,
    });
  }

  private sfxEnemyHit(killed: boolean, combo: number, pan: number): void {
    const t = this.ctx!.currentTime;
    const j = this.jitter(0.04);
    // Smooth musical pitch rise with combo count (caps gently around +14 semitones)
    const comboMult = Math.pow(2, Math.min(Math.max(0, combo), 16) / 14);

    this.spawnTone({
      wave: 'square',
      startFreq: 240 * comboMult * j,
      endFreq: (killed ? 660 : 120) * comboMult * j,
      startTime: t,
      duration: killed ? 0.11 : 0.085,
      gain: 0.19,
      filterHz: 3100,
      pan,
      priority: 2,
    });

    this.spawnNoise({
      startTime: t,
      duration: killed ? 0.11 : 0.075,
      gain: killed ? 0.2 : 0.15,
      filterType: 'bandpass',
      startHz: 1100 * Math.min(1.6, comboMult),
      endHz: 340,
      q: 1.0,
      retro: true,
      pan,
      priority: 2,
    });

    if (killed) {
      // Satisfying retro pop harmonic
      this.spawnTone({
        wave: 'triangle',
        startFreq: 440 * comboMult * j,
        endFreq: 880 * comboMult * j,
        startTime: t + 0.035,
        duration: 0.095,
        gain: 0.15,
        pan,
        priority: 2,
      });
    }
  }

  private sfxBossHit(hp: number, maxHp: number, pan: number): void {
    const t = this.ctx!.currentTime;
    const j = this.jitter(0.03);
    const damageRatio = maxHp > 0 ? clamp(1 - hp / maxHp, 0, 1) : 0;
    const urgencyMult = 1 + damageRatio * 0.25;

    // Heavy resonant slam
    this.spawnTone({
      wave: 'triangle',
      startFreq: 135 * urgencyMult * j,
      endFreq: 38 * j,
      startTime: t,
      duration: 0.22,
      gain: 0.3,
      pan,
      priority: 3,
    });
    this.spawnTone({
      wave: 'sawtooth',
      startFreq: 310 * urgencyMult * j,
      endFreq: 145 * j,
      startTime: t,
      duration: 0.16,
      gain: 0.18,
      filterHz: 2100,
      pan,
      priority: 3,
    });
    this.spawnNoise({
      startTime: t,
      duration: 0.16,
      gain: 0.22,
      filterType: 'lowpass',
      startHz: 1500,
      endHz: 200,
      retro: true,
      pan,
      priority: 2,
    });
  }

  private sfxBossDefeated(pan: number): void {
    const t = this.ctx!.currentTime;
    this.duckMusic(0.2, 1.05, 0.5);

    // Initial dramatic shatter boom
    this.spawnNoise({
      startTime: t,
      duration: 0.36,
      gain: 0.24,
      filterType: 'lowpass',
      startHz: 1600,
      endHz: 140,
      retro: true,
      pan,
      priority: 3,
    });
    this.spawnTone({
      wave: 'triangle',
      startFreq: 140,
      endFreq: 32,
      startTime: t,
      duration: 0.32,
      gain: 0.28,
      pan,
      priority: 3,
    });

    // Triumphant rising fanfare cascade (C5 -> E5 -> G5 -> B5 -> C6 + fifth shimmer)
    const cascade = [523.25, 659.25, 783.99, 987.77, 1046.5];
    for (let i = 0; i < cascade.length; i++) {
      const start = t + 0.16 + i * 0.085;
      const isLast = i === cascade.length - 1;
      this.spawnTone({
        wave: 'square',
        startFreq: cascade[i],
        startTime: start,
        duration: isLast ? 0.52 : 0.13,
        gain: isLast ? 0.18 : 0.14,
        filterHz: 3600,
        pan: (i - 2) * 0.12,
        priority: 3,
      });
    }
    this.spawnTone({
      wave: 'triangle',
      startFreq: 783.99,
      startTime: t + 0.5,
      duration: 0.52,
      gain: 0.15,
      pan: 0,
      priority: 3,
    });
  }

  private sfxHeroHurt(shieldBlocked: boolean, pan: number): void {
    const t = this.ctx!.currentTime;
    if (shieldBlocked) {
      // Bright metallic clang (inharmonic dual bell tones)
      this.spawnTone({
        wave: 'square',
        startFreq: 740,
        endFreq: 715,
        startTime: t,
        duration: 0.19,
        gain: 0.17,
        filterHz: 3800,
        pan,
        priority: 3,
      });
      this.spawnTone({
        wave: 'triangle',
        startFreq: 1145,
        endFreq: 1110,
        startTime: t,
        duration: 0.21,
        gain: 0.16,
        pan,
        priority: 3,
      });
      this.spawnNoise({
        startTime: t,
        duration: 0.055,
        gain: 0.12,
        filterType: 'highpass',
        startHz: 3600,
        pan,
        priority: 2,
      });
    } else {
      // Classic retro low crunch
      this.spawnTone({
        wave: 'sawtooth',
        startFreq: 250,
        endFreq: 82,
        startTime: t,
        duration: 0.22,
        gain: 0.22,
        filterHz: 1500,
        pan,
        priority: 3,
      });
      this.spawnTone({
        wave: 'square',
        startFreq: 180,
        endFreq: 68,
        startTime: t + 0.04,
        duration: 0.18,
        gain: 0.16,
        filterHz: 1200,
        pan,
        priority: 3,
      });
      this.spawnNoise({
        startTime: t,
        duration: 0.14,
        gain: 0.2,
        filterType: 'lowpass',
        startHz: 1100,
        endHz: 220,
        retro: true,
        pan,
        priority: 3,
      });
    }
  }

  private sfxHeroDead(): void {
    const t = this.ctx!.currentTime;
    this.duckMusic(0.15, 0.9, 0.5);
    // Classic descending retro defeat jingle (E4 -> D#4 -> D4 -> C4 -> G3)
    const notes = [329.63, 311.13, 293.66, 261.63, 196.0];
    const durs = [0.13, 0.13, 0.13, 0.15, 0.44];
    let cursor = t;
    for (let i = 0; i < notes.length; i++) {
      this.spawnTone({
        wave: 'square',
        startFreq: notes[i],
        endFreq: i === notes.length - 1 ? notes[i] * 0.88 : undefined,
        startTime: cursor,
        duration: durs[i],
        gain: 0.18,
        filterHz: 2400,
        priority: 3,
      });
      cursor += durs[i] * 0.88;
    }
  }

  private sfxHeal(): void {
    const t = this.ctx!.currentTime;
    // Sparkling major-9th arpeggio chime: C5, E5, G5, B5, D6, G6
    const notes = [523.25, 659.25, 783.99, 987.77, 1174.66, 1567.98];
    for (let i = 0; i < notes.length; i++) {
      const start = t + i * 0.048;
      this.spawnTone({
        wave: 'triangle',
        startFreq: notes[i],
        startTime: start,
        duration: i === notes.length - 1 ? 0.34 : 0.16,
        gain: 0.16,
        pan: (i - 2.5) * 0.1,
        priority: 3,
      });
      this.spawnTone({
        wave: 'sine',
        startFreq: notes[i] * 2,
        startTime: start,
        duration: 0.11,
        gain: 0.06,
        pan: (i - 2.5) * 0.12,
        priority: 1,
      });
    }
  }

  private sfxCrystalPickup(value: number, tMs: number, pan: number): void {
    const t = this.ctx!.currentTime;
    if (tMs - this.lastCrystalMs < 520) {
      this.crystalStreak = Math.min(CRYSTAL_PENTATONIC_SEMITONES.length - 1, this.crystalStreak + 1);
    } else {
      this.crystalStreak = 0;
    }
    this.lastCrystalMs = tMs;

    const semitone = CRYSTAL_PENTATONIC_SEMITONES[this.crystalStreak];
    const valueBoost = value >= 5 ? 1.12 : 1.0;
    const baseFreq = 880 * Math.pow(2, semitone / 12) * valueBoost * this.jitter(0.035);

    this.spawnTone({
      wave: 'triangle',
      startFreq: baseFreq,
      endFreq: baseFreq * 1.08,
      startTime: t,
      duration: 0.11,
      gain: 0.15,
      pan,
      priority: 1,
    });
    this.spawnTone({
      wave: 'sine',
      startFreq: baseFreq * 2,
      startTime: t + 0.015,
      duration: 0.09,
      gain: 0.08,
      pan,
      priority: 1,
    });
  }

  private sfxCoinPickup(pan: number): void {
    const t = this.ctx!.currentTime;
    // Iconic golden dual-note sparkle (B5 -> E6)
    this.spawnTone({
      wave: 'square',
      startFreq: 987.77,
      startTime: t,
      duration: 0.075,
      gain: 0.16,
      filterHz: 4200,
      pan,
      priority: 3,
    });
    this.spawnTone({
      wave: 'square',
      startFreq: 1318.51,
      startTime: t + 0.068,
      duration: 0.26,
      gain: 0.17,
      filterHz: 4600,
      pan,
      priority: 3,
    });
    this.spawnTone({
      wave: 'triangle',
      startFreq: 2637.02,
      startTime: t + 0.072,
      duration: 0.22,
      gain: 0.075,
      pan,
      priority: 2,
    });
  }

  private sfxComboMax(): void {
    const t = this.ctx!.currentTime;
    this.duckMusic(0.35, 0.55, 0.35);
    // Heroic chord fanfare: G4 -> C5 -> E5 -> G5 -> C6 wide triad
    const arp = [392.0, 523.25, 659.25, 783.99, 1046.5];
    for (let i = 0; i < arp.length; i++) {
      const start = t + i * 0.055;
      const last = i === arp.length - 1;
      this.spawnTone({
        wave: 'square',
        startFreq: arp[i],
        startTime: start,
        duration: last ? 0.42 : 0.12,
        gain: last ? 0.17 : 0.13,
        filterHz: 3800,
        pan: (i - 2) * 0.14,
        priority: 3,
      });
    }
    this.spawnTone({
      wave: 'triangle',
      startFreq: 659.25,
      startTime: t + 0.22,
      duration: 0.42,
      gain: 0.14,
      pan: -0.2,
      priority: 3,
    });
    this.spawnTone({
      wave: 'triangle',
      startFreq: 783.99,
      startTime: t + 0.22,
      duration: 0.42,
      gain: 0.14,
      pan: 0.2,
      priority: 3,
    });
  }

  private sfxFormSwitch(form: HeroFormId): void {
    const t = this.ctx!.currentTime;
    // Elemental morph shimmer per hero form
    const chords: Record<HeroFormId, readonly [number, number, number, OscillatorType]> = {
      krunk_basic: [440, 554.37, 659.25, 'triangle'],
      krunk_fire: [329.63, 440, 659.25, 'sawtooth'],
      krunk_leaf: [523.25, 659.25, 987.77, 'triangle'],
      krunk_rock: [196.0, 293.66, 392.0, 'sawtooth'],
      krunk_electric: [587.33, 880.0, 1318.51, 'square'],
      krunk_shadow: [311.13, 392.0, 587.33, 'triangle'],
    };
    const [f1, f2, f3, wave] = chords[form];
    this.spawnTone({
      wave,
      startFreq: f1,
      endFreq: f2,
      startTime: t,
      duration: 0.08,
      gain: 0.14,
      filterHz: 3200,
      pan: -0.15,
      priority: 2,
    });
    this.spawnTone({
      wave,
      startFreq: f2,
      endFreq: f3,
      startTime: t + 0.045,
      duration: 0.15,
      gain: 0.15,
      filterHz: 3600,
      pan: 0.15,
      priority: 2,
    });
  }

  private sfxBlockBreak(explosive: boolean, pan: number): void {
    const t = this.ctx!.currentTime;
    const j = this.jitter(0.04);
    if (explosive) {
      this.spawnTone({
        wave: 'triangle',
        startFreq: 130 * j,
        endFreq: 30,
        startTime: t,
        duration: 0.28,
        gain: 0.29,
        pan,
        priority: 3,
      });
      this.spawnNoise({
        startTime: t,
        duration: 0.3,
        gain: 0.24,
        filterType: 'lowpass',
        startHz: 1400,
        endHz: 150,
        retro: true,
        pan,
        priority: 3,
      });
    } else {
      // Crisp crumble burst
      this.spawnNoise({
        startTime: t,
        duration: 0.13,
        gain: 0.19,
        filterType: 'bandpass',
        startHz: 1050 * j,
        endHz: 320,
        q: 1.0,
        retro: true,
        pan,
        priority: 2,
      });
      this.spawnTone({
        wave: 'square',
        startFreq: 195 * j,
        endFreq: 75 * j,
        startTime: t,
        duration: 0.085,
        gain: 0.13,
        filterHz: 1400,
        pan,
        priority: 1,
      });
    }
  }

  private sfxBouncePad(pan: number): void {
    const ctx = this.ctx;
    const dest = this.sfxGain;
    if (!ctx || !dest) return;

    // Expressive boing FM sweep
    const t = ctx.currentTime;
    const dur = 0.24;
    const endTime = t + dur + 0.02;
    const carrier = ctx.createOscillator();
    const mod = ctx.createOscillator();
    const modGain = ctx.createGain();
    const env = ctx.createGain();

    const stopNow = () => {
      try {
        const now = ctx.currentTime;
        env.gain.cancelScheduledValues(now);
        env.gain.setTargetAtTime(0.0001, now, 0.004);
        carrier.stop(now + 0.015);
        mod.stop(now + 0.015);
      } catch {
        // Ignore stop errors.
      }
    };

    if (!this.acquireVoiceSlot(2, endTime, stopNow)) {
      return;
    }

    const j = this.jitter(0.035);
    carrier.type = 'triangle';
    carrier.frequency.setValueAtTime(165 * j, t);
    carrier.frequency.exponentialRampToValueAtTime(620 * j, t + 0.17);
    carrier.frequency.exponentialRampToValueAtTime(480 * j, t + dur);

    mod.type = 'sine';
    mod.frequency.setValueAtTime(28, t);
    modGain.gain.setValueAtTime(95, t);
    modGain.gain.exponentialRampToValueAtTime(8, t + dur);

    env.gain.setValueAtTime(0.0001, t);
    env.gain.linearRampToValueAtTime(0.24, t + 0.008);
    env.gain.exponentialRampToValueAtTime(0.0001, t + dur);

    mod.connect(modGain);
    modGain.connect(carrier.frequency);
    carrier.connect(env);
    const panner = this.connectWithPan(env, dest, pan);

    carrier.onended = () => {
      carrier.disconnect();
      mod.disconnect();
      modGain.disconnect();
      env.disconnect();
      if (panner) panner.disconnect();
    };

    carrier.start(t);
    mod.start(t);
    carrier.stop(endTime);
    mod.stop(endTime);
  }

  private sfxRoomChange(): void {
    const t = this.ctx!.currentTime;
    // Ultra-gentle airy room door transition shimmer
    this.spawnNoise({
      startTime: t,
      duration: 0.12,
      gain: 0.06,
      filterType: 'bandpass',
      startHz: 1100,
      endHz: 2200,
      q: 1.8,
      priority: 1,
    });
  }

  private sfxShopInteract(): void {
    const t = this.ctx!.currentTime;
    // Warm shopkeeper bell chime (E5 -> A5)
    this.spawnTone({
      wave: 'triangle',
      startFreq: 659.25,
      startTime: t,
      duration: 0.11,
      gain: 0.15,
      priority: 2,
    });
    this.spawnTone({
      wave: 'triangle',
      startFreq: 880.0,
      startTime: t + 0.075,
      duration: 0.22,
      gain: 0.17,
      priority: 2,
    });
  }

  private sfxTeleporterUnlock(): void {
    const t = this.ctx!.currentTime;
    this.duckMusic(0.4, 0.55, 0.35);
    // Shimmering portal activation cascade
    const notes = [293.66, 440.0, 587.33, 880.0, 1174.66];
    for (let i = 0; i < notes.length; i++) {
      this.spawnTone({
        wave: i % 2 === 0 ? 'triangle' : 'square',
        startFreq: notes[i],
        endFreq: notes[i] * 1.03,
        startTime: t + i * 0.075,
        duration: i === notes.length - 1 ? 0.38 : 0.16,
        gain: 0.14,
        filterHz: 3400,
        pan: (i - 2) * 0.15,
        priority: 3,
      });
    }
  }

  /**
   * Tactile 16-bit menu & UI audio feedback (cursor move, confirm, back, tab switch, error).
   */
  public playUiSfx(kind: 'move' | 'confirm' | 'back' | 'tab' | 'error'): void {
    if (this.disposed) return;
    if (this.settings.muted || this.settings.masterVolume <= 0 || this.settings.sfxVolume <= 0) {
      return;
    }
    const ctx = this.ctx;
    if (!ctx || ctx.state !== 'running') {
      return;
    }

    const tMs = nowMs();
    const key = `ui:${kind}`;
    const lastMs = this.lastEventTimeMs.get(key) ?? -Infinity;
    if (tMs - lastMs < 24) return;
    this.lastEventTimeMs.set(key, tMs);

    const t = ctx.currentTime;
    switch (kind) {
      case 'move':
        this.spawnTone({
          wave: 'triangle',
          startFreq: 640 * this.jitter(0.02),
          endFreq: 780,
          startTime: t,
          duration: 0.042,
          gain: 0.08,
          priority: 1,
        });
        break;
      case 'tab':
        this.spawnTone({
          wave: 'triangle',
          startFreq: 520,
          endFreq: 760,
          startTime: t,
          duration: 0.055,
          gain: 0.095,
          priority: 2,
        });
        break;
      case 'confirm':
        this.spawnTone({
          wave: 'triangle',
          startFreq: 587.33,
          startTime: t,
          duration: 0.06,
          gain: 0.11,
          priority: 2,
        });
        this.spawnTone({
          wave: 'triangle',
          startFreq: 880,
          endFreq: 932.33,
          startTime: t + 0.045,
          duration: 0.095,
          gain: 0.12,
          priority: 2,
        });
        break;
      case 'back':
        this.spawnTone({
          wave: 'triangle',
          startFreq: 520,
          endFreq: 330,
          startTime: t,
          duration: 0.075,
          gain: 0.095,
          priority: 2,
        });
        break;
      case 'error':
        this.spawnTone({
          wave: 'sawtooth',
          startFreq: 195,
          endFreq: 145,
          startTime: t,
          duration: 0.11,
          gain: 0.09,
          filterHz: 950,
          priority: 2,
        });
        break;
    }
  }

  private sfxVictory(): void {
    const t = this.ctx!.currentTime;
    this.duckMusic(0.25, 1.1, 0.5);
    // Grand heroic victory fanfare (D5 -> F#5 -> A5 -> D6 -> C#6 -> D6)
    const seq: ReadonlyArray<readonly [number, number, number]> = [
      [587.33, 0.0, 0.11],
      [739.99, 0.1, 0.11],
      [880.0, 0.2, 0.11],
      [1174.66, 0.31, 0.22],
      [1108.73, 0.52, 0.12],
      [1174.66, 0.64, 0.55],
    ];
    for (const [freq, offset, dur] of seq) {
      this.spawnTone({
        wave: 'square',
        startFreq: freq,
        startTime: t + offset,
        duration: dur,
        gain: 0.17,
        filterHz: 4000,
        priority: 3,
      });
    }
    // Warm harmony fifth on the final resolve
    this.spawnTone({
      wave: 'triangle',
      startFreq: 880.0,
      startTime: t + 0.64,
      duration: 0.55,
      gain: 0.15,
      pan: -0.18,
      priority: 3,
    });
    this.spawnTone({
      wave: 'triangle',
      startFreq: 739.99,
      startTime: t + 0.64,
      duration: 0.55,
      gain: 0.13,
      pan: 0.18,
      priority: 3,
    });
  }
}
