import React from 'react';
import { useFolio, todayISO, toISODate, addDays, daysBetween, parseISODate } from './state.jsx';
import { useAuth } from './auth-context.jsx';
import { supabase } from './lib/supabase.js';
import { IconCap, IconBook, IconDoc, IconPencil, IconArrow, Avatar, useMediaQuery } from './shared.jsx';

/* Settings — fully wired CRUD */

const NAV = [
  "subjects", "d-days", "goals", "pomodoro",
  "theme", "profile & privacy",
  "account", "data & export",
];

const COLOR_PALETTE = [
  "#E89E6D", "#C77B5F", "#B07A6E", "#8B9A82", "#C19A3F", "#8B6F8E",
  "#B85C3C", "#7E8B6F", "#A65B5B", "#7A8FA3",
];
const HANDLE_MIN_LENGTH = 5;

function normalizeHandle(value) {
  return value.trim().replace(/^@+/, '').toLowerCase();
}

function isUniqueHandleError(error) {
  const text = `${error?.code || ''} ${error?.message || ''} ${error?.details || ''}`;
  return error?.code === '23505' || /profiles_handle_key|duplicate key|unique/i.test(text);
}

// --- shared controls ---

function Toggle({ on, onChange }) {
  return (
    <button onClick={() => onChange(!on)} style={{
      width: 48, height: 26, borderRadius: 999,
      background: on ? "var(--accent)" : "rgba(110,90,71,0.22)",
      position: "relative", transition: "background 200ms",
      flexShrink: 0,
    }}>
      <span style={{
        position: "absolute", top: 3, left: on ? 25 : 3,
        width: 20, height: 20, borderRadius: 999,
        background: on ? "var(--surface)" : "var(--ink)",
        transition: "left 220ms cubic-bezier(0.22,1,0.36,1)",
        boxShadow: "0 1px 2px rgba(0,0,0,0.15)",
      }} />
    </button>
  );
}

function Slider({ label, value, min, max, step, unit, onChange, formatValue }) {
  return (
    <div style={{ marginBottom: 28 }}>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 12 }}>
        <span className="smallcaps" style={{ color: "var(--ink-3)" }}>{label}</span>
        <span className="sans tnum" style={{ color: "var(--ink)" }}>
          {formatValue ? formatValue(value) : `${value}${unit || ""}`}
        </span>
      </div>
      <input type="range" min={min} max={max} step={step} value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        style={{ width: "100%", accentColor: "var(--accent)" }}
      />
    </div>
  );
}

function Modal({ children, onClose }) {
  const isMobile = useMediaQuery("(max-width: 640px)");
  return (
    <div onClick={onClose} style={{
      position: "fixed", inset: 0, zIndex: 70,
      background: "rgba(42, 29, 18, 0.30)", backdropFilter: "blur(3px)",
      display: "flex", alignItems: isMobile ? "flex-start" : "center", justifyContent: "center",
      padding: isMobile ? 16 : 24,
      overflowY: "auto",
    }}>
      <div onClick={(e) => e.stopPropagation()} className="card" style={{
        width: 500, maxWidth: "100%", padding: isMobile ? "22px 18px" : "30px 34px",
        boxShadow: "var(--shadow-card)",
        marginTop: isMobile ? "calc(env(safe-area-inset-top, 0px) + 8px)" : 0,
        marginBottom: isMobile ? "calc(env(safe-area-inset-bottom, 0px) + 8px)" : 0,
      }}>
        {children}
      </div>
    </div>
  );
}

// --- Subject editor ---

function SubjectEditor({ subject, onClose }) {
  const f = useFolio();
  const isNew = !subject;
  const [name, setName]     = React.useState(subject?.name || "");
  const [color, setColor]   = React.useState(subject?.color || COLOR_PALETTE[0]);

  const save = () => {
    if (!name.trim()) return;
    if (isNew) f.actions.addSubject({ name: name.trim(), color });
    else       f.actions.updateSubject(subject.id, { name: name.trim(), color });
    onClose();
  };

  return (
    <Modal onClose={onClose}>
      <div className="smallcaps" style={{ color: "var(--accent)", marginBottom: 16 }}>
        {isNew ? "Add subject" : "Edit subject"}
      </div>

      <div className="smallcaps" style={{ color: "var(--ink-3)", marginBottom: 8 }}>Name</div>
      <input value={name} onChange={(e) => setName(e.target.value.toLowerCase())} autoFocus
        placeholder="e.g. organic chemistry"
        className="serif"
        style={{
          width: "100%", fontSize: 22, padding: "8px 0 12px",
          borderBottom: "1px solid rgba(110,90,71,0.22)", marginBottom: 24,
          color: "var(--ink)",
        }}
      />

      <div className="smallcaps" style={{ color: "var(--ink-3)", marginBottom: 10 }}>Color</div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 10, marginBottom: 24 }}>
        {COLOR_PALETTE.map(c => (
          <button key={c} onClick={() => setColor(c)} style={{
            width: 30, height: 30, borderRadius: 999, background: c,
            outline: color === c ? "2px solid var(--ink)" : "none",
            outlineOffset: 2, border: "none",
          }}/>
        ))}
        <label style={{ display: "inline-flex", alignItems: "center", gap: 8, marginLeft: 8 }}>
          <input type="color" value={color} onChange={(e) => setColor(e.target.value)}
            style={{ width: 30, height: 30, border: "1px solid rgba(110,90,71,0.2)", borderRadius: 6, padding: 0, background: "transparent" }}
          />
          <span className="smallcaps" style={{ color: "var(--ink-3)" }}>custom</span>
        </label>
      </div>

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 8 }}>
        <div style={{ display: "flex", gap: 14 }}>
          {!isNew && !subject.archived && (
            <button onClick={() => { f.actions.archiveSubject(subject.id); onClose(); }} className="sans" style={{ color: "var(--ink-2)", fontSize: 14 }}>
              archive
            </button>
          )}
          {!isNew && subject.archived && (
            <button onClick={() => { f.actions.unarchiveSubject(subject.id); onClose(); }} className="sans" style={{ color: "var(--ink-2)", fontSize: 14 }}>
              unarchive
            </button>
          )}
          {!isNew && (
            <button onClick={() => {
              if (confirm("Delete subject permanently? Sessions will remain but become orphaned.")) {
                f.actions.deleteSubject(subject.id); onClose();
              }
            }} className="sans" style={{ color: "var(--accent)", fontSize: 14 }}>
              delete
            </button>
          )}
        </div>
        <div style={{ display: "flex", gap: 10 }}>
          <button onClick={onClose} className="sans" style={{ padding: "10px 22px", borderRadius: 999, color: "var(--ink-2)", fontSize: 14 }}>cancel</button>
          <button onClick={save} className="sans" style={{ padding: "10px 28px", borderRadius: 999, background: "var(--accent)", color: "var(--surface)", fontSize: 14 }}>
            {isNew ? "add" : "save"}
          </button>
        </div>
      </div>
    </Modal>
  );
}

function DragHandle({ style }) {
  return (
    <svg width="12" height="18" viewBox="0 0 12 18" style={style} aria-hidden="true">
      <circle cx="3"  cy="3"  r="1.4" fill="currentColor"/>
      <circle cx="9"  cy="3"  r="1.4" fill="currentColor"/>
      <circle cx="3"  cy="9"  r="1.4" fill="currentColor"/>
      <circle cx="9"  cy="9"  r="1.4" fill="currentColor"/>
      <circle cx="3"  cy="15" r="1.4" fill="currentColor"/>
      <circle cx="9"  cy="15" r="1.4" fill="currentColor"/>
    </svg>
  );
}

function SubjectCardInner({ s, totalSec, onEdit, handle }) {
  return (
    <div className="card" style={{
      display: "flex", alignItems: "center", gap: 14, padding: "16px 22px",
    }}>
      {handle}
      <span style={{ width: 16, height: 16, borderRadius: 999, background: s.color, flexShrink: 0 }} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div className="serif" style={{ fontSize: 22, color: "var(--ink)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", lineHeight: 1.1 }}>
          {s.name}{s.archived ? " · archived" : ""}
        </div>
        <div className="smallcaps" style={{ color: "var(--ink-3)", marginTop: 4 }}>
          {(totalSec/3600).toFixed(1)}h total
        </div>
      </div>
      <button onClick={onEdit} style={{ color: "var(--ink-3)", display: "flex", justifyContent: "center", padding: 4, flexShrink: 0 }}>
        <IconPencil />
      </button>
    </div>
  );
}

function SubjectRow({ s, totalSec, onEdit }) {
  // archived rows: empty placeholder where the drag handle would be so the color dot lines up
  return (
    <SubjectCardInner s={s} totalSec={totalSec} onEdit={onEdit}
      handle={<span style={{ width: 12, flexShrink: 0 }} />}
    />
  );
}

function DraggableSubjectRow({ s, totalSec, onEdit, isDragging, indicator, onDragStart, onDragOver, onDragEnd, onDrop }) {
  return (
    <div
      draggable
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDragEnd={onDragEnd}
      onDrop={onDrop}
      style={{ position: "relative", opacity: isDragging ? 0.4 : 1, cursor: "grab" }}
    >
      {indicator === "above" && (
        <div style={{ position: "absolute", top: -7, left: 8, right: 8, height: 2, background: "var(--accent)", borderRadius: 2, pointerEvents: "none" }} />
      )}
      {indicator === "below" && (
        <div style={{ position: "absolute", bottom: -7, left: 8, right: 8, height: 2, background: "var(--accent)", borderRadius: 2, pointerEvents: "none" }} />
      )}
      <SubjectCardInner s={s} totalSec={totalSec} onEdit={onEdit}
        handle={<DragHandle style={{ color: "var(--ink-3)", opacity: 0.55, flexShrink: 0 }} />}
      />
    </div>
  );
}

// --- D-Day editor ---

function DDayEditor({ dday, onClose }) {
  const f = useFolio();
  const isNew = !dday;
  const today = todayISO();
  const [label, setLabel] = React.useState(dday?.label || "");
  const [target, setTarget] = React.useState(dday?.target || toISODate(addDays(new Date(), 30)));
  const [icon, setIcon] = React.useState(dday?.icon || "cap");
  const [err, setErr] = React.useState("");
  const targetPast = target < today;
  const save = () => {
    if (!label.trim()) { setErr("give it a label."); return; }
    if (targetPast) { setErr("target must be today or later."); return; }
    if (isNew) f.actions.addDDay({ label: label.trim().toLowerCase(), target, icon });
    else f.actions.updateDDay(dday.id, { label: label.trim().toLowerCase(), target, icon });
    onClose();
  };
  return (
    <Modal onClose={onClose}>
      <div className="smallcaps" style={{ color: "var(--accent)", marginBottom: 16 }}>
        {isNew ? "Add d-day" : "Edit d-day"}
      </div>
      <div className="smallcaps" style={{ color: "var(--ink-3)", marginBottom: 8 }}>Label</div>
      <input value={label} onChange={(e) => setLabel(e.target.value)} autoFocus className="serif"
        placeholder="e.g. mcat" style={{ width: "100%", fontSize: 22, padding: "8px 0 12px", borderBottom: "1px solid rgba(110,90,71,0.22)", marginBottom: 22, color: "var(--ink)" }}
      />
      <div className="smallcaps" style={{ color: "var(--ink-3)", marginBottom: 8 }}>Target date</div>
      <input type="date" value={target} min={today} onChange={(e) => { setTarget(e.target.value); setErr(""); }} className="sans"
        style={{ width: "100%", fontSize: 16, padding: "10px 14px", borderRadius: 10, background: "var(--surface-2)", marginBottom: err ? 8 : 22, color: "var(--ink)", border: targetPast ? "1px solid var(--accent)" : "none" }}
      />
      {err && <div className="sans" style={{ color: "var(--accent)", fontSize: 13, marginBottom: 18 }}>{err}</div>}
      <div className="smallcaps" style={{ color: "var(--ink-3)", marginBottom: 10 }}>Icon</div>
      <div style={{ display: "flex", gap: 10, marginBottom: 28 }}>
        {[
          { id: "cap", Icon: IconCap },
          { id: "book", Icon: IconBook },
          { id: "doc", Icon: IconDoc },
        ].map(opt => (
          <button key={opt.id} onClick={() => setIcon(opt.id)} style={{
            width: 44, height: 44, borderRadius: 12,
            background: icon === opt.id ? "var(--accent)" : "var(--surface-2)",
            color: icon === opt.id ? "var(--surface)" : "var(--ink-2)",
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            <opt.Icon size={18} />
          </button>
        ))}
      </div>
      <div style={{ display: "flex", justifyContent: "space-between" }}>
        <div>
          {!isNew && (
            <button onClick={() => { if (confirm("Remove this d-day?")) { f.actions.removeDDay(dday.id); onClose(); } }} className="sans" style={{ color: "var(--accent)", fontSize: 14 }}>
              remove
            </button>
          )}
        </div>
        <div style={{ display: "flex", gap: 10 }}>
          <button onClick={onClose} className="sans" style={{ padding: "10px 22px", borderRadius: 999, color: "var(--ink-2)", fontSize: 14 }}>cancel</button>
          <button onClick={save} className="sans" style={{ padding: "10px 28px", borderRadius: 999, background: "var(--accent)", color: "var(--surface)", fontSize: 14 }}>{isNew ? "add" : "save"}</button>
        </div>
      </div>
    </Modal>
  );
}

// --- Main settings shell ---

export function SettingsView() {
  const f = useFolio();
  const isMobile = useMediaQuery("(max-width: 760px)");
  const [activeNav, setActiveNav] = React.useState("subjects");
  const [subjectEditor, setSubjectEditor] = React.useState(null); // null | "new" | subject
  const [ddayEditor, setDDayEditor] = React.useState(null);

  return (
    <div className="page" style={{ maxWidth: 1280, margin: "0 auto", padding: isMobile ? "40px 18px 130px" : "64px 48px 180px" }}>
      <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "240px 1fr", gap: isMobile ? 34 : 56, position: "relative" }}>
        {!isMobile && <div style={{ position: "absolute", left: 268, top: 0, bottom: 0, width: 1, background: "rgba(110,90,71,0.18)" }} />}
        <aside>
          <h1 className="serif" style={{ fontSize: isMobile ? 40 : 44, margin: 0, color: "var(--ink)" }}>settings</h1>
          <nav style={{
            marginTop: isMobile ? 22 : 38,
            display: "flex",
            flexDirection: isMobile ? "row" : "column",
            gap: isMobile ? 10 : 14,
            overflowX: isMobile ? "auto" : "visible",
            paddingBottom: isMobile ? 8 : 0,
            marginInline: isMobile ? -18 : 0,
            paddingInline: isMobile ? 18 : 0,
          }}>
            {NAV.map(n => {
              const active = n === activeNav;
              return (
                <button key={n} onClick={() => setActiveNav(n)} className="sans"
                  style={{
                    display: "flex", alignItems: "center", gap: 10, fontSize: 16,
                    color: active ? "var(--ink)" : "var(--ink-2)",
                    textAlign: "left", fontWeight: active ? 500 : 400,
                    padding: isMobile ? "10px 14px" : 0,
                    borderRadius: isMobile ? 999 : 0,
                    background: isMobile && active ? "var(--surface)" : "transparent",
                    boxShadow: isMobile && active ? "var(--shadow-soft)" : "none",
                    flex: isMobile ? "0 0 auto" : undefined,
                    whiteSpace: "nowrap",
                  }}>
                  <span style={{ width: 6, height: 6, borderRadius: 999, background: active ? "var(--accent)" : "transparent" }} />
                  {n}
                </button>
              );
            })}
          </nav>
        </aside>

        <main className="stagger" style={{ paddingLeft: isMobile ? 0 : 8, minWidth: 0 }}>
          {activeNav === "subjects" && (
            <SubjectsSection
              onAdd={() => setSubjectEditor("new")}
              onEdit={(s) => setSubjectEditor(s)}
            />
          )}
          {activeNav === "d-days" && (
            <DDaysSection onAdd={() => setDDayEditor("new")} onEdit={(d) => setDDayEditor(d)} />
          )}
          {activeNav === "goals" && <GoalsSection />}
          {activeNav === "pomodoro" && <PomodoroSection />}
          {activeNav === "theme" && <ThemeSection />}
          {activeNav === "profile & privacy" && <ProfileSection />}
          {activeNav === "account" && <AccountSection />}
          {activeNav === "data & export" && <DataSection />}
        </main>
      </div>

      {subjectEditor !== null && (
        <SubjectEditor
          subject={subjectEditor === "new" ? null : subjectEditor}
          onClose={() => setSubjectEditor(null)}
        />
      )}
      {ddayEditor !== null && (
        <DDayEditor
          dday={ddayEditor === "new" ? null : ddayEditor}
          onClose={() => setDDayEditor(null)}
        />
      )}
    </div>
  );
}

function SectionHeader({ title, sub }) {
  const isMobile = useMediaQuery("(max-width: 640px)");
  return (
    <>
      <h2 className="serif" style={{ fontSize: isMobile ? 36 : 44, margin: 0, color: "var(--ink)", lineHeight: 1.05 }}>{title}</h2>
      {sub && <div className="smallcaps" style={{ color: "var(--ink-3)", marginTop: 14 }}>{sub}</div>}
    </>
  );
}

function SubjectsSection({ onAdd, onEdit }) {
  const f = useFolio();
  const active = f.subjectsActive;
  const archived = f.subjectsArchived;
  const [dragId, setDragId] = React.useState(null);
  const [overId, setOverId] = React.useState(null);
  const [overPos, setOverPos] = React.useState(null); // "above" | "below"

  const resetDrag = () => { setDragId(null); setOverId(null); setOverPos(null); };

  const handleDragStart = (e, id) => {
    setDragId(id);
    e.dataTransfer.effectAllowed = "move";
    try { e.dataTransfer.setData("text/plain", id); } catch (_) {}
  };
  const handleDragOver = (e, id) => {
    if (!dragId || dragId === id) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    const rect = e.currentTarget.getBoundingClientRect();
    const above = e.clientY < rect.top + rect.height / 2;
    setOverId(id);
    setOverPos(above ? "above" : "below");
  };
  const handleDrop = (e) => {
    e.preventDefault();
    const from = dragId, to = overId, pos = overPos;
    if (!from || !to || from === to) { resetDrag(); return; }
    const ids = active.map(s => s.id);
    const fromIdx = ids.indexOf(from);
    if (fromIdx < 0) { resetDrag(); return; }
    const next = ids.slice();
    next.splice(fromIdx, 1);
    let insertAt = next.indexOf(to);
    if (insertAt < 0) { resetDrag(); return; }
    if (pos === "below") insertAt += 1;
    next.splice(insertAt, 0, from);
    if (next.some((id, i) => id !== ids[i])) f.actions.reorderSubjects(next);
    resetDrag();
  };

  return (
    <>
      <SectionHeader title="subjects" sub={`${active.length} active${archived.length ? ` · ${archived.length} archived` : ""}`} />
      <p className="serif" style={{ color: "var(--ink-2)", fontSize: 17, marginTop: 16, maxWidth: 640 }}>
        drag to reorder, edit color and name from the pencil.
      </p>
      <div style={{ display: "flex", flexDirection: "column", gap: 12, marginTop: 28 }}>
        {active.map(s => (
          <DraggableSubjectRow
            key={s.id}
            s={s}
            totalSec={f.totalSecondsBySubject[s.id] || 0}
            onEdit={() => onEdit(s)}
            isDragging={dragId === s.id}
            indicator={overId === s.id && dragId && dragId !== s.id ? overPos : null}
            onDragStart={(e) => handleDragStart(e, s.id)}
            onDragOver={(e) => handleDragOver(e, s.id)}
            onDragEnd={resetDrag}
            onDrop={handleDrop}
          />
        ))}
        {archived.map(s => (
          <SubjectRow key={s.id} s={s} totalSec={f.totalSecondsBySubject[s.id] || 0} onEdit={() => onEdit(s)} />
        ))}
      </div>
      <button onClick={onAdd} style={{
        marginTop: 22, padding: "14px 26px", borderRadius: 999,
        border: "1.5px dashed rgba(110,90,71,0.35)",
        color: "var(--ink-2)", alignSelf: "flex-start",
        display: "inline-flex", alignItems: "center", gap: 10,
        background: "transparent",
      }}>
        <span style={{ fontSize: 18 }}>+</span>
        <span className="serif" style={{ fontSize: 19 }}>add subject</span>
      </button>
    </>
  );
}

function DDayRow({ d, passed, onEdit, onRemove }) {
  const Icon = d.icon === "cap" ? IconCap : d.icon === "book" ? IconBook : IconDoc;
  const isNarrow = useMediaQuery("(max-width: 480px)");
  const daysLeft = daysBetween(todayISO(), d.target);
  const isToday = daysLeft === 0;
  const date = parseISODate(d.target);
  const dateLabel = date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  const countdown = isToday ? "today" : daysLeft > 0 ? `d − ${daysLeft}` : `d + ${-daysLeft}`;
  const countdownColor = (isToday || (daysLeft < 7 && daysLeft > 0)) ? "var(--accent)" : "var(--ink-2)";
  return (
    <div className={"card" + (isToday ? " dday-flash" : "")} style={{
      display: "flex", alignItems: "center", gap: isNarrow ? 12 : 16,
      padding: isNarrow ? "14px 16px" : "18px 24px",
      opacity: passed ? 0.55 : 1,
    }}>
      <span style={{
        width: 32, height: 32, borderRadius: 999,
        background: "rgba(110,90,71,0.08)",
        display: "flex", alignItems: "center", justifyContent: "center",
        color: "var(--ink-2)", flexShrink: 0,
      }}><Icon size={16} /></span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div className="serif" style={{ fontSize: isNarrow ? 19 : 22, color: "var(--ink)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", lineHeight: 1.1 }}>{d.label}</div>
        <div className="sans" style={{ color: "var(--ink-3)", fontSize: 13, marginTop: 4, display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
          <span>{dateLabel}</span>
          {isNarrow && (
            <span className="tnum" style={{ color: countdownColor }}>· {countdown}</span>
          )}
        </div>
      </div>
      {!isNarrow && (
        <span className="sans tnum" style={{ color: countdownColor, fontSize: 14, whiteSpace: "nowrap" }}>
          {countdown}
        </span>
      )}
      <div style={{ display: "flex", gap: isNarrow ? 10 : 14, color: "var(--ink-3)", flexShrink: 0 }}>
        {!passed && <button onClick={() => onEdit(d)}><IconPencil size={16}/></button>}
        <button onClick={onRemove}>×</button>
      </div>
    </div>
  );
}

function DDaysSection({ onAdd, onEdit }) {
  const f = useFolio();
  const today = todayISO();
  const active = f.state.d_days.filter(d => daysBetween(today, d.target) >= 0);
  const passed = f.state.d_days.filter(d => daysBetween(today, d.target) < 0);
  const remove = (d) => { if (confirm("Remove this d-day?")) f.actions.removeDDay(d.id); };
  return (
    <>
      <SectionHeader title="d-days" sub={`${active.length} active${passed.length ? ` · ${passed.length} archived` : ""}`} />
      <div style={{ display: "flex", flexDirection: "column", gap: 12, marginTop: 28 }}>
        {active.map(d => (
          <DDayRow key={d.id} d={d} passed={false} onEdit={onEdit} onRemove={() => remove(d)} />
        ))}
      </div>
      <button onClick={onAdd} style={{
        marginTop: 22, padding: "14px 26px", borderRadius: 999,
        border: "1.5px dashed rgba(110,90,71,0.35)",
        color: "var(--ink-2)", display: "inline-flex", alignItems: "center", gap: 10,
        alignSelf: "flex-start", background: "transparent",
      }}>
        <span style={{ fontSize: 18 }}>+</span>
        <span className="serif" style={{ fontSize: 19 }}>add d-day</span>
      </button>
      {passed.length > 0 && (
        <>
          <div className="smallcaps" style={{ color: "var(--ink-3)", marginTop: 44, marginBottom: 14 }}>archived</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {passed.map(d => (
              <DDayRow key={d.id} d={d} passed={true} onEdit={onEdit} onRemove={() => remove(d)} />
            ))}
          </div>
        </>
      )}
    </>
  );
}

function GoalsSection() {
  const f = useFolio();
  const daily = f.state.goals.daily_seconds / 3600;
  const weekly = f.state.goals.weekly_seconds / 3600;
  return (
    <>
      <SectionHeader title="goals" sub="daily and weekly targets" />
      <div style={{ maxWidth: 560, marginTop: 36 }}>
        <Slider label="Daily goal" min={0.5} max={14} step={0.5} value={daily} unit="h"
          onChange={(v) => f.actions.setGoals({ daily_seconds: v * 3600, weekly_seconds: v * 7 * 3600 })}
        />
        <Slider label="Weekly goal" min={5} max={98} step={0.5} value={weekly} unit="h"
          onChange={(v) => f.actions.setGoals({ weekly_seconds: v * 3600 })}
        />
      </div>
      <div className="card" style={{ padding: "22px 28px", marginTop: 18, maxWidth: 560 }}>
        <div className="smallcaps" style={{ color: "var(--ink-3)", marginBottom: 10 }}>Streak freezes</div>
        <div className="serif" style={{ fontSize: 18, color: "var(--ink-2)", lineHeight: 1.55 }}>
          you receive two freezes per week. they auto-protect a missed day, quietly. you currently have <span style={{ color: "var(--ink)" }}>{f.state.goals.streak_freezes_available} available</span>.
        </div>
      </div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", maxWidth: 560, marginTop: 24 }}>
        <span className="sans" style={{ fontSize: 16, color: "var(--ink)" }}>use weekly goal mode</span>
        <Toggle on={f.state.goals.weekly_goal_mode} onChange={(v) => f.actions.setGoals({ weekly_goal_mode: v })} />
      </div>
    </>
  );
}

function PomodoroSection() {
  const f = useFolio();
  const p = f.state.pomodoro;
  return (
    <>
      <SectionHeader title="pomodoro" sub="optional structured cycles" />
      <p className="serif" style={{ color: "var(--ink-2)", fontSize: 17, marginTop: 16, maxWidth: 560 }}>
        if you prefer structured study, customize your pomodoro cycle here. otherwise, leave it off and use the stopwatch.
      </p>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", maxWidth: 560, marginTop: 22 }}>
        <span className="sans" style={{ fontSize: 16, color: "var(--ink)" }}>enable pomodoro mode</span>
        <Toggle on={p.enabled} onChange={(v) => f.actions.setPomodoro({ enabled: v })} />
      </div>
      {p.enabled && (
        <>
          <div style={{ marginTop: 36, maxWidth: 560 }}>
            <Slider label="Work"        min={5} max={90} step={1} value={p.work_min} unit=" min" onChange={(v) => f.actions.setPomodoro({ work_min: v })} />
            <Slider label="Short break" min={1} max={30} step={1} value={p.short_break_min} unit=" min" onChange={(v) => f.actions.setPomodoro({ short_break_min: v })} />
            <Slider label="Long break"  min={5} max={60} step={1} value={p.long_break_min} unit=" min" onChange={(v) => f.actions.setPomodoro({ long_break_min: v })} />
            <Slider label="Cycles before long break" min={2} max={8} step={1} value={p.cycles_before_long} unit="" onChange={(v) => f.actions.setPomodoro({ cycles_before_long: v })} />
          </div>
          <div style={{ display: "flex", gap: 10, marginTop: 6 }}>
            {[
              { name: "classic 25/5",  work: 25, sb: 5,  lb: 15 },
              { name: "deep 50/10",    work: 50, sb: 10, lb: 20 },
              { name: "ultra 90/20",   work: 90, sb: 20, lb: 30 },
            ].map(preset => (
              <button key={preset.name} onClick={() => f.actions.setPomodoro({ work_min: preset.work, short_break_min: preset.sb, long_break_min: preset.lb })} className="sans"
                style={{ padding: "10px 18px", borderRadius: 999, background: "var(--surface)", boxShadow: "var(--shadow-soft)", fontSize: 13, color: "var(--ink-2)" }}>
                {preset.name}
              </button>
            ))}
          </div>
        </>
      )}
    </>
  );
}

function ThemeSection() {
  const f = useFolio();
  const themes = [
    { id: "sepia", label: "sepia", swatches: ["#f2e6d2", "#fbf4e4", "#b85c3c", "#2a1d12"] },
    { id: "light", label: "light", swatches: ["#faf7f2", "#ffffff", "#b85c3c", "#2a1d12"] },
    { id: "dark",  label: "dark",  swatches: ["#1d160f", "#28201a", "#d97a55", "#f0e5d0"] },
    { id: "cyan",  label: "cyan",  swatches: ["#e2ecf0", "#f1f7fa", "#1c8aa3", "#142932"] },
  ];
  return (
    <>
      <SectionHeader title="theme" sub="four modes" />
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 16, marginTop: 28, maxWidth: 760 }}>
        {themes.map(t => {
          const isActive = t.id === f.state.profile.theme;
          return (
            <button key={t.id} onClick={() => f.actions.setProfile({ theme: t.id })} className="lift"
              style={{
                background: "var(--surface)", borderRadius: 14, padding: "22px 22px",
                textAlign: "left", boxShadow: "var(--shadow-soft)",
                border: isActive ? "1.5px solid var(--accent)" : "1.5px solid transparent",
              }}>
              <div className="serif" style={{ fontSize: 24, color: "var(--ink)" }}>{t.label}</div>
              <div style={{ display: "flex", gap: 6, marginTop: 16 }}>
                {t.swatches.map((c, i) => (
                  <span key={i} style={{ width: 22, height: 22, borderRadius: 999, background: c, border: "1px solid rgba(0,0,0,0.06)" }}/>
                ))}
              </div>
            </button>
          );
        })}
      </div>
    </>
  );
}

function makeInitials(handle, display_name) {
  const s = (display_name && display_name.trim()) || (handle || '');
  const c = s.replace(/^@/, '').trim();
  if (!c) return '··';
  const parts = c.split(/[\s._-]+/).filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return c.slice(0, 2).toUpperCase();
}

function canvasToJpegBlob(canvas, quality) {
  return new Promise((resolve, reject) => {
    canvas.toBlob(b => b ? resolve(b) : reject(new Error('image encode failed')), 'image/jpeg', quality);
  });
}

// Encode canvas as JPEG, ratcheting quality down until under ~100KB.
async function encodeUnderLimit(canvas) {
  let q = 0.82;
  let blob = await canvasToJpegBlob(canvas, q);
  while (blob.size > 100 * 1024 && q > 0.55) {
    q -= 0.12;
    blob = await canvasToJpegBlob(canvas, q);
  }
  return blob;
}

function CropModal({ file, onCancel, onSave }) {
  const [imgEl, setImgEl] = React.useState(null);
  const [scale, setScale] = React.useState(1);
  const [offset, setOffset] = React.useState({ x: 0, y: 0 });
  const [dragging, setDragging] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState("");
  const dragRef = React.useRef(null);

  const containerSize = 280;
  const outputSize = 512;

  React.useEffect(() => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      setImgEl(img);
      setScale(1);
      setOffset({ x: 0, y: 0 });
    };
    img.onerror = () => setError("couldn't read image");
    img.src = url;
    return () => URL.revokeObjectURL(url);
  }, [file]);

  // scale=1 makes the image cover the container (CSS object-fit:cover style).
  // Then userScale (1-4) zooms further in.
  const baseScale = imgEl ? Math.max(containerSize / imgEl.naturalWidth, containerSize / imgEl.naturalHeight) : 1;
  const displayedWidth  = imgEl ? imgEl.naturalWidth  * baseScale * scale : containerSize;
  const displayedHeight = imgEl ? imgEl.naturalHeight * baseScale * scale : containerSize;

  const clampOffset = (ox, oy) => {
    const maxX = Math.max(0, (displayedWidth  - containerSize) / 2);
    const maxY = Math.max(0, (displayedHeight - containerSize) / 2);
    return {
      x: Math.max(-maxX, Math.min(maxX, ox)),
      y: Math.max(-maxY, Math.min(maxY, oy)),
    };
  };

  // Re-clamp offset when scale changes — zooming out shrinks the valid range.
  React.useEffect(() => {
    setOffset((prev) => clampOffset(prev.x, prev.y));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scale, imgEl]);

  const onPointerDown = (e) => {
    if (busy || !imgEl) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    dragRef.current = { startX: e.clientX - offset.x, startY: e.clientY - offset.y };
    setDragging(true);
  };
  const onPointerMove = (e) => {
    if (!dragRef.current) return;
    setOffset(clampOffset(e.clientX - dragRef.current.startX, e.clientY - dragRef.current.startY));
  };
  const onPointerUp = (e) => {
    dragRef.current = null;
    setDragging(false);
    try { e.currentTarget.releasePointerCapture(e.pointerId); } catch (_) {}
  };

  const handleSave = async () => {
    if (!imgEl || busy) return;
    setBusy(true);
    setError("");
    try {
      const totalScale = baseScale * scale;
      const imageLeft = (containerSize - displayedWidth)  / 2 + offset.x;
      const imageTop  = (containerSize - displayedHeight) / 2 + offset.y;
      const sx = -imageLeft / totalScale;
      const sy = -imageTop  / totalScale;
      const sSize = containerSize / totalScale;

      const canvas = document.createElement('canvas');
      canvas.width = outputSize;
      canvas.height = outputSize;
      const ctx = canvas.getContext('2d');
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, outputSize, outputSize);
      ctx.drawImage(imgEl, sx, sy, sSize, sSize, 0, 0, outputSize, outputSize);

      const blob = await encodeUnderLimit(canvas);
      await onSave(blob);
      // Parent unmounts the modal on success.
    } catch (e) {
      console.error('crop save failed:', e);
      setError(e.message || "save failed");
      setBusy(false);
    }
  };

  return (
    <Modal onClose={busy ? () => {} : onCancel}>
      <div className="smallcaps" style={{ color: "var(--accent)", marginBottom: 16 }}>
        Crop your photo
      </div>

      <div style={{ display: "flex", justifyContent: "center", marginBottom: 22 }}>
        <div
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
          style={{
            width: containerSize, height: containerSize,
            borderRadius: "50%",
            overflow: "hidden",
            background: "var(--surface-2)",
            position: "relative",
            touchAction: "none",
            cursor: imgEl ? (dragging ? "grabbing" : "grab") : "default",
            boxShadow: "0 0 0 1px rgba(110,90,71,0.18)",
          }}
        >
          {imgEl && (
            <img
              src={imgEl.src}
              alt=""
              draggable={false}
              style={{
                position: "absolute",
                width: displayedWidth, height: displayedHeight,
                left: (containerSize - displayedWidth)  / 2 + offset.x,
                top:  (containerSize - displayedHeight) / 2 + offset.y,
                userSelect: "none",
                pointerEvents: "none",
              }}
            />
          )}
        </div>
      </div>

      <div style={{ marginBottom: error ? 10 : 22 }}>
        <div className="smallcaps" style={{ color: "var(--ink-3)", marginBottom: 8 }}>Zoom</div>
        <input
          type="range" min="1" max="4" step="0.01"
          value={scale}
          onChange={(e) => setScale(Number(e.target.value))}
          disabled={busy || !imgEl}
          style={{ width: "100%", accentColor: "var(--accent)" }}
        />
      </div>

      {error && (
        <div className="sans" style={{ color: "var(--accent)", fontSize: 13, marginBottom: 14 }}>{error}</div>
      )}

      <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
        <button onClick={onCancel} disabled={busy} className="sans"
          style={{ padding: "10px 22px", borderRadius: 999, color: "var(--ink-2)", fontSize: 14, opacity: busy ? 0.5 : 1 }}>
          cancel
        </button>
        <button onClick={handleSave} disabled={busy || !imgEl} className="sans"
          style={{
            padding: "10px 28px", borderRadius: 999,
            background: "var(--accent)", color: "var(--surface)", fontSize: 14,
            opacity: (busy || !imgEl) ? 0.6 : 1,
          }}>
          {busy ? "saving…" : "save"}
        </button>
      </div>
    </Modal>
  );
}

function AvatarUploader() {
  const f = useFolio();
  const { user } = useAuth();
  const isMobile = useMediaQuery("(max-width: 640px)");
  const p = f.state.profile;
  const inputRef = React.useRef(null);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState("");
  const [pendingFile, setPendingFile] = React.useState(null);
  const initials = makeInitials(p.handle, p.display_name);

  const pick = () => { if (!busy) inputRef.current?.click(); };

  const onFile = (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (!file.type.startsWith("image/")) { setError("please pick an image file"); return; }
    setError("");
    setPendingFile(file);
  };

  const uploadBlob = async (blob) => {
    setBusy(true);
    setError("");
    try {
      const path = `${user.id}/avatar.jpg`;
      const up = await supabase.storage.from('avatars').upload(path, blob, {
        contentType: 'image/jpeg',
        upsert: true,
        cacheControl: '3600',
      });
      if (up.error) throw up.error;
      const { data: pub } = supabase.storage.from('avatars').getPublicUrl(path);
      const url = `${pub.publicUrl}?t=${Date.now()}`;
      await f.actions.setProfile({ avatar_url: url });
      setPendingFile(null);
    } catch (err) {
      console.error('avatar upload failed:', err);
      setError(err.message || "upload failed");
      throw err; // bubble to CropModal so it can show + stay open
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    if (busy) return;
    setBusy(true); setError("");
    try {
      const path = `${user.id}/avatar.jpg`;
      await supabase.storage.from('avatars').remove([path]).catch(() => {});
      await f.actions.setProfile({ avatar_url: null });
    } catch (err) {
      console.error('avatar remove failed:', err);
      setError(err.message || "remove failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <div style={{ display: "flex", alignItems: isMobile ? "flex-start" : "center", gap: isMobile ? 16 : 22, marginTop: 28, maxWidth: 640 }}>
        <button onClick={pick} disabled={busy} title="change profile picture"
          style={{ padding: 0, borderRadius: 999, cursor: busy ? "default" : "pointer", opacity: busy ? 0.6 : 1 }}>
          <Avatar initials={initials} src={p.avatar_url} size={88} ring />
        </button>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <div className="smallcaps" style={{ color: "var(--ink-3)" }}>Profile picture</div>
          <div style={{ display: "flex", gap: 18, alignItems: "center" }}>
            <button onClick={pick} disabled={busy} className="sans" style={{ color: "var(--accent)", fontSize: 14 }}>
              {busy ? "uploading…" : (p.avatar_url ? "change" : "upload")}
            </button>
            {p.avatar_url && !busy && (
              <button onClick={remove} className="sans" style={{ color: "var(--ink-3)", fontSize: 14 }}>
                remove
              </button>
            )}
          </div>
          {error
            ? <div className="sans" style={{ color: "var(--accent)", fontSize: 12 }}>{error}</div>
            : <div className="sans" style={{ color: "var(--ink-3)", fontSize: 12 }}>drag to position, then save</div>}
        </div>
        <input ref={inputRef} type="file" accept="image/*" onChange={onFile} style={{ display: "none" }} />
      </div>
      {pendingFile && (
        <CropModal
          file={pendingFile}
          onCancel={() => setPendingFile(null)}
          onSave={uploadBlob}
        />
      )}
    </>
  );
}

function ProfileSection() {
  const f = useFolio();
  const p = f.state.profile;
  const isMobile = useMediaQuery("(max-width: 640px)");
  const [domain, setDomain] = React.useState("");
  const [handleDraft, setHandleDraft] = React.useState(p.handle);
  const [displayDraft, setDisplayDraft] = React.useState(p.display_name);
  const [handleStatus, setHandleStatus] = React.useState("");
  const [handleError, setHandleError] = React.useState("");
  const [checkingHandle, setCheckingHandle] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const handleCheckRef = React.useRef(0);
  React.useEffect(() => {
    setHandleDraft(p.handle);
    setHandleStatus("");
    setHandleError("");
  }, [p.handle]);
  React.useEffect(() => { setDisplayDraft(p.display_name); }, [p.display_name]);

  const normalizedHandle = normalizeHandle(handleDraft);
  const handleChanged = normalizedHandle !== p.handle;
  const handleTooShort = handleChanged && normalizedHandle.length > 0 && normalizedHandle.length < HANDLE_MIN_LENGTH;
  const blockingHandleError = normalizedHandle.length === 0
    ? "handle required"
    : handleTooShort
      ? `use at least ${HANDLE_MIN_LENGTH} characters`
      : handleError === "username taken"
        ? handleError
        : "";
  const handleHelp = blockingHandleError || handleStatus;
  const handleHelpColor = blockingHandleError
    ? "var(--accent)"
    : handleStatus === "available"
      ? "var(--ink-2)"
      : "var(--ink-3)";
  const isDirty = handleChanged || displayDraft !== p.display_name;
  const canSave = isDirty && !blockingHandleError && !saving;

  const checkHandleAvailability = async (candidate = normalizedHandle) => {
    const value = normalizeHandle(candidate);
    const seq = handleCheckRef.current + 1;
    handleCheckRef.current = seq;
    setHandleStatus("");
    setHandleError("");

    if (!value || value === p.handle || value.length < HANDLE_MIN_LENGTH) return;

    setCheckingHandle(true);
    try {
      const { data, error } = await supabase.rpc('is_handle_available', { p_handle: value });
      if (seq !== handleCheckRef.current) return;
      if (error) {
        console.warn('handle availability check failed:', error);
        setHandleStatus("availability checked on save");
        return;
      }
      if (data) setHandleStatus("available");
      else setHandleError("username taken");
    } catch (error) {
      if (seq !== handleCheckRef.current) return;
      console.warn('handle availability check failed:', error);
      setHandleStatus("availability checked on save");
    } finally {
      if (seq === handleCheckRef.current) setCheckingHandle(false);
    }
  };

  const saveIdentity = async () => {
    if (!canSave) return;
    setSaving(true);
    setHandleStatus("");
    setHandleError("");
    try {
      const patch = {};
      if (normalizedHandle !== p.handle)        patch.handle = normalizedHandle;
      if (displayDraft     !== p.display_name)  patch.display_name = displayDraft;
      if (Object.keys(patch).length) await f.actions.setProfile(patch);
    } catch (e) {
      console.error('profile save failed:', e);
      if (isUniqueHandleError(e)) setHandleError("username taken");
      else setHandleError("couldn't save profile");
    } finally {
      setSaving(false);
    }
  };

  const Row = ({ label, children }) => (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, padding: "14px 0", borderBottom: "1px solid rgba(110,90,71,0.12)" }}>
      <span className="sans" style={{ fontSize: 15, color: "var(--ink)" }}>{label}</span>
      {children}
    </div>
  );
  const addDomain = () => {
    const v = domain.trim().toLowerCase();
    if (!v || p.study_domains.includes(v)) return;
    f.actions.setProfile({ study_domains: [...p.study_domains, v] });
    setDomain("");
  };
  return (
    <>
      <SectionHeader title="profile & privacy" sub="how others see you" />
      <AvatarUploader />
      <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: isMobile ? 16 : 24, marginTop: 28, maxWidth: 640 }}>
        <div>
          <div className="smallcaps" style={{ color: "var(--ink-3)", marginBottom: 10 }}>Handle</div>
          <div className="card" style={{ padding: "12px 18px", display: "flex", alignItems: "center", gap: 6 }}>
            <span className="serif" style={{ color: "var(--ink-3)", fontSize: 18 }}>@</span>
            <input
              value={handleDraft}
              onChange={(e) => {
                setHandleDraft(e.target.value.toLowerCase());
                setHandleStatus("");
                setHandleError("");
              }}
              onBlur={() => checkHandleAvailability()}
              onKeyDown={(e) => { if (e.key === "Enter") saveIdentity(); }}
              className="serif" style={{ fontSize: 18, color: "var(--ink)", width: "100%" }}
            />
          </div>
          <div className="sans" style={{ fontSize: 12, color: handleHelpColor, marginTop: 8, minHeight: 16 }}>
            {checkingHandle ? "checking…" : handleHelp}
          </div>
        </div>
        <div>
          <div className="smallcaps" style={{ color: "var(--ink-3)", marginBottom: 10 }}>Display name</div>
          <div className="card" style={{ padding: "12px 18px" }}>
            <input
              value={displayDraft}
              onChange={(e) => setDisplayDraft(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") saveIdentity(); }}
              placeholder="optional" className="sans"
              style={{ fontSize: 15, color: "var(--ink)", width: "100%" }}
            />
          </div>
        </div>
      </div>
      <div style={{ maxWidth: 640, marginTop: 14, display: "flex", justifyContent: "flex-end", minHeight: 36 }}>
        {isDirty && (
          <button
            onClick={saveIdentity}
            disabled={!canSave}
            className="sans"
            style={{
              padding: "9px 22px", borderRadius: 999, fontSize: 14,
              background: canSave ? "var(--accent)" : "rgba(110,90,71,0.18)",
              color: canSave ? "var(--surface)" : "var(--ink-3)",
              cursor: canSave ? "pointer" : "default",
            }}
          >
            {saving ? "saving…" : "save"}
          </button>
        )}
      </div>
      <div style={{ marginTop: 36, maxWidth: 640 }}>
        <div className="smallcaps" style={{ color: "var(--ink-3)", marginBottom: 6 }}>Visibility</div>
        <Row label="show subjects on my profile"><Toggle on={p.show_subjects} onChange={(v) => f.actions.setProfile({ show_subjects: v })} /></Row>
        <Row label="show longest session"><Toggle on={p.show_longest} onChange={(v) => f.actions.setProfile({ show_longest: v })} /></Row>
        <Row label="show best week"><Toggle on={p.show_best_week} onChange={(v) => f.actions.setProfile({ show_best_week: v })} /></Row>
        <Row label="appear in &lsquo;currently studying&rsquo; count"><Toggle on={p.appear_in_currently_studying} onChange={(v) => f.actions.setProfile({ appear_in_currently_studying: v })} /></Row>
        <Row label="share my tasks with group members"><Toggle on={p.tasks_public} onChange={(v) => f.actions.setProfile({ tasks_public: v })} /></Row>
      </div>
      <div style={{ marginTop: 36, maxWidth: 640 }}>
        <div className="smallcaps" style={{ color: "var(--ink-3)", marginBottom: 8 }}>Study domains</div>
        <p className="serif" style={{ color: "var(--ink-2)", fontSize: 16, lineHeight: 1.55, marginTop: 4 }}>
          sites you keep open while studying. you can tag them for your own records.
        </p>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 14 }}>
          {p.study_domains.map(d => (
            <span key={d} className="sans" style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "8px 14px", background: "var(--surface)", borderRadius: 999, fontSize: 14, boxShadow: "var(--shadow-soft)" }}>
              {d}
              <button onClick={() => f.actions.setProfile({ study_domains: p.study_domains.filter(x => x !== d) })} style={{ color: "var(--ink-3)", lineHeight: 1 }}>&times;</button>
            </span>
          ))}
        </div>
        <div style={{ display: "flex", gap: 10, marginTop: 14, flexDirection: isMobile ? "column" : "row" }}>
          <input value={domain} onChange={(e)=>setDomain(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") addDomain(); }}
            placeholder="example.com" className="sans"
            style={{ flex: 1, padding: "12px 16px", borderRadius: 12, background: "var(--surface)", boxShadow: "var(--shadow-soft)", fontSize: 14, color: "var(--ink)" }}
          />
          <button onClick={addDomain} className="sans" style={{ padding: "12px 22px", borderRadius: 12, background: "var(--accent)", color: "var(--surface)", fontSize: 14 }}>add</button>
        </div>
      </div>
    </>
  );
}

function AccountSection() {
  const { user } = useAuth();
  const [signingOut, setSigningOut] = React.useState(false);
  const [showDelete, setShowDelete] = React.useState(false);
  const provider = user?.app_metadata?.provider || "email";
  const handleSignOut = async () => {
    setSigningOut(true);
    await supabase.auth.signOut();
  };
  return (
    <>
      <SectionHeader title="account" sub="email & access" />
      <div style={{ marginTop: 28, maxWidth: 560, display: "flex", flexDirection: "column", gap: 18 }}>
        <div className="card" style={{ padding: "18px 22px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <div className="smallcaps" style={{ color: "var(--ink-3)" }}>Email</div>
            <div className="sans" style={{ color: "var(--ink)", marginTop: 4 }}>{user?.email || "—"}</div>
          </div>
          <span className="smallcaps" style={{ color: "var(--ink-3)", fontSize: 10 }}>
            via {provider}
          </span>
        </div>
        <button onClick={handleSignOut} disabled={signingOut} className="sans" style={{
          padding: "12px 22px", borderRadius: 12, background: "var(--surface)",
          boxShadow: "var(--shadow-soft)", color: "var(--ink-2)", fontSize: 14,
          alignSelf: "flex-start", marginTop: 4, opacity: signingOut ? 0.6 : 1,
        }}>
          {signingOut ? "signing out…" : "sign out"}
        </button>
        <div style={{ marginTop: 32, padding: "18px 22px", borderRadius: 12, border: "1px solid rgba(184,92,60,0.3)" }}>
          <div className="smallcaps" style={{ color: "var(--accent)", marginBottom: 6 }}>Danger</div>
          <p className="serif" style={{ color: "var(--ink-2)", fontSize: 15, lineHeight: 1.55, margin: "6px 0 14px" }}>
            deleting your account is permanent. all sessions, journal entries, and group memberships will be removed.
          </p>
          <button onClick={() => setShowDelete(true)} className="sans" style={{ color: "var(--accent)", fontSize: 14 }}>delete account</button>
        </div>
      </div>
      {showDelete && <DeleteAccountModal onClose={() => setShowDelete(false)} />}
    </>
  );
}

function DeleteAccountModal({ onClose }) {
  const [confirm, setConfirm] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState("");
  const canDelete = confirm.trim().toLowerCase() === "delete" && !busy;

  const handleDelete = async () => {
    if (!canDelete) return;
    setBusy(true);
    setError("");
    const { data, error: invokeError } = await supabase.functions.invoke("delete-account");
    if (invokeError || data?.error) {
      setError(invokeError?.message || data?.error || "deletion failed");
      setBusy(false);
      return;
    }
    // Account is gone. Sign out clears local session; AuthProvider gates back to auth screen.
    await supabase.auth.signOut();
  };

  return (
    <Modal onClose={busy ? () => {} : onClose}>
      <div className="smallcaps" style={{ color: "var(--accent)", marginBottom: 16 }}>Delete account</div>
      <p className="serif" style={{ color: "var(--ink-2)", fontSize: 17, lineHeight: 1.55, margin: "0 0 18px" }}>
        this permanently removes your profile, sessions, journal, d-days, and group memberships. this cannot be undone.
      </p>
      <div className="smallcaps" style={{ color: "var(--ink-3)", marginBottom: 8 }}>Type <span style={{ color: "var(--accent)" }}>delete</span> to confirm</div>
      <input value={confirm} onChange={(e) => setConfirm(e.target.value)} autoFocus className="sans"
        style={{ width: "100%", fontSize: 16, padding: "10px 14px", borderRadius: 10, background: "var(--surface-2)", marginBottom: 14, color: "var(--ink)" }}
      />
      {error && (
        <div className="sans" style={{ color: "var(--accent)", fontSize: 13, marginBottom: 14 }}>{error}</div>
      )}
      <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
        <button onClick={onClose} disabled={busy} className="sans" style={{ padding: "10px 22px", borderRadius: 999, color: "var(--ink-2)", fontSize: 14, opacity: busy ? 0.5 : 1 }}>cancel</button>
        <button onClick={handleDelete} disabled={!canDelete} className="sans" style={{
          padding: "10px 28px", borderRadius: 999,
          background: "var(--accent)", color: "var(--surface)", fontSize: 14,
          opacity: canDelete ? 1 : 0.5,
        }}>
          {busy ? "deleting…" : "delete forever"}
        </button>
      </div>
    </Modal>
  );
}

function DataSection() {
  const f = useFolio();
  const exportCSV = () => {
    const rows = [["id","subject","started_at","ended_at","duration_seconds","mode"]];
    for (const s of f.state.sessions) {
      const sub = f.subjectMap[s.subject_id];
      rows.push([s.id, sub?.name || "", s.started_at, s.ended_at, s.duration_seconds, s.mode]);
    }
    const csv = rows.map(r => r.map(c => `"${String(c)}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `folio-sessions-${todayISO()}.csv`;
    a.click();
  };
  const exportMD = () => {
    const md = Object.entries(f.state.journal)
      .filter(([_, c]) => (c || "").trim().length > 0)
      .sort((a, b) => b[0].localeCompare(a[0]))
      .map(([d, c]) => `## ${d}\n\n${c}\n`)
      .join("\n");
    const blob = new Blob([md], { type: "text/markdown" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `folio-journal-${todayISO()}.md`;
    a.click();
  };
  return (
    <>
      <SectionHeader title="data & export" sub="your data, your file" />
      <div style={{ marginTop: 28, maxWidth: 560, display: "flex", flexDirection: "column", gap: 12 }}>
        <button onClick={exportCSV} className="lift" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "18px 22px", background: "var(--surface)", boxShadow: "var(--shadow-soft)", borderRadius: 12 }}>
          <div style={{ textAlign: "left" }}>
            <div className="serif" style={{ fontSize: 20, color: "var(--ink)" }}>export sessions as csv</div>
            <div className="smallcaps" style={{ color: "var(--ink-3)", marginTop: 4 }}>{f.state.sessions.length} sessions</div>
          </div>
          <IconArrow size={16} />
        </button>
        <button onClick={exportMD} className="lift" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "18px 22px", background: "var(--surface)", boxShadow: "var(--shadow-soft)", borderRadius: 12 }}>
          <div style={{ textAlign: "left" }}>
            <div className="serif" style={{ fontSize: 20, color: "var(--ink)" }}>export journal as markdown</div>
            <div className="smallcaps" style={{ color: "var(--ink-3)", marginTop: 4 }}>{Object.keys(f.state.journal).filter(k => (f.state.journal[k]||"").trim()).length} entries</div>
          </div>
          <IconArrow size={16} />
        </button>
        <div className="smallcaps" style={{ color: "var(--ink-3)", marginTop: 14 }}>last export · never</div>

        <button onClick={() => { if (confirm("Reset Folio? All sessions, subjects, and journal entries will be replaced with seed data.")) f.actions.resetAll(); }} className="sans" style={{ marginTop: 32, color: "var(--ink-3)", fontSize: 13, alignSelf: "flex-start" }}>
          reset to seed data
        </button>
      </div>
    </>
  );
}
