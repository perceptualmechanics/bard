// ─── bard.js demo wiring ────────────────────────────────────────────────────
// Minimal consumer of the engine: compile the eight dummy scenes, mount the
// reference DOM renderer, and hook up simple playback controls. This is the
// smallest possible "real" use of bard.js outside perceptualmechanics itself.

import { Player, compileScript } from 'bardjs';
import { DomRenderer } from 'bardjs/renderers/dom';
import { CAST, SCENES } from './scenes.js';

const stageFrame = document.getElementById('stage-frame');
const progressEl = document.getElementById('progress');
const playBtn = document.querySelector('[data-act="play"]');

const renderer = new DomRenderer({ cast: CAST });

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

document.querySelector('.controls').addEventListener('click', (e) => {
  const btn = e.target.closest('button');
  if (!btn) return;
  const act = btn.dataset.act;
  if (act === 'prev') player.prev();
  else if (act === 'next') player.next();
  else if (act === 'play') { player.toggle(); setPlayLabel(); }
  else if (act === 'restart') { player.restart(compileScript(SCENES)); setPlayLabel(); updateProgress(); }
});

player.play();
setPlayLabel();
updateProgress();
