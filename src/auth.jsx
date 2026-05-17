import React from 'react';
import { HandUnderline } from './shared.jsx';
import { supabase } from './lib/supabase.js';

/* Auth — magic link + Google OAuth via Supabase */

function readUrlError() {
  if (typeof window === 'undefined') return null;
  const fromHash = window.location.hash.startsWith('#')
    ? new URLSearchParams(window.location.hash.slice(1))
    : null;
  const fromQuery = new URLSearchParams(window.location.search);
  const params = fromHash?.get('error') ? fromHash : (fromQuery.get('error') ? fromQuery : null);
  if (!params) return null;
  const msg = params.get('error_description') || params.get('error') || 'sign-in failed.';
  const code = params.get('error_code') || null;
  // strip the error from the URL so it doesn't persist on reload
  window.history.replaceState(null, '', window.location.pathname);
  return { msg, code };
}

export function AuthView() {
  const [email, setEmail] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [sent, setSent] = React.useState(false);
  const [error, setError] = React.useState(null);

  React.useEffect(() => {
    const urlErr = readUrlError();
    if (urlErr) {
      if (urlErr.code === 'otp_expired') {
        setError("that link was already used or expired. some email apps preview links automatically — try requesting a new one and clicking it within a minute.");
      } else {
        setError(urlErr.msg);
      }
    }
  }, []);

  const sendMagicLink = async (e) => {
    e?.preventDefault?.();
    if (!email || busy) return;
    setBusy(true); setError(null);
    const { error } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: { emailRedirectTo: window.location.origin },
    });
    setBusy(false);
    if (error) setError(error.message);
    else setSent(true);
  };

  const continueWithGoogle = async () => {
    if (busy) return;
    setBusy(true); setError(null);
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: window.location.origin },
    });
    if (error) { setError(error.message); setBusy(false); }
    // on success, browser is redirected to Google — no further state to handle here
  };

  if (sent) {
    return (
      <div className="page" style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", padding: "60px 24px" }}>
        <div className="stagger" style={{ display: "flex", flexDirection: "column", alignItems: "center", maxWidth: 380, width: "100%", textAlign: "center" }}>
          <span className="serif" style={{ fontSize: 64, color: "var(--ink)", lineHeight: 1, marginBottom: 4 }}>Folio</span>
          <div style={{ width: 160, marginBottom: 36 }}><HandUnderline scale width={160} /></div>
          <p className="serif" style={{ fontSize: 22, lineHeight: 1.5, color: "var(--ink)", margin: "0 0 18px" }}>
            check your inbox.
          </p>
          <p className="serif" style={{ fontSize: 17, lineHeight: 1.55, color: "var(--ink-2)", margin: "0 0 28px" }}>
            we sent a sign-in link to<br/>
            <span style={{ color: "var(--ink)" }}>{email}</span>
          </p>
          <button onClick={() => { setSent(false); setEmail(""); }} className="smallcaps" style={{ color: "var(--ink-3)" }}>
            use a different email
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="page" style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", padding: "60px 24px" }}>
      <div className="stagger" style={{
        display: "flex", flexDirection: "column", alignItems: "center",
        maxWidth: 380, width: "100%",
      }}>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", marginBottom: 36 }}>
          <span className="serif" style={{ fontSize: 64, color: "var(--ink)", lineHeight: 1 }}>
            Folio
          </span>
          <div style={{ marginTop: 4, width: 160 }}>
            <HandUnderline scale width={160} />
          </div>
        </div>

        <p className="serif" style={{
          fontSize: 19, lineHeight: 1.55, color: "var(--ink-2)",
          textAlign: "center", margin: "0 0 36px",
        }}>
          a quiet ledger for serious study —<br/>
          come back, gently, to the work that matters.
        </p>

        <button onClick={continueWithGoogle} disabled={busy} className="lift" style={{
          width: "100%", padding: "14px 18px",
          borderRadius: 12, background: "var(--surface)",
          boxShadow: "var(--shadow-soft)",
          display: "flex", alignItems: "center", justifyContent: "center",
          gap: 10, fontSize: 15, color: "var(--ink)", marginBottom: 18,
          opacity: busy ? 0.6 : 1,
        }}>
          <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
            <path fill="#4285F4" d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.92c1.7-1.57 2.68-3.88 2.68-6.62z"/>
            <path fill="#34A853" d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.92-2.26a5.4 5.4 0 0 1-3.04.84 5.4 5.4 0 0 1-5.05-3.71H.96v2.33A9 9 0 0 0 9 18z"/>
            <path fill="#FBBC05" d="M3.95 10.69A5.4 5.4 0 0 1 3.66 9c0-.59.1-1.16.29-1.69V4.98H.96A9 9 0 0 0 0 9c0 1.45.35 2.83.96 4.02l2.99-2.33z"/>
            <path fill="#EA4335" d="M9 3.58a4.88 4.88 0 0 1 3.45 1.35l2.58-2.59A8.66 8.66 0 0 0 9 0 9 9 0 0 0 .96 4.98l2.99 2.33A5.4 5.4 0 0 1 9 3.58z"/>
          </svg>
          <span className="sans" style={{ whiteSpace: "nowrap" }}>continue with google</span>
        </button>

        <div style={{ display: "flex", alignItems: "center", gap: 12, width: "100%", margin: "6px 0 22px", color: "var(--ink-3)" }}>
          <div style={{ flex: 1, height: 1, background: "rgba(110,90,71,0.2)" }} />
          <span className="smallcaps" style={{ fontSize: 10 }}>or</span>
          <div style={{ flex: 1, height: 1, background: "rgba(110,90,71,0.2)" }} />
        </div>

        <form onSubmit={sendMagicLink} style={{ width: "100%" }}>
          <input
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            type="email"
            placeholder="you@school.edu"
            className="sans"
            disabled={busy}
            style={{
              width: "100%", padding: "14px 18px",
              borderRadius: 12, background: "var(--surface)",
              boxShadow: "var(--shadow-soft)",
              fontSize: 15, color: "var(--ink)", marginBottom: 14,
            }}
          />
          <button type="submit" disabled={busy || !email} className="lift" style={{
            width: "100%", padding: "14px 18px",
            borderRadius: 12, background: "var(--accent)",
            color: "var(--surface)", fontSize: 15,
            boxShadow: "var(--shadow-soft)",
            opacity: (busy || !email) ? 0.6 : 1,
          }}>
            <span className="sans">{busy ? "sending…" : "send magic link"}</span>
          </button>
        </form>

        {error && (
          <p className="sans" style={{ color: "var(--accent-deep)", marginTop: 18, fontSize: 13, textAlign: "center" }}>
            {error}
          </p>
        )}

        <p className="smallcaps" style={{ color: "var(--ink-3)", marginTop: 32, textAlign: "center", lineHeight: 1.6 }}>
          new here? a Folio account is created<br/>the first time you sign in.
        </p>
      </div>
    </div>
  );
}
