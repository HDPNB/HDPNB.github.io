import type {
  AnimationAction,
  AnimationClip,
  AnimationMixer,
  Group,
  Object3D,
  PerspectiveCamera,
  Scene,
  WebGLRenderer,
} from 'three';
import {
  desktopPetAnimationAliases,
  desktopPetClickActions,
  desktopPetConfig,
  desktopPetDialogues,
  desktopPetIdleActions,
  desktopPetPageDialogues,
  type DesktopPetActionName,
} from '@/data/desktop-pet';

interface ThreeRuntime {
  module: typeof import('three');
  loader: import('three/examples/jsm/loaders/GLTFLoader.js').GLTFLoader;
}

interface SavedPosition {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface DesktopPetDebugState {
  instanceCount: number;
  rendererCount: number;
  renderLoopActive: boolean;
}

declare global {
  interface Window {
    __hdpDesktopPet?: DesktopPetController;
    __hdpDesktopPetDebug?: DesktopPetDebugState;
  }
}

const secureRandomUnit = () => {
  try {
    const value = new Uint32Array(1);
    crypto.getRandomValues(value);
    return value[0] / 4294967296;
  } catch {
    return Math.random();
  }
};

const randomBetween = (min: number, max: number) =>
  min + Math.floor(secureRandomUnit() * Math.max(1, max - min + 1));

const pickDifferent = <T>(values: readonly T[], previous?: T): T | undefined => {
  if (values.length === 0) return undefined;
  if (values.length === 1) return values[0];
  let index = Math.floor(secureRandomUnit() * values.length);
  if (values[index] === previous) index = (index + 1) % values.length;
  return values[index];
};

const normalizeAnimationName = (value: string) =>
  value.toLowerCase().replace(/[\s_.-]+/g, '');

class DesktopPetController {
  readonly root: HTMLElement;

  private readonly stage: HTMLButtonElement;
  private readonly canvas: HTMLCanvasElement;
  private readonly loading: HTMLElement;
  private readonly bubble: HTMLElement;
  private readonly status: HTMLElement;
  private readonly gameButton: HTMLButtonElement;
  private readonly minimizeButton: HTMLButtonElement;
  private readonly gamePanel: HTMLElement;
  private readonly gameTitle: HTMLElement;
  private readonly gameBody: HTMLElement;
  private readonly gameStatus: HTMLElement;
  private readonly abortController = new AbortController();
  private readonly reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');

  private runtime?: ThreeRuntime;
  private renderer?: WebGLRenderer;
  private scene?: Scene;
  private camera?: PerspectiveCamera;
  private model?: Group;
  private mixer?: AnimationMixer;
  private clips: AnimationClip[] = [];
  private currentAction?: AnimationAction;
  private idleTimer?: number;
  private bubbleTimer?: number;
  private gameInviteTimer?: number;
  private gameTimer?: number;
  private reactionTimer?: number;
  private actionResetTimer?: number;
  private frameId?: number;
  private walkFrameId?: number;
  private idleHandle?: number;
  private lastFrameTime = 0;
  private lastAction?: DesktopPetActionName;
  private lastDialogue = '';
  private lastGame = '';
  private x = 0;
  private y = 0;
  private dragStart?: { pointerX: number; pointerY: number; x: number; y: number };
  private dragging = false;
  private suppressClick = false;
  private visible = !document.hidden;
  private initialized = false;
  private destroyed = false;
  private currentPath = location.pathname;
  private reactionReadyAt = 0;
  private starScore = 0;

  constructor(root: HTMLElement) {
    this.root = root;
    const query = <T extends Element>(selector: string) => {
      const element = root.querySelector<T>(selector);
      if (!element) throw new Error(`DesktopPet is missing ${selector}`);
      return element;
    };
    this.stage = query('[data-pet-stage]');
    this.canvas = query('[data-pet-canvas]');
    this.loading = query('[data-pet-loading]');
    this.bubble = query('[data-pet-bubble]');
    this.status = query('[data-pet-status]');
    this.gameButton = query('[data-pet-game]');
    this.minimizeButton = query('[data-pet-minimize]');
    this.gamePanel = query('[data-pet-game-panel]');
    this.gameTitle = query('[data-pet-game-title]');
    this.gameBody = query('[data-pet-game-body]');
    this.gameStatus = query('[data-pet-game-status]');

    this.root.dataset.desktopPetInstance = 'active';
    this.bindEvents();
    this.restorePosition();
    this.refreshContext();
    this.scheduleInitialize();
    this.scheduleIdle();
    this.scheduleGameInvite();
    this.updateDebugState();
  }

  refreshContext() {
    this.currentPath = location.pathname;
    this.visible = !document.hidden;
    this.clampPosition();
    if (this.visible) {
      this.startRenderLoop();
      this.scheduleIdle();
    }
  }

  private bindEvents() {
    const { signal } = this.abortController;
    this.stage.addEventListener('pointerdown', this.onPointerDown, { signal });
    this.stage.addEventListener('pointermove', this.onPointerMove, { signal });
    this.stage.addEventListener('pointerup', this.onPointerUp, { signal });
    this.stage.addEventListener('pointercancel', this.onPointerUp, { signal });
    this.stage.addEventListener('click', this.onStageClick, { signal });
    this.gameButton.addEventListener('click', () => this.openRandomGame(), { signal });
    this.minimizeButton.addEventListener('click', this.toggleMinimized, { signal });
    this.gamePanel.querySelector('[data-pet-game-close]')?.addEventListener(
      'click',
      () => this.closeGame(true),
      { signal },
    );
    addEventListener('resize', this.onResize, { passive: true, signal });
    addEventListener('pagehide', this.destroy, { once: true, signal });
    document.addEventListener('visibilitychange', this.onVisibilityChange, { signal });
    this.reducedMotion.addEventListener('change', this.onMotionChange, { signal });
  }

  private scheduleInitialize() {
    if (this.initialized || this.destroyed) return;
    if (this.root.dataset.modelAvailable !== 'true') {
      this.initialized = true;
      this.root.dataset.state = 'fallback';
      this.loading.textContent = '把模型放到 public/models/xiao-d/xiao-d.glb';
      this.status.textContent = '小D模型尚未放入，当前使用轻量占位形象';
      return;
    }
    const initialize = () => {
      this.idleHandle = undefined;
      void this.initializeThree();
    };
    if ('requestIdleCallback' in window) {
      this.idleHandle = window.requestIdleCallback(initialize, { timeout: 2400 });
    } else {
      this.idleHandle = globalThis.setTimeout(initialize, 900) as unknown as number;
    }
  }

  private async initializeThree() {
    if (this.initialized || this.destroyed || !this.visible) return;
    this.initialized = true;
    this.root.dataset.state = 'loading';
    try {
      const [THREE, loaderModule] = await Promise.all([
        import('three'),
        import('three/examples/jsm/loaders/GLTFLoader.js'),
      ]);
      if (this.destroyed) return;
      const loader = new loaderModule.GLTFLoader();
      this.runtime = { module: THREE, loader };
      this.scene = new THREE.Scene();
      this.camera = new THREE.PerspectiveCamera(28, 1, 0.01, 100);
      this.camera.position.set(0, 1.15, 4.1);
      this.renderer = new THREE.WebGLRenderer({
        canvas: this.canvas,
        alpha: true,
        antialias: innerWidth > 720 && !this.reducedMotion.matches,
        powerPreference: innerWidth <= 720 ? 'low-power' : 'default',
      });
      this.renderer.setPixelRatio(Math.min(devicePixelRatio || 1, desktopPetConfig.maxPixelRatio));
      this.renderer.outputColorSpace = THREE.SRGBColorSpace;
      this.scene.add(new THREE.HemisphereLight(0xfaf7ed, 0x315566, 2.4));
      const keyLight = new THREE.DirectionalLight(0xffffff, 2.1);
      keyLight.position.set(2.5, 4, 3);
      this.scene.add(keyLight);
      const fillLight = new THREE.DirectionalLight(0x71d7d0, 1.1);
      fillLight.position.set(-3, 1.5, 2);
      this.scene.add(fillLight);
      this.resizeRenderer();

      const gltf = await loader.loadAsync(this.root.dataset.modelPath || desktopPetConfig.modelPath);
      if (this.destroyed || !this.scene) {
        this.disposeObject(gltf.scene);
        return;
      }
      this.model = gltf.scene;
      this.clips = gltf.animations || [];
      const box = new THREE.Box3().setFromObject(this.model);
      const size = box.getSize(new THREE.Vector3());
      const center = box.getCenter(new THREE.Vector3());
      const scale = 2.45 / Math.max(0.001, size.y);
      this.model.scale.setScalar(scale);
      this.model.position.set(-center.x * scale, -box.min.y * scale - 1.15, -center.z * scale);
      this.model.traverse((object) => {
        if ('frustumCulled' in object) object.frustumCulled = false;
      });
      this.scene.add(this.model);
      if (this.clips.length > 0) this.mixer = new THREE.AnimationMixer(this.model);
      this.root.dataset.state = 'ready';
      this.loading.textContent = '';
      this.playAction('idle');
      this.startRenderLoop();
      this.updateDebugState();
    } catch {
      this.root.dataset.state = 'fallback';
      this.loading.textContent = '模型暂时没有加载成功';
      this.status.textContent = '小D模型加载失败，网站其他内容不受影响';
      this.disposeThree();
    }
  }

  private resizeRenderer() {
    if (!this.renderer || !this.camera) return;
    const rect = this.stage.getBoundingClientRect();
    const width = Math.max(1, Math.round(rect.width));
    const height = Math.max(1, Math.round(rect.height));
    this.renderer.setSize(width, height, false);
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
  }

  private startRenderLoop() {
    if (!this.renderer || !this.scene || !this.camera || this.frameId || !this.visible || this.destroyed) return;
    this.lastFrameTime = 0;
    const render = (time: number) => {
      this.frameId = undefined;
      if (!this.visible || this.destroyed || !this.renderer || !this.scene || !this.camera) {
        this.updateDebugState();
        return;
      }
      const lowPower = innerWidth <= 720 || this.reducedMotion.matches;
      const frameInterval = lowPower ? 1000 / 12 : 1000 / 24;
      if (time - this.lastFrameTime >= frameInterval) {
        const delta = this.lastFrameTime
          ? Math.min((time - this.lastFrameTime) / 1000, 0.05)
          : 0;
        this.mixer?.update(delta);
        if (this.model && !this.currentAction && !this.reducedMotion.matches) {
          this.model.rotation.y = Math.sin(time * 0.00035) * 0.045;
        }
        this.renderer.render(this.scene, this.camera);
        this.lastFrameTime = time;
      }
      this.frameId = requestAnimationFrame(render);
      this.updateDebugState();
    };
    this.frameId = requestAnimationFrame(render);
    this.updateDebugState();
  }

  private stopRenderLoop() {
    if (this.frameId) cancelAnimationFrame(this.frameId);
    this.frameId = undefined;
    this.lastFrameTime = 0;
    this.updateDebugState();
  }

  private findClip(actionName: DesktopPetActionName) {
    const aliases = desktopPetAnimationAliases[actionName].map(normalizeAnimationName);
    return this.clips.find((clip) => {
      const clipName = normalizeAnimationName(clip.name);
      return aliases.some((alias) => clipName === alias || clipName.includes(alias));
    });
  }

  private playAction(actionName: DesktopPetActionName) {
    if (this.destroyed) return;
    this.lastAction = actionName;
    this.root.dataset.action = actionName;
    if (this.actionResetTimer) clearTimeout(this.actionResetTimer);
    const clip = this.findClip(actionName);
    if (clip && this.mixer && this.runtime) {
      const next = this.mixer.clipAction(clip);
      this.currentAction?.fadeOut(0.18);
      next.reset().fadeIn(0.18);
      if (actionName === 'idle' || actionName === 'walk') {
        next.setLoop(this.runtime.module.LoopRepeat, Infinity);
      } else {
        next.setLoop(this.runtime.module.LoopOnce, 1);
        next.clampWhenFinished = true;
      }
      next.play();
      this.currentAction = next;
      if (actionName !== 'idle' && actionName !== 'walk') {
        this.actionResetTimer = window.setTimeout(
          () => this.playAction('idle'),
          Math.max(900, Math.min(5000, clip.duration * 1000 + 180)),
        );
      }
      return;
    }
    const fallbackDuration = actionName === 'sleep' ? 2400 : actionName === 'dance' ? 1600 : 1050;
    this.actionResetTimer = window.setTimeout(() => {
      this.root.dataset.action = 'idle';
      this.currentAction = undefined;
    }, fallbackDuration);
  }

  private scheduleIdle() {
    if (this.idleTimer) clearTimeout(this.idleTimer);
    if (!this.visible || this.destroyed) return;
    const range = this.reducedMotion.matches
      ? desktopPetConfig.reducedIdleInterval
      : desktopPetConfig.idleInterval;
    this.idleTimer = window.setTimeout(() => {
      this.idleTimer = undefined;
      const available = this.reducedMotion.matches
        ? desktopPetIdleActions.filter((action) => !['walk', 'jump', 'spin', 'dance'].includes(action))
        : desktopPetIdleActions;
      const action = pickDifferent(available, this.lastAction);
      if (action === 'walk') this.walkToSafePosition();
      else if (action) this.playAction(action);
      this.scheduleIdle();
    }, randomBetween(range.min, range.max));
  }

  private walkToSafePosition() {
    if (this.reducedMotion.matches || innerWidth <= 360 || this.dragging || !this.visible) return;
    const target = this.findSafePosition();
    if (!target) return;
    this.stopWalk();
    this.playAction('walk');
    const startX = this.x;
    const startY = this.y;
    const start = performance.now();
    const duration = randomBetween(3600, 6500);
    const animate = (time: number) => {
      this.walkFrameId = undefined;
      if (this.dragging || !this.visible || this.destroyed) return;
      const progress = Math.min(1, (time - start) / duration);
      const eased = progress < .5 ? 2 * progress * progress : 1 - Math.pow(-2 * progress + 2, 2) / 2;
      this.setPosition(startX + (target.x - startX) * eased, startY + (target.y - startY) * eased, false);
      if (progress < 1) this.walkFrameId = requestAnimationFrame(animate);
      else {
        this.playAction('idle');
        this.savePosition();
      }
    };
    this.walkFrameId = requestAnimationFrame(animate);
  }

  private findSafePosition() {
    const width = this.root.offsetWidth;
    const height = this.root.offsetHeight;
    const margin = 10;
    const navBottom = document.querySelector('header')?.getBoundingClientRect().bottom || 0;
    const avoid = [...document.querySelectorAll<HTMLElement>('header, .music-player, .back-top, main button, main .button')]
      .filter((element) => element.offsetParent !== null)
      .map((element) => element.getBoundingClientRect());
    for (let attempt = 0; attempt < 24; attempt += 1) {
      const x = randomBetween(margin, Math.max(margin, innerWidth - width - margin));
      const y = randomBetween(
        Math.max(margin, Math.ceil(navBottom + 8)),
        Math.max(margin, innerHeight - height - margin),
      );
      const candidate = { left: x, top: y, right: x + width, bottom: y + height };
      const overlaps = avoid.some((rect) =>
        candidate.left < rect.right + 8 &&
        candidate.right > rect.left - 8 &&
        candidate.top < rect.bottom + 8 &&
        candidate.bottom > rect.top - 8,
      );
      if (!overlaps) return { x, y };
    }
    return null;
  }

  private stopWalk() {
    if (this.walkFrameId) cancelAnimationFrame(this.walkFrameId);
    this.walkFrameId = undefined;
  }

  private pickDialogue() {
    const hour = new Date().getHours();
    const pageCopies = desktopPetPageDialogues[this.currentPath] || [];
    let pool: readonly string[] = desktopPetDialogues.normal;
    const roll = secureRandomUnit();
    if ((hour >= 21 || hour < 6) && roll < .48) pool = desktopPetDialogues.night;
    else if (pageCopies.length > 0 && roll < .28) pool = pageCopies;
    else if (roll < .45) pool = desktopPetDialogues.study;
    else if (roll > .91) pool = desktopPetDialogues.foreign;
    return pickDifferent(pool, this.lastDialogue) || desktopPetDialogues.normal[0];
  }

  private interact() {
    const action = pickDifferent(desktopPetClickActions, this.lastAction);
    if (action) this.playAction(action);
    if (secureRandomUnit() < .09) {
      this.hideBubble();
      this.status.textContent = '小D安静地做了一个动作';
      return;
    }
    const dialogue = this.pickDialogue();
    this.lastDialogue = dialogue;
    this.showBubble(dialogue);
  }

  private showBubble(text: string, duration = 5200) {
    if (this.bubbleTimer) clearTimeout(this.bubbleTimer);
    this.bubble.textContent = text;
    this.bubble.hidden = false;
    this.root.style.setProperty('--bubble-shift', '0px');
    requestAnimationFrame(() => {
      const rect = this.bubble.getBoundingClientRect();
      const shift = rect.left < 8 ? 8 - rect.left : rect.right > innerWidth - 8 ? innerWidth - 8 - rect.right : 0;
      this.root.style.setProperty('--bubble-shift', `${Math.round(shift)}px`);
    });
    this.bubbleTimer = window.setTimeout(() => this.hideBubble(), duration);
  }

  private hideBubble() {
    this.bubble.hidden = true;
    if (this.bubbleTimer) clearTimeout(this.bubbleTimer);
    this.bubbleTimer = undefined;
  }

  private scheduleGameInvite() {
    if (this.gameInviteTimer) clearTimeout(this.gameInviteTimer);
    if (!this.visible || this.destroyed || this.reducedMotion.matches) return;
    this.gameInviteTimer = window.setTimeout(() => {
      this.gameInviteTimer = undefined;
      if (this.canInviteGame() && secureRandomUnit() < .42) {
        this.showBubble('要不要休息一下？点“玩一下”可以和我玩个很短的小游戏。', 7600);
      }
      this.scheduleGameInvite();
    }, randomBetween(desktopPetConfig.gameInviteDelay.min, desktopPetConfig.gameInviteDelay.max));
  }

  private canInviteGame() {
    try {
      const lastClosed = Number(localStorage.getItem(desktopPetConfig.gameCooldownKey));
      return !Number.isFinite(lastClosed) || Date.now() - lastClosed >= desktopPetConfig.gameCooldown;
    } catch {
      return true;
    }
  }

  private markGameCooldown() {
    try {
      localStorage.setItem(desktopPetConfig.gameCooldownKey, String(Date.now()));
    } catch {
      // 存储不可用时只在当前页面保持低频邀请。
    }
  }

  private openRandomGame() {
    this.stopWalk();
    this.clearGameTimers();
    this.gamePanel.hidden = false;
    const games = ['rps', 'reaction', 'stars'] as const;
    const game = pickDifferent(games, this.lastGame) || 'rps';
    this.lastGame = game;
    if (game === 'rps') this.renderRpsGame();
    else if (game === 'reaction') this.renderReactionGame();
    else this.renderStarGame();
  }

  private renderRpsGame() {
    this.gameTitle.textContent = '猜拳 · 三局不用打满';
    this.gameStatus.textContent = '选一个吧，小D会同时出拳。';
    this.gameBody.innerHTML = `
      <p>石头、剪刀、布——</p>
      <div class="pet-game-choices">
        <button type="button" data-rps="rock">✊ 石头</button>
        <button type="button" data-rps="scissors">✌️ 剪刀</button>
        <button type="button" data-rps="paper">✋ 布</button>
      </div>`;
    this.gameBody.querySelectorAll<HTMLButtonElement>('[data-rps]').forEach((button) => {
      button.addEventListener('click', () => {
        const values = ['rock', 'scissors', 'paper'] as const;
        const labels = { rock: '石头', scissors: '剪刀', paper: '布' } as const;
        const user = button.dataset.rps as (typeof values)[number];
        const pet = values[randomBetween(0, values.length - 1)];
        const win = (user === 'rock' && pet === 'scissors') ||
          (user === 'scissors' && pet === 'paper') ||
          (user === 'paper' && pet === 'rock');
        this.gameStatus.textContent = user === pet
          ? `小D出了${labels[pet]}，平局，再来一次？`
          : win
            ? `小D出了${labels[pet]}。你赢啦！`
            : `小D出了${labels[pet]}。这次是小D赢。`;
        this.playAction(win ? 'happy' : 'wave');
      }, { signal: this.abortController.signal });
    });
  }

  private renderReactionGame() {
    this.gameTitle.textContent = '反应速度';
    this.gameStatus.textContent = '点击开始，然后等星星亮起来。';
    this.gameBody.innerHTML = `
      <div class="pet-game-field" data-reaction-field>
        <button type="button" data-reaction-start>开始</button>
        <button class="pet-game-target" type="button" data-reaction-target hidden>★</button>
      </div>`;
    const field = this.gameBody.querySelector<HTMLElement>('[data-reaction-field]');
    const start = this.gameBody.querySelector<HTMLButtonElement>('[data-reaction-start]');
    const target = this.gameBody.querySelector<HTMLButtonElement>('[data-reaction-target]');
    start?.addEventListener('click', (event) => {
      event.stopPropagation();
      start.hidden = true;
      this.reactionReadyAt = 0;
      this.gameStatus.textContent = '等一下……不要提前点。';
      this.reactionTimer = window.setTimeout(() => {
        this.reactionTimer = undefined;
        if (!target) return;
        this.reactionReadyAt = performance.now();
        target.hidden = false;
        target.style.left = `${randomBetween(12, Math.max(12, (field?.clientWidth || 250) - 58))}px`;
        target.style.top = `${randomBetween(12, 58)}px`;
        this.gameStatus.textContent = '现在！';
      }, randomBetween(1800, 4800));
    }, { signal: this.abortController.signal });
    field?.addEventListener('click', () => {
      if (start && !start.hidden) return;
      if (this.reactionReadyAt === 0) {
        if (this.reactionTimer) clearTimeout(this.reactionTimer);
        this.reactionTimer = undefined;
        this.gameStatus.textContent = '太着急啦，再点“重新开始”试试。';
        if (start) {
          start.hidden = false;
          start.textContent = '重新开始';
        }
      }
    }, { signal: this.abortController.signal });
    target?.addEventListener('click', (event) => {
      event.stopPropagation();
      if (!this.reactionReadyAt) return;
      const result = Math.round(performance.now() - this.reactionReadyAt);
      this.reactionReadyAt = 0;
      target.hidden = true;
      if (start) {
        start.hidden = false;
        start.textContent = '再测一次';
      }
      this.gameStatus.textContent = `${result} ms。${result < 260 ? '好快！' : result < 450 ? '很稳。' : '这次有一点悠闲。'}`;
      this.playAction('happy');
    }, { signal: this.abortController.signal });
  }

  private renderStarGame() {
    this.gameTitle.textContent = '接住小星星 · 12 秒';
    this.gameStatus.textContent = '点开始后，尽量多接几颗。';
    this.gameBody.innerHTML = `
      <div class="pet-game-field" data-star-field>
        <button type="button" data-star-start>开始</button>
        <button class="pet-game-target" type="button" data-star-target hidden>♪</button>
      </div>`;
    const field = this.gameBody.querySelector<HTMLElement>('[data-star-field]');
    const start = this.gameBody.querySelector<HTMLButtonElement>('[data-star-start]');
    const target = this.gameBody.querySelector<HTMLButtonElement>('[data-star-target]');
    const moveTarget = () => {
      if (!field || !target) return;
      target.textContent = secureRandomUnit() < .5 ? '★' : '♪';
      target.style.left = `${randomBetween(8, Math.max(8, field.clientWidth - 52))}px`;
      target.style.top = `${randomBetween(8, Math.max(8, field.clientHeight - 52))}px`;
    };
    start?.addEventListener('click', () => {
      start.hidden = true;
      if (target) target.hidden = false;
      this.starScore = 0;
      moveTarget();
      this.gameStatus.textContent = '接住 0 颗 · 还剩 12 秒';
      const started = performance.now();
      const tick = () => {
        const remaining = Math.max(0, 12 - Math.floor((performance.now() - started) / 1000));
        this.gameStatus.textContent = `接住 ${this.starScore} 颗 · 还剩 ${remaining} 秒`;
        if (remaining <= 0) {
          if (target) target.hidden = true;
          if (start) {
            start.hidden = false;
            start.textContent = '再玩一次';
          }
          this.gameStatus.textContent = `时间到！一共接住 ${this.starScore} 颗。`;
          this.playAction('dance');
          return;
        }
        this.gameTimer = window.setTimeout(tick, 250);
      };
      tick();
    }, { signal: this.abortController.signal });
    target?.addEventListener('click', () => {
      this.starScore += 1;
      moveTarget();
    }, { signal: this.abortController.signal });
  }

  private clearGameTimers() {
    if (this.gameTimer) clearTimeout(this.gameTimer);
    if (this.reactionTimer) clearTimeout(this.reactionTimer);
    this.gameTimer = undefined;
    this.reactionTimer = undefined;
    this.reactionReadyAt = 0;
  }

  private closeGame(markCooldown: boolean) {
    this.clearGameTimers();
    this.gamePanel.hidden = true;
    this.gameBody.replaceChildren();
    this.gameStatus.textContent = '';
    if (markCooldown) this.markGameCooldown();
  }

  private restorePosition() {
    const desktop = innerWidth > 720;
    if (desktop) {
      try {
        const saved = JSON.parse(localStorage.getItem(desktopPetConfig.storageKey) || 'null') as SavedPosition | null;
        if (saved && Number.isFinite(saved.x) && Number.isFinite(saved.y)) {
          const scaleX = innerWidth / Math.max(1, saved.width);
          const scaleY = innerHeight / Math.max(1, saved.height);
          this.setPosition(saved.x * scaleX, saved.y * scaleY, false);
          this.clampPosition();
          return;
        }
      } catch {
        // 无法读取位置时使用右下角默认位置。
      }
    }
    requestAnimationFrame(() => this.setDefaultPosition());
  }

  private setDefaultPosition() {
    this.setPosition(
      Math.max(8, innerWidth - this.root.offsetWidth - (innerWidth <= 720 ? 8 : 18)),
      Math.max(8, innerHeight - this.root.offsetHeight - (innerWidth <= 720 ? 8 : 18)),
      false,
    );
  }

  private setPosition(x: number, y: number, clamp = true) {
    this.x = x;
    this.y = y;
    if (clamp) this.clampPosition();
    else {
      this.root.style.left = `${Math.round(this.x)}px`;
      this.root.style.top = `${Math.round(this.y)}px`;
    }
  }

  private clampPosition() {
    const maxX = Math.max(6, innerWidth - this.root.offsetWidth - 6);
    const maxY = Math.max(6, innerHeight - this.root.offsetHeight - 6);
    this.x = Math.min(maxX, Math.max(6, this.x));
    this.y = Math.min(maxY, Math.max(6, this.y));
    this.root.style.left = `${Math.round(this.x)}px`;
    this.root.style.top = `${Math.round(this.y)}px`;
  }

  private savePosition() {
    if (innerWidth <= 720) return;
    try {
      const value: SavedPosition = { x: this.x, y: this.y, width: innerWidth, height: innerHeight };
      localStorage.setItem(desktopPetConfig.storageKey, JSON.stringify(value));
    } catch {
      // localStorage 不可用不影响拖动。
    }
  }

  private onPointerDown = (event: PointerEvent) => {
    if (event.button !== 0) return;
    this.stopWalk();
    this.dragStart = { pointerX: event.clientX, pointerY: event.clientY, x: this.x, y: this.y };
    this.dragging = false;
    this.stage.setPointerCapture(event.pointerId);
  };

  private onPointerMove = (event: PointerEvent) => {
    if (!this.dragStart) return;
    const dx = event.clientX - this.dragStart.pointerX;
    const dy = event.clientY - this.dragStart.pointerY;
    if (!this.dragging && Math.hypot(dx, dy) < 5) return;
    this.dragging = true;
    this.setPosition(this.dragStart.x + dx, this.dragStart.y + dy);
  };

  private onPointerUp = (event: PointerEvent) => {
    if (!this.dragStart) return;
    if (this.stage.hasPointerCapture(event.pointerId)) this.stage.releasePointerCapture(event.pointerId);
    this.suppressClick = this.dragging;
    this.dragStart = undefined;
    if (this.dragging) {
      this.dragging = false;
      this.clampPosition();
      this.savePosition();
      this.playAction('idle');
    }
  };

  private onStageClick = () => {
    if (this.suppressClick) {
      this.suppressClick = false;
      return;
    }
    this.interact();
  };

  private toggleMinimized = () => {
    const minimized = this.root.classList.toggle('is-minimized');
    this.minimizeButton.textContent = minimized ? '+' : '－';
    this.minimizeButton.setAttribute('aria-label', minimized ? '展开小D' : '收起小D');
    requestAnimationFrame(() => {
      this.clampPosition();
      this.resizeRenderer();
    });
  };

  private onResize = () => {
    this.clampPosition();
    this.resizeRenderer();
  };

  private onVisibilityChange = () => {
    this.visible = !document.hidden;
    if (!this.visible) {
      this.stopRenderLoop();
      this.stopWalk();
      if (this.idleTimer) clearTimeout(this.idleTimer);
      if (this.gameInviteTimer) clearTimeout(this.gameInviteTimer);
      this.idleTimer = undefined;
      this.gameInviteTimer = undefined;
      this.closeGame(false);
      return;
    }
    if (!this.initialized) this.scheduleInitialize();
    this.startRenderLoop();
    this.scheduleIdle();
    this.scheduleGameInvite();
  };

  private onMotionChange = () => {
    this.stopWalk();
    this.scheduleIdle();
    this.scheduleGameInvite();
  };

  private disposeObject(object: Object3D) {
    object.traverse((child) => {
      const mesh = child as import('three').Mesh;
      mesh.geometry?.dispose?.();
      const materials = Array.isArray(mesh.material) ? mesh.material : mesh.material ? [mesh.material] : [];
      materials.forEach((material) => {
        Object.values(material).forEach((value) => {
          if (value && typeof value === 'object' && 'isTexture' in value && value.isTexture) {
            (value as import('three').Texture).dispose();
          }
        });
        material.dispose();
      });
    });
  }

  private disposeThree() {
    if (this.model) this.disposeObject(this.model);
    this.mixer?.stopAllAction();
    this.scene?.clear();
    this.renderer?.dispose();
    this.renderer?.forceContextLoss();
    this.model = undefined;
    this.mixer = undefined;
    this.scene = undefined;
    this.camera = undefined;
    this.renderer = undefined;
    this.currentAction = undefined;
    this.updateDebugState();
  }

  private updateDebugState() {
    window.__hdpDesktopPetDebug = {
      instanceCount: this.destroyed ? 0 : 1,
      rendererCount: this.renderer ? 1 : 0,
      renderLoopActive: Boolean(this.frameId),
    };
    this.root.dataset.renderLoop = this.frameId ? 'active' : 'paused';
  }

  destroy = () => {
    if (this.destroyed) return;
    this.destroyed = true;
    this.abortController.abort();
    this.stopRenderLoop();
    this.stopWalk();
    this.clearGameTimers();
    [this.idleTimer, this.bubbleTimer, this.gameInviteTimer, this.actionResetTimer].forEach((timer) => {
      if (timer) clearTimeout(timer);
    });
    if (this.idleHandle) {
      if ('cancelIdleCallback' in window) window.cancelIdleCallback(this.idleHandle);
      else clearTimeout(this.idleHandle);
    }
    this.disposeThree();
    this.root.dataset.desktopPetInstance = 'destroyed';
    if (window.__hdpDesktopPet === this) delete window.__hdpDesktopPet;
    this.updateDebugState();
  };
}

export function mountDesktopPet() {
  const root = document.querySelector<HTMLElement>('[data-desktop-pet]');
  if (!root) return;
  const existing = window.__hdpDesktopPet;
  if (existing?.root === root) {
    existing.refreshContext();
    return;
  }
  existing?.destroy();
  try {
    window.__hdpDesktopPet = new DesktopPetController(root);
  } catch {
    root.dataset.state = 'fallback';
  }
}
