// ─── bard.js: Player ────────────────────────────────────────────────────────
// Walks a compiled { scenes, timeline } script one event at a time and
// calls the matching method on a renderer. This is the entire "engine": it
// knows nothing about DOM, canvas, WebGL, cowsay bubbles, or ASCII figures —
// that's all the renderer's job. It only knows how to hold a position in a
// flat list of events and move forward, backward, or on a timer.
//
// Renderer contract (all optional — Player checks before calling):
//   mount(container)
//   onSceneChange(scene, sceneIndex)
//   onChorus(text)
//   onEnter(keys)
//   onExit(keys)
//   onLine(key, text, { mask, voice, silent })
//   onIntermission()
//   onEnd()
//   dispose()
//
// Pacing: read at human reading speed, not AI reading speed — the same
// heuristic theater.js worked out by hand (clamp text.length*55ms to
// 1900-10000ms), generalized here so any consumer gets it for free.
const MIN_DUR = 1900;
const MAX_DUR = 10000;
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
    this.playing = true;
    // A fresh (or just-restarted) player has no current event yet — start
    // at the beginning rather than trying to schedule a beat that doesn't
    // exist. goTo(0) will call _scheduleNext() itself once playing is true.
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

  /** Replace the script in place (e.g. a reshuffled program) and start over. */
  restart(script) {
    if (script) this.script = script;
    this.curSceneIndex = -1;
    this.index = -1;
    this.playing = true;
    return this.goTo(0);
  }

  goTo(newIndex) {
    clearTimeout(this._timer);
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
    clearTimeout(this._timer);
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
      case 'intermission':
        this.renderer.onIntermission?.();
        break;
      default:
        // Forward-compatible with future event types (camera, blocking,
        // sound) a later layer might add — an engine built only for Greek
        // theater shouldn't hard-fail on a beat type it doesn't recognize.
        this.renderer.onUnknownEvent?.(event);
    }
  }

  _scheduleNext() {
    clearTimeout(this._timer);
    if (!this.playing || this.isAtEnd) return;
    const { event } = this.script.timeline[this.index];
    const dur = event.type === 'intermission'
      ? INTERMISSION_DUR
      : Math.min(MAX_DUR, Math.max(MIN_DUR, ((event.text || '').length) * MS_PER_CHAR));
    this._timer = setTimeout(() => this.next(), dur);
  }
}
