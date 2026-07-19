// ─── bard.js demo content ───────────────────────────────────────────────────
// Dummy/test material for exercising the engine end to end: eight scenes,
// each a short adaptation of a moment from a different classic play. These
// are original condensed adaptations (paraphrased for the translated/prose
// sources; lightly trimmed direct text for the two English-language public-
// domain originals, Shakespeare and Wilde) — written to be short bard.js
// scenes, not full reproductions of any script.
//
// One shared cast map, since a single DomRenderer instance covers the whole
// script — every character across all eight plays needs a unique key.

export const CAST = {
  // The Oresteia (Aeschylus)
  clytemnestra: { name: 'Clytemnestra', color: '#b83b5e' },
  agamemnon:    { name: 'Agamemnon',    color: '#c9a227' },

  // Medea (Euripides)
  medea: { name: 'Medea', color: '#8e44ad' },
  jason: { name: 'Jason', color: '#3a6b8a' },

  // Lysistrata (Aristophanes)
  lysistrata: { name: 'Lysistrata', color: '#d68910' },
  kalonike:   { name: 'Kalonike',   color: '#16a085' },

  // As You Like It (Shakespeare)
  jaques: { name: 'Jaques', color: '#6b7a8f' },

  // Macbeth (Shakespeare)
  witch1:  { name: 'First Witch',  color: '#4a4a68' },
  witch2:  { name: 'Second Witch', color: '#4a4a68' },
  witch3:  { name: 'Third Witch',  color: '#4a4a68' },
  macbeth: { name: 'Macbeth',      color: '#7a1f2b' },

  // Candide (after Voltaire)
  pangloss: { name: 'Pangloss', color: '#2e7d32' },
  candide:  { name: 'Candide',  color: '#5b8c5a' },

  // The Misanthrope (after Molière)
  alceste:  { name: 'Alceste',  color: '#8b3a3a' },
  philinte: { name: 'Philinte', color: '#3a5a8b' },

  // The Importance of Being Earnest (Wilde)
  jack:     { name: 'Jack Worthing',        color: '#1a5276' },
  algernon: { name: 'Algernon Moncrieff',   color: '#7d6608' },
};

export const SCENES = [
  {
    title: 'The Oresteia',
    slug: 'THE ORESTEIA — Aeschylus. The palace steps at Argos.',
    cast: ['clytemnestra', 'agamemnon'],
    events: [
      { type: 'chorus', text: 'Ten years of war are over. Agamemnon returns from Troy — and his wife has been waiting a long time.' },
      { type: 'enter', keys: ['clytemnestra'] },
      { type: 'line', key: 'clytemnestra', text: 'Welcome home, my king. Let the earth itself be dressed in purple for the man who conquered Troy.' },
      { type: 'enter', keys: ['agamemnon'] },
      { type: 'line', key: 'agamemnon', text: 'Such honors belong to the gods, wife, not to a mortal man. I fear to walk on cloth this fine.' },
      { type: 'line', key: 'clytemnestra', text: 'And yet you will. Walk the path I have laid for you — you have earned this much, at least.' },
      { type: 'chorus', text: 'He crosses the crimson tapestries into the house. The chorus feels, without knowing why, that something terrible has already been decided.' },
      { type: 'exit', keys: ['agamemnon', 'clytemnestra'] },
      { type: 'chorus', text: 'A cry rings out from inside the palace. It will not be the last.' },
    ],
  },
  {
    title: 'Medea',
    slug: 'MEDEA — Euripides. Outside Medea’s house in Corinth.',
    cast: ['medea', 'jason'],
    events: [
      { type: 'chorus', text: 'Jason has set Medea aside to marry a king’s daughter. She gave up her home, her family, and her country for him.' },
      { type: 'enter', keys: ['medea'] },
      { type: 'line', key: 'medea', text: 'Of all things that breathe and think, we women are the most unfortunate — and you would cast me out like a stranger.' },
      { type: 'enter', keys: ['jason'] },
      { type: 'line', key: 'jason', text: 'I have arranged this well for both of us, Medea. You and the children will still want for nothing.' },
      { type: 'line', key: 'medea', text: 'Want for nothing. Yes. Only for a home, a husband, a name. Go, Jason. Go and be married.' },
      { type: 'exit', keys: ['jason'] },
      { type: 'chorus', text: 'Alone, Medea begins to weigh a punishment terrible enough to answer him.' },
      { type: 'line', key: 'medea', text: 'He will learn what it costs to wrong a woman he thought had no power left to use.' },
      { type: 'exit', keys: ['medea'] },
    ],
  },
  {
    title: 'Lysistrata',
    slug: 'LYSISTRATA — Aristophanes. Outside the Acropolis, Athens.',
    cast: ['lysistrata', 'kalonike'],
    events: [
      { type: 'chorus', text: 'The war between Athens and Sparta has dragged on for years. Lysistrata has summoned the women of Greece with a plan to end it.' },
      { type: 'enter', keys: ['lysistrata', 'kalonike'] },
      { type: 'line', key: 'kalonike', text: 'You want us to do what, exactly? You know what we are. You know what we like.' },
      { type: 'line', key: 'lysistrata', text: 'Exactly. If we deny our husbands everything they want from us until they stop this war, they will stop this war.' },
      { type: 'line', key: 'kalonike', text: 'And if I can’t hold out?' },
      { type: 'line', key: 'lysistrata', text: 'Then you will think of Greece, and you will hold out anyway.' },
      { type: 'chorus', text: 'One by one, the women of Athens and Sparta swear the oath. The men have no idea what is coming.' },
      { type: 'exit', keys: ['lysistrata', 'kalonike'] },
    ],
  },
  {
    title: 'As You Like It',
    slug: 'AS YOU LIKE IT — Shakespeare. The Forest of Arden.',
    cast: ['jaques'],
    events: [
      { type: 'chorus', text: 'The melancholy Jaques, alone in the forest, considers the seven ages of a man’s life.' },
      { type: 'enter', keys: ['jaques'] },
      { type: 'line', key: 'jaques', text: 'All the world’s a stage, and all the men and women merely players.' },
      { type: 'line', key: 'jaques', text: 'They have their exits and their entrances, and one man in his time plays many parts.' },
      { type: 'line', key: 'jaques', text: 'Last scene of all, that ends this strange eventful history, is second childishness, and mere oblivion.' },
      { type: 'exit', keys: ['jaques'] },
    ],
  },
  {
    title: 'Macbeth',
    slug: 'MACBETH — Shakespeare. A cavern. In the middle, a boiling cauldron.',
    cast: ['witch1', 'witch2', 'witch3', 'macbeth'],
    events: [
      { type: 'chorus', text: 'Thunder. Three witches circle a cauldron, waiting for the man whose fate they have already decided.' },
      { type: 'enter', keys: ['witch1', 'witch2', 'witch3'] },
      { type: 'line', key: 'witch1', text: 'Round about the cauldron go; in the poison’d entrails throw.' },
      { type: 'line', key: 'witch2', text: 'Double, double toil and trouble; fire burn, and cauldron bubble.' },
      { type: 'line', key: 'witch3', text: 'By the pricking of my thumbs, something wicked this way comes.' },
      { type: 'enter', keys: ['macbeth'] },
      { type: 'line', key: 'macbeth', text: 'How now, you secret, black, and midnight hags! What is’t you do?' },
      { type: 'line', key: 'witch1', text: 'A deed without a name.' },
      { type: 'exit', keys: ['witch1', 'witch2', 'witch3', 'macbeth'] },
    ],
  },
  {
    title: 'Candide',
    slug: 'CANDIDE — after Voltaire. A modest garden, somewhere quiet at last.',
    cast: ['pangloss', 'candide'],
    events: [
      { type: 'chorus', text: 'After wars, earthquakes, shipwrecks, and every catastrophe Voltaire could invent, Candide and his old tutor Pangloss have finally stopped moving.' },
      { type: 'enter', keys: ['pangloss', 'candide'] },
      { type: 'line', key: 'pangloss', text: 'I maintain what I have always maintained: this is still the best of all possible worlds, and every disaster we endured was necessary to it.' },
      { type: 'line', key: 'candide', text: 'That may be so, Pangloss. But I find I no longer care to argue the point.' },
      { type: 'line', key: 'pangloss', text: 'Then what would you have us do instead?' },
      { type: 'line', key: 'candide', text: 'Cultivate our garden. That much, at least, is within our power.' },
      { type: 'exit', keys: ['pangloss', 'candide'] },
    ],
  },
  {
    title: 'The Misanthrope',
    slug: 'THE MISANTHROPE — after Molière. A fashionable Parisian salon.',
    cast: ['alceste', 'philinte'],
    events: [
      { type: 'chorus', text: 'Alceste has just watched his friend flatter a man he privately despises, and he cannot let it go.' },
      { type: 'enter', keys: ['alceste', 'philinte'] },
      { type: 'line', key: 'alceste', text: 'You embraced him, you praised him, you swore you were devoted — and not one word of it was true.' },
      { type: 'line', key: 'philinte', text: 'It is only manners, Alceste. Society requires a little pretending, or it could not function at all.' },
      { type: 'line', key: 'alceste', text: 'Then I want no part of a society that runs on flattery instead of honesty. I would rather be hated for what I am.' },
      { type: 'line', key: 'philinte', text: 'You may get your wish sooner than you think.' },
      { type: 'exit', keys: ['alceste', 'philinte'] },
    ],
  },
  {
    title: 'The Importance of Being Earnest',
    slug: 'THE IMPORTANCE OF BEING EARNEST — Wilde. Algernon’s flat, Half-Moon Street.',
    cast: ['algernon', 'jack'],
    events: [
      { type: 'chorus', text: 'Algernon has just caught his friend Jack out in a small, comfortable deception.' },
      { type: 'enter', keys: ['algernon', 'jack'] },
      { type: 'line', key: 'algernon', text: 'You have invented a very useful younger brother called Ernest, in order that you may be able to come up to town as often as you like.' },
      { type: 'line', key: 'jack', text: 'My dear Algy, I don’t know that I am much interested in your family life.' },
      { type: 'line', key: 'algernon', text: 'No, I know. It is nobody’s business but one’s own.' },
      { type: 'line', key: 'jack', text: 'Nevertheless, I do wish you would ask my forgiveness for having listened so attentively.' },
      { type: 'line', key: 'algernon', text: 'I have always suspected you of being a confirmed and secret Bunburyist.' },
      { type: 'exit', keys: ['algernon', 'jack'] },
    ],
  },
];
