import React from 'react';
import { DoodleArrow } from './Arrow.jsx';
import { STEPS } from './steps.js';
import { HandUnderline, useMediaQuery } from '../shared.jsx';

/* Tour overlay — controls page navigation as the user advances.
   Renders a backdrop, a tooltip card, a doodly arrow, nav buttons, and a skip link.

   Props:
   - setPage(pageId): controls which page the underlying app shows
   - onComplete(): called when user clicks "begin" on the final step
   - onSkip(): called when user clicks skip (treated same as complete)
*/

export function OnboardingTour({ setPage, onComplete, onSkip }) {
  const [idx, setIdx] = React.useState(0);
  const step = STEPS[idx];
  const isMobile = useMediaQuery("(max-width: 760px)");

  // when step's page changes, navigate underlying app
  React.useEffect(() => {
    if (step.page) setPage(step.page);
  }, [step.page, setPage]);

  const next = () => {
    if (idx >= STEPS.length - 1) onComplete();
    else setIdx(idx + 1);
  };
  const back = () => { if (idx > 0) setIdx(idx - 1); };

  // ESC = skip
  React.useEffect(() => {
    const onKey = (e) => {
      if (e.key === "Escape") onSkip();
      else if (e.key === "Enter" || e.key === "ArrowRight") { e.preventDefault(); next(); }
      else if (e.key === "ArrowLeft") { e.preventDefault(); back(); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  // Welcome / final step — centered card, no arrow
  if (step.welcome) {
    return (
      <div style={{
        position: "fixed", inset: 0, zIndex: 200,
        background: "rgba(42, 29, 18, 0.55)", backdropFilter: "blur(6px)",
        display: "flex", alignItems: "center", justifyContent: "center",
        padding: 24,
      }}>
        <div className="tour-card" style={{
          background: "var(--surface)", borderRadius: 18,
          boxShadow: "var(--shadow-card)",
          padding: "44px 48px 36px",
          maxWidth: 460, width: "100%", textAlign: "center",
        }}>
          <div className="welcome-line">
            <span className="serif" style={{ fontSize: 64, color: "var(--ink)", lineHeight: 1 }}>
              {step.title}
            </span>
            <div style={{ width: 140, margin: "6px auto 0" }}>
              <HandUnderline scale width={140} />
            </div>
          </div>
          <p className="welcome-line serif" style={{
            fontSize: 19, lineHeight: 1.55, color: "var(--ink-2)",
            margin: "32px 0 36px", whiteSpace: "pre-line",
          }}>
            {step.text}
          </p>
          <div className="welcome-line">
            <button onClick={next} className="lift sans" style={{
              padding: "14px 34px", borderRadius: 999,
              background: "var(--accent)", color: "var(--surface)",
              fontSize: 15, boxShadow: "var(--shadow-soft)",
            }}>
              {step.button}
            </button>
          </div>
          {!step.final && (
            <button onClick={onSkip} className="smallcaps" style={{
              marginTop: 22, color: "var(--ink-3)", fontSize: 10,
            }}>
              skip tour
            </button>
          )}
        </div>
      </div>
    );
  }

  // Mobile regular step — top-anchored sheet, no arrow.
  // The hardcoded pixel positions in steps.js target a desktop viewport, so on
  // phones we drop the arrow and pin the tooltip to the top instead.
  if (isMobile) {
    return (
      <>
        <div style={{
          position: "fixed", inset: 0, zIndex: 199,
          background: "rgba(42, 29, 18, 0.18)",
          pointerEvents: "none",
        }} />
        <div className="tour-card" style={{
          position: "fixed", zIndex: 200,
          top: "calc(16px + env(safe-area-inset-top, 0px))",
          left: 16, right: 16,
          background: "var(--surface)", borderRadius: 16,
          boxShadow: "var(--shadow-card)",
          padding: "20px 22px 16px",
        }}>
          <div className="smallcaps" style={{ color: "var(--accent)", marginBottom: 8 }}>
            tip {idx} of {STEPS.length - 2}
          </div>
          <div className="serif" style={{ fontSize: 24, color: "var(--ink)", marginBottom: 8, lineHeight: 1.15 }}>
            {step.title}
          </div>
          <p className="serif" style={{
            fontSize: 15, lineHeight: 1.55, color: "var(--ink-2)", margin: "0 0 16px",
          }}>
            {step.text}
          </p>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
            <button onClick={back} disabled={idx === 0} className="smallcaps" style={{
              color: idx === 0 ? "var(--ink-4)" : "var(--ink-3)", fontSize: 10,
              padding: "8px 4px",
            }}>
              ← back
            </button>
            <button onClick={onSkip} className="smallcaps" style={{
              color: "var(--ink-3)", fontSize: 10, padding: "8px 12px",
            }}>
              skip
            </button>
            <button onClick={next} className="lift sans" style={{
              padding: "10px 22px", borderRadius: 999,
              background: "var(--accent)", color: "var(--surface)",
              fontSize: 13, boxShadow: "var(--shadow-soft)",
            }}>
              next →
            </button>
          </div>
        </div>
      </>
    );
  }

  // Regular step — card + doodly arrow + small skip button bottom-right
  const { width: cardWidth, ...cardPos } = step.card;
  const cardStyle = {
    position: "fixed", zIndex: 200,
    background: "var(--surface)", borderRadius: 16,
    boxShadow: "var(--shadow-card)",
    padding: "22px 26px 18px",
    width: cardWidth || 320,
    ...cardPos,
  };

  // Pull rotate + length OUT of arrow positioning — they're DoodleArrow props,
  // not CSS, and `length` collides with the read-only DOM CSSStyleDeclaration.length.
  const { rotate: arrowRotate, length: arrowLength, ...arrowPos } = step.arrow;
  const arrowStyle = {
    position: "fixed", zIndex: 200,
    ...arrowPos,
  };

  return (
    <>
      {/* subtle backdrop — doesn't fully cover so the underlying page stays visible */}
      <div style={{
        position: "fixed", inset: 0, zIndex: 199,
        background: "rgba(42, 29, 18, 0.18)",
        pointerEvents: "none",
      }} />

      {/* arrow */}
      <div style={arrowStyle}>
        <DoodleArrow rotate={arrowRotate} length={arrowLength} />
      </div>

      {/* tooltip card */}
      <div className="tour-card" style={cardStyle}>
        <div className="smallcaps" style={{ color: "var(--accent)", marginBottom: 8 }}>
          tip {idx} of {STEPS.length - 2}
        </div>
        <div className="serif" style={{ fontSize: 26, color: "var(--ink)", marginBottom: 10, lineHeight: 1.15 }}>
          {step.title}
        </div>
        <p className="serif" style={{
          fontSize: 16, lineHeight: 1.55, color: "var(--ink-2)", margin: "0 0 20px",
        }}>
          {step.text}
        </p>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
          <button onClick={back} disabled={idx === 0} className="smallcaps" style={{
            color: idx === 0 ? "var(--ink-4)" : "var(--ink-3)", fontSize: 10,
          }}>
            ← back
          </button>
          <button onClick={next} className="lift sans" style={{
            padding: "10px 24px", borderRadius: 999,
            background: "var(--accent)", color: "var(--surface)",
            fontSize: 13, boxShadow: "var(--shadow-soft)",
          }}>
            next →
          </button>
        </div>
      </div>

      {/* skip — bottom right */}
      <button onClick={onSkip} className="smallcaps" style={{
        position: "fixed", bottom: 22, right: 26, zIndex: 200,
        color: "var(--ink-3)", fontSize: 10,
        padding: "8px 14px", borderRadius: 999,
        background: "rgba(251, 244, 228, 0.7)",
        backdropFilter: "blur(6px)",
      }}>
        skip tour
      </button>
    </>
  );
}
