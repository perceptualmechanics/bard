// ─── bard.js demo: venues ───────────────────────────────────────────────────
// Purely decorative staging, deliberately kept out of bard.js itself. The
// package's own README already draws this line: "everything about how a
// specific production looks... is staging, not the amphitheater itself, and
// deliberately lives in the consuming site instead of here." These are
// ASCII backdrops framing the black-box stage — one per era of physical
// theater architecture — selectable, off by default. Choosing one changes
// nothing about how the engine runs a scene; it's paint over the stage,
// not plumbing under it.

export const VENUES = [
  {
    key: 'none',
    label: '— bare stage (default) —',
    accent: 'rgba(255,255,255,0.35)',
    top: '',
    bottom: '',
  },
  {
    key: 'amphitheater',
    label: 'Athenian Amphitheater',
    accent: 'rgba(214,184,120,0.6)',
    top:
` .-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-.
(        THEATRON  --  THE ATHENIAN HILLS                           )
 '-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-'`,
    bottom:
` .-~~~~~~~~~~~~~~~~~~~~~~~  ORCHESTRA  ~~~~~~~~~~~~~~~~~~~~~~~-.
 '-_______________________________________________________-'`,
  },
  {
    key: 'globe',
    label: 'The Globe (London, 1599)',
    accent: 'rgba(180,140,90,0.6)',
    top:
` .===================================================================.
|      THE GLOBE  --  LONDON, 1599  (open to the sky)                 |
 '==================================================================='`,
    bottom:
`      _________________________ THRUST STAGE _________________________
     /_______________________________________________________________/
        ^    ^    ^    ^    ^   (groundlings crowd the pit)   ^    ^`,
  },
  {
    key: 'french',
    label: 'French Theater (Palais-Royal)',
    accent: 'rgba(196,64,74,0.6)',
    top:
` ,======================================================================.
||      THEATRE DU PALAIS-ROYAL, PARIS                                  ||
 '======================================================================'`,
    bottom:
`    )  )  )   PROSCENIUM  --  CURTAIN DRAWN BACK   (  (  (
   ______________________________________________________________________`,
  },
  {
    key: 'cinema',
    label: 'The Movie Theater',
    accent: 'rgba(120,170,220,0.6)',
    top:
` *********************************************************************
 *      NOW SHOWING  --  THE BARD.JS CINEMA                           *
 *********************************************************************`,
    bottom:
`       ._________________________ SCREEN _________________________.
        "-.,_,.-"-.,_,.-"-.,_,.-"-.,_,.-"-.,_,.-"-.,_,.-"-.,_,.-"
     []  []  []  []  []  []  []   (rows fade into the dark)   []  []  []`,
  },
];
