
import { asciiBubble } from '../text.js';

function escapeHtml(s) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
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
       the figures/bubbles/caption should scale to fill whichever it gets.
       Deliberately no height:100% here — this renders alongside a sibling
       .bard-caption below it, and a mount container is not always exactly
       as tall as this content wants to be. This sizes to its own content
       (the actors) and leaves vertical placement entirely to whatever
       layout the consumer's mount container uses — a flex column with
       justify-content:flex-end, in this package's own reference demo. */
    .bard-stage { position: relative; width: 100%;
      display: flex; align-items: flex-end; justify-content: center;
      gap: clamp(3rem, 8vw, 8rem); font-family: 'Courier New', Courier, monospace; }
    .bard-actor { position: relative; text-align: center; opacity: 0;
      transform: translateY(8px); transition: opacity .3s, transform .3s; }
    .bard-actor.on { opacity: 1; transform: translateY(0); }
    .bard-actor pre.bard-mask { margin: 0; line-height: 1.1;
      font-size: clamp(1.23rem, 2.82vw, 2.46rem); transition: color .15s;
      position: relative; z-index: 1; }
    .bard-actor.talking pre.bard-mask { animation: bard-talk .3s ease-in-out; }
    @keyframes bard-talk { 50% { transform: scale(1.06); } }
    /* A worn archetype is its own glyph above the head, in its own colour,
       never in the face's cells: an ASCII grid has no depth, so a mask drawn
       into the face would replace it rather than sit in front of it. */
    .bard-actor pre.bard-archetype { position: absolute;
      top: -4em; left: 50%; transform: translateX(-50%);
      margin: 0; line-height: 1.05; pointer-events: none;
      font-size: clamp(.79rem, 1.41vw, 1.41rem); opacity: 0;
      color: rgba(217, 184, 106, 0.85);
      transition: opacity .4s ease, color .15s; }
    .bard-actor.masked pre.bard-archetype { opacity: 1; }
    .bard-name { font-size: clamp(.62rem, .88vw, .84rem); letter-spacing: .1em;
      text-transform: uppercase; opacity: .6; margin-top: .35rem; }
    .bard-bubble { position: absolute; bottom: 100%; left: 50%;
      transform: translateX(-50%) translateY(6px); white-space: pre;
      font-size: clamp(.75rem, 1.14vw, 1.06rem); line-height: 1.2;
      padding: .4rem .1rem; opacity: 0;
      transition: opacity .2s, transform .2s, bottom .2s ease; pointer-events: none; }
    /* Clears the archetype's highest reach, 4em of its 1.41rem cap (~5.6rem). */
    .bard-actor.masked .bard-bubble { bottom: calc(100% + 7rem); }
    .bard-bubble.on { opacity: 1; transform: translateX(-50%) translateY(0); }
    .bard-bubble-name { display: block; font-size: .65rem; text-transform: uppercase;
      letter-spacing: .1em; margin-bottom: .15rem; opacity: .8; }
    .bard-caption { text-align: center; font-style: italic; opacity: .75;
      font-size: clamp(1rem, 1.6vw, 1.5rem); min-height: 1.4em;
      max-width: 46rem; margin-left: auto; margin-right: auto; }
    .bard-sr-live { position: absolute; width: 1px; height: 1px; overflow: hidden;
      clip: rect(0,0,0,0); white-space: nowrap; }
  `;
  document.head.appendChild(style);
}

export class DomRenderer {
  /**
   * @param {{ cast: Record<string, {name:string,color?:string,tag?:string,
   *            masks?: Record<string,string[]>,
   *            archetypeMasks?: Record<string,{lines:string[],color?:string}>}> }} config
   *   `masks` are per-line poses of the face; `archetypeMasks` are worn
   *   through mask/unmask events, on top of the face, until unmasked.
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
      const archetype = document.createElement('pre');
      archetype.className = 'bard-archetype';
      archetype.setAttribute('aria-hidden', 'true');
      const pre = document.createElement('pre');
      pre.className = 'bard-mask';
      if (person.color) pre.style.color = person.color;
      pre.textContent = (person.masks?.idle || ['(o)', '/|\\', '/ \\']).join('\n');
      const name = document.createElement('div');
      name.className = 'bard-name';
      name.textContent = person.name || key;
      el.appendChild(archetype);
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

  onMask(key, mask) {
    const el = this.actorEls[key];
    const person = this.cast[key] || { name: key };
    const archetype = person.archetypeMasks?.[mask];
    if (!el || !archetype) return;
    const pre = el.querySelector('pre.bard-archetype');
    pre.textContent = archetype.lines.join('\n');
    pre.style.color = archetype.color || '';
    el.classList.add('masked');
    this.srLive.textContent = `${person.name || key} puts on the ${mask} mask.`;
  }

  onUnmask(key) {
    const el = this.actorEls[key];
    if (!el) return;
    el.classList.remove('masked');
    const person = this.cast[key] || { name: key };
    this.srLive.textContent = `${person.name || key} removes the mask.`;
  }

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
