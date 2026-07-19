// ─── bard.js: compile ──────────────────────────────────────────────────────
// The amphitheater has exactly four things that happen on its stage:
//
//   chorus  — narration / stage direction, spoken by no one in particular
//   enter   — one or more actors step onto the orchestra
//   exit    — one or more actors leave it
//   line    — an actor, present on stage, speaks
//
// That's the whole vocabulary. No camera (there is no camera — the audience
// has one fixed seat, the amphitheater itself), no blocking coordinates, no
// lighting cues, no sets beyond "which scene are we in." Those are modern
// amenities, deliberately left for a later, separate layer to add on top of
// this one. This file only ever produces those four event shapes, and the
// Player only ever knows how to walk a flat list of them.
//
// A compiled script is: { scenes: [ { slug, cast, timeline: [...events] } ] }
// A flattened timeline (what Player actually walks) tags every event with
// its sceneIndex so the Player can announce scene changes as it crosses a
// boundary, without the events themselves needing to know about scenes.
//
// A fifth event, `intermission`, marks the gap between one performed piece
// and the next within a single sitting — a festival of several plays back
// to back is itself an old idea (the City Dionysia performed tetralogies
// in a day), so this stays part of the root vocabulary rather than getting
// filed under "modern amenity." It carries no payload; what an intermission
// actually looks like (a bumper card, silence, nothing at all) is entirely
// the renderer's or the consuming site's call.

/**
 * @typedef {{ type: 'chorus', text: string }} ChorusEvent
 * @typedef {{ type: 'enter', keys: string[] }} EnterEvent
 * @typedef {{ type: 'exit',  keys: string[] }} ExitEvent
 * @typedef {{ type: 'line', key: string, text: string, mask?: string,
 *             voice?: boolean, silent?: boolean }} LineEvent
 * @typedef {ChorusEvent|EnterEvent|ExitEvent|LineEvent} StageEvent
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

/** Convenience: run compileLegacyScene across a whole SCENES array, then compileScript. */
export function compileLegacyScript(legacyScenes) {
  return compileScript(legacyScenes.map(compileLegacyScene));
}
