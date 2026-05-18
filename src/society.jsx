import React from 'react';
import { HandUnderline, Avatar, useMediaQuery } from './shared.jsx';
import { Heatmap } from './calendar.jsx';
import { useFolio, parseISODate, fmtHoursLong } from './state.jsx';
import { useAuth } from './auth-context.jsx';
import { supabase } from './lib/supabase.js';

/* The Society — real groups + leaderboard backed by Supabase. */

// --- helpers -------------------------------------------------------------

function usePresence(groupId, shouldBroadcast, myUserId) {
  const [state, setState] = React.useState({ count: 0, ids: new Set() });
  const channelRef = React.useRef(null);
  const broadcastRef = React.useRef(shouldBroadcast);
  React.useEffect(() => { broadcastRef.current = shouldBroadcast; }, [shouldBroadcast]);

  React.useEffect(() => {
    if (!groupId || !myUserId) { setState({ count: 0, ids: new Set() }); channelRef.current = null; return; }
    const channel = supabase.channel(`society:${groupId}`, {
      config: { presence: { key: myUserId } },
    });
    channel.on('presence', { event: 'sync' }, () => {
      const keys = Object.keys(channel.presenceState());
      setState({ count: keys.length, ids: new Set(keys) });
    });
    channel.subscribe(async (status) => {
      if (status !== 'SUBSCRIBED') return;
      if (broadcastRef.current) await channel.track({});
    });
    channelRef.current = channel;
    return () => {
      channel.unsubscribe();
      channelRef.current = null;
    };
  }, [groupId, myUserId]);

  React.useEffect(() => {
    const ch = channelRef.current;
    if (!ch) return;
    if (shouldBroadcast) ch.track({}); else ch.untrack();
  }, [shouldBroadcast]);

  return state;
}

function initialsFor(handle, display_name) {
  const src = (display_name && display_name.trim()) || (handle || '');
  const cleaned = src.replace(/^@/, '').trim();
  if (!cleaned) return '··';
  const parts = cleaned.split(/[\s._-]+/).filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return cleaned.slice(0, 2).toUpperCase();
}

// --- small UI atoms ------------------------------------------------------

function GroupPill({ name, active, onClick }) {
  return (
    <button
      onClick={onClick}
      className="lift"
      style={{
        padding: "12px 22px",
        borderRadius: 999,
        background: active ? "var(--accent)" : "var(--surface)",
        color: active ? "var(--surface)" : "var(--ink)",
        boxShadow: "var(--shadow-soft)",
        display: "flex", alignItems: "center", gap: 10,
        fontSize: 15,
      }}
    >
      <span style={{
        width: 12, height: 12, borderRadius: 999,
        background: active ? "var(--surface)" : "transparent",
        border: active ? "none" : "1px solid rgba(110,90,71,0.4)",
      }}/>
      <span className="sans" style={{ whiteSpace: "nowrap" }}>{name}</span>
    </button>
  );
}

function DashedPill({ label, onClick }) {
  return (
    <button onClick={onClick} className="lift" style={{
      padding: "12px 22px",
      borderRadius: 999,
      border: "1.5px dashed rgba(110,90,71,0.35)",
      color: "var(--ink-2)",
      display: "flex", alignItems: "center", gap: 10, fontSize: 15,
      background: "transparent",
    }}>
      <span style={{ fontSize: 18, lineHeight: 1 }}>+</span>
      <span className="sans" style={{ whiteSpace: "nowrap" }}>{label}</span>
    </button>
  );
}

function TimeToggleOption({ o, active, onClick }) {
  const textRef = React.useRef(null);
  const [textWidth, setTextWidth] = React.useState(0);
  React.useLayoutEffect(() => {
    if (textRef.current) setTextWidth(textRef.current.offsetWidth);
  }, []);
  return (
    <button onClick={onClick} style={{ position: "relative" }}>
      <span ref={textRef} className="serif" style={{ fontSize: 22, color: active ? "var(--ink)" : "var(--ink-3)", whiteSpace: "nowrap" }}>
        {o}
      </span>
      {active && textWidth > 0 && (
        <span style={{ position: "absolute", left: 0, right: 0, bottom: -7, display: "flex", justifyContent: "center", lineHeight: 0, pointerEvents: "none" }}>
          <HandUnderline width={textWidth + 8} />
        </span>
      )}
    </button>
  );
}

function TimeToggle({ value, onChange }) {
  const opts = ["today", "this week", "all-time"];
  return (
    <div style={{ display: "flex", gap: 24, alignItems: "center", justifyContent: "center" }}>
      {opts.map((o, i) => (
        <React.Fragment key={o}>
          {i > 0 && <span style={{ color: "var(--ink-3)" }}>·</span>}
          <TimeToggleOption o={o} active={value === o} onClick={() => onChange(o)} />
        </React.Fragment>
      ))}
    </div>
  );
}

function LeaderRow({ rank, row, maxSeconds, isPresent, onClick, compact = false, mobile = false }) {
  const handle = '@' + row.handle;
  const initials = initialsFor(row.handle, row.display_name);
  const pct = maxSeconds > 0 ? row.total_seconds / maxSeconds : 0;
  return (
    <button
      onClick={onClick}
      className="lift"
      style={{
        display: "grid",
        gridTemplateColumns: mobile ? "34px 44px 1fr" : compact ? "48px 50px minmax(0, 1fr) 92px" : "76px 56px 1fr 1fr 100px",
        alignItems: "center",
        padding: mobile ? "18px 16px" : compact ? "20px 22px" : "22px 28px",
        background: "var(--surface)",
        borderRadius: mobile ? 14 : 16,
        boxShadow: "var(--shadow-soft)",
        textAlign: "left", width: "100%",
        border: row.is_you ? "1.5px solid rgba(184,92,60,0.55)" : "1.5px solid transparent",
        position: "relative",
      }}
    >
      <div className="sans tnum" style={{ fontSize: mobile ? 16 : 22, color: "var(--ink-3)", fontWeight: 300 }}>
        {String(rank).padStart(2, "0")}
      </div>
      <Avatar initials={initials} src={row.avatar_url} size={mobile ? 36 : 42} />
      <div style={{ marginLeft: mobile ? 10 : 18, minWidth: 0 }}>
        <div className="serif" style={{ fontSize: mobile ? 20 : 22, color: "var(--ink)", lineHeight: 1.1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {handle}
        </div>
        <div className="smallcaps" style={{ color: "var(--ink-3)", marginTop: 6, fontSize: 10 }}>
          {row.current_streak}-day streak
        </div>
      </div>
      {!mobile && !compact && (
      <div style={{ paddingLeft: 16, paddingRight: 24 }}>
        <div style={{ position: "relative", height: 2, borderRadius: 2, background: "rgba(110,90,71,0.18)" }}>
          <div style={{
            position: "absolute", inset: 0, width: `${pct * 100}%`,
            background: "var(--accent)", borderRadius: 2,
          }} />
        </div>
      </div>
      )}
      {!mobile && (
      <div className="serif tnum" style={{ textAlign: "right", fontSize: compact ? 22 : 26, color: "var(--ink)" }}>
        {fmtHoursLong(row.total_seconds)}
      </div>
      )}
      {mobile && (
        <div className="serif tnum" style={{ gridColumn: "3", marginLeft: 10, marginTop: 6, fontSize: 21, color: "var(--ink-2)" }}>
          {fmtHoursLong(row.total_seconds)}
        </div>
      )}
      {row.is_you && (
        <span className="smallcaps" style={{
          position: "absolute", top: 10, right: 14,
          color: "var(--accent)", fontSize: 9,
        }}>you</span>
      )}
      {isPresent && (
        <span style={{
          position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)",
          width: 7, height: 7, borderRadius: 999, background: "var(--accent)",
        }} />
      )}
    </button>
  );
}

// --- modals --------------------------------------------------------------

function Modal({ open, onClose, title, children }) {
  const isMobile = useMediaQuery("(max-width: 640px)");
  if (!open) return null;
  return (
    <div onClick={onClose} style={{
      position: "fixed", inset: 0, zIndex: 200,
      background: "rgba(42, 29, 18, 0.55)", backdropFilter: "blur(6px)",
      display: "flex", alignItems: "center", justifyContent: "center", padding: 24,
    }}>
      <div onClick={e => e.stopPropagation()} className="tour-card" style={{
        background: "var(--surface)", borderRadius: 18,
        boxShadow: "var(--shadow-card)",
        padding: isMobile ? "26px 20px 24px" : "32px 36px 28px", maxWidth: 460, width: "100%",
      }}>
        <div className="serif" style={{ fontSize: 28, color: "var(--ink)", marginBottom: 18, lineHeight: 1.15 }}>
          {title}
        </div>
        {children}
      </div>
    </div>
  );
}

const inputStyle = {
  width: "100%",
  padding: "12px 14px",
  borderRadius: 10,
  border: "1px solid rgba(110,90,71,0.25)",
  background: "var(--surface-2, var(--surface))",
  fontFamily: "'Instrument Serif', serif",
  fontSize: 18,
  color: "var(--ink)",
  outline: "none",
};

const primaryBtn = {
  padding: "10px 24px", borderRadius: 999,
  background: "var(--accent)", color: "var(--surface)",
  fontSize: 13, boxShadow: "var(--shadow-soft)",
};
const ghostBtn = {
  padding: "10px 16px", color: "var(--ink-3)", fontSize: 11,
};

function CreateGroupModal({ open, onClose, onCreated }) {
  const { actions } = useFolio();
  const [name, setName] = React.useState("");
  const [desc, setDesc] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [err, setErr] = React.useState(null);

  React.useEffect(() => { if (open) { setName(""); setDesc(""); setErr(null); } }, [open]);

  const submit = async (e) => {
    e?.preventDefault();
    if (!name.trim() || busy) return;
    setBusy(true); setErr(null);
    try {
      const g = await actions.createGroup(name, desc);
      onCreated?.(g);
      onClose();
    } catch (e) {
      setErr(e.message || "couldn't create group");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title="create a group">
      <form onSubmit={submit}>
        <div className="smallcaps" style={{ color: "var(--ink-3)", marginBottom: 6, fontSize: 10 }}>name</div>
        <input
          autoFocus
          value={name}
          onChange={e => setName(e.target.value)}
          maxLength={80}
          placeholder="e.g. calhoun prep 2026"
          style={inputStyle}
        />
        <div className="smallcaps" style={{ color: "var(--ink-3)", marginTop: 16, marginBottom: 6, fontSize: 10 }}>description (optional)</div>
        <input
          value={desc}
          onChange={e => setDesc(e.target.value)}
          placeholder="what's this group for?"
          style={inputStyle}
        />
        {err && <div className="sans" style={{ color: "var(--accent)", marginTop: 14, fontSize: 13 }}>{err}</div>}
        <div style={{ marginTop: 24, display: "flex", justifyContent: "flex-end", gap: 4, alignItems: "center" }}>
          <button type="button" onClick={onClose} className="smallcaps" style={ghostBtn}>cancel</button>
          <button type="submit" disabled={!name.trim() || busy} className="lift sans" style={{ ...primaryBtn, opacity: (!name.trim() || busy) ? 0.5 : 1 }}>
            {busy ? "creating…" : "create →"}
          </button>
        </div>
      </form>
    </Modal>
  );
}

function JoinGroupModal({ open, onClose, onJoined }) {
  const { actions } = useFolio();
  const [code, setCode] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [err, setErr] = React.useState(null);

  React.useEffect(() => { if (open) { setCode(""); setErr(null); } }, [open]);

  const submit = async (e) => {
    e?.preventDefault();
    if (!code.trim() || busy) return;
    setBusy(true); setErr(null);
    try {
      const g = await actions.joinGroup(code);
      onJoined?.(g);
      onClose();
    } catch (e) {
      setErr(e.message || "couldn't join group");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title="join with a code">
      <form onSubmit={submit}>
        <div className="smallcaps" style={{ color: "var(--ink-3)", marginBottom: 6, fontSize: 10 }}>invite code</div>
        <input
          autoFocus
          value={code}
          onChange={e => setCode(e.target.value.toUpperCase())}
          maxLength={6}
          placeholder="ABCDEF"
          style={{ ...inputStyle, letterSpacing: "0.3em", textTransform: "uppercase", fontFamily: "'Instrument Serif', serif" }}
        />
        {err && <div className="sans" style={{ color: "var(--accent)", marginTop: 14, fontSize: 13 }}>{err}</div>}
        <div style={{ marginTop: 24, display: "flex", justifyContent: "flex-end", gap: 4, alignItems: "center" }}>
          <button type="button" onClick={onClose} className="smallcaps" style={ghostBtn}>cancel</button>
          <button type="submit" disabled={!code.trim() || busy} className="lift sans" style={{ ...primaryBtn, opacity: (!code.trim() || busy) ? 0.5 : 1 }}>
            {busy ? "joining…" : "join →"}
          </button>
        </div>
      </form>
    </Modal>
  );
}

function GroupOptionsModal({ open, onClose, group, onLeft }) {
  const { actions } = useFolio();
  const [busy, setBusy] = React.useState(false);
  const [copied, setCopied] = React.useState(false);

  const copy = async () => {
    try { await navigator.clipboard.writeText(group.invite_code); setCopied(true); setTimeout(() => setCopied(false), 1500); } catch {}
  };

  const leave = async () => {
    const msg = group.my_role === 'owner'
      ? `leave "${group.name}"? as owner, ownership will pass to the next-oldest member. if you're the last one, the group is deleted.`
      : `leave "${group.name}"?`;
    if (!confirm(msg)) return;
    setBusy(true);
    try {
      await actions.leaveGroup(group.id);
      onLeft?.();
      onClose();
    } catch (e) {
      alert(e.message || "couldn't leave");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title={group?.name || ""}>
      {group && (
        <>
          <div className="smallcaps" style={{ color: "var(--ink-3)", marginBottom: 6, fontSize: 10 }}>invite code — share to invite friends</div>
          <button onClick={copy} className="lift" style={{
            width: "100%", padding: "14px 18px", borderRadius: 12,
            background: "var(--surface-2, var(--surface))",
            border: "1px solid rgba(110,90,71,0.2)",
            display: "flex", alignItems: "center", justifyContent: "space-between",
            fontFamily: "'Instrument Serif', serif", fontSize: 22, color: "var(--ink)",
            letterSpacing: "0.25em",
          }}>
            <span>{group.invite_code}</span>
            <span className="smallcaps" style={{ color: copied ? "var(--accent)" : "var(--ink-3)", fontSize: 9, letterSpacing: "0.18em" }}>
              {copied ? "copied" : "copy"}
            </span>
          </button>

          <div className="sans" style={{ color: "var(--ink-3)", marginTop: 18, fontSize: 13 }}>
            {group.member_count} {group.member_count === 1 ? "member" : "members"} · you're {group.my_role === 'owner' ? "the owner" : "a member"}
          </div>

          <div style={{ marginTop: 26, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <button onClick={leave} disabled={busy} className="smallcaps" style={{
              color: "var(--accent)", fontSize: 11, padding: "8px 0",
            }}>
              {busy ? "leaving…" : "leave group"}
            </button>
            <button onClick={onClose} className="lift sans" style={primaryBtn}>done</button>
          </div>
        </>
      )}
    </Modal>
  );
}

function KickableRow({ row, handle, onKick }) {
  const [hover, setHover] = React.useState(false);
  return (
    <div style={{ position: "relative" }}>
      {row}
      <button
        onClick={onKick}
        onMouseEnter={() => setHover(true)}
        onMouseLeave={() => setHover(false)}
        title={`remove @${handle}`}
        aria-label={`remove @${handle}`}
        style={{
          position: "absolute", top: 8, right: 10,
          width: 24, height: 24, borderRadius: 999,
          display: "flex", alignItems: "center", justifyContent: "center",
          color: hover ? "var(--accent)" : "var(--ink-3)",
          fontSize: 18, lineHeight: 1,
          background: "transparent",
        }}
      >
        ×
      </button>
    </div>
  );
}

// --- main view -----------------------------------------------------------

export function SocietyView({ onOpenMember }) {
  const { state, actions } = useFolio();
  const { user } = useAuth();
  const isMobile = useMediaQuery("(max-width: 640px)");
  const isCompact = useMediaQuery("(max-width: 900px)");
  const groups = state.groups || [];
  const [groupId, setGroupId] = React.useState(null);
  const [period, setPeriod] = React.useState("this week");
  const [leaderboard, setLeaderboard] = React.useState(null);
  const [boardErr, setBoardErr] = React.useState(null);
  const [boardLoading, setBoardLoading] = React.useState(false);
  const [modal, setModal] = React.useState(null); // 'create' | 'join' | 'options' | null

  const shouldBroadcast = !!(
    user?.id &&
    state.current &&
    !state.current.paused &&
    state.profile?.appear_in_currently_studying
  );
  const { count: presenceCount, ids: presentIds } = usePresence(groupId, shouldBroadcast, user?.id);

  // pick a default group when groups change
  React.useEffect(() => {
    if (groups.length === 0) { setGroupId(null); return; }
    if (!groupId || !groups.find(g => g.id === groupId)) {
      setGroupId(groups[0].id);
    }
  }, [groups, groupId]);

  // fetch leaderboard whenever group or period changes (or on bump after a kick)
  const [boardBump, setBoardBump] = React.useState(0);
  React.useEffect(() => {
    if (!groupId) { setLeaderboard(null); return; }
    let cancelled = false;
    setBoardLoading(true); setBoardErr(null);
    actions.getLeaderboard(groupId, period)
      .then(data => {
        if (cancelled) return;
        setLeaderboard(data || []);
        setBoardLoading(false);
      })
      .catch(err => {
        if (cancelled) return;
        setBoardErr(err.message || String(err));
        setLeaderboard([]);
        setBoardLoading(false);
      });
    return () => { cancelled = true; };
  }, [groupId, period, boardBump]);

  const selectedGroup = groups.find(g => g.id === groupId);
  const isOwner = selectedGroup?.my_role === 'owner';
  const kick = async (row) => {
    if (!selectedGroup) return;
    if (!confirm(`remove @${row.handle} from "${selectedGroup.name}"?`)) return;
    try {
      await actions.kickMember(selectedGroup.id, row.user_id);
      setBoardBump(b => b + 1);
    } catch (e) {
      alert(e.message || "couldn't remove member");
    }
  };
  const maxSeconds = (leaderboard || []).reduce((m, r) => Math.max(m, r.total_seconds), 0);
  const youRow = (leaderboard || []).find(r => r.is_you);
  const youRank = youRow ? (leaderboard.indexOf(youRow) + 1) : null;
  const leader = (leaderboard || [])[0];
  const gapToLeader = (youRow && leader && !youRow.is_you ? leader.total_seconds - youRow.total_seconds : 0);

  // --- empty state: no groups
  if (groups.length === 0) {
    return (
      <div className="page" style={{ maxWidth: 1200, margin: "0 auto", padding: isMobile ? "42px 18px 130px" : "72px 48px 180px" }}>
        <div className="stagger" style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
          <h1 className="serif" style={{ fontSize: isMobile ? 44 : 56, margin: 0, color: "var(--ink)", whiteSpace: "nowrap" }}>the society</h1>
          <div className="smallcaps" style={{ color: "var(--accent)", marginTop: 16 }}>
            Study together. Grow together.
          </div>
          <p className="serif" style={{ marginTop: isMobile ? 42 : 64, color: "var(--ink-2)", fontSize: isMobile ? 20 : 22, textAlign: "center", maxWidth: 520, lineHeight: 1.4 }}>
            you're not in any groups yet.
            <br />
            create one, or join with a friend's invite code.
          </p>
          <div style={{ display: "flex", gap: 14, marginTop: 36, flexWrap: "wrap", justifyContent: "center" }}>
            <DashedPill label="create a group" onClick={() => setModal('create')} />
            <DashedPill label="join with code" onClick={() => setModal('join')} />
          </div>
        </div>
        <CreateGroupModal open={modal === 'create'} onClose={() => setModal(null)} onCreated={(g) => setGroupId(g.id)} />
        <JoinGroupModal open={modal === 'join'} onClose={() => setModal(null)} onJoined={(g) => setGroupId(g.id)} />
      </div>
    );
  }

  return (
    <div className="page" style={{ maxWidth: 1200, margin: "0 auto", padding: isMobile ? "42px 18px 130px" : isCompact ? "56px 28px 150px" : "72px 48px 180px" }}>
      <div className="stagger" style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>

        <h1 className="serif" style={{ fontSize: isMobile ? 44 : 56, margin: 0, color: "var(--ink)", whiteSpace: "nowrap" }}>the society</h1>
        <div className="smallcaps" style={{ color: "var(--accent)", marginTop: 16 }}>
          Study together. Grow together.
        </div>

        {selectedGroup && (
          <div className="sans" style={{ color: "var(--ink-3)", marginTop: 12, fontSize: 14, display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap", justifyContent: "center", whiteSpace: "nowrap" }}>
            <span>{selectedGroup.name}</span>
            <span>·</span>
            <span>{selectedGroup.member_count} {selectedGroup.member_count === 1 ? "member" : "members"}</span>
            {presenceCount > 0 && (
              <>
                <span>·</span>
                <span style={{ display: "inline-flex", alignItems: "center", gap: 6, color: "var(--accent)" }}>
                  <span style={{ width: 7, height: 7, borderRadius: 999, background: "var(--accent)" }} />
                  {presenceCount} currently studying
                </span>
              </>
            )}
            <span>·</span>
            <button onClick={() => setModal('options')} className="smallcaps" style={{ color: "var(--ink-3)", fontSize: 10, padding: "2px 6px" }}>
              options
            </button>
          </div>
        )}

        {/* group pills */}
        <div style={{ display: "flex", gap: isMobile ? 10 : 12, marginTop: isMobile ? 28 : 36, flexWrap: "wrap", justifyContent: "center", width: "100%" }}>
          {groups.map(g => (
            <GroupPill key={g.id} name={g.name} active={g.id === groupId} onClick={() => setGroupId(g.id)} />
          ))}
          <DashedPill label="create" onClick={() => setModal('create')} />
          <DashedPill label="join" onClick={() => setModal('join')} />
        </div>

        {/* time toggle */}
        <div style={{ marginTop: isMobile ? 30 : 36, marginBottom: isMobile ? 24 : 28, width: "100%", overflowX: "auto", paddingBottom: 8 }}>
          <TimeToggle value={period} onChange={setPeriod} />
        </div>

        {/* leaderboard */}
        <div style={{ display: "flex", flexDirection: "column", gap: 14, width: "100%", maxWidth: 980 }}>
          {boardLoading && !leaderboard && (
            <div className="serif" style={{ color: "var(--ink-3)", fontSize: 18, textAlign: "center", padding: "40px 0" }}>loading…</div>
          )}
          {boardErr && (
            <div className="serif" style={{ color: "var(--accent)", fontSize: 16, textAlign: "center", padding: "20px 0" }}>{boardErr}</div>
          )}
          {!boardLoading && leaderboard && leaderboard.length === 0 && (
            <div className="serif" style={{ color: "var(--ink-3)", fontSize: 18, textAlign: "center", padding: "40px 0" }}>no sessions in this period yet.</div>
          )}
          {leaderboard && leaderboard.map((r, i) => {
            const canKick = isOwner && !r.is_you;
            const row = (
              <LeaderRow
                rank={i + 1}
                row={r}
                maxSeconds={maxSeconds}
                isPresent={presentIds.has(r.user_id)}
                onClick={() => onOpenMember && onOpenMember(r.user_id)}
                compact={isCompact}
                mobile={isMobile}
              />
            );
            if (!canKick) return <React.Fragment key={r.user_id}>{row}</React.Fragment>;
            return (
              <KickableRow
                key={r.user_id}
                row={row}
                handle={r.handle}
                onKick={(e) => { e.stopPropagation(); kick(r); }}
              />
            );
          })}
        </div>

        {youRow && leaderboard && leaderboard.length > 1 && (
          <div className="serif" style={{ marginTop: 36, color: "var(--ink-2)", fontSize: isMobile ? 18 : 20, textAlign: "center", lineHeight: 1.4 }}>
            {youRow.is_you === true && youRank === 1
              ? <>you're #1 {period === "this week" ? "this week" : period === "today" ? "today" : "all-time"}. keep it up.</>
              : <>you are #{youRank} {period === "this week" ? "this week" : period === "today" ? "today" : "all-time"}. {leader && '@' + leader.handle} is {fmtHoursLong(gapToLeader)} ahead.</>
            }
          </div>
        )}
      </div>

      <CreateGroupModal open={modal === 'create'} onClose={() => setModal(null)} onCreated={(g) => setGroupId(g.id)} />
      <JoinGroupModal   open={modal === 'join'}   onClose={() => setModal(null)} onJoined={(g) => setGroupId(g.id)} />
      <GroupOptionsModal open={modal === 'options'} onClose={() => setModal(null)} group={selectedGroup} onLeft={() => setGroupId(null)} />
    </div>
  );
}

// --- Member profile ------------------------------------------------------

function StatCard({ label, value, hidden, isLast }) {
  const isMobile = useMediaQuery("(max-width: 640px)");
  return (
    <div style={{
      flex: isMobile ? "1 1 50%" : "0 0 200px", textAlign: "center",
      borderRight: isMobile || isLast ? "none" : "1px solid rgba(110,90,71,0.18)",
      padding: "0 12px",
    }}>
      <div className="smallcaps" style={{ color: "var(--ink-3)", marginBottom: 10, fontSize: 10 }}>{label}</div>
      <div style={{
        fontFamily: "'Instrument Serif', serif", fontStyle: hidden ? "normal" : "italic",
        fontSize: hidden ? 22 : isMobile ? 28 : 34, fontWeight: 400, color: hidden ? "var(--ink-3)" : "var(--ink)",
        lineHeight: 1.1,
      }}>
        {hidden ? "—" : value}
      </div>
      {hidden && (
        <div className="smallcaps" style={{ color: "var(--ink-3)", marginTop: 4, fontSize: 9, opacity: 0.7 }}>hidden</div>
      )}
    </div>
  );
}

export function MemberProfileView({ userId, onBack }) {
  const { state } = useFolio();
  const { user } = useAuth();
  const isMobile = useMediaQuery("(max-width: 640px)");
  const isCompact = useMediaQuery("(max-width: 900px)");
  const isSelf = !!user && user.id === userId;
  const [stats, setStats] = React.useState(null);
  const [heatmap, setHeatmap] = React.useState(null);
  const [subjects, setSubjects] = React.useState(null);
  const [err, setErr] = React.useState(null);
  const [loading, setLoading] = React.useState(true);

  const [selectedIso, setSelectedIso] = React.useState(null);
  const [dayDetail, setDayDetail] = React.useState(null);
  const [dayLoading, setDayLoading] = React.useState(false);
  const [dayTasks, setDayTasks] = React.useState(null);

  React.useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    setLoading(true); setErr(null);
    setSelectedIso(null); setDayDetail(null); setDayTasks(null);
    Promise.all([
      supabase.rpc('get_member_stats',    { p_target_user_id: userId }),
      supabase.rpc('get_member_heatmap',  { p_target_user_id: userId, p_weeks: 52 }),
      supabase.rpc('get_member_subjects', { p_target_user_id: userId }),
    ]).then(([s, h, sub]) => {
      if (cancelled) return;
      if (s.error)   { setErr(s.error.message);   setLoading(false); return; }
      if (h.error)   { setErr(h.error.message);   setLoading(false); return; }
      if (sub.error) { setErr(sub.error.message); setLoading(false); return; }
      setStats((s.data && s.data[0]) || null);
      setHeatmap(h.data || []);
      setSubjects(sub.data || []);
      setLoading(false);
    });
    return () => { cancelled = true; };
  }, [userId]);

  React.useEffect(() => {
    if (!userId || !selectedIso) { setDayDetail(null); setDayTasks(null); return; }
    let cancelled = false;
    setDayLoading(true);
    Promise.all([
      supabase.rpc('get_member_day_detail', { p_target_user_id: userId, p_day: selectedIso }),
      supabase.rpc('get_member_day_tasks',  { p_target_user_id: userId, p_day: selectedIso }),
    ]).then(([detail, tasks]) => {
      if (cancelled) return;
      setDayDetail(detail.error ? [] : (detail.data || []));
      setDayTasks(tasks.error ? [] : (tasks.data || []));
      setDayLoading(false);
    });
    return () => { cancelled = true; };
  }, [userId, selectedIso]);

  // shape heatmap RPC output -> { iso: [{duration_seconds}] } for <Heatmap>
  const sessionsByDate = React.useMemo(() => {
    const map = {};
    for (const row of (heatmap || [])) {
      map[row.day] = [{ duration_seconds: Number(row.total_seconds) }];
    }
    return map;
  }, [heatmap]);

  const dailyGoalSec = state?.goals?.daily_seconds || 14400;
  const canSeeSubjects = isSelf || (stats && !!stats.show_subjects);

  return (
    <div className="page" style={{ maxWidth: 1280, margin: "0 auto", padding: isMobile ? "32px 18px 130px" : isCompact ? "40px 28px 150px" : "44px 48px 180px" }}>
      <button onClick={onBack} className="smallcaps" style={{
        display: "inline-flex", alignItems: "center", gap: 8, color: "var(--ink-3)",
      }}>
        ← The Society
      </button>

      {loading && (
        <div className="serif" style={{ color: "var(--ink-3)", fontSize: 20, textAlign: "center", marginTop: 120 }}>loading…</div>
      )}

      {err && !loading && (
        <div className="serif" style={{ color: "var(--accent)", fontSize: 18, textAlign: "center", marginTop: 120 }}>{err}</div>
      )}

      {!loading && !err && stats && (
        <div className="stagger" style={{ display: "flex", flexDirection: "column", alignItems: "center", marginTop: isMobile ? 24 : 30 }}>
          <Avatar initials={initialsFor(stats.handle, stats.display_name)} src={stats.avatar_url} size={isMobile ? 76 : 96} />
          <div className="serif" style={{ fontSize: isMobile ? 30 : 36, color: "var(--ink)", lineHeight: 1, marginTop: 18, maxWidth: "100%", overflow: "hidden", textOverflow: "ellipsis" }}>
            @{stats.handle}
          </div>
          {stats.display_name && stats.display_name !== stats.handle && (
            <div className="serif" style={{ color: "var(--ink-2)", marginTop: 6, fontSize: 18 }}>{stats.display_name}</div>
          )}
          <div className="smallcaps" style={{ color: "var(--ink-3)", marginTop: 14, fontSize: 10 }}>
            member since {new Date(stats.member_since).toLocaleDateString("en-US", { month: "long", year: "numeric" }).toLowerCase()}
          </div>

          {/* stats */}
          <div style={{
            display: "flex", justifyContent: "center",
            marginTop: isMobile ? 30 : 38, marginBottom: isMobile ? 42 : 56, width: "100%", flexWrap: "wrap",
            rowGap: isMobile ? 24 : 28,
          }}>
            <StatCard label="Total Hours"     value={fmtHoursLong(Number(stats.total_seconds))} />
            <StatCard label="Current Streak"  value={`${stats.current_streak} ${stats.current_streak === 1 ? "day" : "days"}`} />
            <StatCard label="Longest Session" value={fmtHoursLong(Number(stats.longest_seconds))} hidden={stats.longest_seconds === null} />
            <StatCard label="Best Week"       value={fmtHoursLong(Number(stats.best_week_seconds))} hidden={stats.best_week_seconds === null} isLast={stats.best_month_seconds === undefined} />
            {stats.best_month_seconds !== undefined && (
              <StatCard label="Best Month"    value={fmtHoursLong(Number(stats.best_month_seconds))} hidden={stats.best_month_seconds === null} isLast />
            )}
          </div>

          <div style={{ width: "100%", display: "flex", justifyContent: isMobile ? "flex-start" : "center", overflowX: "auto", paddingBottom: 6 }}>
            <Heatmap
              weeks={isMobile ? 26 : 52}
              endDate={new Date()}
              sessionsByDate={sessionsByDate}
              dailyGoalSec={dailyGoalSec}
              cellSize={isMobile ? 13 : 16}
              gap={3}
              onCellClick={canSeeSubjects ? setSelectedIso : undefined}
              selectedDate={selectedIso}
            />
          </div>

          {canSeeSubjects && selectedIso && (() => {
            const rows = dayDetail || [];
            const total = rows.reduce((a, r) => a + Number(r.total_seconds), 0);
            const maxSec = rows.length > 0 ? Number(rows[0].total_seconds) : 1;
            const dayLabel = parseISODate(selectedIso)
              .toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })
              .toLowerCase();
            return (
              <div style={{ width: "100%", maxWidth: 880, marginTop: isMobile ? 42 : 56 }}>
                <div className="smallcaps" style={{ color: "var(--accent)", marginBottom: 10 }}>day detail</div>
                <div style={{ display: "flex", alignItems: isMobile ? "flex-start" : "baseline", justifyContent: "space-between", gap: 14, marginBottom: 28, flexDirection: isMobile ? "column" : "row" }}>
                  <div className="serif" style={{ fontSize: isMobile ? 26 : 30, color: "var(--ink)" }}>{dayLabel}</div>
                  <div className="sans tnum" style={{ color: "var(--ink-2)", fontSize: 16 }}>
                    {fmtHoursLong(total)}
                  </div>
                </div>
                {dayLoading ? (
                  <div className="serif" style={{ color: "var(--ink-3)", fontSize: 18 }}>loading…</div>
                ) : rows.length === 0 ? (
                  <div className="serif" style={{ color: "var(--ink-3)", fontSize: 18 }}>no sessions on this day.</div>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: 22 }}>
                    {rows.map(b => (
                      <div key={b.subject_id} style={{ display: "grid", gridTemplateColumns: isMobile ? "minmax(0, 1fr) 78px" : "minmax(120px, 200px) 1fr 80px", alignItems: "center", gap: isMobile ? "8px 12px" : 16 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
                          <span style={{ width: 10, height: 10, borderRadius: 999, background: b.color || "var(--ink-3)" }} />
                          <span className="sans" style={{ fontSize: 15, color: "var(--ink)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                            {b.name}
                          </span>
                        </div>
                        <div style={{ position: "relative", height: 2, borderRadius: 2, background: "rgba(110,90,71,0.15)", gridColumn: isMobile ? "1 / -1" : undefined, gridRow: isMobile ? 2 : undefined }}>
                          <div style={{ position: "absolute", inset: 0, width: `${(Number(b.total_seconds)/maxSec)*100}%`, background: "var(--accent)", borderRadius: 2 }} />
                        </div>
                        <div className="sans tnum" style={{ fontSize: 14, color: "var(--ink-2)", textAlign: "right" }}>
                          {fmtHoursLong(Number(b.total_seconds))}
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {!dayLoading && dayTasks && dayTasks.length > 0 && (
                  <div style={{ marginTop: 36 }}>
                    <div className="smallcaps" style={{ color: "var(--ink-3)", marginBottom: 14, fontSize: 10 }}>tasks</div>
                    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                      {dayTasks.map(t => (
                        <div key={t.id} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                          <span style={{
                            width: 14, height: 14, borderRadius: 999,
                            border: t.done ? "none" : "1.5px solid var(--ink-3)",
                            background: t.done ? "var(--accent)" : "transparent",
                            display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
                          }}>
                            {t.done && (
                              <svg width="8" height="8" viewBox="0 0 8 8" fill="none">
                                <path d="M1.5 4.5 L3 6 L6.5 2" stroke="var(--surface)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                              </svg>
                            )}
                          </span>
                          {t.subject_color && (
                            <span style={{ width: 6, height: 6, borderRadius: 999, background: t.subject_color, flexShrink: 0 }} />
                          )}
                          <span className="sans" style={{
                            fontSize: 14.5,
                            color: t.done ? "var(--ink-3)" : "var(--ink)",
                            textDecoration: t.done ? "line-through" : "none",
                          }}>{t.title}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            );
          })()}

          {/* subjects breakdown */}
          <div style={{ width: "100%", maxWidth: 880, marginTop: isMobile ? 42 : 56 }}>
            <div className="smallcaps" style={{ color: "var(--accent)", marginBottom: 18 }}>all-time subjects</div>
            {(() => {
              if (!subjects || subjects.length === 0) {
                return (
                  <div className="smallcaps" style={{ color: "var(--ink-3)", fontSize: 10 }}>
                    @{stats.handle} has hidden their subject breakdown.
                  </div>
                );
              }
              const withTime = subjects.filter(s => Number(s.total_seconds) > 0);
              if (withTime.length === 0) {
                return (
                  <div className="serif" style={{ color: "var(--ink-3)", fontSize: 18 }}>no sessions yet.</div>
                );
              }
              const maxSec = withTime[0] ? Number(withTime[0].total_seconds) : 1;
              return (
                <div style={{ display: "flex", flexDirection: "column", gap: 22 }}>
                  {withTime.map(b => (
                    <div key={b.subject_id} style={{ display: "grid", gridTemplateColumns: isMobile ? "minmax(0, 1fr) 78px" : "minmax(120px, 200px) 1fr 80px", alignItems: "center", gap: isMobile ? "8px 12px" : 16 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
                        <span style={{ width: 10, height: 10, borderRadius: 999, background: b.color || "var(--ink-3)" }} />
                        <span className="sans" style={{ fontSize: 15, color: "var(--ink)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                          {b.name}
                        </span>
                      </div>
                      <div style={{ position: "relative", height: 2, borderRadius: 2, background: "rgba(110,90,71,0.15)", gridColumn: isMobile ? "1 / -1" : undefined, gridRow: isMobile ? 2 : undefined }}>
                        <div style={{ position: "absolute", inset: 0, width: `${(Number(b.total_seconds)/maxSec)*100}%`, background: "var(--accent)", borderRadius: 2 }} />
                      </div>
                      <div className="sans tnum" style={{ fontSize: 14, color: "var(--ink-2)", textAlign: "right" }}>
                        {fmtHoursLong(Number(b.total_seconds))}
                      </div>
                    </div>
                  ))}
                </div>
              );
            })()}
          </div>
        </div>
      )}
    </div>
  );
}
