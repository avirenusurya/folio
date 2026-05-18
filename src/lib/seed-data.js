/* Seed/demo data — used by the onboarding tour to show what a populated Folio looks like.
   NOT written to the database. Lives only in client memory during the demo. */

import { toISODate, todayISO, addDays, startOfWeek } from '../state.jsx';

const uid = () => Math.random().toString(36).slice(2, 10);

// Deterministic PRNG so the demo state is identical across reloads.
function mulberry32(a) {
  return function() {
    a |= 0; a = a + 0x6D2B79F5 | 0;
    let t = a;
    t = Math.imul(t ^ t >>> 15, t | 1);
    t ^= t + Math.imul(t ^ t >>> 7, t | 61);
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  }
}

const DEMO_SUBJECTS = [
  { id: "s_chem", name: "organic chemistry", color: "#B85C3C", sort_order: 0 },
  { id: "s_calc", name: "calculus",          color: "#C19A3F", sort_order: 1 },
  { id: "s_bio",  name: "molecular biology", color: "#B07A6E", sort_order: 2 },
  { id: "s_lit",  name: "literature",        color: "#8B9A82", sort_order: 3 },
  { id: "s_kor",  name: "korean",            color: "#E89E6D", sort_order: 4 },
  { id: "s_phil", name: "philosophy",        color: "#8B6F8E", sort_order: 5 },
];

const DEMO_DDAYS = [
  { id: "d_finals", label: "finals", icon: "cap",  target: "2026-06-07" },
  { id: "d_sat",    label: "sat",    icon: "book", target: "2026-08-12" },
  { id: "d_essay",  label: "essay",  icon: "doc",  target: "2026-05-19" },
];

function seedSessions(subjects, days = 180, endDate = new Date()) {
  const rng = mulberry32(20260515);
  const sessions = [];
  const activeIds = subjects.map(s => s.id);
  for (let i = days; i >= 1; i--) {
    const day = addDays(endDate, -i);
    const dow = day.getDay();
    const weekend = dow === 0 || dow === 6;
    const ramp = 0.5 + ((days - 1 - i) / days) * 0.35;
    const probStudy = weekend ? ramp * 0.7 : ramp * 0.95;
    if (rng() > probStudy) continue;
    const peak = weekend ? 4.5 : 6.5;
    const totalH = Math.max(0.4, peak * (0.55 + rng() * 0.7));
    const nSessions = 1 + Math.floor(rng() * 3);
    let remaining = totalH;
    for (let k = 0; k < nSessions; k++) {
      const sid = activeIds[Math.floor(rng() * activeIds.length)];
      const isLast = k === nSessions - 1;
      const portion = isLast ? remaining : Math.min(remaining - 0.2, remaining * (0.3 + rng() * 0.4));
      if (portion <= 0.1) continue;
      remaining -= portion;
      const startHour = 9 + Math.floor(rng() * 10) + (k * 0.7);
      const start = new Date(day); start.setHours(Math.min(22, Math.floor(startHour)), Math.floor(rng() * 60), 0, 0);
      const end = new Date(start.getTime() + portion * 3600 * 1000);
      sessions.push({
        id: uid(),
        subject_id: sid,
        started_at: start.toISOString(),
        ended_at: end.toISOString(),
        duration_seconds: Math.round(portion * 3600),
        mode: "stopwatch",
      });
    }
  }
  return sessions;
}

function seedJournal() {
  const today = new Date();
  const entries = {};
  const samples = [
    "Felt sharper after running. Got through three chapters of the lit assignment and finally understood the framing in chapter two. Calc set was rough — I keep forgetting to factor before u-sub.",
    "Mechanisms lab was humbling. Watched the same lecture twice. The second time it actually sat down. Tomorrow morning: NMR review while it's quiet.",
    "Calc integration drills. The big realization: most ‘hard’ integrals are easy ones in disguise. Spent the last hour reading philosophy for fun.",
    "Quiet day. Three hours total, but they were good hours. Korean vocabulary finally feels like words and not just shapes.",
    "Late start. The first hour was just warming up; the second and third did the actual work. Reminded myself again that consistency beats intensity.",
  ];
  for (let i = 0; i < samples.length; i++) {
    entries[toISODate(addDays(today, -(i + 1)))] = samples[i];
  }
  return entries;
}

function seedTasks() {
  const today = todayISO();
  const now = new Date().toISOString();
  return [
    { id: 't_seed1', task_date: today, subject_id: 's_chem', title: "finish problem set 4",       done: false, done_at: null, created_at: now, updated_at: now },
    { id: 't_seed2', task_date: today, subject_id: 's_calc', title: "review u-substitution notes", done: true,  done_at: now,  created_at: now, updated_at: now },
    { id: 't_seed3', task_date: today, subject_id: 's_lit',  title: "read chapter 3 of the essay", done: false, done_at: null, created_at: now, updated_at: now },
    { id: 't_seed4', task_date: today, subject_id: null,     title: "email professor about lab",   done: false, done_at: null, created_at: now, updated_at: now },
  ];
}

function seedEditorNotes() {
  return {
    [toISODate(startOfWeek(addDays(new Date(), -7)))]:
      "A week of weekday consistency, a familiar fixture on these pages — five days in a row above goal, then a gentle slack as Sunday approached. Organic chemistry continued its quiet dominance of your hours; calculus, the regular guest editor, kept its column short. As finals close to within three weeks, the question is no longer whether you'll show up, but what you'll choose to deepen.",
  };
}

// Fake leaderboard rows used while the onboarding tour is showing the
// society step. Returns rows in the same shape as get_group_leaderboard.
// Multiplier varies by period so "today" < "this week" < "all-time".
const DEMO_MEMBERS = [
  { user_id: 'u_mira', handle: 'mira',    display_name: 'Mira K.',     current_streak: 18, base: 9000  },
  { user_id: 'u_jon',  handle: 'jon_w',   display_name: 'Jon W.',      current_streak: 12, base: 7800  },
  { user_id: 'u_you',  handle: 'you',     display_name: '',            current_streak: 7,  base: 6200, is_you: true },
  { user_id: 'u_sara', handle: 'saraj',   display_name: 'Sara J.',     current_streak: 9,  base: 5400  },
  { user_id: 'u_dev',  handle: 'devan',   display_name: 'Devan P.',    current_streak: 4,  base: 4100  },
  { user_id: 'u_lin',  handle: 'lin',     display_name: 'Lin H.',      current_streak: 2,  base: 2800  },
];

export function makeDemoLeaderboard(period) {
  const mult = period === 'today' ? 0.25 : period === 'this week' ? 1 : 24;
  return DEMO_MEMBERS
    .map(m => ({
      user_id: m.user_id,
      handle: m.handle,
      display_name: m.display_name,
      avatar_url: null,
      current_streak: m.current_streak,
      total_seconds: Math.round(m.base * mult),
      is_you: !!m.is_you,
    }))
    .sort((a, b) => b.total_seconds - a.total_seconds);
}

export function makeDemoState() {
  return {
    profile: {
      handle: "you",
      display_name: "",
      member_since: new Date().toISOString(),
      theme: "sepia",
      show_subjects: false,
      show_longest: true,
      show_best_week: true,
      appear_in_currently_studying: true,
      editor_notes_enabled: true,
      tasks_public: false,
      onboarded_at: null,
    },
    subjects: DEMO_SUBJECTS.map(s => ({ ...s, archived: false, deleted: false, created_at: new Date().toISOString() })),
    d_days: [...DEMO_DDAYS],
    goals: {
      daily_seconds: 3.5 * 3600,
      weekly_seconds: 24.5 * 3600,
      streak_freezes_available: 2,
      weekly_goal_mode: false,
    },
    sessions: seedSessions(DEMO_SUBJECTS),
    journal: seedJournal(),
    editor_notes: seedEditorNotes(),
    tasks: seedTasks(),
    pomodoro: { enabled: false, work_min: 25, short_break_min: 5, long_break_min: 15, cycles_before_long: 4 },
    current: null,
    last_active_subject: "s_chem",
    groups: [
      { id: "g_calhoun", name: "calhoun prep 2026", description: null, invite_code: "DEMO01", created_at: new Date().toISOString(), member_count: 47, my_role: "member", joined_at: new Date().toISOString() },
      { id: "g_sat",     name: "sat study club",    description: null, invite_code: "DEMO02", created_at: new Date().toISOString(), member_count: 19, my_role: "member", joined_at: new Date().toISOString() },
      { id: "g_premed",  name: "pre-med study group", description: null, invite_code: "DEMO03", created_at: new Date().toISOString(), member_count: 12, my_role: "member", joined_at: new Date().toISOString() },
    ],
  };
}
