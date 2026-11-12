import { compileScript } from './compile.js';


const BONEYARD_RE = /\/\*[\s\S]*?\*\//g;
const NOTE_RE = /\[\[[\s\S]*?\]\]/g;

const EMPHASIS_RES = [
  /\*\*\*([^*]+)\*\*\*/g,
  /\*\*([^*]+)\*\*/g,
  /\*([^*]+)\*/g,
  /_([^_]+)_/g,
];

function cleanText(raw) {
  let text = raw;
  for (const re of EMPHASIS_RES) text = text.replace(re, '$1');
  return text.trim();
}

const SCENE_HEADING_RE = /^(int|ext|est|i\.?\/e)[.\s/]/i;
const FORCED_SCENE_RE = /^\.(?!\.)/; // one leading dot forces a heading; ".." doesn't
const SCENE_NUMBER_RE = /\s*#[^#\n]+#\s*$/; // trailing "#12#" scene numbering

const TRANSITION_RE = /^[A-Z0-9 .'-]*[A-Z]\s*TO:\s*$/; // "CUT TO:", "SMASH CUT TO:"
const FORCED_TRANSITION_RE = /^>\s*[^<]*$/; // leading `>` with no matching `<` (that's centered text)
const CENTERED_RE = /^>\s*(.+?)\s*<\s*$/;
const PAGE_BREAK_RE = /^=\s*=\s*=+\s*$/;

const PARENTHETICAL_RE = /^\(([^)]*)\)\s*$/;

const TITLE_PAGE_KEYS = new Set([
  'title', 'credit', 'author', 'authors', 'source',
  'notes', 'draft date', 'contact', 'copyright',
]);

function isSceneHeading(line) {
  return SCENE_HEADING_RE.test(line) || FORCED_SCENE_RE.test(line);
}

function headingText(line) {
  const stripped = FORCED_SCENE_RE.test(line) ? line.slice(1) : line;
  return stripped.replace(SCENE_NUMBER_RE, '').trim();
}

/**
 * A character cue is a line that's either forced with a leading `@`, or is
 * entirely uppercase (letters that appear must be uppercase — digits,
 * spaces, and a small set of punctuation don't count against it) with at
 * least one real letter in it, so a bare number or "---" can't qualify.
 * Extension (a trailing "(V.O.)", "(CONT'D)", etc.) and a trailing `^`
 * (dual dialogue, see file header) are parsed off before that check.
 */
function parseCueLine(rawLine) {
  let line = rawLine.trim();
  let forced = false;
  if (line.startsWith('@')) { forced = true; line = line.slice(1).trim(); }

  let dual = false;
  if (line.endsWith('^')) { dual = true; line = line.slice(0, -1).trim(); }

  let extension = null;
  const extMatch = line.match(/^(.*?)\s*\(([^)]*)\)\s*$/);
  if (extMatch) { line = extMatch[1].trim(); extension = extMatch[2].trim(); }

  const isAllCapsName = /[A-Z]/.test(line) && !/[a-z]/.test(line) &&
    /^[A-Z0-9 .'&#-]+$/.test(line);

  return { name: line, extension, forced, dual, valid: forced ? line.length > 0 : isAllCapsName };
}

function slugifyKey(name) {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '') || 'unnamed';
}

function isVoiceExtension(extension) {
  return !!extension && /\b(v\.?\s*o\.?|o\.?\s*s\.?)\b/i.test(extension);
}

function extractTitlePage(lines) {
  const meta = {};
  let i = 0;
  while (i < lines.length && lines[i].trim() !== '') {
    const m = lines[i].match(/^([A-Za-z '-]+):\s*(.*)$/);
    if (!m || !TITLE_PAGE_KEYS.has(m[1].trim().toLowerCase())) return { meta: null, rest: lines };
    meta[m[1].trim().toLowerCase()] = m[2].trim();
    i++;
  }
  if (i === 0) return { meta: null, rest: lines };
  while (i < lines.length && lines[i].trim() === '') i++; // consume the blank separator(s)
  return { meta, rest: lines.slice(i) };
}

function splitBlocks(lines) {
  const blocks = [];
  let cur = [];
  for (const line of lines) {
    if (line.trim() === '') {
      if (cur.length) { blocks.push(cur); cur = []; }
    } else {
      cur.push(line);
    }
  }
  if (cur.length) blocks.push(cur);
  return blocks;
}

/**
 * Parse a Fountain-subset script into bard.js's native scene shape.
 * @param {string} source
 * @returns {{ meta: object|null, scenes: {slug:string,cast:string[],events:object[]}[],
 *             castNames: Record<string,string> }}
 */
export function parseFountainScript(source) {
  const stripped = source.replace(BONEYARD_RE, '').replace(NOTE_RE, '');
  const allLines = stripped.replace(/\r\n?/g, '\n').split('\n');

  const { meta, rest } = extractTitlePage(allLines);
  const blocks = splitBlocks(rest);

  const scenes = [];
  const castNames = {};
  let scene = null;
  let onStage = null;

  function ensureScene() {
    if (!scene) {
      scene = { slug: '', cast: new Set(), events: [] };
      onStage = scene.cast;
      scenes.push(scene);
    }
  }

  function speak(key, name, text, mask, voice) {
    ensureScene();
    if (!onStage.has(key)) {
      onStage.add(key);
      scene.events.push({ type: 'enter', keys: [key] });
    }
    if (!(key in castNames)) castNames[key] = name;
    scene.events.push({ type: 'line', key, text, mask: mask || undefined, voice: !!voice || undefined });
  }

  for (const block of blocks) {
    const first = block[0].trim();

    if (isSceneHeading(first)) {
      scene = { slug: headingText(first), cast: new Set(), events: [] };
      onStage = scene.cast;
      scenes.push(scene);
      continue;
    }

    if (PAGE_BREAK_RE.test(first)) continue; // no pages here, nothing to do

    if (block.length === 1 && (TRANSITION_RE.test(first) || FORCED_TRANSITION_RE.test(first)) &&
        !CENTERED_RE.test(first)) {
      continue; // no camera to cut on — see file header
    }

    const centered = first.match(CENTERED_RE);
    if (block.length === 1 && centered) {
      ensureScene();
      scene.events.push({ type: 'chorus', text: cleanText(centered[1]) });
      continue;
    }

    const cue = block.length > 1 ? parseCueLine(first) : null;
    if (cue && cue.valid) {
      const key = slugifyKey(cue.name);
      const voice = isVoiceExtension(cue.extension);
      let mask = null;
      let buf = [];
      const flush = () => {
        if (buf.length) {
          speak(key, cue.name, cleanText(buf.join(' ')), mask, voice);
          buf = [];
        }
      };
      for (const rawLine of block.slice(1)) {
        const paren = rawLine.trim().match(PARENTHETICAL_RE);
        if (paren) {
          flush();
          mask = slugifyKey(paren[1]);
        } else {
          buf.push(rawLine.trim());
        }
      }
      flush();
      continue;
    }

    ensureScene();
    scene.events.push({ type: 'chorus', text: cleanText(block.map(l => l.trim()).join(' ')) });
  }

  return {
    meta,
    scenes: scenes.map(s => ({ slug: s.slug, cast: [...s.cast], events: s.events })),
    castNames,
  };
}

/**
 * Convenience wrapper mirroring compileLegacyScript: parse then flatten via
 * compileScript in one call. `meta`/`castNames` ride along on the returned
 * object (Player only ever reads `.scenes`/`.timeline`, so this is additive,
 * not a shape change) — a consumer authoring in Fountain gets the script's
 * title-page metadata and a key->as-written-name map for free, instead of
 * having to reverse-engineer how a character's name became its slug.
 */
export function compileFountainScript(source, opts = {}) {
  const { meta, scenes, castNames } = parseFountainScript(source);
  return { ...compileScript(scenes, opts), meta, castNames };
}
