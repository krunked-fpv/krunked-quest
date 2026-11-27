import '../ui/styles.css';

import {
  DEFAULT_KEY_BINDINGS,
  FIXED_DT,
  HERO_FORMS,
  MAX_FRAME_DT,
  type AudioSettings,
  type BossId,
  type FpsLimitOption,
  type GameMode,
  type GameSettings,
  type HeroFormId,
  type IAssetPackManager,
  type IAudioEngine,
  type InputSettings,
  type IPixelRenderer,
  type ISimEngine,
  type IWorldCatalog,
  type KeyBindings,
  type KrunkedDebugBridge,
  type RelicId,
  type RenderSettings,
  type SaveData,
  type ScreenMode,
  type ShopId,
  type SimEvent,
  type SimState,
  type TouchLayoutConfig,
  type TouchVisibilitySetting,
  type UpgradeKey,
  type VirtualGamepadSnapshot,
} from '../contracts/index.js';
import { InputOrchestrator } from '../input/InputOrchestrator.js';
import { TouchOverlay } from '../input/TouchOverlay.js';
import { OverlayManager, type OverlayActions, type OverlayViewState } from '../ui/OverlayManager.js';
import { SaveManager, cloneGameSettings } from './SaveManager.js';

export interface GameAppDeps {
  sim: ISimEngine;
  catalog: IWorldCatalog;
  renderer: IPixelRenderer;
  audio: IAudioEngine;
  assets: IAssetPackManager;
  canvas: HTMLCanvasElement;
  uiRoot: HTMLElement;
  touchRoot: HTMLElement;
}

export class GameApp {
  private readonly _sim: ISimEngine;
  private readonly _catalog: IWorldCatalog;
  private readonly _renderer: IPixelRenderer;
  private readonly _audio: IAudioEngine;
  private readonly _assets: IAssetPackManager;
  private readonly _saveManager: SaveManager;
  private readonly _input: InputOrchestrator;
  private readonly _touchOverlay: TouchOverlay;
  private readonly _overlay: OverlayManager;

  private _state: SimState;
  private _settings: GameSettings;
  private _screenMode: ScreenMode = 'title';
  private _optionsReturnMode: 'title' | 'paused' = 'title';
  private _activeShop: ShopId | null = null;
  private _customPackMessage: string | null = null;
  private _toastMessage: string | null = null;
  private _toastTimer = 0;

  // Fixed-timestep & frame pacing state
  private _running = false;
  private _rafId = 0;
  private _lastFrameMs = 0;
  private _lastRenderMs = 0;
  private _accumulator = 0;
  private _renderTimestamps: number[] = [];
  private _measuredFps = 60;
  private _audioUnlocked = false;
  private _disposed = false;

  private readonly _unsubInput: () => void;

  private readonly _onGlobalKeyDown = (ev: KeyboardEvent) => {
    this._unlockAudioOnce();
    if (ev.code === 'F9') {
      ev.preventDefault();
      this._overlay.togglePlaytestDrawer();
    }
  };

  private readonly _onFirstGesture = () => {
    this._unlockAudioOnce();
  };

  constructor(deps: GameAppDeps) {
    this._sim = deps.sim;
    this._catalog = deps.catalog;
    this._renderer = deps.renderer;
    this._audio = deps.audio;
    this._assets = deps.assets;

    this._saveManager = new SaveManager();
    this._settings = this._saveManager.loadSettings();

    this._renderer.attach(deps.canvas);
    this._renderer.setPackManager(this._assets);
    this._audio.updateSettings(this._settings.audio);

    this._input = new InputOrchestrator({
      settings: this._settings.input,
    });
    this._touchOverlay = new TouchOverlay(deps.touchRoot, this._input);

    this._state = this._sim.createInitialState(this._catalog, { mode: 'story' });

    this._overlay = new OverlayManager(deps.uiRoot, this._createOverlayActions());

    this._unsubInput = this._input.subscribe((snap) => {
      this._settings.input = snap.settings;
      if (
        this._screenMode === 'title' ||
        this._screenMode === 'paused' ||
        (this._screenMode === 'shop' && this._activeShop === 'codex')
      ) {
        this._renderOverlay();
      } else {
        this._overlay.updateLiveOverlays(this._buildViewState());
      }
    });

    if (typeof window !== 'undefined') {
      window.addEventListener('keydown', this._onGlobalKeyDown);
      window.addEventListener('pointerdown', this._onFirstGesture, { passive: true });
      window.addEventListener('touchstart', this._onFirstGesture, { passive: true });
      window.__KRUNKED_DEBUG__ = this._createDebugBridge();
    }

    this._syncMusicContext();
    this._renderOverlay();
    this._renderSingleFrame(0);

    // Initialize asset pack manager (auto-enables local/cached custom pack unless user explicitly chose Built-In)
    void this._assets
      .init()
      .then(() => {
        if (this._disposed) return;
        const explicitPref = this._saveManager.getCustomPackPreference();
        const shouldUsePack = this._assets.customPackAvailable && explicitPref !== 'builtin';
        this._assets.setUseCustomPack(shouldUsePack);
        this._settings.render.useCustomPack = this._assets.customPackEnabled;
        this._renderOverlay();
        this._renderSingleFrame(
          typeof performance !== 'undefined' ? performance.now() / 1000 : 0,
        );
      })
      .catch(() => {
        // Built-in pixel atlas remains active on pack init errors
      });
  }

  start(): void {
    if (this._running || this._disposed) return;
    this._running = true;
    this._lastFrameMs = 0;
    this._lastRenderMs = 0;
    this._accumulator = 0;
    if (typeof requestAnimationFrame === 'function') {
      this._rafId = requestAnimationFrame(this._tickLoop);
    }
  }

  stop(): void {
    if (!this._running) return;
    this._running = false;
    if (this._rafId && typeof cancelAnimationFrame === 'function') {
      cancelAnimationFrame(this._rafId);
    }
    this._rafId = 0;
  }

  getScreenMode(): ScreenMode {
    return this._screenMode;
  }

  setScreenMode(mode: ScreenMode): void {
    if (this._screenMode === mode && mode !== 'shop') return;
    if (mode !== 'shop') {
      this._activeShop = null;
    }
    this._screenMode = mode;
    this._accumulator = 0;
    this._syncMusicContext();
    this._renderOverlay();
  }

  dispose(): void {
    if (this._disposed) return;
    this._disposed = true;
    this.stop();
    this._unsubInput();
    if (typeof window !== 'undefined') {
      window.removeEventListener('keydown', this._onGlobalKeyDown);
      window.removeEventListener('pointerdown', this._onFirstGesture);
      window.removeEventListener('touchstart', this._onFirstGesture);
      if (window.__KRUNKED_DEBUG__) {
        delete window.__KRUNKED_DEBUG__;
      }
    }
    this._touchOverlay.dispose();
    this._overlay.dispose();
    this._input.dispose();
    this._renderer.dispose();
    this._audio.dispose();
  }

  // --------------------------------------------------------------------------
  // Fixed 60Hz Sim + Decoupled 30/60/120 FPS Render Loop
  // --------------------------------------------------------------------------

  private readonly _tickLoop = (nowMs: number): void => {
    if (!this._running || this._disposed) return;
    this._rafId = requestAnimationFrame(this._tickLoop);

    const rawDt = this._lastFrameMs > 0 ? (nowMs - this._lastFrameMs) / 1000 : FIXED_DT;
    this._lastFrameMs = nowMs;
    const dt = Math.min(Math.max(rawDt, 0), MAX_FRAME_DT);

    if (this._toastTimer > 0) {
      this._toastTimer = Math.max(0, this._toastTimer - dt);
      if (this._toastTimer === 0) {
        this._toastMessage = null;
        this._overlay.updateLiveOverlays(this._buildViewState());
      }
    }

    if (this._screenMode === 'playing') {
      this._accumulator += dt;
      let steps = 0;
      while (this._accumulator >= FIXED_DT && steps < 8) {
        this._accumulator -= FIXED_DT;
        steps++;

        const frame = this._input.pollFrame();
        if (frame.pausePressed) {
          this.setScreenMode('paused');
          break;
        }
        if (frame.mapPressed) {
          this.setScreenMode('map');
          break;
        }
        if (frame.interactPressed && this._state.activeShopPrompt) {
          this._openShop(this._state.activeShopPrompt);
          break;
        }

        const events = this._sim.step(this._state, frame, this._catalog);
        this._processSimEvents(events);

        if (this._state.victoryTriggered && this._screenMode === 'playing') {
          this._handleVictoryTriggered();
          break;
        }
        if (this._state.gameOverTriggered && this._screenMode === 'playing') {
          this._saveCurrentProgress();
          this.setScreenMode('gameover');
          break;
        }
      }

      this._touchOverlay.setCurrentForm(this._state.hero.form);
      this._overlay.updateLiveOverlays(this._buildViewState());
    } else {
      this._accumulator = 0;
      const frame = this._input.pollFrame();
      this._overlay.handleMenuNavigation(frame, dt, this._buildViewState());
      if (this._overlay.isPlaytestDrawerOpen) {
        this._overlay.updateLiveOverlays(this._buildViewState());
      }
    }

    const targetIntervalMs = 1000 / this._settings.render.fpsLimit;
    const elapsedRenderMs = nowMs - this._lastRenderMs;
    if (this._lastRenderMs === 0 || elapsedRenderMs >= targetIntervalMs - 1.25) {
      this._lastRenderMs = nowMs;
      this._recordRenderTimestamp(nowMs);
      this._renderSingleFrame(nowMs / 1000);
    }
  };

  private _renderSingleFrame(timeSec: number): void {
    const interpAlpha =
      this._screenMode === 'playing'
        ? this._settings.render.classicSnap
          ? 1
          : Math.max(0, Math.min(1, this._accumulator / FIXED_DT))
        : 1;

    this._renderer.render(
      this._state,
      this._catalog,
      interpAlpha,
      this._settings.render,
      this._input.getGlyphs(),
      this._screenMode,
      timeSec,
    );
  }

  private _recordRenderTimestamp(nowMs: number): void {
    this._renderTimestamps.push(nowMs);
    const cutoff = nowMs - 1000;
    while (this._renderTimestamps.length > 0 && this._renderTimestamps[0] < cutoff) {
      this._renderTimestamps.shift();
    }
    if (this._renderTimestamps.length >= 2) {
      const spanMs = nowMs - this._renderTimestamps[0];
      if (spanMs > 100) {
        this._measuredFps = ((this._renderTimestamps.length - 1) * 1000) / spanMs;
      }
    }
  }

  // --------------------------------------------------------------------------
  // Event Handling, Music, Haptics & Persistence
  // --------------------------------------------------------------------------

  private _processSimEvents(events: readonly SimEvent[]): void {
    if (events.length === 0) return;

    const inBoss = this._state.boss !== null && !this._state.boss.defeated;
    this._renderer.consumeEvents(events);
    this._audio.consumeEvents(events, this._state.biome, inBoss);

    for (const ev of events) {
      switch (ev.type) {
        case 'ground_stomp':
        case 'stomp_impact':
          this._input.triggerHaptic('stomp');
          break;
        case 'tongue_lash':
        case 'enemy_hit':
        case 'boss_hit':
          this._input.triggerHaptic('light');
          break;
        case 'hero_hurt':
          this._input.triggerHaptic('hit');
          break;
        case 'hero_dead':
          this._input.triggerHaptic('death');
          break;
        case 'heal':
          this._input.triggerHaptic('heal');
          break;
        case 'boss_defeated':
          this._input.triggerHaptic('stomp');
          this._syncMusicContext();
          this._saveCurrentProgress();
          this._showToast(
            ev.unlockForm
              ? `BOSS DEFEATED! NEW FORM UNLOCKED!`
              : 'BOSS DEFEATED!',
          );
          break;
        case 'room_change':
          this._syncMusicContext();
          this._saveCurrentProgress();
          break;
        case 'teleporter_unlock':
          this._saveCurrentProgress();
          this._showToast('TELEPORTER UNLOCKED!');
          break;
        case 'shop_interact':
          if (this._screenMode === 'playing') {
            this._openShop(ev.shopId);
          }
          break;
        case 'victory':
          this._handleVictoryTriggered(ev.ticks);
          break;
        default:
          break;
      }
    }
  }

  private _handleVictoryTriggered(ticksOverride?: number): void {
    if (this._state.mode === 'time_attack') {
      const ticks = ticksOverride ?? this._state.timeAttackTicks;
      const best = this._state.progress.bestTimeAttackTicks;
      if (ticks > 0 && (best === null || ticks < best)) {
        this._state.progress.bestTimeAttackTicks = ticks;
      }
    }
    this._saveCurrentProgress();
    this.setScreenMode('victory');
  }

  private _syncMusicContext(): void {
    if (this._screenMode === 'title' || this._screenMode === 'credits') {
      this._audio.setMusicContext('TITLE');
      return;
    }
    if (this._screenMode === 'victory') {
      this._audio.setMusicContext('VICTORY');
      return;
    }
    const boss = this._state.boss;
    if (boss && !boss.defeated) {
      if (boss.id === 'shadow_doppelganger') {
        this._audio.setMusicContext('SHADOW_DUEL');
      } else if (boss.id === 'nightmare_sovereign') {
        this._audio.setMusicContext('FINAL_BOSS');
      } else {
        const def = this._catalog.bosses.get(boss.id);
        this._audio.setMusicContext(def?.isMiniBoss ? 'MINIBOSS' : 'BOSS');
      }
      return;
    }
    this._audio.setMusicContext(this._state.biome);
  }

  private _unlockAudioOnce(): void {
    if (this._audioUnlocked) return;
    this._audioUnlocked = true;
    this._audio.unlock();
  }

  private _openShop(shopId: ShopId): void {
    this._activeShop = shopId;
    this._screenMode = 'shop';
    this._accumulator = 0;
    this._renderOverlay();
  }

  private _showToast(message: string, durationSec = 2.4): void {
    this._toastMessage = message;
    this._toastTimer = durationSec;
    this._overlay.updateLiveOverlays(this._buildViewState());
  }

  private _saveCurrentProgress(): void {
    const data: SaveData = {
      version: 1,
      savedAt: Date.now(),
      roomId: this._state.roomId,
      spawnX: this._state.hero.x,
      spawnY: this._state.hero.y,
      activeForm: this._state.hero.form,
      progress: {
        ...this._state.progress,
        collectedCoinIds: [...this._state.progress.collectedCoinIds],
        unlockedForms: [...this._state.progress.unlockedForms],
        upgradeLevels: { ...this._state.progress.upgradeLevels },
        ownedRelics: [...this._state.progress.ownedRelics],
        equippedRelics: [...this._state.progress.equippedRelics],
        defeatedBosses: [...this._state.progress.defeatedBosses],
        visitedRooms: [...this._state.progress.visitedRooms],
        unlockedTeleporters: [...this._state.progress.unlockedTeleporters],
        rescuedAnimals: [...this._state.progress.rescuedAnimals],
        clearedComboRooms: [...this._state.progress.clearedComboRooms],
        openedChests: [...this._state.progress.openedChests],
      },
      settings: cloneGameSettings(this._settings),
    };
    this._saveManager.save(data);
  }

  // --------------------------------------------------------------------------
  // Mode Launchers
  // --------------------------------------------------------------------------

  private _startContinue(): void {
    this._unlockAudioOnce();
    const save = this._saveManager.load();
    if (!save) {
      this._startNewGame();
      return;
    }
    const targetRoom = this._catalog.rooms.has(save.roomId) ? save.roomId : this._catalog.startRoomId;
    this._state = this._sim.createInitialState(this._catalog, {
      mode: 'story',
      roomId: targetRoom,
      progress: save.progress,
    });
    const events = this._sim.warpToRoom(this._state, this._catalog, targetRoom, save.spawnX, save.spawnY);
    if (this._state.progress.unlockedForms.includes(save.activeForm)) {
      this._state.hero.form = save.activeForm;
    }
    this._touchOverlay.setCurrentForm(this._state.hero.form);
    this._processSimEvents(events);
    this.setScreenMode('playing');
  }

  private _startNewGame(): void {
    this._unlockAudioOnce();
    this._state = this._sim.createInitialState(this._catalog, {
      mode: 'story',
      roomId: this._catalog.startRoomId,
    });
    this._touchOverlay.setCurrentForm(this._state.hero.form);
    this._saveCurrentProgress();
    this.setScreenMode('playing');
  }

  private _startMode(mode: GameMode): void {
    this._unlockAudioOnce();
    if (mode === 'story') {
      this._startNewGame();
      return;
    }
    // Preserve saved progress when launching arcade/challenge modes from Title
    const existing = this._saveManager.load();
    if (this._screenMode === 'title' && existing) {
      this._state = this._sim.createInitialState(this._catalog, {
        mode,
        progress: existing.progress,
      });
    }

    let events: SimEvent[] = [];
    if (mode === 'ghost_ship') {
      events = this._sim.startGhostShip(this._state, this._catalog);
    } else if (mode === 'time_attack') {
      events = this._sim.startTimeAttack(this._state, this._catalog);
    } else if (mode === 'boss_rush') {
      events = this._sim.startBossRush(this._state, this._catalog, 'primal_eye');
    }
    this._touchOverlay.setCurrentForm(this._state.hero.form);
    this._processSimEvents(events);
    this.setScreenMode('playing');
  }

  private _warpToRoom(roomId: string): boolean {
    if (!this._catalog.rooms.has(roomId)) return false;
    const events = this._sim.warpToRoom(this._state, this._catalog, roomId);
    this._processSimEvents(events);
    this._syncMusicContext();
    if (this._screenMode !== 'playing') {
      this.setScreenMode('playing');
    } else {
      this._overlay.updateLiveOverlays(this._buildViewState());
    }
    return true;
  }

  private _spawnBoss(bossId: BossId): boolean {
    if (!this._catalog.bosses.has(bossId)) return false;
    const events = this._sim.startBossRush(this._state, this._catalog, bossId);
    this._processSimEvents(events);
    this.setScreenMode('playing');
    return true;
  }

  // --------------------------------------------------------------------------
  // Overlay Actions & View State
  // --------------------------------------------------------------------------

  private _buildViewState(): OverlayViewState {
    const saved = this._saveManager.load();
    const saveSummary = saved
      ? {
          roomName: this._catalog.rooms.get(saved.roomId)?.name ?? saved.roomId,
          crystals: saved.progress.crystals,
          coins: saved.progress.collectedCoinIds.length,
          form: saved.activeForm,
        }
      : null;

    const manifestEntries = this._assets.manifest ? Object.keys(this._assets.manifest.entries).length : 0;

    return {
      screenMode: this._screenMode,
      optionsReturnMode: this._optionsReturnMode,
      activeShop: this._activeShop,
      hasSave: saved !== null,
      saveSummary,
      simState: this._state,
      catalog: this._catalog,
      settings: cloneGameSettings(this._settings),
      glyphs: this._input.getGlyphs(),
      activeDevice: this._input.activeDevice,
      touchOverlayVisible: this._input.touchOverlayVisible,
      customPackAvailable: this._assets.customPackAvailable,
      customPackEnabled: this._assets.customPackEnabled,
      customPackCount: manifestEntries,
      customPackMessage: this._customPackMessage,
      measuredFps: this._measuredFps,
      toastMessage: this._toastMessage,
    };
  }

  private _renderOverlay(): void {
    this._overlay.render(this._buildViewState());
  }

  private _createOverlayActions(): OverlayActions {
    return {
      onContinue: () => this._startContinue(),
      onNewGame: () => this._startNewGame(),
      onStartGhostShip: () => this._startMode('ghost_ship'),
      onStartTimeAttack: () => this._startMode('time_attack'),
      onResume: () => this.setScreenMode('playing'),
      onOpenOptions: (from) => {
        this._optionsReturnMode = from;
        this.setScreenMode('options');
      },
      onCloseOptions: () => {
        this._saveManager.saveSettings(this._settings);
        this.setScreenMode(this._optionsReturnMode);
      },
      onOpenMap: () => this.setScreenMode('map'),
      onCloseMap: () => this.setScreenMode('playing'),
      onCloseShop: () => this.setScreenMode('playing'),
      onReturnToHub: () => {
        this._state.gameOverTriggered = false;
        this._state.victoryTriggered = false;
        this._state.hero.hp = this._state.hero.maxHp;
        this._warpToRoom(this._catalog.hubRoomId);
      },
      onSaveAndQuit: () => {
        this._saveCurrentProgress();
        this._showToast('PROGRESS SAVED');
        this.setScreenMode('title');
      },
      onRetryGameOver: () => {
        this._state.gameOverTriggered = false;
        this._state.hero.hp = this._state.hero.maxHp;
        if (this._state.mode === 'ghost_ship') {
          this._startMode('ghost_ship');
        } else if (this._state.mode === 'time_attack') {
          this._startMode('time_attack');
        } else if (this._state.mode === 'boss_rush' && this._state.boss) {
          this._spawnBoss(this._state.boss.id);
        } else {
          this._warpToRoom(this._state.roomId);
        }
      },
      onOpenCredits: () => this.setScreenMode('credits'),
      onReturnToTitle: () => this.setScreenMode('title'),

      onLoadCustomPack: async () => {
        const res = await this._assets.loadFromDirectoryPicker();
        this._customPackMessage = res.message;
        if (res.ok) {
          this._assets.setUseCustomPack(true);
          this._settings.render.useCustomPack = this._assets.customPackEnabled;
          this._saveManager.setCustomPackPreference('custom');
          this._saveManager.saveSettings(this._settings);
          this._showToast(`CUSTOM PACK LOADED (${res.count} ASSETS)`);
        } else {
          this._showToast(res.message);
        }
        this._renderOverlay();
        this._renderSingleFrame(
          typeof performance !== 'undefined' ? performance.now() / 1000 : 0,
        );
        return res;
      },
      onToggleCustomPack: (enabled) => {
        if (enabled && !this._assets.customPackAvailable) {
          this._customPackMessage = 'No custom pack loaded yet — click LOAD CUSTOM PACK first.';
          this._showToast('LOAD A CUSTOM PACK FIRST');
          this._renderOverlay();
          return false;
        }
        this._assets.setUseCustomPack(enabled);
        this._settings.render.useCustomPack = this._assets.customPackEnabled;
        this._saveManager.setCustomPackPreference(this._assets.customPackEnabled ? 'custom' : 'builtin');
        this._saveManager.saveSettings(this._settings);
        this._showToast(this._assets.customPackEnabled ? 'CUSTOM PACK ENABLED' : 'BUILT-IN PIXEL ART');
        this._renderOverlay();
        this._renderSingleFrame(
          typeof performance !== 'undefined' ? performance.now() / 1000 : 0,
        );
        return this._assets.customPackEnabled;
      },

      onUpdateRenderSettings: (patch: Partial<RenderSettings>) => {
        this._settings.render = { ...this._settings.render, ...patch };
        this._saveManager.saveSettings(this._settings);
        this._renderOverlay();
      },
      onUpdateAudioSettings: (patch: Partial<AudioSettings>) => {
        const muteChanged = patch.muted !== undefined && patch.muted !== this._settings.audio.muted;
        this._settings.audio = { ...this._settings.audio, ...patch };
        this._audio.updateSettings(this._settings.audio);
        this._saveManager.saveSettings(this._settings);
        if (muteChanged) {
          this._renderOverlay();
        }
      },
      onUpdateInputSettings: (patch: Partial<InputSettings>) => {
        const rebuildNeeded =
          patch.touchMode !== undefined || patch.hapticsEnabled !== undefined || patch.bindings !== undefined;
        this._input.updateSettings(patch);
        this._settings.input = this._input.settings;
        this._saveManager.saveSettings(this._settings);
        if (rebuildNeeded) {
          this._renderOverlay();
        }
      },
      onUpdateTouchLayout: (patch: Partial<TouchLayoutConfig>) => {
        this._input.setTouchLayout(patch);
        this._settings.input = this._input.settings;
        this._saveManager.saveSettings(this._settings);
      },
      onRebindKey: (action: keyof KeyBindings, code: string) => {
        const nextBindings: KeyBindings = { ...this._settings.input.bindings, [action]: code };
        this._input.updateSettings({ bindings: nextBindings });
        this._settings.input = this._input.settings;
        this._saveManager.saveSettings(this._settings);
        this._renderOverlay();
      },
      onResetKeyBindings: () => {
        this._input.updateSettings({ bindings: { ...DEFAULT_KEY_BINDINGS } });
        this._settings.input = this._input.settings;
        this._saveManager.saveSettings(this._settings);
        this._showToast('KEYBINDINGS RESET');
        this._renderOverlay();
      },
      onSetKeyCaptureSuppressed: (suppressed: boolean) => {
        this._input.setKeyCaptureSuppressed(suppressed);
      },

      onBuyUpgrade: (key: UpgradeKey) => {
        const ok = this._sim.buyUpgrade(this._state, this._catalog, key);
        if (ok) {
          this._audio.consumeEvents([{ type: 'coin_pickup', x: this._state.hero.x, y: this._state.hero.y, coinId: key, totalCoins: this._state.progress.collectedCoinIds.length }], this._state.biome, false);
          this._saveCurrentProgress();
          this._showToast(`PURCHASED ${this._catalog.getUpgrade(key).name.toUpperCase()}`);
          this._renderOverlay();
        }
        return ok;
      },
      onBuyRelic: (id: RelicId) => {
        const ok = this._sim.buyRelic(this._state, this._catalog, id);
        if (ok) {
          this._audio.consumeEvents([{ type: 'coin_pickup', x: this._state.hero.x, y: this._state.hero.y, coinId: id, totalCoins: this._state.progress.collectedCoinIds.length }], this._state.biome, false);
          this._saveCurrentProgress();
          this._showToast(`PURCHASED ${this._catalog.getRelic(id).name.toUpperCase()}`);
          this._renderOverlay();
        }
        return ok;
      },
      onToggleEquipRelic: (id: RelicId) => {
        const ok = this._sim.toggleEquipRelic(this._state, this._catalog, id);
        if (ok) {
          this._saveCurrentProgress();
          this._renderOverlay();
        }
        return ok;
      },
      onChallengeBoss: (bossId: BossId) => this._spawnBoss(bossId),
      onFastTravel: (roomId: string) => {
        if (!this._state.progress.unlockedTeleporters.includes(roomId)) return false;
        const ok = this._warpToRoom(roomId);
        if (ok) {
          this._showToast(`WARPED TO ${this._catalog.rooms.get(roomId)?.name.toUpperCase() ?? roomId}`);
        }
        return ok;
      },

      onWarpRoom: (roomId: string) => this._warpToRoom(roomId),
      onUnlockAllForms: () => {
        this._state.progress.unlockedForms = [...HERO_FORMS];
        this._showToast('ALL 6 FORMS UNLOCKED');
        this._renderOverlay();
      },
      onSetForm: (form: HeroFormId) => {
        if (!this._state.progress.unlockedForms.includes(form)) {
          this._state.progress.unlockedForms.push(form);
        }
        this._state.hero.form = form;
        this._touchOverlay.setCurrentForm(form);
        this._processSimEvents([{ type: 'form_switch', form }]);
        this._renderOverlay();
      },
      onGrantCrystals: (amount: number) => {
        this._state.progress.crystals = Math.max(0, this._state.progress.crystals + Math.floor(amount));
        this._showToast(`+${Math.floor(amount)} CRYSTALS`);
        this._renderOverlay();
      },
      onHealFull: () => {
        this._state.hero.hp = this._state.hero.maxHp;
        if ((this._state.progress.upgradeLevels.RockShield ?? 0) > 0) {
          this._state.hero.rockShieldActive = true;
        }
        this._processSimEvents([{ type: 'heal', x: this._state.hero.x, y: this._state.hero.y, hp: this._state.hero.hp }]);
        this._overlay.updateLiveOverlays(this._buildViewState());
      },
      onKillRoomEnemies: () => {
        const events: SimEvent[] = [];
        for (const e of this._state.enemies) {
          if (e.alive) {
            e.hp = 0;
            e.alive = false;
            events.push({ type: 'enemy_hit', x: e.x, y: e.y, killed: true, combo: this._state.combo.count + 1 });
          }
        }
        this._processSimEvents(events);
        this._showToast('ROOM ENEMIES CLEARED');
      },
      onForceSave: () => {
        this._saveCurrentProgress();
        this._showToast('SAVED TO LOCAL STORAGE');
      },
      onResetSave: () => {
        this._saveManager.clear();
        this._showToast('SAVE CLEARED');
        this._renderOverlay();
      },
    };
  }

  // --------------------------------------------------------------------------
  // Global Debug & Playtest Bridge (window.__KRUNKED_DEBUG__)
  // --------------------------------------------------------------------------

  private _createDebugBridge(): KrunkedDebugBridge {
    return {
      getState: () => this._state,
      getHash: () => this._sim.hashState(this._state),
      getScreenMode: () => this._screenMode,
      setScreenMode: (mode: ScreenMode) => {
        this.setScreenMode(mode);
      },
      getDeviceState: () => ({
        activeDevice: this._input.activeDevice,
        touchOverlayVisible: this._input.touchOverlayVisible,
        touchMode: this._input.settings.touchMode,
        glyphs: this._input.getGlyphs(),
      }),
      warpRoom: (roomId: string) => this._warpToRoom(roomId),
      unlockAllForms: () => {
        this._state.progress.unlockedForms = [...HERO_FORMS];
        this._renderOverlay();
      },
      setForm: (form: HeroFormId) => {
        if (!this._state.progress.unlockedForms.includes(form)) {
          this._state.progress.unlockedForms.push(form);
        }
        this._state.hero.form = form;
        this._touchOverlay.setCurrentForm(form);
        this._processSimEvents([{ type: 'form_switch', form }]);
        this._renderOverlay();
      },
      grantCrystals: (amount: number) => {
        this._state.progress.crystals = Math.max(0, this._state.progress.crystals + Math.floor(amount));
        this._renderOverlay();
      },
      healFull: () => {
        this._state.hero.hp = this._state.hero.maxHp;
        if ((this._state.progress.upgradeLevels.RockShield ?? 0) > 0) {
          this._state.hero.rockShieldActive = true;
        }
        this._processSimEvents([{ type: 'heal', x: this._state.hero.x, y: this._state.hero.y, hp: this._state.hero.hp }]);
      },
      damageHero: (amount = 1) => {
        const dmg = Math.max(1, Math.floor(amount));
        this._state.hero.hp = Math.max(0, this._state.hero.hp - dmg);
        this._state.hero.hitFlashTimer = 0.25;
        if (this._state.hero.hp <= 0) {
          this._state.hero.action = 'dead';
          this._state.gameOverTriggered = true;
          this._processSimEvents([{ type: 'hero_dead', x: this._state.hero.x, y: this._state.hero.y }]);
          if (this._screenMode === 'playing') {
            this.setScreenMode('gameover');
          }
        } else {
          this._state.hero.invulnTimer = 1.75;
          this._processSimEvents([
            {
              type: 'hero_hurt',
              x: this._state.hero.x,
              y: this._state.hero.y,
              hp: this._state.hero.hp,
              shieldBlocked: false,
            },
          ]);
        }
      },
      killRoomEnemies: () => {
        const events: SimEvent[] = [];
        for (const e of this._state.enemies) {
          if (e.alive) {
            e.hp = 0;
            e.alive = false;
            events.push({ type: 'enemy_hit', x: e.x, y: e.y, killed: true, combo: this._state.combo.count + 1 });
          }
        }
        this._processSimEvents(events);
      },
      spawnBoss: (bossId: BossId) => this._spawnBoss(bossId),
      startMode: (mode: GameMode) => this._startMode(mode),
      setFpsLimit: (fps: FpsLimitOption) => {
        this._settings.render.fpsLimit = fps;
        this._saveManager.saveSettings(this._settings);
        this._renderOverlay();
      },
      setTouchMode: (mode: TouchVisibilitySetting) => {
        this._input.updateSettings({ touchMode: mode });
        this._settings.input = this._input.settings;
        this._saveManager.saveSettings(this._settings);
        this._renderOverlay();
      },
      simulateTouchEvent: () => {
        this._input.injectVirtualTouch(true);
        this._touchOverlay.sync();
      },
      simulateKeyEvent: (code = 'ArrowRight') => {
        this._input.notifyKeyDown(code, false);
        this._input.notifyKeyUp(code);
        this._touchOverlay.sync();
      },
      injectGamepad: (pad: VirtualGamepadSnapshot | null) => {
        this._input.injectVirtualGamepadState(pad);
        this._touchOverlay.sync();
      },
      getRoomIds: () => [...this._catalog.roomOrder],
      getFpsMetrics: () => ({
        targetFps: this._settings.render.fpsLimit,
        measuredFps: Math.round(this._measuredFps),
        tick: this._state.tick,
      }),
      toggleCustomPack: (enabled: boolean) => {
        this._assets.setUseCustomPack(enabled);
        this._settings.render.useCustomPack = this._assets.customPackEnabled;
        this._saveManager.setCustomPackPreference(this._assets.customPackEnabled ? 'custom' : 'builtin');
        this._saveManager.saveSettings(this._settings);
        this._renderOverlay();
        this._renderSingleFrame(
          typeof performance !== 'undefined' ? performance.now() / 1000 : 0,
        );
        return this._assets.customPackEnabled;
      },
      forceSave: () => {
        this._saveCurrentProgress();
      },
      resetSave: () => {
        this._saveManager.clear();
        this._renderOverlay();
      },
    };
  }
}

export function createGameApp(deps: GameAppDeps): GameApp {
  return new GameApp(deps);
}
