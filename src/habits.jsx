import React from 'react';
import { useFolio, todayISO, toISODate, addDays } from './state.jsx';
import { COLOR_PALETTE, HandUnderline, useMediaQuery } from './shared.jsx';

/* The Habits page — daily habit tracker, viewed at four cadence zoom levels
   (daily / weekly / monthly / yearly). The underlying truth is binary per-day
   done/not-done; aggregate cadences show fill height = done/total. */

const VIEW_KEY = 'folio.habits.view';
const DEFAULT_VIEW = { cadence: 'daily', checkStyle: 'square', density: 'comfortable', showCounter: true };

function loadView() {
  try {
    const saved = JSON.parse(localStorage.getItem(VIEW_KEY) || '{}');
    return { ...DEFAULT_VIEW, ...saved };
  } catch { return { ...DEFAULT_VIEW }; }
}
function saveView(view) {
  try { localStorage.setItem(VIEW_KEY, JSON.stringify(view)); } catch {}
}

const CADENCE_CFG = {
  daily:   { historyLabel: 'last 14 days',   periodLabel: 'today',      cells: 14, cellW: 28, gap: 6  },
  weekly:  { historyLabel: 'last 12 weeks',  periodLabel: 'this week',  cells: 12, cellW: 34, gap: 8  },
  monthly: { historyLabel: 'last 12 months', periodLabel: 'this month', cells: 12, cellW: 48, gap: 10 },
  yearly:  { historyLabel: 'last 6 years',   periodLabel: 'this year',  cells: 6,  cellW: 78, gap: 14 },
};

// Aggregate entries -> buckets for the chosen cadence.
function aggregateByCadence(entries, cadence) {
  const todayDate = new Date(); todayDate.setHours(0, 0, 0, 0);
  const todayMs = todayDate.getTime();
  const buckets = [];

  if (cadence === 'daily') {
    for (let i = 13; i >= 0; i--) {
      const d = addDays(todayDate, -i);
      const iso = toISODate(d);
      buckets.push({
        done: entries[iso] === 'done' ? 1 : 0,
        total: 1,
        current: i === 0,
        label: ['S','M','T','W','T','F','S'][d.getDay()],
        sublabel: d.toDateString(),
      });
    }
    return buckets;
  }

  if (cadence === 'weekly') {
    const dow = (todayDate.getDay() + 6) % 7; // Mon=0
    const thisMon = addDays(todayDate, -dow);
    for (let w = 11; w >= 0; w--) {
      const start = addDays(thisMon, -w * 7);
      let done = 0, total = 0;
      for (let k = 0; k < 7; k++) {
        const d = addDays(start, k);
        if (d.getTime() > todayMs) break;
        total++;
        if (entries[toISODate(d)] === 'done') done++;
      }
      const y0 = new Date(start.getFullYear(), 0, 1);
      const days = Math.floor((start - y0) / 86400000);
      const wn = Math.ceil((days + y0.getDay() + 1) / 7);
      buckets.push({
        done, total,
        current: w === 0,
        label: `${wn}`,
        sublabel: `week of ${start.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }).toLowerCase()} · ${done}/${total} days`,
      });
    }
    return buckets;
  }

  if (cadence === 'monthly') {
    for (let m = 11; m >= 0; m--) {
      const mStart = new Date(todayDate.getFullYear(), todayDate.getMonth() - m, 1);
      const mEnd   = new Date(todayDate.getFullYear(), todayDate.getMonth() - m + 1, 0);
      let done = 0, total = 0;
      for (let d = new Date(mStart); d <= mEnd && d.getTime() <= todayMs; d = addDays(d, 1)) {
        total++;
        if (entries[toISODate(d)] === 'done') done++;
      }
      buckets.push({
        done, total,
        current: m === 0,
        label: mStart.toLocaleString('en-US', { month: 'short' })[0].toUpperCase(),
        sublabel: `${mStart.toLocaleString('en-US', { month: 'long', year: 'numeric' }).toLowerCase()} · ${done}/${total} days`,
      });
    }
    return buckets;
  }

  // yearly
  for (let y = 5; y >= 0; y--) {
    const yr = todayDate.getFullYear() - y;
    const yStart = new Date(yr, 0, 1);
    const yEnd   = new Date(yr, 11, 31);
    let done = 0, total = 0;
    for (let d = new Date(yStart); d <= yEnd && d.getTime() <= todayMs; d = addDays(d, 1)) {
      total++;
      if (entries[toISODate(d)] === 'done') done++;
    }
    buckets.push({
      done, total,
      current: y === 0,
      label: `’${String(yr).slice(2)}`,
      sublabel: `${yr} · ${done}/${total} days`,
    });
  }
  return buckets;
}

// ---------- HABIT CELL ----------

function HabitCell({ bucket, color, size, style, cadence, showCount, onClick }) {
  const { done, total, current, label, sublabel } = bucket;
  const radius = style === 'circle' ? 999 : 6;
  const showTick = style === 'tick';
  const isDaily = cadence === 'daily';
  const ratio = total > 0 ? done / total : 0;
  const fullyDone = isDaily ? !!done : ratio >= 0.999;
  const ringSize = current ? size + 6 : size;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5 }}>
      {label && (
        <div className="smallcaps" style={{ fontSize: 9, color: current ? 'var(--accent)' : 'var(--ink-3)', letterSpacing: '0.12em' }}>
          {label}
        </div>
      )}
      <button
        onClick={onClick}
        title={sublabel}
        disabled={!onClick}
        style={{
          width: ringSize, height: ringSize,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          borderRadius: radius + (current ? 2 : 0),
          background: 'transparent',
          border: current ? '1.5px solid var(--accent)' : 'none',
          padding: 0,
          cursor: onClick ? 'pointer' : 'default',
        }}
      >
        <span
          style={{
            position: 'relative',
            width: size, height: size,
            borderRadius: radius,
            background: isDaily && fullyDone && !showTick ? color : 'transparent',
            boxShadow: isDaily && fullyDone
              ? '0 1px 2px rgba(70,40,20,0.10)'
              : 'inset 0 0 0 1.4px rgba(110,90,71,0.28)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            overflow: 'hidden',
            transition: 'background 180ms, box-shadow 180ms',
          }}
        >
          {/* fill from bottom for aggregate cells */}
          {!isDaily && ratio > 0 && (
            <span style={{
              position: 'absolute', left: 0, right: 0, bottom: 0,
              height: `${Math.max(10, ratio * 100)}%`,
              background: color,
              opacity: 0.92,
              transition: 'height 240ms',
            }} />
          )}
          {showCount && !isDaily && total > 0 && (
            <span className="mono tnum" style={{
              position: 'relative', zIndex: 1,
              fontSize: Math.max(10, size * 0.26),
              color: ratio > 0.55 ? 'var(--surface)' : 'var(--ink-2)',
              fontWeight: 500,
            }}>{done}</span>
          )}
          {isDaily && showTick && fullyDone && (
            <svg width={size * 0.55} height={size * 0.55} viewBox="0 0 16 16" fill="none" stroke={color} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 8.5 L6.5 12 L13 4.5"/>
            </svg>
          )}
        </span>
      </button>
    </div>
  );
}

// ---------- HABIT ROW ----------

function HabitRow({ habit, entries, view, stats, daysSinceCreated, idx, onEdit, onToggleToday, isMobile }) {
  const cfg = CADENCE_CFG[view.cadence];
  const buckets = React.useMemo(() => aggregateByCadence(entries, view.cadence), [entries, view.cadence]);
  const todayDoneNow = entries[todayISO()] === 'done';
  const streak = stats?.streak ?? 0;
  const totalDone = stats?.totalDone ?? 0;
  const allTimePct = daysSinceCreated > 0 ? Math.min(100, Math.round((totalDone / daysSinceCreated) * 100)) : 0;

  const padY = view.density === 'compact' ? 16 : 26;
  const padX = isMobile ? 18 : 28;
  const cellSize = cfg.cellW * (view.density === 'compact' ? 0.86 : 1);
  const gap = cfg.gap * (view.density === 'compact' ? 0.85 : 1);

  const nameBlock = (
    <button
      onClick={onEdit}
      style={{
        display: 'flex', alignItems: 'center', gap: 14, minWidth: 0,
        background: 'transparent', padding: 0, textAlign: 'left', cursor: 'pointer', width: '100%',
      }}
      title="edit habit"
    >
      <span style={{
        width: 12, height: 12, borderRadius: 999,
        background: habit.color, flexShrink: 0,
        boxShadow: '0 1px 1px rgba(70,40,20,0.10)',
      }} />
      <span style={{ minWidth: 0, flex: 1 }}>
        <span className="serif" style={{
          display: 'block', fontSize: isMobile ? 22 : 24, color: 'var(--ink)', lineHeight: 1.1,
          whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
        }}>{habit.name}</span>
        {habit.note && (
          <span className="sans" style={{
            display: 'block', fontSize: 12, color: 'var(--ink-3)', marginTop: 6,
            whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
          }}>{habit.note}</span>
        )}
      </span>
    </button>
  );

  const streakBlock = (
    <div style={{
      display: 'flex', flexDirection: 'column',
      alignItems: isMobile ? 'flex-start' : 'flex-end',
      gap: 4, minWidth: isMobile ? undefined : 96,
    }}>
      <div className="mono tnum" style={{ fontSize: 20, color: 'var(--ink)', lineHeight: 1 }}>{streak}</div>
      <div className="smallcaps" style={{ color: 'var(--ink-3)', fontSize: 10 }}>day streak</div>
      <div className="sans tnum" style={{ fontSize: 11, color: 'var(--ink-3)', marginTop: 4 }}>
        {allTimePct}% all-time
      </div>
    </div>
  );

  const cellsRow = (
    <div style={{
      display: 'flex', alignItems: 'flex-end',
      justifyContent: isMobile ? 'flex-start' : 'flex-end',
      gap, flexWrap: 'nowrap',
      overflowX: isMobile ? 'auto' : 'visible',
      paddingBottom: isMobile ? 4 : 0, // breathing room for scroll on mobile
      WebkitOverflowScrolling: 'touch',
    }}>
      {buckets.map((b, i) => (
        <HabitCell
          key={i}
          bucket={b}
          color={habit.color}
          size={cellSize}
          style={view.checkStyle}
          cadence={view.cadence}
          showCount={view.cadence === 'monthly' || view.cadence === 'yearly'}
          onClick={view.cadence === 'daily' && b.current ? onToggleToday : undefined}
        />
      ))}
    </div>
  );

  return (
    <div
      className="lift"
      style={{
        background: 'var(--surface)',
        borderRadius: 14,
        boxShadow: 'var(--shadow-soft)',
        padding: `${padY}px ${padX}px`,
        animation: 'rise 0.6s cubic-bezier(0.22,1,0.36,1) both',
        animationDelay: `${idx * 70}ms`,
        ...(isMobile
          ? { display: 'flex', flexDirection: 'column', gap: 16 }
          : { display: 'grid', gridTemplateColumns: 'minmax(220px, 1.1fr) 1fr auto', alignItems: 'center', gap: 24 }
        ),
      }}
    >
      {isMobile ? (
        <>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16 }}>
            <div style={{ flex: 1, minWidth: 0 }}>{nameBlock}</div>
            {streakBlock}
          </div>
          {cellsRow}
        </>
      ) : (
        <>
          {nameBlock}
          {cellsRow}
          {streakBlock}
        </>
      )}
    </div>
  );
}

// ---------- STATS ROW ----------

function StatsRow({ habits, habitEntriesByHabit, habitStats }) {
  const today = todayISO();
  const checkedToday = habits.filter(h => habitEntriesByHabit[h.id]?.[today] === 'done').length;
  const longest = habits.reduce((m, h) => Math.max(m, habitStats[h.id]?.streak ?? 0), 0);
  const items = [
    { kicker: 'today',         value: `${checkedToday} / ${habits.length}`, label: 'checked' },
    { kicker: 'longest chain', value: `${longest}`,                          label: 'days' },
    { kicker: 'habits kept',   value: `${habits.length}`,                    label: 'this season' },
  ];
  return (
    <div style={{
      display: 'grid', gridTemplateColumns: '1fr 1fr 1fr',
      alignItems: 'center', maxWidth: 760, margin: '32px auto 0',
    }}>
      {items.map((s, i) => (
        <div key={i} style={{
          textAlign: 'center', padding: '0 12px',
          borderLeft: i === 0 ? 'none' : '1px solid rgba(110,90,71,0.22)',
        }}>
          <div className="smallcaps" style={{ color: 'var(--ink-3)' }}>{s.kicker}</div>
          <div className="serif" style={{ fontSize: 44, color: 'var(--ink)', marginTop: 6, letterSpacing: '-0.01em', fontStyle: 'normal' }}>
            {s.value}
          </div>
          <div className="sans" style={{ fontSize: 12, color: 'var(--ink-3)', marginTop: 2 }}>{s.label}</div>
        </div>
      ))}
    </div>
  );
}

// ---------- CADENCE PICKER ----------

function CadencePicker({ cadence, onChange, isMobile }) {
  const opts = ['daily', 'weekly', 'monthly', 'yearly'];
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: isMobile ? 16 : 26,
      justifyContent: 'center', flexWrap: 'wrap',
      marginTop: 36, marginBottom: 12,
    }}>
      {opts.map((o, i) => (
        <React.Fragment key={o}>
          <button
            onClick={() => onChange(o)}
            style={{
              position: 'relative',
              padding: '4px 2px',
              fontSize: isMobile ? 19 : 22,
              fontFamily: "'Instrument Serif', Georgia, serif",
              fontStyle: 'italic',
              color: cadence === o ? 'var(--accent)' : 'var(--ink-3)',
              transition: 'color 220ms',
              background: 'transparent',
            }}
          >
            {o}
            {cadence === o && (
              <div style={{ position: 'absolute', left: 0, right: 0, bottom: -6, display: 'flex', justifyContent: 'center' }}>
                <HandUnderline width={Math.max(60, o.length * 12)} color="var(--accent)" />
              </div>
            )}
          </button>
          {i < opts.length - 1 && <span style={{ color: 'var(--ink-4)' }}>·</span>}
        </React.Fragment>
      ))}
    </div>
  );
}

// ---------- VIEW SETTINGS POPOVER ----------

function ViewSettings({ view, set, isMobile }) {
  const [open, setOpen] = React.useState(false);
  const wrapRef = React.useRef(null);

  React.useEffect(() => {
    if (!open) return;
    const onDoc = (e) => { if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [open]);

  const segWrap = { display: 'flex', background: 'var(--bg-deep)', borderRadius: 999, padding: 3 };
  const seg = (on) => ({
    flex: 1, padding: '6px 10px', borderRadius: 999, fontSize: 12,
    background: on ? 'var(--surface)' : 'transparent',
    color: on ? 'var(--ink)' : 'var(--ink-3)',
    boxShadow: on ? '0 1px 2px rgba(70,40,20,.10)' : 'none',
    transition: 'background 180ms, color 180ms',
  });
  const label = { fontSize: 10, letterSpacing: '0.16em', textTransform: 'uppercase', color: 'var(--ink-3)', marginBottom: 7 };
  const group = { marginBottom: 14 };

  return (
    <div ref={wrapRef} style={{
      position: 'absolute',
      top: isMobile ? 18 : 36,
      right: isMobile ? 18 : 36,
      zIndex: 30,
    }}>
      <button
        onClick={() => setOpen(o => !o)}
        title="view"
        style={{
          display: 'flex', alignItems: 'center', gap: 8,
          padding: '8px 14px',
          borderRadius: 999,
          background: open ? 'var(--surface-2)' : 'var(--surface)',
          color: 'var(--ink-2)',
          boxShadow: 'var(--shadow-soft)',
          border: `1.5px solid ${open ? 'var(--accent)' : 'transparent'}`,
          transition: 'background 180ms, border-color 180ms',
        }}
      >
        <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M4 7h10"/><circle cx="17" cy="7" r="2.4"/>
          <path d="M20 13h-10"/><circle cx="7" cy="13" r="2.4"/>
          <path d="M4 19h10"/><circle cx="17" cy="19" r="2.4"/>
        </svg>
        <span className="smallcaps" style={{ color: 'var(--ink-2)', fontSize: 10 }}>view</span>
      </button>

      {open && (
        <div style={{
          position: 'absolute', right: 0, top: 'calc(100% + 10px)',
          width: 264,
          background: 'var(--surface)',
          borderRadius: 14,
          boxShadow: 'var(--shadow-card)',
          padding: 18,
        }}>
          <div style={group}>
            <div style={label}>Check style</div>
            <div style={segWrap}>
              {['square','circle','tick'].map(v => (
                <button key={v} style={seg(view.checkStyle === v)} onClick={() => set('checkStyle', v)}>{v}</button>
              ))}
            </div>
          </div>

          <div style={group}>
            <div style={label}>Density</div>
            <div style={segWrap}>
              {['comfortable','compact'].map(v => (
                <button key={v} style={seg(view.density === v)} onClick={() => set('density', v)}>{v}</button>
              ))}
            </div>
          </div>

          <div style={{ ...group, marginBottom: 0 }}>
            <div style={label}>Stats row</div>
            <div style={segWrap}>
              {[['true','show'],['false','hide']].map(([v, lbl]) => (
                <button key={v} style={seg(String(view.showCounter) === v)} onClick={() => set('showCounter', v === 'true')}>{lbl}</button>
              ))}
            </div>
          </div>

          <div className="sans" style={{ fontSize: 11, color: 'var(--ink-3)', marginTop: 14, lineHeight: 1.5 }}>
            saved on this device.
          </div>
        </div>
      )}
    </div>
  );
}

// ---------- EDITOR MODAL ----------

function HabitEditorModal({ habit, open, onClose }) {
  const { actions } = useFolio();
  const isMobile = useMediaQuery('(max-width: 640px)');
  const isNew = !habit;
  const [name, setName]     = React.useState('');
  const [note, setNote]     = React.useState('');
  const [color, setColor]   = React.useState(COLOR_PALETTE[0]);
  const [busy, setBusy]     = React.useState(false);
  const [err, setErr]       = React.useState(null);

  React.useEffect(() => {
    if (!open) return;
    setErr(null); setBusy(false);
    if (habit) {
      setName(habit.name);
      setNote(habit.note || '');
      setColor(habit.color);
    } else {
      setName('');
      setNote('');
      setColor(COLOR_PALETTE[Math.floor(Math.random() * COLOR_PALETTE.length)]);
    }
  }, [open, habit]);

  if (!open) return null;

  const submit = async (e) => {
    e?.preventDefault();
    if (!name.trim() || busy) return;
    setBusy(true); setErr(null);
    try {
      const payload = { name: name.trim(), color, note: note.trim() || null };
      if (isNew) await actions.addHabit(payload);
      else       await actions.updateHabit(habit.id, payload);
      onClose();
    } catch (e) {
      setErr(e.message || "couldn't save");
    } finally {
      setBusy(false);
    }
  };

  const onDelete = async () => {
    if (!habit) return;
    if (!confirm('Delete this habit? All tracked days will be removed.')) return;
    setBusy(true);
    await actions.deleteHabit(habit.id);
    setBusy(false);
    onClose();
  };

  return (
    <div onClick={onClose} style={{
      position: 'fixed', inset: 0, zIndex: 200,
      background: 'rgba(42, 29, 18, 0.55)', backdropFilter: 'blur(6px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24,
    }}>
      <div onClick={e => e.stopPropagation()} style={{
        background: 'var(--surface)', borderRadius: 18,
        boxShadow: 'var(--shadow-card)',
        padding: isMobile ? '26px 20px 24px' : '32px 36px 28px',
        maxWidth: 460, width: '100%',
        maxHeight: 'calc(100vh - 48px)', overflowY: 'auto',
      }}>
        <div className="serif" style={{ fontSize: 28, color: 'var(--ink)', marginBottom: 18, lineHeight: 1.15 }}>
          {isNew ? 'new habit' : 'edit habit'}
        </div>
        <form onSubmit={submit}>
          <div className="smallcaps" style={{ color: 'var(--ink-3)', marginBottom: 6, fontSize: 10 }}>name</div>
          <input
            autoFocus
            value={name}
            onChange={e => setName(e.target.value)}
            maxLength={80}
            placeholder="e.g. read 30 pages"
            style={inputStyle}
          />

          <div className="smallcaps" style={{ color: 'var(--ink-3)', marginTop: 18, marginBottom: 6, fontSize: 10 }}>note (optional)</div>
          <input
            value={note}
            onChange={e => setNote(e.target.value)}
            maxLength={200}
            placeholder="a short reminder of the why"
            style={inputStyle}
          />

          <div className="smallcaps" style={{ color: 'var(--ink-3)', marginTop: 18, marginBottom: 10, fontSize: 10 }}>color</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {COLOR_PALETTE.map(c => (
              <button key={c} type="button" onClick={() => setColor(c)} aria-label={`pick ${c}`} style={{
                width: 28, height: 28, borderRadius: 999, background: c,
                border: color === c ? '2px solid var(--ink)' : '2px solid transparent',
                padding: 0, cursor: 'pointer',
              }} />
            ))}
          </div>

          {err && <div className="sans" style={{ color: 'var(--accent)', marginTop: 14, fontSize: 13 }}>{err}</div>}

          <div style={{ marginTop: 24, display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'center' }}>
            {!isNew ? (
              <button type="button" onClick={onDelete} disabled={busy} className="smallcaps" style={{ padding: '10px 14px', color: 'var(--accent)', fontSize: 11, background: 'transparent' }}>
                delete
              </button>
            ) : <span />}
            <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
              <button type="button" onClick={onClose} className="smallcaps" style={{ padding: '10px 16px', color: 'var(--ink-3)', fontSize: 11, background: 'transparent' }}>cancel</button>
              <button type="submit" disabled={!name.trim() || busy} className="lift sans" style={{
                padding: '10px 24px', borderRadius: 999, background: 'var(--accent)', color: 'var(--surface)', fontSize: 13,
                boxShadow: 'var(--shadow-soft)', opacity: (!name.trim() || busy) ? 0.5 : 1,
              }}>
                {busy ? 'saving…' : (isNew ? 'create →' : 'save')}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}

const inputStyle = {
  width: '100%', padding: '12px 14px', borderRadius: 10,
  border: '1px solid rgba(110,90,71,0.25)', background: 'var(--surface-2)',
  fontFamily: "'Instrument Serif', serif", fontSize: 18, color: 'var(--ink)', outline: 'none',
};

// ---------- MAIN VIEW ----------

export function HabitsView() {
  const f = useFolio();
  const isMobile = useMediaQuery('(max-width: 700px)');
  const habits = f.habitsActive;
  const [view, setView] = React.useState(loadView);
  const [editing, setEditing] = React.useState(null); // null | { mode: 'new' } | habit

  const setViewKey = (k, v) => {
    setView(prev => {
      const next = { ...prev, [k]: v };
      saveView(next);
      return next;
    });
  };

  const today = new Date();
  const todayLabel = today.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' }).toLowerCase();
  const y0 = new Date(today.getFullYear(), 0, 1);
  const days = Math.floor((today - y0) / 86400000);
  const weekNum = Math.ceil((days + y0.getDay() + 1) / 7);

  const cfg = CADENCE_CFG[view.cadence];

  // days-since-created for completion %
  const todayMid = new Date(today); todayMid.setHours(0, 0, 0, 0);
  const daysSinceCreatedMap = React.useMemo(() => {
    const out = {};
    for (const h of habits) {
      const c = new Date(h.created_at); c.setHours(0, 0, 0, 0);
      out[h.id] = Math.max(1, Math.floor((todayMid - c) / 86400000) + 1);
    }
    return out;
  }, [habits, todayMid.getTime()]);

  return (
    <div style={{ position: 'relative', minHeight: '100vh' }}>
      <ViewSettings view={view} set={setViewKey} isMobile={isMobile} />

      <div className="page" style={{
        maxWidth: 1280, margin: '0 auto',
        padding: isMobile ? '70px 18px 130px' : '72px 48px 160px',
      }}>
        <div className="stagger" style={{ display: 'flex', flexDirection: 'column' }}>

          {/* title */}
          <div style={{ textAlign: 'center' }}>
            <h1 className="serif" style={{ fontSize: isMobile ? 44 : 56, margin: 0, color: 'var(--ink)', lineHeight: 1 }}>the habits</h1>
            <div className="smallcaps" style={{ color: 'var(--accent)', marginTop: 16 }}>
              {todayLabel} · week {weekNum}
            </div>
          </div>

          {habits.length > 0 && (
            <>
              <CadencePicker cadence={view.cadence} onChange={(v) => setViewKey('cadence', v)} isMobile={isMobile} />
              {view.showCounter && <StatsRow habits={habits} habitEntriesByHabit={f.habitEntriesByHabit} habitStats={f.habitStats} />}

              <div style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'baseline',
                marginTop: 44, marginBottom: 14, gap: 12, flexWrap: 'wrap',
              }}>
                <div className="smallcaps" style={{ color: 'var(--ink-3)' }}>
                  {habits.length} habit{habits.length === 1 ? '' : 's'} · viewed by {view.cadence}
                </div>
                <div className="smallcaps" style={{ color: 'var(--ink-3)' }}>
                  {cfg.historyLabel}  →  <span style={{ color: 'var(--accent)' }}>{cfg.periodLabel}</span>
                </div>
              </div>
            </>
          )}

          {/* rows */}
          {habits.length === 0 ? (
            <div className="serif" style={{
              textAlign: 'center', marginTop: isMobile ? 36 : 56,
              fontSize: isMobile ? 19 : 22, color: 'var(--ink-3)',
            }}>
              nothing yet — start with one small thing below.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {habits.map((h, idx) => (
                <HabitRow
                  key={h.id}
                  habit={h}
                  entries={f.habitEntriesByHabit[h.id] || {}}
                  view={view}
                  stats={f.habitStats[h.id]}
                  daysSinceCreated={daysSinceCreatedMap[h.id] || 1}
                  idx={idx}
                  onEdit={() => setEditing(h)}
                  onToggleToday={() => f.actions.toggleHabitDone(h.id, todayISO())}
                  isMobile={isMobile}
                />
              ))}
            </div>
          )}

          {/* add habit */}
          <button onClick={() => setEditing({ mode: 'new' })} style={{
            marginTop: 18,
            padding: '20px 24px',
            borderRadius: 14,
            border: '1.5px dashed rgba(110,90,71,0.30)',
            background: 'transparent',
            color: 'var(--ink-3)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
            fontFamily: "'Instrument Serif', Georgia, serif", fontStyle: 'italic',
            fontSize: isMobile ? 18 : 20,
            cursor: 'pointer',
          }}>
            + add a habit
          </button>

          {/* tagline */}
          <div className="serif" style={{
            textAlign: 'center', marginTop: 56, color: 'var(--ink-3)', fontSize: isMobile ? 16 : 18,
          }}>
            small things, on a long enough line.
          </div>
        </div>
      </div>

      <HabitEditorModal
        habit={editing && editing.mode !== 'new' ? editing : null}
        open={!!editing}
        onClose={() => setEditing(null)}
      />
    </div>
  );
}
