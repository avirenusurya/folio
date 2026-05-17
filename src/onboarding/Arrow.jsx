import React from 'react';

/* A hand-drawn looking arrow that wobbles gently forever.
   Pass `rotate` (degrees) and `length` (px) to point it where you need.
   The wrapper handles position; this component is the visual mark. */

export function DoodleArrow({ rotate = 0, length = 140, color = "var(--accent)" }) {
  return (
    <div
      className="doodle-arrow-wrap"
      style={{
        transform: `rotate(${rotate}deg)`,
        transformOrigin: "0 50%",
        width: length,
        height: 60,
        pointerEvents: "none",
      }}
    >
      <svg
        className="doodle-arrow-svg"
        width={length}
        height="60"
        viewBox="0 0 140 60"
        preserveAspectRatio="none"
        style={{ display: "block", overflow: "visible" }}
      >
        {/* main wavy line */}
        <path
          d="M 6 48 C 30 6, 70 50, 100 22 S 124 12, 132 14"
          fill="none"
          stroke={color}
          strokeWidth="2.6"
          strokeLinecap="round"
          opacity="0.92"
        />
        {/* secondary lighter line for sketch effect */}
        <path
          d="M 8 50 C 32 9, 71 53, 102 24 S 124 14, 132 16"
          fill="none"
          stroke={color}
          strokeWidth="1.2"
          strokeLinecap="round"
          opacity="0.45"
        />
        {/* arrowhead — bisector aligned with line's tangent (8, 2) at the endpoint */}
        <path
          d="M 126 4 L 132 14 L 122 20"
          fill="none"
          stroke={color}
          strokeWidth="2.6"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </div>
  );
}
