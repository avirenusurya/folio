import React from 'react';
import { useFolio, todayISO, toISODate, parseISODate, addDays, startOfWeek } from './state.jsx';
import { IconArrow, useMediaQuery } from './shared.jsx';

/* The Journal — autosaves today's entry, browses past entries (read-only) */

export function JournalView() {
  const f = useFolio();
  const isMobile = useMediaQuery("(max-width: 700px)");
  const isTablet = useMediaQuery("(max-width: 980px)");
  const today = todayISO();
  const [selectedIso, setSelectedIso] = React.useState(today);
  const [text, setText] = React.useState(f.state.journal[today] || "");
  const [savedAt, setSavedAt] = React.useState(null);
  const saveTimerRef = React.useRef(null);

  const isToday = selectedIso === today;
  const viewingText = isToday ? text : (f.state.journal[selectedIso] || "");

  React.useEffect(() => {
    if (!isToday) return;
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      f.actions.setJournal(today, text);
      setSavedAt(new Date());
    }, 600);
    return () => { if (saveTimerRef.current) clearTimeout(saveTimerRef.current); };
  }, [text, isToday]);

  const words = (viewingText || "").trim().split(/\s+/).filter(Boolean).length;

  // recent entries (excluding today, in date desc)
  const recents = Object.entries(f.state.journal)
    .filter(([d, c]) => d !== today && (c || "").trim().length > 0)
    .sort((a, b) => b[0].localeCompare(a[0]))
    .slice(0, 6);

  const todayDate = new Date();
  const dateLabel = todayDate.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" }).toLowerCase();
  const weekNum = (() => {
    const start = new Date(todayDate.getFullYear(), 0, 1);
    const days = Math.floor((todayDate - start) / 86400000);
    return Math.ceil((days + start.getDay() + 1) / 7);
  })();

  // pick this-week editor's note if exists
  const wk = toISODate(startOfWeek(todayDate));
  const lastWk = toISODate(startOfWeek(addDays(todayDate, -7)));
  const editorsNote = f.state.editor_notes[wk] || f.state.editor_notes[lastWk];
  const editorsNoteWeekStart = f.state.editor_notes[wk] ? wk : (f.state.editor_notes[lastWk] ? lastWk : null);

  const editingLabel = (() => {
    if (isToday) return "Today’s entry";
    const d = parseISODate(selectedIso);
    return d.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" }).toLowerCase();
  })();

  return (
    <div className="page" style={{ maxWidth: 1280, margin: "0 auto", padding: isMobile ? "42px 18px 130px" : isTablet ? "56px 28px 150px" : "72px 48px 160px" }}>
      <div className="stagger" style={{ display: "flex", flexDirection: "column" }}>
        <div style={{ textAlign: "center" }}>
          <h1 className="serif" style={{ fontSize: isMobile ? 44 : 56, margin: 0, color: "var(--ink)", whiteSpace: "nowrap" }}>the journal</h1>
          <div className="smallcaps" style={{ color: "var(--accent)", marginTop: 16 }}>{dateLabel} · Week {weekNum}</div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: isTablet ? "1fr" : "1.5fr 1fr", gap: isMobile ? 32 : 56, marginTop: isMobile ? 42 : 56, alignItems: "start" }}>
          <div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 14 }}>
              <div className="smallcaps" style={{ color: "var(--accent)" }}>
                {isToday ? "Today’s entry" : editingLabel}
              </div>
              {!isToday && (
                <button onClick={() => setSelectedIso(today)} className="smallcaps" style={{ color: "var(--ink-3)" }}>
                  ← back to today
                </button>
              )}
            </div>
            <div style={{
              background: "var(--surface)", borderRadius: 14,
              boxShadow: "var(--shadow-soft)",
              padding: isMobile ? "22px 20px 20px" : "30px 34px 26px", position: "relative", minHeight: isMobile ? 330 : 380,
            }}>
              <div style={{
                position: "absolute", inset: 8, borderRadius: 10, pointerEvents: "none",
                opacity: 0.18, mixBlendMode: "multiply",
                background: "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='200' height='200'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch' seed='4'/><feColorMatrix values='0 0 0 0 0.42  0 0 0 0 0.30  0 0 0 0 0.18  0 0 0 0.10 0'/></filter><rect width='100%' height='100%' filter='url(%23n)'/></svg>\")",
              }} />
              {isToday ? (
                <textarea
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  placeholder="write what mattered today…"
                  className="serif"
                  style={{
                    position: "relative", width: "100%", minHeight: 320,
                    resize: "vertical", fontSize: isMobile ? 17 : 18, lineHeight: 1.65,
                    color: "var(--ink)", background: "transparent",
                  }}
                />
              ) : (
                <div className="serif" style={{
                position: "relative", whiteSpace: "pre-wrap",
                  fontSize: isMobile ? 17 : 18, lineHeight: 1.65, color: "var(--ink)",
                  minHeight: 320,
                }}>
                  {viewingText || <span style={{ color: "var(--ink-3)" }}>(no entry)</span>}
                </div>
              )}
            </div>
            <div className="smallcaps" style={{ color: "var(--ink-3)", marginTop: 14 }}>
              {isToday
                ? <>autosaved · {words} {words === 1 ? "word" : "words"}</>
                : <>read-only · {words} {words === 1 ? "word" : "words"}</>}
            </div>
          </div>

          <div>
            {editorsNote ? (
              <div style={{
                background: "var(--surface)", borderRadius: 14,
                padding: isMobile ? "24px 22px 30px" : "30px 34px 36px",
                boxShadow: "var(--shadow-tilt)",
                transform: isMobile ? "none" : "rotate(0.4deg)", position: "relative",
              }}>
                <div className="smallcaps" style={{ color: "var(--accent)", marginBottom: 6 }}>The Editor’s Note</div>
                <div className="serif" style={{ color: "var(--ink-2)", fontSize: 16, marginBottom: 14 }}>
                  week of {parseISODate(editorsNoteWeekStart).toLocaleString("en-US", { month: "long", day: "numeric" }).toLowerCase()} — {parseISODate(toISODate(addDays(parseISODate(editorsNoteWeekStart), 6))).toLocaleString("en-US", { month: "long", day: "numeric" }).toLowerCase()}
                </div>
                <p className="serif" style={{ fontSize: 17, lineHeight: 1.65, color: "var(--ink)", margin: 0 }}>
                  {editorsNote}
                </p>
                <div className="smallcaps" style={{ color: "var(--ink-2)", marginTop: 22, textAlign: "right" }}>— FOLIO, weekly edition</div>
                <div className="sans" style={{ position: "absolute", left: 24, bottom: 14, color: "var(--ink-3)", fontSize: 11, display: "flex", alignItems: "center", gap: 6 }}>
                  <span style={{ color: "var(--accent)" }}>✦</span> ai-written
                </div>
              </div>
            ) : (
              <div className="card" style={{ padding: isMobile ? "24px 22px" : "30px 34px", transform: isMobile ? "none" : "rotate(0.4deg)" }}>
                <div className="smallcaps" style={{ color: "var(--accent)", marginBottom: 12 }}>The Editor’s Note</div>
                <p className="serif" style={{ color: "var(--ink-2)", fontSize: 17, lineHeight: 1.65, margin: 0 }}>
                  your first note arrives sunday at 6pm — a quiet weekly read about what your week of study looked like.
                </p>
              </div>
            )}
          </div>
        </div>

        <div style={{ marginTop: isMobile ? 42 : 56 }}>
          <div className="smallcaps" style={{ color: "var(--ink-3)", marginBottom: 16 }}>Recent entries</div>
          {recents.length === 0 ? (
            <div className="serif" style={{ color: "var(--ink-3)", fontSize: 17 }}>no past entries yet — they’ll appear here after midnight.</div>
          ) : (
            <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : isTablet ? "repeat(2, 1fr)" : "repeat(3, 1fr)", gap: 18 }}>
              {recents.slice(0, 6).map(([d, content]) => {
                const date = parseISODate(d);
                const excerpt = content.trim().split(/\n/)[0].slice(0, 80);
                const wc = content.trim().split(/\s+/).filter(Boolean).length;
                return (
                  <button key={d} onClick={() => setSelectedIso(d)} className="lift" style={{
                    background: "var(--surface)", borderRadius: 12,
                    boxShadow: "var(--shadow-soft)",
                    padding: "20px 22px", textAlign: "left",
                    display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12,
                  }}>
                    <div style={{ minWidth: 0 }}>
                      <div className="serif" style={{ fontSize: 19, color: "var(--ink)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                        {date.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" }).toLowerCase()}
                      </div>
                      <div className="smallcaps" style={{ color: "var(--ink-3)", marginTop: 6, fontSize: 10 }}>
                        {wc} {wc === 1 ? "word" : "words"}
                      </div>
                      <div className="sans" style={{ color: "var(--ink-3)", marginTop: 12, fontSize: 14, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                        {excerpt}…
                      </div>
                    </div>
                    <span style={{ color: "var(--ink-3)", flexShrink: 0 }}><IconArrow size={16} /></span>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
