// ─── bard.js: DomRenderer ───────────────────────────────────────────────────
// The reference renderer for the amphitheater. It draws exactly the root
// vocabulary and nothing else: a stage actors enter and exit, masks (a
// fixed ASCII figure per named pose — not naturalistic animation, a mask
// literally is a fixed face), a cowsay-style speech bubble per line, and a
// caption line for the chorus. No camera, no blocking coordinates, no set
// changes beyond what onSceneChange clears — those are for a renderer (or a
// version of this one) built for the "modern amenities" layer.
//
// Everything about how a *specific* production looks — the curtain, an
// audience silhouette, a marquee frame, playback controls, an interstitial
// card between plays, an end card — is staging, not the amphitheater
// itself, and deliberately lives in the consuming site instead of here.
// This renderer only needs one thing from the consumer to run: a `cast`
// map of key -> { name, color, tag, masks }, where `masks` is itself a map
// of mask-name -> a 3-line ASCII array (an `idle` mask is required, others
// are optional and fall back to idle).

function escapeHtml(s) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function wrapText(text, width) {
  const words = text.split(/\s+/);
  const lines = [];
  let cur = '';
  words.forEach(w => {
    const test = cur ? cur + ' ' + w : w;
    if (test.length > width && cur) { lines.push(cur); cur = w; }
    else cur = test;
  });
  if (cur) lines.push(cur);
  return lines;
}

function asciiBubble(text, voice, width = 40) {
  const lines = wrapText(text, width);
  const maxLen = Math.max(...lines.map(l => l.length), voice ? 9 : 0);
  const top = ' ' + '_'.repeat(maxLen + 2);
  const bottom = ' ' + '-'.repeat(maxLen + 2);
  const rows = [];
  if (voice) rows.push(`| ${'(voice)'.padEnd(maxLen)} |`);
  lines.forEach(l => rows.push(`| ${l.padEnd(maxLen)} |`));
  return [top, ...rows, bottom].join('\n');
}

let stylesInjected = false;
function injectBaseStyles() {
  if (stylesInjected || typeof document === 'undefined') return;
  stylesInjected = true;
  const style = document.createElement('style');
  style.id = 'bardjs-dom-renderer-styles';
  style.textContent = `
    /* Sizes use clamp() rather than fixed rems: this renderer is meant to
       work embedded in a small box or filling an entire viewport (a black
       box taking up the whole window is the demo's own default stage), and
       the figures/bubbles/caption should scale to fill whichever it gets. */
    .bard-stage { position: relative; width: 100%; height: 100%;
      display: flex; align-items: flex-end; justify-content: center;
      gap: clamp(2rem, 6vw, 6rem); font-family: 'Courier New', Courier, monospace; }
    .bard-actor { position: relative; text-align: center; opacity: 0;
      transform: translateY(8px); transition: opacity .3s, transform .3s; }
    .bard-actor.on { opacity: 1; transform: translateY(0); }
    .bard-actor pre.bard-mask { margin: 0; line-height: 1.1;
      font-size: clamp(1.4rem, 3.2vw, 2.8rem); transition: color .15s; }
    .bard-actor.talking pre.bard-mask { animation: bard-talk .3s ease-in-out; }
    @keyframes bard-talk { 50% { transform: scale(1.06); } }
    .bard-name { font-size: clamp(.7rem, 1vw, .95rem); letter-spacing: .1em;
      text-transform: uppercase; opacity: .6; margin-top: .35rem; }
    .bard-bubble { position: absolute; bottom: 100%; left: 50%;
      transform: translateX(-50%) translateY(6px); white-space: pre;
      font-size: clamp(.85rem, 1.3vw, 1.2rem); line-height: 1.2;
      padding: .4rem .1rem; opacity: 0;
      transition: opacity .2s, transform .2s; pointer-events: none; }
    .bard-bubble.on { opacity: 1; transform: translateX(-50%) translateY(0); }
    .bard-bubble-name { display: block; font-size: .65rem; text-transform: uppercase;
      letter-spacing: .1em; margin-bottom: .15rem; opacity: .8; }
    .bard-caption { text-align: center; font-style: italic; opacity: .75;
      font-size: clamp(1rem, 1.6vw, 1.5rem); min-height: 1.4em; }
    .bard-sr-live { position: absolute; width: 1px; height: 1px; overflow: hidden;
      clip: rect(0,0,0,0); white-space: nowrap; }
  `;
  document.head.appendChild(style);
}

export class DomRenderer {
  /**
   * @param {{ cast: Record<string, {name:string,color?:string,tag?:string,
   *            masks?: Record<string,string[]>}> }} config
   */
  constructor(config) {
    this.cast = config.cast || {};
    this.actorEls = {};
  }

  mount(container) {
    injectBaseStyles();
    this.container = container;

    this.stage = document.createElement('div');
    this.stage.className = 'bard-stage';
    this.stage.setAttribute('aria-hidden', 'true'); // sr-live carries the real content

    this.caption = document.createElement('div');
    this.caption.className = 'bard-caption';

    this.srLive = document.createElement('div');
    this.srLive.className = 'bard-sr-live';
    this.srLive.setAttribute('aria-live', 'polite');
    this.srLive.setAttribute('aria-atomic', 'true');

    container.appendChild(this.stage);
    container.appendChild(this.caption);
    container.appendChild(this.srLive);
  }

  onSceneChange(scene) {
    Object.values(this.actorEls).forEach(el => el.remove());
    this.actorEls = {};
    this.caption.textContent = '';
    this.srLive.textContent = scene?.slug ? `Scene: ${scene.slug}.` : '';
  }

  onEnter(keys) {
    keys.forEach(key => {
      if (this.actorEls[key]) return;
      const person = this.cast[key] || { name: key };
      const el = document.createElement('div');
      el.className = 'bard-actor';
      el.dataset.key = key;
      const pre = document.createElement('pre');
      pre.className = 'bard-mask';
      if (person.color) pre.style.color = person.color;
      pre.textContent = (person.masks?.idle || ['(o)', '/|\\', '/ \\']).join('\n');
      const name = document.createElement('div');
      name.className = 'bard-name';
      name.textContent = person.name || key;
      el.appendChild(pre);
      el.appendChild(name);
      this.stage.appendChild(el);
      this.actorEls[key] = el;
      requestAnimationFrame(() => el.classList.add('on'));
    });
  }

  onExit(keys) {
    keys.forEach(key => {
      const el = this.actorEls[key];
      if (!el) return;
      el.classList.remove('on');
      setTimeout(() => el.remove(), 300);
      delete this.actorEls[key];
    });
  }

  // Only one line is ever "current" at a time — clear every bubble on stage,
  // not just the speaking actor's own, or a previous speaker's bubble is
  // left behind indefinitely (nothing else ever removes it) and overlaps
  // whoever speaks next. Ported from theater.js's TheaterRenderer, which
  // already had this right.
  clearBubbles() {
    this.stage.querySelectorAll('.bard-bubble').forEach(b => b.remove());
    Object.values(this.actorEls).forEach(el => el.classList.remove('talking'));
  }

  onChorus(text) {
    this.clearBubbles();
    this.caption.textContent = text;
    this.srLive.textContent = text;
  }

  onLine(key, text, { mask, voice, silent } = {}) {
    this.clearBubbles();
    const person = this.cast[key] || { name: key };
    const el = this.actorEls[key];
    if (el) {
      const pre = el.querySelector('pre.bard-mask');
      if (pre) pre.textContent = (person.masks?.[mask] || person.masks?.idle || ['(o)', '/|\\', '/ \\']).join('\n');
    }

    const announce = `${person.name || key}${voice ? ' (voice)' : ''}: ${text}`;
    this.srLive.textContent = announce;

    if (silent || !el) return; // reaction beats, or an offstage voice with no figure to bubble from

    el.classList.add('talking');
    setTimeout(() => el.classList.remove('talking'), 300);

    const bubble = document.createElement('div');
    bubble.className = 'bard-bubble';
    bubble.innerHTML = `<span class="bard-bubble-name">${escapeHtml(person.name || key)}${voice ? ' (voice)' : ''}</span>${escapeHtml(asciiBubble(text, false))}`;
    el.appendChild(bubble);
    requestAnimationFrame(() => bubble.classList.add('on'));
  }

  onIntermission() {
    this.clearBubbles();
    this.caption.textContent = '— intermission —';
    this.srLive.textContent = 'Intermission.';
  }

  dispose() {
    this.container?.replaceChildren();
  }
}
