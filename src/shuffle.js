// ─── bard.js: shuffle ───────────────────────────────────────────────────────
// Fisher–Yates, pulled out as its own tiny utility. "What order do these
// scenes play in" is generic enough that any consumer running more than one
// scene in a sitting will want it — theater.js reshuffles its reel of three
// plays on every restart; this is that same idea, available to anyone else
// building on bard.js instead of reimplemented per-consumer.
export function shuffle(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
