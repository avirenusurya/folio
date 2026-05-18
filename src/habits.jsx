import React from 'react';
import { useFolio, todayISO, toISODate, addDays } from './state.jsx';
import { COLOR_PALETTE, IconArrowLeft, IconPencil, useMediaQuery } from './shared.jsx';

/* The Habits page — daily habit tracker with optional weekly target. */

export function HabitsView() {
  const [detailId, setDetailId] = React.useState(null);
  const isMobile = useMediaQuery("(max-width: 700px)");
  if (detailId) return <HabitDetail habitId={detailId} onBack={() => setDetailId(null)} isMobile={isMobile} />;
  return <HabitsList onOpenHabit={setDetailId} isMobile={isMobile} />;
}

// ---------- LIST VIEW ----------

function HabitsList({ onOpenHabit, isMobile }) {
  const f = useFolio();
  const habits = f.habitsActive;
  // null | { mode: 'new' } | habit
  const [editing, setEditing] = React.useState(null);

  const today = new Date();
  const dateLabel = today.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" }).toLowerCase();

  return (
    <div className="page" style={{ maxWidth: 920, margin: "0 auto", padding: isMobile ? "42px 18px 130px" : "72px 32px 160px" }}>
      <div className="stagger" style={{ display: "flex", flexDirection: "column" }}>
        <div style={{ textAlign: "center" }}>
          <h1 className="serif" style={{ fontSize: isMobile ? 44 : 56, margin: 0, color: "var(--ink)" }}>habits</h1>
          <div className="smallcaps" style={{ color: "var(--accent)", marginTop: 16 }}>today · {dateLabel}</div>
        </div>

        <div style={{ marginTop: isMobile ? 36 : 48 }}>
          <SectionHeader title="today">
            <button className="sans" onClick={() => setEditing({ mode: 'new' })} style={addBtnStyle}>+ new habit</button>
          </SectionHeader>

          {habits.length === 0 ? (
            <EmptyState onAdd={() => setEditing({ mode: 'new' })} />
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {habits.map(h => (
                <HabitRow
                  key={h.id}
                  habit={h}
                  stats={f.habitStats[h.id]}
                  entries={f.habitEntriesByHabit[h.id] || {}}
                  onOpen={() => onOpenHabit(h.id)}
                  onEdit={() => setEditing(h)}
                  isMobile={isMobile}
                />
              ))}
            </div>
          )}
        </div>

        {habits.length > 0 && (
          <div style={{ marginTop: isMobile ? 40 : 56 }}>
            <SectionHeader title="insights" />
            <InsightsSection isMobile={isMobile} />
          </div>
        )}
      </div>

      <HabitEditorModal
        habit={editing && editing.mode !== 'new' ? editing : null}
        open={!!editing}
        onClose={() => setEditing(null)}
      />
    </div>
  );
}

function SectionHeader({ title, children }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 16 }}>
      <div className="smallcaps" style={{ color: "var(--accent)" }}>{title}</div>
      {children}
    </div>
  );
}

const addBtnStyle = { fontSize: 12, color: "var(--ink-3)", padding: "6px 12px", borderRadius: 999, background: "transparent" };
const navBtnStyle = { padding: "4px 10px", color: "var(--ink-2)", fontSize: 18, background: "transparent" };

function EmptyState({ onAdd }) {
  return (
    <div style={{ textAlign: "center", padding: "36px 16px", background: "var(--surface)", borderRadius: 14, color: "var(--ink-3)" }}>
      <div className="serif" style={{ fontSize: 22, marginBottom: 10, color: "var(--ink-2)" }}>no habits yet</div>
      <div className="sans" style={{ fontSize: 14, marginBottom: 18 }}>build a small daily rhythm — meditate, read, plan tomorrow.</div>
      <button onClick={onAdd} className="sans lift" style={{ padding: "10px 22px", borderRadius: 999, background: "var(--accent)", color: "var(--surface)", fontSize: 13 }}>
        add your first habit
      </button>
    </div>
  );
}

// ---------- HABIT ROW ----------

function HabitRow({ habit, stats, entries, onOpen, onEdit, isMobile }) {
  const f = useFolio();
  const today = todayISO();
  const todayDate = new Date();

  // last 5 days, oldest left, today rightmost
  const days = [];
  for (let i = 4; i >= 0; i--) {
    const d = addDays(todayDate, -i);
    const iso = toISODate(d);
    days.push({ iso, isToday: iso === today, label: d.getDate(), dow: d.toLocaleDateString("en-US", { weekday: "short" }) });
  }

  const total = stats?.totalDone ?? 0;
  const statLine = (() => {
    if (habit.target_per_week) {
      return `${total} total · ${stats?.weekDone ?? 0}/${habit.target_per_week} this week`;
    }
    if (stats?.streak) return `${total} total · ${stats.streak} day streak`;
    const missed = days.filter(d => !d.isToday && entries[d.iso] !== 'done').length;
    if (missed > 0) return `${total} total · ${missed} missed day${missed > 1 ? 's' : ''}`;
    return `${total} total`;
  })();

  const dotSize = isMobile ? 36 : 42;

  return (
    <div
      onClick={onOpen}
      style={{
        background: `color-mix(in srgb, ${habit.color} 18%, var(--surface))`,
        borderRadius: 14,
        padding: isMobile ? "14px 16px" : "16px 20px",
        cursor: "pointer",
        display: "flex", flexDirection: "column", gap: 10,
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 12 }}>
        <div style={{ minWidth: 0, flex: 1 }}>
          <div className="serif" style={{ fontSize: isMobile ? 20 : 22, color: "var(--ink)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{habit.name}</div>
          <div className="sans" style={{ fontSize: 12, color: "var(--ink-2)", marginTop: 2 }}>{statLine}</div>
        </div>
        <button
          onClick={(e) => { e.stopPropagation(); onEdit(); }}
          className="sans"
          style={{ padding: 6, background: "transparent", color: "var(--ink-3)", opacity: 0.7, display: "flex", alignItems: "center" }}
          aria-label="edit habit"
          title="edit"
        >
          <IconPencil size={16} />
        </button>
      </div>

      <div style={{ display: "flex", gap: isMobile ? 10 : 14, marginTop: 2 }}>
        {days.map(d => (
          <HabitDot
            key={d.iso}
            status={entries[d.iso] || null}
            color={habit.color}
            isToday={d.isToday}
            onClick={(e) => { e.stopPropagation(); f.actions.toggleHabitDone(habit.id, d.iso); }}
            size={dotSize}
          />
        ))}
      </div>
    </div>
  );
}

function HabitDot({ status, color, isToday, onClick, size = 40 }) {
  const filled = status === 'done';
  return (
    <button
      onClick={onClick}
      aria-label={filled ? 'mark not done' : isToday ? 'mark today done' : 'mark done'}
      style={{
        width: size, height: size, borderRadius: 999,
        background: filled ? color : "transparent",
        border: `2px solid ${filled ? color : `color-mix(in srgb, ${color} 55%, transparent)`}`,
        display: "flex", alignItems: "center", justifyContent: "center",
        padding: 0,
        cursor: "pointer",
        flexShrink: 0,
        transition: "background 160ms, border-color 160ms",
      }}
    >
      {isToday && !filled && (
        <span style={{ width: 6, height: 6, borderRadius: 999, background: color }} />
      )}
      {isToday && filled && (
        <span style={{ width: 6, height: 6, borderRadius: 999, background: `color-mix(in srgb, ${color} 50%, #000)` }} />
      )}
    </button>
  );
}

// ---------- INSIGHTS ----------

function InsightsSection({ isMobile }) {
  const f = useFolio();
  const habits = f.habitsActive;
  const today = new Date();
  const [cursor, setCursor] = React.useState(new Date(today.getFullYear(), today.getMonth(), 1));

  const monthLabel = cursor.toLocaleDateString("en-US", { month: "long", year: "numeric" }).toLowerCase();
  const prev = () => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() - 1, 1));
  const next = () => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1));

  // Mon-start month grid
  const firstOfMonth = new Date(cursor.getFullYear(), cursor.getMonth(), 1);
  const firstDow = (firstOfMonth.getDay() + 6) % 7;
  const gridStart = addDays(firstOfMonth, -firstDow);
  const cells = Array.from({ length: 42 }, (_, i) => {
    const d = addDays(gridStart, i);
    return { date: d, iso: toISODate(d), inMonth: d.getMonth() === cursor.getMonth() };
  });

  const todayIso = todayISO();
  const maxPerDay = Math.max(1, habits.length);

  // top habits by total done
  const topHabits = habits
    .map(h => ({ ...h, totalDone: f.habitStats[h.id]?.totalDone ?? 0 }))
    .sort((a, b) => b.totalDone - a.totalDone);
  const topMax = Math.max(1, topHabits[0]?.totalDone || 1);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: isMobile ? 16 : 22 }}>
      {/* Heatmap */}
      <div style={{ background: "var(--surface)", borderRadius: 14, padding: isMobile ? "16px 14px" : "20px 22px" }}>
        <div className="smallcaps" style={{ color: "var(--ink-3)", marginBottom: 12, fontSize: 10 }}>heatmap</div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
          <button onClick={prev} className="sans" style={navBtnStyle} aria-label="previous month">‹</button>
          <div className="serif" style={{ fontSize: isMobile ? 18 : 20, color: "var(--ink)" }}>{monthLabel}</div>
          <button onClick={next} className="sans" style={navBtnStyle} aria-label="next month">›</button>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 4, marginBottom: 6 }}>
          {["M","T","W","T","F","S","S"].map((d, i) => (
            <div key={i} className="smallcaps" style={{ textAlign: "center", color: "var(--ink-3)", fontSize: 9 }}>{d}</div>
          ))}
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 4 }}>
          {cells.map((c, i) => {
            const done = f.habitDoneCountByDate[c.iso] || 0;
            const ratio = done / maxPerDay;
            const intensity = done === 0 ? 0
              : ratio < 0.34 ? 1
              : ratio < 0.67 ? 2
              : ratio < 1 ? 3
              : 4;
            const colors = ["transparent", "var(--hm-1)", "var(--hm-2)", "var(--hm-3)", "var(--hm-4)"];
            const isToday = c.iso === todayIso;
            return (
              <div key={i} title={c.inMonth ? `${c.iso} · ${done} habit${done === 1 ? '' : 's'}` : ''} style={{
                aspectRatio: "1", borderRadius: 999,
                background: c.inMonth ? colors[intensity] : "transparent",
                display: "flex", alignItems: "center", justifyContent: "center",
                color: !c.inMonth ? "var(--ink-4)" : intensity >= 3 ? "var(--bg-deep)" : "var(--ink-2)",
                fontSize: isMobile ? 11 : 12,
                fontWeight: isToday ? 600 : 400,
                textDecoration: isToday ? "underline" : "none",
              }}>{c.date.getDate()}</div>
            );
          })}
        </div>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 6, marginTop: 14 }}>
          <div className="smallcaps" style={{ color: "var(--ink-3)", fontSize: 9, marginRight: 4 }}>habits / day</div>
          {[0,1,2,3,4].map(i => (
            <span key={i} className="sans tnum" style={{
              display: "inline-flex", alignItems: "center", justifyContent: "center",
              width: 18, height: 18, borderRadius: 999,
              background: i === 0 ? "transparent" : `var(--hm-${i})`,
              border: i === 0 ? "1px solid rgba(110,90,71,0.18)" : "none",
              color: i >= 3 ? "var(--bg-deep)" : "var(--ink-2)",
              fontSize: 10,
            }}>{i}</span>
          ))}
        </div>
      </div>

      {/* Top habits */}
      <div style={{ background: "var(--surface)", borderRadius: 14, padding: isMobile ? "16px 14px" : "20px 22px" }}>
        <div className="smallcaps" style={{ color: "var(--ink-3)", marginBottom: 14, fontSize: 10 }}>top habits</div>
        {topHabits.length === 0 ? (
          <div className="sans" style={{ color: "var(--ink-3)", fontSize: 13 }}>add a habit to see rankings.</div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {topHabits.map((h, i) => (
              <div key={h.id} style={{ display: "grid", gridTemplateColumns: isMobile ? "20px 1fr 36px" : "20px 1fr 40px 100px", gap: 10, alignItems: "center" }}>
                <div className="sans tnum" style={{ color: "var(--ink-3)", fontSize: 13 }}>{i+1}.</div>
                <div className="sans" style={{ color: "var(--ink)", fontSize: 14, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{h.name}</div>
                <div className="sans tnum" style={{ color: "var(--ink-2)", fontSize: 13, textAlign: "right" }}>{h.totalDone}</div>
                {!isMobile && (
                  <div style={{ height: 6, background: "var(--surface-2)", borderRadius: 999, overflow: "hidden" }}>
                    <div style={{ height: "100%", width: `${(h.totalDone / topMax) * 100}%`, background: h.color, borderRadius: 999 }} />
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ---------- DETAIL VIEW ----------

function HabitDetail({ habitId, onBack, isMobile }) {
  const f = useFolio();
  const habit = f.habitMap[habitId];
  const [editing, setEditing] = React.useState(false);
  const todayDate = new Date();
  todayDate.setHours(0,0,0,0);
  const [cursor, setCursor] = React.useState(new Date(todayDate.getFullYear(), todayDate.getMonth(), 1));

  // If the habit was deleted (e.g. from the edit modal), bail back to the list.
  React.useEffect(() => {
    if (!habit) onBack();
  }, [habit, onBack]);
  if (!habit) return null;

  const entries = f.habitEntriesByHabit[habitId] || {};
  const stats = f.habitStats[habitId] || { totalDone: 0, streak: 0, weekDone: 0 };
  const total = stats.totalDone;

  // completion rate: done / expected-so-far
  const created = new Date(habit.created_at); created.setHours(0,0,0,0);
  const daysSince = Math.max(1, Math.floor((todayDate - created) / 86400000) + 1);
  const denom = habit.target_per_week
    ? Math.max(1, Math.ceil(daysSince / 7)) * habit.target_per_week
    : daysSince;
  const completionRate = Math.min(100, Math.round((total / denom) * 100));

  const monthLabel = cursor.toLocaleDateString("en-US", { month: "long", year: "numeric" }).toLowerCase();
  const prev = () => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() - 1, 1));
  const next = () => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1));

  const firstOfMonth = new Date(cursor.getFullYear(), cursor.getMonth(), 1);
  const firstDow = (firstOfMonth.getDay() + 6) % 7;
  const gridStart = addDays(firstOfMonth, -firstDow);
  const cells = Array.from({ length: 42 }, (_, i) => {
    const d = addDays(gridStart, i);
    return { date: d, iso: toISODate(d), inMonth: d.getMonth() === cursor.getMonth() };
  });
  const todayIso = todayISO();

  const headerBg = `color-mix(in srgb, ${habit.color} 82%, #1a0f08)`;

  return (
    <div className="page" style={{ minHeight: "100vh", paddingBottom: 130 }}>
      {/* Saturated header */}
      <div style={{ background: headerBg, padding: isMobile ? "20px 18px 32px" : "28px 40px 44px" }}>
        <div style={{ maxWidth: 1000, margin: "0 auto" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <button onClick={onBack} className="sans" aria-label="back" style={{ background: "transparent", color: "#fff", padding: 6, display: "flex", alignItems: "center", gap: 6 }}>
              <IconArrowLeft size={18} />
            </button>
            <button onClick={() => setEditing(true)} className="sans" aria-label="edit" style={{ background: "transparent", color: "#fff", padding: 6, display: "flex", alignItems: "center" }}>
              <IconPencil size={18} />
            </button>
          </div>
          <h1 className="serif" style={{ fontSize: isMobile ? 36 : 50, margin: "22px 0 28px", color: "#fff", lineHeight: 1.1, wordBreak: "break-word" }}>
            {habit.name}
          </h1>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12 }}>
            <Stat label="times total" value={total} />
            <Stat label={habit.target_per_week ? `of ${habit.target_per_week}/wk this week` : "this week"} value={stats.weekDone} />
            <Stat label="completion rate" value={`${completionRate}%`} />
          </div>
        </div>
      </div>

      {/* Month calendar */}
      <div style={{ maxWidth: 1000, margin: "0 auto", padding: isMobile ? "24px 18px" : "32px 40px" }}>
        <div style={{ background: "var(--surface)", borderRadius: 14, padding: isMobile ? "16px 14px" : "20px 22px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
            <button onClick={prev} className="sans" style={navBtnStyle} aria-label="previous month">‹</button>
            <div className="serif" style={{ fontSize: isMobile ? 18 : 20, color: "var(--ink)" }}>{monthLabel}</div>
            <button onClick={next} className="sans" style={navBtnStyle} aria-label="next month">›</button>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 4, marginBottom: 6 }}>
            {["M","T","W","T","F","S","S"].map((d, i) => (
              <div key={i} className="smallcaps" style={{ textAlign: "center", color: "var(--ink-3)", fontSize: 9 }}>{d}</div>
            ))}
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 4 }}>
            {cells.map((c, i) => {
              const status = entries[c.iso] || null;
              const isFuture = c.iso > todayIso;
              const isToday = c.iso === todayIso;
              const filled = status === 'done';
              const clickable = !isFuture && c.inMonth;
              return (
                <button
                  key={i}
                  disabled={!clickable}
                  onClick={clickable ? () => f.actions.toggleHabitDone(habitId, c.iso) : undefined}
                  title={status === 'done' ? `${c.iso} · done` : c.iso}
                  style={{
                    aspectRatio: "1", borderRadius: 999,
                    background: filled ? habit.color : "transparent",
                    border: c.inMonth ? `1.5px solid ${filled ? habit.color : `color-mix(in srgb, ${habit.color} 30%, transparent)`}` : "1.5px solid transparent",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    color: filled ? "#fff" : c.inMonth ? "var(--ink-2)" : "var(--ink-4)",
                    fontSize: isMobile ? 11 : 12,
                    fontWeight: isToday ? 600 : 400,
                    textDecoration: isToday && !filled ? "underline" : "none",
                    cursor: clickable ? "pointer" : "default",
                    opacity: isFuture && c.inMonth ? 0.35 : 1,
                    padding: 0,
                  }}
                >{c.date.getDate()}</button>
              );
            })}
          </div>
        </div>
      </div>

      <HabitEditorModal habit={habit} open={editing} onClose={() => setEditing(false)} />
    </div>
  );
}

function Stat({ label, value }) {
  return (
    <div style={{ textAlign: "center" }}>
      <div className="serif tnum" style={{ fontSize: 36, color: "#fff", lineHeight: 1 }}>{value}</div>
      <div className="smallcaps" style={{ color: "rgba(255,255,255,0.78)", fontSize: 10, marginTop: 6, letterSpacing: "0.08em" }}>{label}</div>
    </div>
  );
}

// ---------- EDITOR MODAL ----------

function HabitEditorModal({ habit, open, onClose }) {
  const { actions } = useFolio();
  const isMobile = useMediaQuery("(max-width: 640px)");
  const isNew = !habit;
  const [name, setName] = React.useState("");
  const [color, setColor] = React.useState(COLOR_PALETTE[0]);
  const [weeklyMode, setWeeklyMode] = React.useState(false);
  const [target, setTarget] = React.useState(3);
  const [busy, setBusy] = React.useState(false);
  const [err, setErr] = React.useState(null);

  React.useEffect(() => {
    if (!open) return;
    setErr(null); setBusy(false);
    if (habit) {
      setName(habit.name);
      setColor(habit.color);
      setWeeklyMode(!!habit.target_per_week);
      setTarget(habit.target_per_week || 3);
    } else {
      setName("");
      setColor(COLOR_PALETTE[Math.floor(Math.random() * COLOR_PALETTE.length)]);
      setWeeklyMode(false);
      setTarget(3);
    }
  }, [open, habit]);

  if (!open) return null;

  const submit = async (e) => {
    e?.preventDefault();
    if (!name.trim() || busy) return;
    setBusy(true); setErr(null);
    try {
      const target_per_week = weeklyMode ? target : null;
      if (isNew) {
        await actions.addHabit({ name: name.trim(), color, target_per_week });
      } else {
        await actions.updateHabit(habit.id, { name: name.trim(), color, target_per_week });
      }
      onClose();
    } catch (e) {
      setErr(e.message || "couldn't save");
    } finally {
      setBusy(false);
    }
  };

  const onDelete = async () => {
    if (!habit) return;
    if (!confirm("Delete this habit? All tracked days will be removed.")) return;
    setBusy(true);
    await actions.deleteHabit(habit.id);
    setBusy(false);
    onClose();
  };

  return (
    <div onClick={onClose} style={{
      position: "fixed", inset: 0, zIndex: 200,
      background: "rgba(42, 29, 18, 0.55)", backdropFilter: "blur(6px)",
      display: "flex", alignItems: "center", justifyContent: "center", padding: 24,
    }}>
      <div onClick={e => e.stopPropagation()} style={{
        background: "var(--surface)", borderRadius: 18,
        boxShadow: "var(--shadow-card)",
        padding: isMobile ? "26px 20px 24px" : "32px 36px 28px",
        maxWidth: 460, width: "100%",
        maxHeight: "calc(100vh - 48px)", overflowY: "auto",
      }}>
        <div className="serif" style={{ fontSize: 28, color: "var(--ink)", marginBottom: 18, lineHeight: 1.15 }}>
          {isNew ? "new habit" : "edit habit"}
        </div>
        <form onSubmit={submit}>
          <div className="smallcaps" style={{ color: "var(--ink-3)", marginBottom: 6, fontSize: 10 }}>name</div>
          <input
            autoFocus
            value={name}
            onChange={e => setName(e.target.value)}
            maxLength={80}
            placeholder="e.g. meditate"
            style={{
              width: "100%", padding: "12px 14px", borderRadius: 10,
              border: "1px solid rgba(110,90,71,0.25)", background: "var(--surface-2)",
              fontFamily: "'Instrument Serif', serif", fontSize: 18, color: "var(--ink)", outline: "none",
            }}
          />

          <div className="smallcaps" style={{ color: "var(--ink-3)", marginTop: 18, marginBottom: 10, fontSize: 10 }}>color</div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {COLOR_PALETTE.map(c => (
              <button key={c} type="button" onClick={() => setColor(c)} aria-label={`pick ${c}`} style={{
                width: 28, height: 28, borderRadius: 999, background: c,
                border: color === c ? "2px solid var(--ink)" : "2px solid transparent",
                padding: 0, cursor: "pointer",
              }} />
            ))}
          </div>

          <div style={{ marginTop: 20, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div className="smallcaps" style={{ color: "var(--ink-3)", fontSize: 10 }}>frequency</div>
            <label style={{ display: "inline-flex", alignItems: "center", gap: 8, cursor: "pointer" }}>
              <input type="checkbox" checked={weeklyMode} onChange={e => setWeeklyMode(e.target.checked)} />
              <span className="sans" style={{ fontSize: 13, color: "var(--ink-2)" }}>{weeklyMode ? "times per week" : "daily"}</span>
            </label>
          </div>
          {weeklyMode && (
            <div style={{ marginTop: 12, display: "flex", gap: 6, flexWrap: "wrap" }}>
              {[1,2,3,4,5,6,7].map(n => (
                <button key={n} type="button" onClick={() => setTarget(n)} className="sans" style={{
                  width: 36, height: 36, borderRadius: 999,
                  background: target === n ? color : "var(--surface-2)",
                  color: target === n ? "#fff" : "var(--ink-2)",
                  border: "none", cursor: "pointer", fontSize: 13,
                }}>{n}</button>
              ))}
            </div>
          )}

          {err && <div className="sans" style={{ color: "var(--accent)", marginTop: 14, fontSize: 13 }}>{err}</div>}

          <div style={{ marginTop: 24, display: "flex", justifyContent: "space-between", gap: 8, alignItems: "center" }}>
            {!isNew ? (
              <button type="button" onClick={onDelete} disabled={busy} className="smallcaps" style={{ padding: "10px 14px", color: "var(--accent)", fontSize: 11, background: "transparent" }}>
                delete
              </button>
            ) : <span />}
            <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
              <button type="button" onClick={onClose} className="smallcaps" style={{ padding: "10px 16px", color: "var(--ink-3)", fontSize: 11, background: "transparent" }}>cancel</button>
              <button type="submit" disabled={!name.trim() || busy} className="lift sans" style={{
                padding: "10px 24px", borderRadius: 999, background: "var(--accent)", color: "var(--surface)", fontSize: 13,
                boxShadow: "var(--shadow-soft)", opacity: (!name.trim() || busy) ? 0.5 : 1,
              }}>
                {busy ? "saving…" : (isNew ? "create →" : "save")}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
