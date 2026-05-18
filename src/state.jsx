import React from 'react';
import { supabase } from './lib/supabase.js';
import { useAuth } from './auth-context.jsx';

/* Folio state — backed by Supabase.

   Shape of `state` is preserved from the old localStorage version so page
   views don't need changes. Profile / goals / pomodoro all flatten
   into one row in the `profiles` table, but are reshaped back into nested
   slices on load.

   Exceptions:
   - `state.current` (the live timer) stays in localStorage, keyed by user.id.
     It's per-device transient state — the laptop's running timer shouldn't
     mirror onto the phone.
*/

// --- Date helpers --------------------------------------------------------
export const DAY_MS = 86400 * 1000;
export const toISODate = (d) => {
  const y = d.getFullYear(), m = String(d.getMonth() + 1).padStart(2, "0"), day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
};
export const parseISODate = (s) => { const [y, m, d] = s.split("-").map(Number); return new Date(y, m - 1, d); };
export const todayISO = () => toISODate(new Date());
export const daysBetween = (a, b) => Math.floor((parseISODate(b) - parseISODate(a)) / DAY_MS);
export const addDays = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
export const startOfWeek = (d) => {
  const x = new Date(d); const dow = (x.getDay() + 6) % 7; x.setDate(x.getDate() - dow); x.setHours(0,0,0,0); return x;
};

// --- Current-session localStorage (per-device, per-user) ------------------
const currentSessionKey = (userId) => `folio.current_session.${userId}`;
const loadCurrentSession = (userId) => {
  try { return JSON.parse(localStorage.getItem(currentSessionKey(userId))) || null; }
  catch(e) { return null; }
};
const saveCurrentSession = (userId, s) => {
  try {
    if (s) localStorage.setItem(currentSessionKey(userId), JSON.stringify(s));
    else localStorage.removeItem(currentSessionKey(userId));
  } catch(e) {}
};

// --- Group shape helper --------------------------------------------------
// Flattens the group + nested members rows into a single object keyed by
// what the UI needs: own role, joined_at, member_count.
function shapeGroup(row, userId) {
  const members = row.members || [];
  const mine = members.find(m => m.user_id === userId);
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    invite_code: row.invite_code,
    created_at: row.created_at,
    member_count: members.length,
    my_role: mine?.role || 'member',
    joined_at: mine?.joined_at,
  };
}

// --- DB row → client state slices ----------------------------------------
function buildStateFromDb({ profile, subjects, sessions, dDays, journal, editorNotes, tasks, groups, habits, habitEntries }, userId) {
  return {
    profile: {
      handle: profile.handle,
      display_name: profile.display_name,
      avatar_url: profile.avatar_url,
      member_since: profile.created_at,
      theme: profile.theme,
      show_subjects: profile.show_subjects,
      show_longest: profile.show_longest,
      show_best_week: profile.show_best_week,
      appear_in_currently_studying: profile.appear_in_currently_studying,
      editor_notes_enabled: profile.editor_notes_enabled,
      tasks_public: profile.tasks_public,
      onboarded_at: profile.onboarded_at,
    },
    subjects: subjects || [],
    d_days: dDays || [],
    tasks: tasks || [],
    habits: habits || [],
    habit_entries: habitEntries || [],
    goals: {
      daily_seconds: profile.daily_goal_seconds,
      weekly_seconds: profile.weekly_goal_seconds,
      streak_freezes_available: profile.streak_freezes_available,
      weekly_goal_mode: profile.weekly_goal_mode,
    },
    sessions: sessions || [],
    journal: Object.fromEntries((journal || []).map(j => [j.entry_date, j.content])),
    editor_notes: Object.fromEntries((editorNotes || []).map(n => [n.week_start, n.content])),
    pomodoro: {
      enabled: profile.pomodoro_enabled,
      work_min: profile.pomodoro_work_min,
      short_break_min: profile.pomodoro_short_break_min,
      long_break_min: profile.pomodoro_long_break_min,
      cycles_before_long: profile.pomodoro_cycles_before_long,
    },
    current: loadCurrentSession(userId),
    last_active_subject: profile.last_active_subject_id,
    groups: (groups || []).map(g => shapeGroup(g, userId)),
  };
}

async function loadAllForUser(userId) {
  const [profileRes, subjectsRes, sessionsRes, ddaysRes, journalRes, notesRes, tasksRes, groupsRes, habitsRes, habitEntriesRes] = await Promise.all([
    supabase.from('profiles').select('*').eq('user_id', userId).single(),
    supabase.from('subjects').select('*').eq('user_id', userId).order('sort_order').order('created_at'),
    supabase.from('sessions').select('*').eq('user_id', userId).order('started_at', { ascending: false }),
    supabase.from('d_days').select('*').eq('user_id', userId).order('target'),
    supabase.from('journal_entries').select('entry_date, content').eq('user_id', userId),
    supabase.from('editor_notes').select('week_start, content').eq('user_id', userId),
    supabase.from('tasks').select('*').eq('user_id', userId).order('created_at'),
    supabase.from('groups').select('id, name, description, invite_code, created_at, members:group_members(user_id, role, joined_at)').order('created_at'),
    supabase.from('habits').select('*').eq('user_id', userId).order('sort_order').order('created_at'),
    supabase.from('habit_entries').select('habit_id, entry_date, status').eq('user_id', userId),
  ]);

  if (profileRes.error) throw profileRes.error;

  return buildStateFromDb({
    profile: profileRes.data,
    subjects: subjectsRes.data,
    sessions: sessionsRes.data,
    dDays: ddaysRes.data,
    journal: journalRes.data,
    editorNotes: notesRes.data,
    tasks: tasksRes.data,
    groups: groupsRes.data,
    habits: habitsRes.data,
    habitEntries: habitEntriesRes.data,
  }, userId);
}

// --- Context -------------------------------------------------------------
export const FolioCtx = React.createContext(null);
export const useFolio = () => React.useContext(FolioCtx);

// Pure derivation of all the computed fields from a raw state object.
// Used by both the real FolioProvider (Supabase-backed) and the onboarding
// mock provider so the page views see identical shape either way.
export function deriveFolio(state) {
  const bySort = (a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0)
    || new Date(a.created_at) - new Date(b.created_at);
  const subjectsActive   = state.subjects.filter(s => !s.archived && !s.deleted).sort(bySort);
  const subjectsArchived = state.subjects.filter(s => s.archived && !s.deleted).sort(bySort);
  const subjectMap       = Object.fromEntries(state.subjects.map(s => [s.id, s]));

  const liveSeconds = (() => {
    if (!state.current) return 0;
    const { started_at, accumulated, paused } = state.current;
    if (paused) return accumulated || 0;
    return (accumulated || 0) + Math.floor((Date.now() - new Date(started_at).getTime()) / 1000);
  })();

  const sessionsByDate = (() => {
    const map = {};
    for (const s of state.sessions) {
      const d = toISODate(new Date(s.started_at));
      if (!map[d]) map[d] = [];
      map[d].push(s);
    }
    return map;
  })();

  const todaySecondsBySubject = (() => {
    const today = todayISO();
    const out = {};
    for (const s of (sessionsByDate[today] || [])) {
      out[s.subject_id] = (out[s.subject_id] || 0) + s.duration_seconds;
    }
    if (state.current) {
      out[state.current.subject_id] = (out[state.current.subject_id] || 0) + liveSeconds;
    }
    return out;
  })();
  const todayTotalSeconds = Object.values(todaySecondsBySubject).reduce((a, b) => a + b, 0);

  // Monday-start week total (matches the Monday math in bestWeekSeconds below).
  const weekTotalSeconds = (() => {
    const today = new Date();
    const dow = today.getDay();
    const offset = dow === 0 ? -6 : 1 - dow;
    const monday = new Date(today.getFullYear(), today.getMonth(), today.getDate() + offset);
    const mondayIso = toISODate(monday);
    let total = 0;
    for (const s of state.sessions) {
      if (toISODate(new Date(s.started_at)) >= mondayIso) total += s.duration_seconds;
    }
    if (state.current) total += liveSeconds;
    return total;
  })();

  const totalSecondsBySubject = (() => {
    const out = {};
    for (const s of state.sessions) out[s.subject_id] = (out[s.subject_id] || 0) + s.duration_seconds;
    if (state.current) out[state.current.subject_id] = (out[state.current.subject_id] || 0) + liveSeconds;
    return out;
  })();
  const totalAllSeconds = Object.values(totalSecondsBySubject).reduce((a, b) => a + b, 0);

  const streak = (() => {
    const goal = state.goals.daily_seconds;
    let count = 0;
    let day = new Date();
    while (true) {
      const iso = toISODate(day);
      const total = (sessionsByDate[iso] || []).reduce((a, s) => a + s.duration_seconds, 0)
                    + (iso === todayISO() ? liveSeconds : 0);
      if (total >= goal) { count++; day = addDays(day, -1); }
      else break;
    }
    return count;
  })();

  const bestDaySeconds = (() => {
    let best = 0;
    for (const d in sessionsByDate) {
      const total = sessionsByDate[d].reduce((a, s) => a + s.duration_seconds, 0);
      if (total > best) best = total;
    }
    return best;
  })();

  // Monday-start ISO weeks, matching Postgres DATE_TRUNC('week', ...) used by the society RPC.
  const bestWeekSeconds = (() => {
    const byWeek = {};
    for (const s of state.sessions) {
      const d = new Date(s.started_at);
      const dow = d.getDay();
      const offset = dow === 0 ? -6 : 1 - dow;
      const monday = new Date(d.getFullYear(), d.getMonth(), d.getDate() + offset);
      const key = toISODate(monday);
      byWeek[key] = (byWeek[key] || 0) + s.duration_seconds;
    }
    const vals = Object.values(byWeek);
    return vals.length ? Math.max(...vals) : 0;
  })();

  const bestMonthSeconds = (() => {
    const byMonth = {};
    for (const s of state.sessions) {
      const d = new Date(s.started_at);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      byMonth[key] = (byMonth[key] || 0) + s.duration_seconds;
    }
    const vals = Object.values(byMonth);
    return vals.length ? Math.max(...vals) : 0;
  })();

  // --- habits ------------------------------------------------------------
  const habitsActive   = (state.habits || []).filter(h => !h.archived_at).sort(bySort);
  const habitsArchived = (state.habits || []).filter(h =>  h.archived_at).sort(bySort);
  const habitMap       = Object.fromEntries((state.habits || []).map(h => [h.id, h]));

  // habit_id -> { entry_date: status }
  const habitEntriesByHabit = (() => {
    const map = {};
    for (const e of (state.habit_entries || [])) {
      if (!map[e.habit_id]) map[e.habit_id] = {};
      map[e.habit_id][e.entry_date] = e.status;
    }
    return map;
  })();

  // entry_date -> count of 'done' entries (for insights heatmap)
  const habitDoneCountByDate = (() => {
    const map = {};
    for (const e of (state.habit_entries || [])) {
      if (e.status !== 'done') continue;
      map[e.entry_date] = (map[e.entry_date] || 0) + 1;
    }
    return map;
  })();

  // per-habit stats: today status, total done, streak, current-week count
  const habitStats = (() => {
    const today = todayISO();
    const out = {};
    const monday = startOfWeek(new Date());
    const mondayIso = toISODate(monday);
    for (const h of (state.habits || [])) {
      const entries = habitEntriesByHabit[h.id] || {};
      const todayStatus = entries[today] || null;

      let totalDone = 0;
      for (const d in entries) if (entries[d] === 'done') totalDone++;

      // streak: walk back from today; 'done' extends, 'skip' is neutral (rest day),
      // missing breaks — except today itself, which is allowed to be blank
      // (so a streak that ended yesterday still shows until today is missed at end of day).
      let streak = 0;
      let cursor = new Date();
      let started = false;
      // hard cap to avoid pathological loops if data is malformed
      for (let i = 0; i < 3650; i++) {
        const iso = toISODate(cursor);
        const s = entries[iso];
        if (s === 'done') { streak++; started = true; cursor = addDays(cursor, -1); continue; }
        if (s === 'skip') { cursor = addDays(cursor, -1); continue; }
        if (!started && iso === today) { cursor = addDays(cursor, -1); continue; }
        break;
      }

      // this-week done count (Mon-start), capped at today
      let weekDone = 0;
      for (let i = 0; i < 7; i++) {
        const iso = toISODate(addDays(monday, i));
        if (iso > today) break;
        if (entries[iso] === 'done') weekDone++;
      }

      out[h.id] = { todayStatus, totalDone, streak, weekDone, weekStartIso: mondayIso };
    }
    return out;
  })();

  return {
    subjectsActive, subjectsArchived, subjectMap,
    liveSeconds,
    sessionsByDate, todaySecondsBySubject, todayTotalSeconds, weekTotalSeconds,
    totalSecondsBySubject, totalAllSeconds,
    streak, bestDaySeconds, bestWeekSeconds, bestMonthSeconds,
    habitsActive, habitsArchived, habitMap, habitEntriesByHabit, habitDoneCountByDate, habitStats,
  };
}

export function FolioProvider({ children }) {
  const { user } = useAuth();
  const [state, setState] = React.useState(null);
  const [loadError, setLoadError] = React.useState(null);
  const [, setTick] = React.useState(0);

  // ref so async actions can read fresh state without stale closures
  const stateRef = React.useRef(state);
  stateRef.current = state;

  // Load on mount / user change
  React.useEffect(() => {
    if (!user?.id) return;
    let cancelled = false;
    setState(null);
    setLoadError(null);
    loadAllForUser(user.id)
      .then(s => { if (!cancelled) setState(s); })
      .catch(err => { if (!cancelled) { console.error('Folio load failed:', err); setLoadError(err); } });
    return () => { cancelled = true; };
  }, [user?.id]);

  // current-session tick (re-render every second while a session is running)
  React.useEffect(() => {
    if (!state?.current || state.current.paused) return;
    const i = setInterval(() => setTick(t => t + 1), 1000);
    return () => clearInterval(i);
  }, [state?.current?.subject_id, state?.current?.paused, state?.current?.started_at]);

  // --- early returns for loading / error ---
  if (loadError) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
        <div style={{ maxWidth: 420, textAlign: "center" }}>
          <div className="serif" style={{ fontSize: 28, color: "var(--ink)", marginBottom: 12 }}>something went wrong</div>
          <p className="sans" style={{ color: "var(--ink-2)", fontSize: 14, marginBottom: 18 }}>{loadError.message || "couldn't load your data."}</p>
          <button onClick={() => window.location.reload()} className="sans" style={{ padding: "10px 22px", borderRadius: 999, background: "var(--accent)", color: "var(--surface)", fontSize: 14 }}>
            reload
          </button>
        </div>
      </div>
    );
  }

  if (!state) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <span className="serif" style={{ fontSize: 28, color: "var(--ink-3)" }}>Folio</span>
      </div>
    );
  }

  // --- derived data ---
  const derived = deriveFolio(state);

  // --- internal helpers ---
  const merge = (patch) => setState(prev => prev ? { ...prev, ...patch } : prev);
  const mergeProfile = async (patch) => {
    const { error } = await supabase.from('profiles').update(patch).eq('user_id', user.id);
    if (error) { console.error('profile update failed:', error); throw error; }
  };

  // --- actions ---
  const actions = {
    // ----- timer / sessions -----
    startSession: ({ mode = "stopwatch" } = {}) => {
      const prev = stateRef.current;
      if (!prev) return;
      const subject_id = prev.last_active_subject
        || prev.subjects.find(s => !s.archived && !s.deleted)?.id;
      if (!subject_id) return;
      const current = {
        subject_id,
        started_at: new Date().toISOString(),
        accumulated: 0,
        paused: false,
        mode,
      };
      saveCurrentSession(user.id, current);
      merge({ current });
    },

    pauseSession: () => {
      const prev = stateRef.current;
      if (!prev?.current || prev.current.paused) return;
      const elapsed = Math.floor((Date.now() - new Date(prev.current.started_at).getTime()) / 1000);
      const current = { ...prev.current, paused: true, accumulated: (prev.current.accumulated || 0) + elapsed };
      saveCurrentSession(user.id, current);
      merge({ current });
    },

    resumeSession: () => {
      const prev = stateRef.current;
      if (!prev?.current || !prev.current.paused) return;
      const current = { ...prev.current, paused: false, started_at: new Date().toISOString() };
      saveCurrentSession(user.id, current);
      merge({ current });
    },

    endSession: async () => {
      const prev = stateRef.current;
      if (!prev?.current) return;
      const cur = prev.current;
      const totalSec = cur.paused
        ? (cur.accumulated || 0)
        : (cur.accumulated || 0) + Math.floor((Date.now() - new Date(cur.started_at).getTime()) / 1000);

      // discard sessions shorter than 5 seconds
      if (totalSec < 5) {
        saveCurrentSession(user.id, null);
        merge({ current: null });
        return;
      }

      const row = {
        user_id: user.id,
        subject_id: cur.subject_id,
        started_at: new Date(Date.now() - totalSec * 1000).toISOString(),
        ended_at: new Date().toISOString(),
        duration_seconds: totalSec,
        mode: cur.mode || "stopwatch",
      };

      const { data, error } = await supabase.from('sessions').insert(row).select().single();
      if (error) { console.error('saving session failed:', error); return; }

      saveCurrentSession(user.id, null);
      setState(p => p ? { ...p, current: null, sessions: [data, ...p.sessions] } : p);
    },

    deleteSession: async (id) => {
      const prev = stateRef.current;
      if (!prev) return;
      const original = prev.sessions.find(s => s.id === id);
      if (!original) return;
      setState(p => p ? { ...p, sessions: p.sessions.filter(s => s.id !== id) } : p);
      const { error } = await supabase.from('sessions').delete().eq('id', id);
      if (error) {
        console.error('deleteSession failed:', error);
        setState(p => p ? {
          ...p,
          sessions: [...p.sessions, original].sort((a, b) => new Date(b.started_at) - new Date(a.started_at)),
        } : p);
      }
    },

    setActiveSubject: async (id) => {
      const prev = stateRef.current;
      if (!prev) return;
      // if a session is running, end the current one first then start fresh on new subject
      if (prev.current) {
        const cur = prev.current;
        const totalSec = cur.paused
          ? (cur.accumulated || 0)
          : (cur.accumulated || 0) + Math.floor((Date.now() - new Date(cur.started_at).getTime()) / 1000);
        if (totalSec >= 5) {
          const row = {
            user_id: user.id,
            subject_id: cur.subject_id,
            started_at: new Date(Date.now() - totalSec * 1000).toISOString(),
            ended_at: new Date().toISOString(),
            duration_seconds: totalSec,
            mode: cur.mode || "stopwatch",
          };
          const { data, error } = await supabase.from('sessions').insert(row).select().single();
          if (!error && data) {
            setState(p => p ? { ...p, sessions: [data, ...p.sessions] } : p);
          }
        }
        const newCurrent = { ...cur, subject_id: id, started_at: new Date().toISOString(), accumulated: 0, paused: false };
        saveCurrentSession(user.id, newCurrent);
        setState(p => p ? { ...p, current: newCurrent, last_active_subject: id } : p);
      } else {
        setState(p => p ? { ...p, last_active_subject: id } : p);
      }
      // persist last_active to profile (fire and forget)
      mergeProfile({ last_active_subject_id: id }).catch(()=>{});
    },

    // ----- subjects CRUD -----
    addSubject: async ({ name, color }) => {
      const prev = stateRef.current;
      const nextSort = prev ? prev.subjects.reduce((m, s) => Math.max(m, s.sort_order ?? 0), -1) + 1 : 0;
      const row = { user_id: user.id, name, color, sort_order: nextSort };
      const { data, error } = await supabase.from('subjects').insert(row).select().single();
      if (error) { console.error(error); return null; }
      setState(p => p ? { ...p, subjects: [...p.subjects, data] } : p);
      return data;
    },

    updateSubject: async (id, patch) => {
      const { data, error } = await supabase.from('subjects').update(patch).eq('id', id).select().single();
      if (error) { console.error(error); return; }
      setState(p => p ? { ...p, subjects: p.subjects.map(s => s.id === id ? data : s) } : p);
    },

    reorderSubjects: async (orderedIds) => {
      const prev = stateRef.current;
      if (!prev) return;
      const idToNewSort = Object.fromEntries(orderedIds.map((id, i) => [id, i]));
      const original = prev.subjects;
      setState(p => p ? { ...p, subjects: p.subjects.map(s => idToNewSort[s.id] !== undefined ? { ...s, sort_order: idToNewSort[s.id] } : s) } : p);
      const results = await Promise.all(
        orderedIds.map((id, i) => supabase.from('subjects').update({ sort_order: i }).eq('id', id))
      );
      const firstErr = results.find(r => r.error);
      if (firstErr) {
        console.error('reorderSubjects failed:', firstErr.error);
        setState(p => p ? { ...p, subjects: original } : p);
      }
    },

    archiveSubject: async (id) => {
      const patch = { archived: true, archived_at: new Date().toISOString() };
      await actions.updateSubject(id, patch);
    },
    unarchiveSubject: async (id) => {
      await actions.updateSubject(id, { archived: false, archived_at: null });
    },
    deleteSubject: async (id) => {
      await actions.updateSubject(id, { deleted: true, deleted_at: new Date().toISOString() });
    },

    // ----- d-days -----
    addDDay: async (d) => {
      const row = { user_id: user.id, ...d };
      const { data, error } = await supabase.from('d_days').insert(row).select().single();
      if (error) { console.error(error); return; }
      setState(p => p ? { ...p, d_days: [...p.d_days, data] } : p);
    },
    updateDDay: async (id, patch) => {
      const { data, error } = await supabase.from('d_days').update(patch).eq('id', id).select().single();
      if (error) { console.error(error); return; }
      setState(p => p ? { ...p, d_days: p.d_days.map(x => x.id === id ? data : x) } : p);
    },
    removeDDay: async (id) => {
      const { error } = await supabase.from('d_days').delete().eq('id', id);
      if (error) { console.error(error); return; }
      setState(p => p ? { ...p, d_days: p.d_days.filter(x => x.id !== id) } : p);
    },

    // ----- goals -----
    setGoals: async (patch) => {
      const dbPatch = {};
      if ('daily_seconds' in patch) dbPatch.daily_goal_seconds = patch.daily_seconds;
      if ('weekly_seconds' in patch) dbPatch.weekly_goal_seconds = patch.weekly_seconds;
      if ('streak_freezes_available' in patch) dbPatch.streak_freezes_available = patch.streak_freezes_available;
      if ('weekly_goal_mode' in patch) dbPatch.weekly_goal_mode = patch.weekly_goal_mode;
      await mergeProfile(dbPatch);
      setState(p => p ? { ...p, goals: { ...p.goals, ...patch } } : p);
    },

    // ----- journal (upsert per date) -----
    setJournal: async (iso, content) => {
      const { error } = await supabase.from('journal_entries').upsert(
        { user_id: user.id, entry_date: iso, content },
        { onConflict: 'user_id,entry_date' }
      );
      if (error) { console.error(error); return; }
      setState(p => p ? { ...p, journal: { ...p.journal, [iso]: content } } : p);
    },

    // ----- tasks (per-day TODOs) -----
    addTask: async ({ task_date, title, subject_id = null }) => {
      const row = { user_id: user.id, task_date, title, subject_id };
      const { data, error } = await supabase.from('tasks').insert(row).select().single();
      if (error) { console.error('addTask failed:', error); return; }
      setState(p => p ? { ...p, tasks: [...p.tasks, data] } : p);
    },

    toggleTask: async (id) => {
      const prev = stateRef.current;
      if (!prev) return;
      const original = prev.tasks.find(t => t.id === id);
      if (!original) return;
      const nextDone = !original.done;
      // optimistic flip
      setState(p => p ? { ...p, tasks: p.tasks.map(t => t.id === id ? { ...t, done: nextDone, done_at: nextDone ? new Date().toISOString() : null } : t) } : p);
      const { data, error } = await supabase.from('tasks').update({ done: nextDone }).eq('id', id).select().single();
      if (error) {
        console.error('toggleTask failed:', error);
        setState(p => p ? { ...p, tasks: p.tasks.map(t => t.id === id ? original : t) } : p);
        return;
      }
      setState(p => p ? { ...p, tasks: p.tasks.map(t => t.id === id ? data : t) } : p);
    },

    updateTask: async (id, patch) => {
      const prev = stateRef.current;
      if (!prev) return;
      const original = prev.tasks.find(t => t.id === id);
      if (!original) return;
      setState(p => p ? { ...p, tasks: p.tasks.map(t => t.id === id ? { ...t, ...patch } : t) } : p);
      const { data, error } = await supabase.from('tasks').update(patch).eq('id', id).select().single();
      if (error) {
        console.error('updateTask failed:', error);
        setState(p => p ? { ...p, tasks: p.tasks.map(t => t.id === id ? original : t) } : p);
        return;
      }
      setState(p => p ? { ...p, tasks: p.tasks.map(t => t.id === id ? data : t) } : p);
    },

    deleteTask: async (id) => {
      const prev = stateRef.current;
      if (!prev) return;
      const original = prev.tasks.find(t => t.id === id);
      setState(p => p ? { ...p, tasks: p.tasks.filter(t => t.id !== id) } : p);
      const { error } = await supabase.from('tasks').delete().eq('id', id);
      if (error) {
        console.error('deleteTask failed:', error);
        if (original) setState(p => p ? { ...p, tasks: [...p.tasks, original] } : p);
      }
    },

    // ----- habits -----
    addHabit: async ({ name, color, note = null, target_per_week = null }) => {
      const prev = stateRef.current;
      const nextSort = prev ? (prev.habits || []).reduce((m, h) => Math.max(m, h.sort_order ?? 0), -1) + 1 : 0;
      const row = { user_id: user.id, name, color, note, sort_order: nextSort, target_per_week };
      const { data, error } = await supabase.from('habits').insert(row).select().single();
      if (error) { console.error('addHabit failed:', error); return null; }
      setState(p => p ? { ...p, habits: [...p.habits, data] } : p);
      return data;
    },

    updateHabit: async (id, patch) => {
      const allowed = ['name', 'color', 'note', 'target_per_week', 'sort_order', 'archived_at'];
      const dbPatch = {};
      for (const k of allowed) if (k in patch) dbPatch[k] = patch[k];
      if (!Object.keys(dbPatch).length) return;
      const { data, error } = await supabase.from('habits').update(dbPatch).eq('id', id).select().single();
      if (error) { console.error('updateHabit failed:', error); return; }
      setState(p => p ? { ...p, habits: p.habits.map(h => h.id === id ? data : h) } : p);
    },

    archiveHabit: async (id) => {
      await actions.updateHabit(id, { archived_at: new Date().toISOString() });
    },
    unarchiveHabit: async (id) => {
      await actions.updateHabit(id, { archived_at: null });
    },

    deleteHabit: async (id) => {
      const prev = stateRef.current;
      if (!prev) return;
      const original = prev.habits.find(h => h.id === id);
      const origEntries = prev.habit_entries.filter(e => e.habit_id === id);
      setState(p => p ? {
        ...p,
        habits: p.habits.filter(h => h.id !== id),
        habit_entries: p.habit_entries.filter(e => e.habit_id !== id),
      } : p);
      const { error } = await supabase.from('habits').delete().eq('id', id);
      if (error) {
        console.error('deleteHabit failed:', error);
        if (original) setState(p => p ? {
          ...p,
          habits: [...p.habits, original],
          habit_entries: [...p.habit_entries, ...origEntries],
        } : p);
      }
    },

    reorderHabits: async (orderedIds) => {
      const prev = stateRef.current;
      if (!prev) return;
      const idToNewSort = Object.fromEntries(orderedIds.map((id, i) => [id, i]));
      const original = prev.habits;
      setState(p => p ? { ...p, habits: p.habits.map(h => idToNewSort[h.id] !== undefined ? { ...h, sort_order: idToNewSort[h.id] } : h) } : p);
      const results = await Promise.all(
        orderedIds.map((id, i) => supabase.from('habits').update({ sort_order: i }).eq('id', id))
      );
      const firstErr = results.find(r => r.error);
      if (firstErr) {
        console.error('reorderHabits failed:', firstErr.error);
        setState(p => p ? { ...p, habits: original } : p);
      }
    },

    toggleHabitDone: async (habit_id, entry_date) => {
      const prev = stateRef.current;
      if (!prev) return;
      const existing = prev.habit_entries.find(e => e.habit_id === habit_id && e.entry_date === entry_date);
      if (existing && existing.status === 'done') {
        // optimistic delete
        setState(p => p ? { ...p, habit_entries: p.habit_entries.filter(e => !(e.habit_id === habit_id && e.entry_date === entry_date)) } : p);
        const { error } = await supabase.from('habit_entries').delete().eq('habit_id', habit_id).eq('entry_date', entry_date);
        if (error) {
          console.error('toggleHabitDone delete failed:', error);
          setState(p => p ? { ...p, habit_entries: [...p.habit_entries, existing] } : p);
        }
      } else {
        // optimistic insert/upsert
        const optimistic = { habit_id, user_id: user.id, entry_date, status: 'done', created_at: new Date().toISOString() };
        setState(p => p ? { ...p, habit_entries: existing
          ? p.habit_entries.map(e => (e.habit_id === habit_id && e.entry_date === entry_date) ? optimistic : e)
          : [...p.habit_entries, optimistic] } : p);
        const { data, error } = await supabase.from('habit_entries')
          .upsert({ habit_id, user_id: user.id, entry_date, status: 'done' }, { onConflict: 'habit_id,entry_date' })
          .select().single();
        if (error) {
          console.error('toggleHabitDone insert failed:', error);
          setState(p => p ? { ...p, habit_entries: existing
            ? p.habit_entries.map(e => (e.habit_id === habit_id && e.entry_date === entry_date) ? existing : e)
            : p.habit_entries.filter(e => !(e.habit_id === habit_id && e.entry_date === entry_date)) } : p);
        } else if (data) {
          setState(p => p ? { ...p, habit_entries: p.habit_entries.map(e => (e.habit_id === habit_id && e.entry_date === entry_date) ? data : e) } : p);
        }
      }
    },

    // ----- profile / preferences -----
    setProfile: async (patch) => {
      // only forward fields that exist on the DB row
      const allowed = ['handle','display_name','avatar_url','theme','show_subjects','show_longest','show_best_week','appear_in_currently_studying','editor_notes_enabled','tasks_public','onboarded_at'];
      const dbPatch = {};
      for (const k of allowed) if (k in patch) dbPatch[k] = patch[k];
      if (Object.keys(dbPatch).length === 0) return;
      await mergeProfile(dbPatch);
      setState(p => p ? { ...p, profile: { ...p.profile, ...patch } } : p);
    },

    setPomodoro: async (patch) => {
      const dbPatch = {};
      if ('enabled' in patch) dbPatch.pomodoro_enabled = patch.enabled;
      if ('work_min' in patch) dbPatch.pomodoro_work_min = patch.work_min;
      if ('short_break_min' in patch) dbPatch.pomodoro_short_break_min = patch.short_break_min;
      if ('long_break_min' in patch) dbPatch.pomodoro_long_break_min = patch.long_break_min;
      if ('cycles_before_long' in patch) dbPatch.pomodoro_cycles_before_long = patch.cycles_before_long;
      await mergeProfile(dbPatch);
      setState(p => p ? { ...p, pomodoro: { ...p.pomodoro, ...patch } } : p);
    },

    // ----- society / groups -----
    refreshGroups: async () => {
      const { data, error } = await supabase
        .from('groups')
        .select('id, name, description, invite_code, created_at, members:group_members(user_id, role, joined_at)')
        .order('created_at');
      if (error) { console.error('refreshGroups failed:', error); return; }
      setState(p => p ? { ...p, groups: (data || []).map(g => shapeGroup(g, user.id)) } : p);
    },

    createGroup: async (name, description) => {
      const { data, error } = await supabase.rpc('create_group', { p_name: name, p_description: description ?? null });
      if (error) throw error;
      await actions.refreshGroups();
      return data;
    },

    joinGroup: async (invite_code) => {
      const { data, error } = await supabase.rpc('join_group', { p_invite_code: invite_code });
      if (error) throw error;
      await actions.refreshGroups();
      return data;
    },

    leaveGroup: async (group_id) => {
      const { error } = await supabase.rpc('leave_group', { p_group_id: group_id });
      if (error) throw error;
      setState(p => p ? { ...p, groups: p.groups.filter(g => g.id !== group_id) } : p);
    },

    kickMember: async (group_id, user_id) => {
      const { error } = await supabase
        .from('group_members')
        .delete()
        .eq('group_id', group_id)
        .eq('user_id', user_id);
      if (error) throw error;
      await actions.refreshGroups();
    },

    getLeaderboard: async (group_id, period) => {
      const today = new Date();
      const isoToday = toISODate(today);
      let start = null, end = null;
      if (period === 'today')          { start = isoToday; end = isoToday; }
      else if (period === 'this week') { start = toISODate(startOfWeek(today)); end = isoToday; }
      const { data, error } = await supabase.rpc('get_group_leaderboard', {
        p_group_id: group_id,
        p_start_date: start,
        p_end_date: end,
      });
      if (error) throw error;
      return data || [];
    },

    // ----- dev / reset (only wipes this user's rows; keeps profile + defaults) -----
    resetAll: async () => {
      if (!confirm("Reset all your Folio data? This deletes sessions, journal entries, and d-days. Subjects keep their defaults.")) return;
      await Promise.all([
        supabase.from('sessions').delete().eq('user_id', user.id),
        supabase.from('journal_entries').delete().eq('user_id', user.id),
        supabase.from('d_days').delete().eq('user_id', user.id),
        supabase.from('editor_notes').delete().eq('user_id', user.id),
        supabase.from('tasks').delete().eq('user_id', user.id),
        supabase.from('habits').delete().eq('user_id', user.id),
      ]);
      saveCurrentSession(user.id, null);
      // re-load fresh
      try { setState(await loadAllForUser(user.id)); } catch(e) { console.error(e); }
    },
  };

  const value = { state, actions, ...derived };

  return <FolioCtx.Provider value={value}>{children}</FolioCtx.Provider>;
}

// --- formatting helpers --------------------------------------------------
export function fmtHMS(totalSec) {
  const s = Math.max(0, Math.floor(totalSec));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  return [h, m, sec].map(n => String(n).padStart(2, "0"));
}
export function fmtHoursLong(sec) {
  const s = Math.max(0, Math.floor(sec));
  if (s < 60) return `${s}s`;
  if (s < 3600) {
    const m = Math.floor(s / 60);
    return `${m}m ${s % 60}s`;
  }
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  return `${h}h ${m}m`;
}
