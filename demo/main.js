// ─── bard.js demo wiring ────────────────────────────────────────────────────
// Minimal consumer of the engine: compile the eight dummy scenes, mount the
// reference DOM renderer, and hook up simple playback controls. This is the
// smallest possible "real" use of bard.js outside perceptualmechanics itself.
//
// Scene selection is deliberately just this: filter SCENES down to the
// checked titles and hand the subset back to compileScript. No new engine
// API needed — compileScript already accepts any array of scenes, and
// correctly drops the between-scene intermission entirely if only one
// scene is left selected (its default is `scenes.length > 1`).

import { Player, compileScript } from 'bardjs';
import { DomRenderer } from 'bardjs/renderers/dom';
import { CAST, SCENES } from './scenes.js';

const stageFrame = document.getElementById('stage-frame');
const progressEl = document.getElementById('progress');
const playBtn = document.querySelector('[data-act="play"]');
const sceneListEl = document.getElementById('scene-list');
const pickerNoteEl = document.getElementById('picker-note');

const renderer = new DomRenderer({ cast: CAST });

// Every scene starts selected.
const selected = new Set(SCENES.map((_, i) => i));

function currentSelection() {
  return SCENES.filter((_, i) => selected.has(i));
}

function buildPicker() {
  sceneListEl.innerHTML = '';
  SCENES.forEach((scene, i) => {
    const li = document.createElement('li');
    const label = document.createElement('label');
    const input = document.createElement('input');
    input.type = 'checkbox';
    input.checked = selected.has(i);
    input.dataset.sceneIndex = String(i);
    input.addEventListener('change', () => {
      if (input.checked) selected.add(i);
      else selected.delete(i);
    });
    label.appendChild(input);
    label.append(scene.title || scene.slug);
    li.appendChild(label);
    sceneListEl.appendChild(li);
  });
}

function updateProgress() {
  progressEl.textContent = player.index < 0 ? 'start' : `${player.index + 1} / ${player.length}`;
}

function setPlayLabel() {
  playBtn.textContent = player.playing ? '❙❙ pause' : '▷ play';
}

const player = new Player(compileScript(SCENES), renderer, {
  onAdvance: () => { updateProgress(); setPlayLabel(); },
  onEnd: () => { setPlayLabel(); progressEl.textContent = 'end of the reel'; },
});

player.mount(stageFrame);
buildPicker();

document.querySelector('.controls').addEventListener('click', (e) => {
  const btn = e.target.closest('button');
  if (!btn) return;
  const act = btn.dataset.act;
  if (act === 'prev') player.prev();
  else if (act === 'next') player.next();
  else if (act === 'play') { player.toggle(); setPlayLabel(); }
  else if (act === 'restart') { player.restart(compileScript(currentSelection())); setPlayLabel(); updateProgress(); }
});

document.querySelector('.picker-actions').addEventListener('click', (e) => {
  const btn = e.target.closest('button');
  if (!btn) return;
  const act = btn.dataset.pickerAct;

  if (act === 'all') {
    SCENES.forEach((_, i) => selected.add(i));
    buildPicker();
    pickerNoteEl.textContent = '';
  } else if (act === 'none') {
    selected.clear();
    buildPicker();
    pickerNoteEl.textContent = '';
  } else if (act === 'apply') {
    const chosen = currentSelection();
    if (chosen.length === 0) {
      pickerNoteEl.textContent = 'choose at least one play first.';
      return;
    }
    pickerNoteEl.textContent = '';
    player.restart(compileScript(chosen));
    setPlayLabel();
    updateProgress();
  }
});

player.play();
setPlayLabel();
updateProgress();
