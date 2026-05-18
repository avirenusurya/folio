import React from 'react';

/* Shared primitives + icons for Folio */

export const COLOR_PALETTE = [
  "#E89E6D", "#C77B5F", "#B07A6E", "#8B9A82", "#C19A3F", "#8B6F8E",
  "#B85C3C", "#7E8B6F", "#A65B5B", "#7A8FA3",
];

export function useMediaQuery(query) {
  const getMatch = () => (
    typeof window !== "undefined" && typeof window.matchMedia === "function"
      ? window.matchMedia(query).matches
      : false
  );
  const [matches, setMatches] = React.useState(getMatch);

  React.useEffect(() => {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") return;
    const media = window.matchMedia(query);
    const onChange = () => setMatches(media.matches);
    onChange();
    media.addEventListener?.("change", onChange);
    return () => media.removeEventListener?.("change", onChange);
  }, [query]);

  return matches;
}

// --- icons (1.5px line, square 24, outline only) ---
const StrokeProps = { fill: "none", stroke: "currentColor", strokeWidth: 1.5, strokeLinecap: "round", strokeLinejoin: "round" };

export const IconTimer = (p) => (
  <svg viewBox="0 0 24 24" width={p.size || 22} height={p.size || 22} {...StrokeProps}>
    <circle cx="12" cy="13.5" r="7.5" />
    <path d="M12 9.5v4l2.5 1.5" />
    <path d="M9.5 3.5h5" />
    <path d="M12 3.5v2" />
  </svg>
);
export const IconCalendar = (p) => (
  <svg viewBox="0 0 24 24" width={p.size || 22} height={p.size || 22} {...StrokeProps}>
    <rect x="3.5" y="5" width="17" height="15.5" rx="2" />
    <path d="M3.5 9.5h17" />
    <path d="M8 3.5v3M16 3.5v3" />
  </svg>
);
export const IconSociety = (p) => (
  <svg viewBox="0 0 24 24" width={p.size || 22} height={p.size || 22} {...StrokeProps}>
    <circle cx="9" cy="9.5" r="3.2" />
    <path d="M3.5 19c0-3 2.4-5 5.5-5s5.5 2 5.5 5" />
    <circle cx="16.5" cy="8.5" r="2.6" />
    <path d="M14.5 13.6c.6-.2 1.3-.3 2-.3 2.4 0 4 1.5 4 3.7" />
  </svg>
);
export const IconHabits = (p) => (
  <svg viewBox="0 0 24 24" width={p.size || 22} height={p.size || 22} {...StrokeProps}>
    <rect x="4" y="4" width="16" height="16" rx="3" />
    <path d="M8 12.5l2.8 2.8L16 9.5" />
  </svg>
);
export const IconJournal = (p) => (
  <svg viewBox="0 0 24 24" width={p.size || 22} height={p.size || 22} {...StrokeProps}>
    <rect x="6" y="3.5" width="12" height="17" rx="1.5" />
    <path d="M9 3.5v17" />
    <path d="M11.5 8.5h4M11.5 12h4M11.5 15.5h3" />
  </svg>
);
export const IconSettings = (p) => (
  <svg viewBox="0 0 24 24" width={p.size || 22} height={p.size || 22} {...StrokeProps}>
    <circle cx="12" cy="12" r="3" />
    <path d="M19.4 15a1.5 1.5 0 0 0 .3 1.7l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.5 1.5 0 0 0-1.7-.3 1.5 1.5 0 0 0-.9 1.4V21a2 2 0 1 1-4 0v-.1a1.5 1.5 0 0 0-1-1.4 1.5 1.5 0 0 0-1.7.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.5 1.5 0 0 0 .3-1.7 1.5 1.5 0 0 0-1.4-.9H3a2 2 0 1 1 0-4h.1a1.5 1.5 0 0 0 1.4-1 1.5 1.5 0 0 0-.3-1.7l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.5 1.5 0 0 0 1.7.3H9a1.5 1.5 0 0 0 .9-1.4V3a2 2 0 1 1 4 0v.1a1.5 1.5 0 0 0 .9 1.4 1.5 1.5 0 0 0 1.7-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.5 1.5 0 0 0-.3 1.7V9a1.5 1.5 0 0 0 1.4.9H21a2 2 0 1 1 0 4h-.1a1.5 1.5 0 0 0-1.4.9z"/>
  </svg>
);
export const IconCap = (p) => (
  <svg viewBox="0 0 24 24" width={p.size || 16} height={p.size || 16} {...StrokeProps}>
    <path d="M3 9.5 12 5l9 4.5-9 4.5z" />
    <path d="M7 11.5v4c0 1.4 2.3 2.5 5 2.5s5-1.1 5-2.5v-4" />
  </svg>
);
export const IconBook = (p) => (
  <svg viewBox="0 0 24 24" width={p.size || 16} height={p.size || 16} {...StrokeProps}>
    <path d="M5 4h9a3 3 0 0 1 3 3v13H8a3 3 0 0 1-3-3z" />
    <path d="M5 17h12" />
  </svg>
);
export const IconDoc = (p) => (
  <svg viewBox="0 0 24 24" width={p.size || 16} height={p.size || 16} {...StrokeProps}>
    <path d="M7 3.5h7l4 4V20a.5.5 0 0 1-.5.5h-10A.5.5 0 0 1 7 20z" />
    <path d="M14 3.5V8h4" />
    <path d="M9.5 12h6M9.5 15h6M9.5 18h4" />
  </svg>
);
export const IconPencil = (p) => (
  <svg viewBox="0 0 24 24" width={p.size || 16} height={p.size || 16} {...StrokeProps}>
    <path d="m4.5 19.5 1-3.5L15 6.5l3 3-9.5 9.5z" />
    <path d="m13.5 8 3 3" />
  </svg>
);
export const IconArrow = (p) => (
  <svg viewBox="0 0 24 24" width={p.size || 14} height={p.size || 14} {...StrokeProps}>
    <path d="M5 12h14M13 6l6 6-6 6" />
  </svg>
);
export const IconArrowLeft = (p) => (
  <svg viewBox="0 0 24 24" width={p.size || 14} height={p.size || 14} {...StrokeProps}>
    <path d="M19 12H5M11 6l-6 6 6 6" />
  </svg>
);

// --- soft hand-drawn underline (slight wave) ---
export const HandUnderline = ({ width = 280, color = "var(--accent)", scale = false }) => (
  <svg
    width={scale ? "100%" : width}
    height="10"
    viewBox={`0 0 ${width} 10`}
    preserveAspectRatio={scale ? "none" : "xMidYMid meet"}
    style={{display:"block"}}
  >
    <path
      d={`M2 6 C ${width*0.18} 2, ${width*0.32} 9, ${width*0.5} 5 S ${width*0.78} 1, ${width-3} 6`}
      fill="none"
      stroke={color}
      strokeWidth="2.2"
      strokeLinecap="round"
      opacity="0.85"
    />
    <path
      d={`M4 7.5 C ${width*0.24} 4.5, ${width*0.42} 9, ${width*0.6} 6 S ${width*0.82} 4, ${width-5} 7.5`}
      fill="none"
      stroke={color}
      strokeWidth="1"
      strokeLinecap="round"
      opacity="0.45"
    />
  </svg>
);

// --- the floating dock ---
export function Dock({ page, setPage, sessionRunning }) {
  const [hoveredId, setHoveredId] = React.useState(null);
  const narrow = useMediaQuery("(max-width: 520px)");
  const items = [
    { id: "timer",    icon: IconTimer,    label: "timer" },
    { id: "calendar", icon: IconCalendar, label: "calendar" },
    { id: "habits",   icon: IconHabits,   label: "habits" },
    { id: "society",  icon: IconSociety,  label: "society" },
    { id: "journal",  icon: IconJournal,  label: "journal" },
    { id: "settings", icon: IconSettings, label: "settings" },
  ];
  return (
    <div style={{
      position: "fixed", left: "50%",
      bottom: narrow ? "calc(12px + env(safe-area-inset-bottom, 0px))" : 28,
      transform: "translateX(-50%)",
      zIndex: 50,
      width: narrow ? "calc(100vw - 24px)" : "auto",
    }}>
      <div style={{
        background: "var(--surface)",
        borderRadius: 999,
        boxShadow: "0 2px 6px rgba(70,40,20,.08), 0 22px 48px rgba(70,40,20,.14)",
        padding: narrow ? "8px 10px" : "10px 14px",
        display: "flex",
        alignItems: "center",
        gap: 2,
        width: "100%",
      }}>
        {items.map((it, i) => {
          const Icon = it.icon;
          const active = page === it.id;
          const raised = hoveredId === it.id && !active;
          const showPulseDot = !active && it.id === "timer" && sessionRunning;
          return (
            <React.Fragment key={it.id}>
              {i > 0 && <span style={{
                width: 1, height: 18, background: "rgba(110,90,71,0.22)",
              }}/>}
              <button
                onClick={() => setPage(it.id)}
                title={it.label}
                style={{
                  width: narrow ? "auto" : 56, height: narrow ? 40 : 42,
                  flex: narrow ? 1 : "0 0 auto",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  borderRadius: narrow ? 12 : 14,
                  background: active ? "var(--surface-2)" : "transparent",
                  color: active ? "var(--ink)" : "var(--ink-2)",
                  border: `1.5px solid ${active ? "var(--accent)" : "transparent"}`,
                  position: "relative",
                  transform: raised ? "translateY(-3px)" : "translateY(0)",
                  transition: "background 220ms, transform 220ms, color 220ms, border-color 220ms",
                }}
                onMouseEnter={() => setHoveredId(it.id)}
                onMouseLeave={() => setHoveredId(null)}
                onFocus={() => setHoveredId(it.id)}
                onBlur={() => setHoveredId(null)}
              >
                <Icon size={22} />
                {showPulseDot && (
                  <span className="dot-pulse" style={{
                    position: "absolute", bottom: -10, left: "50%", transform: "translateX(-50%)",
                    width: 5, height: 5, borderRadius: 999, background: "var(--accent)",
                  }} />
                )}
              </button>
            </React.Fragment>
          );
        })}
      </div>
    </div>
  );
}

// --- avatar: image when src is set, serif initials otherwise ---
export function Avatar({ initials, src, size = 32, ring = false }) {
  const [broken, setBroken] = React.useState(false);
  const showImage = src && !broken;
  return (
    <div style={{
      width: size, height: size, borderRadius: 999,
      background: "var(--surface-2)",
      display: "flex", alignItems: "center", justifyContent: "center",
      color: "var(--ink)",
      fontFamily: "'Geist', sans-serif", fontWeight: 500,
      fontSize: size * 0.36,
      border: ring ? "1px solid rgba(110,90,71,0.25)" : "1px solid rgba(110,90,71,0.18)",
      letterSpacing: "0.04em",
      overflow: "hidden",
    }}>
      {showImage ? (
        <img
          src={src}
          alt=""
          onError={() => setBroken(true)}
          style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
        />
      ) : initials}
    </div>
  );
}
