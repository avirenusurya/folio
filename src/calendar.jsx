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

export function CalendarView() {
  const f = useFolio();
  const isMobile = useMediaQuery("(max-width: 640px)");
  const isTablet = useMediaQuery("(max-width: 900px)");
  const [selectedIso, setSelectedIso] = React.useState(todayISO());

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

          {breakdown.length === 0 ? (
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
