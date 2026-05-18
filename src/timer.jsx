import React from 'react';
import { useFolio, fmtHMS, fmtHoursLong, todayISO, daysBetween, addDays, toISODate } from './state.jsx';
import { HandUnderline, IconCap, IconBook, IconDoc, useMediaQuery, COLOR_PALETTE } from './shared.jsx';
import { Slider, Toggle } from './settings.jsx';

/* Home / Timer view — live from store */

function PencilIcon({ size = 12 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M11.5 2.5 L13.5 4.5 L5 13 L2.5 13.5 L3 11 Z" />
      <path d="M10.5 3.5 L12.5 5.5" />
    </svg>
  );
}

function DDayPill({ d }) {
  const isTouch = useMediaQuery("(hover: none)");
  const [hovered, setHovered] = React.useState(false);
  const [open, setOpen] = React.useState(false);
  const rootRef = React.useRef(null);

  const close = () => { setOpen(false); setHovered(false); };

  React.useEffect(() => {
    if (!open) return;
    const onDown = (e) => {
      if (!rootRef.current?.contains(e.target)) close();
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  const daysLeft = daysBetween(todayISO(), d.target);
  const isToday = daysLeft === 0;
  const urgent = daysLeft < 7 && daysLeft > 0;
  const Icon = d.icon === "cap" ? IconCap : d.icon === "book" ? IconBook : IconDoc;
  const showPencil = isTouch || hovered || open;

  return (
    <div
      ref={rootRef}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        position: "relative",
        alignSelf: "flex-start",
        display: "inline-flex",
        zIndex: open ? 20 : "auto",
      }}
    >
      <div
        className={"lift" + (isToday ? " dday-flash" : "")}
        style={{
          display: "flex", alignItems: "center", gap: 10,
          padding: "10px 38px 10px 12px",
          background: "var(--surface)", borderRadius: 999,
          boxShadow: "var(--shadow-soft)",
          color: (urgent || isToday) ? "var(--accent)" : "var(--ink)",
        }}
      >
        <span style={{
          width: 26, height: 26, borderRadius: 999,
          background: (urgent || isToday) ? "color-mix(in srgb, var(--accent) 10%, transparent)" : "rgba(110,90,71,0.07)",
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
      </div>

      <button
        onClick={(e) => { e.stopPropagation(); setOpen(o => !o); }}
        aria-label="edit d-day"
        aria-haspopup="dialog"
        aria-expanded={open}
        style={{
          position: "absolute",
          right: 6, top: "50%", transform: "translateY(-50%)",
          width: 24, height: 24, borderRadius: 999,
          background: "var(--surface)",
          color: "var(--ink-3)",
          display: "flex", alignItems: "center", justifyContent: "center",
          boxShadow: showPencil ? "0 0 0 1px rgba(110,90,71,0.12)" : "none",
          opacity: showPencil ? 1 : 0,
          transition: "opacity 150ms",
          pointerEvents: showPencil ? "auto" : "none",
        }}
      >
        <PencilIcon size={12} />
      </button>

      {open && (
        <div style={{
          position: "absolute", left: 0, top: "100%", marginTop: 8,
          background: "var(--surface)", borderRadius: 12, boxShadow: "var(--shadow-tilt)",
          padding: 12,
          width: 260, maxWidth: "calc(100vw - 32px)",
          display: "flex", flexDirection: "column", gap: 10,
        }}>
          <DDayForm dday={d} onClose={close} />
        </div>
      )}
    </div>
  );
}

function DDayForm({ dday, onClose }) {
  const f = useFolio();
  const isNew = !dday;
  const today = todayISO();
  const defaultTarget = () => toISODate(addDays(new Date(), 30));
  const [label, setLabel] = React.useState(dday?.label || '');
  const [target, setTarget] = React.useState(dday?.target || defaultTarget());
  const [icon, setIcon] = React.useState(dday?.icon || "cap");
  const [err, setErr] = React.useState('');

  const submit = async () => {
    const trimmed = label.trim();
    if (!trimmed) { setErr("give it a label."); return; }
    if (target < today) { setErr("target must be today or later."); return; }
    if (isNew) await f.actions.addDDay({ label: trimmed.toLowerCase(), target, icon });
    else await f.actions.updateDDay(dday.id, { label: trimmed.toLowerCase(), target, icon });
    onClose();
  };

  const remove = async () => {
    if (!dday) return;
    if (!window.confirm("remove this d-day?")) return;
    await f.actions.removeDDay(dday.id);
    onClose();
  };

  const cancel = () => onClose();

  return (
    <>
      <div className="smallcaps" style={{ color: "var(--ink-3)" }}>{isNew ? "new d-day" : "edit d-day"}</div>
      <input
        value={label}
        autoFocus
        onChange={e => { setLabel(e.target.value.toLowerCase()); setErr(''); }}
        placeholder="e.g. mcat"
        className="sans"
        maxLength={60}
        onKeyDown={e => {
          if (e.key === "Enter") submit();
          else if (e.key === "Escape") cancel();
        }}
        style={{
          border: "none", borderBottom: "1px solid rgba(110,90,71,0.18)",
          background: "transparent", outline: "none",
          color: "var(--ink)", fontSize: 14, padding: "6px 4px", width: "100%",
        }}
      />
      <input
        type="date"
        value={target}
        min={today}
        onChange={e => { setTarget(e.target.value); setErr(''); }}
        onKeyDown={e => {
          if (e.key === "Enter") submit();
          else if (e.key === "Escape") cancel();
        }}
        className="sans"
        style={{
          border: "none", outline: "none",
          background: "var(--surface-2)", borderRadius: 8,
          color: "var(--ink)", fontSize: 13, padding: "8px 10px", width: "100%",
        }}
      />
      <div style={{ display: "flex", gap: 8 }}>
        {[
          { id: "cap", Icon: IconCap },
          { id: "book", Icon: IconBook },
          { id: "doc", Icon: IconDoc },
        ].map(opt => (
          <button key={opt.id} onClick={() => setIcon(opt.id)} style={{
            width: 32, height: 32, borderRadius: 8,
            background: icon === opt.id ? "var(--accent)" : "var(--surface-2)",
            color: icon === opt.id ? "var(--surface)" : "var(--ink-2)",
            display: "flex", alignItems: "center", justifyContent: "center",
            flexShrink: 0,
          }}>
            <opt.Icon size={14} />
          </button>
        ))}
      </div>
      {err && <div className="sans" style={{ color: "var(--accent)", fontSize: 12 }}>{err}</div>}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, marginTop: 2 }}>
        <div>
          {!isNew && (
            <button onClick={remove} className="sans" style={{ color: "var(--accent)", fontSize: 13, padding: "6px 0" }}>
              remove
            </button>
          )}
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={cancel} className="sans" style={{ color: "var(--ink-2)", fontSize: 13, padding: "6px 10px" }}>
            cancel
          </button>
          <button onClick={submit} className="sans" style={{
            background: "var(--accent)", color: "var(--surface)",
            borderRadius: 999, padding: "6px 16px", fontSize: 13,
          }}>
            {isNew ? "add" : "save"}
          </button>
        </div>
      </div>
    </>
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

const TODAYS_NOTE_COLLAPSED_KEY = "folio.todaysNoteCollapsed";

function TodaysNote({ text, onClick, style }) {
  const [collapsed, setCollapsed] = React.useState(() => {
    try { return localStorage.getItem(TODAYS_NOTE_COLLAPSED_KEY) === "1"; } catch (e) { return false; }
  });
  const setCollapsedPersisted = (next) => {
    setCollapsed(next);
    try { localStorage.setItem(TODAYS_NOTE_COLLAPSED_KEY, next ? "1" : "0"); } catch (e) {}
  };

  if (collapsed) {
    return (
      <button
        onClick={() => setCollapsedPersisted(false)}
        className="lift smallcaps"
        aria-label="show today’s note"
        style={{
          background: "var(--surface)", borderRadius: 999, boxShadow: "var(--shadow-soft)",
          padding: "8px 14px", transform: "rotate(0.6deg)",
          color: "var(--accent)", fontSize: 11,
          display: "inline-flex", alignItems: "center", gap: 6,
          ...style,
        }}
      >
        today’s note <span style={{ color: "var(--ink-3)", fontSize: 10 }}>▸</span>
      </button>
    );
  }

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onClick?.(); } }}
      className="lift"
      style={{
        background: "var(--surface)", borderRadius: 14, boxShadow: "var(--shadow-tilt)",
        padding: "18px 22px 20px", transform: "rotate(0.6deg)", width: 280,
        textAlign: "left", display: "block", position: "relative", cursor: "pointer",
        ...style,
      }}
    >
      <button
        aria-label="hide today’s note"
        onClick={(e) => { e.stopPropagation(); setCollapsedPersisted(true); }}
        style={{
          position: "absolute", top: 8, right: 10,
          width: 22, height: 22, borderRadius: 999,
          display: "inline-flex", alignItems: "center", justifyContent: "center",
          color: "var(--ink-3)", fontSize: 14, lineHeight: 1,
        }}
      >
        −
      </button>
      <div className="smallcaps" style={{ color: "var(--accent)", marginBottom: 8 }}>Today’s Note</div>
      <div className="serif" style={{
        fontSize: 19, lineHeight: 1.45, color: "var(--ink)",
        overflowWrap: "anywhere", wordBreak: "break-word",
      }}>
        {text}
      </div>
    </div>
  );
}

function GoalBar({ label, doneSec, goalSec }) {
  const pct = Math.min(1, doneSec / Math.max(1, goalSec));
  return (
    <div style={{ width: 380, maxWidth: "90vw" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 10, gap: 12 }}>
        {typeof label === "string"
          ? <span className="smallcaps" style={{ color: "var(--ink-3)", whiteSpace: "nowrap" }}>{label}</span>
          : label}
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
            transform: "translateY(-50%)", boxShadow: "0 0 0 4px color-mix(in srgb, var(--accent) 16%, transparent)",
          }} />
        )}
      </div>
    </div>
  );
}

function DDayQuickAdd() {
  const [open, setOpen] = React.useState(false);
  const rootRef = React.useRef(null);

  React.useEffect(() => {
    if (!open) return;
    const onDown = (e) => {
      if (!rootRef.current?.contains(e.target)) setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  return (
    <div ref={rootRef} style={{ position: "relative", zIndex: open ? 20 : 10, alignSelf: "flex-start" }}>
      <button
        onClick={() => setOpen(o => !o)}
        className="lift"
        aria-haspopup="dialog"
        aria-expanded={open}
        style={{
          padding: "10px 18px",
          borderRadius: 999,
          border: "1.5px dashed rgba(110,90,71,0.35)",
          color: "var(--ink-2)",
          display: "inline-flex", alignItems: "center", gap: 10,
          background: "transparent",
        }}
      >
        <span style={{ fontSize: 16, lineHeight: 1 }}>+</span>
        <span className="sans" style={{ fontSize: 14, whiteSpace: "nowrap" }}>d-day</span>
      </button>

      {open && (
        <div style={{
          position: "absolute", left: 0, top: "100%", marginTop: 8,
          background: "var(--surface)", borderRadius: 12, boxShadow: "var(--shadow-tilt)",
          padding: 12,
          width: 260, maxWidth: "calc(100vw - 32px)",
          display: "flex", flexDirection: "column", gap: 10,
        }}>
          <DDayForm dday={null} onClose={() => setOpen(false)} />
        </div>
      )}
    </div>
  );
}

function SubjectCapsule({ active, subjects, todayBySubject, onPick, onCreate }) {
  const isMobile = useMediaQuery("(max-width: 560px)");
  const [open, setOpen] = React.useState(false);
  const [query, setQuery] = React.useState('');
  const [creating, setCreating] = React.useState(false);
  const [newName, setNewName] = React.useState('');
  const [newColor, setNewColor] = React.useState(COLOR_PALETTE[0]);
  const rootRef = React.useRef(null);
  const searchRef = React.useRef(null);

  React.useEffect(() => {
    if (!open) return;
    const onDown = (e) => {
      if (!rootRef.current?.contains(e.target)) {
        setOpen(false); setCreating(false); setQuery('');
      }
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  React.useEffect(() => {
    if (open && !creating && !isMobile) searchRef.current?.focus();
  }, [open, creating, isMobile]);

  const q = query.trim().toLowerCase();
  const filtered = subjects.filter(s => !q || s.name.toLowerCase().includes(q));
  const exact = subjects.some(s => s.name.toLowerCase() === q);
  const showCreate = q.length > 0 && !exact;

  const beginCreate = () => {
    setNewName(query.trim());
    const used = new Set(subjects.map(s => s.color));
    setNewColor(COLOR_PALETTE.find(c => !used.has(c)) || COLOR_PALETTE[0]);
    setCreating(true);
  };

  const submitCreate = async () => {
    const name = newName.trim().toLowerCase();
    if (!name) return;
    const created = await onCreate({ name, color: newColor });
    if (created) onPick(created.id);
    setOpen(false); setCreating(false); setQuery(''); setNewName('');
  };

  return (
    <div ref={rootRef} style={{ position: "relative", display: "inline-block" }}>
      <button
        onClick={() => setOpen(o => !o)}
        className="lift"
        aria-haspopup="listbox"
        aria-expanded={open}
        style={{
          display: "inline-flex", alignItems: "center", gap: 12,
          padding: "12px 22px 12px 18px",
          background: "var(--surface)", borderRadius: 999,
          boxShadow: "var(--shadow-soft)",
          color: "var(--ink)",
          maxWidth: "min(86vw, 360px)",
        }}
      >
        <span style={{
          width: 18, height: 18, borderRadius: 999,
          background: active ? active.color : "transparent",
          border: active ? "none" : "1.5px dashed var(--ink-3)",
          flexShrink: 0,
        }} />
        <span className="sans" style={{
          fontSize: 16, fontWeight: 400,
          overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
          color: active ? "var(--ink)" : "var(--ink-3)",
        }}>
          {active ? active.name : "no subject"}
        </span>
        <span style={{ color: "var(--ink-3)", fontSize: 12, marginLeft: 4 }}>▾</span>
      </button>

      {open && (
        <div style={{
          position: "absolute", left: "50%", top: "100%", marginTop: 8, zIndex: 20,
          transform: "translateX(-50%)",
          background: "var(--surface)", borderRadius: 12, boxShadow: "var(--shadow-tilt)",
          padding: 10,
          width: 260, maxWidth: "calc(100vw - 32px)",
          display: "flex", flexDirection: "column", gap: 6,
        }}>
          {!creating ? (
            <>
              <input
                ref={searchRef}
                value={query}
                onChange={e => setQuery(e.target.value)}
                placeholder="search subjects"
                className="sans"
                onKeyDown={e => {
                  if (e.key === "Enter") {
                    if (filtered.length > 0) { onPick(filtered[0].id); setOpen(false); setQuery(''); }
                    else if (showCreate) beginCreate();
                  } else if (e.key === "Escape") { setOpen(false); setQuery(''); }
                }}
                style={{
                  border: "none", borderBottom: "1px solid rgba(110,90,71,0.18)",
                  background: "transparent", outline: "none",
                  color: "var(--ink)", fontSize: 13, padding: "6px 4px", width: "100%",
                }}
              />
              <div style={{ maxHeight: 160, overflowY: "auto", display: "flex", flexDirection: "column", gap: 2 }}>
                {filtered.map(s => {
                  const sec = todayBySubject[s.id] || 0;
                  const isActive = active?.id === s.id;
                  return (
                    <button
                      key={s.id}
                      onClick={() => { onPick(s.id); setOpen(false); setQuery(''); }}
                      style={{
                        display: "flex", alignItems: "center", gap: 10,
                        padding: "6px", textAlign: "left", borderRadius: 6,
                        background: isActive ? "rgba(110,90,71,0.06)" : "transparent",
                      }}
                    >
                      <span style={{ width: 10, height: 10, borderRadius: 999, background: s.color, flexShrink: 0 }} />
                      <span className="sans" style={{
                        fontSize: 13, color: "var(--ink)", flex: 1, minWidth: 0,
                        overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                      }}>{s.name}</span>
                      {sec > 0 && (
                        <span className="sans tnum" style={{ fontSize: 12, color: "var(--ink-3)", flexShrink: 0 }}>
                          {fmtHoursLong(sec)}
                        </span>
                      )}
                    </button>
                  );
                })}
                {filtered.length === 0 && !showCreate && (
                  <div className="sans" style={{ fontSize: 12.5, color: "var(--ink-3)", padding: "6px" }}>no subjects yet</div>
                )}
              </div>
              <button
                onClick={beginCreate}
                style={{
                  display: "flex", alignItems: "center", gap: 10,
                  padding: "8px 6px", textAlign: "left",
                  borderTop: filtered.length ? "1px dashed rgba(110,90,71,0.18)" : "none",
                  marginTop: filtered.length ? 4 : 0,
                  color: showCreate ? "var(--accent)" : "var(--ink-2)",
                }}
              >
                <span style={{
                  width: 10, height: 10, borderRadius: 999,
                  border: `1.5px dashed ${showCreate ? "var(--accent)" : "var(--ink-3)"}`,
                  flexShrink: 0,
                }} />
                <span className="sans" style={{ fontSize: 13, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {showCreate ? `create "${query.trim()}"` : "+ new subject"}
                </span>
              </button>
            </>
          ) : (
            <>
              <div className="smallcaps" style={{ color: "var(--ink-3)", marginBottom: 4 }}>new subject</div>
              <input
                value={newName}
                autoFocus
                onChange={e => setNewName(e.target.value.toLowerCase())}
                placeholder="e.g. organic chemistry"
                className="sans"
                maxLength={60}
                onKeyDown={e => {
                  if (e.key === "Enter") submitCreate();
                  else if (e.key === "Escape") setCreating(false);
                }}
                style={{
                  border: "none", borderBottom: "1px solid rgba(110,90,71,0.18)",
                  background: "transparent", outline: "none",
                  color: "var(--ink)", fontSize: 14, padding: "6px 4px", width: "100%",
                }}
              />
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6, padding: "8px 0 4px" }}>
                {COLOR_PALETTE.map(c => (
                  <button key={c} onClick={() => setNewColor(c)} style={{
                    width: 22, height: 22, borderRadius: 999, background: c,
                    outline: newColor === c ? "2px solid var(--ink)" : "none",
                    outlineOffset: 2, border: "none",
                  }} />
                ))}
              </div>
              <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 6 }}>
                <button onClick={() => setCreating(false)} className="sans" style={{ color: "var(--ink-2)", fontSize: 13, padding: "6px 10px" }}>
                  cancel
                </button>
                <button onClick={submitCreate} className="sans" style={{
                  background: "var(--accent)", color: "var(--surface)",
                  borderRadius: 999, padding: "6px 16px", fontSize: 13,
                }}>
                  add
                </button>
              </div>
            </>
          )}
        </div>
      )}
    </div>
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

const POMODORO_PRESETS = [
  { name: "classic 25/5", work: 25, sb: 5,  lb: 15 },
  { name: "deep 50/10",   work: 50, sb: 10, lb: 20 },
  { name: "ultra 90/20",  work: 90, sb: 20, lb: 30 },
];

function PomodoroQuickConfig() {
  const f = useFolio();
  const p = f.state.pomodoro;
  const [open, setOpen] = React.useState(false);
  const rootRef = React.useRef(null);

  React.useEffect(() => {
    if (!open) return;
    const onDown = (e) => {
      if (!rootRef.current?.contains(e.target)) setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  const label = p.enabled
    ? `mode · ${p.work_min}/${p.short_break_min}`
    : "mode · stopwatch";

  return (
    <span ref={rootRef} style={{ position: "relative", display: "inline-flex", alignItems: "center" }}>
      <button
        onClick={() => setOpen(o => !o)}
        aria-haspopup="dialog"
        aria-expanded={open}
        style={{
          background: "transparent",
          color: "inherit",
          padding: 0,
          font: "inherit",
          letterSpacing: "inherit",
          textTransform: "inherit",
        }}
      >
        {label} <span style={{ opacity: 0.55 }}>▾</span>
      </button>

      {open && (
        <div className="sans" style={{
          position: "absolute", left: "50%", bottom: "100%", marginBottom: 10,
          transform: "translateX(-50%)",
          background: "var(--surface)", borderRadius: 12, boxShadow: "var(--shadow-tilt)",
          padding: 16,
          width: 300, maxWidth: "calc(100vw - 32px)",
          display: "flex", flexDirection: "column", gap: 14,
          textAlign: "left",
          textTransform: "none",
          letterSpacing: "normal",
          fontSize: 14,
        }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <span className="sans" style={{ fontSize: 14, color: "var(--ink)" }}>pomodoro mode</span>
            <Toggle on={p.enabled} onChange={(v) => f.actions.setPomodoro({ enabled: v })} />
          </div>
          {p.enabled && (
            <>
              <div>
                <Slider label="Work"        min={5} max={90} step={1} value={p.work_min}           unit=" min" onChange={(v) => f.actions.setPomodoro({ work_min: v })} />
                <Slider label="Short break" min={1} max={30} step={1} value={p.short_break_min}    unit=" min" onChange={(v) => f.actions.setPomodoro({ short_break_min: v })} />
                <Slider label="Long break"  min={5} max={60} step={1} value={p.long_break_min}     unit=" min" onChange={(v) => f.actions.setPomodoro({ long_break_min: v })} />
                <Slider label="Cycles before long" min={2} max={8} step={1} value={p.cycles_before_long} unit="" onChange={(v) => f.actions.setPomodoro({ cycles_before_long: v })} />
              </div>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                {POMODORO_PRESETS.map(preset => (
                  <button
                    key={preset.name}
                    onClick={() => f.actions.setPomodoro({ work_min: preset.work, short_break_min: preset.sb, long_break_min: preset.lb })}
                    className="sans"
                    style={{ padding: "7px 12px", borderRadius: 999, background: "var(--bg)", boxShadow: "var(--shadow-soft)", fontSize: 12, color: "var(--ink-2)" }}
                  >
                    {preset.name}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
      )}
    </span>
  );
}

const RECENT_SESSION_WINDOW_MS = 60 * 60 * 1000;

function LastSessionUndo() {
  const f = useFolio();
  const [open, setOpen] = React.useState(false);
  const [deleting, setDeleting] = React.useState(false);
  const rootRef = React.useRef(null);
  const [now, setNow] = React.useState(() => Date.now());

  React.useEffect(() => {
    if (!open) return;
    const onDown = (e) => {
      if (!rootRef.current?.contains(e.target)) setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  // refresh "recent" gate roughly every minute so the control disappears on its own
  React.useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 30 * 1000);
    return () => clearInterval(id);
  }, []);

  if (f.state.current) return null;
  const last = f.state.sessions[0];
  if (!last) return null;
  const endedMs = new Date(last.ended_at).getTime();
  if (now - endedMs > RECENT_SESSION_WINDOW_MS) return null;
  const sub = f.subjectMap[last.subject_id];

  const onDelete = async () => {
    setDeleting(true);
    await f.actions.deleteSession(last.id);
    setDeleting(false);
    setOpen(false);
  };

  return (
    <div ref={rootRef} style={{ position: "relative", zIndex: open ? 20 : 10, marginTop: 10 }}>
      <button
        onClick={() => setOpen(o => !o)}
        className="sans"
        aria-haspopup="dialog"
        aria-expanded={open}
        style={{
          fontSize: 12, color: "var(--ink-3)",
          background: "transparent",
          padding: "4px 6px",
          letterSpacing: "0.02em",
        }}
      >
        last session · {sub?.name || "(removed)"} · {fmtHoursLong(last.duration_seconds)} — undo
      </button>

      {open && (
        <div style={{
          position: "absolute", left: "50%", top: "100%", marginTop: 8,
          transform: "translateX(-50%)",
          background: "var(--surface)", borderRadius: 12, boxShadow: "var(--shadow-tilt)",
          padding: 14,
          width: 240, maxWidth: "calc(100vw - 32px)",
          display: "flex", flexDirection: "column", gap: 10,
          textAlign: "left",
        }}>
          <div className="serif" style={{ fontSize: 16, color: "var(--ink)", lineHeight: 1.35 }}>
            delete this session?
          </div>
          <div className="sans" style={{ fontSize: 13, color: "var(--ink-2)" }}>
            {sub?.name || "(removed)"} · {fmtHoursLong(last.duration_seconds)}
          </div>
          <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 4 }}>
            <button
              onClick={() => setOpen(false)}
              className="sans"
              style={{ fontSize: 13, padding: "8px 14px", borderRadius: 999, color: "var(--ink-2)", background: "transparent" }}
            >
              cancel
            </button>
            <button
              onClick={onDelete}
              disabled={deleting}
              className="sans"
              style={{
                fontSize: 13, padding: "8px 16px", borderRadius: 999,
                color: "var(--surface)", background: "var(--accent)",
                opacity: deleting ? 0.6 : 1, cursor: deleting ? "default" : "pointer",
              }}
            >
              {deleting ? "deleting…" : "delete"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// Two-note sine chime via Web Audio — no asset files, no deps.
// `kind` of 'rest' descends (work just ended), 'resume' ascends (back to work).
function playPomodoroChime(kind) {
  try {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return;
    const ctx = new Ctx();
    const notes = kind === 'rest' ? [659.25, 523.25] : [523.25, 659.25];
    notes.forEach((freq, i) => {
      const t = ctx.currentTime + i * 0.18;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0, t);
      gain.gain.linearRampToValueAtTime(0.14, t + 0.015);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.7);
      osc.connect(gain).connect(ctx.destination);
      osc.start(t);
      osc.stop(t + 0.75);
    });
    setTimeout(() => { try { ctx.close(); } catch {} }, 1800);
  } catch {}
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

  const startMode = f.state.pomodoro?.enabled ? "pomodoro" : "stopwatch";

  // keyboard shortcuts
  React.useEffect(() => {
    const onKey = (e) => {
      if (e.target && (e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA")) return;
      if (e.code === "Space") {
        e.preventDefault();
        if (!cur) f.actions.startSession({ mode: startMode });
        else if (cur.paused) f.actions.resumeSession();
        else f.actions.pauseSession();
      } else if (e.key === "Escape") {
        if (cur) f.actions.endSession();
      } else if (e.key.toLowerCase() === "j") {
        setPage("journal");
      } else if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
        if (!f.subjectsActive.length) return;
        e.preventDefault();
        const curIdx = f.subjectsActive.findIndex(s => s.id === activeId);
        const dir = e.key === "ArrowLeft" ? -1 : 1;
        const nextIdx = curIdx < 0 ? 0 : (curIdx + dir + f.subjectsActive.length) % f.subjectsActive.length;
        f.actions.setActiveSubject(f.subjectsActive[nextIdx].id);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [cur, f.subjectsActive, activeId, setPage, startMode]);

  // pomodoro auto-advance: when the active phase hits its target, hand off.
  // The advance action is async (it writes the work session to DB), so guard
  // with a ref to avoid firing the same transition twice from a stale tick.
  const advancingRef = React.useRef(false);
  React.useEffect(() => {
    if (!cur?.phase || !cur.target_seconds || cur.paused) return;
    if (f.liveSeconds < cur.target_seconds) { advancingRef.current = false; return; }
    if (advancingRef.current) return;
    advancingRef.current = true;
    f.actions.advancePomodoroPhase();
  }, [f.liveSeconds, cur?.phase, cur?.paused, cur?.target_seconds]);

  // chime on phase transitions only — skip initial mount, page reload, and
  // session end. Both old and new phases must be set, and different.
  const prevPhaseRef = React.useRef(cur?.phase);
  React.useEffect(() => {
    const prev = prevPhaseRef.current;
    const next = cur?.phase;
    prevPhaseRef.current = next;
    if (!prev || !next || prev === next) return;
    playPomodoroChime(next === 'work' ? 'resume' : 'rest');
  }, [cur?.phase]);

  const weeklyMode = !!f.state.goals.weekly_goal_mode;
  const goalSec = weeklyMode ? f.state.goals.weekly_seconds : f.state.goals.daily_seconds;
  const doneSec = weeklyMode ? f.weekTotalSeconds : f.todayTotalSeconds;
  const goalLabel = (
    <span className="smallcaps" style={{ display: "inline-flex", gap: 6, whiteSpace: "nowrap" }}>
      <span
        onClick={() => weeklyMode && f.actions.setGoals({ weekly_goal_mode: false })}
        style={{ color: weeklyMode ? "var(--ink-3)" : "var(--ink)", cursor: weeklyMode ? "pointer" : "default" }}
      >daily</span>
      <span style={{ color: "var(--ink-3)" }}>·</span>
      <span
        onClick={() => !weeklyMode && f.actions.setGoals({ weekly_goal_mode: true })}
        style={{ color: weeklyMode ? "var(--ink)" : "var(--ink-3)", cursor: weeklyMode ? "default" : "pointer" }}
      >weekly</span>
    </span>
  );

  const onStart = () => f.actions.startSession({ mode: startMode });

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

  // d-days: future-only, sorted by proximity (soonest first), top 3 shown on timer
  const futureDDays = (f.state.d_days || [])
    .filter(d => daysBetween(todayISO(), d.target) >= 0)
    .sort((a, b) => daysBetween(todayISO(), a.target) - daysBetween(todayISO(), b.target));
  const visibleDDays = futureDDays.slice(0, 3);
  const moreCount = futureDDays.length - visibleDDays.length;

  const MoreDDaysLink = () => moreCount > 0 ? (
    <button
      onClick={() => setPage("settings")}
      className="sans"
      style={{
        alignSelf: "flex-start",
        color: "var(--ink-3)", fontSize: 12,
        padding: "2px 4px",
        background: "transparent",
      }}
    >
      {moreCount} more — settings
    </button>
  ) : null;

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
      <div style={{ display: "flex", flexDirection: "column", gap: 12, flex: isMobile ? "1 1 auto" : "0 1 280px", minWidth: 0, position: "relative", zIndex: 10 }}>
        {visibleDDays.map(d => <DDayPill key={d.id} d={d} />)}
        <MoreDDaysLink />
        <DDayQuickAdd />
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
            {visibleDDays.map(d => <DDayPill key={d.id} d={d} />)}
            <MoreDDaysLink />
            <DDayQuickAdd />
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
          {cur?.phase && (() => {
            const phaseLabel = cur.phase === 'work' ? 'work' : cur.phase === 'short_break' ? 'short break' : 'long break';
            const cyclesTotal = f.state.pomodoro?.cycles_before_long || 4;
            const cycleHuman = cur.phase === 'work' ? (cur.cycle_index || 0) + 1 : cur.cycle_index || 1;
            const targetMin = Math.round((cur.target_seconds || 0) / 60);
            return (
              <div className="smallcaps" style={{
                fontSize: 11, letterSpacing: "0.16em",
                color: cur.phase === 'work' ? "var(--accent)" : "var(--ink-3)",
                marginBottom: isMobile ? 10 : 14, textAlign: "center",
              }}>
                {phaseLabel} · cycle {cycleHuman} of {cyclesTotal} · {targetMin} min
              </div>
            );
          })()}

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

          <div style={{ marginBottom: isMobile ? 28 : 30, width: "100%", display: "flex", justifyContent: "center", paddingInline: 18 }}>
            <GoalBar label={goalLabel} doneSec={doneSec} goalSec={goalSec} />
          </div>

          <div style={{ marginBottom: isMobile ? 22 : 30, display: "flex", justifyContent: "center", paddingInline: 16, position: "relative", zIndex: 50 }}>
            <SubjectCapsule
              active={sub}
              subjects={f.subjectsActive}
              todayBySubject={f.todaySecondsBySubject}
              onPick={(id) => f.actions.setActiveSubject(id)}
              onCreate={(payload) => f.actions.addSubject(payload)}
            />
          </div>

          <TimerControls
            state={state}
            onPause={f.actions.pauseSession}
            onResume={f.actions.resumeSession}
            onEnd={f.actions.endSession}
            onStart={onStart}
          />

          {/* hint row */}
          <div className="smallcaps" style={{ color: "var(--ink-4)", marginTop: 18, fontSize: 10, textAlign: "center", paddingInline: 18, lineHeight: 1.7, position: "relative", zIndex: 40 }}>
            space pause · esc end · ←→ switch · j journal · <PomodoroQuickConfig />
          </div>

          <LastSessionUndo />
        </div>
      </div>
    </div>
  );
}
