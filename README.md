# bard.js

A script-to-performance engine. Write what happens; bard.js performs it.

## The amphitheater, not the studio

The root of this framework is deliberately the oldest form of staged drama
there is: an amphitheater. Four things happen on its stage, and nothing
else does, on purpose:

- **chorus** — narration or stage direction, spoken by no one in particular
- **enter** — one or more actors step onto the orchestra
- **exit** — one or more actors leave it
- **line** — an actor present on stage speaks

That's the whole vocabulary of v0.1. There is no camera (there is no
camera in an amphitheater — the audience has one fixed seat), no blocking
coordinates, no lighting design, no sets beyond "which scene this is."
Those are real, worthwhile things, and they're deliberately left for a
later layer to add on top of this one, once the root actually works.

A fifth event, **intermission**, marks the gap between one performed piece
and the next in a single sitting — a day of back-to-back plays is itself
an old idea, so it stays part of the root rather than getting filed under
"modern amenity." It carries no payload; what an intermission looks like
is entirely up to the renderer.

## Why this exists

Traditional screenwriting has a production problem: the script stops being
the finished work the moment it's done, and becomes raw material for a
director, a cinematographer, a cast, an editor to reinterpret. bard.js is
for the opposite premise — the script *is* the performance, immediately,
with nothing standing between writing it and seeing it happen.

## Architecture

- **`Player`** walks a compiled `{ scenes, timeline }` script one event at
  a time — play, pause, next, prev, goTo, restart. It knows nothing about
  how anything is drawn.
- **A renderer** is any object with (some subset of) `mount`,
  `onSceneChange`, `onChorus`, `onEnter`, `onExit`, `onLine`,
  `onIntermission`, `onEnd`, `dispose`. `Player` calls whichever methods
  exist and skips the rest.
- **`renderers/dom`** ships the reference renderer: ASCII masks, cowsay-
  style speech bubbles, a caption line for the chorus. It's the "bare
  stage" version on purpose — a richer renderer (Three.js figures, a real
  camera) is a second renderer, not a rewrite of this one.
- **`compile.js`** turns scenes into the flat timeline `Player` walks.
  `compileLegacyScene`/`compileLegacyScript` exist purely to migrate
  perceptualmechanics' own pre-bard.js theater.js scenes (already-written
  plays, in their original `{ slug, order, beats }` shape) onto this engine
  without hand-transcribing a single line of dialogue.
- **`fountain.js`** turns a Fountain-subset text document into the same
  scene shape `compile.js` expects — see "Authoring a scene (Fountain)"
  below.

## Authoring a scene (native format)

```js
import { compileScript, Player } from 'bardjs';
import { DomRenderer } from 'bardjs/renderers/dom';

const scene = {
  slug: 'INT. MERCURY BAR. NIGHT.',
  cast: ['brian', 'paul'],
  events: [
    { type: 'chorus', text: 'Brian and Paul nurse pints of beer at the bar.' },
    { type: 'line', key: 'brian', text: 'Ingrid Bergman.' },
    { type: 'line', key: 'paul',  text: 'Rita Hayworth.' },
  ],
};

const script = compileScript([scene]);
const renderer = new DomRenderer({
  cast: {
    brian: { name: 'Brian', color: '#1d4e89' },
    paul:  { name: 'Paul',  color: '#1f7a4d' },
  },
});
const player = new Player(script, renderer);
player.mount(document.querySelector('#stage'));
player.play();
```

## Authoring a scene (Fountain)

`src/fountain.js` compiles a *subset* of [Fountain](https://fountain.io) —
scene headings, action, character cues and dialogue, parentheticals,
transitions, notes, a title page — down to the same four-event vocabulary
`compileScript` already produces. Nothing in `Player` or the renderer
contract changes; this is a second way to arrive at a `{ scenes, timeline }`
script, not a new engine.

```js
import { compileFountainScript, Player } from 'bardjs';
import { DomRenderer } from 'bardjs/renderers/dom';

const source = `
Title: A Quiet Night

INT. MERCURY BAR - NIGHT

Brian and Paul nurse pints of beer.

BRIAN
Ingrid Bergman.

PAUL
Rita Hayworth.
`;

const script = compileFountainScript(source);
const renderer = new DomRenderer({
  cast: {
    brian: { name: 'Brian', color: '#1d4e89' },
    paul:  { name: 'Paul',  color: '#1f7a4d' },
  },
});
const player = new Player(script, renderer);
player.mount(document.querySelector('#stage'));
player.play();
```

A character's key is their cue text lowercased and slugified (`BRIAN` ->
`brian`); `script.castNames` maps every key back to the name as it was
actually written, so a cast config can be built without reverse-engineering
that. `script.meta` carries any parsed title-page fields (`title`,
`author`, etc.).

Deliberately out of scope, the same "modern amenities, later" way the root
vocabulary itself is scoped — see `src/fountain.js`'s own header comment for
the reasoning behind each: transitions (no camera to cut on, parsed and
dropped), dual dialogue (bard.js's timeline has no "at the same time"),
rich text emphasis (stripped to plain text — no renderer here does rich
text), and mid-scene exits (Fountain has no structured "character leaves"
event; only entrances are unambiguous enough to derive).

## Roadmap past v0.1 (not built yet, in rough order)

1. Richer event types once there's a renderer that can use them: real
   blocking positions, camera cuts/moves, sound cues.
2. ~~A text-based authoring layer on top of the same event model~~ — landed:
   see "Authoring a scene (Fountain)" above. The subset covers everything
   a bard.js scene can represent; a fuller Fountain implementation (dual
   dialogue, mid-scene stage directions) would need richer events from (1)
   first, not a bigger parser.
3. A second renderer (Three.js, simple rigged figures, a movable camera)
   as the actual proof that "renderer-agnostic" is real and not just a
   claim with one implementation behind it.
