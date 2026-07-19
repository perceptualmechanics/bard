// ─── bard.js demo wiring ────────────────────────────────────────────────────
// Minimal consumer of the engine: compile the eight dummy scenes, mount the
// reference DOM renderer, and hook up simple playback controls. This is the
// smallest possible "real" use of bard.js outside perceptualmechanics itself.
//
// Scene selection is deliberately just this: read whichever options are
// selected in the dropdown and hand that subset back to compileScript. No
// new engine API needed — compileScript already accepts any array of
// scenes, and correctly drops the between-scene intermission entirely if
// only one scene is left selected (its default is `scenes.length > 1`).
//
// Order is reshuffled every time the reel starts or restarts, same as
// theater.js does with its own three plays — bard.js exports that same
// shuffle utility now, so this doesn't need its own copy.

import { Player, compileScript, shuffle } from 'bardjs';
import { DomRenderer } from 'bardjs/renderers/dom';
import { CAST, SCENES } from './scenes.js';
import { VENUES } from './venues.js';

const stageFrame = document.getElementById('stage-frame');
const progressEl = document.getElementById('progress');
const playBtn = document.querySelector('[data-act="play"]');
const sceneSelectEl = document.getElementById('scene-select');
const pickerNoteEl = document.getElementById('picker-note');
const venueSelectEl = document.getElementById('venue-select');
const venueTopEl = document.getElementById('venue-top');
const venueBottomEl = document.getElementById('venue-bottom');

const renderer = new DomRenderer({ cast: CAST });

function buildVenuePicker() {
  venueSelectEl.innerHTML = '';
  VENUES.forEach(venue => {
    const option = document.createElement('option');
    option.value = venue.key;
    option.textContent = venue.label;
    venueSelectEl.appendChild(option);
  });
  venueSelectEl.value = 'none'; // bare black box by default
}

function applyVenue(key) {
  const venue = VENUES.find(v => v.key === key) || VENUES[0];
  venueTopEl.textContent = venue.top;
  venueBottomEl.textContent = venue.bottom;
  venueTopEl.style.color = venue.accent;
  venueBottomEl.style.color = venue.accent;
}

function buildPicker() {
  sceneSelectEl.innerHTML = '';
  SCENES.forEach((scene, i) => {
    const option = document.createElement('option');
    option.value = String(i);
    option.textContent = scene.title || scene.slug;
    option.selected = true; // everything starts selected
    sceneSelectEl.appendChild(option);
  });
}

function currentSelection() {
  return [...sceneSelectEl.selectedOptions].map(o => SCENES[Number(o.value)]);
}

function updateProgress() {
  progressEl.textContent = player.index < 0 ? 'start' : `${player.index + 1} / ${player.length}`;
}

function setPlayLabel() {
  playBtn.textContent = player.playing ? '❙❙ pause' : '▷ play';
}

const player = new Player(compileScript(shuffle(SCENES)), renderer, {
  onAdvance: () => { updateProgress(); setPlayLabel(); },
  onEnd: () => { setPlayLabel(); progressEl.textContent = 'end of the reel'; },
});

player.mount(stageFrame);
buildPicker();
buildVenuePicker();
applyVenue('none');

venueSelectEl.addEventListener('change', () => applyVenue(venueSelectEl.value));

document.querySelector('.controls').addEventListener('click', (e) => {
  const btn = e.target.closest('button');
  if (!btn) return;
  const act = btn.dataset.act;
  if (act === 'prev') player.prev();
  else if (act === 'next') player.next();
  else if (act === 'play') { player.toggle(); setPlayLabel(); }
  else if (act === 'restart') {
    const chosen = currentSelection();
    player.restart(compileScript(shuffle(chosen.length ? chosen : SCENES)));
    setPlayLabel();
    updateProgress();
  }
});

document.querySelector('.picker-actions').addEventListener('click', (e) => {
  const btn = e.target.closest('button');
  if (!btn) return;
  const act = btn.dataset.pickerAct;

  if (act === 'all') {
    [...sceneSelectEl.options].forEach(o => { o.selected = true; });
    pickerNoteEl.textContent = '';
  } else if (act === 'none') {
    [...sceneSelectEl.options].forEach(o => { o.selected = false; });
    pickerNoteEl.textContent = '';
  } else if (act === 'apply') {
    const chosen = currentSelection();
    if (chosen.length === 0) {
      pickerNoteEl.textContent = 'choose at least one play first.';
      return;
    }
    pickerNoteEl.textContent = '';
    player.restart(compileScript(shuffle(chosen)));
    setPlayLabel();
    updateProgress();
  }
});

player.play();
setPlayLabel();
updateProgress();
