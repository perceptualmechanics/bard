const MIN_DUR = 1900;
const MAX_DUR = 40000;
const MS_PER_CHAR = 55;
const INTERMISSION_DUR = 4400;

export class Player {
  /**
   * @param {{ scenes: any[], timeline: { sceneIndex: number, event: object }[] }} script
   * @param {object} renderer
   * @param {{ onAdvance?: (info: {index:number,length:number})=>void, onEnd?: ()=>void }} [hooks]
   */
  constructor(script, renderer, hooks = {}) {
    this.script = script;
    this.renderer = renderer;
    this.hooks = hooks;
    this.index = -1;
    this.curSceneIndex = -1;
    this.playing = false;
    this._timer = null;
    this._disposed = false;
  }

  mount(container) {
    this.renderer.mount?.(container);
    return this;
  }

  get length() {
    return this.script.timeline.length;
  }

  get isAtEnd() {
    return this.index >= this.length - 1;
  }

  play() {
    if (this._disposed || !this.length) return this;
    if (this.isAtEnd && this.index >= 0) {
      this.playing = false;
      return this;
    }
    this.playing = true;
    if (this.index < 0) return this.goTo(0);
    this._scheduleNext();
    return this;
  }

  pause() {
    this.playing = false;
    clearTimeout(this._timer);
    return this;
  }

  toggle() {
    return this.playing ? this.pause() : this.play();
  }

  next() {
    return this.goTo(this.index + 1);
  }

  prev() {
    return this.goTo(this.index - 1);
  }

  /**
   * Replace the script in place (e.g. a reshuffled program) and start over.
   * @param {object} [script]
   * @param {{ autoplay?: boolean }} [opts] autoplay defaults to true, which
   *   is what "start over" has always meant here. Pass false when the
   *   consumer knows the reel should sit still — a visitor with
   *   prefers-reduced-motion set, say, who asked for the next programme but
   *   not for it to advance itself.
   */
  restart(script, opts = {}) {
    if (this._disposed) return this;
    if (script) this.script = script;
    this.curSceneIndex = -1;
    this.index = -1;
    this.playing = opts.autoplay ?? true;
    return this.goTo(0);
  }

  goTo(newIndex) {
    if (this._disposed) return this;
    clearTimeout(this._timer);
    if (!this.length) return this;
    const clamped = Math.max(0, Math.min(this.length - 1, newIndex));
    this.index = clamped;

    const { sceneIndex, event } = this.script.timeline[clamped];
    if (sceneIndex !== this.curSceneIndex) {
      this.curSceneIndex = sceneIndex;
      this.renderer.onSceneChange?.(this.script.scenes[sceneIndex], sceneIndex);
    }
    this._dispatch(event);

    this.hooks.onAdvance?.({ index: this.index, length: this.length });
    if (this.isAtEnd) {
      this.renderer.onEnd?.();
      this.hooks.onEnd?.();
      this.playing = false;
    } else {
      this._scheduleNext();
    }
    return this;
  }

  dispose() {
    this._disposed = true;
    this.playing = false;
    clearTimeout(this._timer);
    this._timer = null;
    this.renderer.dispose?.();
  }

  _dispatch(event) {
    switch (event.type) {
      case 'chorus':
        this.renderer.onChorus?.(event.text);
        break;
      case 'enter':
        this.renderer.onEnter?.(event.keys);
        break;
      case 'exit':
        this.renderer.onExit?.(event.keys);
        break;
      case 'line':
        this.renderer.onLine?.(event.key, event.text, {
          mask: event.mask, voice: event.voice, silent: event.silent,
        });
        break;
      case 'mask':
        this.renderer.onMask?.(event.key, event.mask);
        break;
      case 'unmask':
        this.renderer.onUnmask?.(event.key);
        break;
      case 'intermission':
        this.renderer.onIntermission?.();
        break;
      default:
        this.renderer.onUnknownEvent?.(event);
    }
  }

  _scheduleNext() {
    clearTimeout(this._timer);
    if (this._disposed || !this.playing || this.isAtEnd) return;
    const { event } = this.script.timeline[this.index];
    const dur = event.type === 'intermission'
      ? INTERMISSION_DUR
      : Math.min(MAX_DUR, Math.max(MIN_DUR, ((event.text || '').length) * MS_PER_CHAR));
    this._timer = setTimeout(() => this.next(), dur);
  }
}
