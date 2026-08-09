// ─── bard.js: mask/unmask tests ─────────────────────────────────────────────
// Proof-of-concept event pair (see Player.js's own onMask/onUnmask comment
// and README's vocabulary section). These are pure Player-dispatch tests —
// no DOM, same reasoning as fountain.test.js's stub-renderer smoke test:
// DomRenderer itself needs a real browser (it calls document.createElement
// with no environment guard, unlike injectBaseStyles), so its actual
// rendering is verified manually against the demo, not here.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { compileScript } from '../src/compile.js';
import { Player } from '../src/Player.js';

function stub() {
  const calls = [];
  return {
    calls,
    renderer: {
      onSceneChange: (scene) => calls.push(['onSceneChange', scene.slug]),
      onEnter: (keys) => calls.push(['onEnter', keys]),
      onExit: (keys) => calls.push(['onExit', keys]),
      onLine: (key, text) => calls.push(['onLine', key, text]),
      onMask: (key, mask) => calls.push(['onMask', key, mask]),
      onUnmask: (key) => calls.push(['onUnmask', key]),
      onEnd: () => calls.push(['onEnd']),
    },
  };
}

test('mask/unmask events reach the renderer in authored order, alongside ordinary lines', () => {
  const scene = {
    slug: 'A RITE',
    cast: ['brian'],
    events: [
      { type: 'enter', keys: ['brian'] },
      { type: 'line', key: 'brian', text: 'Just myself, for now.' },
      { type: 'mask', key: 'brian', mask: 'trickster' },
      { type: 'line', key: 'brian', text: 'Still myself — just wearing something else too.' },
      { type: 'unmask', key: 'brian' },
      { type: 'line', key: 'brian', text: 'Bare-faced again.' },
      { type: 'exit', keys: ['brian'] },
    ],
  };
  const script = compileScript([scene], { intermissions: false });
  const { calls, renderer } = stub();
  const player = new Player(script, renderer);
  for (let i = 0; i < script.timeline.length; i++) player.goTo(i);

  assert.deepEqual(calls, [
    ['onSceneChange', 'A RITE'],
    ['onEnter', ['brian']],
    ['onLine', 'brian', 'Just myself, for now.'],
    ['onMask', 'brian', 'trickster'],
    ['onLine', 'brian', 'Still myself — just wearing something else too.'],
    ['onUnmask', 'brian'],
    ['onLine', 'brian', 'Bare-faced again.'],
    ['onExit', ['brian']],
    ['onEnd'],
  ]);
});

test('a mask left on when the character exits never gets an explicit unmask call — that cleanup is the renderer\'s own job, same as it already owns "who is on stage"', () => {
  const scene = {
    slug: 'LEAVES MASKED',
    cast: ['brian'],
    events: [
      { type: 'enter', keys: ['brian'] },
      { type: 'mask', key: 'brian', mask: 'trickster' },
      { type: 'line', key: 'brian', text: 'Never unmasked before leaving.' },
      { type: 'exit', keys: ['brian'] },
    ],
  };
  const script = compileScript([scene], { intermissions: false });
  const { calls, renderer } = stub();
  const player = new Player(script, renderer);
  for (let i = 0; i < script.timeline.length; i++) player.goTo(i);

  const types = calls.map(c => c[0]);
  assert.deepEqual(types, ['onSceneChange', 'onEnter', 'onMask', 'onLine', 'onExit', 'onEnd']);
  // Player itself never synthesizes an unmask — confirms it's not tracking
  // masked state at all, exactly like it never tracks who's on stage.
  assert.ok(!types.includes('onUnmask'));
});

test('Player never throws when a renderer implements neither onMask nor onUnmask', () => {
  const scene = {
    slug: 'NO MASK SUPPORT',
    cast: ['brian'],
    events: [
      { type: 'enter', keys: ['brian'] },
      { type: 'mask', key: 'brian', mask: 'trickster' },
      { type: 'line', key: 'brian', text: 'Still fine.' },
      { type: 'unmask', key: 'brian' },
      { type: 'exit', keys: ['brian'] },
    ],
  };
  const script = compileScript([scene], { intermissions: false });
  const calls = [];
  // A minimal renderer with no mask support at all — matches the "all
  // optional" contract every other event type already gets.
  const renderer = {
    onLine: (key, text) => calls.push(['onLine', key, text]),
  };
  const player = new Player(script, renderer);
  assert.doesNotThrow(() => {
    for (let i = 0; i < script.timeline.length; i++) player.goTo(i);
  });
  assert.deepEqual(calls, [['onLine', 'brian', 'Still fine.']]);
});
