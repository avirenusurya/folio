/* Tour steps. Each step either:
   - has `welcome: true` (full-screen centered card, no arrow)
   - or has `page` + `card` position + `arrow` position pointing at a feature.
   Positions are CSS values (% / px / vh-vw) so they scale.
*/

export const STEPS = [
  {
    id: "welcome",
    welcome: true,
    title: "Folio.",
    text: "a quiet ledger for serious study —\nlet me show you around. about a minute.",
    button: "show me",
  },
  {
    id: "timer",
    page: "timer",
    card: { top: 79, left: 1124, width: 320 },
    arrow: { top: 412, left: 1102, rotate: -137, length: 178 },
    title: "the timer.",
    text: "press start (or hit space) to begin a focused session. tap a subject dot — or press 1–9 — to switch.",
  },
  {
    id: "tasks",
    page: "timer",
    card: { top: 79, left: 1124, width: 320 },
    arrow: { top: 146, left: 330, rotate: 40, length: 162 },
    title: "today's list.",
    text: "a small checklist beside the timer. jot what you mean to do today — tick items off as you go, and tomorrow brings a fresh list.",
  },
  {
    id: "calendar",
    page: "calendar",
    card: { top: 72, left: 1124, width: 320 },
    arrow: { top: 576, left: 927, rotate: -142, length: 250 },
    title: "the heatmap.",
    text: "every day fills a square. darker means more hours. click a cell to see exactly what you studied.",
  },
  {
    id: "journal",
    page: "journal",
    card: { top: 431, left: 92, width: 340 },
    arrow: { top: 429, left: 684, rotate: -134, length: 150 },
    title: "the journal.",
    text: "write what mattered today — folio autosaves. and every sunday, a personal weekly note appears on the right, written for you.",
  },
  {
    id: "society",
    page: "society",
    card: { top: 72, left: 1124, width: 320 },
    arrow: { top: 288, left: 1334, rotate: 180, length: 258 },
    title: "the society.",
    text: "join a group with friends. see who's putting in the hours.",
  },
  {
    id: "settings",
    page: "settings",
    card: { top: 79, left: 1124, width: 320 },
    arrow: { top: 146, left: 330, rotate: 40, length: 162 },
    title: "make it yours.",
    text: "add subjects, set daily goals, swap themes, toggle privacy — everything's in here, and it remembers across devices.",
  },
  {
    id: "ready",
    welcome: true,
    final: true,
    title: "ready?",
    text: "what you saw was a sample of what folio looks like after a few weeks.\nyour real folio starts fresh.\n\nhave a quiet, focused day.",
    button: "begin",
  },
];
