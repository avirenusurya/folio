import React from 'react';
import { useFolio, fmtHMS, fmtHoursLong, todayISO, daysBetween } from './state.jsx';
import { HandUnderline, IconCap, IconBook, IconDoc, useMediaQuery } from './shared.jsx';

/* Home / Timer view — live from store */

function DDayPill({ d, onClick }) {
  const daysLeft = daysBetween(todayISO(), d.target);
  const isToday = daysLeft === 0;
  const urgent = daysLeft < 7 && daysLeft > 0;
  const Icon = d.icon === "cap" ? IconCap : d.icon === "book" ? IconBook : IconDoc;
  return (
    <button
      onClick={onClick}
      className={"lift" + (isToday ? " dday-flash" : "")}
      style={{
        display: "flex", alignItems: "center", gap: 10,
        padding: "10px 16px 10px 12px",
        background: "var(--surface)", borderRadius: 999,
        boxShadow: "var(--shadow-soft)",
        color: (urgent || isToday) ? "var(--accent)" : "var(--ink)",
      }}
    >
      <span style={{
        width: 26, height: 26, borderRadius: 999,
        background: (urgent || isToday) ? "rgba(184,92,60,0.10)" : "rgba(110,90,71,0.07)",
        display: "flex", alignItems: "center", justifyContent: "center",
        color: (urgent || isToday) ? "var(--accent)" : "var(--ink-2)",
      }}>
        <Icon size={14} />
      </span>
      <span className="sans" style={{ fontSize: 14, fontWeight: 400, whiteSpace: "nowrap" }}>{d.label}</span>
      <span style={{ color: (urgent || isToday) ? "var(--accent)" : "var(--ink-3)", fontSize: 13 }}>·</span>
      <span className="sans tnum" style={{ fontSize: 14, fontWeight: 400, whiteSpace: "nowrap" }}>
        {isToday ? "today" : `d − ${daysLeft}`}
      </span>
    </button>
  );
}

export function TasksPanel({ date, card = true, style }) {
  const f = useFolio();
  const tasks = (f.state.tasks || []).filter(t => t.task_date === date);
  const sorted = [...tasks].sort((a, b) => {
    if (a.done !== b.done) return a.done ? 1 : -1;
    return new Date(a.created_at) - new Date(b.created_at);
  });

  const [text, setText] = React.useState('');
  const [pickedSubject, setPickedSubject] = React.useState(null);
  const [pickerOpen, setPickerOpen] = React.useState(false);
  const [hoveredId, setHoveredId] = React.useState(null);
  const addRowRef = React.useRef(null);

  React.useEffect(() => {
    if (!pickerOpen) return;
    const onDown = (e) => {
      if (!addRowRef.current?.contains(e.target)) setPickerOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [pickerOpen]);

  const submit = () => {
    const title = text.trim();
    if (!title) return;
    f.actions.addTask({ task_date: date, title, subject_id: pickedSubject });
    setText('');
  };

  const picked = pickedSubject ? f.subjectMap[pickedSubject] : null;

  const inner = (
    <>
      {card && <div className="smallcaps" style={{ color: "var(--accent)", marginBottom: 10 }}>Today</div>}

      {sorted.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 6, maxHeight: card ? 220 : 320, overflowY: "auto" }}>
          {sorted.map(t => {
            const subj = f.subjectMap[t.subject_id];
            const hovering = hoveredId === t.id;
            return (
              <div
                key={t.id}
                onMouseEnter={() => setHoveredId(t.id)}
                onMouseLeave={() => setHoveredId(null)}
                style={{ display: "flex", alignItems: "center", gap: 10, minHeight: 24 }}
              >
                <button
                  onClick={() => f.actions.toggleTask(t.id)}
                  aria-label={t.done ? "mark undone" : "mark done"}
                  style={{
                    width: 14, height: 14, borderRadius: 999,
                    border: t.done ? "none" : "1.5px solid var(--ink-3)",
                    background: t.done ? "var(--accent)" : "transparent",
                    flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center",
                  }}
                >
                  {t.done && (
                    <svg width="8" height="8" viewBox="0 0 8 8" fill="none">
                      <path d="M1.5 4.5 L3 6 L6.5 2" stroke="var(--surface)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  )}
                </button>
                {subj && (
                  <span style={{ width: 6, height: 6, borderRadius: 999, background: subj.color, flexShrink: 0 }} />
                )}
                <span className="sans" style={{
                  fontSize: card ? 13.5 : 14.5, color: t.done ? "var(--ink-3)" : "var(--ink)",
                  textDecoration: t.done ? "line-through" : "none",
                  flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                }}>{t.title}</span>
                {hovering && (
                  <button
                    onClick={() => f.actions.deleteTask(t.id)}
                    aria-label="delete task"
                    style={{ color: "var(--ink-3)", fontSize: 16, lineHeight: 1, padding: "0 4px" }}
                  >×</button>
                )}
              </div>
            );
          })}
        </div>
      )}

      <div
        ref={addRowRef}
        style={{
          marginTop: sorted.length ? 10 : 0,
          paddingTop: sorted.length ? 10 : 0,
          borderTop: sorted.length ? "1px dashed rgba(110,90,71,0.18)" : "none",
          display: "flex", alignItems: "center", gap: 10, position: "relative",
        }}
      >
        <button
          onClick={() => setPickerOpen(o => !o)}
          aria-label="pick subject"
          style={{
            width: 14, height: 14, borderRadius: 999,
            border: picked ? "none" : "1.5px dashed var(--ink-3)",
            background: picked ? picked.color : "transparent",
            flexShrink: 0,
          }}
        />
        <input
          value={text}
          onChange={e => setText(e.target.value)}
          onKeyDown={e => { if (e.key === "Enter") submit(); }}
          placeholder="add a task"
          maxLength={200}
          className="sans"
          style={{
            border: "none", background: "transparent", outline: "none",
            color: "var(--ink)", fontSize: card ? 13.5 : 14.5, flex: 1, padding: "4px 0", minWidth: 0,
          }}
        />

        {pickerOpen && (
          <div style={{
            position: "absolute", left: 0, top: "100%", marginTop: 6, zIndex: 10,
            background: "var(--surface)", borderRadius: 10, boxShadow: "var(--shadow-tilt)",
            padding: "8px 10px", display: "flex", flexDirection: "column", gap: 6, minWidth: 160,
            maxHeight: 220, overflowY: "auto",
          }}>
            <button
              onClick={() => { setPickedSubject(null); setPickerOpen(false); }}
              style={{ display: "flex", alignItems: "center", gap: 8, padding: "2px 0", textAlign: "left" }}
            >
              <span style={{ width: 10, height: 10, borderRadius: 999, border: "1.5px dashed var(--ink-3)", flexShrink: 0 }} />
              <span className="sans" style={{ fontSize: 12.5, color: "var(--ink-2)" }}>no subject</span>
            </button>
            {f.subjectsActive.map(s => (
              <button
                key={s.id}
                onClick={() => { setPickedSubject(s.id); setPickerOpen(false); }}
                style={{ display: "flex", alignItems: "center", gap: 8, padding: "2px 0", textAlign: "left" }}
              >
                <span style={{ width: 10, height: 10, borderRadius: 999, background: s.color, flexShrink: 0 }} />
                <span className="sans" style={{ fontSize: 12.5, color: "var(--ink)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{s.name}</span>
              </button>
            ))}
          </div>
        )}
      </div>
    </>
  );

  if (!card) return <div style={style}>{inner}</div>;

  return (
    <div style={{
      width: 240,
      padding: "14px 16px 12px",
      background: "var(--surface)",
      borderRadius: 14,
      boxShadow: "var(--shadow-soft)",
      ...style,
    }}>
      {inner}
    </div>
  );
}

function TodaysNote({ text, onClick, style }) {
  return (
    <button onClick={onClick} className="lift" style={{
      background: "var(--surface)", borderRadius: 14, boxShadow: "var(--shadow-tilt)",
      padding: "18px 22px 20px", transform: "rotate(0.6deg)", width: 280,
      textAlign: "left", display: "block",
      ...style,
    }}>
      <div className="smallcaps" style={{ color: "var(--accent)", marginBottom: 8 }}>Today’s Note</div>
      <div className="serif" style={{
        fontSize: 19, lineHeight: 1.45, color: "var(--ink)",
        overflowWrap: "anywhere", wordBreak: "break-word",
      }}>
        {text}
      </div>
    </button>
  );
}

function DailyGoalBar({ doneSec, goalSec }) {
  const pct = Math.min(1, doneSec / Math.max(1, goalSec));
  return (
    <div style={{ width: 380, maxWidth: "90vw" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 10, gap: 12 }}>
        <span className="smallcaps" style={{ color: "var(--ink-3)", whiteSpace: "nowrap" }}>Daily Goal</span>
        <span className="sans tnum" style={{ fontSize: 13, color: "var(--ink-2)", whiteSpace: "nowrap" }}>
          {fmtHoursLong(doneSec)} / {fmtHoursLong(goalSec)} · {Math.round(pct * 100)}%
        </span>
      </div>
      <div style={{ position: "relative", height: 2, borderRadius: 2, background: "rgba(110,90,71,0.18)" }}>
        <div style={{
          position: "absolute", left: 0, top: 0, bottom: 0, width: `${pct * 100}%`,
          background: "var(--accent)", borderRadius: 2,
          transition: "width 700ms cubic-bezier(0.22, 1, 0.36, 1)",
        }} />
        {pct > 0 && (
          <div style={{
            position: "absolute", left: `calc(${pct * 100}% - 4px)`, top: "50%",
            width: 8, height: 8, borderRadius: 999, background: "var(--accent)",
            transform: "translateY(-50%)", boxShadow: "0 0 0 4px rgba(184,92,60,0.16)",
          }} />
        )}
      </div>
    </div>
  );
}

function SubjectIndicator({ s, todaySec, active, onClick }) {
  const short = s.name.split(/\s+/)[0];
  return (
    <button onClick={onClick} style={{ display: "flex", alignItems: "center", gap: 12, padding: "6px 4px" }}>
      <span className={active ? "ring-pulse" : ""} style={{
        width: 22, height: 22, borderRadius: 999, background: s.color,
        transform: active ? "scale(1.15)" : "scale(1)",
        transition: "transform 250ms cubic-bezier(0.22, 1, 0.36, 1)",
        border: active ? "2px solid var(--surface)" : "none",
        boxShadow: active ? "0 0 0 1.5px var(--accent)" : "none",
      }} />
      <span className="sans" style={{
        fontSize: 16, color: active ? "var(--ink)" : "var(--ink-2)",
        fontWeight: active ? 500 : 400, whiteSpace: "nowrap",
      }}>{short}</span>
      <span className="sans tnum" style={{
        fontSize: 15, color: active ? "var(--ink-2)" : "var(--ink-3)",
        marginLeft: 2, whiteSpace: "nowrap",
      }}>{fmtHoursLong(todaySec)}</span>
    </button>
  );
}

function TimerControls({ state, onPause, onResume, onEnd, onStart }) {
  const isMobile = useMediaQuery("(max-width: 560px)");
  const Pill = ({ kind, children, onClick }) => (
    <button onClick={onClick} className="lift" style={{
      padding: isMobile ? "13px 24px" : "14px 38px", borderRadius: 999,
      background: kind === "primary" ? "var(--accent)" : "var(--surface)",
      color: kind === "primary" ? "var(--surface)" : "var(--ink)",
      boxShadow: "var(--shadow-soft)",
      fontSize: 16, fontWeight: 400, letterSpacing: "0.01em",
      transition: "background 250ms",
      minWidth: isMobile ? 0 : "auto",
    }}
      onMouseOver={(e)=>{ if(kind==='primary') e.currentTarget.style.background = "var(--accent-deep)"; }}
      onMouseOut={(e)=>{ if(kind==='primary') e.currentTarget.style.background = "var(--accent)"; }}
    >{children}</button>
  );
  if (state === "idle")    return <Pill kind="primary" onClick={onStart}>start</Pill>;
  if (state === "paused")  return <div style={{ display: "flex", gap: 12, flexWrap: "wrap", justifyContent: "center" }}><Pill kind="primary" onClick={onResume}>resume</Pill><Pill onClick={onEnd}>end session</Pill></div>;
  return <div style={{ display: "flex", gap: 12, flexWrap: "wrap", justifyContent: "center" }}><Pill onClick={onPause}>pause</Pill><Pill kind="primary" onClick={onEnd}>end session</Pill></div>;
}

export function TimerView({ page, setPage }) {
  const f = useFolio();
  const isCompact = useMediaQuery("(max-width: 1020px)");
  const isMobile = useMediaQuery("(max-width: 560px)");
  const cur = f.state.current;
  const running = cur && !cur.paused;
  const paused = cur && cur.paused;
  const state = running ? "running" : paused ? "paused" : "idle";

  const activeId = cur ? cur.subject_id : f.state.last_active_subject;
  const sub = f.subjectMap[activeId] || f.subjectsActive[0];

  // displayed seconds: when running/paused -> live current; when idle -> 0
  const displaySec = cur ? f.liveSeconds : 0;
  const [h, m, s] = fmtHMS(displaySec);

  // tab title
  React.useEffect(() => {
    if (running && sub) {
      const [hh, mm] = fmtHMS(displaySec);
      document.title = `⏱ ${hh}:${mm} · ${sub.name.split(/\s+/)[0]}`;
    } else { document.title = "Folio"; }
  }, [running, sub?.id, displaySec]);

  // keyboard shortcuts
  React.useEffect(() => {
    const onKey = (e) => {
      if (e.target && (e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA")) return;
      if (e.code === "Space") {
        e.preventDefault();
        if (!cur) f.actions.startSession();
        else if (cur.paused) f.actions.resumeSession();
        else f.actions.pauseSession();
      } else if (e.key === "Escape") {
        if (cur) f.actions.endSession();
      } else if (e.key.toLowerCase() === "j") {
        setPage("journal");
      } else if (/^[1-9]$/.test(e.key)) {
        const idx = parseInt(e.key, 10) - 1;
        const target = f.subjectsActive[idx];
        if (target) f.actions.setActiveSubject(target.id);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [cur, f.subjectsActive, setPage]);

  const goalSec = f.state.goals.daily_seconds;
  const doneSec = f.todayTotalSeconds;

  const onStart = () => f.actions.startSession();

  const visible = f.subjectsActive.slice(0, 5);

  // pull today's note from today's journal — collapse whitespace, cap length
  const journalToday = f.state.journal[todayISO()];
  const noteText = (() => {
    if (journalToday && journalToday.trim()) {
      const cleaned = journalToday.trim().replace(/\s+/g, ' ');
      return cleaned.length > 110 ? cleaned.slice(0, 110).trim() + '…' : cleaned;
    }
    return <span style={{whiteSpace: "pre-line"}}>{"a quiet practice. begin\nwhen you're ready — the page\nwill remember the rest."}</span>;
  })();

  // friendly date
  const today = new Date();
  const dateStr = today.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" }).toLowerCase();

  const topWidgets = (
    <div className="stagger" style={{
      display: "flex",
      flexDirection: isMobile ? "column" : "row",
      alignItems: isMobile ? "stretch" : "flex-start",
      justifyContent: "center",
      gap: 12,
      width: "100%",
      maxWidth: 760,
      margin: isCompact ? "0 auto 34px" : 0,
      padding: isCompact ? "0 18px" : 0,
    }}>
      <div style={{ display: "flex", flexDirection: "column", gap: 12, flex: isMobile ? "1 1 auto" : "0 1 280px", minWidth: 0 }}>
        {f.state.d_days.filter(d => daysBetween(todayISO(), d.target) >= 0).slice(0, 3).map(d => <DDayPill key={d.id} d={d} />)}
        <TasksPanel date={todayISO()} style={{ width: "100%" }} />
      </div>
      <TodaysNote
        text={noteText}
        onClick={() => setPage("journal")}
        style={{ width: isMobile ? "100%" : 280, transform: isMobile ? "none" : "rotate(0.6deg)" }}
      />
    </div>
  );

  return (
    <div className="page" style={{ position: "relative", minHeight: "100vh" }}>
      {!isCompact && (
        <>
          <div className="stagger" style={{
            position: "absolute", top: 36, left: 40,
            display: "flex", flexDirection: "column", gap: 12, zIndex: 5,
          }}>
            {f.state.d_days.filter(d => daysBetween(todayISO(), d.target) >= 0).slice(0, 3).map(d => <DDayPill key={d.id} d={d} />)}
            <TasksPanel date={todayISO()} />
          </div>

          <div style={{ position: "absolute", top: 40, right: 56, zIndex: 5 }}>
            <TodaysNote text={noteText} onClick={() => setPage("journal")} />
          </div>
        </>
      )}

      <div style={{
        minHeight: "100vh",
        display: "flex", flexDirection: "column",
        alignItems: "center", justifyContent: "flex-start",
        padding: isCompact
          ? isMobile ? "28px 0 128px" : "42px 0 150px"
          : "clamp(120px, 18vh, 200px) 24px 220px",
        position: "relative", zIndex: 2,
      }}>
        {isCompact && topWidgets}
        <div className="stagger" style={{ display: "flex", flexDirection: "column", alignItems: "center", width: "100%" }}>
          <div className="serif" style={{ fontSize: isMobile ? 18 : 22, color: "var(--ink-3)", letterSpacing: "0.01em", marginBottom: isMobile ? 14 : 18, whiteSpace: "nowrap" }}>
            — {dateStr} —
          </div>

          <div className="sans tnum" style={{
            fontSize: isMobile ? "clamp(3.2rem, 20vw, 5.2rem)" : "clamp(4rem, 12vw, 10.5rem)", fontWeight: 200,
            lineHeight: 1, color: "var(--ink)",
            display: "flex", alignItems: "center", gap: "0.04em",
            marginBottom: 12, whiteSpace: "nowrap",
          }}>
            <span>{h}</span>
            <span className={running ? "colon-breathe" : ""} style={{ opacity: running ? undefined : 0.22 }}>:</span>
            <span>{m}</span>
            <span className={running ? "colon-breathe" : ""} style={{ opacity: running ? undefined : 0.22, animationDelay: "0.4s" }}>:</span>
            <span>{s}</span>
          </div>

          {sub && (
            <div style={{ display: "inline-flex", flexDirection: "column", alignItems: "stretch", marginTop: 4, marginBottom: isMobile ? 34 : 56, paddingInline: 24, maxWidth: "100%" }}>
              <span className="serif" style={{ fontSize: isMobile ? "1.45rem" : "1.7rem", color: "var(--ink)", lineHeight: 1.1, whiteSpace: "nowrap", textAlign: "center", overflow: "hidden", textOverflow: "ellipsis" }}>
                {sub.name}
              </span>
              <div style={{ marginTop: 6 }}><HandUnderline scale width={320} color={sub.color} /></div>
            </div>
          )}

          <div style={{ marginBottom: isMobile ? 28 : 38, width: "100%", display: "flex", justifyContent: "center", paddingInline: 18 }}><DailyGoalBar doneSec={doneSec} goalSec={goalSec} /></div>

          <div style={{ display: "flex", gap: isMobile ? "12px 22px" : 56, marginBottom: isMobile ? 38 : 56, flexWrap: "wrap", justifyContent: "center", paddingInline: 16 }}>
            {visible.map(s => (
              <SubjectIndicator
                key={s.id}
                s={s}
                todaySec={f.todaySecondsBySubject[s.id] || 0}
                active={s.id === (cur ? cur.subject_id : f.state.last_active_subject)}
                onClick={() => f.actions.setActiveSubject(s.id)}
              />
            ))}
          </div>

          <TimerControls
            state={state}
            onPause={f.actions.pauseSession}
            onResume={f.actions.resumeSession}
            onEnd={f.actions.endSession}
            onStart={onStart}
          />

          {/* hint row */}
          <div className="smallcaps" style={{ color: "var(--ink-4)", marginTop: 32, fontSize: 10, textAlign: "center", paddingInline: 18, lineHeight: 1.7 }}>
            space pause · esc end · 1–9 switch · j journal
          </div>
        </div>
      </div>
    </div>
  );
}
