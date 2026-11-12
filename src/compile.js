
/**
 * @typedef {{ type: 'chorus', text: string }} ChorusEvent
 * @typedef {{ type: 'enter', keys: string[] }} EnterEvent
 * @typedef {{ type: 'exit',  keys: string[] }} ExitEvent
 * @typedef {{ type: 'line', key: string, text: string, mask?: string,
 *             voice?: boolean, silent?: boolean }} LineEvent
 * @typedef {{ type: 'mask', key: string, mask: string }} MaskEvent
 * @typedef {{ type: 'unmask', key: string }} UnmaskEvent
 * @typedef {ChorusEvent|EnterEvent|ExitEvent|LineEvent|MaskEvent|UnmaskEvent} StageEvent
 */

/**
 * Compile amphitheater-native scenes (already expressed as chorus/enter/
 * exit/line) into a flat, scene-tagged timeline the Player can walk.
 * @param {{ slug: string, cast?: string[], events: StageEvent[] }[]} scenes
 * @param {{ intermissions?: boolean }} [opts] intermissions defaults to true
 *   whenever there's more than one scene — set false for a single
 *   continuous piece with no gaps.
 */
export function compileScript(scenes, opts = {}) {
  const intermissions = opts.intermissions ?? scenes.length > 1;
  const timeline = [];
  scenes.forEach((scene, sceneIndex) => {
    if (intermissions && sceneIndex > 0) {
      timeline.push({ sceneIndex, event: { type: 'intermission' } });
    }
    scene.events.forEach(event => {
      timeline.push({ sceneIndex, event });
    });
  });
  return { scenes, timeline };
}

/**
 * Convert one of perceptualmechanics' existing theater.js scenes — written
 * long before bard.js existed, in the shape { slug, order, beats } where
 * beats are `{ a }` (action) or `{ c, t, g, voice, showOnly, silent }`
 * (dialogue) — into the normalized chorus/enter/exit/line vocabulary.
 *
 * This exists so the real, already-written plays (Truth and Beauty, Paul
 * Revere, You've Got a Friend in Satan) don't need a single line
 * hand-transcribed to move onto the new engine. It's a migration shim, not
 * part of the amphitheater's own vocabulary — a consumer starting fresh
 * would just write { slug, cast, events } directly.
 *
 * `order` at scene start becomes one enter event for the whole cast — this
 * matches the old renderer's setupScene(), which built every actor in
 * `order` up front. Each beat's `showOnly` (a *snapshot* of who should be
 * visible) gets diffed against who's currently on stage to produce real
 * exit/enter events — the old code re-derived visibility from scratch on
 * every beat; this derives it once, at compile time, as actual stage
 * events instead of a repeated snapshot comparison.
 */
export function compileLegacyScene(scene) {
  const events = [];
  let onStage = new Set(scene.order);
  events.push({ type: 'enter', keys: [...scene.order] });

  for (const beat of scene.beats) {
    if (beat.showOnly) {
      const next = new Set(beat.showOnly);
      const leaving = [...onStage].filter(k => !next.has(k));
      const arriving = beat.showOnly.filter(k => !onStage.has(k));
      if (leaving.length)  events.push({ type: 'exit',  keys: leaving });
      if (arriving.length) events.push({ type: 'enter', keys: arriving });
      onStage = next;
    }

    if (beat.a) {
      events.push({ type: 'chorus', text: beat.a });
    }

    if (beat.c) {
      events.push({
        type: 'line',
        key: beat.c,
        text: beat.t,
        mask: beat.g,
        voice: !!beat.voice,
        silent: !!beat.silent,
      });
    }
  }

  return { slug: scene.slug, cast: scene.order, events };
}


export function compileLegacyScript(legacyScenes) {
  return compileScript(legacyScenes.map(compileLegacyScene));
}
