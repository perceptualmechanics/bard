import { test } from 'node:test';
import assert from 'node:assert/strict';

class FakeClassList {
  constructor(el) { this.el = el; }
  _set() { return new Set(this.el.className.split(' ').filter(Boolean)); }
  add(name) { const s = this._set(); s.add(name); this.el.className = [...s].join(' '); }
  remove(name) { const s = this._set(); s.delete(name); this.el.className = [...s].join(' '); }
  contains(name) { return this._set().has(name); }
}

class FakeElement {
  constructor(tagName) {
    this.tagName = tagName.toUpperCase();
    this.className = '';
    this.style = {};
    this.dataset = {};
    this._attrs = {};
    this.children = [];
    this.parentElement = null;
    this._text = '';
  }
  get classList() { return new FakeClassList(this); }
  setAttribute(name, value) { this._attrs[name] = value; }
  getAttribute(name) { return this._attrs[name]; }
  appendChild(child) { child.parentElement = this; this.children.push(child); return child; }
  remove() {
    if (!this.parentElement) return;
    const i = this.parentElement.children.indexOf(this);
    if (i >= 0) this.parentElement.children.splice(i, 1);
    this.parentElement = null;
  }
  set textContent(v) { this._text = v; this.children = []; }
  get textContent() { return this._text; }
  _matches(selector) {
    const [tag, ...classes] = selector.split('.');
    if (tag && this.tagName !== tag.toUpperCase()) return false;
    return classes.every(c => this.classList.contains(c));
  }
  querySelector(selector) {
    for (const child of this.children) {
      if (child._matches(selector)) return child;
      const found = child.querySelector(selector);
      if (found) return found;
    }
    return null;
  }
  querySelectorAll(selector) {
    const out = [];
    for (const child of this.children) {
      if (child._matches(selector)) out.push(child);
      out.push(...child.querySelectorAll(selector));
    }
    return out;
  }
}

function installFakeDom() {
  const head = new FakeElement('head');
  global.document = {
    createElement: (tag) => new FakeElement(tag),
    head,
  };
  global.requestAnimationFrame = (fn) => fn();
}

function teardownFakeDom() {
  delete global.document;
  delete global.requestAnimationFrame;
}

test('DomRenderer.onMask sets the archetype overlay text and color, adds the .masked class, and leaves the face untouched', async () => {
  installFakeDom();
  try {
    const { DomRenderer } = await import('../src/renderers/DomRenderer.js?t=' + Date.now());
    const renderer = new DomRenderer({
      cast: {
        brian: {
          name: 'Brian',
          color: '#1d4e89',
          masks: { idle: ['(o)', '/|\\', '/ \\'] },
          archetypeMasks: { trickster: { color: '#c0392b', lines: ['*  *', ' ** '] } },
        },
      },
    });
    const container = new FakeElement('div');
    renderer.mount(container);
    renderer.onEnter(['brian']);

    const actorEl = renderer.actorEls.brian;
    const facePre = actorEl.querySelector('pre.bard-mask');
    const archetypePre = actorEl.querySelector('pre.bard-archetype');

    assert.equal(archetypePre.textContent, '');
    assert.equal(facePre.textContent, '(o)\n/|\\\n/ \\');
    assert.equal(facePre.style.color, '#1d4e89');
    assert.equal(actorEl.classList.contains('masked'), false);

    renderer.onMask('brian', 'trickster');

    assert.equal(archetypePre.textContent, '*  *\n ** ');
    assert.equal(archetypePre.style.color, '#c0392b');
    assert.notEqual(archetypePre.style.color, facePre.style.color);
    assert.equal(actorEl.classList.contains('masked'), true);
    assert.equal(facePre.textContent, '(o)\n/|\\\n/ \\');
    assert.equal(facePre.style.color, '#1d4e89');

    renderer.onUnmask('brian');
    assert.equal(actorEl.classList.contains('masked'), false);
    assert.equal(facePre.textContent, '(o)\n/|\\\n/ \\');
  } finally {
    teardownFakeDom();
  }
});

test('DomRenderer.onMask with an unknown archetype key is a no-op (no matching fallback, unlike masks.idle)', async () => {
  installFakeDom();
  try {
    const { DomRenderer } = await import('../src/renderers/DomRenderer.js?t=' + Date.now());
    const renderer = new DomRenderer({
      cast: { brian: { name: 'Brian', archetypeMasks: { trickster: { color: '#c0392b', lines: ['*'] } } } },
    });
    const container = new FakeElement('div');
    renderer.mount(container);
    renderer.onEnter(['brian']);

    renderer.onMask('brian', 'nonexistent');

    const actorEl = renderer.actorEls.brian;
    assert.equal(actorEl.classList.contains('masked'), false);
    assert.equal(actorEl.querySelector('pre.bard-archetype').textContent, '');
  } finally {
    teardownFakeDom();
  }
});

test('DomRenderer.onLine during a mask does not disturb the archetype overlay (two independent layers)', async () => {
  installFakeDom();
  try {
    const { DomRenderer } = await import('../src/renderers/DomRenderer.js?t=' + Date.now());
    const renderer = new DomRenderer({
      cast: {
        brian: {
          name: 'Brian',
          masks: { idle: ['(o)'] },
          archetypeMasks: { trickster: { color: '#c0392b', lines: ['*  *'] } },
        },
      },
    });
    const container = new FakeElement('div');
    renderer.mount(container);
    renderer.onEnter(['brian']);
    renderer.onMask('brian', 'trickster');
    renderer.onLine('brian', 'Still speaking, still masked.', {});

    const actorEl = renderer.actorEls.brian;
    assert.equal(actorEl.classList.contains('masked'), true);
    assert.equal(actorEl.querySelector('pre.bard-archetype').textContent, '*  *');
    assert.equal(actorEl.querySelector('pre.bard-archetype').style.color, '#c0392b');
  } finally {
    teardownFakeDom();
  }
});

test('two actors masked with different archetypes get visually distinct colors from each other and from their own faces', async () => {
  installFakeDom();
  try {
    const { DomRenderer } = await import('../src/renderers/DomRenderer.js?t=' + Date.now());
    const renderer = new DomRenderer({
      cast: {
        clytemnestra: { name: 'Clytemnestra', color: '#b83b5e',
          archetypeMasks: { avenger: { color: '#c0392b', lines: ['X'] } } },
        agamemnon: { name: 'Agamemnon', color: '#c9a227',
          archetypeMasks: { king: { color: '#8e5fc9', lines: ['K'] } } },
      },
    });
    const container = new FakeElement('div');
    renderer.mount(container);
    renderer.onEnter(['clytemnestra', 'agamemnon']);
    renderer.onMask('clytemnestra', 'avenger');
    renderer.onMask('agamemnon', 'king');

    const colors = new Set([
      renderer.actorEls.clytemnestra.querySelector('pre.bard-mask').style.color,
      renderer.actorEls.clytemnestra.querySelector('pre.bard-archetype').style.color,
      renderer.actorEls.agamemnon.querySelector('pre.bard-mask').style.color,
      renderer.actorEls.agamemnon.querySelector('pre.bard-archetype').style.color,
    ]);
    assert.equal(colors.size, 4);
  } finally {
    teardownFakeDom();
  }
});
