import React from 'react';
import { FolioCtx, deriveFolio } from '../state.jsx';
import { makeDemoState, makeDemoLeaderboard } from '../lib/seed-data.js';

/* Mock Folio provider used during the onboarding tour.
   Same useFolio() interface as the real provider, but state lives only
   in memory and mutations don't hit Supabase. When the tour ends, the
   provider is unmounted and all mock state is discarded.

   Mock actions are mostly real (they update local state) so clicking
   "start" actually starts a fake timer the user can see ticking. */

const uid = () => Math.random().toString(36).slice(2, 10);

export function MockFolioProvider({ children }) {
  const [state, setState] = React.useState(makeDemoState);
  const [, setTick] = React.useState(0);
  const stateRef = React.useRef(state);
  stateRef.current = state;

  React.useEffect(() => {
    if (!state.current || state.current.paused) return;
    const i = setInterval(() => setTick(t => t + 1), 1000);
    return () => clearInterval(i);
  }, [state.current?.subject_id, state.current?.paused, state.current?.started_at]);

  const merge = (patch) => setState(prev => typeof patch === 'function' ? patch(prev) : { ...prev, ...patch });

  const actions = {
    startSession: ({ mode = 'stopwatch' } = {}) => {
      const prev = stateRef.current;
      const subject_id = prev.last_active_subject
        || prev.subjects.find(s => !s.archived && !s.deleted)?.id;
      if (!subject_id) return;
      merge({ current: { subject_id, started_at: new Date().toISOString(), accumulated: 0, paused: false, mode } });
    },
    pauseSession: () => merge(prev => {
      if (!prev.current || prev.current.paused) return prev;
      const elapsed = Math.floor((Date.now() - new Date(prev.current.started_at).getTime()) / 1000);
      return { ...prev, current: { ...prev.current, paused: true, accumulated: (prev.current.accumulated || 0) + elapsed } };
    }),
    resumeSession: () => merge(prev => {
      if (!prev.current || !prev.current.paused) return prev;
      return { ...prev, current: { ...prev.current, paused: false, started_at: new Date().toISOString() } };
    }),
    endSession: () => merge(prev => {
      if (!prev.current) return prev;
      const cur = prev.current;
      const totalSec = cur.paused
        ? (cur.accumulated || 0)
        : (cur.accumulated || 0) + Math.floor((Date.now() - new Date(cur.started_at).getTime()) / 1000);
      if (totalSec < 5) return { ...prev, current: null };
      const newSession = {
        id: uid(),
        subject_id: cur.subject_id,
        started_at: new Date(Date.now() - totalSec * 1000).toISOString(),
        ended_at: new Date().toISOString(),
        duration_seconds: totalSec,
        mode: cur.mode || 'stopwatch',
      };
      return { ...prev, current: null, sessions: [newSession, ...prev.sessions] };
    }),
    setActiveSubject: (id) => merge({ last_active_subject: id }),

    // CRUD — local-only mocks
    addSubject: ({ name, color }) => merge(prev => {
      const nextSort = prev.subjects.reduce((m, s) => Math.max(m, s.sort_order ?? 0), -1) + 1;
      return {
        ...prev,
        subjects: [...prev.subjects, { id: 's_' + uid(), name, color, archived: false, deleted: false, sort_order: nextSort, created_at: new Date().toISOString() }],
      };
    }),
    updateSubject: (id, patch) => merge(prev => ({
      ...prev, subjects: prev.subjects.map(s => s.id === id ? { ...s, ...patch } : s),
    })),
    reorderSubjects: (orderedIds) => merge(prev => {
      const idToNewSort = Object.fromEntries(orderedIds.map((id, i) => [id, i]));
      return { ...prev, subjects: prev.subjects.map(s => idToNewSort[s.id] !== undefined ? { ...s, sort_order: idToNewSort[s.id] } : s) };
    }),
    archiveSubject: (id) => actions.updateSubject(id, { archived: true, archived_at: new Date().toISOString() }),
    unarchiveSubject: (id) => actions.updateSubject(id, { archived: false, archived_at: null }),
    deleteSubject: (id) => actions.updateSubject(id, { deleted: true, deleted_at: new Date().toISOString() }),

    addDDay: (d) => merge(prev => ({ ...prev, d_days: [...prev.d_days, { id: 'd_' + uid(), ...d }] })),
    updateDDay: (id, patch) => merge(prev => ({ ...prev, d_days: prev.d_days.map(d => d.id === id ? { ...d, ...patch } : d) })),
    removeDDay: (id) => merge(prev => ({ ...prev, d_days: prev.d_days.filter(d => d.id !== id) })),

    setGoals: (patch) => merge(prev => ({ ...prev, goals: { ...prev.goals, ...patch } })),
    setJournal: (iso, content) => merge(prev => ({ ...prev, journal: { ...prev.journal, [iso]: content } })),

    addTask: ({ task_date, title, subject_id = null }) => merge(prev => ({
      ...prev,
      tasks: [...prev.tasks, {
        id: 't_' + uid(),
        task_date, title, subject_id,
        done: false, done_at: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }],
    })),
    toggleTask: (id) => merge(prev => ({
      ...prev,
      tasks: prev.tasks.map(t => t.id === id ? { ...t, done: !t.done, done_at: !t.done ? new Date().toISOString() : null } : t),
    })),
    updateTask: (id, patch) => merge(prev => ({
      ...prev, tasks: prev.tasks.map(t => t.id === id ? { ...t, ...patch } : t),
    })),
    deleteTask: (id) => merge(prev => ({
      ...prev, tasks: prev.tasks.filter(t => t.id !== id),
    })),

    addHabit: ({ name, color, target_per_week = null }) => merge(prev => {
      const nextSort = (prev.habits || []).reduce((m, h) => Math.max(m, h.sort_order ?? 0), -1) + 1;
      return {
        ...prev,
        habits: [...(prev.habits || []), { id: 'h_' + uid(), name, color, sort_order: nextSort, target_per_week, archived_at: null, created_at: new Date().toISOString() }],
      };
    }),
    updateHabit: (id, patch) => merge(prev => ({ ...prev, habits: (prev.habits || []).map(h => h.id === id ? { ...h, ...patch } : h) })),
    archiveHabit: (id) => actions.updateHabit(id, { archived_at: new Date().toISOString() }),
    unarchiveHabit: (id) => actions.updateHabit(id, { archived_at: null }),
    deleteHabit: (id) => merge(prev => ({
      ...prev,
      habits: (prev.habits || []).filter(h => h.id !== id),
      habit_entries: (prev.habit_entries || []).filter(e => e.habit_id !== id),
    })),
    reorderHabits: (orderedIds) => merge(prev => {
      const idToNewSort = Object.fromEntries(orderedIds.map((id, i) => [id, i]));
      return { ...prev, habits: (prev.habits || []).map(h => idToNewSort[h.id] !== undefined ? { ...h, sort_order: idToNewSort[h.id] } : h) };
    }),
    toggleHabitDone: (habit_id, entry_date) => merge(prev => {
      const entries = prev.habit_entries || [];
      const existing = entries.find(e => e.habit_id === habit_id && e.entry_date === entry_date);
      if (existing && existing.status === 'done') {
        return { ...prev, habit_entries: entries.filter(e => !(e.habit_id === habit_id && e.entry_date === entry_date)) };
      }
      const next = { habit_id, user_id: 'mock', entry_date, status: 'done', created_at: new Date().toISOString() };
      return existing
        ? { ...prev, habit_entries: entries.map(e => (e.habit_id === habit_id && e.entry_date === entry_date) ? next : e) }
        : { ...prev, habit_entries: [...entries, next] };
    }),

    setProfile: (patch) => merge(prev => ({ ...prev, profile: { ...prev.profile, ...patch } })),
    setPomodoro: (patch) => merge(prev => ({ ...prev, pomodoro: { ...prev.pomodoro, ...patch } })),

    // society — no-op mocks (tour shows society as "still in build" anyway)
    refreshGroups: async () => {},
    createGroup:  async () => null,
    joinGroup:    async () => null,
    leaveGroup:   async () => {},
    getLeaderboard: async (_groupId, period) => makeDemoLeaderboard(period),

    resetAll: () => setState(makeDemoState()),
  };

  const value = { state, actions, ...deriveFolio(state) };
  return <FolioCtx.Provider value={value}>{children}</FolioCtx.Provider>;
}
