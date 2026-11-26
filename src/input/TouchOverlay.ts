import type { HeroFormId, TouchLayoutConfig } from '../contracts/index.js';
import type { InputOrchestrator, TouchActionButton } from './InputOrchestrator.js';

interface ActivePointerBinding {
  kind: 'dpad' | 'button';
  button?: TouchActionButton;
  element: HTMLElement;
}

const FORM_BADGE_COLORS: Record<HeroFormId, { label: string; color: string }> = {
  krunk_basic: { label: 'BASIC', color: '#ff4fa3' },
  krunk_fire: { label: 'FIRE', color: '#ff7034' },
  krunk_leaf: { label: 'LEAF', color: '#4fe06b' },
  krunk_rock: { label: 'ROCK', color: '#d49a5a' },
  krunk_electric: { label: 'VOLT', color: '#ffd93d' },
  krunk_shadow: { label: 'SHDW', color: '#b46bff' },
};

export class TouchOverlay {
  private readonly _root: HTMLElement;
  private readonly _orchestrator: InputOrchestrator;
  private readonly _activePointers = new Map<number, ActivePointerBinding>();
  private readonly _unsubscribe: () => void;

  private _mounted = false;
  private _dpadLeftEl: HTMLElement | null = null;
  private _dpadRightEl: HTMLElement | null = null;
  private _dpadDownEl: HTMLElement | null = null;
  private _formBtnEl: HTMLButtonElement | null = null;
  private _buttonElements = new Map<TouchActionButton, HTMLButtonElement>();
  private _currentForm: HeroFormId = 'krunk_basic';

  constructor(root: HTMLElement, orchestrator: InputOrchestrator) {
    this._root = root;
    this._orchestrator = orchestrator;
    this._unsubscribe = this._orchestrator.subscribe(() => {
      this.sync();
    });
    this.sync();
  }

  get isMounted(): boolean {
    return this._mounted;
  }

  setCurrentForm(form: HeroFormId): void {
    if (this._currentForm === form) return;
    this._currentForm = form;
    this._updateFormButtonVisual();
  }

  sync(): void {
    const visible = this._orchestrator.touchOverlayVisible;
    if (!visible) {
      this.unmount();
      return;
    }
    if (!this._mounted) {
      this._mount();
    }
    this._applyLayoutStyles(this._orchestrator.settings.touchLayout);
    this._updateFormButtonVisual();
  }

  unmount(): void {
    this._activePointers.clear();
    this._buttonElements.clear();
    this._dpadLeftEl = null;
    this._dpadRightEl = null;
    this._dpadDownEl = null;
    this._formBtnEl = null;
    this._orchestrator.clearTouchInput();
    // Strictly remove ALL touch button DOM nodes when hidden.
    while (this._root.firstChild) {
      this._root.removeChild(this._root.firstChild);
    }
    this._root.removeAttribute('data-touch-visible');
    this._mounted = false;
  }

  dispose(): void {
    this._unsubscribe();
    this.unmount();
  }

  private _mount(): void {
    const doc = this._root.ownerDocument;
    if (!doc) return;

    while (this._root.firstChild) {
      this._root.removeChild(this._root.firstChild);
    }
    this._root.setAttribute('data-touch-visible', 'true');

    const shell = doc.createElement('div');
    shell.className = 'kq-touch-shell';

    // Top-left Map & Top-right Pause pills
    const topBar = doc.createElement('div');
    topBar.className = 'kq-touch-topbar';

    const mapBtn = this._createActionButton(doc, 'map', 'MAP', 'kq-touch-pill kq-touch-map');
    const pauseBtn = this._createActionButton(doc, 'pause', 'PAUSE', 'kq-touch-pill kq-touch-pause');
    topBar.appendChild(mapBtn);
    topBar.appendChild(pauseBtn);
    shell.appendChild(topBar);

    // Bottom clusters
    const bottomRow = doc.createElement('div');
    bottomRow.className = 'kq-touch-bottom';

    // Bottom-left: Slide-Rail D-Pad (Left, Right, Down/Stomp helper)
    const dpadCluster = doc.createElement('div');
    dpadCluster.className = 'kq-touch-dpad-cluster';

    const dpad = doc.createElement('div');
    dpad.className = 'kq-touch-dpad';
    dpad.setAttribute('role', 'group');
    dpad.setAttribute('aria-label', 'Directional Slide Pad');

    const leftSeg = doc.createElement('div');
    leftSeg.className = 'kq-touch-dpad-seg kq-touch-dpad-left';
    leftSeg.textContent = '◀';

    const rightSeg = doc.createElement('div');
    rightSeg.className = 'kq-touch-dpad-seg kq-touch-dpad-right';
    rightSeg.textContent = '▶';

    const downSeg = doc.createElement('div');
    downSeg.className = 'kq-touch-dpad-seg kq-touch-dpad-down';
    downSeg.textContent = '▼';

    dpad.appendChild(leftSeg);
    dpad.appendChild(rightSeg);
    dpad.appendChild(downSeg);

    this._dpadLeftEl = leftSeg;
    this._dpadRightEl = rightSeg;
    this._dpadDownEl = downSeg;
    this._bindDpadEvents(dpad);

    dpadCluster.appendChild(dpad);
    bottomRow.appendChild(dpadCluster);

    // Bottom-right: Jump, Dash, Stomp, Form-Switch + compact Interact
    const actionCluster = doc.createElement('div');
    actionCluster.className = 'kq-touch-action-cluster';

    const formBtn = this._createActionButton(doc, 'formNext', 'FORM', 'kq-touch-btn kq-touch-form');
    const interactBtn = this._createActionButton(doc, 'interact', 'USE', 'kq-touch-btn kq-touch-use');
    const dashBtn = this._createActionButton(doc, 'dash', 'DASH', 'kq-touch-btn kq-touch-dash');
    const stompBtn = this._createActionButton(doc, 'stomp', 'STOMP', 'kq-touch-btn kq-touch-stomp');
    const jumpBtn = this._createActionButton(doc, 'jump', 'JUMP', 'kq-touch-btn kq-touch-jump');

    this._formBtnEl = formBtn;

    actionCluster.appendChild(formBtn);
    actionCluster.appendChild(interactBtn);
    actionCluster.appendChild(dashBtn);
    actionCluster.appendChild(stompBtn);
    actionCluster.appendChild(jumpBtn);

    bottomRow.appendChild(actionCluster);
    shell.appendChild(bottomRow);
    this._root.appendChild(shell);
    this._mounted = true;
  }

  private _createActionButton(
    doc: Document,
    action: TouchActionButton,
    label: string,
    className: string,
  ): HTMLButtonElement {
    const btn = doc.createElement('button');
    btn.type = 'button';
    btn.className = className;
    btn.textContent = label;
    btn.setAttribute('data-touch-action', action);
    btn.setAttribute('aria-label', label);

    const onDown = (ev: PointerEvent) => {
      ev.preventDefault();
      ev.stopPropagation();
      try {
        btn.setPointerCapture(ev.pointerId);
      } catch {
        // Synthetic pointer events in tests may not support capture
      }
      this._activePointers.set(ev.pointerId, { kind: 'button', button: action, element: btn });
      this._recomputeButtonStates();
    };

    const onUp = (ev: PointerEvent) => {
      ev.preventDefault();
      if (this._activePointers.has(ev.pointerId)) {
        this._activePointers.delete(ev.pointerId);
        this._recomputeButtonStates();
      }
    };

    btn.addEventListener('pointerdown', onDown);
    btn.addEventListener('pointerup', onUp);
    btn.addEventListener('pointercancel', onUp);
    btn.addEventListener('lostpointercapture', onUp);

    this._buttonElements.set(action, btn);
    return btn;
  }

  private _bindDpadEvents(dpad: HTMLElement): void {
    const updateFromPoint = (clientX: number, clientY: number) => {
      const rect = dpad.getBoundingClientRect();
      if (rect.width <= 0 || rect.height <= 0) return;
      const nx = ((clientX - rect.left) / rect.width) * 2 - 1; // -1..+1
      const ny = ((clientY - rect.top) / rect.height) * 2 - 1; // -1(top)..+1(bottom)

      let moveX = 0;
      let moveY = 0;

      if (Math.abs(nx) > 0.16) {
        moveX = nx < 0 ? -1 : 1;
      }
      if (ny > 0.32) {
        moveY = -1;
      } else if (ny < -0.55) {
        moveY = 1;
      }

      this._orchestrator.setTouchMove(moveX, moveY);
      this._dpadLeftEl?.classList.toggle('is-active', moveX < 0);
      this._dpadRightEl?.classList.toggle('is-active', moveX > 0);
      this._dpadDownEl?.classList.toggle('is-active', moveY < 0);
      dpad.classList.add('is-pressed');
    };

    const onDown = (ev: PointerEvent) => {
      ev.preventDefault();
      ev.stopPropagation();
      try {
        dpad.setPointerCapture(ev.pointerId);
      } catch {
        // Ignore in synthetic environments
      }
      this._activePointers.set(ev.pointerId, { kind: 'dpad', element: dpad });
      updateFromPoint(ev.clientX, ev.clientY);
    };

    const onMove = (ev: PointerEvent) => {
      const binding = this._activePointers.get(ev.pointerId);
      if (!binding || binding.kind !== 'dpad') return;
      ev.preventDefault();
      updateFromPoint(ev.clientX, ev.clientY);
    };

    const onEnd = (ev: PointerEvent) => {
      const binding = this._activePointers.get(ev.pointerId);
      if (!binding || binding.kind !== 'dpad') return;
      ev.preventDefault();
      this._activePointers.delete(ev.pointerId);
      let stillHasDpad = false;
      for (const b of this._activePointers.values()) {
        if (b.kind === 'dpad') {
          stillHasDpad = true;
          break;
        }
      }
      if (!stillHasDpad) {
        this._orchestrator.setTouchMove(0, 0);
        this._dpadLeftEl?.classList.remove('is-active');
        this._dpadRightEl?.classList.remove('is-active');
        this._dpadDownEl?.classList.remove('is-active');
        dpad.classList.remove('is-pressed');
      }
    };

    dpad.addEventListener('pointerdown', onDown);
    dpad.addEventListener('pointermove', onMove);
    dpad.addEventListener('pointerup', onEnd);
    dpad.addEventListener('pointercancel', onEnd);
    dpad.addEventListener('lostpointercapture', onEnd);
  }

  private _recomputeButtonStates(): void {
    const heldNow = new Set<TouchActionButton>();
    for (const binding of this._activePointers.values()) {
      if (binding.kind === 'button' && binding.button) {
        heldNow.add(binding.button);
      }
    }
    for (const [action, btn] of this._buttonElements.entries()) {
      const active = heldNow.has(action);
      btn.classList.toggle('is-pressed', active);
      this._orchestrator.setTouchButton(action, active);
    }
  }

  private _applyLayoutStyles(layout: TouchLayoutConfig): void {
    const style = this._root.style;
    style.setProperty('--touch-opacity', layout.opacity.toFixed(2));
    style.setProperty('--touch-active-opacity', '0.68');
    style.setProperty('--touch-scale', layout.scale.toFixed(2));
    style.setProperty('--touch-dpad-x', `${Math.round(layout.dpadOffsetX)}px`);
    style.setProperty('--touch-dpad-y', `${Math.round(layout.dpadOffsetY)}px`);
    style.setProperty('--touch-action-x', `${Math.round(layout.actionOffsetX)}px`);
    style.setProperty('--touch-action-y', `${Math.round(layout.actionOffsetY)}px`);
  }

  private _updateFormButtonVisual(): void {
    if (!this._formBtnEl) return;
    const meta = FORM_BADGE_COLORS[this._currentForm] ?? FORM_BADGE_COLORS.krunk_basic;
    this._formBtnEl.textContent = meta.label;
    this._formBtnEl.style.setProperty('--form-accent', meta.color);
  }
}
