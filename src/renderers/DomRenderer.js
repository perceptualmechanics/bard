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
//
// A second, unrelated thing also called a mask (proof of concept, see
// Player.js's own onMask/onUnmask comment): a worn archetype, authored via
// `mask`/`unmask` events, worn visibly alongside a character's own face
// rather than swapping it out — Julie Taymor's Lion King staging, not a
// costume change. Configured separately per cast member as `archetypeMasks`
// (deliberately not reusing the `masks` field or its `.bard-mask` DOM
// class, so the two can never be confused for each other in config or in
// markup).
//
// A real mask can sit in front of an actor's actual face because a stage
// has depth — two solid objects can occupy the same line of sight without
// touching. An ASCII grid has no such depth: every character cell holds
// exactly one glyph, so editing the wearer's own face glyph to "add" a
// mask doesn't add anything, it overwrites what was there — the opposite
// of Taymor's principle, and a first pass at this feature made exactly
// that mistake. The fix is to stop trying to share space at all: the
// archetype renders as its own small glyph in its own screen position
// (just above the head, never touching the face's own character cells)
// and its own color (`archetypeMasks[name].color`, distinct from the
// wearer's own persona color) — two separately legible objects in two
// colors, rather than one glyph edited in place.

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
    /* Worn archetype mask (see this file's header comment) — a small
       emblem floating just above the actor's own head, never overlapping
       the face's own character cells. -4em clears even a tall multi-line
       face with real margin to spare (the alternative, sizing this offset
       exactly to each face's height, would need to vary per actor and per
       custom masks.idle — a fixed generous clearance is the simpler,
       harder-to-get-wrong choice for a proof of concept). Its color comes
       from onMask (per-archetype, distinct from the wearer's own persona
       color) — the default here only covers a mask authored with no
       color of its own. Empty and invisible until onMask sets its
       content. */
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
    .bard-bubble.on { opacity: 1; transform: translateX(-50%) translateY(0); }
    /* A masked actor's archetype emblem lives in the same "above the
       actor" space this bubble's default bottom:100% already claims (both
       are positioned against .bard-actor, not against the face pre
       specifically) — left alone, a multi-line line of dialogue paints
       straight through the emblem. 7rem is a fixed (not vw-scaled)
       clearance sized to the archetype's own worst case: its font-size
       tops out at 1.41rem and it sits 4em above the actor (both computed
       from that same 1.41rem), so its highest reach is a fixed ~5.6rem
       regardless of viewport — 7rem comfortably clears that plus a gap. */
    .bard-actor.masked .bard-bubble { bottom: calc(100% + 7rem); }
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
   *   `archetypeMasks` is the worn-mask proof of concept (onMask/onUnmask
   *   below) — a separate map from `masks`, and deliberately a different
   *   shape (an object with `lines` + an optional `color`, not a bare
   *   array): color is how this layer stays visually distinct from the
   *   wearer's own face rather than overwriting it, so it's a first-class
   *   part of an archetype's definition, not an afterthought.
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
      // Archetype layer first in DOM order, purely so its z-index: 0 has
      // something concrete to sit below — the face (z-index: 1) is what
      // actually keeps it visually on top. Empty and invisible (no
      // .masked class yet) until a mask event fills it in.
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

  // Worn archetype mask (proof of concept) — see this file's header comment
  // and Player.js's onMask/onUnmask for why this is a different thing from
  // onLine's own `mask` pose option below. Deliberately touches nothing on
  // `pre.bard-mask` (the wearer's own face) — the two stay two objects,
  // never one edited object. Unknown keys degrade to nothing drawn rather
  // than a fallback figure — unlike `masks.idle`, there's no sensible
  // default archetype to fall back to.
  onMask(key, mask) {
    const el = this.actorEls[key];
    if (!el) return;
    const person = this.cast[key] || { name: key };
    const archetype = person.archetypeMasks?.[mask];
    if (!archetype) return;
    const pre = el.querySelector('pre.bard-archetype');
    if (!pre) return;
    pre.textContent = archetype.lines.join('\n');
    // '' (not a fallback string) clears any previous mask's inline color,
    // letting the CSS default take back over — an archetype authored with
    // no color of its own isn't an error, just an undistinguished one.
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
