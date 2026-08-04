import { compileScript } from './compile.js';

// ─── bard.js: fountain ──────────────────────────────────────────────────────
// A text-authoring layer on the same four-event vocabulary compile.js already
// produces — item 2 on the README's own roadmap. Fountain (fountain.io) is
// the format this deliberately maps onto rather than inventing new syntax:
// plain text, writable in any editor, already the de facto standard for
// screenplay-shaped text. compileLegacyScript exists to migrate scenes that
// were already objects; this exists to let someone author a scene as prose
// from the start and never touch a JS object at all.
//
// This is a *subset* of full Fountain, scoped to what the amphitheater's
// four events can actually represent — chorus / enter / exit / line, no
// camera. Explicitly NOT supported, on purpose, matching the same "modern
// amenities, later" philosophy as the rest of bard.js:
//
//   - Transitions (CUT TO:, forced `>`) — no camera to act on them, so
//     they're parsed (to avoid misreading one as action or a cue) and
//     silently dropped rather than emitted as any event.
//   - Dual dialogue (a trailing `^` on a cue, meaning simultaneous speech
//     with the previous character) — bard.js's timeline is a flat, single
//     sequence of events; there is no "at the same time" to put two lines
//     into. The `^` is parsed and stripped; the cue is treated as ordinary
//     sequential dialogue.
//   - Rich text emphasis (*italic*, **bold**, ***bold italic***, _underline_)
//     — DomRenderer (or any renderer built only on the root vocabulary) has
//     no rich-text path; markers are stripped and the plain text survives.
//     A renderer that wants emphasis can re-parse it out of the raw text
//     itself; that's a renderer concern, not a compile-time one.
//   - Mid-scene exits — Fountain has no structured "character leaves" event,
//     only prose an author might happen to describe it in, and detecting
//     that from free text is a real NLP problem, not a text-format one.
//     Entrances ARE derived (a character's first line in a scene emits an
//     `enter` right before it) since that much is unambiguous from cue
//     order alone; exits are left to happen for free at the next scene
//     boundary, exactly like compileLegacyScene's own scenes do today
//     (DomRenderer.onSceneChange already clears the whole stage between
//     scenes; nothing here needs to emit a synthetic "exit everyone").
//
// Parentheticals (a line like "(quietly)" between a character cue and their
// dialogue, or between two dialogue lines) map onto the existing `mask`
// field a line event already has — no new vocabulary needed. A consumer
// whose cast config happens to define a mask by that name gets it for
// free; one that doesn't just falls back to the idle mask, the same
// graceful degradation DomRenderer already does for any unrecognized mask.

// ─── stripping: notes and boneyard ──────────────────────────────────────────
// Both can legitimately span multiple lines, including blank ones, so this
// has to happen on the raw source before splitting into blank-line-separated
// blocks — otherwise a note containing a blank line would look like two
// separate blocks instead of one stripped-away comment.
const BONEYARD_RE = /\/\*[\s\S]*?\*\//g;
const NOTE_RE = /\[\[[\s\S]*?\]\]/g;

// ─── emphasis: stripped, not rendered (see file header) ────────────────────
// Order matters: *** before ** before * so a bold-italic run doesn't get
// half-eaten by the plain-bold pattern first. Underline (_..._) is separate
// since it uses a different delimiter.
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

// ─── line classifiers ───────────────────────────────────────────────────────
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

// ─── title page ─────────────────────────────────────────────────────────────
// Optional "Key: Value" block at the very top of the document, ending at the
// first blank line. Only consumed if every non-empty line up there matches a
// recognized key — anything else and this is just a script that starts cold
// on a scene heading or action, which is equally valid Fountain.
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

// ─── block splitting ────────────────────────────────────────────────────────
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

    // Anything left standing is action — narration or stage direction
    // spoken by no one in particular, which is exactly what `chorus` is for.
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
