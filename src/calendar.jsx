import React from 'react';
import { useFolio, todayISO, toISODate, parseISODate, addDays, DAY_MS, fmtHoursLong } from './state.jsx';
import { TasksPanel } from './timer.jsx';
import { useMediaQuery } from './shared.jsx';

/* The Calendar — computed from sessions */

export function Heatmap({ weeks = 26, endDate, sessionsByDate, dailyGoalSec, cellSize = 18, gap = 4, onCellClick, selectedDate }) {
  // build columns of length 7 (M..S), oldest col first
  const end = new Date(endDate);
  end.setHours(0,0,0,0);
  // start is end-of-grid Sunday minus (weeks*7 - 1) days
  // We want last column to include today on its weekday row.
  const endDow = (end.getDay() + 6) % 7; // 0..6 Mon..Sun
  const lastColStart = addDays(end, -endDow); // Mon of week containing end
  const firstColStart = addDays(lastColStart, -(weeks - 1) * 7);

  const columns = [];
  for (let w = 0; w < weeks; w++) {
    const colMon = addDays(firstColStart, w * 7);
    const col = [];
    for (let dow = 0; dow < 7; dow++) {
      const d = addDays(colMon, dow);
      if (d > end) { col.push(null); continue; }
      const iso = toISODate(d);
      const sessions = sessionsByDate[iso] || [];
      const totalSec = sessions.reduce((a, s) => a + s.duration_seconds, 0);
      const ratio = totalSec / Math.max(1, dailyGoalSec);
      // intensity 0..4 buckets: 0 = none, 1 = <25%, 2 = <60%, 3 = <100%, 4 = >=100%
      let i;
      if (totalSec === 0) i = 0;
      else if (ratio < 0.25) i = 1;
      else if (ratio < 0.6)  i = 2;
      else if (ratio < 1.0)  i = 3;
      else i = 4;
      col.push({ date: d, iso, totalSec, intensity: i });
    }
    columns.push(col);
  }

  // Label a column with the new month only when its *dominant* month differs from the
  // previous column's — i.e. when ≥4 of the column's 7 days fall in the new month.
  // (Naive "first day of column" labeling places the new-month label one column too
  // early whenever a month starts mid-week, e.g. Mar starting on a Sunday.)
  const monthLabels = [];
  let lastMonth = -1;
  columns.forEach((c, i) => {
    const counts = {};
    for (const cell of c) {
      if (!cell) continue;
      counts[cell.date.getMonth()] = (counts[cell.date.getMonth()] || 0) + 1;
    }
    let dominant = -1, max = 0;
    for (const m in counts) if (counts[m] > max) { max = counts[m]; dominant = +m; }
    if (dominant !== -1 && dominant !== lastMonth) {
      lastMonth = dominant;
      const sample = c.find(cell => cell && cell.date.getMonth() === dominant);
      monthLabels.push({ x: i, label: sample.date.toLocaleString('en-US', { month: 'short' }).toUpperCase() });
    }
  });

  const rampColors = ["var(--hm-0)", "var(--hm-1)", "var(--hm-2)", "var(--hm-3)", "var(--hm-4)"];

  return (
    <div style={{ display: "inline-block" }}>
      <div style={{
        display: "grid",
        gridTemplateColumns: `${cellSize + 8}px repeat(${columns.length}, ${cellSize + gap}px)`,
        marginBottom: 8, color: "var(--ink-3)",
      }}>
        <div />
        {columns.map((_, i) => {
          const ml = monthLabels.find(m => m.x === i);
          return (
            <div key={i} className="smallcaps" style={{ fontSize: 10, opacity: ml ? 0.9 : 0 }}>
              {ml?.label}
            </div>
          );
        })}
      </div>
      <div style={{
        display: "grid",
        gridTemplateColumns: `${cellSize + 8}px repeat(${columns.length}, ${cellSize + gap}px)`,
        gridTemplateRows: `repeat(7, ${cellSize + gap}px)`,
      }}>
        {Array.from({ length: 7 }).map((_, r) => (
          <React.Fragment key={r}>
            <div className="smallcaps" style={{ fontSize: 9, color: "var(--ink-3)", display: "flex", alignItems: "center", opacity: 0.85 }}>
              {["M","T","W","T","F","S","S"][r]}
            </div>
            {columns.map((c, ci) => {
              const cell = c[r];
              if (!cell) return <div key={ci} />;
              const isSelected = selectedDate && cell.iso === selectedDate;
              return (
                <button key={ci}
                  title={`${cell.date.toDateString()} · ${(cell.totalSec/3600).toFixed(1)}h`}
                  onClick={() => onCellClick && onCellClick(cell.iso)}
                  style={{
                    width: cellSize, height: cellSize,
                    borderRadius: 4,
                    background: rampColors[cell.intensity],
                    boxShadow: cell.intensity === 0
                      ? "inset 0 0 0 1px rgba(110,90,71,0.10)"
                      : "0 1px 2px rgba(70,40,20,0.05)",
                    outline: isSelected ? "1.5px solid var(--accent)" : "none",
                    outlineOffset: 1,
                    cursor: onCellClick ? "pointer" : "default",
                  }} />
              );
            })}
          </React.Fragment>
        ))}
      </div>
    </div>
  );
}

function buildMonthGrid(cursorMonth) {
  const firstOfMonth = new Date(cursorMonth.getFullYear(), cursorMonth.getMonth(), 1);
  const monthIndex = firstOfMonth.getMonth();
  const firstDow = (firstOfMonth.getDay() + 6) % 7; // 0=Mon..6=Sun
  const gridStart = addDays(firstOfMonth, -firstDow);
  const cells = [];
  for (let i = 0; i < 42; i++) {
    const d = addDays(gridStart, i);
    cells.push({ date: d, iso: toISODate(d), inMonth: d.getMonth() === monthIndex });
  }
  return cells;
}

function distinctSubjects(sessions, subjectMap) {
  const seen = new Set();
  const out = [];
  for (const s of sessions) {
    if (seen.has(s.subject_id)) continue;
    seen.add(s.subject_id);
    const sub = subjectMap[s.subject_id];
    out.push({ sid: s.subject_id, color: sub?.color || "var(--ink-3)", name: sub?.name || "(removed)" });
  }
  return out;
}

function MonthDayCell({ cell, sessions, tasks, dDays, subjectMap, isSelected, isToday, onSelect }) {
  const totalSec = sessions.reduce((a, s) => a + s.duration_seconds, 0);
  const subs = distinctSubjects(sessions, subjectMap).slice(0, 5);
  const doneTasks = tasks.filter(t => t.done).length;
  const opacity = cell.inMonth ? 1 : 0.4;
  return (
    <button
      onClick={() => onSelect(cell.iso)}
      style={{
        textAlign: "left",
        padding: "8px 9px",
        background: isToday ? "color-mix(in srgb, var(--accent) 6%, transparent)" : "var(--surface)",
        border: "1px solid rgba(110,90,71,0.10)",
        outline: isSelected ? "1.5px solid var(--accent)" : "none",
        outlineOffset: -2,
        minHeight: 108,
        display: "flex", flexDirection: "column", gap: 6,
        opacity,
        cursor: "pointer",
      }}
      title={`${cell.date.toDateString()} · ${fmtHoursLong(totalSec)}`}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
        <span className="sans tnum" style={{ fontSize: 13, color: "var(--ink)", fontWeight: isToday ? 600 : 400 }}>
          {cell.date.getDate()}
        </span>
        {totalSec > 0 && (
          <span className="sans tnum" style={{ fontSize: 11, color: "var(--ink-3)" }}>
            {fmtHoursLong(totalSec)}
          </span>
        )}
      </div>
      {subs.length > 0 && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
          {subs.map(s => (
            <span key={s.sid} title={s.name} style={{ width: 8, height: 8, borderRadius: 999, background: s.color }} />
          ))}
          {sessions.length > subs.length && (
            <span className="sans" style={{ fontSize: 10, color: "var(--ink-3)", lineHeight: 1 }}>+{sessions.length - subs.length}</span>
          )}
        </div>
      )}
      {dDays.length > 0 && (
        <div className="smallcaps" style={{ fontSize: 9, color: "var(--accent)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
          ◆ {dDays[0].label}{dDays.length > 1 ? ` +${dDays.length - 1}` : ""}
        </div>
      )}
      {tasks.length > 0 && (
        <div className="sans tnum" style={{ fontSize: 10, color: "var(--ink-3)", marginTop: "auto" }}>
          {doneTasks}/{tasks.length} ✓
        </div>
      )}
    </button>
  );
}

function MonthEventsView({ cursorMonth, sessionsByDate, tasksByDate, dDaysByDate, subjectMap, selectedIso, onSelect, todayIso, setCursorMonth }) {
  const cells = buildMonthGrid(cursorMonth);
  const prev = () => setCursorMonth(new Date(cursorMonth.getFullYear(), cursorMonth.getMonth() - 1, 1));
  const next = () => setCursorMonth(new Date(cursorMonth.getFullYear(), cursorMonth.getMonth() + 1, 1));
  const goToday = () => { const t = new Date(); setCursorMonth(new Date(t.getFullYear(), t.getMonth(), 1)); onSelect(todayIso); };

  const monthLabel = cursorMonth.toLocaleString("en-US", { month: "long", year: "numeric" });
  const navBtnStyle = { padding: "4px 10px", borderRadius: 999, color: "var(--ink-2)", fontSize: 14, background: "transparent" };

  return (
    <div style={{ width: "100%", maxWidth: 920 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
          <button onClick={prev} className="sans" aria-label="previous month" style={navBtnStyle}>‹</button>
          <div className="serif" style={{ fontSize: 22, color: "var(--ink)", minWidth: 180, textAlign: "center" }}>{monthLabel}</div>
          <button onClick={next} className="sans" aria-label="next month" style={navBtnStyle}>›</button>
        </div>
        <button onClick={goToday} className="sans" style={{ fontSize: 12, color: "var(--ink-3)", padding: "6px 12px", borderRadius: 999, background: "transparent" }}>today</button>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", marginBottom: 4 }}>
        {["Mon","Tue","Wed","Thu","Fri","Sat","Sun"].map(d => (
          <div key={d} className="smallcaps" style={{ fontSize: 10, color: "var(--ink-3)", padding: "0 9px 6px" }}>{d}</div>
        ))}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)" }}>
        {cells.map(c => {
          const onPick = (iso) => {
            onSelect(iso);
            if (!c.inMonth) setCursorMonth(new Date(c.date.getFullYear(), c.date.getMonth(), 1));
          };
          return (
            <MonthDayCell
              key={c.iso}
              cell={c}
              sessions={sessionsByDate[c.iso] || []}
              tasks={tasksByDate[c.iso] || []}
              dDays={dDaysByDate[c.iso] || []}
              subjectMap={subjectMap}
              isSelected={c.iso === selectedIso}
              isToday={c.iso === todayIso}
              onSelect={onPick}
            />
          );
        })}
      </div>
    </div>
  );
}

function MonthEventsListMobile({ cursorMonth, sessionsByDate, tasksByDate, dDaysByDate, subjectMap, selectedIso, onSelect, todayIso, setCursorMonth }) {
  const firstOfMonth = new Date(cursorMonth.getFullYear(), cursorMonth.getMonth(), 1);
  const monthIndex = cursorMonth.getMonth();
  const days = [];
  let d = firstOfMonth;
  while (d.getMonth() === monthIndex) {
    days.push({ date: new Date(d), iso: toISODate(d) });
    d = addDays(d, 1);
  }
  const prev = () => setCursorMonth(new Date(cursorMonth.getFullYear(), cursorMonth.getMonth() - 1, 1));
  const next = () => setCursorMonth(new Date(cursorMonth.getFullYear(), cursorMonth.getMonth() + 1, 1));
  const goToday = () => { const t = new Date(); setCursorMonth(new Date(t.getFullYear(), t.getMonth(), 1)); onSelect(todayIso); };

  const monthLabel = cursorMonth.toLocaleString("en-US", { month: "long", year: "numeric" });
  return (
    <div style={{ width: "100%" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
          <button onClick={prev} className="sans" aria-label="previous month" style={{ padding: "4px 10px", color: "var(--ink-2)", fontSize: 16, background: "transparent" }}>‹</button>
          <div className="serif" style={{ fontSize: 20, color: "var(--ink)", minWidth: 150, textAlign: "center" }}>{monthLabel}</div>
          <button onClick={next} className="sans" aria-label="next month" style={{ padding: "4px 10px", color: "var(--ink-2)", fontSize: 16, background: "transparent" }}>›</button>
        </div>
        <button onClick={goToday} className="sans" style={{ fontSize: 12, color: "var(--ink-3)", padding: "6px 12px", background: "transparent" }}>today</button>
      </div>
      <div style={{ display: "flex", flexDirection: "column", borderTop: "1px solid rgba(110,90,71,0.10)" }}>
        {days.map(({ date, iso }) => {
          const sessions = sessionsByDate[iso] || [];
          const tasks = tasksByDate[iso] || [];
          const dDays = dDaysByDate[iso] || [];
          const totalSec = sessions.reduce((a, s) => a + s.duration_seconds, 0);
          const subs = distinctSubjects(sessions, subjectMap).slice(0, 5);
          const isSelected = iso === selectedIso;
          const isToday = iso === todayIso;
          const dayName = date.toLocaleDateString("en-US", { weekday: "short" }).toUpperCase();
          const empty = sessions.length === 0 && tasks.length === 0 && dDays.length === 0;
          return (
            <button
              key={iso}
              onClick={() => onSelect(iso)}
              style={{
                textAlign: "left",
                padding: "12px 10px",
                display: "grid",
                gridTemplateColumns: "32px 60px 1fr auto",
                alignItems: "center",
                gap: 10,
                background: isSelected ? "color-mix(in srgb, var(--accent) 10%, transparent)" : "transparent",
                borderBottom: "1px solid rgba(110,90,71,0.10)",
                opacity: empty ? 0.55 : 1,
              }}
            >
              <span className="smallcaps" style={{ fontSize: 10, color: "var(--ink-3)" }}>{dayName}</span>
              <span className="sans tnum" style={{ fontSize: 15, color: "var(--ink)", fontWeight: isToday ? 600 : 400 }}>
                {date.getDate()}
              </span>
              <span style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap", minWidth: 0 }}>
                {subs.map(s => (
                  <span key={s.sid} title={s.name} style={{ width: 8, height: 8, borderRadius: 999, background: s.color }} />
                ))}
                {dDays.length > 0 && (
                  <span className="smallcaps" style={{ fontSize: 10, color: "var(--accent)", marginLeft: 4 }}>
                    ◆ {dDays[0].label}
                  </span>
                )}
                {tasks.length > 0 && (
                  <span className="sans tnum" style={{ fontSize: 10, color: "var(--ink-3)", marginLeft: 4 }}>
                    {tasks.filter(t => t.done).length}/{tasks.length} ✓
                  </span>
                )}
              </span>
              <span className="sans tnum" style={{ fontSize: 13, color: "var(--ink-2)" }}>
                {totalSec > 0 ? fmtHoursLong(totalSec) : "—"}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function DayDetailSessions({ iso, sessions, subjectMap, onDelete, isMobile }) {
  if (sessions.length === 0) {
    return <div className="serif" style={{ color: "var(--ink-3)", fontSize: 18 }}>no sessions on this day.</div>;
  }
  const sorted = sessions.slice().sort((a, b) => new Date(a.started_at) - new Date(b.started_at));
  const fmtTime = (iso) => {
    const d = new Date(iso);
    return d.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: false });
  };
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      {sorted.map(s => {
        const sub = subjectMap[s.subject_id];
        return (
          <div key={s.id} style={{ display: "grid", gridTemplateColumns: isMobile ? "minmax(0, 1fr) auto" : "minmax(140px, 220px) 1fr auto auto", alignItems: "center", gap: isMobile ? "4px 12px" : 16, padding: "8px 0", borderBottom: "1px solid rgba(110,90,71,0.08)" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
              <span style={{ width: 10, height: 10, borderRadius: 999, background: sub?.color || "var(--ink-3)" }} />
              <span className="sans" style={{ fontSize: 15, color: "var(--ink)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                {sub?.name || "(removed)"}
              </span>
            </div>
            <div className="sans tnum" style={{ fontSize: 13, color: "var(--ink-3)", gridColumn: isMobile ? "1 / -1" : undefined, gridRow: isMobile ? 2 : undefined }}>
              {fmtTime(s.started_at)} – {fmtTime(s.ended_at)}
            </div>
            <div className="sans tnum" style={{ fontSize: 14, color: "var(--ink-2)", textAlign: "right" }}>
              {fmtHoursLong(s.duration_seconds)}
            </div>
            <button
              onClick={() => {
                if (window.confirm(`Delete this session?\n${sub?.name || "(removed)"} · ${fmtHoursLong(s.duration_seconds)} · ${fmtTime(s.started_at)}–${fmtTime(s.ended_at)}`)) {
                  onDelete(s.id);
                }
              }}
              aria-label="delete session"
              className="sans"
              style={{ fontSize: 14, color: "var(--ink-3)", padding: "4px 8px", background: "transparent" }}
            >
              ×
            </button>
          </div>
        );
      })}
    </div>
  );
}

export function CalendarView() {
  const f = useFolio();
  const isMobile = useMediaQuery("(max-width: 640px)");
  const isTablet = useMediaQuery("(max-width: 900px)");
  const [selectedIso, setSelectedIso] = React.useState(todayISO());
  const [view, setView] = React.useState("heatmap");
  const [cursorMonth, setCursorMonth] = React.useState(() => {
    const t = new Date();
    return new Date(t.getFullYear(), t.getMonth(), 1);
  });

  const tasksByDate = React.useMemo(() => {
    const map = {};
    for (const t of (f.state.tasks || [])) {
      if (!map[t.task_date]) map[t.task_date] = [];
      map[t.task_date].push(t);
    }
    return map;
  }, [f.state.tasks]);

  const dDaysByDate = React.useMemo(() => {
    const map = {};
    for (const d of (f.state.d_days || [])) {
      if (!map[d.target]) map[d.target] = [];
      map[d.target].push(d);
    }
    return map;
  }, [f.state.d_days]);

  const totalSec = f.totalAllSeconds;
  const best = f.bestDaySeconds;

  const sel = parseISODate(selectedIso);
  const dayLabel = sel.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" }).toLowerCase();
  const daySessions = f.sessionsByDate[selectedIso] || [];
  const breakdown = (() => {
    const map = {};
    for (const s of daySessions) map[s.subject_id] = (map[s.subject_id] || 0) + s.duration_seconds;
    // include live if today
    if (selectedIso === todayISO() && f.state.current) {
      map[f.state.current.subject_id] = (map[f.state.current.subject_id] || 0) + f.liveSeconds;
    }
    const arr = Object.entries(map).map(([sid, sec]) => ({ sid, sec, subject: f.subjectMap[sid] }));
    arr.sort((a, b) => b.sec - a.sec);
    return arr;
  })();
  const dayTotal = breakdown.reduce((a, x) => a + x.sec, 0);
  const maxSubSec = breakdown[0]?.sec || 1;

  const today = new Date();
  const weekNum = (() => {
    const start = new Date(today.getFullYear(), 0, 1);
    const days = Math.floor((today - start) / DAY_MS);
    return Math.ceil((days + start.getDay() + 1) / 7);
  })();

  return (
    <div className="page" style={{ maxWidth: 1280, margin: "0 auto", padding: isMobile ? "42px 18px 130px" : isTablet ? "56px 28px 150px" : "72px 48px 180px" }}>
      <div className="stagger" style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
        <div style={{ textAlign: "center", marginBottom: 6 }}>
          <h1 className="serif" style={{ fontSize: isMobile ? 44 : 56, lineHeight: 1, margin: 0, color: "var(--ink)", whiteSpace: "nowrap" }}>the calendar</h1>
          <div style={{ width: 5, height: 5, borderRadius: 999, background: "var(--accent)", margin: "12px auto 0" }} />
          <div className="smallcaps" style={{ color: "var(--ink-3)", marginTop: 14 }}>
            Week {weekNum} · {today.toLocaleString('en-US', { month: 'long', year: 'numeric' })}
          </div>
        </div>

        <div style={{
          display: "grid",
          gridTemplateColumns: isMobile ? "1fr 1fr" : "repeat(auto-fit, minmax(160px, 1fr))",
          justifyContent: "center",
          marginTop: isMobile ? 34 : 44,
          marginBottom: isMobile ? 36 : 48,
          width: "100%",
          maxWidth: 1040,
          rowGap: isMobile ? 24 : 28,
        }}>
          {(() => {
            const cards = [
              { label: "Total Hours",    value: fmtHoursLong(totalSec) },
              { label: "Current Streak", value: `${f.streak} ${f.streak === 1 ? "day" : "days"}` },
              { label: "Best Day",       value: fmtHoursLong(best) },
              { label: "Best Week",      value: fmtHoursLong(f.bestWeekSeconds) },
              { label: "Best Month",     value: fmtHoursLong(f.bestMonthSeconds) },
            ];
            return cards.map((s, i) => (
              <div key={s.label} style={{
                textAlign: "center",
                borderRight: !isMobile && i < cards.length - 1 ? "1px solid rgba(110,90,71,0.18)" : "none",
                padding: "0 12px",
                gridColumn: isMobile && i === cards.length - 1 ? "1 / -1" : undefined,
              }}>
                <div className="smallcaps" style={{ color: "var(--ink-3)", marginBottom: 10, fontSize: 10 }}>{s.label}</div>
                <div style={{ fontFamily: "'Instrument Serif', serif", fontStyle: "italic", fontSize: isMobile ? 28 : 34, fontWeight: 400, color: "var(--ink)", lineHeight: 1.1 }}>
                  {s.value}
                </div>
              </div>
            ));
          })()}
        </div>

        <div style={{ width: "100%", maxWidth: 920, display: "flex", justifyContent: "flex-end", marginBottom: 14 }}>
          <div style={{ display: "inline-flex", borderRadius: 999, background: "var(--surface)", boxShadow: "var(--shadow-soft)", padding: 3 }}>
            {["heatmap", "month"].map(v => (
              <button
                key={v}
                onClick={() => setView(v)}
                className="sans"
                style={{
                  padding: "6px 14px", borderRadius: 999, fontSize: 12,
                  background: view === v ? "var(--accent)" : "transparent",
                  color: view === v ? "var(--surface)" : "var(--ink-2)",
                  transition: "background 200ms",
                }}
              >
                {v}
              </button>
            ))}
          </div>
        </div>

        {view === "heatmap" ? (
          <div style={{ width: "100%", display: "flex", justifyContent: isMobile ? "flex-start" : "center", overflowX: "auto", marginBottom: isMobile ? 42 : 56, paddingBottom: 6 }}>
            <div style={{ display: "flex", flexDirection: "column" }}>
              <Heatmap
                weeks={isMobile ? 26 : 52}
                endDate={new Date()}
                sessionsByDate={f.sessionsByDate}
                dailyGoalSec={f.state.goals.daily_seconds}
                cellSize={isMobile ? 13 : 16}
                gap={isMobile ? 3 : 3}
                onCellClick={setSelectedIso}
                selectedDate={selectedIso}
              />
              <div style={{ display: "flex", justifyContent: "flex-end", gap: 6, alignItems: "center", color: "var(--ink-3)", marginTop: 10 }}>
                <span className="sans" style={{ fontSize: 13 }}>less</span>
                {["var(--hm-0)","var(--hm-1)","var(--hm-2)","var(--hm-3)","var(--hm-4)"].map((c,i)=>(
                  <span key={i} style={{ width: 12, height: 12, background: c, borderRadius: 3, boxShadow: i===0?"inset 0 0 0 1px rgba(110,90,71,0.15)":"none" }}/>
                ))}
                <span className="sans" style={{ fontSize: 13 }}>more</span>
              </div>
            </div>
          </div>
        ) : (
          <div style={{ width: "100%", display: "flex", justifyContent: "center", marginBottom: isMobile ? 42 : 56 }}>
            {isMobile ? (
              <MonthEventsListMobile
                cursorMonth={cursorMonth}
                setCursorMonth={setCursorMonth}
                sessionsByDate={f.sessionsByDate}
                tasksByDate={tasksByDate}
                dDaysByDate={dDaysByDate}
                subjectMap={f.subjectMap}
                selectedIso={selectedIso}
                onSelect={setSelectedIso}
                todayIso={todayISO()}
              />
            ) : (
              <MonthEventsView
                cursorMonth={cursorMonth}
                setCursorMonth={setCursorMonth}
                sessionsByDate={f.sessionsByDate}
                tasksByDate={tasksByDate}
                dDaysByDate={dDaysByDate}
                subjectMap={f.subjectMap}
                selectedIso={selectedIso}
                onSelect={setSelectedIso}
                todayIso={todayISO()}
              />
            )}
          </div>
        )}

        <div style={{ width: "100%", maxWidth: 880 }}>
          <div className="smallcaps" style={{ color: "var(--accent)", marginBottom: 10 }}>
            {selectedIso === todayISO() ? "Today’s detail" : "Day detail"}
          </div>
          <div style={{ display: "flex", alignItems: isMobile ? "flex-start" : "baseline", justifyContent: "space-between", gap: 14, marginBottom: 28, flexDirection: isMobile ? "column" : "row" }}>
            <div className="serif" style={{ fontSize: isMobile ? 26 : 30, color: "var(--ink)" }}>{dayLabel}</div>
            <div className="sans tnum" style={{ color: "var(--ink-2)", fontSize: 16 }}>
              {fmtHoursLong(dayTotal)}
            </div>
          </div>

          {view === "month" ? (
            <DayDetailSessions
              iso={selectedIso}
              sessions={daySessions}
              subjectMap={f.subjectMap}
              onDelete={(id) => f.actions.deleteSession(id)}
              isMobile={isMobile}
            />
          ) : breakdown.length === 0 ? (
            <div className="serif" style={{ color: "var(--ink-3)", fontSize: 18 }}>no sessions on this day.</div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 22 }}>
              {breakdown.map(b => (
                <div key={b.sid} style={{ display: "grid", gridTemplateColumns: isMobile ? "minmax(0, 1fr) 64px" : "minmax(120px, 200px) 1fr 60px", alignItems: "center", gap: isMobile ? "8px 12px" : 16 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
                    <span style={{ width: 10, height: 10, borderRadius: 999, background: b.subject?.color || "var(--ink-3)" }} />
                    <span className="sans" style={{ fontSize: 15, color: "var(--ink)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                      {b.subject?.name || "(removed)"}
                    </span>
                  </div>
                  <div style={{ position: "relative", height: 2, borderRadius: 2, background: "rgba(110,90,71,0.15)", gridColumn: isMobile ? "1 / -1" : undefined, gridRow: isMobile ? 2 : undefined }}>
                    <div style={{ position: "absolute", inset: 0, width: `${(b.sec/maxSubSec)*100}%`, background: "var(--accent)", borderRadius: 2 }} />
                  </div>
                  <div className="sans tnum" style={{ fontSize: 14, color: "var(--ink-2)", textAlign: "right" }}>
                    {fmtHoursLong(b.sec)}
                  </div>
                </div>
              ))}
            </div>
          )}

          <div style={{ marginTop: 44 }}>
            <div className="smallcaps" style={{ color: "var(--accent)", marginBottom: 14 }}>Tasks</div>
            <TasksPanel date={selectedIso} card={false} />
          </div>

          {(() => {
            const rows = Object.entries(f.totalSecondsBySubject)
              .map(([sid, sec]) => ({ sid, sec, subject: f.subjectMap[sid] }))
              .filter(x => x.sec > 0 && x.subject)
              .sort((a, b) => b.sec - a.sec);
            if (rows.length === 0) return null;
            const maxSec = rows[0].sec;
            return (
              <div style={{ marginTop: 56 }}>
                <div className="smallcaps" style={{ color: "var(--accent)", marginBottom: 18 }}>all-time subjects</div>
                <div style={{ display: "flex", flexDirection: "column", gap: 22 }}>
                  {rows.map(b => (
                    <div key={b.sid} style={{ display: "grid", gridTemplateColumns: isMobile ? "minmax(0, 1fr) 78px" : "minmax(120px, 200px) 1fr 80px", alignItems: "center", gap: isMobile ? "8px 12px" : 16 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
                        <span style={{ width: 10, height: 10, borderRadius: 999, background: b.subject?.color || "var(--ink-3)" }} />
                        <span className="sans" style={{ fontSize: 15, color: "var(--ink)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                          {b.subject?.name || "(removed)"}
                        </span>
                      </div>
                      <div style={{ position: "relative", height: 2, borderRadius: 2, background: "rgba(110,90,71,0.15)", gridColumn: isMobile ? "1 / -1" : undefined, gridRow: isMobile ? 2 : undefined }}>
                        <div style={{ position: "absolute", inset: 0, width: `${(b.sec / maxSec) * 100}%`, background: "var(--accent)", borderRadius: 2 }} />
                      </div>
                      <div className="sans tnum" style={{ fontSize: 14, color: "var(--ink-2)", textAlign: "right" }}>
                        {fmtHoursLong(b.sec)}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })()}
        </div>
      </div>
    </div>
  );
}
