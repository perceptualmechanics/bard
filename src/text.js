
export function wrapText(text, width) {
  const words = text.split(/\s+/);
  const lines = [];
  let cur = '';
  words.forEach(w => {
    const test = cur ? cur + ' ' + w : w;
    if (test.length > width && cur) { lines.push(cur); cur = w; }
    else cur = test;
  });
  if (cur) lines.push(cur);
  return lines;
}

export function asciiBubble(text, voice, width = 40) {
  const lines = wrapText(text, width);
  const maxLen = Math.max(...lines.map(l => l.length), voice ? 9 : 0);
  const top = ' ' + '_'.repeat(maxLen + 2);
  const bottom = ' ' + '-'.repeat(maxLen + 2);
  const rows = [];
  if (voice) rows.push(`| ${'(voice)'.padEnd(maxLen)} |`);
  lines.forEach(l => rows.push(`| ${l.padEnd(maxLen)} |`));
  return [top, ...rows, bottom].join('\n');
}
