// ─── bard.js: fountain tests ────────────────────────────────────────────────
// Node's built-in test runner (node:test / node:assert) — no new dependency
// for a project that otherwise has zero, matching the rest of bard.js.
// Run with: node --test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseFountainScript, compileFountainScript } from '../src/fountain.js';
import { Player } from '../src/Player.js';

test('scene heading starts a new scene, strips a trailing scene number', () => {
  const { scenes } = parseFountainScript(`INT. MERCURY BAR - NIGHT #12#\n\nA quiet night.`);
  assert.equal(scenes.length, 1);
  assert.equal(scenes[0].slug, 'INT. MERCURY BAR - NIGHT');
  assert.deepEqual(scenes[0].events, [{ type: 'chorus', text: 'A quiet night.' }]);
});

test('forced scene heading (leading dot) works without INT/EXT', () => {
  const { scenes } = parseFountainScript(`.STAGE LEFT\n\nA single spotlight.`);
  assert.equal(scenes[0].slug, 'STAGE LEFT');
});

test('action lines join into one chorus event, character cue + dialogue emits enter then line', () => {
  const src = `INT. BAR - NIGHT\n\nBrian and Paul\nnurse pints of beer.\n\nBRIAN\nIngrid Bergman.`;
  const { scenes, castNames } = parseFountainScript(src);
  assert.deepEqual(scenes[0].events, [
    { type: 'chorus', text: 'Brian and Paul nurse pints of beer.' },
    { type: 'enter', keys: ['brian'] },
    { type: 'line', key: 'brian', text: 'Ingrid Bergman.', mask: undefined, voice: undefined },
  ]);
  assert.equal(castNames.brian, 'BRIAN');
  assert.deepEqual(scenes[0].cast, ['brian']);
});

test('a character only enters once per scene even after multiple cues', () => {
  const src = `INT. BAR\n\nBRIAN\nOne.\n\nPAUL\nTwo.\n\nBRIAN\nThree.`;
  const { scenes } = parseFountainScript(src);
  const enters = scenes[0].events.filter(e => e.type === 'enter');
  assert.deepEqual(enters, [{ type: 'enter', keys: ['brian'] }, { type: 'enter', keys: ['paul'] }]);
});

test('(V.O.) and (O.S.) extensions set voice:true, (CONT\'D) does not', () => {
  const src = `INT. BAR\n\nBRIAN (V.O.)\nFrom the radio.\n\nPAUL (O.S.)\nFrom the hallway.\n\nBRIAN (CONT'D)\nBack in the room.`;
  const { scenes } = parseFountainScript(src);
  const lines = scenes[0].events.filter(e => e.type === 'line');
  assert.equal(lines[0].voice, true);
  assert.equal(lines[1].voice, true);
  assert.equal(lines[2].voice, undefined);
  assert.equal(lines[2].key, 'brian'); // CONT'D resolves to the same key, not a new one
});

test('parentheticals become mask hints and split dialogue into separate line events', () => {
  const src = `INT. BAR\n\nBRIAN\n(quietly)\nI don't know.\n(louder)\nOr maybe I do.`;
  const { scenes } = parseFountainScript(src);
  const lines = scenes[0].events.filter(e => e.type === 'line');
  assert.equal(lines.length, 2);
  assert.equal(lines[0].mask, 'quietly');
  assert.equal(lines[0].text, "I don't know.");
  assert.equal(lines[1].mask, 'louder');
  assert.equal(lines[1].text, 'Or maybe I do.');
});

test('forced character cue (@) works for a non-uppercase name', () => {
  const { scenes } = parseFountainScript(`INT. BAR\n\n@McAvoy\nEvening.`);
  const line = scenes[0].events.find(e => e.type === 'line');
  assert.equal(line.key, 'mcavoy');
});

test('a trailing ^ (dual dialogue) is stripped and does not break the cue', () => {
  const { scenes } = parseFountainScript(`INT. BAR\n\nBRIAN^\nAt the same time.`);
  const line = scenes[0].events.find(e => e.type === 'line');
  assert.equal(line.key, 'brian');
  assert.equal(line.text, 'At the same time.');
});

test('transitions are parsed and dropped, not misread as action or a cue', () => {
  const { scenes } = parseFountainScript(`INT. BAR\n\nSomething happens.\n\nCUT TO:\n\nEXT. STREET\n\nSomething else.`);
  assert.equal(scenes.length, 2);
  assert.deepEqual(scenes[0].events, [{ type: 'chorus', text: 'Something happens.' }]);
  assert.deepEqual(scenes[1].events, [{ type: 'chorus', text: 'Something else.' }]);
});

test('centered text becomes a chorus event with the markers stripped', () => {
  const { scenes } = parseFountainScript(`INT. BAR\n\n> THE END <`);
  assert.deepEqual(scenes[0].events, [{ type: 'chorus', text: 'THE END' }]);
});

test('notes and boneyard are stripped entirely, even across blank lines', () => {
  const src = `INT. BAR\n\n[[ author note\n\nspanning lines ]]Actual action.\n\n/* old draft\ntext */BRIAN\nLine.`;
  const { scenes } = parseFountainScript(src);
  assert.deepEqual(scenes[0].events[0], { type: 'chorus', text: 'Actual action.' });
  const line = scenes[0].events.find(e => e.type === 'line');
  assert.equal(line.text, 'Line.');
});

test('emphasis markers are stripped, plain text survives', () => {
  const { scenes } = parseFountainScript(`INT. BAR\n\nThis is *italic*, **bold**, ***both***, and _underlined_.`);
  assert.equal(scenes[0].events[0].text, 'This is italic, bold, both, and underlined.');
});

test('a recognized title page is parsed into meta and excluded from scenes', () => {
  const src = `Title: A Quiet Night\nAuthor: Someone\n\nINT. BAR\n\nAction.`;
  const { meta, scenes } = parseFountainScript(src);
  assert.equal(meta.title, 'A Quiet Night');
  assert.equal(meta.author, 'Someone');
  assert.equal(scenes.length, 1);
  assert.equal(scenes[0].slug, 'INT. BAR');
});

test('an unrecognized leading block is not mistaken for a title page', () => {
  const src = `Just some action before any heading.\n\nINT. BAR\n\nMore action.`;
  const { meta, scenes } = parseFountainScript(src);
  assert.equal(meta, null);
  // the pre-heading content becomes its own untitled scene, not discarded
  assert.equal(scenes[0].slug, '');
  assert.equal(scenes[0].events[0].text, 'Just some action before any heading.');
});

test('compileFountainScript flattens to a Player-ready script and carries meta/castNames along', () => {
  const src = `Title: Two Scenes\n\nINT. BAR\n\nBRIAN\nHello.\n\nEXT. STREET\n\nPAUL\nGoodbye.`;
  const script = compileFountainScript(src);
  assert.equal(script.meta.title, 'Two Scenes');
  assert.deepEqual(script.castNames, { brian: 'BRIAN', paul: 'PAUL' });
  // one intermission between the two scenes, same rule compileScript always uses
  assert.equal(script.timeline.filter(t => t.event.type === 'intermission').length, 1);
});

test('end-to-end: a parsed script plays through Player with a stub renderer, no errors', () => {
  const src = `INT. BAR\n\nEveryone waits.\n\nBRIAN\nHello.\n\nPAUL\nHi.\n\nEXT. STREET\n\nBRIAN\nOutside now.`;
  const script = compileFountainScript(src, { intermissions: false });
  const calls = [];
  const stubRenderer = {
    mount: () => calls.push(['mount']),
    onSceneChange: (scene) => calls.push(['onSceneChange', scene.slug]),
    onChorus: (text) => calls.push(['onChorus', text]),
    onEnter: (keys) => calls.push(['onEnter', keys]),
    onLine: (key, text) => calls.push(['onLine', key, text]),
    onEnd: () => calls.push(['onEnd']),
  };
  const player = new Player(script, stubRenderer);
  player.mount({});
  // Walk every beat manually rather than relying on the internal setTimeout
  // pacing — this is a logic smoke test (does the whole pipeline run without
  // throwing and in the right order), not a timing test.
  for (let i = 0; i < script.timeline.length; i++) player.goTo(i);

  assert.deepEqual(calls[0], ['mount']);
  assert.deepEqual(calls[1], ['onSceneChange', 'INT. BAR']);
  assert.deepEqual(calls[2], ['onChorus', 'Everyone waits.']);
  assert.deepEqual(calls[3], ['onEnter', ['brian']]);
  assert.deepEqual(calls[4], ['onLine', 'brian', 'Hello.']);
  assert.deepEqual(calls[5], ['onEnter', ['paul']]);
  assert.deepEqual(calls[6], ['onLine', 'paul', 'Hi.']);
  assert.deepEqual(calls[7], ['onSceneChange', 'EXT. STREET']);
  // brian enters again in the new scene — compile.js never carries "on
  // stage" state across a scene boundary, matching compileLegacyScene.
  assert.deepEqual(calls[8], ['onEnter', ['brian']]);
  assert.deepEqual(calls[9], ['onLine', 'brian', 'Outside now.']);
  assert.deepEqual(calls[10], ['onEnd']);
});
